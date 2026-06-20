import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  getEpisodePlan,
  getCatalogForScreenwriter,
  replacePlanScenes,
  createPlanDeliverable,
  deletePlanDeliverable,
  updateEpisodePlan,
  refreshEpisodePlanStatus,
} from '../db/episodeModels.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CAPABILITIES_PATH = path.resolve(__dirname, '../../../docs/CAPABILITIES.md');

let capabilitiesCache = null;

function loadCapabilities() {
  if (!capabilitiesCache) {
    try {
      capabilitiesCache = fs.readFileSync(CAPABILITIES_PATH, 'utf8');
    } catch {
      capabilitiesCache = '1 beat = 1 scena = 1 klip. Kamera statyczna. Max ~10 s per scena.';
    }
  }
  return capabilitiesCache;
}

const SYSTEM_PROMPT = `[SYSTEM: SCENARZYSTA — Kebabkiller Studio]
Jesteś Scenarzystą pomagającym twórcy planować odcinek serialu viralowego 9:16.
NIE ustawiasz parametrów GPU ani ComfyUI. Pomagasz pisać plan odcinka.

ZASADY (Księga możliwości silnika):
{CAPABILITIES}

ZASADY PLANU:
- 1 beat = 1 scena = 1 plik wideo (2–10 s każda).
- Kamera statyczna w całym odcinku (v1).
- Nie łącz wielu akcji w jednej scenie.
- Scena bez materiału w katalogu → wpisz do deliverables (braki).
- Odpowiadaj po polsku w polu assistant_message; dane strukturalne w JSON.

FORMAT ODPOWIEDZI (tylko JSON, bez markdown):
{
  "assistant_message": "krótka wiadomość do twórcy po polsku",
  "logline": "opcjonalna aktualizacja logline",
  "preferences": "opcjonalna aktualizacja preferencji odcinka",
  "scenes": [
    {
      "description_pl": "opis sceny po polsku",
      "duration_sec": 4,
      "asset_id": "uuid lub null",
      "asset_image_id": "uuid lub null",
      "location_asset_id": "uuid lub null"
    }
  ],
  "deliverables": [
    { "description": "czego brakuje w katalogu", "scene_index": 0 }
  ]
}

Pola scenes i deliverables są opcjonalne — podawaj tylko gdy proponujesz zmianę planu.`;

function buildScreenwriterPrompt(plan, catalog, userMessage) {
  const planSnapshot = {
    code: plan.code,
    title: plan.title,
    logline: plan.logline,
    preferences: plan.preferences,
    target_duration_sec: plan.target_duration_sec,
    status: plan.status,
    scenes: plan.scenes.map((s) => ({
      description_pl: s.description_pl,
      duration_sec: s.duration_sec,
      asset_id: s.asset_id,
      asset_image_id: s.asset_image_id,
      location_asset_id: s.location_asset_id,
    })),
    deliverables: plan.deliverables.map((d) => ({
      description: d.description,
      status: d.status,
      plan_scene_id: d.plan_scene_id,
    })),
  };

  return `KATALOG (dostępne assety):
${JSON.stringify(catalog, null, 2)}

AKTUALNY PLAN ODCINKA:
${JSON.stringify(planSnapshot, null, 2)}

WIADOMOŚĆ TWÓRCY:
${userMessage}`;
}

function parseJsonFromText(text) {
  const trimmed = text.trim().replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
  return JSON.parse(trimmed);
}

async function callGroq(userMessage) {
  const apiKey = process.env.GROQ_API_KEY?.trim();
  if (!apiKey) return null;

  const system = SYSTEM_PROMPT.replace('{CAPABILITIES}', loadCapabilities());
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: userMessage },
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' },
    }),
  });

  if (!res.ok) throw new Error(`Groq API error: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return parseJsonFromText(data.choices?.[0]?.message?.content);
}

function buildMockResponse(plan, userMessage) {
  const sceneCount = Math.max(3, Math.min(8, Math.round((plan.target_duration_sec || 45) / 5)));
  const scenes = Array.from({ length: sceneCount }, (_, i) => ({
    description_pl: `Scena ${i + 1}: Kebabkiller w lokacji — ${userMessage.slice(0, 80)}`,
    duration_sec: 4,
    asset_id: null,
    asset_image_id: null,
    location_asset_id: null,
  }));

  return {
    assistant_message: `Mock Scenarzysta: zaproponowałem ${sceneCount} scen po ~4 s. Przypisz assety z katalogu i uzupełnij braki.`,
    logline: plan.logline || userMessage.slice(0, 120),
    scenes,
    deliverables: [{ description: 'Zdjęcie lokacji z pieca (jeśli brak w katalogu)', scene_index: 0 }],
    _source: 'mock',
  };
}

export function applyScreenwriterProposal(episodePlanId, proposal) {
  const updates = {};
  if (proposal.logline) updates.logline = proposal.logline;
  if (proposal.preferences) updates.preferences = proposal.preferences;
  if (Object.keys(updates).length > 0) {
    updateEpisodePlan(episodePlanId, updates);
  }

  if (Array.isArray(proposal.scenes) && proposal.scenes.length > 0) {
    replacePlanScenes(episodePlanId, proposal.scenes.map((s, index) => ({
      sortOrder: index,
      descriptionPl: s.description_pl,
      durationSec: s.duration_sec ?? 4,
      assetId: s.asset_id ?? null,
      assetImageId: s.asset_image_id ?? null,
      locationAssetId: s.location_asset_id ?? null,
    })));
  }

  if (Array.isArray(proposal.deliverables)) {
    const plan = getEpisodePlan(episodePlanId);
    for (const d of plan.deliverables.filter((x) => x.status === 'open')) {
      deletePlanDeliverable(d.id);
    }
    const scenes = getEpisodePlan(episodePlanId).scenes;
    for (const d of proposal.deliverables) {
      const sceneId = typeof d.scene_index === 'number' ? scenes[d.scene_index]?.id : null;
      createPlanDeliverable(episodePlanId, {
        description: d.description,
        planSceneId: sceneId,
      });
    }
  }

  return refreshEpisodePlanStatus(episodePlanId);
}

export async function assistEpisodePlan(episodePlanId, userMessage, { apply = false } = {}) {
  const plan = getEpisodePlan(episodePlanId);
  if (!plan) throw new Error('Plan odcinka nie istnieje.');

  const catalog = getCatalogForScreenwriter();
  const prompt = buildScreenwriterPrompt(plan, catalog, userMessage);

  let proposal;
  let source = 'groq';
  try {
    proposal = await callGroq(prompt);
  } catch (err) {
    console.warn('[Screenwriter] Groq failed:', err.message);
    proposal = null;
  }

  if (!proposal) {
    proposal = buildMockResponse(plan, userMessage);
    source = 'mock';
  }

  proposal._source = proposal._source || source;

  let updatedPlan = plan;
  if (apply) {
    updatedPlan = applyScreenwriterProposal(episodePlanId, proposal);
  }

  return {
    assistant_message: proposal.assistant_message,
    proposal: {
      logline: proposal.logline,
      preferences: proposal.preferences,
      scenes: proposal.scenes,
      deliverables: proposal.deliverables,
    },
    applied: apply,
    plan: updatedPlan,
    source: proposal._source,
  };
}
