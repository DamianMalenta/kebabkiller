import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import express from 'express';
import { createTestDatabase, destroyTestDatabase } from './helpers/testDatabase.js';
import { createApiRouter } from '../api/routes.js';
import {
  createAsset,
  createEpisodePlan,
  upsertPlanScene,
  acceptEpisodePlan,
} from '../db/episodeModels.js';
import { createProject } from '../db/models.js';
import { linkEpisodeToProject } from '../db/directorDeskModels.js';

let server;
let port;
let testDir;
let assetId;
let sceneAssetId;

function request(method, urlPath, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = http.request(
      {
        host: '127.0.0.1',
        port,
        path: urlPath,
        method,
        headers: data
          ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
          : {},
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => { raw += chunk; });
        res.on('end', () => resolve({ status: res.statusCode, body: raw ? JSON.parse(raw) : null }));
      },
    );
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

beforeAll(async () => {
  const { dir } = createTestDatabase();
  testDir = dir;
  assetId = createAsset({ type: 'character', name: 'TestChar', descriptionPl: 'x' }).id;
  sceneAssetId = createAsset({ type: 'location', name: 'TestLoc', descriptionPl: 'y' }).id;

  const app = express();
  app.use(express.json());
  app.use('/api', createApiRouter({
    videoEngine: { name: 'mock' },
    uploadsDir: path.join(os.tmpdir(), 'kk-asset-del-uploads'),
    outputDir: path.join(os.tmpdir(), 'kk-asset-del-output'),
  }));

  await new Promise((resolve) => {
    server = app.listen(0, () => {
      port = server.address().port;
      resolve();
    });
  });
});

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
  destroyTestDatabase(testDir);
});

describe('DELETE /assets/:id', () => {
  test('409 gdy asset używany w scenie', async () => {
    const project = createProject({ name: 'P' });
    const plan = createEpisodePlan({ code: 'E99', title: 'T' });
    linkEpisodeToProject(plan.id, project.id);
    upsertPlanScene(plan.id, {
      sortOrder: 0,
      descriptionPl: 'scena',
      durationSec: 4,
      assetId,
      locationAssetId: sceneAssetId,
    });

    const res = await request('DELETE', `/api/assets/${assetId}`);
    expect(res.status).toBe(409);
    expect(res.body.scenes).toHaveLength(1);
    expect(res.body.error).toMatch(/używany/i);
  });

  test('204 gdy asset wolny', async () => {
    const free = createAsset({ type: 'prop', name: 'FreeProp', descriptionPl: 'z' });
    const res = await request('DELETE', `/api/assets/${free.id}`);
    expect(res.status).toBe(204);
  });
});

describe('GET /episodes/:id legacy', () => {
  test('410 wycofany', async () => {
    const res = await request('GET', '/api/episodes/any-id');
    expect(res.status).toBe(410);
    expect(res.body.use_instead).toMatch(/episode-plans/);
  });
});

describe('PUT /episode-plans/:id status guard', () => {
  test('ignoruje status w body', async () => {
    const plan = createEpisodePlan({ code: 'GUARD1', title: 'G', logline: 'Test guard status' });
    upsertPlanScene(plan.id, {
      sortOrder: 0,
      descriptionPl: 'scena test',
      durationSec: 4,
      assetId,
      locationAssetId: sceneAssetId,
    });
    acceptEpisodePlan(plan.id);

    const res = await request('PUT', `/api/episode-plans/${plan.id}`, { status: 'szkic' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('zaakceptowany');
  });
});
