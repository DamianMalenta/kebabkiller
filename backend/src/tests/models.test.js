import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { createTestDatabase, destroyTestDatabase } from './helpers/testDatabase.js';
import {
  createProject,
  createVideoJob,
  getVideoJob,
  deleteProject,
} from '../db/models.js';

describe('deleteProject', () => {
  let dbDir;

  beforeAll(() => {
    ({ dir: dbDir } = createTestDatabase());
  });

  afterAll(() => {
    destroyTestDatabase(dbDir);
  });

  test('clears job FKs so project can be removed', () => {
    const project = createProject({ name: 'FK Delete Serial' });
    const job = createVideoJob({
      userPrompt: 'test scene',
      projectId: project.id,
    });

    expect(deleteProject(project.id)).toBe(true);
    expect(getVideoJob(job.id).project_id).toBeNull();
    expect(getVideoJob(job.id).episode_id).toBeNull();
  });
});
