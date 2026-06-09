import { jest, describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { expandScenePrompt } from '../ai/director.js';
import { WAN_FORMAT_PROMPT, WAN_QUALITY } from '../video/wanConfig.js';
import { createTestDatabase, destroyTestDatabase } from './helpers/testDatabase.js';

describe('expandScenePrompt', () => {
  let dbDir;

  beforeAll(() => {
    ({ dir: dbDir } = createTestDatabase());
  });

  afterAll(() => {
    destroyTestDatabase(dbDir);
  });

  beforeEach(() => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: false,
        status: 503,
        text: () => Promise.resolve('provider unavailable'),
      }),
    );
  });

  test('falls back to mock plan when all LLM providers fail', async () => {
    const plan = await expandScenePrompt('Kebabkiller potyka się, potem leży na blacie.');

    expect(plan._source).toBe('mock');
    expect(plan.render_strategy).toBe('native_i2v');
    expect(plan.kinematics?.subject_state).toBe('lying');
    expect(plan.positive_prompt).toBeTruthy();
    expect(plan.negative_prompt).toBeTruthy();
  });

  test('embeds WAN_FORMAT_PROMPT resolution in positive_prompt', async () => {
    const plan = await expandScenePrompt('Kebabkiller stoi na blacie.');
    expect(plan.positive_prompt).toContain(WAN_FORMAT_PROMPT);
    expect(plan.positive_prompt).toContain(`${WAN_QUALITY.width}x${WAN_QUALITY.height}`);
  });

  test('binds seeded Kebabkiller identity_block_en into positive_prompt', async () => {
    const plan = await expandScenePrompt('Kebabkiller stoi na blacie.');
    expect(plan.positive_prompt).toMatch(/dürüm|Kebabkiller|rolled/i);
  });
});
