import { getKnowledgeContext } from '../db/models.js';
import { WAN_FORMAT_PROMPT } from '../video/wanConfig.js';

const PIPELINE_CONFIG = {
  maxRetries: 3,
  baseDelayMs: 1000,
  temperature: 0.2, // slightly higher to allow creative cinematography
  wan21Format: WAN_FORMAT_PROMPT,
  lensMasterBlock: 'High quality, detailed, sharp focus.', // relaxed to allow cinematic shots
  baseNegativePrompt:
    'low quality, watermark, text overlay, deformed background, melting texture, extra limbs, mutated, bad anatomy', // removed photographic terms like bokeh/dof from negative
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
You are an expert AI Director and Cinematographer for a video generation pipeline.
Your job is to translate a simple Polish scene description into a highly structured JSON plan that describes the physical motion, camera movement, and lighting.

ABSOLUTE CONSTRAINTS:
1. DO NOT describe the character's visual identity or background (these are injected automatically via LoRA/IP-Adapter).
2. Focus ONLY on the cinematography: camera angles, camera movement (pan, tilt, dolly, zoom), lighting atmosphere, and the rigid-body physics of the action.
3. Your output MUST be 100% valid JSON matching the schema below. No markdown. No conversational text.

JSON SCHEMA:
{
  "scene_summary": "string (English translation of the core action)",
  "cinematography": {
    "camera_shot": "wide shot|medium shot|close-up|low angle|high angle",
    "camera_motion": "static|pan left|pan right|tilt up|tilt down|dolly in|dolly out|zoom in|zoom out|tracking",
    "lighting": "cinematic lighting|natural light|dramatic shadows|studio lighting|neon lights"
  },
  "kinematics": {
    "subject_state": "standing|falling|lying|rolling|sitting|jumping|running",
    "primary_motion": "string (physical trajectory only)",
    "velocity": "rapid|slow|static"
  }
}`;

function buildIntentPrompt(userPrompt, context) {
  const kinematicRules = context.rules
    .filter((r) => r.category === 'kinematic')
    .map((r) => `- ${r.title}: ${r.content}`)
    .join('\n');

  const char = context.characters?.[0];
  const charConstraint = char?.name
    ? `\nCHARACTER PHYSICS CONSTRAINT (${char.name}): Rigid body only. No human joint articulation unless explicitly stated in kinematic rules.`
    : '';

  return `KINEMATIC & CINEMA RULES:\n${kinematicRules || 'No kinematic rules.'}${charConstraint}\n\nUSER SCENE (Polish):\n${userPrompt}\n\nTRANSLATE TO CINEMATOGRAPHY JSON:`;
}

function inferKinematicsFromPolish(userPrompt) {
  const lower = userPrompt.toLowerCase();
  const motions = [];

  if (/stoi\b/.test(lower)) motions.push('maintains upright balance');
  if (/potyk/.test(lower)) motions.push('loses balance and tips forward');
  if (/le[żz]y|leż/.test(lower)) motions.push('comes to rest flat on the surface');
  if (/siada|siedzi/.test(lower)) motions.push('lowers base to sitting position');
  if (/toczy/.test(lower)) motions.push('rolls across the surface');
  if (/skacze/.test(lower)) motions.push('brief vertical hop');
  if (/biegnie|biega/.test(lower)) motions.push('moves quickly forward');

  let subjectState = 'standing';
  if (/le[żz]y|leż/.test(lower)) subjectState = 'lying';
  else if (/potyk|upada|spada/.test(lower)) subjectState = 'falling';
  else if (/toczy/.test(lower)) subjectState = 'rolling';
  else if (/siada|siedzi/.test(lower)) subjectState = 'sitting';
  else if (/skacze/.test(lower)) subjectState = 'jumping';
  else if (/biegnie|biega/.test(lower)) subjectState = 'running';

  const velocity = /szybko|szybki|biegnie|biega/.test(lower) ? 'rapid' : /wolno|powoli/.test(lower) ? 'slow' : 'static';

  return {
    subject_state: subjectState,
    primary_motion: motions.length > 0 ? motions.join(', then ') : 'performs the described physical action',
    velocity,
  };
}

function buildMockIntent(userPrompt, llmError = null) {
  const kinematics = inferKinematicsFromPolish(userPrompt);

  return {
    scene_summary: userPrompt,
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
  return `Action: The subject is ${subject_state}. Motion: ${primary_motion.trim()} at a ${velocity} pace.`;
}

function deriveMotionPhysics(kinematics) {
  const { subject_state, primary_motion, velocity } = kinematics;
  return `Rigid body dynamics. Subject state: ${subject_state}. Velocity: ${velocity}. Trajectory: ${primary_motion.trim()}. No human joint articulation.`;
}

function deriveStoryboard(kinematics) {
  const { subject_state, primary_motion } = kinematics;
  return {
    start: `Starting state: ${subject_state}.`,
    mid: primary_motion.trim(),
    end: 'Motion completes; subject holds final pose.',
  };
}

function normalizeIntentPlan(intentPlan, userPrompt) {
  if (intentPlan.kinematics) {
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

function executeAssetBinding(intentPlan, context) {
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

  const finalPositivePrompt = [
    cinemaBlock,
    PIPELINE_CONFIG.lensMasterBlock,
    PIPELINE_CONFIG.wan21Format,
    environmentBlock,
    identityBlock,
    kinematicBlock,
  ]
    .filter(Boolean)
    .join(' ');

  const rawNegatives = [char?.negative_prompt || '', PIPELINE_CONFIG.baseNegativePrompt]
    .join(', ')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const finalNegativePrompt = Array.from(new Set(rawNegatives)).join(', ');

  const finalPlan = {
    scene_summary: intentPlan.scene_summary,
    render_strategy: 'native_i2v',
    cinematography: cinema,
    kinematics,
    motion_physics: deriveMotionPhysics(kinematics),
    storyboard: deriveStoryboard(kinematics),
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

export async function expandScenePrompt(userPrompt, { characterId, backgroundId } = {}) {
  const context = getKnowledgeContext();

  if (characterId) context.characters = context.characters.filter((c) => c.id === characterId);
  if (backgroundId) context.backgrounds = context.backgrounds.filter((b) => b.id === backgroundId);

  const userMessage = buildIntentPrompt(userPrompt, context);
  let lastError = null;

  for (const provider of PROVIDERS) {
    try {
      const rawIntent = await tryWithRetry(provider.name, () => provider.call(userMessage));
      if (rawIntent) {
        const intentPlan = normalizeIntentPlan(rawIntent, userPrompt);
        intentPlan._source = intentPlan._source || provider.name;
        return executeAssetBinding(intentPlan, context);
      }
    } catch (err) {
      lastError = err.message;
      console.warn(`[AI Director] ${provider.name} failed:`, err.message);
    }
  }

  console.warn('[AI Director] All LLM providers failed, falling back to mock:', lastError);
  const mockIntent = buildMockIntent(userPrompt, lastError);
  return executeAssetBinding(mockIntent, context);
}

export async function previewDirectorPlan(userPrompt, options) {
  return expandScenePrompt(userPrompt, options);
}
