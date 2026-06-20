import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Repo root (…/kebabkiller). systemAgent → ai → src → backend → repo. */
export const REPO_ROOT = path.resolve(__dirname, '../../../../');

/**
 * AI-Inżynier bramka: dostęp TYLKO za tokenem właściciela (LAN/tunnel).
 * Token z `SYSTEM_AGENT_TOKEN` w backend/.env (tego pliku agent NIE dotyka).
 * Brak tokena = moduł wyłączony (każdy zapis odrzucony) — bezpieczne domyślne.
 */
export function getSystemAgentConfig() {
  const token = process.env.SYSTEM_AGENT_TOKEN?.trim() || null;
  return {
    token,
    enabled: Boolean(token),
    repoRoot: REPO_ROOT,
  };
}

export const OWNER_TOKEN_HEADER = 'x-owner-token';
