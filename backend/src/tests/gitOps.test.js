import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createGitOps } from '../ai/systemAgent/gitOps.js';

function makeGitRepo() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kk-gitops-'));
  execFileSync('git', ['init'], { cwd: root });
  execFileSync('git', ['config', 'user.email', 'test@test.com'], { cwd: root });
  execFileSync('git', ['config', 'user.name', 'Test'], { cwd: root });
  fs.writeFileSync(path.join(root, 'file.txt'), 'initial content\n');
  execFileSync('git', ['add', '.'], { cwd: root });
  execFileSync('git', ['commit', '-m', 'initial'], { cwd: root });
  return root;
}

describe('createGitOps', () => {
  let repoRoot;

  beforeAll(() => {
    repoRoot = makeGitRepo();
  });

  afterAll(() => {
    fs.rmSync(repoRoot, { recursive: true, force: true });
  });

  test('getHeadSha returns a 40-char hex SHA', () => {
    const ops = createGitOps(repoRoot);
    const sha = ops.getHeadSha();
    expect(sha).toMatch(/^[0-9a-f]{40}$/);
  });

  test('isClean returns true for clean repo', () => {
    const ops = createGitOps(repoRoot);
    expect(ops.isClean()).toBe(true);
    expect(ops.isClean(['file.txt'])).toBe(true);
  });

  test('isClean returns false after modifying a tracked file', () => {
    const ops = createGitOps(repoRoot);
    fs.writeFileSync(path.join(repoRoot, 'file.txt'), 'modified content\n');
    expect(ops.isClean()).toBe(false);
    expect(ops.isClean(['file.txt'])).toBe(false);
    // restore
    execFileSync('git', ['checkout', '--', 'file.txt'], { cwd: repoRoot });
  });

  test('commitPaths stages and commits, returns new SHA', () => {
    const ops = createGitOps(repoRoot);
    const beforeSha = ops.getHeadSha();

    fs.writeFileSync(path.join(repoRoot, 'file.txt'), 'committed change\n');
    const newSha = ops.commitPaths(['file.txt'], 'test commit');

    expect(newSha).toMatch(/^[0-9a-f]{40}$/);
    expect(newSha).not.toBe(beforeSha);
    expect(ops.isClean()).toBe(true);
  });

  test('restorePaths reverts uncommitted changes', () => {
    const ops = createGitOps(repoRoot);
    fs.writeFileSync(path.join(repoRoot, 'file.txt'), 'dirty content\n');
    expect(ops.isClean(['file.txt'])).toBe(false);

    ops.restorePaths(['file.txt']);
    expect(ops.isClean(['file.txt'])).toBe(true);
    expect(fs.readFileSync(path.join(repoRoot, 'file.txt'), 'utf8')).toBe('committed change\n');
  });

  test('restorePaths with empty array does nothing', () => {
    const ops = createGitOps(repoRoot);
    // Should not throw
    ops.restorePaths([]);
    expect(ops.isClean()).toBe(true);
  });
});
