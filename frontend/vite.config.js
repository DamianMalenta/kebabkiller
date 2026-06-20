import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { backendBaseUrl, readBackendPort } from '../scripts/read-backend-port.mjs';
import { readFrontendPort } from '../scripts/read-frontend-port.mjs';

const backendPort = readBackendPort();
const backendTarget = backendBaseUrl(backendPort);
const frontendPort = readFrontendPort();

console.log(`[vite] Studio2 frontend :${frontendPort} → proxy /api → ${backendTarget}`);

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true,
    port: frontendPort,
    strictPort: true,
    allowedHosts: true,
    proxy: {
      '/api': backendTarget,
      '/uploads': backendTarget,
      '/output': backendTarget,
    },
  },
});
