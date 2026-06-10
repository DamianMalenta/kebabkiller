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
import { assistEpisodePlan } from '../ai/screenwriter.js';
import {
  listAssets,
  getAsset,
  createAsset,
  updateAsset,
  deleteAsset,
  addAssetImage,
  deleteAssetImage,
  listEpisodePlans,
  getEpisodePlan,
  createEpisodePlan,
  updateEpisodePlan,
  deleteEpisodePlan,
  replacePlanScenes,
  upsertPlanScene,
  deletePlanScene,
  createPlanDeliverable,
  resolvePlanDeliverable,
  deletePlanDeliverable,
  validateEpisodePlan,
  acceptEpisodePlan,
} from '../db/episodeModels.js';
import {
  getLatestProductionRun,
  listProductionRuns,
  getProductionRun,
} from '../db/productionModels.js';
import { enqueueVideoJob } from '../video/queue.js';
import { enqueueEpisodeProduction } from '../video/productionQueue.js';

export function createApiRouter({ videoEngine, uploadsDir, outputDir }) {
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

  // F1: Catalog (unified assets)
  router.get('/assets', (req, res) => {
    res.json(listAssets({ type: req.query.type }));
  });

  router.get('/assets/:id', (req, res) => {
    const item = getAsset(req.params.id);
    if (!item) return res.status(404).json({ error: 'Asset not found' });
    res.json(item);
  });

  router.post('/assets', upload.single('image'), (req, res) => {
    try {
      const item = createAsset({
        type: req.body.type || 'prop',
        name: req.body.name,
        descriptionPl: req.body.description_pl,
        canonEn: req.body.canon_en,
      });
      if (req.file) {
        addAssetImage(item.id, {
          path: `/uploads/${req.file.filename}`,
          label: req.body.image_label || 'primary',
          isPrimary: true,
        });
      }
      res.status(201).json(getAsset(item.id));
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.put('/assets/:id', upload.single('image'), (req, res) => {
    const existing = getAsset(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Asset not found' });
    updateAsset(req.params.id, {
      type: req.body.type,
      name: req.body.name,
      descriptionPl: req.body.description_pl,
      canonEn: req.body.canon_en,
    });
    if (req.file) {
      addAssetImage(req.params.id, {
        path: `/uploads/${req.file.filename}`,
        label: req.body.image_label || 'upload',
        isPrimary: req.body.is_primary === '1',
      });
    }
    res.json(getAsset(req.params.id));
  });

  router.delete('/assets/:id', (req, res) => {
    if (!deleteAsset(req.params.id)) {
      return res.status(404).json({ error: 'Asset not found' });
    }
    res.status(204).end();
  });

  router.post('/assets/:id/images', upload.single('image'), (req, res) => {
    const existing = getAsset(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Asset not found' });
    if (!req.file) return res.status(400).json({ error: 'image file required' });
    const image = addAssetImage(req.params.id, {
      path: `/uploads/${req.file.filename}`,
      label: req.body.label,
      isPrimary: req.body.is_primary === '1',
    });
    res.status(201).json(image);
  });

  router.delete('/asset-images/:imageId', (req, res) => {
    if (!deleteAssetImage(req.params.imageId)) {
      return res.status(404).json({ error: 'Image not found' });
    }
    res.status(204).end();
  });

  // F1: Episode plans
  router.get('/episode-plans', (_req, res) => {
    res.json(listEpisodePlans());
  });

  router.get('/episode-plans/:id', (req, res) => {
    const plan = getEpisodePlan(req.params.id);
    if (!plan) return res.status(404).json({ error: 'Episode plan not found' });
    res.json(plan);
  });

  router.post('/episode-plans', (req, res) => {
    try {
      const plan = createEpisodePlan({
        code: req.body.code,
        title: req.body.title,
        logline: req.body.logline,
        preferences: req.body.preferences,
        targetDurationSec: req.body.target_duration_sec,
        catalogSelection: req.body.catalog_selection,
      });
      res.status(201).json(plan);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.put('/episode-plans/:id', (req, res) => {
    const existing = getEpisodePlan(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Episode plan not found' });
    const plan = updateEpisodePlan(req.params.id, {
      code: req.body.code,
      title: req.body.title,
      logline: req.body.logline,
      preferences: req.body.preferences,
      targetDurationSec: req.body.target_duration_sec,
      catalogSelection: req.body.catalog_selection,
      status: req.body.status,
    });
    res.json(plan);
  });

  router.delete('/episode-plans/:id', (req, res) => {
    if (!deleteEpisodePlan(req.params.id)) {
      return res.status(404).json({ error: 'Episode plan not found' });
    }
    res.status(204).end();
  });

  router.put('/episode-plans/:id/scenes', (req, res) => {
    const existing = getEpisodePlan(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Episode plan not found' });
    const scenes = replacePlanScenes(req.params.id, req.body.scenes || []);
    res.json({ scenes, plan: getEpisodePlan(req.params.id) });
  });

  router.post('/episode-plans/:id/scenes', (req, res) => {
    const existing = getEpisodePlan(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Episode plan not found' });
    const scene = upsertPlanScene(req.params.id, req.body);
    res.status(201).json({ scene, plan: getEpisodePlan(req.params.id) });
  });

  router.delete('/episode-plans/:planId/scenes/:sceneId', (req, res) => {
    if (!deletePlanScene(req.params.sceneId)) {
      return res.status(404).json({ error: 'Scene not found' });
    }
    res.json(getEpisodePlan(req.params.planId));
  });

  router.post('/episode-plans/:id/deliverables', (req, res) => {
    const existing = getEpisodePlan(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Episode plan not found' });
    const item = createPlanDeliverable(req.params.id, {
      description: req.body.description,
      planSceneId: req.body.plan_scene_id,
    });
    res.status(201).json({ deliverable: item, plan: getEpisodePlan(req.params.id) });
  });

  router.post('/deliverables/:id/resolve', upload.single('image'), async (req, res) => {
    try {
      const { asset_id, asset_type, asset_name, description_pl } = req.body;
      let assetImageId = req.body.asset_image_id;

      if (req.file && asset_id) {
        const image = addAssetImage(asset_id, {
          path: `/uploads/${req.file.filename}`,
          label: 'deliverable',
          isPrimary: true,
        });
        assetImageId = image.id;
      } else if (req.file && asset_name) {
        const asset = createAsset({
          type: asset_type || 'prop',
          name: asset_name,
          descriptionPl: description_pl || '',
        });
        const image = addAssetImage(asset.id, {
          path: `/uploads/${req.file.filename}`,
          isPrimary: true,
        });
        assetImageId = image.id;
      }

      if (!assetImageId) {
        return res.status(400).json({ error: 'asset_image_id or image upload required' });
      }

      const deliverable = resolvePlanDeliverable(req.params.id, assetImageId);
      if (!deliverable) return res.status(404).json({ error: 'Deliverable not found' });
      res.json({ deliverable, plan: getEpisodePlan(deliverable.episode_plan_id) });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.delete('/deliverables/:id', (req, res) => {
    const row = getEpisodePlan(req.body?.episode_plan_id);
    if (!deletePlanDeliverable(req.params.id)) {
      return res.status(404).json({ error: 'Deliverable not found' });
    }
    res.status(204).end();
  });

  router.get('/episode-plans/:id/validate', (req, res) => {
    const plan = getEpisodePlan(req.params.id);
    if (!plan) return res.status(404).json({ error: 'Episode plan not found' });
    res.json(validateEpisodePlan(req.params.id));
  });

  router.post('/episode-plans/:id/accept', (req, res) => {
    try {
      const plan = acceptEpisodePlan(req.params.id);
      const autoProduce = req.body?.start_production !== false;
      if (autoProduce) {
        enqueueEpisodeProduction(plan.id, videoEngine, outputDir);
      }
      res.json({
        ...plan,
        production_started: autoProduce,
      });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.post('/episode-plans/:id/produce', (req, res) => {
    try {
      const plan = getEpisodePlan(req.params.id);
      if (!plan) return res.status(404).json({ error: 'Episode plan not found' });
      if (!['zaakceptowany', 'gotowy', 'w_produkcji'].includes(plan.status)) {
        return res.status(400).json({ error: 'Plan musi być zaakceptowany przed produkcją.' });
      }
      enqueueEpisodeProduction(plan.id, videoEngine, outputDir);
      res.status(202).json({
        message: 'Produkcja uruchomiona.',
        plan_id: plan.id,
      });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.get('/episode-plans/:id/production', (req, res) => {
    const plan = getEpisodePlan(req.params.id);
    if (!plan) return res.status(404).json({ error: 'Episode plan not found' });
    const run = getLatestProductionRun(req.params.id);
    res.json({
      plan_id: plan.id,
      plan_status: plan.status,
      production: run,
      history: listProductionRuns(req.params.id),
    });
  });

  router.get('/production-runs/:id', (req, res) => {
    const run = getProductionRun(req.params.id);
    if (!run) return res.status(404).json({ error: 'Production run not found' });
    res.json(run);
  });

  router.post('/episode-plans/:id/assist', async (req, res) => {
    try {
      const { message, apply } = req.body;
      if (!message?.trim()) {
        return res.status(400).json({ error: 'message is required' });
      }
      const result = await assistEpisodePlan(req.params.id, message, { apply: Boolean(apply) });
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // AI Director preview
  router.post('/director/preview', async (req, res) => {
    try {
      const { prompt, character_id, background_id, i2v_profile, duration_sec } = req.body;
      if (!prompt?.trim()) {
        return res.status(400).json({ error: 'prompt is required' });
      }
      const plan = await previewDirectorPlan(prompt, {
        characterId: character_id,
        backgroundId: background_id,
        i2vProfile: i2v_profile,
        durationSec: duration_sec,
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
        plan = await expandScenePrompt(prompt, {
          characterId: character_id,
          backgroundId: background_id,
          i2vProfile: req.body.i2v_profile,
          durationSec: req.body.duration_sec,
        });
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
