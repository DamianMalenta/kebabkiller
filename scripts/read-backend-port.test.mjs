import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readBackendPort, DEFAULT_BACKEND_PORT } from './read-backend-port.mjs';
import { readFrontendPort } from './read-frontend-port.mjs';
import { STUDIO2_DEV } from './dev-ports.mjs';

const ENV_KEYS = ['BACKEND_PORT', 'PORT', 'FRONTEND_PORT', 'VITE_PORT'];

afterEach(() => {
  for (const key of ENV_KEYS) {
    delete process.env[key];
  }
});

test('reads PORT from backend/.env when process env unset', () => {
  const port = readBackendPort();
  assert.ok(Number.isFinite(port) && port > 0 && port < 65536);
  assert.equal(port, STUDIO2_DEV.backend);
});

test('reads FRONTEND_PORT from backend/.env when process env unset', () => {
  const port = readFrontendPort();
  assert.equal(port, STUDIO2_DEV.frontend);
});

test('BACKEND_PORT overrides default', () => {
  process.env.BACKEND_PORT = '4001';
  assert.equal(readBackendPort(), 4001);
});

test('PORT env used when BACKEND_PORT absent', () => {
  process.env.PORT = '4100';
  assert.equal(readBackendPort(), 4100);
});

test('BACKEND_PORT wins over PORT', () => {
  process.env.BACKEND_PORT = '4002';
  process.env.PORT = '4100';
  assert.equal(readBackendPort(), 4002);
});
