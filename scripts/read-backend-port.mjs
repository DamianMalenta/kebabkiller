import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_PORT = 4000;

/**
 * Jedno źródło prawdy dla portu backendu (dev).
 * Kolejność: BACKEND_PORT → PORT (env) → backend/.env PORT → 4000
 */
export function readBackendPort() {
  for (const key of ['BACKEND_PORT', 'PORT']) {
    const raw = process.env[key]?.trim();
    if (!raw) continue;
    const parsed = Number.parseInt(raw, 10);
    if (Number.isFinite(parsed) && parsed > 0 && parsed < 65536) {
      return parsed;
    }
  }

  const envPath = path.join(ROOT, 'backend', '.env');
  if (fs.existsSync(envPath)) {
    const match = fs.readFileSync(envPath, 'utf8').match(/^PORT=(\d+)/m);
    if (match) {
      const parsed = Number.parseInt(match[1], 10);
      if (Number.isFinite(parsed) && parsed > 0 && parsed < 65536) {
        return parsed;
      }
    }
  }

  return DEFAULT_PORT;
}

export function backendBaseUrl(port = readBackendPort()) {
  return `http://127.0.0.1:${port}`;
}

export const DEFAULT_BACKEND_PORT = DEFAULT_PORT;
