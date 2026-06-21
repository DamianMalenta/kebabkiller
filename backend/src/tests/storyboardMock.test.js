import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { createTestDatabase, destroyTestDatabase } from './helpers/testDatabase.js';
import { buildSceneStoryboardMock, buildEpisodeStoryboardMock } from '../ai/directorDesk/storyboardMock.js';

describe('storyboardMock', () => {
  let testDir;

  beforeAll(() => {
    testDir = createTestDatabase().dir;
  });

  afterAll(() => {
    destroyTestDatabase(testDir);
  });

  describe('buildSceneStoryboardMock', () => {
    test('returns mock for scene without assets', () => {
      const scene = {
        id: 'scene-1',
        description_pl: 'Kebabkiller wchodzi do lokalu',
        duration_sec: 5,
        asset_id: null,
        asset_image_id: null,
        location_asset_id: null,
        ai_overrides_json: null,
      };

      const mock = buildSceneStoryboardMock(scene);

      expect(mock.scene_id).toBe('scene-1');
      expect(mock.scene_index).toBe(0);
      expect(mock.description_pl).toBe('Kebabkiller wchodzi do lokalu');
      expect(mock.duration_sec).toBe(5);
      expect(mock.layers).toEqual([]);
      expect(mock.status).toBe('missing_assets');
      expect(mock.camera).toBe('medium shot');
      expect(mock.mood).toBeNull();
      expect(mock.source).toBe('mock');
      expect(mock.generated_at).toBeDefined();
    });

    test('respects sceneIndex parameter', () => {
      const scene = {
        id: 'scene-2',
        description_pl: 'Scene two',
        duration_sec: 4,
        asset_id: null,
        location_asset_id: null,
      };

      const mock = buildSceneStoryboardMock(scene, { sceneIndex: 3 });
      expect(mock.scene_index).toBe(3);
    });

    test('parses ai_overrides from ai_overrides field', () => {
      const scene = {
        id: 'scene-3',
        description_pl: 'Test',
        duration_sec: 4,
        asset_id: null,
        location_asset_id: null,
        ai_overrides: { camera: 'close up', mood: 'dark' },
      };

      const mock = buildSceneStoryboardMock(scene);
      expect(mock.camera).toBe('close up');
      expect(mock.mood).toBe('dark');
    });

    test('parses ai_overrides from JSON string', () => {
      const scene = {
        id: 'scene-4',
        description_pl: 'Test JSON',
        duration_sec: 4,
        asset_id: null,
        location_asset_id: null,
        ai_overrides_json: JSON.stringify({ camera: 'wide shot', mood: 'calm' }),
      };

      const mock = buildSceneStoryboardMock(scene);
      expect(mock.camera).toBe('wide shot');
      expect(mock.mood).toBe('calm');
    });

    test('handles invalid ai_overrides_json gracefully', () => {
      const scene = {
        id: 'scene-5',
        description_pl: 'Bad JSON',
        duration_sec: 4,
        asset_id: null,
        location_asset_id: null,
        ai_overrides_json: 'not valid json {{{',
      };

      const mock = buildSceneStoryboardMock(scene);
      expect(mock.camera).toBe('medium shot');
      expect(mock.mood).toBeNull();
    });

    test('collage_hint is an array of paths', () => {
      const scene = {
        id: 'scene-6',
        description_pl: 'Paths test',
        duration_sec: 4,
        asset_id: null,
        location_asset_id: null,
      };

      const mock = buildSceneStoryboardMock(scene);
      expect(Array.isArray(mock.collage_hint)).toBe(true);
    });
  });

  describe('buildEpisodeStoryboardMock', () => {
    test('returns episode-level mock with scene count', () => {
      const plan = {
        id: 'plan-1',
        title: 'Test Episode',
        scenes: [
          { id: 's1', description_pl: 'A', duration_sec: 4, asset_id: null, location_asset_id: null },
          { id: 's2', description_pl: 'B', duration_sec: 5, asset_id: null, location_asset_id: null },
        ],
      };

      const mock = buildEpisodeStoryboardMock(plan);

      expect(mock.episode_plan_id).toBe('plan-1');
      expect(mock.title).toBe('Test Episode');
      expect(mock.scenes).toHaveLength(2);
      expect(mock.total).toBe(2);
      expect(mock.scenes[0].scene_index).toBe(0);
      expect(mock.scenes[1].scene_index).toBe(1);
    });

    test('handles plan with no scenes', () => {
      const plan = {
        id: 'plan-2',
        title: 'Empty',
        scenes: [],
      };

      const mock = buildEpisodeStoryboardMock(plan);

      expect(mock.scenes).toHaveLength(0);
      expect(mock.total).toBe(0);
      expect(mock.ready_count).toBe(0);
    });

    test('handles plan with undefined scenes', () => {
      const plan = {
        id: 'plan-3',
        title: 'No scenes field',
      };

      const mock = buildEpisodeStoryboardMock(plan);

      expect(mock.scenes).toHaveLength(0);
      expect(mock.total).toBe(0);
    });

    test('ready_count counts scenes with at least one layer', () => {
      // Without DB assets, all scenes will have missing_assets status
      const plan = {
        id: 'plan-4',
        title: 'Ready Count',
        scenes: [
          { id: 's1', description_pl: 'A', duration_sec: 4, asset_id: null, location_asset_id: null },
          { id: 's2', description_pl: 'B', duration_sec: 4, asset_id: null, location_asset_id: null },
        ],
      };

      const mock = buildEpisodeStoryboardMock(plan);
      expect(mock.ready_count).toBe(0);
    });
  });
});
