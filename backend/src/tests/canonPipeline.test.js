import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { createTestDatabase, destroyTestDatabase } from './helpers/testDatabase.js';
import {
  createProject,
  createVideoJob,
  updateVideoJob,
  getProject,
  getRenderSummaryByJobId,
  upsertRenderSummary,
  tryAcquireCanonAcceptanceLock,
  releaseCanonAcceptanceLock,
  countSeriesMemoryRevisionsForJob,
  commitCanonSeriesMemory,
} from '../db/models.js';
import { processCanonAcceptance } from '../ai/canonPipeline.js';

describe('processCanonAcceptance', () => {
  let dbDir;

  beforeAll(() => {
    ({ dir: dbDir } = createTestDatabase());
  });

  afterAll(() => {
    destroyTestDatabase(dbDir);
  });

  test('creates render_summary and compacts series_memory on canon', async () => {
    const project = createProject({
      name: 'Test Serial',
      description: 'Ton: ciepły piec, komedia fizyczna.',
      styleBibleJson: { text: 'Kebabkiller = sztywna bryła, brak rąk.' },
    });

    const job = createVideoJob({
      userPrompt: 'Kebabkiller w piecu. Nagle skacze na blat — cień na ścianie.',
      directorJson: {
        scene_summary: 'jump onto counter',
        cinematography: { camera_shot: 'wide shot', camera_motion: 'static', lighting: 'warm' },
        kinematics: { subject_state: 'jumping', primary_motion: 'hop', velocity: 'rapid' },
        positive_prompt: 'very long prompt that must not land in series memory',
        negative_prompt: 'human arms',
      },
    });

    updateVideoJob(job.id, { status: 'completed', output_path: '/output/test.webm' });

    const result = await processCanonAcceptance(job.id, { projectId: project.id });

    expect(result.skipped).toBe(false);
    expect(result.render_summary.scene_pl).toBeTruthy();
    expect(result.series_memory.length).toBeGreaterThan(0);
    expect(result.series_memory.length).toBeLessThanOrEqual(2000);
    expect(result.series_memory).not.toContain('human arms');

    const summaryRow = getRenderSummaryByJobId(job.id);
    expect(summaryRow).toBeTruthy();

    const updatedProject = getProject(project.id);
    expect(updatedProject.series_memory).toBe(result.series_memory);
    expect(updatedProject.series_memory_updated_at).toBeTruthy();
  });

  test('is idempotent when job already canon', async () => {
    const project = createProject({ name: 'Idempotent Serial' });
    const job = createVideoJob({
      userPrompt: 'Scena testowa.',
      directorJson: { scene_summary: 'stand', kinematics: { subject_state: 'standing', primary_motion: 'idle', velocity: 'static' } },
    });
    updateVideoJob(job.id, { status: 'completed' });

    await processCanonAcceptance(job.id, { projectId: project.id });
    const second = await processCanonAcceptance(job.id, { projectId: project.id });

    expect(second.skipped).toBe(true);
  });

  test('resumes zombie canon when is_canon=1 without render_summary', async () => {
    const project = createProject({ name: 'Zombie Canon Serial' });
    const job = createVideoJob({
      userPrompt: 'Scena zombie — finał odcinka.',
      directorJson: { scene_summary: 'idle', kinematics: { subject_state: 'standing', primary_motion: 'idle', velocity: 'static' } },
    });
    updateVideoJob(job.id, {
      status: 'completed',
      project_id: project.id,
      is_canon: 1,
    });

    const result = await processCanonAcceptance(job.id, { projectId: project.id });

    expect(result.skipped).toBe(false);
    expect(getRenderSummaryByJobId(job.id)).toBeTruthy();
    expect(getProject(project.id).series_memory).toBeTruthy();
  });

  test('resumes compaction when render_summary exists but revision missing', async () => {
    const project = createProject({ name: 'Partial Zombie Serial' });
    const job = createVideoJob({
      userPrompt: 'Scena po kill -9 podczas Groq.',
      directorJson: { scene_summary: 'hop', kinematics: { subject_state: 'jumping', primary_motion: 'hop', velocity: 'rapid' } },
    });
    updateVideoJob(job.id, {
      status: 'completed',
      project_id: project.id,
      is_canon: 1,
    });

    upsertRenderSummary({
      jobId: job.id,
      projectId: project.id,
      episodeId: null,
      sceneIndex: 2,
      summaryJson: {
        scene_pl: 'Scena po kill -9 podczas Groq.',
        action_en: 'hop',
        camera: 'medium shot, static',
        lighting: 'warm',
        tone: ['warm'],
      },
    });

    const result = await processCanonAcceptance(job.id, { projectId: project.id });

    expect(result.skipped).toBe(false);
    expect(result.series_memory.length).toBeGreaterThan(0);
    expect(getProject(project.id).series_memory).toBe(result.series_memory);
  });

  test('rejects parallel zombie resume while acceptance lock is held', async () => {
    const project = createProject({ name: 'Resume Race Serial' });
    const job = createVideoJob({
      userPrompt: 'Scena równoległa.',
      directorJson: { scene_summary: 'idle', kinematics: { subject_state: 'standing', primary_motion: 'idle', velocity: 'static' } },
    });
    updateVideoJob(job.id, {
      status: 'completed',
      project_id: project.id,
      is_canon: 1,
    });

    expect(tryAcquireCanonAcceptanceLock(job.id)).toBe(true);

    await expect(
      processCanonAcceptance(job.id, { projectId: project.id }),
    ).rejects.toThrow('Akceptacja kanonu już trwa');

    releaseCanonAcceptanceLock(job.id);

    const result = await processCanonAcceptance(job.id, { projectId: project.id });
    expect(result.skipped).toBe(false);
    expect(countSeriesMemoryRevisionsForJob(job.id)).toBe(1);
  });

  test('commitCanonSeriesMemory rolls back project update on revision failure', () => {
    const project = createProject({ name: 'Tx Rollback Serial' });
    const before = getProject(project.id).series_memory || '';

    expect(() => commitCanonSeriesMemory({
      projectId: project.id,
      memoryText: 'Nie powinno zostać zapisane',
      triggerJobId: '00000000-0000-0000-0000-000000000000',
      compactionSource: 'test',
    })).toThrow();

    expect(getProject(project.id).series_memory || '').toBe(before);
    expect(countSeriesMemoryRevisionsForJob('00000000-0000-0000-0000-000000000000')).toBe(0);
  });
});
