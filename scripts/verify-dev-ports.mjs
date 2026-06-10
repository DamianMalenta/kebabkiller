#!/usr/bin/env node
import { backendBaseUrl, readBackendPort } from './read-backend-port.mjs';

const port = readBackendPort();
const target = backendBaseUrl(port);

console.log('[Kebabkiller dev] Port backendu:', port);
console.log('[Kebabkiller dev] Vite proxy →', target);
console.log('[Kebabkiller dev] Health (po starcie backendu):', `${target}/api/health`);

if (port !== 4000) {
  console.log('[Kebabkiller dev] Uwaga: niestandardowy PORT — upewnij się, że backend/.env ma PORT=' + port);
}
