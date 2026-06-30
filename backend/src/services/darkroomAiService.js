import { getEpisodePlan } from '../db/episodeModels.js';
import {
  listSceneAssetsPendingAiAudit,
  runAiAuditBatchForEpisodePlan,
} from '../db/darkroomModels.js';
import { callGroq } from '../utils/llm.js';

function buildSystemPrompt(directorHint) {
  const base =
    'Jesteś profesjonalnym reżyserem wideo. Twoim zadaniem jest stworzenie JEDNOZDANIOWEGO, '
    + 'technicznego promptu w języku angielskim dla silnika Wan 2.1. ';

  const trimmed = directorHint?.trim();
  if (trimmed) {
    return (
      `${base}Użytkownik podał następującą wizję: '${trimmed}'. `
      + 'Przetłumacz to na profesjonalny, kinowy angielski i dodaj techniczne słowa kluczowe '
      + '(np. 8k, cinematic lighting). Zwróć TYLKO czysty tekst promptu, bez żadnych dodatków.'
    );
  }

  return (
    `${base}Wymyśl sam kreatywny, dynamiczny ruch kamery, oświetlenie i efekty cząsteczkowe. `
    + 'Nie opisuj produktu. Zwróć TYLKO czysty tekst promptu, bez żadnych dodatków.'
  );
}

function sanitizeMotionPrompt(text) {
  return String(text || '')
    .trim()
    .replace(/^["'`]+|["'`]+$/g, '')
    .split('\n')
    .map((line) => line.trim())
    .find(Boolean) || '';
}

function buildUserMessage(index, total) {
  if (total > 1) {
    return (
      `Clip ${index + 1} of ${total} in a short vertical product commercial (9:16). `
      + 'Output one Wan 2.1 motion prompt sentence.'
    );
  }
  return 'Single short vertical product commercial clip (9:16). Output one Wan 2.1 motion prompt sentence.';
}

function resolveHintMap(pending, auditOptions = {}) {
  const map = new Map();

  const globalHint = auditOptions.director_hint ?? auditOptions.directorHint;
  if (globalHint?.trim()) {
    for (const row of pending) {
      map.set(row.id, globalHint.trim());
    }
  }

  const assets = auditOptions.assets;
  if (Array.isArray(assets)) {
    for (const entry of assets) {
      if (!entry?.id) continue;
      const hint = entry.director_hint ?? entry.directorHint;
      if (hint?.trim()) {
        map.set(entry.id, hint.trim());
      }
    }
  }

  return map;
}

async function generateMotionPromptForAsset({ index, total, directorHint }) {
  const raw = await callGroq(buildSystemPrompt(directorHint), buildUserMessage(index, total), {
    jsonMode: false,
    temperature: directorHint ? 0.55 : 0.75,
    maxTokens: 160,
  });

  if (raw == null || raw === '') {
    throw new Error('GROQ_API_KEY jest wymagany do audytu Ciemni (brak klucza lub pusta odpowiedź).');
  }

  const prompt = sanitizeMotionPrompt(raw);
  if (!prompt) {
    throw new Error('Groq zwrócił pusty prompt ruchu dla Ciemni.');
  }

  return prompt;
}

/**
 * Audyt Ciemni: dla każdego assetu PENDING_AI_AUDIT generuje prompt ruchu (Groq)
 * i zapisuje jako ai_proposed_prompt → PENDING_USER_APPROVAL.
 *
 * @param {string} episodePlanId
 * @param {{ director_hint?: string, assets?: { id: string, director_hint?: string }[] }} [auditOptions]
 */
export async function runAuditForEpisodePlan(episodePlanId, auditOptions = {}) {
  if (!episodePlanId) {
    throw new Error('episodePlanId jest wymagane.');
  }
  if (!getEpisodePlan(episodePlanId)) {
    throw new Error('Plan odcinka nie istnieje.');
  }

  const pending = listSceneAssetsPendingAiAudit(episodePlanId);
  if (pending.length === 0) {
    return { updated: [], count: 0 };
  }

  const hintMap = resolveHintMap(pending, auditOptions);

  const audits = [];
  for (let index = 0; index < pending.length; index += 1) {
    const row = pending[index];
    const aiProposedPrompt = await generateMotionPromptForAsset({
      index,
      total: pending.length,
      directorHint: hintMap.get(row.id),
    });
    audits.push({ id: row.id, aiProposedPrompt });
  }

  return runAiAuditBatchForEpisodePlan(episodePlanId, audits);
}
