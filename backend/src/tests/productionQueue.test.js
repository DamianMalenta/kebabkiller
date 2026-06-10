import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { initDatabase, closeDatabase } from '../db/init.js';
import {
  createEpisodePlan,
  createAsset,
  addAssetImage,
  getAsset,
  getEpisodePlan,
  replacePlanScenes,
  acceptEpisodePlan,
} from '../db/episodeModels.js';
import { createMockEngine } from '../video/mockEngine.js';
import { processEpisodeProduction } from '../video/productionQueue.js';
import { getLatestProductionRun } from '../db/productionModels.js';

let dbPath;
let outputDir;

beforeEach(() => {
  dbPath = path.join(os.tmpdir(), `kk-queue-${Date.now()}.db`);
  outputDir = path.join(os.tmpdir(), `kk-out-${Date.now()}`);
  initDatabase(dbPath);
});

afterEach(() => {
  closeDatabase();
  if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
  if (fs.existsSync(outputDir)) fs.rmSync(outputDir, { recursive: true, force: true });
});

describe('productionQueue', () => {
  test('renders episode package with manifest and clips', async () => {
    const char = createAsset({ type: 'character', name: 'Hero', descriptionPl: 'Kebab', canonEn: 'Wrap' });
    addAssetImage(char.id, { path: '/uploads/h.jpg', isPrimary: true });
    const asset = getAsset(char.id);

    const plan = createEpisodePlan({ code: 'E03', title: 'Test', logline: 'Smoke', targetDurationSec: 20 });
    replacePlanScenes(plan.id, [
      { descriptionPl: 'Scena A', durationSec: 4, assetId: char.id, assetImageId: asset.images[0].id },
      { descriptionPl: 'Scena B', durationSec: 4, assetId: char.id, assetImageId: asset.images[0].id },
      { descriptionPl: 'Scena C', durationSec: 4, assetId: char.id, assetImageId: asset.images[0].id },
      { descriptionPl: 'Scena D', durationSec: 4, assetId: char.id, assetImageId: asset.images[0].id },
      { descriptionPl: 'Scena E', durationSec: 4, assetId: char.id, assetImageId: asset.images[0].id },
    ]);
    acceptEpisodePlan(plan.id);

    const engine = createMockEngine(outputDir);
    const run = await processEpisodeProduction(plan.id, engine, outputDir);

    expect(run.status).toBe('completed');
    expect(run.clips).toHaveLength(5);
    expect(getEpisodePlan(plan.id).status).toBe('gotowy');

    const exportDir = path.join(outputDir, 'export', 'E03');
    expect(fs.existsSync(path.join(exportDir, 'E03_manifest.json'))).toBe(true);
    expect(fs.existsSync(path.join(exportDir, 'E03_README.txt'))).toBe(true);
    expect(fs.existsSync(path.join(exportDir, 'E03_SC01.webm'))).toBe(true);

    const manifest = JSON.parse(fs.readFileSync(path.join(exportDir, 'E03_manifest.json'), 'utf8'));
    expect(manifest.episode).toBe('E03');
    expect(manifest.clips).toHaveLength(5);

    expect(getLatestProductionRun(plan.id).status).toBe('completed');
  }, 30000);
});
