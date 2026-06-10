/** Job w toku dłużej niż ten próg = prawdopodobnie utknięty (restart backendu / utracony polling). */
export const ZOMBIE_JOB_AFTER_MS = 15 * 60 * 1000;

const ACTIVE_STATUSES = new Set(['pending', 'directing', 'rendering']);

export function isActiveJobStatus(status) {
  return ACTIVE_STATUSES.has(status);
}

function jobLastActivityMs(job) {
  const raw = job.updated_at ?? job.created_at;
  const ts = new Date(raw).getTime();
  return Number.isNaN(ts) ? null : ts;
}

export function isZombieJob(job, nowMs = Date.now()) {
  if (!job || !isActiveJobStatus(job.status)) return false;
  const last = jobLastActivityMs(job);
  if (last == null) return false;
  return nowMs - last > ZOMBIE_JOB_AFTER_MS;
}

/** Minuty od ostatniej aktywności (updated_at, fallback created_at). */
export function jobStaleMinutes(job, nowMs = Date.now()) {
  const last = jobLastActivityMs(job);
  if (last == null) return null;
  return Math.floor((nowMs - last) / 60000);
}

export function jobAgeMinutes(job, nowMs = Date.now()) {
  const created = new Date(job.created_at).getTime();
  if (Number.isNaN(created)) return null;
  return Math.floor((nowMs - created) / 60000);
}
