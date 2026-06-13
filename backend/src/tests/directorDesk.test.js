import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { createTestDatabase, destroyTestDatabase } from './helpers/testDatabase.js';
import { createProject } from '../db/models.js';
import {
  buildProjectBrain,
  updateDirectorProject,
  insertDirectorChatMessage,
  listDirectorChat,
} from '../db/directorDeskModels.js';
import { buildDynamicRenderRules } from '../ai/directorDesk/workflowBuilder.js';
import { buildSceneStoryboardMock } from '../ai/directorDesk/storyboardMock.js';
import { handleDirectorMessage } from '../ai/directorDesk/agentServer.js';

describe('Director Desk', () => {
  let testDir;
  let projectId;

  beforeAll(() => {
    const { dir } = createTestDatabase();
    testDir = dir;
    const project = createProject({ name: 'Test Serial', description: 'Klimat testowy' });
    projectId = project.id;
    updateDirectorProject(projectId, {
      canon: { style_text: 'Hiperrealizm + kreskówka', asset_ids: [] },
      generatorTags: ['[Mrocznie]'],
    });
  });

  afterAll(() => {
    destroyTestDatabase(testDir);
  });

  test('buildProjectBrain returns canon and tags', () => {
    const brain = buildProjectBrain(projectId);
    expect(brain.project.name).toBe('Test Serial');
    expect(brain.project.generator_tags).toContain('[Mrocznie]');
    expect(brain.project.canon.style_text).toContain('Hiperrealizm');
  });

  test('transactional chat stores committed messages', () => {
    insertDirectorChatMessage({
      projectId,
      role: 'user',
      content: 'Test wiadomości',
    });
    const chat = listDirectorChat(projectId);
    expect(chat.some((m) => m.content === 'Test wiadomości')).toBe(true);
  });

  test('dynamic render rules merge overrides', () => {
    const project = buildProjectBrain(projectId).project;
    const rules = buildDynamicRenderRules({
      project,
      scene: { duration_sec: 4, ai_overrides: { camera_motion: 'dolly out' } },
      directorPlan: {},
      generatorTags: ['[Tryb Akcji]'],
    });
    expect(rules.style_tags).toContain('[Tryb Akcji]');
    expect(rules.camera_motion).toBe('dolly out');
  });

  test('storyboard mock marks missing assets', () => {
    const mock = buildSceneStoryboardMock({
      id: 's1',
      description_pl: 'Scena testowa',
      duration_sec: 4,
    });
    expect(mock.status).toBe('missing_assets');
  });

  test('handleDirectorMessage returns brain update', async () => {
    const result = await handleDirectorMessage({
      projectId,
      message: 'Kebabkiller w piecu — mroczny klimat',
    });
    expect(result.brain).toBeTruthy();
    expect(result.messages.length).toBe(2);
    expect(result.wizard.mode).toBe('series');
  });
});
