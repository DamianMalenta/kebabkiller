import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import express from 'express';
import { createTestDatabase, destroyTestDatabase } from './helpers/testDatabase.js';
import { createProject } from '../db/models.js';
import { createApiRouter } from '../api/routes.js';

let server;
let port;
let testDir;
let projectId;

// fetch jest zamockowany globalnie (setupTests.js) — używamy czystego http.
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
  projectId = createProject({ name: 'Legacy Test' }).id;

  const app = express();
  app.use(express.json());
  app.use('/api', createApiRouter({
    videoEngine: { name: 'mock' },
    uploadsDir: path.join(os.tmpdir(), 'kk-legacy-uploads'),
    outputDir: path.join(os.tmpdir(), 'kk-legacy-output'),
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

describe('legacy POST /projects/:id/episodes', () => {
  test('zwraca 410 i kieruje do kreatora', async () => {
    const res = await request('POST', `/api/projects/${projectId}/episodes`, { title: 'Powinno odpaść' });
    expect(res.status).toBe(410);
    expect(res.body.error).toMatch(/wycofany/i);
  });

  test('GET tego samego path nadal działa (episode_plans)', async () => {
    const res = await request('GET', `/api/projects/${projectId}/episodes`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});
