import { truncateToCharBudget, SERIES_MEMORY_MAX_CHARS } from './seriesContext.js';
import { formatRenderSummaryForPrompt } from './summarizeRender.js';
import { callGroq as callGroqShared, callOpenAI as callOpenAIShared, tryProviders } from '../utils/llm.js';

const COMPACTION_TIMEOUT_MS = Number(process.env.MEMORY_COMPACTION_TIMEOUT_MS) || 25_000;

const SYSTEM_PROMPT = `You compress serialized animation series memory.
You receive OLD series memory, optional STYLE_BIBLE, CHRONOLOGY (episode + scene position), and a NEW accepted canon scene summary.
Return ONLY the UPDATED series memory text — no markdown, no JSON, no preamble.

RULES:
1. Maximum 400 words (~500 tokens). Hard limit.
2. OVERWRITE and COMPRESS — never append at the end.
3. Keep hard canon facts and character/world evolution.
4. Drop one-off gag details from early episodes.
5. Never include negative prompts, file paths, or technical render settings.
6. On conflict: STYLE_BIBLE > old memory > new scene.
7. Respect CHRONOLOGY — place the new scene in the correct episode/scene order; do not treat a later episode as an earlier event.
8. Write in Polish. Use short sections: HARD FACTS, CONTINUITY, RECURRING MOTIFS.`;

/**
 * Rule-based fallback when compaction LLM is unavailable.
 */
export function mergeSummariesRuleBased(
  oldSeriesMemory,
  styleBible,
  newRenderSummary,
  sceneContext = {},
) {
  const hardFacts = truncateToCharBudget(styleBible, 600);
  const old = truncateToCharBudget(oldSeriesMemory, 800);
  const chronology = formatSceneContextBlock(sceneContext);
  const sceneLine = formatRenderSummaryForPrompt(newRenderSummary);

  const parts = [
    'HARD FACTS:',
    hardFacts || '(brak style bible)',
    '',
    'CONTINUITY:',
    old || '(pierwsza scena kanonu)',
    '',
    'CHRONOLOGIA:',
    chronology,
    '',
    'OSTATNIA SCENA KANON:',
    sceneLine,
  ];

  return truncateToCharBudget(parts.join('\n'), SERIES_MEMORY_MAX_CHARS);
}

async function callGroqCompaction(userMessage) {
  return callGroqShared(SYSTEM_PROMPT, userMessage, {
    model: process.env.MEMORY_COMPACTION_MODEL || 'llama-3.1-8b-instant',
    temperature: 0.1,
    maxTokens: 650,
    jsonMode: false,
    timeoutMs: COMPACTION_TIMEOUT_MS,
  });
}

async function callOpenAiCompaction(userMessage) {
  return callOpenAIShared(SYSTEM_PROMPT, userMessage, {
    model: process.env.MEMORY_COMPACTION_OPENAI_MODEL || 'gpt-4o-mini',
    temperature: 0.1,
    maxTokens: 650,
    jsonMode: false,
    timeoutMs: COMPACTION_TIMEOUT_MS,
  });
}

export function formatSceneContextBlock(sceneContext = {}) {
  const {
    episodeId,
    episodeNumber,
    episodeTitle,
    sceneIndex,
  } = sceneContext;

  const lines = [];
  if (episodeNumber != null) {
    lines.push(`Odcinek: ${episodeNumber}${episodeTitle ? ` — "${episodeTitle}"` : ''}`);
  } else if (episodeId) {
    lines.push(`Odcinek (id): ${episodeId}`);
  }
  if (sceneIndex != null) {
    lines.push(`Scena w odcinku: ${sceneIndex}`);
  }
  if (lines.length === 0) {
    lines.push('Chronologia: nieznana (brak episode_id / scene_index w jobie)');
  }
  return lines.join('\n');
}

export function buildCompactionUserMessage({
  oldSeriesMemory,
  styleBible,
  newRenderSummary,
  sceneContext = {},
}) {
  const style = truncateToCharBudget(styleBible, 800);
  const old = truncateToCharBudget(oldSeriesMemory, SERIES_MEMORY_MAX_CHARS);
  const scene = formatRenderSummaryForPrompt(newRenderSummary);
  const chronology = formatSceneContextBlock(sceneContext);

  return [
    style ? `STYLE_BIBLE:\n${style}` : '',
    `CHRONOLOGY:\n${chronology}`,
    `OLD_SERIES_MEMORY:\n${old || '(pusty — pierwsza scena serialu)'}`,
    `NEW_CANON_SCENE:\n${scene}`,
    'Zaktualizuj pamięć serialu (nadpisz, skompresuj) z uwzględnieniem chronologii odcinka i sceny.',
  ].filter(Boolean).join('\n\n');
}

function normalizeCompactionOutput(text) {
  let out = String(text || '').trim();
  out = out.replace(/^```[\s\S]*?\n/, '').replace(/\n```$/, '').trim();
  return truncateToCharBudget(out, SERIES_MEMORY_MAX_CHARS);
}

/**
 * Update & Compress: replaces series_memory (never appends).
 * @returns {{ memory: string, source: string }}
 */
export async function compactSeriesMemory({
  oldSeriesMemory,
  styleBible,
  newRenderSummary,
  sceneContext = {},
}) {
  const userMessage = buildCompactionUserMessage({
    oldSeriesMemory,
    styleBible,
    newRenderSummary,
    sceneContext,
  });

  const llmResult = await tryProviders(
    [
      { name: 'groq', call: () => callGroqCompaction(userMessage) },
      { name: 'openai', call: () => callOpenAiCompaction(userMessage) },
    ],
    { logPrefix: '[MemoryCompaction]' },
  );

  if (llmResult) {
    const memory = normalizeCompactionOutput(llmResult.result);
    if (memory.length > 0) {
      return { memory, source: llmResult.source };
    }
  }

  const memory = mergeSummariesRuleBased(
    oldSeriesMemory,
    styleBible,
    newRenderSummary,
    sceneContext,
  );
  return {
    memory,
    source: 'rule_based',
    llm_errors: [{ provider: 'all', error: 'All LLM providers failed or returned empty result' }],
  };
}
