import { spawnSync } from 'node:child_process';

/**
 * Domyślna bramka testów: uruchamia `npm test --prefix backend` w repo.
 * Iniektowalna w testach (żeby nie odpalać Jest rekurencyjnie).
 */
export function runBackendTests(repoRoot) {
  const result = spawnSync('npm', ['test', '--prefix', 'backend'], {
    cwd: repoRoot,
    encoding: 'utf8',
    shell: true,
    timeout: 5 * 60 * 1000,
  });

  const output = `${result.stdout || ''}\n${result.stderr || ''}`;
  const match = output.match(/Tests:\s+(.+)/);
  return {
    ok: result.status === 0,
    summary: match ? match[1].trim() : (result.status === 0 ? 'passed' : 'failed'),
    exitCode: result.status,
  };
}
