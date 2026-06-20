#!/usr/bin/env node
import { backendBaseUrl, readBackendPort } from './read-backend-port.mjs';
import { readFrontendPort } from './read-frontend-port.mjs';
import { MACIUS_RESERVED, STUDIO2_DEV } from './dev-ports.mjs';

const backendPort = readBackendPort();
const frontendPort = readFrontendPort();
const backendTarget = backendBaseUrl(backendPort);

console.log('[Kebabkiller studio2] Backend:', backendPort, '→', backendTarget);
console.log('[Kebabkiller studio2] Frontend:', frontendPort);
console.log('[Kebabkiller studio2] Health:', `${backendTarget}/api/health`);
console.log('[Kebabkiller studio2] UI: http://localhost:' + frontendPort);

const maciusConflict =
  backendPort === MACIUS_RESERVED.backend ||
  backendPort === MACIUS_RESERVED.symbiont ||
  frontendPort === MACIUS_RESERVED.frontend ||
  frontendPort === MACIUS_RESERVED.backend;

if (maciusConflict) {
  console.error('');
  console.error('[Kebabkiller studio2] KONFLIKT z macius/Symbiont!');
  console.error(`  Zarezerwowane: backend ${MACIUS_RESERVED.backend}, frontend ${MACIUS_RESERVED.frontend}, symbiont ${MACIUS_RESERVED.symbiont}`);
  console.error(`  Ustaw w backend/.env: PORT=${STUDIO2_DEV.backend} i FRONTEND_PORT=${STUDIO2_DEV.frontend}`);
  process.exit(1);
}

if (backendPort !== STUDIO2_DEV.backend || frontendPort !== STUDIO2_DEV.frontend) {
  console.log('[Kebabkiller studio2] Uwaga: niestandardowe porty (oczekiwane', STUDIO2_DEV.backend + '/' + STUDIO2_DEV.frontend + ')');
}

console.log('[Kebabkiller studio2] Macius stack (:8787/:4001/:5173) — osobno, bez kolizji.');
