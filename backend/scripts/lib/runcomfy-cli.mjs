import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { parseRunComfyDeploymentId } from '../../src/video/runComfyEngine.js';
import { resolveWanRenderParams } from '../../src/video/wanConfig.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const BACKEND_ROOT = path.join(__dirname, '../..');

export function loadBackendEnv() {
  dotenv.config({ path: path.join(BACKEND_ROOT, '.env') });
  return {
    backendRoot: BACKEND_ROOT,
    outputDir: path.resolve(BACKEND_ROOT, process.env.OUTPUT_DIR || './output'),
    uploadsDir: path.resolve(BACKEND_ROOT, process.env.UPLOADS_DIR || './uploads'),
    dbPath: path.resolve(BACKEND_ROOT, process.env.DATABASE_PATH || './data/studio.db'),
    port: Number.parseInt(process.env.PORT || '4005', 10),
  };
}

export { parseRunComfyDeploymentId as parseDeploymentId };

export function maskSecret(value) {
  if (!value || value.length < 8) return '(brak lub za krótki)';
  return `${value.slice(0, 4)}…${value.slice(-4)}`;
}

const V2_ENDPOINT_RE = /\/deployments\/[^/]+\/inference\/?$/i;

export function validateRunComfyEnv(env = process.env) {
  const errors = [];
  const warnings = [];

  if (env.VIDEO_ENGINE !== 'runcomfy') {
    warnings.push(
      `VIDEO_ENGINE=${env.VIDEO_ENGINE || '(brak)'} — audyt RunComfy zakłada runcomfy (studio2 domyślnie fal)`,
    );
  }

  if (!env.RUNCOMFY_ENDPOINT?.trim()) {
    errors.push('RUNCOMFY_ENDPOINT — brak');
  } else if (!V2_ENDPOINT_RE.test(env.RUNCOMFY_ENDPOINT.trim())) {
    errors.push(
      'RUNCOMFY_ENDPOINT — oczekiwany format V2 (.../deployments/{id}/inference)',
    );
  }

  if (!env.RUNCOMFY_API_KEY?.trim()) {
    errors.push('RUNCOMFY_API_KEY — brak');
  }

  const wanParams = resolveWanRenderParams();
  const wanRaw = env.WAN_LENGTH?.trim();
  const configuredLength = wanParams.length;
  if (wanRaw && Number.parseInt(wanRaw, 10) !== configuredLength) {
    warnings.push(
      `WAN_LENGTH w .env (${wanRaw}) nie zgadza się z resolveWanRenderParams().length (${configuredLength})`,
    );
  }

  return { errors, warnings };
}

export function checkWritableDir(dirPath, label) {
  const errors = [];
  const warnings = [];

  if (!fs.existsSync(dirPath)) {
    warnings.push(`${label}: katalog nie istnieje (${dirPath}) — zostanie utworzony przy renderze`);
    try {
      fs.mkdirSync(dirPath, { recursive: true });
    } catch (err) {
      errors.push(`${label}: nie można utworzyć ${dirPath} — ${err.message}`);
      return { errors, warnings };
    }
  }

  try {
    fs.accessSync(dirPath, fs.constants.W_OK);
  } catch {
    errors.push(`${label}: brak zapisu do ${dirPath}`);
  }

  return { errors, warnings };
}

export function parseAuditArgs(argv) {
  const args = {
    json: false,
    strict: false,
    live: false,
    probeApi: false,
    bundle: false,
    withSmoke: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    if (flag === '--json') args.json = true;
    if (flag === '--strict') args.strict = true;
    if (flag === '--live') args.live = true;
    if (flag === '--probe-api') args.probeApi = true;
    if (flag === '--bundle') args.bundle = true;
    if (flag === '--with-smoke') args.withSmoke = true;
  }

  return args;
}
