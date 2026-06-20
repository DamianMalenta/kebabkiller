import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createTestDatabase, destroyTestDatabase } from './helpers/testDatabase.js';
import { classifyWritePath, assertWritePaths, GOLDEN_FILES } from '../ai/systemAgent/pathGuard.js';
import { getSystemAgentConfig } from '../ai/systemAgent/config.js';
import { createRepair, getRepair, listRepairs, updateRepair } from '../ai/systemAgent/repairJournal.js';
import { createRepairEngine } from '../ai/systemAgent/engine.js';

const REPO = '/repo';

function makeRepo() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kk-sysagent-repo-'));
  fs.mkdirSync(path.join(root, 'backend/src/video'), { recursive: true });
  fs.writeFileSync(path.join(root, 'backend/src/video/wanConfig.js'), 'export const A = 1;\nexport const B = 2;\n');
  fs.writeFileSync(path.join(root, 'backend/.env'), 'SECRET=xxx\n');
  return root;
}

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

describe('systemAgent engine: diagnose (read-only)', () => {
  let repoRoot;
  beforeAll(() => { repoRoot = makeRepo(); });
  afterAll(() => { fs.rmSync(repoRoot, { recursive: true, force: true }); });

  test('reads whitelisted file, never writes', () => {
    const engine = createRepairEngine({ repoRoot });
    const result = engine.diagnose({ problem: 'check', files: ['backend/src/video/wanConfig.js'] });
    expect(result.readOnly).toBe(true);
    expect(result.files[0].exists).toBe(true);
    expect(result.files[0].excerpt).toContain('export const A');
    // diagnose nie tworzy commitów ani nie zmienia plików
    expect(fs.readFileSync(path.join(repoRoot, 'backend/src/video/wanConfig.js'), 'utf8')).toContain('export const A = 1;');
  });

  test('blocks reading .env (secret)', () => {
    const engine = createRepairEngine({ repoRoot });
    const result = engine.diagnose({ problem: 'leak', files: ['backend/.env'] });
    expect(result.files).toHaveLength(0);
    expect(result.blocked[0].path).toBe('backend/.env');
  });
});

describe('systemAgent engine: proposeRepair', () => {
  let repoRoot;
  let testDir;
  beforeAll(() => {
    repoRoot = makeRepo();
    testDir = createTestDatabase().dir;
  });
  afterAll(() => {
    fs.rmSync(repoRoot, { recursive: true, force: true });
    destroyTestDatabase(testDir);
  });

  test('captures before/diff and stores proposed entry without touching disk', () => {
    const engine = createRepairEngine({ repoRoot });
    const repair = engine.proposeRepair({
      title: 'Bump B',
      problem: 'B should be 3',
      changes: [{ path: 'backend/src/video/wanConfig.js', after: 'export const A = 1;\nexport const B = 3;\n' }],
    });
    expect(repair.status).toBe('proposed');
    expect(repair.files[0].before).toContain('export const B = 2;');
    expect(repair.files[0].after).toContain('export const B = 3;');
    expect(repair.diff_text).toContain('+ export const B = 3;');
    // dysk nietknięty (apply jest osobnym krokiem)
    expect(fs.readFileSync(path.join(repoRoot, 'backend/src/video/wanConfig.js'), 'utf8')).toContain('export const B = 2;');
  });

  test('guard blocks golden file proposal', () => {
    const engine = createRepairEngine({ repoRoot });
    expect(() => engine.proposeRepair({
      title: 'hack',
      changes: [{ path: 'backend/src/video/runComfyEngine.js', after: 'x' }],
    })).toThrow(/Poręcz/);
  });
});

describe('systemAgent engine: applyRepair (test gate + rollback)', () => {
  let repoRoot;
  let testDir;
  const target = 'backend/src/video/wanConfig.js';

  function fakeGit() {
    return {
      getHeadSha: () => 'base-sha',
      isClean: () => true,
      commitPaths: () => 'apply-sha',
      restorePaths: () => {},
    };
  }

  beforeAll(() => { testDir = createTestDatabase().dir; });
  afterAll(() => { destroyTestDatabase(testDir); });
  beforeEach(() => { repoRoot = makeRepo(); });
  afterEach(() => { fs.rmSync(repoRoot, { recursive: true, force: true }); });

  test('green tests → writes file + commits + status applied', () => {
    const engine = createRepairEngine({
      repoRoot,
      git: fakeGit(),
      runTests: () => ({ ok: true, summary: '130 passed' }),
    });
    const repair = engine.proposeRepair({
      title: 'Bump B to 3',
      changes: [{ path: target, after: 'export const A = 1;\nexport const B = 3;\n' }],
    });
    const result = engine.applyRepair(repair.id);

    expect(result.applied).toBe(true);
    expect(result.status).toBe('applied');
    expect(result.apply_commit_sha).toBe('apply-sha');
    expect(fs.readFileSync(path.join(repoRoot, target), 'utf8')).toContain('export const B = 3;');
  });

  test('red tests → auto-rollback to before + status rolled_back', () => {
    const engine = createRepairEngine({
      repoRoot,
      git: fakeGit(),
      runTests: () => ({ ok: false, summary: '1 failed, 129 passed' }),
    });
    const repair = engine.proposeRepair({
      title: 'Break B',
      changes: [{ path: target, after: 'export const A = 1;\nexport const B = BROKEN;\n' }],
    });
    const result = engine.applyRepair(repair.id);

    expect(result.applied).toBe(false);
    expect(result.status).toBe('rolled_back');
    // plik wrócił do stanu sprzed apply (auto-rollback)
    expect(fs.readFileSync(path.join(repoRoot, target), 'utf8')).toContain('export const B = 2;');
    expect(fs.readFileSync(path.join(repoRoot, target), 'utf8')).not.toContain('BROKEN');
  });

  test('apply twice is rejected (status no longer proposed)', () => {
    const engine = createRepairEngine({
      repoRoot,
      git: fakeGit(),
      runTests: () => ({ ok: true, summary: 'ok' }),
    });
    const repair = engine.proposeRepair({
      title: 'Once',
      changes: [{ path: target, after: 'export const A = 1;\nexport const B = 9;\n' }],
    });
    engine.applyRepair(repair.id);
    expect(() => engine.applyRepair(repair.id)).toThrow(/proposed/);
  });

  test('undo after applied restores before + status reverted', () => {
    const engine = createRepairEngine({
      repoRoot,
      git: fakeGit(),
      runTests: () => ({ ok: true, summary: 'ok' }),
    });
    const repair = engine.proposeRepair({
      title: 'Bump then undo',
      changes: [{ path: target, after: 'export const A = 1;\nexport const B = 7;\n' }],
    });
    engine.applyRepair(repair.id);
    expect(fs.readFileSync(path.join(repoRoot, target), 'utf8')).toContain('export const B = 7;');

    const reverted = engine.undoRepair(repair.id);
    expect(reverted.status).toBe('reverted');
    expect(fs.readFileSync(path.join(repoRoot, target), 'utf8')).toContain('export const B = 2;');
    // nie można cofnąć drugi raz
    expect(() => engine.undoRepair(repair.id)).toThrow(/applied/);
  });
});
