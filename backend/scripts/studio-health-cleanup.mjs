/**
 * Jednorazowy cleanup danych dev: smoke testy, zombie produkcji, smoke w kanonie.
 * Uruchom: node --experimental-sqlite scripts/studio-health-cleanup.mjs
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { initDatabase, getDb } from '../src/db/init.js';
import { getDirectorProject, updateDirectorProject } from '../src/db/directorDeskModels.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SMOKE_ASSET_IDS = new Set([
  '9232c1f7-63ef-4661-a21a-98471efcb563',
  '85df3a34-3f41-48b9-9e20-45d73ade8141',
]);

initDatabase(path.resolve(__dirname, '../data/studio.db'));
const db = getDb();

function log(msg) {
  console.log(`[studio-health] ${msg}`);
}

// Smoke episode plans
const smokePlans = db.prepare(`
  SELECT id, code FROM episode_plans WHERE code LIKE 'SMOKE_%'
`).all();
for (const p of smokePlans) {
  db.prepare('DELETE FROM episode_plans WHERE id = ?').run(p.id);
  log(`Usunięto plan smoke: ${p.code}`);
}

// Zombie production: running > 30 min
const stuckRuns = db.prepare(`
  SELECT pr.id, ep.code, pr.status
  FROM production_runs pr
  JOIN episode_plans ep ON ep.id = pr.episode_plan_id
  WHERE pr.status IN ('running', 'pending')
    AND datetime(pr.updated_at) < datetime('now', '-30 minutes')
`).all();
for (const r of stuckRuns) {
  db.prepare(`
    UPDATE production_runs SET status = 'failed',
      error_message = 'Produkcja przerwana (zombie) — uruchom ponownie z panelu.',
      updated_at = datetime('now') WHERE id = ?
  `).run(r.id);
  db.prepare(`
    UPDATE production_clips SET status = 'failed',
      error_message = 'Produkcja przerwana (zombie).'
    WHERE production_run_id = ? AND status IN ('pending', 'rendering')
  `).run(r.id);
  log(`Zresetowano zombie run: ${r.code} (${r.id})`);
}

const stuckPlans = db.prepare(`
  SELECT id, code FROM episode_plans
  WHERE status = 'w_produkcji'
    AND datetime(updated_at) < datetime('now', '-30 minutes')
`).all();
for (const p of stuckPlans) {
  const activeRun = db.prepare(`
    SELECT id FROM production_runs
    WHERE episode_plan_id = ? AND status IN ('running', 'pending')
  `).get(p.id);
  if (!activeRun) {
    db.prepare(`
      UPDATE episode_plans SET status = 'zaakceptowany', updated_at = datetime('now') WHERE id = ?
    `).run(p.id);
    log(`Plan ${p.code} w_produkcji -> zaakceptowany (brak aktywnego runu)`);
  }
}

// Remove smoke assets from project canon
const projects = db.prepare('SELECT id, name FROM projects').all();
for (const p of projects) {
  const row = getDirectorProject(p.id);
  const canon = row?.canon;
  if (!canon?.asset_ids?.length) continue;
  const filtered = canon.asset_ids.filter((id) => !SMOKE_ASSET_IDS.has(id));
  if (filtered.length !== canon.asset_ids.length) {
    updateDirectorProject(p.id, {
      canon: { ...canon, asset_ids: filtered },
    });
    log(`Usunięto smoke asset_ids z kanonu projektu: ${p.name}`);
  }
}

log('GOTOWE');
