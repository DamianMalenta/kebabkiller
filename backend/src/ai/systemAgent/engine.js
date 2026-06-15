import nodeFs from 'node:fs';
import path from 'node:path';
import {
  assertWritePaths,
  classifyReadPath,
  toRepoRelative,
} from './pathGuard.js';
import { buildChangeSetDiff } from './diffUtil.js';
import { createRepair, getRepair, updateRepair } from './repairJournal.js';
import { createGitOps } from './gitOps.js';
import { runBackendTests } from './testRunner.js';

/**
 * Silnik pętli naprawczej AI-Inżyniera. Rdzeń jest deterministyczny i iniektowalny
 * (fs/git/runTests) — warstwa LLM (proponowanie diffu) jest opcjonalna i wpinana z zewnątrz.
 */
export function createRepairEngine({ repoRoot, fs = nodeFs, git, runTests } = {}) {
  if (!repoRoot) throw new Error('createRepairEngine: brak repoRoot.');
  const gitOps = git || createGitOps(repoRoot);
  const testGate = runTests || (() => runBackendTests(repoRoot));

  function absOf(rel) {
    return path.resolve(repoRoot, rel);
  }

  function writeFileEnsured(rel, content) {
    const abs = absOf(rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content, 'utf8');
  }

  /** Przywraca pliki do stanu `before` (lub kasuje nowo utworzone). */
  function restoreFiles(files) {
    for (const f of files) {
      const abs = absOf(f.path);
      if (f.before === null || f.before === undefined) {
        if (fs.existsSync(abs)) fs.rmSync(abs);
      } else {
        writeFileEnsured(f.path, f.before);
      }
    }
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

  /**
   * Zastosowanie naprawy: checkpoint git → zapis → bramka testów.
   * Zielono → commit + status 'applied'. Czerwono → auto-rollback + status 'rolled_back'.
   */
  function applyRepair(id) {
    const repair = getRepair(id);
    if (!repair) throw new Error(`Naprawa ${id} nie istnieje.`);
    if (repair.status !== 'proposed') {
      throw new Error(`Naprawa ${id} ma status '${repair.status}' — apply wymaga 'proposed'.`);
    }

    const paths = repair.files.map((f) => f.path);
    const guard = assertWritePaths(repoRoot, paths);
    if (!guard.allowed) {
      updateRepair(id, { status: 'rejected', error: `${guard.path}: ${guard.reason}` });
      const err = new Error(`Poręcz zablokowała apply: ${guard.path} — ${guard.reason}`);
      err.guard = guard;
      throw err;
    }

    // Checkpoint: drzewo robocze dla tych plików musi być czyste (nie nadpisujemy ręcznych zmian).
    if (!gitOps.isClean(paths)) {
      updateRepair(id, { status: 'failed', error: 'Niezacommitowane zmiany w plikach docelowych.' });
      throw new Error('Apply przerwane: pliki docelowe mają niezacommitowane zmiany. Zacommituj/wycofaj je najpierw.');
    }
    const baseSha = safeHead();

    for (const f of repair.files) writeFileEnsured(f.path, f.after);

    let gate;
    try {
      gate = testGate();
    } catch (err) {
      restoreFiles(repair.files);
      updateRepair(id, { status: 'rolled_back', base_sha: baseSha, error: `Bramka testów rzuciła: ${err.message}` });
      throw err;
    }

    if (!gate.ok) {
      restoreFiles(repair.files);
      const updated = updateRepair(id, {
        status: 'rolled_back',
        base_sha: baseSha,
        test_summary: gate.summary || 'failed',
        error: 'Testy czerwone — auto-rollback.',
      });
      return { ...updated, applied: false, gate };
    }

    let applyCommitSha = null;
    try {
      applyCommitSha = gitOps.commitPaths(paths, `system-agent: ${repair.title}`);
    } catch (err) {
      // Commit się nie udał, ale testy zielone — zostaw pliki, oznacz applied bez sha.
      applyCommitSha = null;
      console.warn('[systemAgent] commit checkpoint nieudany:', err.message);
    }

    const updated = updateRepair(id, {
      status: 'applied',
      base_sha: baseSha,
      apply_commit_sha: applyCommitSha,
      test_summary: gate.summary || 'passed',
      error: null,
    });
    return { ...updated, applied: true, gate };
  }

  function safeHead() {
    try {
      return gitOps.getHeadSha();
    } catch {
      return null;
    }
  }

  /** Ręczny [Cofnij]: przywraca pliki do stanu 'before' i commituje rewert. */
  function undoRepair(id) {
    const repair = getRepair(id);
    if (!repair) throw new Error(`Naprawa ${id} nie istnieje.`);
    if (repair.status !== 'applied') {
      throw new Error(`Cofnąć można tylko naprawę 'applied' (jest '${repair.status}').`);
    }

    restoreFiles(repair.files);

    const paths = repair.files.map((f) => f.path);
    let revertSha = null;
    try {
      revertSha = gitOps.commitPaths(paths, `system-agent: revert ${repair.title}`);
    } catch (err) {
      console.warn('[systemAgent] commit rewertu nieudany:', err.message);
    }

    return updateRepair(id, { status: 'reverted', apply_commit_sha: revertSha || repair.apply_commit_sha });
  }

  return { diagnose, proposeRepair, applyRepair, undoRepair, restoreFiles, repoRoot };
}
