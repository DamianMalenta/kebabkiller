import { Router } from 'express';
import { getSystemAgentConfig, OWNER_TOKEN_HEADER } from './config.js';
import { GOLDEN_FILES, WRITE_ALLOW_ROOTS, classifyWritePath } from './pathGuard.js';
import { createRepairEngine } from './engine.js';

/**
 * Router AI-Inżyniera — osobny moduł /api/system-agent/*.
 * Dostęp TYLKO za tokenem właściciela (poza /health).
 */
export function createSystemAgentRouter() {
  const router = Router();

  // Publiczny: pozwala UI pokazać "ustaw token" bez wycieku czegokolwiek.
  router.get('/health', (_req, res) => {
    const { enabled } = getSystemAgentConfig();
    res.json({ ok: true, module: 'system-agent', enabled });
  });

  // Bramka tokenem właściciela na resztę.
  router.use((req, res, next) => {
    const { enabled, token } = getSystemAgentConfig();
    if (!enabled) {
      return res.status(503).json({
        error: 'AI-Inżynier wyłączony — ustaw SYSTEM_AGENT_TOKEN w backend/.env.',
      });
    }
    const provided = req.get(OWNER_TOKEN_HEADER);
    if (!provided || provided !== token) {
      return res.status(401).json({ error: 'Brak/nieprawidłowy token właściciela.' });
    }
    next();
  });

  router.get('/status', (_req, res) => {
    res.json({
      enabled: true,
      guard: {
        write_allow_roots: WRITE_ALLOW_ROOTS,
        golden_files: GOLDEN_FILES,
      },
    });
  });

  // Sprawdzenie poręczy dla ścieżki (diagnostyka guardrails, read-only).
  router.post('/check-path', (req, res) => {
    const target = req.body?.path;
    if (!target) return res.status(400).json({ error: 'Brak pola "path".' });
    const { repoRoot } = getSystemAgentConfig();
    res.json(classifyWritePath(repoRoot, target));
  });

  // Diagnoza READ-ONLY — czyta wskazane pliki, nic nie zapisuje.
  router.post('/diagnose', (req, res) => {
    const { repoRoot } = getSystemAgentConfig();
    const engine = createRepairEngine({ repoRoot });
    try {
      res.json(engine.diagnose({
        problem: req.body?.problem,
        files: Array.isArray(req.body?.files) ? req.body.files : [],
      }));
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // Propozycja naprawy — waliduje poręcze, zapisuje wpis 'proposed' (bez zapisu na dysk).
  router.post('/propose', (req, res) => {
    const { repoRoot } = getSystemAgentConfig();
    const engine = createRepairEngine({ repoRoot });
    try {
      const repair = engine.proposeRepair({
        title: req.body?.title,
        problem: req.body?.problem,
        diagnosis: req.body?.diagnosis,
        changes: Array.isArray(req.body?.changes) ? req.body.changes : [],
      });
      res.status(201).json(repair);
    } catch (err) {
      res.status(400).json({ error: err.message, guard: err.guard || null });
    }
  });

  // Zastosowanie naprawy — checkpoint → zapis → bramka testów → (commit | auto-rollback).
  router.post('/repairs/:id/apply', (req, res) => {
    const { repoRoot } = getSystemAgentConfig();
    const engine = createRepairEngine({ repoRoot });
    try {
      const result = engine.applyRepair(req.params.id);
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err.message, guard: err.guard || null });
    }
  });

  return router;
}
