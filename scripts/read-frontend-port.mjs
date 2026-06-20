import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { STUDIO2_DEV } from './dev-ports.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Port Vite (dev). Kolejność: FRONTEND_PORT/VITE_PORT (env) → backend/.env → STUDIO2_DEV.frontend
 */
export function readFrontendPort() {
  for (const key of ['FRONTEND_PORT', 'VITE_PORT']) {
    const raw = process.env[key]?.trim();
    if (!raw) continue;
    const parsed = Number.parseInt(raw, 10);
    if (Number.isFinite(parsed) && parsed > 0 && parsed < 65536) {
      return parsed;
    }
  }

  const envPath = path.join(ROOT, 'backend', '.env');
  if (fs.existsSync(envPath)) {
    const match = fs.readFileSync(envPath, 'utf8').match(/^FRONTEND_PORT=(\d+)/m);
    if (match) {
      const parsed = Number.parseInt(match[1], 10);
      if (Number.isFinite(parsed) && parsed > 0 && parsed < 65536) {
        return parsed;
      }
    }
  }

  return STUDIO2_DEV.frontend;
}
