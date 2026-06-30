import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { createApp } from '../../app.js';
import { createTestDatabase, destroyTestDatabase } from './testDatabase.js';

export function createTestApp() {
  const { dir: dbDir } = createTestDatabase();
  const uploadsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kebabkiller-test-uploads-'));
  const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kebabkiller-test-output-'));

  const videoEngine = {
    name: 'test-engine',
    async render({ onProgress }) {
      onProgress?.({ percent: 80, message: 'test render' });
      return {
        outputPath: path.join(outputDir, 'test-output.webm'),
        renderStrategy: 'native_i2v',
        engine: 'test-engine',
      };
    },
  };

  const app = createApp({ videoEngine, uploadsDir, outputDir });

  return {
    agent: request(app),
    app,
    dbDir,
    uploadsDir,
    outputDir,
    destroy() {
      destroyTestDatabase(dbDir);
      for (const dir of [uploadsDir, outputDir]) {
        if (dir && fs.existsSync(dir)) {
          fs.rmSync(dir, { recursive: true, force: true });
        }
      }
    },
  };
}
