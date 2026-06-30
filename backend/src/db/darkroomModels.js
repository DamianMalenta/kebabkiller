import { v4 as uuidv4 } from 'uuid';
import { getDb } from './init.js';
import { getEpisodePlan } from './episodeModels.js';

export const SCENE_ASSET_STATUSES = new Set([
  'PENDING_AI_AUDIT',
  'PENDING_USER_APPROVAL',
  'APPROVED',
  'REJECTED',
]);

function assertValidStatus(status) {
  if (!SCENE_ASSET_STATUSES.has(status)) {
    throw new Error(`Nieprawidłowy status scene_asset: ${status}`);
  }
}

export function nextSortOrder(episodePlanId) {
  const row = getDb().prepare(`
    SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order
    FROM scene_assets
    WHERE episode_plan_id = ?
  `).get(episodePlanId);
  return row?.next_order ?? 0;
}

export function listSceneAssetsByEpisodePlan(episodePlanId) {
  return getDb().prepare(`
    SELECT * FROM scene_assets
    WHERE episode_plan_id = ?
    ORDER BY sort_order ASC, created_at ASC
  `).all(episodePlanId);
}

export function listSceneAssetsPendingAiAudit(episodePlanId) {
  return getDb().prepare(`
    SELECT * FROM scene_assets
    WHERE episode_plan_id = ? AND status = 'PENDING_AI_AUDIT'
    ORDER BY sort_order ASC, created_at ASC
  `).all(episodePlanId);
}

export function listApprovedSceneAssetsByEpisodePlan(episodePlanId) {
  return getDb().prepare(`
    SELECT * FROM scene_assets
    WHERE episode_plan_id = ? AND status = 'APPROVED'
    ORDER BY sort_order ASC, created_at ASC
  `).all(episodePlanId);
}

export function getApprovedSceneAssetForSortOrder(episodePlanId, sortOrder) {
  return getDb().prepare(`
    SELECT * FROM scene_assets
    WHERE episode_plan_id = ? AND status = 'APPROVED' AND sort_order = ?
    ORDER BY created_at ASC
    LIMIT 1
  `).get(episodePlanId, sortOrder) ?? null;
}

export function episodeHasApprovedDarkroomAssets(episodePlanId) {
  const row = getDb().prepare(`
    SELECT COUNT(*) AS n FROM scene_assets
    WHERE episode_plan_id = ? AND status = 'APPROVED'
  `).get(episodePlanId);
  return Number(row?.n ?? 0) > 0;
}

/** Scena bez własnego kadru Ciemni — dziedziczy last_frame z poprzedniego klipu (sort_order > 0). */
export function sceneInheritsDarkroomContinuity(episodePlanId, sceneSortOrder) {
  return sceneSortOrder > 0
    && episodeHasApprovedDarkroomAssets(episodePlanId)
    && !getApprovedSceneAssetForSortOrder(episodePlanId, sceneSortOrder);
}

/**
 * @param {string} episodePlanId
 * @param {{ id: string, aiProposedPrompt: string }[]} audits — jeden prompt na asset
 */
