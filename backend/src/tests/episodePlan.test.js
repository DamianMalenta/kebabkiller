import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { initDatabase, closeDatabase } from '../db/init.js';
import {
  createEpisodePlan,
  createAsset,
  getAsset,
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
});
