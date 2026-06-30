/** Lightweight intent router — cheap classification before heavy agent. */

import { callGroq as callGroqShared } from '../../utils/llm.js';

export const INTENTS = {
  PROJECT_COMMAND: 'PROJECT_COMMAND',
  CREATIVE_BRAINSTORM: 'CREATIVE_BRAINSTORM',
  WIZARD_STEP: 'WIZARD_STEP',
};

const BRAINSTORM_PATTERNS = [
  /\bnie rozumiem\b/i,
  /\bwyjaśnij\b/i,
  /\bco to jest\b/i,
  /\bco znaczy\b/i,
  /\bdlaczego\b/i,
  /\bhelp\b/i,
  /\bpomoc\b/i,
];

const COMMAND_PATTERNS = [
  /\bzatwierdz(am|ać)?\b/i,
  /\busuń\b/i,
  /\bskasuj\b/i,
  /\bzmień\b/i,
  /\bdodaj scen/i,
  /\bprzenieś\b/i,
  /\brob(imy|ić)? z tego film\b/i,
  /\bprodukuj\b/i,
  /\bcofnij\b/i,
  /\bundo\b/i,
  /\bakceptuję\b/i,
  /\bstwórz odcinek\b/i,
  /\bnowy odcinek\b/i,
  /\bzrób scen/i,
  /\bodcinek w stylu\b/i,
  /\bwypiek\b/i,
  /\bw piecu\b/i,
];

const FABULAR_PATTERNS = [
  /\bscena\b/i,
  /\bkebab/i,
  /\bpiec\b/i,
  /\błopat/i,
  /\bnóżk/i,
  /\bujęci/i,
  /\bkamera\b/i,
  /\bthriller\b/i,
];

const WIZARD_PATTERNS = [
  /\bklimat\b/i,
  /\bstyl\b/i,
  /\blogline\b/i,
  /\bstoryboard\b/i,
  /\bscena\s+\d+/i,
  /\bnowy odcinek\b/i,
  /\bnowy serial\b/i,
  /\bkanon\b/i,
];

export function classifyIntentHeuristic(message, { wizardMode, inWizard } = {}) {
  const text = String(message || '').trim();
  if (!text) return INTENTS.WIZARD_STEP;

  if (BRAINSTORM_PATTERNS.some((re) => re.test(text)) && text.includes('?')) {
    return INTENTS.CREATIVE_BRAINSTORM;
  }

  if (inWizard && WIZARD_PATTERNS.some((re) => re.test(text))) {
    return INTENTS.WIZARD_STEP;
  }

  if (COMMAND_PATTERNS.some((re) => re.test(text))) {
    return INTENTS.PROJECT_COMMAND;
  }

  if (text.length >= 80 && FABULAR_PATTERNS.some((re) => re.test(text))) {
    return INTENTS.PROJECT_COMMAND;
  }

  if (wizardMode === 'series' || wizardMode === 'episode') {
    return INTENTS.WIZARD_STEP;
  }

  if (text.length < 80 && text.includes('?')) {
    return INTENTS.CREATIVE_BRAINSTORM;
  }

  return INTENTS.PROJECT_COMMAND;
}

const ROUTER_SYSTEM = `Classify user message into exactly one intent:
- PROJECT_COMMAND: concrete project change (approve, delete scene, produce video)
- CREATIVE_BRAINSTORM: questions, confusion, casual chat — no DB writes
- WIZARD_STEP: onboarding answers during series/episode wizard
Return JSON: {"intent":"PROJECT_COMMAND|CREATIVE_BRAINSTORM|WIZARD_STEP","confidence":0.0-1.0}`;

async function callGroqRouter(userMessage) {
  try {
    const parsed = await callGroqShared(ROUTER_SYSTEM, userMessage, {
      model: process.env.GROQ_ROUTER_MODEL || process.env.GROQ_MODEL || 'llama-3.1-8b-instant',
      temperature: 0,
    });
    if (parsed && INTENTS[parsed.intent]) {
      return { intent: parsed.intent, confidence: parsed.confidence ?? 0.5, source: 'groq' };
    }
  } catch {
    return null;
  }
  return null;
}

export async function routeIntent(message, context = {}) {
  const heuristic = classifyIntentHeuristic(message, context);

  try {
    const llm = await callGroqRouter(message);
    if (llm && llm.confidence >= 0.6) {
      return llm;
    }
  } catch (err) {
    console.warn('[IntentRouter] LLM failed:', err.message);
    return { intent: heuristic, confidence: 0.5, source: 'heuristic', llm_error: err.message };
  }

  return { intent: heuristic, confidence: 0.5, source: 'heuristic' };
}
