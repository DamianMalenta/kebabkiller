import { getKnowledgeContext, getSeriesContextForLlm } from '../db/models.js';
import { buildSeriesContextBlock } from './seriesContext.js';
import {
  deriveStoryboardFromBeats,
  inferKinematicsFromPolish,
  reconcileKinematicsWithPrompt,
} from './kinematicsFromPrompt.js';
import { WAN_FORMAT_PROMPT, parseI2vProfileId } from '../video/wanConfig.js';
import { applyI2vProductionProfile } from './i2vProduction.js';

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

function parseSuggestionsFromText(text) {
  const trimmed = text.trim().replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
  const parsed = JSON.parse(trimmed);
  if (!Array.isArray(parsed.suggestions)) {
    throw new Error('LLM response missing suggestions array');
  }
  return parsed.suggestions;
}

async function callGroqRaw(systemPrompt, userMessage, { jsonObject = true } = {}) {
  const apiKey = process.env.GROQ_API_KEY?.trim();
  if (!apiKey) return null;

  const body = {
    model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
    temperature: 0.4,
  };
  if (jsonObject) body.response_format = { type: 'json_object' };

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new Error(`Groq API error: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content;
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
    return { seriesContextBlock: '', styleBible: '' };
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

  const rawNegatives = [char?.negative_prompt || '', PIPELINE_CONFIG.baseNegativePrompt]
    .join(', ')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const finalNegativePrompt = Array.from(new Set(rawNegatives)).join(', ');

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

function parseJsonFromText(text) {
  const trimmed = text.trim().replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
  return JSON.parse(trimmed);
}

async function callGemini(userMessage) {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return null;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${process.env.GEMINI_MODEL || 'gemini-2.0-flash'}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT_INTENT_ENGINE }] },
      contents: [{ role: 'user', parts: [{ text: userMessage }] }],
      generationConfig: {
        temperature: PIPELINE_CONFIG.temperature,
        responseMimeType: 'application/json',
      },
    }),
  });

  if (!res.ok) throw new Error(`Gemini API error: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return parseJsonFromText(data.candidates?.[0]?.content?.parts?.[0]?.text);
}

async function callGroq(userMessage) {
  const apiKey = process.env.GROQ_API_KEY?.trim();
  if (!apiKey) return null;

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT_INTENT_ENGINE },
        { role: 'user', content: userMessage },
      ],
      temperature: PIPELINE_CONFIG.temperature,
      response_format: { type: 'json_object' },
    }),
  });

  if (!res.ok) throw new Error(`Groq API error: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return parseJsonFromText(data.choices?.[0]?.message?.content);
}

async function callOpenAI(userMessage) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT_INTENT_ENGINE },
        { role: 'user', content: userMessage },
      ],
      temperature: PIPELINE_CONFIG.temperature,
      response_format: { type: 'json_object' },
    }),
  });

  if (!res.ok) throw new Error(`OpenAI API error: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return parseJsonFromText(data.choices?.[0]?.message?.content);
}

async function callAnthropic(userMessage) {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) return null;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 2048,
      system: SYSTEM_PROMPT_INTENT_ENGINE,
      temperature: PIPELINE_CONFIG.temperature,
      messages: [{ role: 'user', content: userMessage }],
    }),
  });

  if (!res.ok) throw new Error(`Anthropic API error: ${res.status} ${await res.text()}`);
  const data = await res.json();
  const match = data.content?.[0]?.text?.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('Anthropic returned no JSON');
  return JSON.parse(match[0]);
}

const PROVIDERS = [
  { name: 'groq', call: callGroq },
  { name: 'openai', call: callOpenAI },
  { name: 'anthropic', call: callAnthropic },
];

export function getLlmProviderStatus() {
  return {
    node_options: process.env.NODE_OPTIONS || null,
    configured: {
      gemini: Boolean(process.env.GEMINI_API_KEY?.trim()),
      groq: Boolean(process.env.GROQ_API_KEY?.trim()),
      openai: Boolean(process.env.OPENAI_API_KEY?.trim()),
      anthropic: Boolean(process.env.ANTHROPIC_API_KEY?.trim()),
    },
  };
}

async function tryWithRetry(providerName, fn) {
  let delay = PIPELINE_CONFIG.baseDelayMs;
  for (let attempt = 1; attempt <= PIPELINE_CONFIG.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const msg = err.message || '';
      const isRetryable = /(503|429|Too Many Requests|fetch failed|ECONNRESET|500|502)/i.test(msg);
      if (isRetryable && attempt < PIPELINE_CONFIG.maxRetries) {
        console.warn(`[AI Director] ${providerName} overloaded. Attempt ${attempt}/${PIPELINE_CONFIG.maxRetries}. Waiting ${delay}ms...`);
        await new Promise((r) => setTimeout(r, delay));
        delay *= 2;
        continue;
      }
      throw err;
    }
  }
}

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
  let lastError = null;

  for (const provider of PROVIDERS) {
    try {
      const rawIntent = await tryWithRetry(provider.name, () => provider.call(userMessage));
      if (rawIntent) {
        const intentPlan = normalizeIntentPlan(rawIntent, userPrompt);
        intentPlan._source = intentPlan._source || provider.name;
        const plan = executeAssetBinding(intentPlan, context, bindingOptions);
        return maybeApplyProductionProfile(plan, { i2vProfile, durationSec });
      }
    } catch (err) {
      lastError = err.message;
      console.warn(`[AI Director] ${provider.name} failed:`, err.message);
    }
  }

  console.warn('[AI Director] All LLM providers failed, falling back to mock:', lastError);
  const mockIntent = buildMockIntent(userPrompt, lastError);
  const plan = executeAssetBinding(mockIntent, context, bindingOptions);
  return maybeApplyProductionProfile(plan, { i2vProfile, durationSec });
}

function maybeApplyProductionProfile(plan, { i2vProfile, durationSec }) {
  const profile = (i2vProfile || parseI2vProfileId()).toUpperCase();
  if (profile === 'I2V_PRODUCTION') {
    return applyI2vProductionProfile(plan, { i2vProfile: profile, durationSec });
  }
  return plan;
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

  try {
    const raw = await callGroqRaw(SYSTEM_PROMPT_SERIES_SUGGEST, userMessage);
    if (raw) {
      const suggestions = parseSuggestionsFromText(raw);
      return {
        suggestions: suggestions.map((s) => ({ ...s, _source: 'groq' })),
        series_context_used: Boolean(seriesContextBlock),
        project_id: ctx.project.id,
        episode_id: ctx.episode?.id ?? null,
      };
    }
  } catch (err) {
    console.warn('[AI Director] suggest failed:', err.message);
  }

  return {
    suggestions: buildMockSuggestions(briefPl, Math.min(count, 3), ctx.project.name),
    series_context_used: Boolean(seriesContextBlock),
    project_id: ctx.project.id,
    episode_id: ctx.episode?.id ?? null,
    _source: 'mock',
  };
}
