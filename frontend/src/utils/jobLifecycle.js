/** Job w toku dłużej niż ten próg = prawdopodobnie utknięty (restart backendu / utracony polling). */
export const ZOMBIE_JOB_AFTER_MS = 15 * 60 * 1000;

const ACTIVE_STATUSES = new Set(['pending', 'directing', 'rendering']);

export function isActiveJobStatus(status) {
  return ACTIVE_STATUSES.has(status);
}

export function isZombieJob(job, nowMs = Date.now()) {
  if (!job || !isActiveJobStatus(job.status)) return false;
  const created = new Date(job.created_at).getTime();
  if (Number.isNaN(created)) return false;
  return nowMs - created > ZOMBIE_JOB_AFTER_MS;
}

export function jobAgeMinutes(job, nowMs = Date.now()) {
  const created = new Date(job.created_at).getTime();
  if (Number.isNaN(created)) return null;
  return Math.floor((nowMs - created) / 60000);
}
