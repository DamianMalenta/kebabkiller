import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readBackendPort, DEFAULT_BACKEND_PORT } from './read-backend-port.mjs';

const ENV_KEYS = ['BACKEND_PORT', 'PORT'];

afterEach(() => {
  for (const key of ENV_KEYS) {
    delete process.env[key];
  }
});

test('defaults to 4000 when env unset', () => {
  assert.equal(readBackendPort(), DEFAULT_BACKEND_PORT);
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
