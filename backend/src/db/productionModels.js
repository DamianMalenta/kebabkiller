import { v4 as uuidv4 } from 'uuid';
import { getDb } from './init.js';
import { parseJsonField, hydrateRow } from '../utils/json.js';

function hydrateProductionRun(row) {
  if (!row) return null;
  return {
    ...row,
    visual_profile: parseJsonField(row.visual_profile_json),
    clips: listProductionClips(row.id),
  };
}

export function listProductionRuns(episodePlanId) {
  const rows = getDb().prepare(`
    SELECT * FROM production_runs WHERE episode_plan_id = ? ORDER BY created_at DESC
  `).all(episodePlanId);
  return rows.map(hydrateProductionRun);
}

export function getProductionRun(id) {
  const row = getDb().prepare('SELECT * FROM production_runs WHERE id = ?').get(id);
  return hydrateProductionRun(row);
}

export function getLatestProductionRun(episodePlanId) {
  const row = getDb().prepare(`
    SELECT * FROM production_runs WHERE episode_plan_id = ? ORDER BY created_at DESC LIMIT 1
  `).get(episodePlanId);
  return hydrateProductionRun(row);
}

export function createProductionRun({ episodePlanId, exportDir, visualProfile, clipsTotal }) {
  const id = uuidv4();
  getDb().prepare(`
    INSERT INTO production_runs (
      id, episode_plan_id, status, export_dir, visual_profile_json, clips_total, progress
    ) VALUES (?, ?, 'pending', ?, ?, ?, 0)
  `).run(
    id,
    episodePlanId,
    exportDir,
    visualProfile ? JSON.stringify(visualProfile) : null,
    clipsTotal ?? 0,
  );
  return getProductionRun(id);
}

export function updateProductionRun(id, fields) {
  const allowed = {
    status: fields.status,
    export_dir: fields.exportDir,
    manifest_path: fields.manifestPath,
    visual_profile_json: fields.visualProfile !== undefined
      ? JSON.stringify(fields.visualProfile)
      : undefined,
    error_message: fields.errorMessage,
    progress: fields.progress,
    clips_total: fields.clipsTotal,
    clips_completed: fields.clipsCompleted,
    completed_at: fields.completedAt,
  };

  const sets = [];
  const values = [];
  for (const [col, val] of Object.entries(allowed)) {
    if (val !== undefined) {
      sets.push(`${col} = ?`);
      values.push(val);
    }
  }
  if (sets.length === 0) return getProductionRun(id);

  sets.push("updated_at = datetime('now')");
  values.push(id);
  getDb().prepare(`UPDATE production_runs SET ${sets.join(', ')} WHERE id = ?`).run(...values);
  return getProductionRun(id);
}

export function listProductionClips(productionRunId) {
  return getDb().prepare(`
    SELECT * FROM production_clips WHERE production_run_id = ? ORDER BY sort_order, created_at
  `).all(productionRunId).map(hydrateRow).map((clip) => ({
    ...clip,
    director_json: parseJsonField(clip.director_json),
    frames: parseJsonField(clip.frames_json, []) || [],
  }));
}

export function createProductionClip({
  productionRunId,
  planSceneId,
  sortOrder,
  clipCode,
  userPrompt,
}) {
  const id = uuidv4();
  getDb().prepare(`
    INSERT INTO production_clips (
      id, production_run_id, plan_scene_id, sort_order, clip_code, user_prompt, status
    ) VALUES (?, ?, ?, ?, ?, ?, 'pending')
  `).run(id, productionRunId, planSceneId, sortOrder, clipCode, userPrompt);
  return getDb().prepare('SELECT * FROM production_clips WHERE id = ?').get(id);
}

export function updateProductionClip(id, fields) {
  const allowed = {
    status: fields.status,
    director_json: fields.directorJson !== undefined
      ? JSON.stringify(fields.directorJson)
      : undefined,
    output_path: fields.outputPath,
    frames_json: fields.frames !== undefined ? JSON.stringify(fields.frames) : undefined,
    error_message: fields.errorMessage,
    progress: fields.progress,
    completed_at: fields.completedAt,
  };

  const sets = [];
  const values = [];
  for (const [col, val] of Object.entries(allowed)) {
    if (val !== undefined) {
      sets.push(`${col} = ?`);
      values.push(val);
    }
  }
  if (sets.length === 0) {
    return getDb().prepare('SELECT * FROM production_clips WHERE id = ?').get(id);
  }

  sets.push("updated_at = datetime('now')");
  values.push(id);
  getDb().prepare(`UPDATE production_clips SET ${sets.join(', ')} WHERE id = ?`).run(...values);
  const row = getDb().prepare('SELECT * FROM production_clips WHERE id = ?').get(id);
  return {
    ...row,
    director_json: parseJsonField(row.director_json),
    frames: parseJsonField(row.frames_json, []) || [],
  };
}

export function formatClipCode(episodeCode, sortOrder) {
  const num = String(sortOrder + 1).padStart(2, '0');
  return `${episodeCode}_SC${num}`;
}
