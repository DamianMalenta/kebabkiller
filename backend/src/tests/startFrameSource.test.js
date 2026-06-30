import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { initDatabase, closeDatabase } from '../db/init.js';
import {
  createEpisodePlan,
  replacePlanScenes,
  getEpisodePlan,
  setSceneStartFrameSource,
  ensureSceneOneDarkroom,
} from '../db/episodeModels.js';
import { START_FRAME_SOURCE } from '../video/startFrameSource.js';

let dbPath;

beforeEach(() => {
  dbPath = `:memory:`;
  initDatabase(dbPath);
});

afterEach(() => {
  closeDatabase();
});

describe('setSceneStartFrameSource', () => {
  test('scena 1 może mieć wyłącznie darkroom', () => {
    const plan = createEpisodePlan({ code: 'SF01', title: 'Test', logline: 'x' });
    replacePlanScenes(plan.id, [{ descriptionPl: 'A', durationSec: 4 }]);
    const scene = getEpisodePlan(plan.id).scenes[0];

    expect(() => setSceneStartFrameSource(scene.id, START_FRAME_SOURCE.PREVIOUS_SCENE))
      .toThrow(/Scena 1/);

    const updated = setSceneStartFrameSource(scene.id, START_FRAME_SOURCE.DARKROOM);
    expect(updated.start_frame_source).toBe('darkroom');
  });

  test('ensureSceneOneDarkroom ustawia darkroom na scenie 1', () => {
    const plan = createEpisodePlan({ code: 'SF02', title: 'Test', logline: 'x' });
    replacePlanScenes(plan.id, [
      { descriptionPl: 'A', durationSec: 4 },
      { descriptionPl: 'B', durationSec: 4 },
    ]);

    ensureSceneOneDarkroom(plan.id);
    const anchor = getEpisodePlan(plan.id).scenes.find((s) => s.sort_order === 0);
    expect(anchor.start_frame_source).toBe('darkroom');
  });
});
