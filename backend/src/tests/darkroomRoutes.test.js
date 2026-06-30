import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { jest, describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import request from 'supertest';
import { createTestDatabase, destroyTestDatabase } from './helpers/testDatabase.js';
import { createApp } from '../app.js';
import { createProject } from '../db/models.js';
import { createEpisodePlan } from '../db/episodeModels.js';
import { listSceneAssetsByEpisodePlan } from '../db/darkroomModels.js';

let app;
let agent;
let dbDir;
let uploadsDir;
let outputDir;
let episodePlanId;
let prevGroqKey;

const MOCK_MOTION_PROMPT =
  'Slow push-in with warm rim light and drifting smoke particles across the frame.';

beforeAll(async () => {
  ({ dir: dbDir } = createTestDatabase());
  uploadsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kk-darkroom-uploads-'));
  outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kk-darkroom-output-'));

  app = createApp({
    videoEngine: { name: 'test' },
    uploadsDir,
    outputDir,
  });
  agent = request(app);

  createProject({ name: `Darkroom Test ${Date.now()}` });
  const plan = createEpisodePlan({
    code: `DR${Date.now()}`,
    title: 'Test odcinek',
    logline: 'Darkroom test',
  });
  episodePlanId = plan.id;
  prevGroqKey = process.env.GROQ_API_KEY;
  process.env.GROQ_API_KEY = 'test-groq-key';
});

beforeEach(() => {
  global.fetch = jest.fn(() =>
    Promise.resolve({
      ok: true,
      json: () =>
        Promise.resolve({
          choices: [{ message: { content: MOCK_MOTION_PROMPT } }],
        }),
    }),
  );
});

afterAll(() => {
  process.env.GROQ_API_KEY = prevGroqKey;
  destroyTestDatabase(dbDir);
  for (const dir of [uploadsDir, outputDir]) {
    if (dir && fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
});

async function uploadTwoImages(targetEpisodePlanId = episodePlanId) {
  return agent
    .post('/api/darkroom/upload-batch')
    .field('episode_plan_id', targetEpisodePlanId)
    .attach('images', Buffer.from('fake-jpeg'), { filename: 'pizza1.jpg', contentType: 'image/jpeg' })
    .attach('images', Buffer.from('fake-png'), { filename: 'pizza2.png', contentType: 'image/png' });
}

describe('POST /api/darkroom/upload-batch', () => {
  test('zapisuje pliki w uploads/raw i tworzy scene_assets powiązane z episode_plans', async () => {
    const res = await uploadTwoImages();

    expect(res.status).toBe(201);
    expect(res.body.count).toBe(2);
    expect(res.body.episode_plan_id).toBe(episodePlanId);
    expect(res.body.scene_assets).toHaveLength(2);
    expect(res.body.scene_assets[0].status).toBe('PENDING_AI_AUDIT');
    expect(res.body.scene_assets[0].episode_plan_id).toBe(episodePlanId);
    expect(res.body.scene_assets[0].raw_image_path).toMatch(/^\/uploads\/raw\//);

    const rawDir = path.join(uploadsDir, 'raw');
    expect(fs.existsSync(rawDir)).toBe(true);
    expect(fs.readdirSync(rawDir).length).toBeGreaterThanOrEqual(2);

    const stored = listSceneAssetsByEpisodePlan(episodePlanId);
    expect(stored).toHaveLength(2);
    expect(stored[0].sort_order).toBeLessThan(stored[1].sort_order);
  });

  test('404 gdy plan odcinka nie istnieje', async () => {
    const res = await agent
      .post('/api/darkroom/upload-batch')
      .field('episode_plan_id', '00000000-0000-4000-8000-000000000000')
      .attach('images', Buffer.from('fake-jpeg'), { filename: 'x.jpg', contentType: 'image/jpeg' });

    expect(res.status).toBe(404);
  });
});

describe('POST /api/darkroom/episode-plans/:episode_plan_id/audit', () => {
  test('przenosi PENDING_AI_AUDIT → PENDING_USER_APPROVAL z ai_proposed_prompt', async () => {
    const plan = createEpisodePlan({
      code: `AUD${Date.now()}`,
      title: 'Audit odcinek',
      logline: 'Audit',
    });

    const uploadRes = await uploadTwoImages(plan.id);
    expect(uploadRes.status).toBe(201);

    const res = await agent.post(`/api/darkroom/episode-plans/${plan.id}/audit`);

    expect(res.status).toBe(200);
    expect(res.body.episode_plan_id).toBe(plan.id);
    expect(res.body.count).toBe(2);
    expect(res.body.scene_assets).toHaveLength(2);
    for (const asset of res.body.scene_assets) {
      expect(asset.status).toBe('PENDING_USER_APPROVAL');
      expect(asset.ai_proposed_prompt).toBe(MOCK_MOTION_PROMPT);
    }
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  test('przekazuje director_hint do Groq per asset', async () => {
    const plan = createEpisodePlan({
      code: `HNT${Date.now()}`,
      title: 'Hint odcinek',
      logline: 'Hint',
    });

    const uploadRes = await uploadTwoImages(plan.id);
    expect(uploadRes.status).toBe(201);

    const assets = uploadRes.body.scene_assets.map((asset) => ({
      id: asset.id,
      director_hint: 'kamera powoli odjeżdża, w tle płonie ogień',
    }));

    const res = await agent
      .post(`/api/darkroom/episode-plans/${plan.id}/audit`)
      .send({ assets });

    expect(res.status).toBe(200);
    expect(res.body.count).toBe(2);

    const fetchBody = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(fetchBody.messages[0].content).toContain('kamera powoli odjeżdża');
    expect(fetchBody.messages[0].content).toContain('Przetłumacz to na profesjonalny, kinowy angielski');
  });

  test('zwraca count 0 gdy brak assetów do audytu', async () => {
    const plan = createEpisodePlan({
      code: `EMP${Date.now()}`,
      title: 'Pusty audyt',
      logline: 'Empty',
    });

    const res = await agent.post(`/api/darkroom/episode-plans/${plan.id}/audit`);

    expect(res.status).toBe(200);
    expect(res.body.count).toBe(0);
    expect(res.body.scene_assets).toEqual([]);
  });

  test('404 gdy plan odcinka nie istnieje', async () => {
    const res = await agent.post(
      '/api/darkroom/episode-plans/00000000-0000-4000-8000-000000000000/audit',
    );
    expect(res.status).toBe(404);
  });
});

describe('GET /api/darkroom/episode-plans/:episode_plan_id/assets', () => {
  test('zwraca assety posortowane po sort_order', async () => {
    const plan = createEpisodePlan({
      code: `LST${Date.now()}`,
      title: 'Lista assetów',
      logline: 'List',
    });

    await uploadTwoImages(plan.id);

    const res = await agent.get(`/api/darkroom/episode-plans/${plan.id}/assets`);

    expect(res.status).toBe(200);
    expect(res.body.episode_plan_id).toBe(plan.id);
    expect(res.body.count).toBe(2);
    expect(res.body.scene_assets).toHaveLength(2);
    expect(res.body.scene_assets[0].sort_order).toBeLessThan(
      res.body.scene_assets[1].sort_order,
    );
  });

  test('404 gdy plan odcinka nie istnieje', async () => {
    const res = await agent.get(
      '/api/darkroom/episode-plans/00000000-0000-4000-8000-000000000000/assets',
    );
    expect(res.status).toBe(404);
  });
});

describe('PUT /api/darkroom/assets/:asset_id/review', () => {
  test('akceptuje asset z opcjonalnym user_override_prompt', async () => {
    const plan = createEpisodePlan({
      code: `REV${Date.now()}`,
      title: 'Recenzja',
      logline: 'Review',
    });

    const uploadRes = await uploadTwoImages(plan.id);
    const assetId = uploadRes.body.scene_assets[0].id;

    await agent.post(`/api/darkroom/episode-plans/${plan.id}/audit`);

    const res = await agent
      .put(`/api/darkroom/assets/${assetId}/review`)
      .send({
        status: 'APPROVED',
        user_override_prompt: 'Warmer tones, keep pizza steam visible',
      });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('APPROVED');
    expect(res.body.user_override_prompt).toBe('Warmer tones, keep pizza steam visible');
  });

  test('400 gdy asset nie jest w PENDING_USER_APPROVAL', async () => {
    const plan = createEpisodePlan({
      code: `BAD${Date.now()}`,
      title: 'Zły stan',
      logline: 'Bad state',
    });

    const uploadRes = await uploadTwoImages(plan.id);
    const assetId = uploadRes.body.scene_assets[0].id;

    const res = await agent
      .put(`/api/darkroom/assets/${assetId}/review`)
      .send({ status: 'APPROVED' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/nie oczekuje na akceptację/);
  });

  test('404 gdy asset nie istnieje', async () => {
    const res = await agent
      .put('/api/darkroom/assets/00000000-0000-4000-8000-000000000000/review')
      .send({ status: 'APPROVED' });

    expect(res.status).toBe(404);
  });

  test('GET production-gate zwraca ok:false gdy brak zatwierdzonych kadrów', async () => {
    const res = await agent.get(`/api/episode-plans/${episodePlanId}/production-gate`);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(false);
    expect(res.body.errors?.length).toBeGreaterThan(0);
  });
});
