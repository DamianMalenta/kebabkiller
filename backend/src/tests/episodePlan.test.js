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
  upsertPlanScene,
  deletePlanScene,
  validateEpisodePlan,
  acceptEpisodePlan,
  isPlanFrozen,
} from '../db/episodeModels.js';

function buildAcceptablePlan(code) {
  const asset = createAsset({ type: 'character', name: `Hero-${code}`, descriptionPl: 'Hero' });
  addAssetImage(asset.id, { path: `/uploads/${code}.jpg`, isPrimary: true });
  const imageId = (getAsset(asset.id).images || [])[0]?.id;
  const plan = createEpisodePlan({ code, logline: 'Test fabuła', targetDurationSec: 20 });
  replacePlanScenes(plan.id, Array.from({ length: 5 }, (_, i) => ({
    descriptionPl: `Scena ${i + 1}`,
    durationSec: 4,
    assetId: asset.id,
    assetImageId: imageId,
  })));
  return { plan, asset, imageId };
}

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

describe('PlanValidator — limity silnika', () => {
  test('odrzuca scenę poza limitem czasu/klatek silnika', () => {
    const asset = createAsset({ type: 'character', name: 'KebabLimit', descriptionPl: 'Hero' });
    addAssetImage(asset.id, { path: '/uploads/limit.jpg', isPrimary: true });
    const imageId = (getAsset(asset.id).images || [])[0]?.id;
    const plan = createEpisodePlan({ code: 'ELIMIT', logline: 'Za długa scena', targetDurationSec: 30 });
    replacePlanScenes(plan.id, [
      { descriptionPl: 'Bardzo długa scena', durationSec: 30, assetId: asset.id, assetImageId: imageId },
    ]);

    const result = validateEpisodePlan(plan.id);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => /2.?10 s|limit/i.test(e))).toBe(true);

    expect(() => acceptEpisodePlan(plan.id)).toThrow();
  });
});

describe('frozen plan — granica Scenarzysta→Reżyser', () => {
  test('zaakceptowany plan jest zamrożony', () => {
    const { plan } = buildAcceptablePlan('EFROZEN1');
    const accepted = acceptEpisodePlan(plan.id);
    expect(accepted.status).toBe('zaakceptowany');
    expect(isPlanFrozen(accepted.status)).toBe(true);
  });

  test('replacePlanScenes rzuca na zamrożonym planie', () => {
    const { plan, asset, imageId } = buildAcceptablePlan('EFROZEN2');
    acceptEpisodePlan(plan.id);
    expect(() => replacePlanScenes(plan.id, [
      { descriptionPl: 'Nowa', durationSec: 4, assetId: asset.id, assetImageId: imageId },
    ])).toThrow(/zamrożony/);
  });

  test('upsertPlanScene rzuca na zamrożonym planie', () => {
    const { plan, asset, imageId } = buildAcceptablePlan('EFROZEN3');
    acceptEpisodePlan(plan.id);
    expect(() => upsertPlanScene(plan.id, {
      descriptionPl: 'Doklejka', durationSec: 4, assetId: asset.id, assetImageId: imageId,
    })).toThrow(/zamrożony/);
  });

  test('deletePlanScene rzuca na zamrożonym planie', () => {
    const { plan } = buildAcceptablePlan('EFROZEN4');
    const sceneId = getEpisodePlan(plan.id).scenes[0].id;
    acceptEpisodePlan(plan.id);
    expect(() => deletePlanScene(sceneId)).toThrow(/zamrożony/);
  });

  test('szkic planu nadal edytowalny', () => {
    const { plan, asset, imageId } = buildAcceptablePlan('EFROZEN5');
    expect(isPlanFrozen(getEpisodePlan(plan.id).status)).toBe(false);
    expect(() => upsertPlanScene(plan.id, {
      descriptionPl: 'Edycja w szkicu', durationSec: 4, assetId: asset.id, assetImageId: imageId,
    })).not.toThrow();
  });
});
