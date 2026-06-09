import fs from 'node:fs';
import path from 'node:path';
import { ensureOutputDir, resolveOutputPath } from './paths.js';
import { createRunComfyEngine } from './runComfyEngine.js';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createPlaceholderMp4(outputPath, jobId, userPrompt) {
  const metaPath = outputPath.replace('.mp4', '.meta.json');
  fs.writeFileSync(metaPath, JSON.stringify({
    jobId,
    userPrompt,
    format: '9:16',
    resolution: '480x832',
    engine: 'mock',
    note: 'Placeholder — replace with real Wan 2.1 / ComfyUI output when VIDEO_ENGINE is configured.',
    createdAt: new Date().toISOString(),
  }, null, 2));

  fs.writeFileSync(outputPath, Buffer.from(
    `MOCK_VIDEO_PLACEHOLDER\njob=${jobId}\nprompt=${userPrompt}\n`,
    'utf8',
  ));
}

export function createMockEngine(outputDir) {
  ensureOutputDir(outputDir);

  return {
    name: 'mock',
    async render({ jobId, userPrompt, directorJson, renderStrategy, onProgress }) {
      const steps = [40, 55, 70, 85, 95];
      for (const p of steps) {
        await sleep(800);
        onProgress?.(p);
      }

      const outputPath = resolveOutputPath(outputDir, jobId);
      createPlaceholderMp4(outputPath, jobId, userPrompt);

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

  if (engineType === 'mock') {
    return createMockEngine(config.OUTPUT_DIR);
  }

  return {
    name: engineType,
    async render({ jobId, onProgress }) {
      onProgress?.(50);
      throw new Error(
        `Video engine "${engineType}" is not yet implemented. Set VIDEO_ENGINE=mock or VIDEO_ENGINE=runcomfy.`,
      );
    },
  };
}
