import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { ensureOutputDir, resolveOutputPath } from './paths.js';
import { createRunComfyEngine } from './runComfyEngine.js';
import { createFalEngine } from './falEngine.js';
import { sleep } from '../utils/async.js';

const execFileAsync = promisify(execFile);
const FFMPEG = process.env.FFMPEG_PATH || 'ffmpeg';

/** Deterministyczny kolor tła z jobId (format 0xRRGGBB akceptowany przez ffmpeg lavfi). */
function colorFromJob(jobId) {
  let hash = 0;
  for (const ch of String(jobId)) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  const r = 60 + (hash & 0x7f);
  const g = 60 + ((hash >> 8) & 0x7f);
  const b = 60 + ((hash >> 16) & 0x7f);
  const hex = (n) => n.toString(16).padStart(2, '0');
  return `0x${hex(r)}${hex(g)}${hex(b)}`;
}

/**
 * Generuje PRAWDZIWE krótkie wideo (kolorowe klatki) — dzięki temu silnik ciągłości
 * (ekstrakcja klatek + Picker) działa w devie bez kluczy API. Fallback do placeholdera
 * gdy ffmpeg niedostępny.
 */
async function createPlaceholderVideo(outputPath, jobId, userPrompt, durationSec = 4) {
  const metaPath = outputPath.replace(/\.[^.]+$/, '.meta.json');
  fs.writeFileSync(metaPath, JSON.stringify({
    jobId,
    userPrompt,
    format: '9:16',
    resolution: '480x832',
    engine: 'mock',
    note: 'Mock video — replace with real Wan 2.1 / ComfyUI / fal output when VIDEO_ENGINE is configured.',
    createdAt: new Date().toISOString(),
  }, null, 2));

  const dur = Number.isFinite(durationSec) && durationSec > 0 ? durationSec : 4;
  try {
    await execFileAsync(FFMPEG, [
      '-y',
      '-f', 'lavfi',
      '-i', `color=c=${colorFromJob(jobId)}:s=480x832:d=${dur}:r=24`,
      '-c:v', 'libvpx-vp9',
      '-b:v', '0',
      '-crf', '40',
      '-pix_fmt', 'yuv420p',
      outputPath,
    ]);
    if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0) return;
  } catch {
    // ffmpeg niedostępny — fallback poniżej
  }

  fs.writeFileSync(outputPath, Buffer.from(
    `MOCK_VIDEO_PLACEHOLDER\njob=${jobId}\nprompt=${userPrompt}\n`,
    'utf8',
  ));
}

export function createMockEngine(outputDir) {
  ensureOutputDir(outputDir);

  return {
    name: 'mock',
    async render({ jobId, userPrompt, directorJson, renderStrategy, onProgress, outputPath: outputPathOverride }) {
      const steps = [40, 55, 70, 85, 95];
      for (const p of steps) {
        await sleep(200);
        onProgress?.(p);
      }

      const outputPath = outputPathOverride || resolveOutputPath(outputDir, jobId, '.webm');
      ensureOutputDir(path.dirname(outputPath));
      await createPlaceholderVideo(outputPath, jobId, userPrompt, directorJson?.duration_sec);

      return {
        outputPath,
        renderStrategy: renderStrategy || directorJson?.render_strategy || 'native_i2v',
        engine: 'mock',
      };
    },
  };
}

export function createVideoEngine(config) {
  const engineType = config.VIDEO_ENGINE || 'mock';

  if (engineType === 'runcomfy') {
    return createRunComfyEngine(config.OUTPUT_DIR, config);
  }

  if (engineType === 'fal') {
    return createFalEngine(config.OUTPUT_DIR, config);
  }

  if (engineType === 'mock') {
    return createMockEngine(config.OUTPUT_DIR);
  }

  return {
    name: engineType,
    async render({ jobId, onProgress }) {
      onProgress?.(50);
      throw new Error(
        `Video engine "${engineType}" is not yet implemented. Dostępne silniki: mock, fal, runcomfy.`,
      );
    },
  };
}
