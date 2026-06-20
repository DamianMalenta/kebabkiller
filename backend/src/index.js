import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { initDatabase } from './db/init.js';
import { createApiRouter } from './api/routes.js';
import { createVideoEngine } from './video/mockEngine.js';
import { recoverVideoJobsOnStartup } from './video/queue.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const PORT = Number(process.env.PORT) || 4000;
const FRONTEND_PORT = Number(process.env.FRONTEND_PORT) || 5174;
const DATABASE_PATH = path.resolve(ROOT, process.env.DATABASE_PATH || './data/studio.db');
const UPLOADS_DIR = path.resolve(ROOT, process.env.UPLOADS_DIR || './uploads');
const OUTPUT_DIR = path.resolve(ROOT, process.env.OUTPUT_DIR || './output');

try {
  initDatabase(DATABASE_PATH);
} catch (err) {
  console.error('[Kebabkiller Studio] Failed to initialize database:', err.message);
  process.exit(1);
}

const videoEngine = createVideoEngine({
  VIDEO_ENGINE: process.env.VIDEO_ENGINE,
  OUTPUT_DIR,
  UPLOADS_DIR,
  RUNCOMFY_API_KEY: process.env.RUNCOMFY_API_KEY,
  RUNCOMFY_ENDPOINT: process.env.RUNCOMFY_ENDPOINT,
});

const recovery = recoverVideoJobsOnStartup(videoEngine);
if (recovery.interrupted || recovery.requeued) {
  console.log(
    `[VideoQueue] Recovery: ${recovery.interrupted} interrupted → failed, ${recovery.requeued} pending re-enqueued`,
  );
}

const app = express();

// Security headers
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

app.use(cors({
  origin: [
    `http://localhost:${FRONTEND_PORT}`,
    `http://127.0.0.1:${FRONTEND_PORT}`,
  ],
}));

// Rate limiting — 200 requests per minute per IP (after CORS so 429s include CORS headers)
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});
app.use('/api', limiter);
app.use(express.json({ limit: '2mb' }));
app.use('/uploads', express.static(UPLOADS_DIR));
app.use('/output', express.static(OUTPUT_DIR));

app.use('/api', createApiRouter({
  videoEngine,
  uploadsDir: UPLOADS_DIR,
  outputDir: OUTPUT_DIR,
}));

// Global error handler — prevent leaking internal details to clients
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  // Multer file-filter errors
  if (err.message && err.message.includes('is not allowed')) {
    return res.status(415).json({ error: err.message });
  }
  console.error('[Kebabkiller Studio] Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`[Kebabkiller Studio] Backend running on http://localhost:${PORT}`);
  console.log(`[Kebabkiller Studio] Video engine: ${videoEngine.name}`);
  console.log(`[Kebabkiller Studio] Database: ${DATABASE_PATH}`);
});