export function runAiAuditBatchForEpisodePlan(episodePlanId, audits) {
  const pending = listSceneAssetsPendingAiAudit(episodePlanId);
  if (pending.length === 0) {
    return { updated: [], count: 0 };
  }

  if (!Array.isArray(audits) || audits.length !== pending.length) {
    throw new Error('Audyt wymaga promptu dla każdego assetu oczekującego na AI.');
  }

  const auditMap = new Map(audits.map((entry) => [entry.id, entry.aiProposedPrompt]));
  for (const row of pending) {
    const prompt = auditMap.get(row.id);
    if (!prompt?.trim()) {
      throw new Error(`Brak ai_proposed_prompt dla assetu ${row.id}.`);
    }
  }

  const db = getDb();
  const update = db.prepare(`
    UPDATE scene_assets
    SET status = 'PENDING_USER_APPROVAL',
        ai_proposed_prompt = ?,
        updated_at = datetime('now')
    WHERE id = ?
  `);

  db.exec('BEGIN IMMEDIATE');
  try {
    for (const row of pending) {
      update.run(auditMap.get(row.id), row.id);
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }

  const updated = pending.map((row) => getSceneAsset(row.id));
  return { updated, count: updated.length };
}

export const REVIEW_STATUSES = new Set(['APPROVED', 'REJECTED']);

export function reviewSceneAsset(assetId, { status, userOverridePrompt }) {
  const existing = getSceneAsset(assetId);
  if (!existing) return null;

  if (!REVIEW_STATUSES.has(status)) {
    throw new Error(`Nieprawidłowy status recenzji: ${status}`);
  }
  if (existing.status !== 'PENDING_USER_APPROVAL') {
    throw new Error('Asset nie oczekuje na akceptację użytkownika.');
  }

  const fields = { status };
  if (userOverridePrompt !== undefined) {
    fields.userOverridePrompt = userOverridePrompt;
  }

  return updateSceneAsset(assetId, fields);
}

export function getSceneAsset(id) {
  return getDb().prepare('SELECT * FROM scene_assets WHERE id = ?').get(id) ?? null;
}

export function createSceneAsset({
  episodePlanId,
  rawImagePath,
  stagedImagePath = null,
  status = 'PENDING_AI_AUDIT',
  aiProposedPrompt = null,
  userOverridePrompt = null,
  sortOrder = null,
}) {
  if (!episodePlanId) throw new Error('episodePlanId jest wymagane.');
  if (!rawImagePath) throw new Error('rawImagePath jest wymagane.');
  if (!getEpisodePlan(episodePlanId)) {
    throw new Error('Plan odcinka nie istnieje.');
  }
  assertValidStatus(status);

  const id = uuidv4();
  const order = sortOrder ?? nextSortOrder(episodePlanId);

  getDb().prepare(`
    INSERT INTO scene_assets (
      id, episode_plan_id, raw_image_path, staged_image_path, status,
      ai_proposed_prompt, user_override_prompt, sort_order
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    episodePlanId,
    rawImagePath,
    stagedImagePath,
    status,
    aiProposedPrompt,
    userOverridePrompt,
    order,
  );

  return getSceneAsset(id);
}

export function createSceneAssetsBatch(items) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('Wymagana niepusta tablica scene_assets.');
  }

  const episodePlanId = items[0].episodePlanId;
  if (!episodePlanId || !getEpisodePlan(episodePlanId)) {
    throw new Error('Plan odcinka nie istnieje.');
  }
  if (!items.every((item) => item.episodePlanId === episodePlanId)) {
    throw new Error('Wszystkie scene_assets w batchu muszą należeć do tego samego planu odcinka.');
  }

  let sortOrder = nextSortOrder(episodePlanId);
  const created = [];
  const db = getDb();

  const insert = db.prepare(`
    INSERT INTO scene_assets (
      id, episode_plan_id, raw_image_path, staged_image_path, status,
      ai_proposed_prompt, user_override_prompt, sort_order
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  db.exec('BEGIN IMMEDIATE');
  try {
    for (const row of items) {
      if (!row.rawImagePath) {
        throw new Error('rawImagePath jest wymagane dla każdego rekordu.');
      }
      const status = row.status ?? 'PENDING_AI_AUDIT';
      assertValidStatus(status);

      const id = uuidv4();
      insert.run(
        id,
        episodePlanId,
        row.rawImagePath,
        row.stagedImagePath ?? null,
        status,
        row.aiProposedPrompt ?? null,
        row.userOverridePrompt ?? null,
        row.sortOrder ?? sortOrder++,
      );
      created.push(getSceneAsset(id));
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }

  return created;
}

export function updateSceneAsset(id, fields = {}) {
  const existing = getSceneAsset(id);
  if (!existing) return null;

  const map = {
    raw_image_path: 'rawImagePath',
    staged_image_path: 'stagedImagePath',
    status: 'status',
    ai_proposed_prompt: 'aiProposedPrompt',
    user_override_prompt: 'userOverridePrompt',
    sort_order: 'sortOrder',
  };

  const sets = [];
  const values = [];

  for (const [col, key] of Object.entries(map)) {
    if (fields[key] !== undefined) {
      if (key === 'status') assertValidStatus(fields[key]);
      sets.push(`${col} = ?`);
      values.push(fields[key]);
    }
  }

  if (sets.length === 0) return existing;

  sets.push("updated_at = datetime('now')");
  values.push(id);

  getDb().prepare(`
    UPDATE scene_assets SET ${sets.join(', ')} WHERE id = ?
  `).run(...values);

  return getSceneAsset(id);
}

export function deleteSceneAsset(id) {
  const existing = getSceneAsset(id);
  if (!existing) return false;
  getDb().prepare('DELETE FROM scene_assets WHERE id = ?').run(id);
  return true;
}
