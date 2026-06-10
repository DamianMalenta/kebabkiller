import { listVideoJobsByStatuses, updateVideoJob } from '../db/models.js';

const activeJobs = new Map();
const INTERRUPTED_STATUSES = ['directing', 'rendering'];
const RESTART_ERROR = 'Przerwano przez restart serwera — uruchom scenę ponownie w Studio.';

export function getActiveJobCount() {
  return activeJobs.size;
}

export async function processVideoJob(job, engine) {
  if (activeJobs.has(job.id)) return;
  activeJobs.set(job.id, true);

  try {
    updateVideoJob(job.id, { status: 'directing', progress: 10 });

    const directorJson = job.director_json
      ? (typeof job.director_json === 'string' ? JSON.parse(job.director_json) : job.director_json)
      : null;

    updateVideoJob(job.id, { status: 'rendering', progress: 30 });

    const result = await engine.render({
      jobId: job.id,
      userPrompt: job.user_prompt,
      directorJson,
      renderStrategy: job.render_strategy,
      onProgress: (progress) => {
        const percent = typeof progress === 'object' ? progress.percent : progress;
        const statusMessage = typeof progress === 'object' ? progress.message : undefined;
        updateVideoJob(job.id, {
          progress: Math.min(95, Math.round(percent)),
          ...(statusMessage ? { status_message: statusMessage } : {}),
        });
      },
    });

    updateVideoJob(job.id, {
      status: 'completed',
      progress: 100,
      output_path: result.outputPath,
      completed_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error(`[VideoQueue] Job ${job.id} failed:`, err.message);
    updateVideoJob(job.id, {
      status: 'failed',
      error_message: err.message,
      progress: 0,
    });
  } finally {
    activeJobs.delete(job.id);
  }
}

export function enqueueVideoJob(job, engine) {
  setImmediate(() => {
    processVideoJob(job, engine).catch((err) => {
      console.error('[VideoQueue] Unhandled error:', err);
    });
  });
}

export function recoverVideoJobsOnStartup(engine) {
  const interrupted = listVideoJobsByStatuses(INTERRUPTED_STATUSES);
  for (const job of interrupted) {
    updateVideoJob(job.id, {
      status: 'failed',
      error_message: RESTART_ERROR,
      progress: 0,
    });
    console.log(`[VideoQueue] Marked interrupted job ${job.id} as failed (server restart)`);
  }

  const pending = listVideoJobsByStatuses(['pending']);
  for (const job of pending) {
    enqueueVideoJob(job, engine);
    console.log(`[VideoQueue] Re-enqueued pending job ${job.id}`);
  }

  return { interrupted: interrupted.length, requeued: pending.length };
}

export { ensureOutputDir, resolveOutputPath } from './paths.js';
