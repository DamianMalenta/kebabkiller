import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import { createTestDatabase, destroyTestDatabase } from './helpers/testDatabase.js';
import { classifyWritePath, assertWritePaths, GOLDEN_FILES } from '../ai/systemAgent/pathGuard.js';
import { getSystemAgentConfig } from '../ai/systemAgent/config.js';
import { createRepair, getRepair, listRepairs, updateRepair } from '../ai/systemAgent/repairJournal.js';

const REPO = '/repo';

describe('systemAgent pathGuard', () => {
  test('allows whitelisted backend/frontend src', () => {
    expect(classifyWritePath(REPO, 'backend/src/video/wanConfig.js').allowed).toBe(true);
    expect(classifyWritePath(REPO, 'frontend/src/pages/Projects.jsx').allowed).toBe(true);
  });

  test('blocks .env and secrets', () => {
    expect(classifyWritePath(REPO, 'backend/.env').allowed).toBe(false);
    expect(classifyWritePath(REPO, 'backend/.env.local').allowed).toBe(false);
    expect(classifyWritePath(REPO, 'backend/src/keys/server.pem').allowed).toBe(false);
    expect(classifyWritePath(REPO, 'secrets/credentials.json').allowed).toBe(false);
  });

  test('blocks golden files', () => {
    for (const golden of GOLDEN_FILES) {
      const verdict = classifyWritePath(REPO, golden);
      expect(verdict.allowed).toBe(false);
      expect(verdict.category).toBe('golden');
    }
  });

  test('blocks screenwriter domain (fabuła → Scenarzysta)', () => {
    const verdict = classifyWritePath(REPO, 'backend/src/ai/screenwriter.js');
    expect(verdict.allowed).toBe(false);
    expect(verdict.category).toBe('screenwriter');
  });

  test('blocks gema-0 and escapes outside repo', () => {
    expect(classifyWritePath(REPO, 'gema-0/anything.js').allowed).toBe(false);
    expect(classifyWritePath(REPO, '../outside.js').allowed).toBe(false);
  });

  test('blocks paths outside whitelist roots', () => {
    expect(classifyWritePath(REPO, 'docs/11_OPUS_ARCHITECTURE_PROPOSAL.md').allowed).toBe(false);
    expect(classifyWritePath(REPO, 'package.json').allowed).toBe(false);
  });

  test('assertWritePaths returns first offender', () => {
    const verdict = assertWritePaths(REPO, ['backend/src/ok.js', 'backend/.env']);
    expect(verdict.allowed).toBe(false);
    expect(verdict.path).toBe('backend/.env');
  });
});

describe('systemAgent config token gate', () => {
  const original = process.env.SYSTEM_AGENT_TOKEN;
  afterEach(() => {
    if (original === undefined) delete process.env.SYSTEM_AGENT_TOKEN;
    else process.env.SYSTEM_AGENT_TOKEN = original;
  });

  test('disabled without token (safe default)', () => {
    delete process.env.SYSTEM_AGENT_TOKEN;
    expect(getSystemAgentConfig().enabled).toBe(false);
  });

  test('enabled with token', () => {
    process.env.SYSTEM_AGENT_TOKEN = 'secret-abc';
    const cfg = getSystemAgentConfig();
    expect(cfg.enabled).toBe(true);
    expect(cfg.token).toBe('secret-abc');
  });
});

describe('systemAgent repair journal', () => {
  let testDir;
  beforeAll(() => {
    testDir = createTestDatabase().dir;
  });
  afterAll(() => {
    destroyTestDatabase(testDir);
  });

  test('create → read → list → update lifecycle', () => {
    const repair = createRepair({
      title: 'Fix seed determinism',
      problem: 'Random seed leaks into render path',
      files: [{ path: 'backend/src/video/wanConfig.js', before: 'a', after: 'b' }],
      diffText: '- a\n+ b',
    });
    expect(repair.status).toBe('proposed');
    expect(repair.files).toHaveLength(1);

    const fetched = getRepair(repair.id);
    expect(fetched.title).toBe('Fix seed determinism');

    const updated = updateRepair(repair.id, { status: 'applied', apply_commit_sha: 'deadbeef' });
    expect(updated.status).toBe('applied');
    expect(updated.apply_commit_sha).toBe('deadbeef');

    const all = listRepairs();
    expect(all.some((r) => r.id === repair.id)).toBe(true);
  });
});
