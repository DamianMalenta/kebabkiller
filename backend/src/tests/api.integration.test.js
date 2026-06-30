import { jest, describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { createTestApp } from './helpers/testApp.js';

const MOCK_DIRECTOR_PLAN = {
  scene_summary: 'Kebabkiller stands on counter',
  positive_prompt: 'Kebabkiller on steel counter, warm oven glow',
  negative_prompt: 'human arms, hands',
  render_strategy: 'native_i2v',
  cinematography: { camera_shot: 'medium shot', camera_motion: 'static', lighting: 'warm' },
  kinematics: { subject_state: 'standing', primary_motion: 'idle', velocity: 'static' },
};

async function waitForJobCompletion(agent, jobId, maxAttempts = 20) {
  for (let i = 0; i < maxAttempts; i += 1) {
    await new Promise((resolve) => setImmediate(resolve));
    const res = await agent.get(`/api/jobs/${jobId}`);
    if (res.body.status === 'completed' || res.body.status === 'failed') {
      return res.body;
    }
  }
  const final = await agent.get(`/api/jobs/${jobId}`);
  return final.body;
}

describe('HTTP API integration', () => {
  let testCtx;

  beforeAll(() => {
    testCtx = createTestApp();
  });

  afterAll(() => {
    testCtx.destroy();
  });

  beforeEach(() => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: false,
        status: 503,
        text: () => Promise.resolve('provider unavailable'),
      }),
    );
  });

  describe('GET /api/health', () => {
    test('returns ok and service name', async () => {
      const res = await testCtx.agent.get('/api/health');

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.service).toBe('kebabkiller-studio-backend');
      expect(res.body.llm).toBeDefined();
    });
  });

  describe('projects CRUD', () => {
    test('POST /api/projects creates project', async () => {
      const res = await testCtx.agent
        .post('/api/projects')
        .send({ name: 'HTTP Test Serial', description: 'Integration test project' });

      expect(res.status).toBe(201);
      expect(res.body.id).toBeTruthy();
      expect(res.body.name).toBe('HTTP Test Serial');
    });

    test('POST /api/projects rejects empty name', async () => {
      const res = await testCtx.agent.post('/api/projects').send({ name: '   ' });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/wymagana/i);
    });

    test('DELETE /api/projects/:id succeeds when project has linked video jobs', async () => {
      const created = await testCtx.agent
        .post('/api/projects')
        .send({ name: 'Delete With Jobs Serial' });

      const jobRes = await testCtx.agent.post('/api/jobs').send({
        prompt: 'Scena przed usunięciem projektu.',
        project_id: created.body.id,
        skip_preview: true,
        director_plan: MOCK_DIRECTOR_PLAN,
      });
      expect(jobRes.status).toBe(201);

      const delRes = await testCtx.agent.delete(`/api/projects/${created.body.id}`);
      expect(delRes.status).toBe(204);

      const jobAfter = await testCtx.agent.get(`/api/jobs/${jobRes.body.id}`);
      expect(jobAfter.status).toBe(200);
      expect(jobAfter.body.project_id).toBeNull();
      expect(jobAfter.body.episode_id).toBeNull();
    });
  });

  describe('legacy episodes API (410)', () => {
    let projectId;

    beforeAll(async () => {
      const res = await testCtx.agent
        .post('/api/projects')
        .send({ name: 'Legacy Episodes Serial' });
      projectId = res.body.id;
    });

    test('POST /api/projects/:projectId/episodes returns 410', async () => {
      const res = await testCtx.agent
        .post(`/api/projects/${projectId}/episodes`)
        .send({ title: 'Odcinek 1', episode_number: 1 });

      expect(res.status).toBe(410);
      expect(res.body.error).toMatch(/wycofany/i);
    });

    test('GET /api/episodes/:id returns 410', async () => {
      const res = await testCtx.agent.get('/api/episodes/00000000-0000-0000-0000-000000000000');

      expect(res.status).toBe(410);
    });
  });

  describe('video jobs', () => {
    let projectId;

    beforeAll(async () => {
      const res = await testCtx.agent
        .post('/api/projects')
        .send({ name: 'Jobs Test Serial', description: 'Ton: ciepły piec.' });
      projectId = res.body.id;
    });

    test('POST /api/jobs rejects missing prompt', async () => {
      const res = await testCtx.agent.post('/api/jobs').send({ prompt: '   ' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('prompt is required');
    });

    test('POST /api/jobs creates job with skip_preview and director_plan', async () => {
      const res = await testCtx.agent.post('/api/jobs').send({
        prompt: 'Kebabkiller stoi na blacie.',
        project_id: projectId,
        skip_preview: true,
        director_plan: MOCK_DIRECTOR_PLAN,
      });

      expect(res.status).toBe(201);
      expect(res.body.director_json).toEqual(MOCK_DIRECTOR_PLAN);
      expect(typeof res.body.director_json).toBe('object');
    });

    test('GET /api/jobs/:id parses director_json as object', async () => {
      const created = await testCtx.agent.post('/api/jobs').send({
        prompt: 'Scena testowa formatJobResponse.',
        skip_preview: true,
        director_plan: MOCK_DIRECTOR_PLAN,
      });

      const res = await testCtx.agent.get(`/api/jobs/${created.body.id}`);

      expect(res.status).toBe(200);
      expect(typeof res.body.director_json).toBe('object');
      expect(res.body.director_json.scene_summary).toBe(MOCK_DIRECTOR_PLAN.scene_summary);
    });
  });
});
