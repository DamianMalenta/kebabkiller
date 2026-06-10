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

export const api = {
  health: () => request('/health'),
  knowledge: () => request('/knowledge'),

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
  },

  episodePlans: {
    list: () => request('/episode-plans'),
    get: (id) => request(`/episode-plans/${id}`),
    create: (body) => request('/episode-plans', { method: 'POST', body: JSON.stringify(body) }),
    update: (id, body) => request(`/episode-plans/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    delete: (id) => request(`/episode-plans/${id}`, { method: 'DELETE' }),
    replaceScenes: (id, scenes) => request(`/episode-plans/${id}/scenes`, {
      method: 'PUT',
      body: JSON.stringify({ scenes }),
    }),
    validate: (id) => request(`/episode-plans/${id}/validate`),
    accept: (id, body = {}) => request(`/episode-plans/${id}/accept`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
    produce: (id) => request(`/episode-plans/${id}/produce`, { method: 'POST' }),
    production: (id) => request(`/episode-plans/${id}/production`),
    assist: (id, body) => request(`/episode-plans/${id}/assist`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
    resolveDeliverable: (deliverableId, formData) => request(`/deliverables/${deliverableId}/resolve`, {
      method: 'POST',
      body: formData,
    }),
    addDeliverable: (planId, body) => request(`/episode-plans/${planId}/deliverables`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  },

  director: {
    preview: (body) => request('/director/preview', { method: 'POST', body: JSON.stringify(body) }),
  },

  jobs: {
    list: () => request('/jobs'),
    get: (id) => request(`/jobs/${id}`),
    create: (body) => request('/jobs', { method: 'POST', body: JSON.stringify(body) }),
    downloadUrl: (id) => `${BASE}/jobs/${id}/download`,
  },
};
