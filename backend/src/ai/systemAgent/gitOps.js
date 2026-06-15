import { execFileSync } from 'node:child_process';

/** Cienki wrapper na git dla checkpointów AI-Inżyniera. Iniektowalny w testach. */

function git(repoRoot, args) {
  return execFileSync('git', args, {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

export function createGitOps(repoRoot) {
  return {
    getHeadSha() {
      return git(repoRoot, ['rev-parse', 'HEAD']);
    },
    /** Czy ścieżki mają niezacommitowane zmiany (przed apply musi być czysto). */
    isClean(paths = []) {
      const args = ['status', '--porcelain', '--', ...paths];
      return git(repoRoot, paths.length ? args : ['status', '--porcelain']) === '';
    },
    commitPaths(paths, message) {
      git(repoRoot, ['add', '--', ...paths]);
      git(repoRoot, ['commit', '-m', message]);
      return git(repoRoot, ['rev-parse', 'HEAD']);
    },
    /** Cofa zmiany w drzewie roboczym dla ścieżek (rollback bez commita). */
    restorePaths(paths) {
      if (!paths.length) return;
      git(repoRoot, ['checkout', '--', ...paths]);
    },
  };
}
