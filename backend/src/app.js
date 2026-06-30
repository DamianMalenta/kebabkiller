import express from 'express';
import cors from 'cors';
import { createApiRouter } from './api/routes.js';

export function createApp({ videoEngine, uploadsDir, outputDir }) {
  const frontendPort = Number(process.env.FRONTEND_PORT) || 5174;
  const app = express();
  app.use(cors({
    origin: [
      `http://localhost:${frontendPort}`,
      `http://127.0.0.1:${frontendPort}`,
    ],
  }));
  app.use(express.json({ limit: '2mb' }));
  app.use('/uploads', express.static(uploadsDir));
  app.use('/output', express.static(outputDir));
  app.use('/api', createApiRouter({ videoEngine, uploadsDir, outputDir }));
  return app;
}
