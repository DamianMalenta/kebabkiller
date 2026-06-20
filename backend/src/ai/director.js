/**
 * @deprecated LEGACY AI Director
 *
 * Endpointy zostały wycofane (2026-06-20):
 * - POST /director/preview → użyj Director's Desk (/director-desk/*)
 * - POST /director/suggest → użyj Director's Desk
 * - POST /jobs (auto-preview) → użyj Director's Desk
 *
 * Nowy system: Director's Desk (ai/directorDesk/)
 * - agentServer.js - główny handler wiadomości
 * - workflowBuilder.js - enrichment i payload
 * - agentTools.js - narzędzia dla agenta
 *
 * Ten plik jest zachowany tylko dla getLlmProviderStatus.
 * Funkcje expandScenePrompt, previewDirectorPlan, suggestEpisodePrompts są deprecated.
 */

import { getKnowledgeContext, getSeriesContextForLlm } from '../db/models.js';
import { buildSeriesContextBlock } from './seriesContext.js';
import {
  deriveStoryboardFromBeats,
  inferKinematicsFromPolish,
  reconcileKinematicsWithPrompt,
} from './kinematicsFromPrompt.js';
import { WAN_FORMAT_PROMPT, parseI2vProfileId } from '../video/wanConfig.js';
import { enrichDirectorForRender } from './directorDesk/workflowBuilder.js';
import {
  callGroq as callGroqShared,
  callOpenAI as callOpenAIShared,
  callAnthropic as callAnthropicShared,
  callGemini as callGeminiShared,
  tryProviders,
  getLlmProviderStatus,
} from '../utils/llm.js';
import { deduplicateNegativePrompt } from '../utils/prompt.js';

const PIPELINE_CONFIG = {
  maxRetries: 3,
  baseDelayMs: 1000,
  temperature: 0.2, // slightly higher to allow creative cinematography
  wan21Format: WAN_FORMAT_PROMPT,
  lensMasterBlock: 'High quality, detailed, sharp focus.', // relaxed to allow cinematic shots
  baseNegativePrompt:
    'low quality, watermark, text overlay, deformed background, melting texture, extra limbs, mutated, bad anatomy',
};

const ALLOWED_SUBJECT_STATES = new Set([
  'standing',
  'falling',
  'lying',
  'rolling',
  'sitting',
  'jumping',
  'running',
]);

const ALLOWED_VELOCITIES = new Set(['rapid', 'slow', 'static']);

const VISUAL_CONTAMINATION_PATTERN =
  /\b(cinematic|bokeh|blur(?:ry|red)?|soft\s+focus|depth\s+of\s+field|shallow\s+focus|macro|telephoto|wide\s+angle|lens|camera|lighting|spotlight|dolly|pan(?:ning)?|zoom|foreground|background\s+split|f\/\d|aperture|exposure|hdr|golden\s+hour|dramatic|film\s+grain|vignette|orthographic\s+view|portrait|close[\s-]?up|out\s+of\s+focus|defocused)\b/i;

