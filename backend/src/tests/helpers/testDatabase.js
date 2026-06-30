import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { closeDatabase, initDatabase } from '../../db/init.js';

export function createTestDatabase() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kebabkiller-test-db-'));
  const dbPath = path.join(dir, 'studio.db');
  initDatabase(dbPath);
  return { dir, dbPath };
}

export function destroyTestDatabase(dir) {
  closeDatabase();
  if (dir && fs.existsSync(dir)) {
    try {
      fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    } catch {
      /* Windows file lock — best effort */
    }
  }
}
