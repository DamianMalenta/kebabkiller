/**
 * Natychmiastowe anulowanie aktywnej produkcji (running/pending).
 * node --experimental-sqlite scripts/stop-production-now.mjs
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { initDatabase, getDb } from '../src/db/init.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
initDatabase(path.resolve(__dirname, '../data/studio.db'));
const db = getDb();

const msg = 'Anulowano ręcznie przez użytkownika.';

const active = db.prepare(`
  SELECT pr.id, pr.episode_plan_id, ep.code
  FROM production_runs pr
  JOIN episode_plans ep ON ep.id = pr.episode_plan_id
  WHERE pr.status IN ('running', 'pending')
`).all();

if (active.length === 0) {
  console.log('[stop-production] Brak aktywnych runów.');
  process.exit(0);
}

for (const r of active) {
  db.prepare(`
    UPDATE production_runs
    SET status = 'failed', error_message = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(msg, r.id);

  db.prepare(`
    UPDATE production_clips
    SET status = 'failed', error_message = ?
    WHERE production_run_id = ? AND status IN ('pending', 'rendering')
  `).run(msg, r.id);

  db.prepare(`
    UPDATE episode_plans
    SET status = 'zaakceptowany', updated_at = datetime('now')
    WHERE id = ? AND status = 'w_produkcji'
  `).run(r.episode_plan_id);

  console.log(`[stop-production] Anulowano run ${r.code} (${r.id})`);
}

console.log('[stop-production] GOTOWE — zrestartuj backend (npm run dev) jeśli polling nadal leci.');