const SYSTEM_PROMPT_INTENT_ENGINE = `[SYSTEM CONFIGURATION: CINEMATOGRAPHY & INTENT ENGINE]
You are an expert AI Director and Cinematographer for an English CLIP/T5 video diffusion pipeline (RunComfy / Wan I2V).
Your job is to translate a Polish scene description into a structured JSON plan for video generation.

LANGUAGE RULE (CRITICAL — CLIP SAFETY):
- ALL string values in your JSON output MUST be in ENGLISH only.
- NEVER copy or paste Polish text from STYLE_BIBLE, SERIES_MEMORY, USER SCENE, or any input into output fields.
- STYLE_BIBLE and SERIES_MEMORY (when provided) are Polish REFERENCE ONLY — read them for mood/rules, then translate into concise English diffusion tags in style_tags_en.
- style_tags_en = comma-separated English tags for the Wan/CLIP encoder (e.g. "dark phonk aesthetic, high contrast, macro food porn, dramatic shadows, glowing heat, sharp meat texture").
- visual_scene, scene_summary, cinematography values, kinematics.primary_motion = English only.

ABSOLUTE CONSTRAINTS:
1. DO NOT describe the character's permanent identity (body shape, face, limbs, costume) or the static background layout — these are injected automatically via LoRA/IP-Adapter.
2. DO preserve ALL transient visual details from the user scene in visual_scene (translated to English): sparks, smoke, steam, fire, embers, particles, meat texture, sizzling, glowing heat, dramatic shadows, color atmosphere.
3. kinematics.primary_motion = rigid-body physics and trajectory ONLY (no camera/lens terms).
4. cinematography = camera angles, movement, and lighting mood (English).
5. Your output MUST be 100% valid JSON matching the schema below. No markdown. No conversational text.

JSON SCHEMA:
{
  "scene_summary": "string (English: core action in one sentence)",
  "visual_scene": "string (English: every visual effect, texture, particle, smoke, spark, atmosphere from the Polish input — NOT character identity or static background)",
  "style_tags_en": "string (English ONLY: comma-separated diffusion tags distilled from STYLE_BIBLE mood/atmosphere — never paste Polish prose)",
  "cinematography": {
    "camera_shot": "wide shot|medium shot|close-up|low angle|high angle|extreme close-up",
    "camera_motion": "static|pan left|pan right|tilt up|tilt down|dolly in|dolly out|zoom in|zoom out|tracking",
    "lighting": "cinematic lighting|natural light|dramatic shadows|studio lighting|neon lights|warm oven glow"
  },
  "kinematics": {
    "subject_state": "standing|falling|lying|rolling|sitting|jumping|running",
    "primary_motion": "string (physical trajectory only — no camera or lens terms)",
    "velocity": "rapid|slow|static"
  }
}

MULTI-BEAT SCENES:
- If the Polish text describes setup then action, subject_state must match the PRIMARY animated action in this clip (usually the dynamic motion after a transition such as nagle, potem, następnie).
- primary_motion may describe the full beat sequence in chronological order.
- subject_state must agree with the dominant motion (never sitting if the main action is a jump).
- visual_scene must include sensory details even when the user focuses on camera angle (e.g. sparks, smoke, sizzling meat).`;

function buildIntentPrompt(userPrompt, context, seriesContextBlock = '') {
  const kinematicRules = context.rules
    .filter((r) => r.category === 'kinematic')
    .map((r) => `- ${r.title}: ${r.content}`)
    .join('\n');

  const char = context.characters?.[0];
  const charConstraint = char?.name
    ? `\nCHARACTER PHYSICS CONSTRAINT (${char.name}): Rigid body only. No human joint articulation unless explicitly stated in kinematic rules.`
    : '';

  const seriesBlock = seriesContextBlock
    ? `\n\nSERIES CONTINUITY (Polish reference — translate mood into style_tags_en; NEVER paste Polish into JSON output):\n${seriesContextBlock}\n`
    : '';

  return `KINEMATIC & CINEMA RULES:\n${kinematicRules || 'No kinematic rules.'}${charConstraint}${seriesBlock}\n\nUSER SCENE (Polish — translate visuals to English in visual_scene and style_tags_en):\n${userPrompt}\n\nTRANSLATE TO DIRECTOR JSON (English only in all output fields):`;
}

const SYSTEM_PROMPT_SERIES_SUGGEST = `[SYSTEM: SERIES SCENE SUGGESTER]
You propose new Polish scene descriptions for a vertical 9:16 animated series.
Use SERIES_MEMORY and RECENT_CANON_SCENES for continuity — never repeat full old scenes.
Output ONLY valid JSON:
{
  "suggestions": [
    {
      "scene_prompt_pl": "string (Polish scene description to paste into Studio)",
      "rationale_pl": "string (why this fits the series)",
      "tone": ["string"]
    }
  ]
}
Rules: rigid-body physics for Kebabkiller, no human arms, keep warm oven/kitchen tone unless brief says otherwise.`;

