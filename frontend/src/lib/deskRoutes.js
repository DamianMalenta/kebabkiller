const DESK_CTX_KEY = 'kk_desk_context';

/** Odczyt aktywnego planu odcinka z query (plan = canonical, episode = legacy). */
export function readEpisodePlanId(searchParams) {
  return searchParams.get('plan') || searchParams.get('episode') || null;
}

export function deskPath(projectId, episodePlanId = null) {
  const base = `/desk/${projectId}`;
  if (!episodePlanId) return base;
  return `${base}?plan=${encodeURIComponent(episodePlanId)}`;
}

export function darkroomPath(projectId, episodePlanId, view = 'upload') {
  const base = `/desk/${projectId}/darkroom/${episodePlanId}`;
  return view === 'staging' ? `${base}/staging` : base;
}

export function rememberDeskContext(projectId, episodePlanId) {
  if (!projectId || !episodePlanId) return;
  try {
    sessionStorage.setItem(DESK_CTX_KEY, JSON.stringify({ projectId, episodePlanId }));
  } catch {
    /* ignore */
  }
}

export function readDeskContext() {
  try {
    const raw = sessionStorage.getItem(DESK_CTX_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.projectId && parsed?.episodePlanId) return parsed;
    return null;
  } catch {
    return null;
  }
}
