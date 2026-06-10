import { jest, describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { createVideoJob, getVideoJob, updateVideoJob } from '../db/models.js';
import { getActiveJobCount, processVideoJob, recoverVideoJobsOnStartup } from '../video/queue.js';
import { createTestDatabase, destroyTestDatabase } from './helpers/testDatabase.js';

describe('video queue', () => {
  let dbDir;

  beforeAll(() => {
    ({ dir: dbDir } = createTestDatabase());
  });

  afterAll(() => {
    destroyTestDatabase(dbDir);
  });

  test('marks job completed when engine.render succeeds', async () => {
    const job = createVideoJob({
      userPrompt: 'test scene',
      characterId: null,
      backgroundId: null,
      directorJson: { positive_prompt: 'prompt', render_strategy: 'native_i2v' },
      renderStrategy: 'native_i2v',
    });

    const engine = {
      name: 'test-engine',
      async render({ onProgress }) {
        onProgress?.({ percent: 80, message: 'rendering' });
        return {
          outputPath: '/tmp/mock-output.webm',
          renderStrategy: 'native_i2v',
          engine: 'test-engine',
        };
      },
    };

    await processVideoJob({ ...job, director_json: { positive_prompt: 'prompt' } }, engine);

    const updated = getVideoJob(job.id);
    expect(updated.status).toBe('completed');
    expect(updated.progress).toBe(100);
    expect(updated.output_path).toBe('/tmp/mock-output.webm');
    expect(updated.status_message).toBe('rendering');
    expect(getActiveJobCount()).toBe(0);
  });

  test('marks job failed when engine.render throws', async () => {
    const job = createVideoJob({
      userPrompt: 'failing scene',
      characterId: null,
      backgroundId: null,
      directorJson: null,
      renderStrategy: 'native_i2v',
    });

    const engine = {
      name: 'failing-engine',
      async render() {
        throw new Error('GPU exploded');
      },
    };

    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    await processVideoJob({ ...job, director_json: null }, engine);
    errorSpy.mockRestore();

    const updated = getVideoJob(job.id);
    expect(updated.status).toBe('failed');
    expect(updated.error_message).toBe('GPU exploded');
    expect(updated.progress).toBe(0);
    expect(getActiveJobCount()).toBe(0);
  });

  test('does not process the same job id twice concurrently', async () => {
    const job = createVideoJob({
      userPrompt: 'duplicate guard',
      characterId: null,
      backgroundId: null,
      directorJson: null,
      renderStrategy: 'native_i2v',
    });

    let renderCalls = 0;
    const engine = {
      name: 'slow-engine',
      async render() {
        renderCalls += 1;
        await new Promise((resolve) => setTimeout(resolve, 50));
        return {
          outputPath: '/tmp/slow.webm',
          renderStrategy: 'native_i2v',
          engine: 'slow-engine',
        };
      },
    };

    const payload = { ...job, director_json: null };
    const first = processVideoJob(payload, engine);
    const second = processVideoJob(payload, engine);
    await Promise.all([first, second]);

    expect(renderCalls).toBe(1);
  });

  test('recoverVideoJobsOnStartup fails interrupted jobs and re-enqueues pending', async () => {
    const directingJob = createVideoJob({
      userPrompt: 'interrupted scene',
      characterId: null,
      backgroundId: null,
      directorJson: { positive_prompt: 'prompt', render_strategy: 'native_i2v' },
      renderStrategy: 'native_i2v',
    });
    updateVideoJob(directingJob.id, { status: 'directing', progress: 30 });

    const pendingJob = createVideoJob({
      userPrompt: 'pending scene',
      characterId: null,
      backgroundId: null,
      directorJson: { positive_prompt: 'prompt', render_strategy: 'native_i2v' },
      renderStrategy: 'native_i2v',
    });

    let renderedId = null;
    const engine = {
      name: 'recovery-engine',
      async render({ jobId }) {
        renderedId = jobId;
        return {
          outputPath: '/tmp/recovered.webm',
          renderStrategy: 'native_i2v',
          engine: 'recovery-engine',
        };
      },
    };

    const stats = recoverVideoJobsOnStartup(engine);
    expect(stats.interrupted).toBe(1);
    expect(stats.requeued).toBe(1);

    const failed = getVideoJob(directingJob.id);
    expect(failed.status).toBe('failed');
    expect(failed.error_message).toContain('restart');

    await new Promise((resolve) => setTimeout(resolve, 150));

    const completed = getVideoJob(pendingJob.id);
    expect(completed.status).toBe('completed');
    expect(renderedId).toBe(pendingJob.id);
  });
});
