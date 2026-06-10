import { jest, describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { expandScenePrompt } from '../ai/director.js';
import { createProject } from '../db/models.js';
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

  test('preserves user visual details in positive_prompt when LLM is unavailable', async () => {
    const scene =
      'Ekstremalne zbliżenie od dołu. Sypią się pomarańczowe iskry, a z mięsa bucha gęsty dym.';
    const plan = await expandScenePrompt(scene);

    expect(plan.positive_prompt).toMatch(/iskr|dym|mięs/i);
    expect(plan.visual_scene).toMatch(/iskr|dym|mięs/i);
  });

  test('merges Groq visual_scene into positive_prompt', async () => {
    const prevKey = process.env.GROQ_API_KEY;
    process.env.GROQ_API_KEY = 'test-groq-key';

    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    scene_summary: 'Extreme low-angle close-up on sizzling meat.',
                    visual_scene:
                      'Orange sparks shower downward, thick smoke billows from grilled meat texture, extreme close-up from below.',
                    style_tags_en:
                      'dark phonk aesthetic, high contrast, macro food porn, dramatic shadows, glowing heat',
                    cinematography: {
                      camera_shot: 'extreme close-up',
                      camera_motion: 'static',
                      lighting: 'warm oven glow',
                    },
                    kinematics: {
                      subject_state: 'standing',
                      primary_motion: 'rigid body holds position while heat effects intensify',
                      velocity: 'static',
                    },
                  }),
                },
              },
            ],
          }),
      }),
    );

    const plan = await expandScenePrompt(
      'Ekstremalne zbliżenie od dołu. Sypią się pomarańczowe iskry, a z mięsa bucha gęsty dym.',
    );

    expect(plan._source).toBe('groq');
    expect(plan.positive_prompt).toMatch(/sparks|smoke|grilled meat/i);
    expect(plan.positive_prompt).toMatch(/warm oven glow/i);
    expect(plan.positive_prompt).toMatch(/dark phonk aesthetic, high contrast/i);
    expect(plan.positive_prompt).not.toMatch(/Kanon Wizualny|Mroczny phonk, hiperrealistyczne/i);

    process.env.GROQ_API_KEY = prevKey;
  });

  test('does not paste Polish style_bible into positive_prompt — uses English style_tags_en', async () => {
    const prevKey = process.env.GROQ_API_KEY;
    process.env.GROQ_API_KEY = 'test-groq-key';

    const project = createProject({
      name: `Style Bible Test ${Date.now()}`,
      description: 'Test serial',
      styleBibleJson:
        'Kanon Wizualny: Mroczny phonk, hiperrealistyczne zbliżenia. Zasady: Kebabkiller to ZAWSZE sztywna bryła.',
    });

    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    scene_summary: 'Kebabkiller jumps from oven to counter.',
                    visual_scene:
                      'Sparks, smoke, dramatic shadows on brick oven wall, sharp grilled meat texture, glowing heat.',
                    style_tags_en:
                      'dark phonk aesthetic, high contrast, macro food porn, dramatic shadows, cinematic lighting',
                    cinematography: {
                      camera_shot: 'close-up',
                      camera_motion: 'dolly out',
                      lighting: 'dramatic shadows',
                    },
                    kinematics: {
                      subject_state: 'jumping',
                      primary_motion: 'rigid body jump from oven to steel counter',
                      velocity: 'rapid',
                    },
                  }),
                },
              },
            ],
          }),
      }),
    );

    const plan = await expandScenePrompt('Kebabkiller wyskakuje z pieca.', {
      projectId: project.id,
    });

    expect(plan._source).toBe('groq');
    expect(plan.positive_prompt).toMatch(/dark phonk aesthetic, high contrast/i);
    expect(plan.positive_prompt).not.toMatch(/Kanon Wizualny|Mroczny phonk, hiperrealistyczne|Zasady:/i);
    expect(plan.positive_prompt).not.toMatch(/Series style:.*[ąćęłńóśźż]/i);

    process.env.GROQ_API_KEY = prevKey;
  });

  test('drops Polish prose if LLM copies style_bible into style_tags_en', async () => {
    const prevKey = process.env.GROQ_API_KEY;
    process.env.GROQ_API_KEY = 'test-groq-key';

    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    scene_summary: 'Jump scene.',
                    visual_scene: 'Sparks and smoke from grilled meat.',
                    style_tags_en: 'Kanon Wizualny: Mroczny phonk, hiperrealistyczne zbliżenia',
                    cinematography: {
                      camera_shot: 'close-up',
                      camera_motion: 'static',
                      lighting: 'dramatic shadows',
                    },
                    kinematics: {
                      subject_state: 'jumping',
                      primary_motion: 'rigid jump',
                      velocity: 'rapid',
                    },
                  }),
                },
              },
            ],
          }),
      }),
    );

    const plan = await expandScenePrompt('Kebabkiller skacze.');

    expect(plan.positive_prompt).not.toMatch(/Kanon Wizualny|Mroczny phonk, hiperrealistyczne/i);
    expect(plan.positive_prompt).not.toMatch(/Series style:/i);

    process.env.GROQ_API_KEY = prevKey;
  });
});
