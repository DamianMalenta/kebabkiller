import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { initDatabase, closeDatabase } from '../db/init.js';
import {
  createEpisodePlan,
  createAsset,
  getAsset,
  getEpisodePlan,
  addAssetImage,
  replacePlanScenes,
  validateEpisodePlan,
  acceptEpisodePlan,
} from '../db/episodeModels.js';

let dbPath;

beforeEach(() => {
  dbPath = path.join(os.tmpdir(), `kk-test-${Date.now()}.db`);
  initDatabase(dbPath);
});

afterEach(() => {
  closeDatabase();
  if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
});

describe('episode plan validation', () => {
  test('rejects plan without scenes and materials', () => {
    const plan = createEpisodePlan({ code: 'E01', logline: 'Test' });
    const result = validateEpisodePlan(plan.id);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('scenę'))).toBe(true);
  });

  test('accepts valid plan with assigned assets', () => {
    const asset = createAsset({ type: 'character', name: 'Kebab', descriptionPl: 'Hero' });
    addAssetImage(asset.id, { path: '/uploads/test.jpg', isPrimary: true });
    const images = getAsset(asset.id).images || [];
    const plan = createEpisodePlan({
      code: 'E02',
      logline: 'Kebab w piecu',
      targetDurationSec: 20,
    });
    replacePlanScenes(plan.id, [
      {
        descriptionPl: 'Stoi przy piecu',
        durationSec: 4,
        assetId: asset.id,
        assetImageId: images[0]?.id,
      },
      {
        descriptionPl: 'Upada',
        durationSec: 4,
        assetId: asset.id,
        assetImageId: images[0]?.id,
      },
      {
        descriptionPl: 'Leży',
        durationSec: 4,
        assetId: asset.id,
        assetImageId: images[0]?.id,
      },
      {
        descriptionPl: 'Wstaje',
        durationSec: 4,
        assetId: asset.id,
        assetImageId: images[0]?.id,
      },
      {
        descriptionPl: 'Koniec',
        durationSec: 4,
        assetId: asset.id,
        assetImageId: images[0]?.id,
      },
    ]);

    const validation = validateEpisodePlan(plan.id);
    expect(validation.ok).toBe(true);

    const accepted = acceptEpisodePlan(plan.id);
    expect(accepted.status).toBe('zaakceptowany');
  });

  test('replacePlanScenes accepts snake_case fields from frontend API', () => {
    const asset = createAsset({ type: 'character', name: 'KebabSnake', descriptionPl: 'Hero' });
    addAssetImage(asset.id, { path: '/uploads/snake.jpg', isPrimary: true });
    const images = getAsset(asset.id).images || [];
    const plan = createEpisodePlan({
      code: 'E99',
      logline: 'Test snake_case zapisu scen',
      targetDurationSec: 20,
    });

    replacePlanScenes(plan.id, [
      {
        description_pl: 'Stoi przy piecu',
        duration_sec: 4,
        asset_id: asset.id,
        asset_image_id: images[0]?.id,
      },
      {
        description_pl: 'Upada',
        duration_sec: 4,
        asset_id: asset.id,
        asset_image_id: images[0]?.id,
      },
      {
        description_pl: 'Leży',
        duration_sec: 4,
        asset_id: asset.id,
        asset_image_id: images[0]?.id,
      },
      {
        description_pl: 'Wstaje',
        duration_sec: 4,
        asset_id: asset.id,
        asset_image_id: images[0]?.id,
      },
      {
        description_pl: 'Koniec',
        duration_sec: 4,
        asset_id: asset.id,
        asset_image_id: images[0]?.id,
      },
    ]);

    const updated = getEpisodePlan(plan.id);
    expect(updated.scenes[0].description_pl).toBe('Stoi przy piecu');
    expect(updated.scenes[0].asset_id).toBe(asset.id);
    expect(updated.status).toBe('gotowy_do_akceptacji');

    const validation = validateEpisodePlan(plan.id);
    expect(validation.ok).toBe(true);
  });
});