function buildSuggestUserMessage({ briefPl, count, seriesContextBlock }) {
  return `${seriesContextBlock}\n\nBRIEF (PL):\n${briefPl}\n\nWygeneruj ${count} nowych propozycji scen (scene_prompt_pl). JSON only.`;
}

function extractSuggestions(parsed) {
  if (!parsed || !Array.isArray(parsed.suggestions)) {
    throw new Error('LLM response missing suggestions array');
  }
  return parsed.suggestions;
}

function buildMockSuggestions(briefPl, count, projectName) {
  const base = briefPl?.trim() || 'Kebabkiller w piecu ceglanym';
  return Array.from({ length: count }, (_, i) => ({
    scene_prompt_pl: `${base}. Scena ${i + 1}: sztywny ruch bryły, kamera medium shot.`,
    rationale_pl: `Propozycja mock dla serialu ${projectName || 'Kebabkiller'}.`,
    tone: ['warm', 'physical comedy'],
    _source: 'mock',
  }));
}

function resolveSeriesContext({ projectId, episodeId }) {
  if (!projectId && !episodeId) {
    return { seriesContextBlock: '', styleBible: '' };
  }
  try {
    const ctx = getSeriesContextForLlm({ projectId, episodeId, maxSummaries: 5 });
    return {
      styleBible: ctx.project.style_bible || '',
      seriesContextBlock: buildSeriesContextBlock({
        styleBible: ctx.project.style_bible,
        seriesMemory: ctx.project.series_memory,
        episodeSynopsis: ctx.episode?.synopsis_pl || '',
        recentSummaries: ctx.recent_summaries,
      }),
    };
  } catch (err) {
    console.warn('[AI Director] Series context unavailable:', err.message);
    return { seriesContextBlock: '', styleBible: '', contextError: err.message };
  }
}

const POLISH_DIACRITICS = /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/;
const POLISH_PROSE_IN_TAGS = /\b(Kanon Wizualny|Zasady:|Mroczny phonk|serialu|Kebabkiller to)\b/i;

function containsPolishText(text) {
  const s = String(text || '');
  return POLISH_DIACRITICS.test(s) || POLISH_PROSE_IN_TAGS.test(s);
}

/** Sanitize LLM style tags — must be English diffusion tags, never pasted Polish prose. */
function sanitizeStyleTagsEn(raw) {
  const s = String(raw || '').trim().replace(/\s+/g, ' ');
  if (!s) return '';
  if (containsPolishText(s)) {
    console.warn('[AI Director] style_tags_en contained Polish/prose — dropped for CLIP safety');
    return '';
  }
  return s.length <= 320 ? s : `${s.slice(0, 317)}...`;
}

function buildStyleTagsBlock(intentPlan) {
  const tags = sanitizeStyleTagsEn(intentPlan.style_tags_en);
  if (!tags) return '';
  return `Series style: ${tags}.`;
}

function buildVisualSceneBlock(intentPlan, userPrompt) {
  const visual =
    intentPlan.visual_scene?.trim()
    || intentPlan.scene_summary?.trim()
    || userPrompt?.trim();
  if (!visual) return '';
  return `Scene visuals: ${visual.replace(/\s+/g, ' ')}.`;
}

function buildMockIntent(userPrompt, llmError = null) {
  const kinematics = inferKinematicsFromPolish(userPrompt);

  return {
    scene_summary: userPrompt,
    visual_scene: userPrompt,
    cinematography: {
      camera_shot: 'medium shot',
      camera_motion: 'static',
      lighting: 'cinematic lighting',
    },
    kinematics,
    technical_notes: llmError ? `LLM Error: ${llmError}` : 'Mock cinematic plan',
    _source: 'mock',
    _llm_error: llmError,
  };
}

