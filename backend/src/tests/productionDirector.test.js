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
  replacePlanScenes,
  acceptEpisodePlan,
} from '../db/episodeModels.js';
import { buildEpisodeVisualProfile, buildSceneDirectorPlan } from '../ai/productionDirector.js';
import { formatClipCode } from '../db/productionModels.js';

let dbPath;

beforeEach(() => {
  dbPath = path.join(os.tmpdir(), `kk-prod-${Date.now()}.db`);
  initDatabase(dbPath);
});

afterEach(() => {
  closeDatabase();
  if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
});

describe('productionDirector', () => {
  test('buildEpisodeVisualProfile collects catalog assets', async () => {
    const char = createAsset({ type: 'character', name: 'Kebab', descriptionPl: 'Hero', canonEn: 'Dürüm wrap' });
    const loc = createAsset({ type: 'location', name: 'Piec', descriptionPl: 'Kuchnia', canonEn: 'Brick oven' });
    const plan = createEpisodePlan({ code: 'E01', logline: 'Test episode', targetDurationSec: 20 });
    replacePlanScenes(plan.id, [
      { descriptionPl: 'Stoi', durationSec: 4, assetId: char.id, locationAssetId: loc.id },
    ]);

    const fullPlan = (await import('../db/episodeModels.js')).getEpisodePlan(plan.id);
    const profile = buildEpisodeVisualProfile(fullPlan);

    expect(profile.i2v_profile).toBe('I2V_PRODUCTION');
    expect(profile.catalog_used).toHaveLength(2);
    expect(profile.static_camera).toBe(true);
  });

  test('buildSceneDirectorPlan applies I2V_PRODUCTION and clip code format', async () => {
    const char = createAsset({ type: 'character', name: 'Kebab2', descriptionPl: 'Hero', canonEn: 'Dürüm wrap tiny legs' });
    addAssetImage(char.id, { path: '/uploads/char.jpg', isPrimary: true });
    const asset = getAsset(char.id);

    const plan = createEpisodePlan({ code: 'E02', logline: 'Upadek', targetDurationSec: 20 });
    replacePlanScenes(plan.id, [
      {
        descriptionPl: 'Kebabkiller stoi i przechyla się',
        durationSec: 4,
        assetId: char.id,
        assetImageId: asset.images[0].id,
      },
      {
        descriptionPl: 'Kebabkiller upada',
        durationSec: 4,
        assetId: char.id,
        assetImageId: asset.images[0].id,
      },
      {
        descriptionPl: 'Kebabkiller leży',
        durationSec: 4,
        assetId: char.id,
        assetImageId: asset.images[0].id,
      },
      {
        descriptionPl: 'Koniec',
        durationSec: 4,
        assetId: char.id,
        assetImageId: asset.images[0].id,
      },
      {
        descriptionPl: 'Finał',
        durationSec: 4,
        assetId: char.id,
        assetImageId: asset.images[0].id,
      },
    ]);
    acceptEpisodePlan(plan.id);

    const fullPlan = (await import('../db/episodeModels.js')).getEpisodePlan(plan.id);
    const profile = buildEpisodeVisualProfile(fullPlan);
    const scene = fullPlan.scenes[0];

    const directorPlan = await buildSceneDirectorPlan(fullPlan, scene, profile);
    expect(directorPlan.i2v_profile).toBe('I2V_PRODUCTION');
    expect(directorPlan.cinematography.camera_motion).toBe('static');
    expect(directorPlan.wan_length).toBe(96);
    expect(formatClipCode('E02', 0)).toBe('E02_SC01');
  });
});
