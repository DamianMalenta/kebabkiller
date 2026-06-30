#!/usr/bin/env node
/**
 * Pełny audyt deploymentu RunComfy (API + object_info) — Windows-friendly.
 * Usage: npm run probe:runcomfy
 */
import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { REQUIRED_CLASS_TYPES, EXPECTED_MODEL_PATHS } from '../src/video/runcomfyWorkflowAudit.js';
import { parseDeploymentId, loadBackendEnv } from './lib/runcomfy-cli.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const API_BASE = 'https://api.runcomfy.net';
const REQUIRED_TYPES = [...new Set(Object.values(REQUIRED_CLASS_TYPES))];

function ok(msg) { console.log(`  ✓ ${msg}`); }
function warn(msg) { console.log(`  ! ${msg}`); }
function bad(msg) { console.log(`  ✗ ${msg}`); }

async function apiGet(url, apiKey) {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
    signal: AbortSignal.timeout(30_000),
  });
  const text = await res.text();
  let body = text;
  try { body = JSON.parse(text); } catch { /* keep text */ }
  return { status: res.status, body };
}

async function main() {
  loadBackendEnv();
  const apiKey = process.env.RUNCOMFY_API_KEY?.trim();
  const deployId = parseDeploymentId(process.env.RUNCOMFY_ENDPOINT);

  if (!apiKey || !deployId) {
    console.error('Ustaw RUNCOMFY_API_KEY i RUNCOMFY_ENDPOINT w backend/.env');
    process.exit(1);
  }

  console.log('=== RunComfy deployment probe ===\n');
  console.log(`Deployment: ${deployId}\n`);

  const dep = await apiGet(
    `${API_BASE}/prod/v2/deployments/${deployId}?includes=payload&includes=readme`,
    apiKey,
  );

  if (dep.status !== 200) {
    bad(`GET deployment → HTTP ${dep.status}`);
    console.log(typeof dep.body === 'string' ? dep.body.slice(0, 400) : dep.body);
    process.exit(1);
  }

  const d = dep.body;
  ok(`Nazwa: ${d.name}`);
  ok(`Status: ${d.status}, enabled: ${d.is_enabled}, hardware: ${(d.hardware || []).join(', ')}`);

  const wf = d.payload?.workflow_api_json || {};
  const serverTypes = [...new Set(Object.values(wf).map((n) => n.class_type).filter(Boolean))].sort();
  ok(`Workflow na serwerze: ${Object.keys(wf).length} nodów`);
  console.log(`    typy: ${serverTypes.join(', ') || '(brak)'}`);

  if (wf['52']?.class_type === 'SaveWEBM') ok('Node 52 SaveWEBM na serwerze');
  else bad(`Node 52: ${wf['52']?.class_type || 'BRAK'}`);

  const objUrl = d.payload?.object_info_url;
  if (!objUrl) {
    bad('Brak object_info_url w payload deploymentu');
  } else {
    const res = await fetch(objUrl, { signal: AbortSignal.timeout(60_000) });
    if (!res.ok) {
      bad(`object_info → HTTP ${res.status}`);
    } else {
      const oi = await res.json();
      const keys = Object.keys(oi);
      ok(`object_info: ${keys.length} typów nodów`);

      const missing = REQUIRED_TYPES.filter((t) => !keys.includes(t));
      if (missing.length === 0) ok('Wszystkie wymagane class_type (WAN pipeline)');
      else bad(`Brakujące typy: ${missing.join(', ')}`);

      const wanKeys = keys.filter((k) => /wan|savewebm/i.test(k));
      console.log(`    Wan/WEBM (skrót): ${wanKeys.slice(0, 8).join(', ')}${wanKeys.length > 8 ? '…' : ''}`);

      if (keys.length > 500) warn('>500 typów — cięższe środowisko (wolniejszy start)');
      else if (keys.length > 80) warn('>80 typów — umiarkowanie ciężkie');
      else ok('Lekkie środowisko');

      if (keys.some((k) => /manager/i.test(k))) warn('Wykryto ComfyUI-Manager (niepotrzebny, ale OK jeśli render działa)');
    }
  }

  const localPath = path.join(__dirname, '../src/video/wan_workflow_api.json');
  const local = JSON.parse(fs.readFileSync(localPath, 'utf8'));
  console.log('\n── Studio (lokalny szablon) ──');
  ok(`${Object.keys(local).length} nodów, node 52: ${local['52']?.class_type}`);
  console.log('  Modele (muszą być na dysku GPU — sprawdź terminalem RunComfy):');
  for (const [k, v] of Object.entries(EXPECTED_MODEL_PATHS)) {
    console.log(`    ${k}: ${v}`);
  }

  console.log('\n── RunComfy terminal (tylko whitelist: cd, ls, pwd, cat…) ──');
  console.log('Wklejaj PO JEDNEJ linii (bez echo/find/bash):\n');
  const { vae, clipVision, clipWan, unet } = EXPECTED_MODEL_PATHS;
  const steps = [
    'pwd',
    'ls',
    'cd ComfyUI/models',
    'ls diffusion_models',
    'ls diffusion_models/wan2.1',
    'ls vae',
    'ls clip',
    'ls clip_vision',
    'ls text_encoders',
  ];
  for (const line of steps) console.log(`  ${line}`);
  console.log('\nSzukaj plików:');
  console.log(`  - ${unet}`);
  console.log(`  - ${vae}`);
  console.log(`  - ${clipWan}`);
  console.log(`  - ${clipVision}`);
  console.log('\nAlternatywa bez terminala: górny pasek → Models / Files (GUI).');
  console.log('Pełny audyt nodów: npm run probe:runcomfy (lokalnie, już OK).');

  console.log('\nNastępny krok lokalnie: npm run smoke:runcomfy');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
