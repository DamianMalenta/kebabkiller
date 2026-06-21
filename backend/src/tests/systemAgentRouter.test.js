import { describe, test, expect, beforeAll, afterAll, afterEach } from '@jest/globals';
import { createTestDatabase, destroyTestDatabase } from './helpers/testDatabase.js';
import { createSystemAgentRouter } from '../ai/systemAgent/router.js';
import { OWNER_TOKEN_HEADER } from '../ai/systemAgent/config.js';

// Minimal mock of Express request/response for unit testing the router handlers.
function mockReq({ method = 'GET', path = '/', headers = {}, body = null, params = {} } = {}) {
  return {
    method,
    path,
    body,
    params,
    get(name) {
      return headers[name.toLowerCase()] || headers[name];
    },
  };
}

function mockRes() {
  const res = {
    statusCode: 200,
    _json: null,
    _headers: {},
    status(code) { res.statusCode = code; return res; },
    json(data) { res._json = data; return res; },
    set(name, value) { res._headers[name] = value; return res; },
  };
  return res;
}

describe('systemAgentRouter', () => {
  let testDir;
  const TOKEN = 'test-owner-token-123';
  let originalToken;

  beforeAll(() => {
    testDir = createTestDatabase().dir;
    originalToken = process.env.SYSTEM_AGENT_TOKEN;
    process.env.SYSTEM_AGENT_TOKEN = TOKEN;
  });

  afterAll(() => {
    destroyTestDatabase(testDir);
    if (originalToken === undefined) delete process.env.SYSTEM_AGENT_TOKEN;
    else process.env.SYSTEM_AGENT_TOKEN = originalToken;
  });

  test('createSystemAgentRouter returns a router', () => {
    const router = createSystemAgentRouter();
    expect(router).toBeDefined();
    expect(typeof router).toBe('function');
  });

  test('health endpoint returns ok and enabled status', () => {
    // The router is an Express Router — we can test it by finding the route layer
    const router = createSystemAgentRouter();
    const layers = router.stack;

    // Find the health route
    const healthLayer = layers.find(
      (l) => l.route && l.route.path === '/health' && l.route.methods.get,
    );
    expect(healthLayer).toBeDefined();

    // Call the handler
    const req = mockReq({ method: 'GET', path: '/health' });
    const res = mockRes();
    healthLayer.route.stack[0].handle(req, res);

    expect(res._json).toEqual({ ok: true, module: 'system-agent', enabled: true });
  });

  test('status endpoint is registered', () => {
    const router = createSystemAgentRouter();
    const layers = router.stack;

    const statusLayer = layers.find(
      (l) => l.route && l.route.path === '/status' && l.route.methods.get,
    );
    expect(statusLayer).toBeDefined();
  });

  test('check-path endpoint is registered', () => {
    const router = createSystemAgentRouter();
    const layers = router.stack;

    const checkPathLayer = layers.find(
      (l) => l.route && l.route.path === '/check-path' && l.route.methods.post,
    );
    expect(checkPathLayer).toBeDefined();
  });

  test('middleware rejects request without token', () => {
    const router = createSystemAgentRouter();
    const layers = router.stack;

    // Find the middleware (non-route layer)
    const middleware = layers.find((l) => !l.route && l.name !== 'bound dispatch');
    expect(middleware).toBeDefined();

    const req = mockReq({ headers: {} });
    const res = mockRes();
    let nextCalled = false;

    middleware.handle(req, res, () => { nextCalled = true; });

    expect(nextCalled).toBe(false);
    expect(res.statusCode).toBe(401);
    expect(res._json.error).toContain('token');
  });

  test('middleware rejects request with wrong token', () => {
    const router = createSystemAgentRouter();
    const layers = router.stack;
    const middleware = layers.find((l) => !l.route && l.name !== 'bound dispatch');

    const req = mockReq({
      headers: { [OWNER_TOKEN_HEADER.toLowerCase()]: 'wrong-token' },
    });
    const res = mockRes();
    let nextCalled = false;

    middleware.handle(req, res, () => { nextCalled = true; });

    expect(nextCalled).toBe(false);
    expect(res.statusCode).toBe(401);
  });

  test('middleware passes with correct token', () => {
    const router = createSystemAgentRouter();
    const layers = router.stack;
    const middleware = layers.find((l) => !l.route && l.name !== 'bound dispatch');

    const req = mockReq({
      headers: { [OWNER_TOKEN_HEADER.toLowerCase()]: TOKEN },
    });
    const res = mockRes();
    let nextCalled = false;

    middleware.handle(req, res, () => { nextCalled = true; });

    expect(nextCalled).toBe(true);
  });

  test('middleware returns 503 when agent disabled', () => {
    const saved = process.env.SYSTEM_AGENT_TOKEN;
    delete process.env.SYSTEM_AGENT_TOKEN;

    const router = createSystemAgentRouter();
    const layers = router.stack;
    const middleware = layers.find((l) => !l.route && l.name !== 'bound dispatch');

    const req = mockReq({ headers: {} });
    const res = mockRes();
    middleware.handle(req, res, () => {});

    expect(res.statusCode).toBe(503);
    expect(res._json.error).toContain('wyłączony');

    process.env.SYSTEM_AGENT_TOKEN = saved;
  });

  test('repairs endpoint is registered', () => {
    const router = createSystemAgentRouter();
    const layers = router.stack;

    const repairsLayer = layers.find(
      (l) => l.route && l.route.path === '/repairs' && l.route.methods.get,
    );
    expect(repairsLayer).toBeDefined();
  });

  test('repairs/:id endpoint is registered', () => {
    const router = createSystemAgentRouter();
    const layers = router.stack;

    const repairDetailLayer = layers.find(
      (l) => l.route && l.route.path === '/repairs/:id' && l.route.methods.get,
    );
    expect(repairDetailLayer).toBeDefined();
  });

  test('diagnose endpoint is registered', () => {
    const router = createSystemAgentRouter();
    const layers = router.stack;

    const diagnoseLayer = layers.find(
      (l) => l.route && l.route.path === '/diagnose' && l.route.methods.post,
    );
    expect(diagnoseLayer).toBeDefined();
  });

  test('propose endpoint is registered', () => {
    const router = createSystemAgentRouter();
    const layers = router.stack;

    const proposeLayer = layers.find(
      (l) => l.route && l.route.path === '/propose' && l.route.methods.post,
    );
    expect(proposeLayer).toBeDefined();
  });

  test('repairs/:id/apply endpoint is registered', () => {
    const router = createSystemAgentRouter();
    const layers = router.stack;

    const applyLayer = layers.find(
      (l) => l.route && l.route.path === '/repairs/:id/apply' && l.route.methods.post,
    );
    expect(applyLayer).toBeDefined();
  });

  test('repairs/:id/undo endpoint is registered', () => {
    const router = createSystemAgentRouter();
    const layers = router.stack;

    const undoLayer = layers.find(
      (l) => l.route && l.route.path === '/repairs/:id/undo' && l.route.methods.post,
    );
    expect(undoLayer).toBeDefined();
  });
});
