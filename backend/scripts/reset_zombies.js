/**
 * Reset zombie production runs (running/rendering) → failed.
 * Uruchom: node --experimental-sqlite scripts/reset_zombies.js
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { initDatabase, getDb, closeDatabase } from '../src/db/init.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const NOTE = 'Reset via zombie-script';

initDatabase(path.resolve(__dirname, '../data/studio.db'));
const db = getDb();

const zombies = db.prepare(`
  SELECT id FROM production_runs
  WHERE status IN ('running', 'rendering')
`).all();

const update = db.prepare(`
  UPDATE production_runs
  SET status = 'failed',
      error_message = ?,
      updated_at = datetime('now')
  WHERE id = ?
`);

for (const row of zombies) {
  update.run(NOTE, row.id);
}

closeDatabase();

console.log(`Zresetowano ${zombies.length} procesów zombie`);
