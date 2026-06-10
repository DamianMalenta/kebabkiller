import { extractRenderSummary } from './summarizeRender.js';
import { compactSeriesMemory } from './memoryCompaction.js';
import {
  getVideoJob,
  getProject,
  getEpisode,
  getRenderSummaryByJobId,
  isCanonAcceptanceComplete,
  hasSeriesMemoryRevisionForJob,
  upsertRenderSummary,
  setJobCanon,
  tryClaimJobCanon,
  releaseJobCanonClaim,
  tryAcquireCanonAcceptanceLock,
  releaseCanonAcceptanceLock,
  commitCanonSeriesMemory,
} from '../db/models.js';

function resolveStyleBible(project) {
  if (!project) return '';
  if (project.style_bible_json) {
    try {
      const parsed = JSON.parse(project.style_bible_json);
      if (typeof parsed === 'string') return parsed;
      if (parsed.text) return parsed.text;
      return JSON.stringify(parsed);
    } catch {
      return project.style_bible_json;
    }
  }
  return project.description || '';
}

function buildSkippedResult(job, projectId) {
  const project = getProject(job.project_id || projectId);
  const row = getRenderSummaryByJobId(job.id);
  let render_summary;
  if (row?.summary_json) {
    try {
      render_summary = JSON.parse(row.summary_json);
    } catch {
      render_summary = undefined;
    }
  }
  return {
    job,
    skipped: true,
    render_summary,
    series_memory: project?.series_memory || '',
  };
}

function loadOrBuildRenderSummary(job, directorJson, resolvedProjectId) {
  const existing = getRenderSummaryByJobId(job.id);
  if (existing?.summary_json) {
    try {
      return JSON.parse(existing.summary_json);
    } catch {
      // uszkodzony JSON — przebuduj poniżej
    }
  }

  const summary = extractRenderSummary(job, directorJson, {
    characterName: job.character_name,
    backgroundName: job.background_name,
  });

  upsertRenderSummary({
    jobId: job.id,
    projectId: resolvedProjectId,
    episodeId: job.episode_id,
    sceneIndex: job.scene_index,
    summaryJson: summary,
  });

  return summary;
}

/**
 * Marks a completed job as canon, stores render_summary, compacts series_memory.
 */
export async function processCanonAcceptance(jobId, { projectId } = {}) {
  let job = getVideoJob(jobId);
  if (!job) throw new Error('Job not found');
  if (job.status !== 'completed') {
    throw new Error('Tylko ukończone zlecenia mogą być oznaczone jako kanon');
  }

  if (Boolean(job.is_canon) && isCanonAcceptanceComplete(jobId)) {
    return buildSkippedResult(job, projectId);
  }

  let resolvedProjectId = projectId || job.project_id;
  if (!resolvedProjectId && job.episode_id) {
    const episode = getEpisode(job.episode_id);
    resolvedProjectId = episode?.project_id;
  }
  if (!resolvedProjectId) {
    throw new Error('project_id jest wymagany (lub przypisz episode_id do zlecenia)');
  }

  const project = getProject(resolvedProjectId);
  if (!project) throw new Error('Project not found');

  const lockAcquired = tryAcquireCanonAcceptanceLock(jobId);
  if (!lockAcquired) {
    if (isCanonAcceptanceComplete(jobId)) {
      return buildSkippedResult(getVideoJob(jobId), projectId);
    }
    throw new Error('Akceptacja kanonu już trwa — poczekaj na zakończenie');
  }

  let claimedInThisRun = false;
  let summaryPersisted = Boolean(getRenderSummaryByJobId(jobId));

  try {
    if (!Boolean(job.is_canon)) {
      const claimed = tryClaimJobCanon(jobId);
      if (!claimed) {
        const refreshed = getVideoJob(jobId);
        if (refreshed?.is_canon && isCanonAcceptanceComplete(jobId)) {
          return buildSkippedResult(refreshed, resolvedProjectId);
        }
        if (!refreshed?.is_canon) {
          throw new Error('Nie udało się zarezerwować kanonu (konflikt równoległy)');
        }
        job = refreshed;
      } else {
        claimedInThisRun = true;
        job = getVideoJob(jobId);
      }
    }

    let directorJson = {};
    try {
      directorJson = job.director_json ? JSON.parse(job.director_json) : {};
    } catch {
      throw new Error('Nieprawidłowy director_json w zleceniu');
    }

    const summary = loadOrBuildRenderSummary(job, directorJson, resolvedProjectId);
    summaryPersisted = true;

    setJobCanon(jobId, {
      projectId: resolvedProjectId,
      episodeId: job.episode_id,
      sceneIndex: job.scene_index,
    });

    if (hasSeriesMemoryRevisionForJob(jobId)) {
      const refreshedProject = getProject(resolvedProjectId);
      return {
        job: getVideoJob(jobId),
        render_summary: summary,
        series_memory: refreshedProject?.series_memory || '',
        compaction_source: 'resumed',
        skipped: false,
      };
    }

    const episode = job.episode_id ? getEpisode(job.episode_id) : null;

    const { memory, source } = await compactSeriesMemory({
      oldSeriesMemory: project.series_memory || '',
      styleBible: resolveStyleBible(project),
      newRenderSummary: summary,
      sceneContext: {
        episodeId: job.episode_id,
        episodeNumber: episode?.episode_number ?? null,
        episodeTitle: episode?.title ?? null,
        sceneIndex: job.scene_index,
      },
    });

    commitCanonSeriesMemory({
      projectId: resolvedProjectId,
      memoryText: memory,
      triggerJobId: jobId,
      compactionSource: source,
    });

    return {
      job: getVideoJob(jobId),
      render_summary: summary,
      series_memory: memory,
      compaction_source: source,
      skipped: false,
    };
  } catch (err) {
    throw err;
  } finally {
    releaseCanonAcceptanceLock(jobId);
    if (claimedInThisRun && !summaryPersisted) {
      releaseJobCanonClaim(jobId);
    }
  }
}
