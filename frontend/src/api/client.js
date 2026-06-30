const BASE = '/api';

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: options.body instanceof FormData
      ? options.headers
      : { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });

  if (res.status === 204) return null;

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

/** Tekst style bible do edycji w textarea (odpowiednik backend parseStyleBible). */
export function styleBibleToEditText(project) {
  if (!project?.style_bible_json) return project?.description || '';
  try {
    const parsed = JSON.parse(project.style_bible_json);
    if (typeof parsed === 'string') return parsed;
    if (parsed?.text) return parsed.text;
    return JSON.stringify(parsed, null, 2);
  } catch {
    return project.style_bible_json;
  }
}

const OWNER_TOKEN_KEY = 'kk_owner_token';

export function getOwnerToken() {
  try {
    return localStorage.getItem(OWNER_TOKEN_KEY) || '';
  } catch {
    return '';
  }
}

export function setOwnerToken(token) {
  try {
    if (token) localStorage.setItem(OWNER_TOKEN_KEY, token);
    else localStorage.removeItem(OWNER_TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

function ownerAuth() {
  return { 'x-owner-token': getOwnerToken() };
}

export const api = {
  health: () => request('/health'),
  knowledge: () => request('/knowledge'),

  // Faza E — AI-Inżynier (osobny moduł, bramka tokenem właściciela).
  systemAgent: {
    health: () => request('/system-agent/health'),
    status: () => request('/system-agent/status', { headers: ownerAuth() }),
    listRepairs: () => request('/system-agent/repairs', { headers: ownerAuth() }),
    getRepair: (id) => request(`/system-agent/repairs/${id}`, { headers: ownerAuth() }),
    diagnose: (body) =>
      request('/system-agent/diagnose', { method: 'POST', headers: ownerAuth(), body: JSON.stringify(body) }),
    propose: (body) =>
      request('/system-agent/propose', { method: 'POST', headers: ownerAuth(), body: JSON.stringify(body) }),
    apply: (id) =>
      request(`/system-agent/repairs/${id}/apply`, { method: 'POST', headers: ownerAuth() }),
    undo: (id) =>
      request(`/system-agent/repairs/${id}/undo`, { method: 'POST', headers: ownerAuth() }),
  },

  characters: {
    list: () => request('/characters'),
    create: (formData) => request('/characters', { method: 'POST', body: formData }),
    update: (id, formData) => request(`/characters/${id}`, { method: 'PUT', body: formData }),
    delete: (id) => request(`/characters/${id}`, { method: 'DELETE' }),
  },

  backgrounds: {
    list: () => request('/backgrounds'),
    create: (formData) => request('/backgrounds', { method: 'POST', body: formData }),
    update: (id, formData) => request(`/backgrounds/${id}`, { method: 'PUT', body: formData }),
    delete: (id) => request(`/backgrounds/${id}`, { method: 'DELETE' }),
  },

  rules: {
    list: (activeOnly = false) => request(`/rules${activeOnly ? '?active=1' : ''}`),
    create: (body) => request('/rules', { method: 'POST', body: JSON.stringify(body) }),
    update: (id, body) => request(`/rules/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    delete: (id) => request(`/rules/${id}`, { method: 'DELETE' }),
  },

  assets: {
    list: (type) => request(`/assets${type ? `?type=${type}` : ''}`),
    get: (id) => request(`/assets/${id}`),
    create: (formData) => request('/assets', { method: 'POST', body: formData }),
    update: (id, formData) => request(`/assets/${id}`, { method: 'PUT', body: formData }),
    delete: (id) => request(`/assets/${id}`, { method: 'DELETE' }),
    addImage: (id, formData) => request(`/assets/${id}/images`, { method: 'POST', body: formData }),
    deleteImage: (imageId) => request(`/asset-images/${imageId}`, { method: 'DELETE' }),
    setCompositeDefault: (id, composite) =>
      request(`/assets/${id}/composite-default`, { method: 'PUT', body: JSON.stringify({ composite }) }),
  },

  // Faza C — Klatka Zero (kolaż @char na @loc): podgląd 0 zł + zapis kaskady.
  composite: {
    preview: (body) => request('/composite/preview', { method: 'POST', body: JSON.stringify(body) }),
    setSceneOverride: (planId, sceneId, composite) =>
      request(`/episode-plans/${planId}/scenes/${sceneId}/composite`, {
        method: 'PUT',
        body: JSON.stringify({ composite }),
      }),
  },

  episodePlans: {
    get: (id) => request(`/episode-plans/${id}`),
    validate: (id) => request(`/episode-plans/${id}/validate`),
    accept: (id, { startProduction = false } = {}) =>
      request(`/episode-plans/${id}/accept`, {
        method: 'POST',
        body: JSON.stringify({ start_production: startProduction }),
      }),
    produce: (id) =>
      request(`/episode-plans/${id}/produce`, { method: 'POST' }),
    production: (id) => request(`/episode-plans/${id}/production`),
    getProductionRun: (runId) => request(`/production-runs/${runId}`),
    resumeProduction: (runId) =>
      request(`/production-runs/${runId}/resume`, { method: 'POST' }),
    assist: (id, { message, apply = false }) =>
      request(`/episode-plans/${id}/assist`, {
        method: 'POST',
        body: JSON.stringify({ message, apply }),
      }),
    delete: (id) => request(`/episode-plans/${id}`, { method: 'DELETE' }),
    attachSceneAssets: (planId, sceneId, body) =>
      request(`/episode-plans/${planId}/scenes/${sceneId}/assets`, {
        method: 'PUT',
        body: JSON.stringify(body),
      }),
  },

  // Filar 3 — silnik ciągłości: kadr z poprzedniej sceny na start następnej.
  continuity: {
    frames: (planId, sceneId) =>
      request(`/episode-plans/${planId}/scenes/${sceneId}/continuation-frames`),
    setStartFrame: (planId, sceneId, framePath) =>
      request(`/episode-plans/${planId}/scenes/${sceneId}/start-frame`, {
        method: 'PUT',
        body: JSON.stringify({ frame_path: framePath }),
      }),
  },

  directorDesk: {
    getState: (projectId, episodePlanId) => {
      const q = episodePlanId ? `?episode_plan_id=${encodeURIComponent(episodePlanId)}` : '';
      return request(`/director-desk/projects/${projectId}${q}`);
    },
    getBrain: (projectId, episodePlanId) => {
      const q = episodePlanId ? `?episode_plan_id=${encodeURIComponent(episodePlanId)}` : '';
      return request(`/director-desk/projects/${projectId}/brain${q}`);
    },
    sendMessage: (projectId, body) =>
      request(`/director-desk/projects/${projectId}/chat`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    sideThreadMessage: (threadId, body) =>
      request(`/director-desk/side-threads/${threadId}/messages`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    closeSideThread: (threadId, body) =>
      request(`/director-desk/side-threads/${threadId}/close`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
  },

  /** @deprecated Use directorDesk chat + episodePlans API instead */
  director: {
    /** @deprecated */
    preview: (body) => request('/director/preview', { method: 'POST', body: JSON.stringify(body) }),
    /** @deprecated */
    suggest: (body) => request('/director/suggest', { method: 'POST', body: JSON.stringify(body) }),
    projectContext: (projectId, episodeId) => {
      const q = episodeId ? `?episode_id=${encodeURIComponent(episodeId)}` : '';
      return request(`/projects/${projectId}/director-context${q}`);
    },
    /** @deprecated Use episodePlans.get */
    episodeContext: (episodeId) => request(`/episodes/${episodeId}/director-context`),
  },

  projects: {
    list: () => request('/projects'),
    get: (id) => request(`/projects/${id}`),
    create: (body) => request('/projects', { method: 'POST', body: JSON.stringify(body) }),
    update: (id, body) => request(`/projects/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    delete: (id) => request(`/projects/${id}`, { method: 'DELETE' }),
    episodes: (projectId) => request(`/projects/${projectId}/episode-plans`),
  },

  episodes: {
    get: (id) => request(`/episodes/${id}`),
    update: (id, body) => request(`/episodes/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    delete: (id) => request(`/episodes/${id}`, { method: 'DELETE' }),
  },

  /** @deprecated Legacy job queue — use episodePlans.produce + ProductionPanel */
  jobs: {
    list: () => request('/jobs'),
    get: (id) => request(`/jobs/${id}`),
    create: (body) => request('/jobs', { method: 'POST', body: JSON.stringify(body) }),
    patch: (id, body) => request(`/jobs/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    /** PATCH is_canon + project_id — kompresja pamięci serialowej (LLM, kilka sekund). */
    setJobAsCanon: async (jobId, projectId) => {
      try {
        return await request(`/jobs/${jobId}`, {
          method: 'PATCH',
          body: JSON.stringify({ is_canon: true, project_id: projectId }),
        });
      } catch (err) {
        throw err instanceof Error ? err : new Error(String(err));
      }
    },
    markCanon: (id, body = {}) => request(`/jobs/${id}`, { method: 'PATCH', body: JSON.stringify({ is_canon: true, ...body }) }),
    downloadUrl: (id) => `${BASE}/jobs/${id}/download`,
  },
};
