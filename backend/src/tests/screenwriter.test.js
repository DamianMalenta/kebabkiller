import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { createTestDatabase, destroyTestDatabase } from './helpers/testDatabase.js';
import { assistEpisodePlan, applyScreenwriterProposal } from '../ai/screenwriter.js';
import { createEpisodePlan, getEpisodePlan, replacePlanScenes } from '../db/episodeModels.js';

describe('screenwriter', () => {
  let testDir;

  beforeAll(() => {
    testDir = createTestDatabase().dir;
  });

  afterAll(() => {
    destroyTestDatabase(testDir);
  });

  describe('assistEpisodePlan (mock mode — no GROQ_API_KEY)', () => {
    let planId;

    beforeAll(() => {
      // Remove GROQ_API_KEY to force mock fallback
      delete process.env.GROQ_API_KEY;
    });

    test('throws for non-existent plan', async () => {
      await expect(assistEpisodePlan('nonexistent-id', 'hello')).rejects.toThrow(/nie istnieje/);
    });

    test('returns mock response when no API key', async () => {
      const plan = createEpisodePlan({
        code: 'E001',
        title: 'Test Episode',
        logline: 'A test logline',
        targetDurationSec: 30,
      });
      planId = plan.id;

      const result = await assistEpisodePlan(planId, 'Kebabkiller walczy z wrogiem');

      expect(result.source).toBe('mock');
      expect(result.assistant_message).toBeTruthy();
      expect(result.proposal).toBeDefined();
      expect(result.proposal.scenes).toBeDefined();
      expect(Array.isArray(result.proposal.scenes)).toBe(true);
      expect(result.proposal.scenes.length).toBeGreaterThanOrEqual(3);
      expect(result.applied).toBe(false);
    });

    test('mock generates scenes based on target duration', async () => {
      const plan = createEpisodePlan({
        code: 'E002',
        title: 'Long Episode',
        logline: '',
        targetDurationSec: 60,
      });

      const result = await assistEpisodePlan(plan.id, 'Long fight');
      // 60 / 5 = 12, capped at max 8
      expect(result.proposal.scenes.length).toBe(8);
    });

    test('mock generates at least 3 scenes for very short duration', async () => {
      const plan = createEpisodePlan({
        code: 'E003',
        title: 'Short Episode',
        logline: '',
        targetDurationSec: 5,
      });

      const result = await assistEpisodePlan(plan.id, 'Quick scene');
      expect(result.proposal.scenes.length).toBe(3);
    });

    test('mock response includes deliverables', async () => {
      const result = await assistEpisodePlan(planId, 'test');
      expect(result.proposal.deliverables).toBeDefined();
      expect(Array.isArray(result.proposal.deliverables)).toBe(true);
      expect(result.proposal.deliverables.length).toBeGreaterThan(0);
    });

    test('apply=true applies the mock proposal to the plan', async () => {
      const plan = createEpisodePlan({
        code: 'E004',
        title: 'Apply Test',
        logline: '',
        targetDurationSec: 20,
      });

      const result = await assistEpisodePlan(plan.id, 'Apply this', { apply: true });

      expect(result.applied).toBe(true);
      expect(result.plan).toBeDefined();

      const updatedPlan = getEpisodePlan(plan.id);
      expect(updatedPlan.scenes.length).toBeGreaterThan(0);
      expect(updatedPlan.logline).toBeTruthy();
    });
  });

  describe('applyScreenwriterProposal', () => {
    test('updates logline and preferences', () => {
      const plan = createEpisodePlan({
        code: 'E010',
        title: 'Proposal Test',
        logline: 'old logline',
        targetDurationSec: 30,
      });

      const proposal = {
        logline: 'new logline',
        preferences: 'dark mood',
        scenes: [],
        deliverables: [],
      };

      const result = applyScreenwriterProposal(plan.id, proposal);
      expect(result.logline).toBe('new logline');
      expect(result.preferences).toBe('dark mood');
    });

    test('replaces scenes when proposal has scenes', () => {
      const plan = createEpisodePlan({
        code: 'E011',
        title: 'Scenes Test',
        logline: '',
        targetDurationSec: 30,
      });

      const proposal = {
        scenes: [
          { description_pl: 'Scena A', duration_sec: 5, asset_id: null, asset_image_id: null, location_asset_id: null },
          { description_pl: 'Scena B', duration_sec: 4, asset_id: null, asset_image_id: null, location_asset_id: null },
        ],
        deliverables: [],
      };

      applyScreenwriterProposal(plan.id, proposal);
      const updated = getEpisodePlan(plan.id);
      expect(updated.scenes).toHaveLength(2);
      expect(updated.scenes[0].description_pl).toBe('Scena A');
      expect(updated.scenes[1].description_pl).toBe('Scena B');
    });

    test('replaces deliverables when proposal has deliverables', () => {
      const plan = createEpisodePlan({
        code: 'E012',
        title: 'Deliverables Test',
        logline: '',
        targetDurationSec: 30,
      });

      // First add scenes so we can reference them
      const proposal1 = {
        scenes: [
          { description_pl: 'First scene', duration_sec: 4 },
        ],
        deliverables: [
          { description: 'Brakuje tła', scene_index: 0 },
        ],
      };

      applyScreenwriterProposal(plan.id, proposal1);
      const updated = getEpisodePlan(plan.id);
      expect(updated.deliverables.length).toBeGreaterThanOrEqual(1);
      expect(updated.deliverables[0].description).toBe('Brakuje tła');
    });

    test('does not update logline/preferences if not provided', () => {
      const plan = createEpisodePlan({
        code: 'E013',
        title: 'No Update Test',
        logline: 'keep this',
        targetDurationSec: 30,
      });

      const proposal = {
        scenes: [],
        deliverables: [],
      };

      applyScreenwriterProposal(plan.id, proposal);
      const updated = getEpisodePlan(plan.id);
      expect(updated.logline).toBe('keep this');
    });
  });
});
