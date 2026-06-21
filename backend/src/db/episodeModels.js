import { v4 as uuidv4 } from 'uuid';
import { getDb } from './init.js';
import { secondsToFrames, WAN_FRAME_MIN, WAN_FRAME_MAX } from '../video/wanConfig.js';
import { parseJsonField, hydrateRow } from '../utils/json.js';

const PLAN_STATUSES = new Set([
  'szkic',
  'brakuje_materialow',
  'gotowy_do_akceptacji',
  'zaakceptowany',
  'w_produkcji',
  'gotowy',
]);

/**
 * Statusy, w których plan jest "zamrożony" — granica Scenarzysta→Reżyser.
 * Wartości pochodzą z istniejącej logiki: refreshEpisodePlanStatus pomija te
 * statusy, /produce dopuszcza je do renderu, a acceptEpisodePlan ustawia
 * 'zaakceptowany'. Po zamrożeniu fabuła/sceny nie mogą się już zmienić.
 */
export const FROZEN_PLAN_STATUSES = new Set([
  'zaakceptowany',
  'w_produkcji',
  'gotowy',
]);

export function isPlanFrozen(status) {
  return FROZEN_PLAN_STATUSES.has(status);
}

/** Rzuca błędem, gdy plan jest zamrożony (zaakceptowany / w produkcji / gotowy). */
export function assertPlanEditable(episodePlanId) {
  const row = getDb()
    .prepare('SELECT status FROM episode_plans WHERE id = ?')
    .get(episodePlanId);
  if (!row) {
    throw new Error('Plan odcinka nie istnieje.');
  }
  if (isPlanFrozen(row.status)) {
    throw new Error(
      `Plan jest zamrożony (status: ${row.status}) — edycja scen niedozwolona. Cofnij akceptację, aby zmieniać fabułę.`,
    );
  }
  return row.status;
}

/**
 * Namespace @ID wyprowadzany z istniejącego `type` (NIE z osobnej kolumny `kind`).
 * Jedno źródło prawdy typu assetu.
 */
const ASSET_NAMESPACE = {
  character: 'char',
  location: 'loc',
  prop: 'prop',
  detail: 'detail',
};

export function assetNamespace(type) {
  return ASSET_NAMESPACE[type] || 'asset';
}

function slugifyAssetName(value) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_');
}

/**
 * Stabilny, niemutowalny slug @ID przechowywany BEZ `@` (np. `char_kebabkiller`).
 * `@` dokleja kompilator promptu (Faza B, krok 2). Zmiana nazwy ≠ zmiana ref_id.
 */
export function buildAssetRefId(type, name) {
  return `${assetNamespace(type)}_${slugifyAssetName(name)}`;
}

function hydrateAsset(row) {
  if (!row) return null;
  const images = listAssetImages(row.id);
  return {
    ...row,
    composite_default: parseJsonField(row.composite_default_json, null),
    images,
  };
}

function hydrateEpisodePlan(row) {
  if (!row) return null;
  return {
    ...row,
    catalog_selection: parseJsonField(row.catalog_selection_json, {}),
    scenes: listPlanScenes(row.id),
    deliverables: listPlanDeliverables(row.id),
  };
}

// --- Assets ---

export function listAssets({ type } = {}) {
  const sql = type
    ? 'SELECT * FROM assets WHERE type = ? ORDER BY name'
    : 'SELECT * FROM assets ORDER BY type, name';
  const rows = type
    ? getDb().prepare(sql).all(type)
    : getDb().prepare(sql).all();
  return rows.map(hydrateAsset);
}

export function getAsset(id) {
  const row = getDb().prepare('SELECT * FROM assets WHERE id = ?').get(id);
  return hydrateAsset(row);
}