function validateKinematics(kinematics) {
  if (!kinematics || typeof kinematics !== 'object') {
    return { valid: false, reason: 'Missing kinematics object' };
  }

  const { subject_state, primary_motion, velocity } = kinematics;

  if (!subject_state || !ALLOWED_SUBJECT_STATES.has(subject_state)) {
    return { valid: false, reason: `Invalid subject_state: ${subject_state}` };
  }
  if (!velocity || !ALLOWED_VELOCITIES.has(velocity)) {
    return { valid: false, reason: `Invalid velocity: ${velocity}` };
  }
  if (!primary_motion || typeof primary_motion !== 'string' || !primary_motion.trim()) {
    return { valid: false, reason: 'Missing primary_motion' };
  }
  if (VISUAL_CONTAMINATION_PATTERN.test(primary_motion)) {
    // Only warn, don't invalidate completely, as we want to allow cinematic terms now
    console.warn('[AI Director] Visual term detected in primary_motion, but allowed in cinematic mode:', primary_motion);
  }

  return { valid: true };
}

function compileKinematicBlock(kinematics) {
  const { subject_state, primary_motion, velocity } = kinematics;
  // Translate bare "none" to something WAN 2.1 understands as truly static
  const rawMotion = primary_motion?.trim() || '';
  const motionDesc = rawMotion.toLowerCase() === 'none' ? 'holding position, static pose' : rawMotion;
  return `Action: The subject is ${subject_state}. Motion: ${motionDesc} at a ${velocity} pace.`;
}

function deriveMotionPhysics(kinematics) {
  const { subject_state, primary_motion, velocity } = kinematics;
  return `Rigid body dynamics. Subject state: ${subject_state}. Velocity: ${velocity}. Trajectory: ${primary_motion.trim()}. No human joint articulation.`;
}

function normalizeIntentPlan(intentPlan, userPrompt) {
  if (intentPlan.kinematics) {
    const { kinematics, beats, changed } = reconcileKinematicsWithPrompt(userPrompt, intentPlan.kinematics);
    intentPlan.kinematics = kinematics;
    if (beats.length > 0) {
      intentPlan._motion_beats = beats;
    }
    if (changed) {
      console.warn('[AI Director] Reconciled kinematics with user prompt cues');
    }

    const validation = validateKinematics(intentPlan.kinematics);
    if (!validation.valid) {
      console.warn(`[AI Director] Kinematic validation failed: ${validation.reason}`);
      return buildMockIntent(userPrompt, validation.reason);
    }
    // Ensure cinematography exists
    if (!intentPlan.cinematography) {
      intentPlan.cinematography = {
        camera_shot: 'medium shot',
        camera_motion: 'static',
        lighting: 'natural light'
      };
    }
    if (intentPlan.style_tags_en !== undefined) {
      intentPlan.style_tags_en = sanitizeStyleTagsEn(intentPlan.style_tags_en);
    }
    return intentPlan;
  }

  // Legacy LLM output fallback — convert old action_prompt shape to kinematics
  if (intentPlan.action_prompt) {
    const inferred = inferKinematicsFromPolish(intentPlan.scene_summary || userPrompt);
    inferred.primary_motion = intentPlan.action_prompt.trim() || inferred.primary_motion;
    intentPlan.kinematics = inferred;
    
    intentPlan.cinematography = intentPlan.camera ? {
      camera_shot: intentPlan.camera.angle || 'medium shot',
      camera_motion: intentPlan.camera.movement || 'static',
      lighting: 'cinematic lighting'
    } : { camera_shot: 'medium shot', camera_motion: 'static', lighting: 'cinematic lighting' };
    
    delete intentPlan.action_prompt;
    delete intentPlan.camera;
    return normalizeIntentPlan(intentPlan, userPrompt);
  }

  return buildMockIntent(userPrompt, 'LLM returned no kinematics');
}

