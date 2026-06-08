import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import {
  listCharacters,
  getCharacter,
  createCharacter,
  updateCharacter,
  deleteCharacter,
  listBackgrounds,
  getBackground,
  createBackground,
  updateBackground,
  deleteBackground,
  listRules,
  getRule,
  createRule,
  updateRule,
  deleteRule,
  listVideoJobs,
  getVideoJob,
  createVideoJob,
  getKnowledgeContext,
} from '../db/models.js';
import { expandScenePrompt, previewDirectorPlan, getLlmProviderStatus } from '../ai/director.js';
import { enqueueVideoJob } from '../video/queue.js';

export function createApiRouter({ videoEngine, uploadsDir }) {
  const router = Router();

  fs.mkdirSync(uploadsDir, { recursive: true });
  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsDir),
    filename: (_req, file, cb) => {
      const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
      cb(null, `${Date.now()}_${safe}`);
    },
  });
  const upload = multer({ storage, limits: { fileSize: 20 * 1024 * 1024 } });

  router.get('/health', (_req, res) => {
    res.json({
      ok: true,
      service: 'kebabkiller-studio-backend',
      llm: getLlmProviderStatus(),
    });
  });

  router.get('/knowledge', (_req, res) => {
    res.json(getKnowledgeContext());
  });

  // Characters
  router.get('/characters', (_req, res) => {
    res.json(listCharacters());
  });

  router.get('/characters/:id', (req, res) => {
    const item = getCharacter(req.params.id);
    if (!item) return res.status(404).json({ error: 'Character not found' });
    res.json(item);
  });

  router.post('/characters', upload.single('reference'), (req, res) => {
    try {
      const item = createCharacter({
        name: req.body.name,
        description: req.body.description,
        negativePrompt: req.body.negative_prompt,
        identityBlockEn: req.body.identity_block_en,
        referencePath: req.file ? `/uploads/${req.file.filename}` : null,
      });
      res.status(201).json(item);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.put('/characters/:id', upload.single('reference'), (req, res) => {
    const existing = getCharacter(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Character not found' });
    const item = updateCharacter(req.params.id, {
      name: req.body.name,
      description: req.body.description,
      negativePrompt: req.body.negative_prompt,
      identityBlockEn: req.body.identity_block_en,
      referencePath: req.file ? `/uploads/${req.file.filename}` : undefined,
    });
    res.json(item);
  });

  router.delete('/characters/:id', (req, res) => {
    if (!deleteCharacter(req.params.id)) {
      return res.status(404).json({ error: 'Character not found' });
    }
    res.status(204).end();
  });

  // Backgrounds
  router.get('/backgrounds', (_req, res) => {
    res.json(listBackgrounds());
  });

  router.get('/backgrounds/:id', (req, res) => {
    const item = getBackground(req.params.id);
    if (!item) return res.status(404).json({ error: 'Background not found' });
    res.json(item);
  });

  router.post('/backgrounds', upload.single('reference'), (req, res) => {
    try {
      const item = createBackground({
        name: req.body.name,
        description: req.body.description,
        environmentBlockEn: req.body.environment_block_en,
        referencePath: req.file ? `/uploads/${req.file.filename}` : null,
      });
      res.status(201).json(item);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.put('/backgrounds/:id', upload.single('reference'), (req, res) => {
    const existing = getBackground(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Background not found' });
    const item = updateBackground(req.params.id, {
      name: req.body.name,
      description: req.body.description,
      environmentBlockEn: req.body.environment_block_en,
      referencePath: req.file ? `/uploads/${req.file.filename}` : undefined,
    });
    res.json(item);
  });

  router.delete('/backgrounds/:id', (req, res) => {
    if (!deleteBackground(req.params.id)) {
      return res.status(404).json({ error: 'Background not found' });
    }
    res.status(204).end();
  });

  // Rules (Księga Praw)
  router.get('/rules', (req, res) => {
    const activeOnly = req.query.active === '1';
    res.json(listRules({ activeOnly }));
  });

  router.get('/rules/:id', (req, res) => {
    const item = getRule(req.params.id);
    if (!item) return res.status(404).json({ error: 'Rule not found' });
    res.json(item);
  });

  router.post('/rules', (req, res) => {
    try {
      const item = createRule(req.body);
      res.status(201).json(item);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.put('/rules/:id', (req, res) => {
    const existing = getRule(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Rule not found' });
    const item = updateRule(req.params.id, req.body);
    res.json(item);
  });

  router.delete('/rules/:id', (req, res) => {
    if (!deleteRule(req.params.id)) {
      return res.status(404).json({ error: 'Rule not found' });
    }
    res.status(204).end();
  });

  // AI Director preview
  router.post('/director/preview', async (req, res) => {
    try {
      const { prompt, character_id, background_id } = req.body;
      if (!prompt?.trim()) {
        return res.status(400).json({ error: 'prompt is required' });
      }
      const plan = await previewDirectorPlan(prompt, {
        characterId: character_id,
        backgroundId: background_id,
      });
      res.json(plan);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Video jobs
  router.get('/jobs', (_req, res) => {
    res.json(listVideoJobs());
  });

  router.get('/jobs/:id', (req, res) => {
    const job = getVideoJob(req.params.id);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    res.json({
      ...job,
      director_json: job.director_json ? JSON.parse(job.director_json) : null,
    });
  });

  router.post('/jobs', async (req, res) => {
    try {
      const { prompt, character_id, background_id, director_plan, skip_preview } = req.body;
      if (!prompt?.trim()) {
        return res.status(400).json({ error: 'prompt is required' });
      }

      let plan = director_plan;
      if (!plan && !skip_preview) {
        plan = await expandScenePrompt(prompt, { characterId: character_id, backgroundId: background_id });
      }

      const job = createVideoJob({
        userPrompt: prompt,
        characterId: character_id,
        backgroundId: background_id,
        directorJson: plan,
        renderStrategy: plan?.render_strategy || 'native_i2v',
      });

      enqueueVideoJob({ ...job, director_json: plan }, videoEngine);

      res.status(201).json({
        ...job,
        director_json: plan,
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/jobs/:id/download', (req, res) => {
    const job = getVideoJob(req.params.id);
    if (!job?.output_path) {
      return res.status(404).json({ error: 'Output not ready' });
    }
    const filePath = path.isAbsolute(job.output_path)
      ? job.output_path
      : path.join(process.cwd(), job.output_path.replace(/^\//, ''));
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Output file missing' });
    }
    const ext = path.extname(filePath).toLowerCase();
    const contentTypes = {
      '.webm': 'video/webm',
      '.webp': 'image/webp',
      '.mp4': 'video/mp4',
      '.gif': 'image/gif',
    };
    if (contentTypes[ext]) {
      res.setHeader('Content-Type', contentTypes[ext]);
    }
    res.download(filePath);
  });

  return router;
}