export function createAsset({ type, name, descriptionPl, canonEn, legacyCharacterId, legacyBackgroundId }) {
  const id = uuidv4();
  const refId = buildAssetRefId(type, name);
  try {
    getDb().prepare(`
      INSERT INTO assets (id, type, name, ref_id, description_pl, canon_en, legacy_character_id, legacy_background_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      type,
      name,
      refId,
      descriptionPl ?? '',
      canonEn ?? null,
      legacyCharacterId ?? null,
      legacyBackgroundId ?? null,
    );
  } catch (err) {
    if (String(err.message).includes('UNIQUE constraint failed')) {
      throw new Error(`Asset "${name}" (${type}) już istnieje.`);
    }
    throw err;
  }
  return getAsset(id);
}

export function updateAsset(id, fields) {
  getDb().prepare(`
    UPDATE assets
    SET type = COALESCE(?, type),
        name = COALESCE(?, name),
        description_pl = COALESCE(?, description_pl),
        canon_en = COALESCE(?, canon_en),
        composite_default_json = COALESCE(?, composite_default_json),
        updated_at = datetime('now')
    WHERE id = ?
  `).run(
    fields.type ?? null,
    fields.name ?? null,
    fields.descriptionPl ?? null,
    fields.canonEn !== undefined ? fields.canonEn : null,
    // null = pole bez zmian (COALESCE). Jawny null kasujący wymaga osobnego setera (clearAssetCompositeDefault).
    fields.compositeDefault !== undefined ? JSON.stringify(fields.compositeDefault) : null,
    id,
  );
  return getAsset(id);
}

/** Domyślny composite (pozycja+skala @char) per asset — kaskada Klatki Zero. null kasuje. */
export function setAssetCompositeDefault(id, composite) {
  getDb().prepare(`
    UPDATE assets SET composite_default_json = ?, updated_at = datetime('now') WHERE id = ?
  `).run(composite == null ? null : JSON.stringify(composite), id);
  return getAsset(id);
}

export function deleteAsset(id) {
  return getDb().prepare('DELETE FROM assets WHERE id = ?').run(id).changes > 0;
}

export function listAssetImages(assetId) {
  return getDb().prepare(`
    SELECT * FROM asset_images WHERE asset_id = ? ORDER BY is_primary DESC, sort_order, created_at
  `).all(assetId).map(hydrateRow);
}

export function addAssetImage(assetId, { path, label, sortOrder, isPrimary }) {
  const id = uuidv4();
  if (isPrimary) {
    getDb().prepare('UPDATE asset_images SET is_primary = 0 WHERE asset_id = ?').run(assetId);
  }
  getDb().prepare(`
    INSERT INTO asset_images (id, asset_id, path, label, sort_order, is_primary)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, assetId, path, label ?? null, sortOrder ?? 0, isPrimary ? 1 : 0);
  return getDb().prepare('SELECT * FROM asset_images WHERE id = ?').get(id);
}

export function deleteAssetImage(imageId) {
  return getDb().prepare('DELETE FROM asset_images WHERE id = ?').run(imageId).changes > 0;
}

// --- Episode plans ---

export function listEpisodePlans(projectId) {
  if (projectId) {
    return getDb().prepare('SELECT * FROM episode_plans WHERE project_id = ? ORDER BY created_at ASC').all(projectId)
      .map((row) => hydrateEpisodePlan(row));
  }
  return getDb().prepare('SELECT * FROM episode_plans ORDER BY created_at DESC').all()
    .map((row) => hydrateEpisodePlan(row));
}

export function getEpisodePlan(id) {
  const row = getDb().prepare('SELECT * FROM episode_plans WHERE id = ?').get(id);
  return hydrateEpisodePlan(row);
}

export function createEpisodePlan({ code, title, logline, preferences, targetDurationSec, catalogSelection }) {
  const id = uuidv4();
  try {
    getDb().prepare(`
      INSERT INTO episode_plans (id, code, title, logline, preferences, target_duration_sec, catalog_selection_json, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'szkic')
    `).run(
      id,
      code,
      title ?? '',
      logline ?? '',
      preferences ?? '',
      targetDurationSec ?? 45,
      catalogSelection ? JSON.stringify(catalogSelection) : null,
    );
  } catch (err) {
    if (String(err.message).includes('UNIQUE constraint failed')) {
      throw new Error(`Odcinek "${code}" już istnieje.`);
    }
    throw err;
  }
  return getEpisodePlan(id);
}

export function updateEpisodePlan(id, fields) {
  const sets = [];
  const values = [];

  const map = {
    code: fields.code,
    title: fields.title,
    logline: fields.logline,
    preferences: fields.preferences,
    target_duration_sec: fields.targetDurationSec,
    status: fields.status,
    catalog_selection_json: fields.catalogSelection !== undefined
      ? JSON.stringify(fields.catalogSelection)
      : undefined,
  };

  for (const [col, val] of Object.entries(map)) {
    if (val !== undefined) {
      sets.push(`${col} = ?`);
      values.push(val);
    }
  }

  if (sets.length === 0) return getEpisodePlan(id);
  sets.push("updated_at = datetime('now')");
  values.push(id);
  getDb().prepare(`UPDATE episode_plans SET ${sets.join(', ')} WHERE id = ?`).run(...values);
  return getEpisodePlan(id);
}

export function deleteEpisodePlan(id) {
  return getDb().prepare('DELETE FROM episode_plans WHERE id = ?').run(id).changes > 0;
}

// --- Plan scenes ---

export function listPlanScenes(episodePlanId) {
  return getDb().prepare(`
    SELECT * FROM plan_scenes WHERE episode_plan_id = ? ORDER BY sort_order, created_at
  `).all(episodePlanId);
}

/** Accept camelCase (internal) or snake_case (HTTP / DB rows from frontend). */
export function normalizePlanSceneInput(scene) {
  return {
    id: scene.id,
    sortOrder: scene.sortOrder ?? scene.sort_order ?? 0,
    descriptionPl: scene.descriptionPl ?? scene.description_pl ?? '',
    durationSec: scene.durationSec ?? scene.duration_sec ?? 4,
    assetId: scene.assetId ?? scene.asset_id ?? null,
    assetImageId: scene.assetImageId ?? scene.asset_image_id ?? null,
    locationAssetId: scene.locationAssetId ?? scene.location_asset_id ?? null,
    startFramePath: scene.startFramePath ?? scene.start_frame_path ?? null,
  };
}

export function upsertPlanScene(episodePlanId, scene, { refreshStatus = true, enforceEditable = true } = {}) {
  if (enforceEditable) assertPlanEditable(episodePlanId);
  const normalized = normalizePlanSceneInput(scene);
  const id = normalized.id || uuidv4();
  const existing = getDb().prepare('SELECT id FROM plan_scenes WHERE id = ?').get(id);

  if (existing) {
    getDb().prepare(`
      UPDATE plan_scenes
      SET sort_order = ?, description_pl = ?, duration_sec = ?,
          asset_id = ?, asset_image_id = ?, location_asset_id = ?,
          start_frame_path = ?,
          updated_at = datetime('now')
      WHERE id = ?
    `).run(
      normalized.sortOrder,
      normalized.descriptionPl,
      normalized.durationSec,
      normalized.assetId,
      normalized.assetImageId,
      normalized.locationAssetId,
      normalized.startFramePath,
      id,
    );
  } else {
    getDb().prepare(`
      INSERT INTO plan_scenes (id, episode_plan_id, sort_order, description_pl, duration_sec, asset_id, asset_image_id, location_asset_id, start_frame_path)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      episodePlanId,
      normalized.sortOrder,
      normalized.descriptionPl,
      normalized.durationSec,
      normalized.assetId,
      normalized.assetImageId,
      normalized.locationAssetId,
      normalized.startFramePath,
    );
  }

  const row = getDb().prepare('SELECT * FROM plan_scenes WHERE id = ?').get(id);
  if (refreshStatus) {
    refreshEpisodePlanStatus(episodePlanId);
  }
  return row;
}

/**
 * Override composite Klatki Zero na poziomie SCENY (najwyższy priorytet kaskady).
 * Render-tuning wizualny (nie fabuła) — zapis do ai_overrides_json bez blokady zamrożenia.
 * null kasuje override sceny (cofnięcie do domyślnej assetu / fallbacku).
 */
export function setSceneCompositeOverride(sceneId, composite) {
  const row = getDb().prepare('SELECT ai_overrides_json FROM plan_scenes WHERE id = ?').get(sceneId);
  if (!row) return null;
  const overrides = parseJsonField(row.ai_overrides_json, {}) || {};
  if (composite == null) {
    delete overrides.composite;
  } else {
    overrides.composite = composite;
  }
  getDb().prepare(`
    UPDATE plan_scenes SET ai_overrides_json = ?, updated_at = datetime('now') WHERE id = ?
  `).run(JSON.stringify(overrides), sceneId);
  return getDb().prepare('SELECT * FROM plan_scenes WHERE id = ?').get(sceneId);
}

/**
 * Filar 3 (silnik ciągłości): ustaw/wyczyść kadr kontynuacji jako start sceny.
 * `framePath == null` cofa do kompozytu (auto-ciągłość z klatki końcowej poprzedniej sceny).
 * Render-tuning (nie fabuła) — bez blokady zamrożenia planu.
 */
export function setSceneStartFrame(sceneId, framePath) {
  const row = getDb().prepare('SELECT id FROM plan_scenes WHERE id = ?').get(sceneId);
  if (!row) return null;
  getDb().prepare(`
    UPDATE plan_scenes SET start_frame_path = ?, updated_at = datetime('now') WHERE id = ?
  `).run(framePath || null, sceneId);
  return getDb().prepare('SELECT * FROM plan_scenes WHERE id = ?').get(sceneId);
}

export function deletePlanScene(sceneId) {
  const row = getDb().prepare('SELECT episode_plan_id FROM plan_scenes WHERE id = ?').get(sceneId);
  if (row?.episode_plan_id) assertPlanEditable(row.episode_plan_id);
  const changed = getDb().prepare('DELETE FROM plan_scenes WHERE id = ?').run(sceneId).changes > 0;
  if (changed && row?.episode_plan_id) {
    refreshEpisodePlanStatus(row.episode_plan_id);
  }
  return changed;
}

export function replacePlanScenes(episodePlanId, scenes) {
  assertPlanEditable(episodePlanId);
  const db = getDb();
  db.prepare('DELETE FROM plan_scenes WHERE episode_plan_id = ?').run(episodePlanId);
  const saved = scenes.map((scene, index) => upsertPlanScene(
    episodePlanId,
    { ...scene, sortOrder: index },
    { refreshStatus: false, enforceEditable: false },
  ));
  refreshEpisodePlanStatus(episodePlanId);
  return saved;
}

// --- Deliverables ---

export function listPlanDeliverables(episodePlanId) {
  return getDb().prepare(`
    SELECT * FROM plan_deliverables WHERE episode_plan_id = ? ORDER BY created_at
  `).all(episodePlanId);
}

export function createPlanDeliverable(episodePlanId, { description, planSceneId }) {
  const id = uuidv4();
  getDb().prepare(`
    INSERT INTO plan_deliverables (id, episode_plan_id, plan_scene_id, description, status)
    VALUES (?, ?, ?, ?, 'open')
  `).run(id, episodePlanId, planSceneId ?? null, description);
  refreshEpisodePlanStatus(episodePlanId);
  return getDb().prepare('SELECT * FROM plan_deliverables WHERE id = ?').get(id);
}

export function resolvePlanDeliverable(deliverableId, assetImageId) {
  const row = getDb().prepare('SELECT * FROM plan_deliverables WHERE id = ?').get(deliverableId);
  if (!row) return null;

  getDb().prepare(`
    UPDATE plan_deliverables
    SET status = 'resolved', resolved_asset_image_id = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(assetImageId, deliverableId);

  if (row.plan_scene_id && assetImageId) {
    const image = getDb().prepare('SELECT * FROM asset_images WHERE id = ?').get(assetImageId);
    if (image) {
      getDb().prepare(`
        UPDATE plan_scenes SET asset_id = ?, asset_image_id = ?, updated_at = datetime('now') WHERE id = ?
      `).run(image.asset_id, assetImageId, row.plan_scene_id);
    }
  }

  refreshEpisodePlanStatus(row.episode_plan_id);
  return getDb().prepare('SELECT * FROM plan_deliverables WHERE id = ?').get(deliverableId);
}

export function deletePlanDeliverable(deliverableId) {
  const row = getDb().prepare('SELECT episode_plan_id FROM plan_deliverables WHERE id = ?').get(deliverableId);
  const changed = getDb().prepare('DELETE FROM plan_deliverables WHERE id = ?').run(deliverableId).changes > 0;
  if (changed && row) refreshEpisodePlanStatus(row.episode_plan_id);
  return changed;
}

export function refreshEpisodePlanStatus(episodePlanId) {
  const plan = getEpisodePlan(episodePlanId);
  if (!plan || plan.status === 'zaakceptowany' || plan.status === 'w_produkcji' || plan.status === 'gotowy') {
    return plan;
  }

  const openDeliverables = plan.deliverables.filter((d) => d.status === 'open').length;
  const validation = validateEpisodePlan(episodePlanId);

  let status = 'szkic';
  if (openDeliverables > 0) {
    status = 'brakuje_materialow';
  } else if (validation.ok) {
    status = 'gotowy_do_akceptacji';
  } else if (plan.scenes.length > 0) {
    status = 'szkic';
  }

  if (status !== plan.status) {
    updateEpisodePlan(episodePlanId, { status });
  }
  return getEpisodePlan(episodePlanId);
}

// --- Validation & acceptance ---

export function validateEpisodePlan(episodePlanId) {
  const plan = getEpisodePlan(episodePlanId);
  if (!plan) return { ok: false, errors: ['Plan nie istnieje'], status: null };

  const errors = [];

  if (!plan.logline?.trim()) {
    errors.push('Brak logline / pomysłu odcinka.');
  }

  if (!plan.scenes.length) {
    errors.push('Plan musi mieć co najmniej jedną scenę.');
  }

  const openDeliverables = plan.deliverables.filter((d) => d.status === 'open');
  if (openDeliverables.length > 0) {
    errors.push(`Otwarte braki materiałów: ${openDeliverables.length}.`);
  }

  let totalDuration = 0;
  for (const scene of plan.scenes) {
    if (!scene.description_pl?.trim()) {
      errors.push(`Scena #${scene.sort_order + 1}: brak opisu.`);
    }
    if (!scene.asset_id && !scene.asset_image_id) {
      errors.push(`Scena #${scene.sort_order + 1}: brak przypisanego assetu / zdjęcia.`);
    }
    const dur = Number(scene.duration_sec);
    if (!Number.isFinite(dur) || dur < 2 || dur > 10) {
      errors.push(`Scena #${scene.sort_order + 1}: czas musi być 2–10 s (jest ${scene.duration_sec}).`);
    }
    const frames = secondsToFrames(dur);
    if (frames < WAN_FRAME_MIN || frames > WAN_FRAME_MAX) {
      errors.push(`Scena #${scene.sort_order + 1}: ${frames} klatek poza limitem silnika.`);
    }
    totalDuration += dur;
  }

  const target = plan.target_duration_sec || 45;
  const warnings = [];
  if (totalDuration < target * 0.5 || totalDuration > target * 1.5) {
    warnings.push(`Suma scen (${totalDuration.toFixed(1)} s) daleko od celu (${target} s) — możesz produkować, ale to info.`);
  }

  const status = openDeliverables.length > 0
    ? 'brakuje_materialow'
    : (errors.length === 0 ? 'gotowy_do_akceptacji' : 'szkic');

  return { ok: errors.length === 0, errors, warnings, status, totalDurationSec: totalDuration };
}

export function acceptEpisodePlan(episodePlanId) {
  const validation = validateEpisodePlan(episodePlanId);
  if (!validation.ok) {
    throw new Error(validation.errors.join(' '));
  }
  return updateEpisodePlan(episodePlanId, { status: 'zaakceptowany' });
}

/** Sync legacy characters/backgrounds into assets catalog (idempotent). */
export function syncLegacyAssetsFromKnowledge() {
  const db = getDb();
  const chars = db.prepare('SELECT * FROM characters').all();
  const bgs = db.prepare('SELECT * FROM backgrounds').all();

  for (const c of chars) {
    const existing = db.prepare('SELECT id FROM assets WHERE legacy_character_id = ?').get(c.id);
    if (existing) continue;
    const asset = createAsset({
      type: 'character',
      name: c.name,
      descriptionPl: c.description,
      canonEn: c.identity_block_en,
      legacyCharacterId: c.id,
    });
    if (c.reference_path) {
      addAssetImage(asset.id, { path: c.reference_path, label: 'reference', isPrimary: true });
    }
  }

  for (const b of bgs) {
    const existing = db.prepare('SELECT id FROM assets WHERE legacy_background_id = ?').get(b.id);
    if (existing) continue;
    const asset = createAsset({
      type: 'location',
      name: b.name,
      descriptionPl: b.description,
      canonEn: b.environment_block_en,
      legacyBackgroundId: b.id,
    });
    if (b.reference_path) {
      addAssetImage(asset.id, { path: b.reference_path, label: 'reference', isPrimary: true });
    }
  }
}

export function getCatalogForScreenwriter() {
  return listAssets().map((a) => ({
    id: a.id,
    type: a.type,
    ref_id: a.ref_id,
    name: a.name,
    description_pl: a.description_pl,
    canon_en: a.canon_en,
    images: (a.images || []).map((img) => ({
      id: img.id,
      path: img.path,
      label: img.label,
      is_primary: img.is_primary,
    })),
  }));
}