function executeAssetBinding(intentPlan, context, { userPrompt = '' } = {}) {
  const kinematics = intentPlan.kinematics;
  const kinematicBlock = compileKinematicBlock(kinematics);

  const cinema = intentPlan.cinematography || { camera_shot: 'medium shot', camera_motion: 'static', lighting: 'natural light' };
  const cinemaBlock = `Cinematography: ${cinema.camera_shot}, ${cinema.camera_motion}, ${cinema.lighting}.`;

  const char = context.characters?.[0];
  const bg = context.backgrounds?.[0];

  const identityBlock = char?.identity_block_en || char?.description || '';
  const environmentBlock =
    bg?.environment_block_en ||
    (bg?.description ? `Setting: ${bg.description}.` : '');

  const visualBlock = buildVisualSceneBlock(intentPlan, userPrompt);
  const styleBlock = buildStyleTagsBlock(intentPlan);

  const hasCompositeRefs = Boolean(char?.reference_path && bg?.reference_path);
  // Zmieniamy łączenie na przecinki, żeby Wan lepiej czytał (comma-separated tags)
  const finalPositivePrompt = [
    visualBlock,
    styleBlock,
    cinemaBlock,
    PIPELINE_CONFIG.lensMasterBlock,
    PIPELINE_CONFIG.wan21Format,
    ...(hasCompositeRefs ? [] : [environmentBlock, identityBlock]),
    kinematicBlock,
  ]
    .filter(Boolean)
    .join(', ');

  const finalNegativePrompt = deduplicateNegativePrompt(
    char?.negative_prompt || '',
    PIPELINE_CONFIG.baseNegativePrompt,
  );

  const finalPlan = {
    scene_summary: intentPlan.scene_summary,
    visual_scene: intentPlan.visual_scene || intentPlan.scene_summary || userPrompt || '',
    render_strategy: 'native_i2v',
    cinematography: cinema,
    kinematics,
    motion_physics: deriveMotionPhysics(kinematics),
    storyboard: deriveStoryboardFromBeats(intentPlan._motion_beats || [], kinematics),
    positive_prompt: finalPositivePrompt,
    negative_prompt: finalNegativePrompt,
    character_ref: char?.reference_path || null,
    background_ref: bg?.reference_path || null,
    _source: intentPlan._source,
    _llm_error: intentPlan._llm_error,
  };

  if (intentPlan.technical_notes) {
    finalPlan.technical_notes = intentPlan.technical_notes;
  }

  return finalPlan;
}

function callGemini(userMessage) {
  return callGeminiShared(SYSTEM_PROMPT_INTENT_ENGINE, userMessage, {
    temperature: PIPELINE_CONFIG.temperature,
  });
}

function callGroq(userMessage) {
  return callGroqShared(SYSTEM_PROMPT_INTENT_ENGINE, userMessage, {
    temperature: PIPELINE_CONFIG.temperature,
  });
}

function callOpenAI(userMessage) {
  return callOpenAIShared(SYSTEM_PROMPT_INTENT_ENGINE, userMessage, {
    temperature: PIPELINE_CONFIG.temperature,
  });
}

function callAnthropic(userMessage) {
  return callAnthropicShared(SYSTEM_PROMPT_INTENT_ENGINE, userMessage, {
    temperature: PIPELINE_CONFIG.temperature,
  });
}

const PROVIDERS = [
  { name: 'groq', call: callGroq },
  { name: 'openai', call: callOpenAI },
  { name: 'anthropic', call: callAnthropic },
];

export { getLlmProviderStatus };

