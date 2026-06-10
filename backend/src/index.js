import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { initDatabase } from './db/init.js';
import { createApiRouter } from './api/routes.js';
import { createVideoEngine } from './video/mockEngine.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const PORT = Number(process.env.PORT) || 4000;
const DATABASE_PATH = path.resolve(ROOT, process.env.DATABASE_PATH || './data/studio.db');
const UPLOADS_DIR = path.resolve(ROOT, process.env.UPLOADS_DIR || './uploads');
const OUTPUT_DIR = path.resolve(ROOT, process.env.OUTPUT_DIR || './output');

initDatabase(DATABASE_PATH);

const videoEngine = createVideoEngine({
  VIDEO_ENGINE: process.env.VIDEO_ENGINE,
  OUTPUT_DIR,
  UPLOADS_DIR,
  RUNCOMFY_API_KEY: process.env.RUNCOMFY_API_KEY,
  RUNCOMFY_ENDPOINT: process.env.RUNCOMFY_ENDPOINT,
});

const app = express();
app.use(cors({ origin: ['http://localhost:5173', 'http://127.0.0.1:5173'] }));
app.use(express.json({ limit: '2mb' }));
app.use('/uploads', express.static(UPLOADS_DIR));
app.use('/output', express.static(OUTPUT_DIR));

app.use('/api', createApiRouter({
  videoEngine,
  uploadsDir: UPLOADS_DIR,
  outputDir: OUTPUT_DIR,
}));

app.listen(PORT, () => {
  console.log(`[Kebabkiller Studio] Backend running on http://localhost:${PORT}`);
  console.log(`[Kebabkiller Studio] Video engine: ${videoEngine.name}`);
  console.log(`[Kebabkiller Studio] Database: ${DATABASE_PATH}`);
});
