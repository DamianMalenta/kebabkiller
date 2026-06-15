import nodeFs from 'node:fs';
import path from 'node:path';
import {
  assertWritePaths,
  classifyReadPath,
  toRepoRelative,
} from './pathGuard.js';
import { buildChangeSetDiff } from './diffUtil.js';
import { createRepair } from './repairJournal.js';

/**
 * Silnik pętli naprawczej AI-Inżyniera. Rdzeń jest deterministyczny i iniektowalny
 * (fs/git/runTests) — warstwa LLM (proponowanie diffu) jest opcjonalna i wpinana z zewnątrz.
 */
export function createRepairEngine({ repoRoot, fs = nodeFs } = {}) {
  if (!repoRoot) throw new Error('createRepairEngine: brak repoRoot.');

  function absOf(rel) {
    return path.resolve(repoRoot, rel);
  }

  function readFileSafe(rel) {
    const abs = absOf(rel);
    if (!fs.existsSync(abs)) return null;
    return fs.readFileSync(abs, 'utf8');
  }

  /** Diagnoza READ-ONLY: czyta wskazane pliki, nic nie zapisuje. */
  function diagnose({ problem, files = [] }) {
    const blocked = [];
    const readFiles = [];

    for (const target of files) {
      const verdict = classifyReadPath(repoRoot, target);
      const rel = toRepoRelative(repoRoot, target);
      if (!verdict.allowed) {
        blocked.push({ path: rel, reason: verdict.reason });
        continue;
      }
      const content = readFileSafe(rel);
      readFiles.push({
        path: rel,
        exists: content !== null,
        lineCount: content === null ? 0 : content.split('\n').length,
        excerpt: content === null ? null : content.slice(0, 2000),
      });
    }

    return {
      problem: problem || '',
      readOnly: true,
      files: readFiles,
      blocked,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Propozycja naprawy: waliduje poręcze, liczy before/diff, zapisuje wpis 'proposed'.
   * NIE pisze na dysk (apply jest osobnym, świadomym krokiem).
   */
  function proposeRepair({ title, problem, diagnosis = null, changes = [] }) {
    if (!Array.isArray(changes) || changes.length === 0) {
      throw new Error('proposeRepair: brak zmian (changes).');
    }

    const targets = changes.map((c) => c.path);
    const guard = assertWritePaths(repoRoot, targets);
    if (!guard.allowed) {
      const err = new Error(`Poręcz zablokowała zapis: ${guard.path} — ${guard.reason}`);
      err.guard = guard;
      throw err;
    }

    const files = changes.map((c) => {
      const rel = toRepoRelative(repoRoot, c.path);
      if (typeof c.after !== 'string') {
        throw new Error(`proposeRepair: pole "after" musi być stringiem (${rel}).`);
      }
      return { path: rel, before: readFileSafe(rel), after: c.after };
    });

    const diffText = buildChangeSetDiff(files);

    return createRepair({
      title: title || 'Naprawa AI-Inżyniera',
      problem: problem || '',
      diagnosis: typeof diagnosis === 'string' ? diagnosis : diagnosis ? JSON.stringify(diagnosis) : null,
      files,
      diffText,
    });
  }

  return { diagnose, proposeRepair, repoRoot };
}
