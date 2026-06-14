import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { createTestDatabase, destroyTestDatabase } from './helpers/testDatabase.js';
import { createProject } from '../db/models.js';
import {
  createEpisodePlan,
  createAsset,
  getAsset,
  getEpisodePlan,
  addAssetImage,
  replacePlanScenes,
  acceptEpisodePlan,
} from '../db/episodeModels.js';
import {
  linkEpisodeToProject,
  setEpisodeWizardStep,
} from '../db/directorDeskModels.js';
import { executeTool } from '../ai/directorDesk/agentTools.js';
import { EPISODE_STEPS } from '../ai/directorDesk/wizardStateMachine.js';
import { applyScreenwriterProposal } from '../ai/screenwriter.js';

let testDir;
let projectId;
let asset;
let imageId;

beforeEach(() => {
  const { dir } = createTestDatabase();
  testDir = dir;
  projectId = createProject({ name: 'Kanal Test', description: 'Klimat' }).id;
  asset = createAsset({ type: 'character', name: 'Kebab', descriptionPl: 'Hero' });
  addAssetImage(asset.id, { path: '/uploads/k.jpg', isPrimary: true });
  imageId = (getAsset(asset.id).images || [])[0]?.id;
});

afterEach(() => {
  destroyTestDatabase(testDir);
});

function makePlan(code) {
  const plan = createEpisodePlan({ code, logline: 'Fabuła', targetDurationSec: 12 });
  linkEpisodeToProject(plan.id, projectId);
  return plan;
}

function deskCtx(episodePlanId) {
  return {
    projectId,
    episodePlanId,
    episode: { wizard_step: EPISODE_STEPS.STORYBOARD },
    activeStep: EPISODE_STEPS.STORYBOARD,
  };
}

describe('jeden kanał zapisu scen — równoważność wejść', () => {
  test('REST (replacePlanScenes), Desk (upsertScene), Scenarzysta dają tę samą scenę', async () => {
    // Kanał REST / PUT — snake_case
    const planRest = makePlan('CH-REST');
    replacePlanScenes(planRest.id, [
      { description_pl: 'Przy piecu', duration_sec: 4, asset_id: asset.id, asset_image_id: imageId },
    ]);

    // Kanał Director's Desk — narzędzie upsertScene
    const planDesk = makePlan('CH-DESK');
    setEpisodeWizardStep(planDesk.id, EPISODE_STEPS.STORYBOARD);
    await executeTool('upsertScene', {
      description_pl: 'Przy piecu', duration_sec: 4, asset_id: asset.id, asset_image_id: imageId,
    }, deskCtx(planDesk.id));

    // Kanał Scenarzysta — proposal apply (camelCase mapping)
    const planSw = makePlan('CH-SW');
    applyScreenwriterProposal(planSw.id, {
      scenes: [{ description_pl: 'Przy piecu', duration_sec: 4, asset_id: asset.id, asset_image_id: imageId }],
    });

    const pick = (id) => {
      const s = getEpisodePlan(id).scenes[0];
      return {
        description_pl: s.description_pl,
        duration_sec: s.duration_sec,
        asset_id: s.asset_id,
        asset_image_id: s.asset_image_id,
      };
    };

    const expected = { description_pl: 'Przy piecu', duration_sec: 4, asset_id: asset.id, asset_image_id: imageId };
    expect(pick(planRest.id)).toEqual(expected);
    expect(pick(planDesk.id)).toEqual(expected);
    expect(pick(planSw.id)).toEqual(expected);
  });
});

describe('jeden kanał zapisu scen — frozen guard na każdym wejściu', () => {
  function acceptedPlan(code) {
    const plan = makePlan(code);
    replacePlanScenes(plan.id, [
      { description_pl: 'S1', duration_sec: 4, asset_id: asset.id, asset_image_id: imageId },
    ]);
    acceptEpisodePlan(plan.id);
    return plan;
  }

  test('REST replacePlanScenes rzuca na zamrożonym', () => {
    const plan = acceptedPlan('FZ-REST');
    expect(() => replacePlanScenes(plan.id, [
      { description_pl: 'X', duration_sec: 4, asset_id: asset.id, asset_image_id: imageId },
    ])).toThrow(/zamrożony/);
  });

  test('Desk upsertScene rzuca na zamrożonym', async () => {
    const plan = acceptedPlan('FZ-DESK');
    await expect(executeTool('upsertScene', {
      description_pl: 'X', duration_sec: 4, asset_id: asset.id, asset_image_id: imageId,
    }, deskCtx(plan.id))).rejects.toThrow(/zamrożony/);
  });

  test('Scenarzysta apply rzuca na zamrożonym', () => {
    const plan = acceptedPlan('FZ-SW');
    expect(() => applyScreenwriterProposal(plan.id, {
      scenes: [{ description_pl: 'X', duration_sec: 4, asset_id: asset.id, asset_image_id: imageId }],
    })).toThrow(/zamrożony/);
  });
});
