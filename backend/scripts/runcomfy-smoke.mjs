#!/usr/bin/env node
/**
 * RunComfy smoke test — minimal I2V render without UI.
 * Usage (from backend/):
 *   npm run smoke:runcomfy
 *   npm run smoke:runcomfy -- --repeat 2
 *   npm run smoke:runcomfy -- --dry-run
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import {
  buildRunComfyWorkflow,
  createRunComfyEngine,
  WEBM_OUTPUT_NODE_ID,
} from '../src/video/runComfyEngine.js';
import { WAN_QUALITY } from '../src/video/wanConfig.js';
import {
  loadBackendEnv,
  maskSecret,
  parseDeploymentId,
  validateRunComfyEnv,
} from './lib/runcomfy-cli.mjs';

function parseArgs(argv) {
  const args = { dryRun: false, repeat: 1 };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--dry-run') args.dryRun = true;
    if (argv[i] === '--repeat' && argv[i + 1]) {
      args.repeat = Math.max(1, Number.parseInt(argv[i + 1], 10) || 1);
      i += 1;
    }
  }
  return args;
}

async function buildSmokeStartFrame() {
  const buffer = await sharp({
    create: {
      width: WAN_QUALITY.width,
      height: WAN_QUALITY.height,
      channels: 3,
      background: { r: 40, g: 44, b: 52 },
    },
  })
    .jpeg({ quality: 85 })
    .toBuffer();

  return {
    type: 'base64',
    data: `data:image/jpeg;base64,${buffer.toString('base64')}`,
    source: 'smoke-solid',
  };
}

/** Zapisuje klatkę smoke do uploads/ — engine.render wymaga start_frame_path. */
async function materializeSmokeStartFrame(uploadsDir) {
  const buffer = await sharp({
    create: {
      width: WAN_QUALITY.width,
      height: WAN_QUALITY.height,
      channels: 3,
      background: { r: 40, g: 44, b: 52 },
    },
  })
    .jpeg({ quality: 85 })
    .toBuffer();

  fs.mkdirSync(uploadsDir, { recursive: true });
  const filename = `smoke-start-${Date.now()}.jpg`;
  fs.writeFileSync(path.join(uploadsDir, filename), buffer);
  return filename;
}

function printHeader() {
  const deploymentId = parseDeploymentId(process.env.RUNCOMFY_ENDPOINT);
  const paths = loadBackendEnv();
  console.log('=== RunComfy smoke test ===');
  console.log(`Deployment: ${deploymentId || '(nie rozpoznano UUID)'}`);
  console.log(`Endpoint:   ${process.env.RUNCOMFY_ENDPOINT}`);
  console.log(`API key:    ${maskSecret(process.env.RUNCOMFY_API_KEY)}`);
  console.log(`WAN_LENGTH: ${WAN_QUALITY.length} (${WAN_QUALITY.width}×${WAN_QUALITY.height}, steps=${WAN_QUALITY.steps})`);
  console.log(`Output dir: ${paths.outputDir}`);
  console.log('');
}

async function runDryRun() {
  const jobId = `smoke-dry-${Date.now()}`;
  const directorJson = {
    positive_prompt:
      'Static vertical 9:16 shot, kebab mascot character standing on a city street at night, subtle idle motion, cinematic lighting',
    negative_prompt: 'blurry, worst quality, text, watermark, human hands',
  };
  const startFrame = await buildSmokeStartFrame();
  const payload = buildRunComfyWorkflow(jobId, 'smoke test', directorJson, { startFrame });
  const nodes = Object.keys(payload.workflow_api_json);
  const hasWebm = payload.workflow_api_json[WEBM_OUTPUT_NODE_ID]?.class_type === 'SaveWEBM';

  console.log('[dry-run] workflow_api_json OK');
  console.log(`  nodes (${nodes.length}): ${nodes.sort((a, b) => Number(a) - Number(b)).join(', ')}`);
  console.log(`  SaveWEBM node ${WEBM_OUTPUT_NODE_ID}: ${hasWebm ? 'tak' : 'BRAK — sprawdź wan_workflow_api.json'}`);
  console.log(`  node 54 length: ${payload.workflow_api_json['54']?.inputs?.length}`);
  console.log(`  node 59 image: base64 (${startFrame.data.length} znaków)`);
  console.log('');
  console.log('Konfiguracja wygląda poprawnie. Uruchom bez --dry-run po podmianie RUNCOMFY_ENDPOINT.');
}

