import { formatRenderSummaryForPrompt } from './summarizeRender.js';

/** ~500 tokens */
export const SERIES_MEMORY_MAX_CHARS = 2000;

/** Total budget for series block injected into Scene Director (~1200 tokens) */
export const SERIES_CONTEXT_CHAR_BUDGET = 4800;

export function truncateToCharBudget(text, maxChars) {
  const s = String(text || '').trim();
  if (!s || s.length <= maxChars) return s;
  return `${s.slice(0, Math.max(0, maxChars - 3))}...`;
}

export function estimateTokens(text) {
  return Math.ceil(String(text || '').length / 4);
}

/**
 * Builds a compact series context block for LLM prompts (never includes director_json or file paths).
 */
export function buildSeriesContextBlock({
  styleBible = '',
  seriesMemory = '',
  episodeSynopsis = '',
  recentSummaries = [],
  maxSummaries = 5,
} = {}) {
  const sections = [];

  const bible = truncateToCharBudget(styleBible, 800);
  if (bible) sections.push(`STYLE_BIBLE:\n${bible}`);

  const memory = truncateToCharBudget(seriesMemory, SERIES_MEMORY_MAX_CHARS);
  if (memory) sections.push(`SERIES_MEMORY:\n${memory}`);

  const synopsis = truncateToCharBudget(episodeSynopsis, 400);
  if (synopsis) sections.push(`EPISODE_SYNOPSIS:\n${synopsis}`);

  const summaries = recentSummaries.slice(0, maxSummaries);
  if (summaries.length > 0) {
    const lines = summaries.map((s, i) => {
      const json = typeof s.summary_json === 'string' ? JSON.parse(s.summary_json) : s.summary_json;
      return `[${i + 1}] ${formatRenderSummaryForPrompt(json)}`;
    });
    sections.push(`RECENT_CANON_SCENES:\n${lines.join('\n\n')}`);
  }

  let block = sections.join('\n\n');
  if (block.length > SERIES_CONTEXT_CHAR_BUDGET) {
    block = truncateToCharBudget(block, SERIES_CONTEXT_CHAR_BUDGET);
  }

  return block;
}
