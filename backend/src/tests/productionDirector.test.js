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

  test('buildSceneDirectorPlan jest deterministyczny (zero LLM) — 2× ten sam plan = identyczny', async () => {
    const char = createAsset({ type: 'character', name: 'DetHero', descriptionPl: 'Hero', canonEn: 'Wrap' });
    const loc = createAsset({ type: 'location', name: 'DetPiec', descriptionPl: 'Kuchnia', canonEn: 'Brick oven' });
    const plan = createEpisodePlan({ code: 'E05', logline: 'Determinizm', targetDurationSec: 8 });
    replacePlanScenes(plan.id, [
      { descriptionPl: 'Kebabkiller stoi i przechyla się', durationSec: 4, assetId: char.id, locationAssetId: loc.id },
    ]);
    const fullPlan = (await import('../db/episodeModels.js')).getEpisodePlan(plan.id);
    const profile = buildEpisodeVisualProfile(fullPlan);
    const scene = fullPlan.scenes[0];

    const a = await buildSceneDirectorPlan(fullPlan, scene, profile);
    const b = await buildSceneDirectorPlan(fullPlan, scene, profile);
    expect(b).toEqual(a);
  });

  test('@ID: scena wiąże ref_id assetów (kompilator dokleja @)', async () => {
    const char = createAsset({ type: 'character', name: 'Killer Drugi', descriptionPl: 'Hero', canonEn: 'Wrap' });
    const loc = createAsset({ type: 'location', name: 'Piec Drugi', descriptionPl: 'Kuchnia', canonEn: 'Brick oven' });
    const plan = createEpisodePlan({ code: 'E06', logline: 'IDtest', targetDurationSec: 8 });
    replacePlanScenes(plan.id, [
      { descriptionPl: 'Scena', durationSec: 4, assetId: char.id, locationAssetId: loc.id },
    ]);
    const fullPlan = (await import('../db/episodeModels.js')).getEpisodePlan(plan.id);
    const profile = buildEpisodeVisualProfile(fullPlan);
    const directorPlan = await buildSceneDirectorPlan(fullPlan, fullPlan.scenes[0], profile);

    expect(directorPlan.character_ref_id).toBe('@char_killer_drugi');
    expect(directorPlan.location_ref_id).toBe('@loc_piec_drugi');
    expect(directorPlan.asset_refs).toEqual(['@char_killer_drugi', '@loc_piec_drugi']);
  });

  test('kolejność bloków positive_prompt jest stała i kanoniczna', async () => {
    const char = createAsset({ type: 'character', name: 'BlockHero', descriptionPl: 'Hero', canonEn: 'WrapCanon' });
    const loc = createAsset({ type: 'location', name: 'BlockPiec', descriptionPl: 'Kuchnia', canonEn: 'OvenCanon' });
    const plan = createEpisodePlan({ code: 'E07', logline: 'Bloki', targetDurationSec: 8, preferences: 'dark mood' });
    replacePlanScenes(plan.id, [
      { descriptionPl: 'Kebabkiller stoi', durationSec: 4, assetId: char.id, locationAssetId: loc.id },
    ]);
    const fullPlan = (await import('../db/episodeModels.js')).getEpisodePlan(plan.id);
    const profile = buildEpisodeVisualProfile(fullPlan);
    const { positive_prompt: prompt } = await buildSceneDirectorPlan(fullPlan, fullPlan.scenes[0], profile);

    // Brak composite (brak obrazów) → environment + identity obecne w prompcie.
    const idxCinema = prompt.indexOf('Cinematography');
    const idxQuality = prompt.indexOf('High quality');
    const idxFormat = prompt.indexOf('Vertical 9:16');
    const idxAction = prompt.indexOf('Action:');
    expect(idxCinema).toBeGreaterThanOrEqual(0);
    expect(idxQuality).toBeGreaterThan(idxCinema);
    expect(idxFormat).toBeGreaterThan(idxQuality);
    expect(idxAction).toBeGreaterThan(idxFormat);
    expect(prompt.endsWith('dark mood')).toBe(true);
  });
});
