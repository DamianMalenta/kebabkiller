import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../../db/init.js';

/** Dziennik Napraw AI-Inżyniera (tabela system_agent_repairs). */

function rowToRepair(row) {
  if (!row) return null;
  return {
    ...row,
    files: row.files_json ? JSON.parse(row.files_json) : [],
  };
}

export function createRepair({ title, problem, diagnosis = null, files = [], diffText = null }) {
  const db = getDb();
  const id = uuidv4();
  db.prepare(`
    INSERT INTO system_agent_repairs (id, title, problem, diagnosis, status, files_json, diff_text)
    VALUES (?, ?, ?, ?, 'proposed', ?, ?)
  `).run(id, title || '', problem || '', diagnosis, JSON.stringify(files), diffText);
  return getRepair(id);
}

export function getRepair(id) {
  const row = getDb().prepare('SELECT * FROM system_agent_repairs WHERE id = ?').get(id);
  return rowToRepair(row);
}

export function listRepairs({ limit = 50 } = {}) {
  const rows = getDb()
    .prepare('SELECT * FROM system_agent_repairs ORDER BY created_at DESC, updated_at DESC LIMIT ?')
    .all(limit);
  return rows.map(rowToRepair);
}

const UPDATABLE = ['status', 'diagnosis', 'diff_text', 'base_sha', 'apply_commit_sha', 'test_summary', 'error', 'files_json'];

export function updateRepair(id, patch = {}) {
  const fields = [];
  const values = [];
  for (const key of UPDATABLE) {
    if (key in patch) {
      fields.push(`${key} = ?`);
      values.push(patch[key]);
    }
  }
  if (patch.files) {
    fields.push('files_json = ?');
    values.push(JSON.stringify(patch.files));
  }
  if (!fields.length) return getRepair(id);
  fields.push("updated_at = datetime('now')");
  values.push(id);
  getDb().prepare(`UPDATE system_agent_repairs SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  return getRepair(id);
}
