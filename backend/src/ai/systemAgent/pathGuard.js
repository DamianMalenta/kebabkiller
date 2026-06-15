import path from 'node:path';

/**
 * Poręcze bezpieczeństwa AI-Inżyniera (docs/11 sekcja B).
 * Zasada: deny-by-default. Zapis tylko do whitelisty; NIGDY .env, sekrety,
 * złote pliki ani gema-0. Edycje fabuły/scen → odsyłka do Scenarzysty.
 */

/** Złote pliki — nie kasować/przepisywać hurtem przez autonom (docs/11 B). */
export const GOLDEN_FILES = [
  'backend/src/ai/director.js',
  'backend/src/video/mockEngine.js',
  'backend/src/video/runComfyEngine.js',
];

/** Domena Scenarzysty — fabuła/sceny należą do osobnego toru, nie do AI-Inżyniera. */
export const SCREENWRITER_DOMAIN = [
  'backend/src/ai/screenwriter.js',
];

/** Korzenie z prawem zapisu (po odjęciu blocklisty poniżej). */
export const WRITE_ALLOW_ROOTS = [
  'backend/src/',
  'frontend/src/',
];

const SECRET_PATTERNS = [
  /(^|\/)\.env(\.|$)/i,
  /(^|\/)secrets?(\/|\.|$)/i,
  /(^|\/)credentials?(\/|\.|$)/i,
  /\.(pem|key|p12|pfx)$/i,
  /(^|\/)id_rsa(\b|$)/i,
];

const HARD_DENY_ROOTS = [
  'gema-0/',
  '.git/',
  'node_modules/',
];

/** Normalizuje do ścieżki względnej repo z separatorami POSIX. */
export function toRepoRelative(repoRoot, target) {
  const abs = path.isAbsolute(target) ? target : path.resolve(repoRoot, target);
  const rel = path.relative(repoRoot, abs);
  return rel.split(path.sep).join('/');
}

/**
 * Klasyfikuje ścieżkę pod kątem prawa zapisu.
 * @returns {{ allowed: boolean, reason: string, category: string }}
 */
export function classifyWritePath(repoRoot, target) {
  const rel = toRepoRelative(repoRoot, target);

  if (rel.startsWith('../') || rel === '' || path.isAbsolute(rel)) {
    return { allowed: false, reason: 'Ścieżka poza repozytorium.', category: 'outside_repo' };
  }

  if (SECRET_PATTERNS.some((re) => re.test(rel))) {
    return { allowed: false, reason: 'Sekrety/.env są zabronione dla AI-Inżyniera.', category: 'secret' };
  }

  if (HARD_DENY_ROOTS.some((root) => rel === root.replace(/\/$/, '') || rel.startsWith(root))) {
    return { allowed: false, reason: `Katalog poza zasięgiem (${rel.split('/')[0]}).`, category: 'hard_deny' };
  }

  if (GOLDEN_FILES.includes(rel)) {
    return { allowed: false, reason: 'Złoty plik — nie przepisywać hurtem (zmiany tylko ręcznie/fazowo).', category: 'golden' };
  }

  if (SCREENWRITER_DOMAIN.includes(rel)) {
    return { allowed: false, reason: 'Fabuła/sceny należą do Scenarzysty, nie do AI-Inżyniera.', category: 'screenwriter' };
  }

  if (!WRITE_ALLOW_ROOTS.some((root) => rel.startsWith(root))) {
    return { allowed: false, reason: 'Poza whitelistą zapisu (dozwolone: backend/src, frontend/src).', category: 'not_whitelisted' };
  }

  return { allowed: true, reason: 'OK', category: 'allowed' };
}

/**
 * Klasyfikuje ścieżkę pod kątem ODCZYTU (diagnoza read-only).
 * Czytać wolno szerzej niż pisać (np. złote pliki, by je zrozumieć),
 * ale NIGDY sekretów/.env ani spoza repo/gema-0.
 */
export function classifyReadPath(repoRoot, target) {
  const rel = toRepoRelative(repoRoot, target);

  if (rel.startsWith('../') || rel === '' || path.isAbsolute(rel)) {
    return { allowed: false, reason: 'Ścieżka poza repozytorium.', category: 'outside_repo' };
  }
  if (SECRET_PATTERNS.some((re) => re.test(rel))) {
    return { allowed: false, reason: 'Sekrety/.env są zabronione (także do odczytu).', category: 'secret' };
  }
  if (HARD_DENY_ROOTS.some((root) => rel === root.replace(/\/$/, '') || rel.startsWith(root))) {
    return { allowed: false, reason: `Katalog poza zasięgiem (${rel.split('/')[0]}).`, category: 'hard_deny' };
  }
  return { allowed: true, reason: 'OK', category: 'allowed' };
}

/** Bramka dla listy plików — zwraca pierwszą blokadę albo { allowed:true }. */
export function assertWritePaths(repoRoot, targets) {
  for (const target of targets) {
    const verdict = classifyWritePath(repoRoot, target);
    if (!verdict.allowed) {
      return { allowed: false, path: toRepoRelative(repoRoot, target), ...verdict };
    }
  }
  return { allowed: true };
}
