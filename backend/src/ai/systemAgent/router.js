import { Router } from 'express';
import { getSystemAgentConfig, OWNER_TOKEN_HEADER } from './config.js';
import { GOLDEN_FILES, WRITE_ALLOW_ROOTS, classifyWritePath } from './pathGuard.js';

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

  return router;
}