export async function expandScenePrompt(userPrompt, {
  characterId,
  backgroundId,
  projectId,
  episodeId,
  i2vProfile,
  durationSec,
} = {}) {
  const context = getKnowledgeContext();

  if (characterId) context.characters = context.characters.filter((c) => c.id === characterId);
  if (backgroundId) context.backgrounds = context.backgrounds.filter((b) => b.id === backgroundId);

  const { seriesContextBlock } = resolveSeriesContext({ projectId, episodeId });
  const bindingOptions = { userPrompt };
  const userMessage = buildIntentPrompt(userPrompt, context, seriesContextBlock);

  const llmResult = await tryProviders(
    PROVIDERS.map((p) => ({ name: p.name, call: () => p.call(userMessage) })),
    { maxRetries: PIPELINE_CONFIG.maxRetries, baseDelayMs: PIPELINE_CONFIG.baseDelayMs, logPrefix: '[AI Director]' },
  );

  if (llmResult) {
    const intentPlan = normalizeIntentPlan(llmResult.result, userPrompt);
    intentPlan._source = intentPlan._source || llmResult.source;
    const plan = executeAssetBinding(intentPlan, context, bindingOptions);
    return maybeApplyProductionProfile(plan, { i2vProfile, durationSec });
  }

  console.warn('[AI Director] All LLM providers failed, falling back to mock');
  const mockIntent = buildMockIntent(userPrompt);
  const plan = executeAssetBinding(mockIntent, context, bindingOptions);
  return maybeApplyProductionProfile(plan, { i2vProfile, durationSec });
}

function maybeApplyProductionProfile(plan, { i2vProfile, durationSec }) {
  // Legacy: używamy enrichDirectorForRender zamiast applyI2vProductionProfile
  // TODO: pełna migracja do Director's Desk workflow
  const { enrichedDirector } = enrichDirectorForRender({
    directorJson: plan,
    userPrompt: plan.visual_scene || '',
    project: { 
      canon: { 
        default_i2v_profile: i2vProfile || parseI2vProfileId(),
        style_tags: [], // Puste array dla kompatybilności z enrichDirectorForRender
      } 
    },
    scene: { duration_sec: durationSec || plan.duration_sec, ai_overrides: {} },
    generatorTags: [],
  });
  return enrichedDirector;
}

export async function previewDirectorPlan(userPrompt, options) {
  return expandScenePrompt(userPrompt, options);
}

export async function suggestEpisodePrompts({
  projectId,
  episodeId,
  briefPl,
  count = 3,
} = {}) {
  if (!briefPl?.trim()) {
    throw new Error('brief_pl is required');
  }
  if (!projectId && !episodeId) {
    throw new Error('project_id or episode_id is required');
  }

  const ctx = getSeriesContextForLlm({ projectId, episodeId, maxSummaries: 5 });
  const seriesContextBlock = buildSeriesContextBlock({
    styleBible: ctx.project.style_bible,
    seriesMemory: ctx.project.series_memory,
    episodeSynopsis: ctx.episode?.synopsis_pl || '',
    recentSummaries: ctx.recent_summaries,
  });

  const userMessage = buildSuggestUserMessage({
    briefPl,
    count: Math.min(Math.max(count, 1), 6),
    seriesContextBlock,
  });

  let llmError = null;
  try {
    const parsed = await callGroqShared(SYSTEM_PROMPT_SERIES_SUGGEST, userMessage, { temperature: 0.4 });
    if (parsed) {
      const suggestions = extractSuggestions(parsed);
      return {
        suggestions: suggestions.map((s) => ({ ...s, _source: 'groq' })),
        series_context_used: Boolean(seriesContextBlock),
        project_id: ctx.project.id,
        episode_id: ctx.episode?.id ?? null,
      };
    }
  } catch (err) {
    llmError = err.message;
    console.warn('[AI Director] suggest failed:', err.message);
  }

  return {
    suggestions: buildMockSuggestions(briefPl, Math.min(count, 3), ctx.project.name),
    series_context_used: Boolean(seriesContextBlock),
    project_id: ctx.project.id,
    episode_id: ctx.episode?.id ?? null,
    _source: 'mock',
    ...(llmError ? { llm_error: llmError } : {}),
  };
}
