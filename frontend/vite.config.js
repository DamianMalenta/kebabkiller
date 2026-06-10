import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { backendBaseUrl, readBackendPort } from '../scripts/read-backend-port.mjs';

const backendPort = readBackendPort();
const backendTarget = backendBaseUrl(backendPort);

console.log(`[vite] Proxy /api, /uploads, /output → ${backendTarget}`);

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/api': backendTarget,
      '/uploads': backendTarget,
      '/output': backendTarget,
    },
  },
});