async function runLiveRender(runIndex, totalRuns, paths) {
  const stamp = Date.now();
  const jobId = `smoke-${stamp}-r${runIndex}`;
  fs.mkdirSync(paths.outputDir, { recursive: true });

  const config = {
    OUTPUT_DIR: paths.outputDir,
    UPLOADS_DIR: paths.uploadsDir,
    RUNCOMFY_ENDPOINT: process.env.RUNCOMFY_ENDPOINT,
    RUNCOMFY_API_KEY: process.env.RUNCOMFY_API_KEY,
    VIDEO_ENGINE: 'runcomfy',
  };

  const engine = createRunComfyEngine(paths.outputDir, config);
  const startedAt = Date.now();
  const startFramePath = await materializeSmokeStartFrame(paths.uploadsDir);

  console.log(`--- Render ${runIndex}/${totalRuns} (jobId=${jobId}) ---`);
  console.log(`  start_frame: ${startFramePath}`);

  const result = await engine.render({
    jobId,
    userPrompt: 'RunComfy smoke test',
    directorJson: {
      positive_prompt:
        'Static vertical 9:16 shot, kebab mascot character standing on a city street at night, subtle idle motion, cinematic lighting',
      negative_prompt: 'blurry, worst quality, text, watermark, human hands',
      render_strategy: 'native_i2v',
      start_frame_path: startFramePath,
      i2v_profile: 'SMOKE',
    },
    renderStrategy: 'native_i2v',
    onProgress: (p) => {
      const payload = typeof p === 'object' ? p : { percent: p };
      if (payload.message) {
        console.log(`  [${payload.percent ?? '?'}%] ${payload.message}`);
      }
    },
  });

  const elapsedSec = ((Date.now() - startedAt) / 1000).toFixed(1);
  const stat = fs.statSync(result.outputPath);
  const ext = path.extname(result.outputPath).toLowerCase();

  console.log(`  OK: ${result.outputPath}`);
  console.log(`  Rozmiar: ${stat.size} B, czas: ${elapsedSec}s, ext: ${ext}`);

  if (ext !== '.webm') {
    console.warn('  UWAGA: oczekiwano .webm — sprawdź SaveWEBM na deployment.');
  }
  if (stat.size < 10_000) {
    console.warn('  UWAGA: plik bardzo mały — możliwy placeholder lub błąd kodowania.');
  }

  return result;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const paths = loadBackendEnv();
  const { errors } = validateRunComfyEnv();

  printHeader();

  if (errors.length) {
    console.error('Błędy konfiguracji:');
    for (const err of errors) console.error(`  - ${err}`);
    console.error('\nPatrz: docs/RUNCOMFY_DEPLOYMENT.md');
    process.exit(1);
  }

  if (args.dryRun) {
    await runDryRun();
    return;
  }

  const results = [];
  for (let i = 1; i <= args.repeat; i += 1) {
    try {
      results.push(await runLiveRender(i, args.repeat, paths));
    } catch (err) {
      console.error(`\nFAIL render ${i}/${args.repeat}:`, err.message || err);
      console.error('\nDiagnoza: npm run audit:runcomfy — docs/RUNCOMFY_DEPLOYMENT.md');
      process.exit(1);
    }
    if (i < args.repeat) {
      console.log('  Krótka pauza przed kolejnym renderem…');
      await new Promise((r) => setTimeout(r, 3000));
    }
  }

  console.log('');
  console.log(`=== SUKCES: ${results.length}/${args.repeat} render(ów) ===`);
  if (args.repeat >= 2) {
    console.log('Powtarzalność OK — deployment nie zawiesił się po pierwszym jobie.');
  }
}

main().catch((err) => {
  console.error('Smoke test crash:', err);
  process.exit(1);
});
