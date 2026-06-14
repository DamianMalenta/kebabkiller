/**
 * STRAŻNIK DETERMINIZMU (Faza B, kryterium DONE) — zostaje zielony po Fazach C i D.
 *
 * „2× ten sam zaakceptowany plan = identyczny payload do GPU."
 * Buduje payload renderu dokładnie tą samą logiką, co tor produkcji
 * (buildSceneDirectorPlan → enrichDirectorForRender → buildRunComfyWorkflow)
 * i porównuje dwa niezależne przebiegi bajt w bajt.
 */
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
import { buildEpisodeVisualProfile, buildSceneDirectorPlan } from '../ai/productionDirector.js';
import { buildDynamicWorkflowPayload } from '../ai/directorDesk/workflowBuilder.js';

let dbPath;

const PROJECT = {
  canon: { style_tags: ['neon noir', 'cinematic'], default_i2v_profile: 'I2V_PRODUCTION' },
  generator_tags: ['[Tryb Akcji]'],
};

/** Zbuduj payload GPU dla każdej sceny planu — ta sama logika co productionQueue. */
function buildPlanPayload(plan, project) {
  const visualProfile = buildEpisodeVisualProfile(plan);
  return plan.scenes.map((scene) => {
    const directorJson = buildSceneDirectorPlan(plan, scene, visualProfile);
    return buildDynamicWorkflowPayload({
      jobId: 'golden',
      userPrompt: scene.description_pl,
      directorJson,
      processedAssets: { startFrame: null },
      project,
      scene: { ...scene, ai_overrides: JSON.parse(scene.ai_overrides_json || '{}') },
      generatorTags: project.generator_tags,
    });
  });
}

beforeEach(() => {
  dbPath = path.join(os.tmpdir(), `kk-golden-${Date.now()}.db`);
  initDatabase(dbPath);
});

afterEach(() => {
  closeDatabase();
  if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
});

describe('golden payload — determinizm Fazy B', () => {
  function buildAcceptedPlan() {
    const char = createAsset({ type: 'character', name: 'GoldHero', descriptionPl: 'Hero', canonEn: 'Wrap canon' });
    addAssetImage(char.id, { path: '/uploads/g.jpg', isPrimary: true });
    const loc = createAsset({ type: 'location', name: 'GoldPiec', descriptionPl: 'Kuchnia', canonEn: 'Oven canon' });
    const asset = getAsset(char.id);

    const plan = createEpisodePlan({ code: 'EG1', title: 'Golden', logline: 'Determinizm', targetDurationSec: 12 });
    replacePlanScenes(plan.id, [
      { descriptionPl: 'Kebabkiller stoi i przechyla się', durationSec: 4, assetId: char.id, assetImageId: asset.images[0].id, locationAssetId: loc.id },
      { descriptionPl: 'Kebabkiller upada', durationSec: 4, assetId: char.id, assetImageId: asset.images[0].id, locationAssetId: loc.id },
      { descriptionPl: 'Kebabkiller leży', durationSec: 4, assetId: char.id, assetImageId: asset.images[0].id, locationAssetId: loc.id },
    ]);
    acceptEpisodePlan(plan.id);
    return getEpisodePlan(plan.id);
  }

  test('2× ten sam zaakceptowany plan = identyczny payload do GPU', () => {
    const plan = buildAcceptedPlan();

    const runA = buildPlanPayload(plan, PROJECT);
    const runB = buildPlanPayload(plan, PROJECT);

    expect(runB).toEqual(runA);
  });

  test('payload zawiera deterministyczny seed — różny per scena, stały w czasie', () => {
    const plan = buildAcceptedPlan();
    const runA = buildPlanPayload(plan, PROJECT);
    const runB = buildPlanPayload(plan, PROJECT);

    const seedsA = runA.map((p) => p.workflow_api_json['56'].inputs.seed);
    const seedsB = runB.map((p) => p.workflow_api_json['56'].inputs.seed);

    for (const s of seedsA) expect(Number.isInteger(s)).toBe(true);
    expect(seedsA).toEqual(seedsB); // stały w czasie
    expect(new Set(seedsA).size).toBe(seedsA.length); // różny per scena
  });

  test('payload niesie styl serialu + żywe tło + anchor (preview = prod)', () => {
    const plan = buildAcceptedPlan();
    const [first] = buildPlanPayload(plan, PROJECT);
    const positive = first.workflow_api_json['55'].inputs.text;

    expect(positive).toContain('neon noir');
    expect(positive).toContain('[Tryb Akcji]');
    // Faza C: żywe tło dopisane do promptu (oś TŁO), niezależnie od statycznej kamery.
    expect(positive).toContain('Living background');
    // Anchor = uziemienie POSTACI (nie tła) — zostaje.
    expect(positive).toContain('Feet firmly on ground');
  });
});
