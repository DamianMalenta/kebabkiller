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
  updateVideoJob,
  getKnowledgeContext,
  listProjects,
  getProject,
  createProject,
  updateProject,
  deleteProject,
  listEpisodes,
  getEpisode,
  updateEpisode,
  deleteEpisode,
  getSeriesContextForLlm,
  getDirectorContextForEpisode,
  isCanonAcceptanceComplete,
} from '../db/models.js';
import {
  getLlmProviderStatus,
} from '../ai/director.js';
import { processCanonAcceptance } from '../ai/canonPipeline.js';
import { assistEpisodePlan } from '../ai/screenwriter.js';
import {
  listAssets,
  getAsset,
  createAsset,
  updateAsset,
  deleteAsset,
  addAssetImage,
  deleteAssetImage,
  setAssetCompositeDefault,
  setSceneCompositeOverride,
  setSceneStartFrame,
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
  FROZEN_PLAN_STATUSES,
} from '../db/episodeModels.js';
import { hydrateRow } from '../utils/json.js';
import {
  getLatestProductionRun,
  listProductionRuns,
  getProductionRun,
} from '../db/productionModels.js';
import { enqueueVideoJob } from '../video/queue.js';
import { enqueueEpisodeProduction } from '../video/productionQueue.js';
import {
  getDirectorDeskState,
  handleDirectorMessage,
  handleSideThreadMessage,
  closeSideThreadAndMerge,
} from '../ai/directorDesk/agentServer.js';
import { buildProjectBrain, setAssetImageMetadata } from '../db/directorDeskModels.js';
import { buildDeterministicAssetMetadata } from '../ai/directorDesk/assetMetadata.js';
import { buildStartFrameAsset, resolveCompositeConfig } from '../video/compositeStartFrame.js';
import { createSystemAgentRouter } from '../ai/systemAgent/router.js';

function primaryImagePath(asset) {
  if (!asset?.images?.length) return null;
  const primary = asset.images.find((i) => i.is_primary) || asset.images[0];
  return primary?.path || null;
}

function formatJobResponse(job) {
  const hydrated = hydrateRow(job);
  return {
    ...hydrated,
    canon_complete: isCanonAcceptanceComplete(job.id),
    director_json: job.director_json ? JSON.parse(job.director_json) : null,
  };
}

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

  // AI-Inżynier (Faza E) — osobny moduł, własna bramka tokenem.
  router.use('/system-agent', createSystemAgentRouter());

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
      if (req.body.priority !== undefined && typeof req.body.priority !== 'number') {
        return res.status(400).json({ error: 'Priority musi być liczbą.' });
      }
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

  // Projects (Seriale)
  router.get('/projects', (_req, res) => {
    res.json(listProjects());
  });

  router.get('/projects/:id', (req, res) => {
    const item = getProject(req.params.id);
    if (!item) return res.status(404).json({ error: 'Project not found' });
    res.json(item);
  });

  router.post('/projects', (req, res) => {
    try {
      if (!req.body.name?.trim()) {
        return res.status(400).json({ error: 'Nazwa projektu jest wymagana.' });
      }
      if (req.body.description !== undefined && typeof req.body.description !== 'string') {
        return res.status(400).json({ error: 'Description musi być tekstem.' });
      }
      const item = createProject({
        name: req.body.name,
        description: req.body.description,
        styleBibleJson: req.body.style_bible_json ?? req.body.style_bible,
        defaultCharacterId: req.body.default_character_id,
        defaultBackgroundId: req.body.default_background_id,
      });
      res.status(201).json(item);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.put('/projects/:id', (req, res) => {
    const existing = getProject(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Project not found' });
    const item = updateProject(req.params.id, {
      name: req.body.name,
      description: req.body.description,
      styleBibleJson: req.body.style_bible_json ?? req.body.style_bible,
      seriesMemory: req.body.series_memory,
      defaultCharacterId: req.body.default_character_id,
      defaultBackgroundId: req.body.default_background_id,
    });
    res.json(item);
  });

  router.delete('/projects/:id', (req, res) => {
    if (!deleteProject(req.params.id)) {
      return res.status(404).json({ error: 'Project not found' });
    }
    res.status(204).end();
  });

  router.get('/projects/:id/director-context', (req, res) => {
    try {
      const ctx = getSeriesContextForLlm({
        projectId: req.params.id,
        episodeId: req.query.episode_id,
        maxSummaries: Number(req.query.max_summaries) || 5,
      });
      res.json(ctx);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.get('/projects/:projectId/episodes', (req, res) => {
    const project = getProject(req.params.projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    res.json(listEpisodePlans(req.params.projectId));
  });

  // Legacy: tworzenie odcinka starym flow (tabela `episodes`) jest wycofane.
  // Odcinki powstają wyłącznie przez kreator w Director's Desk (episode_plans).
  // GET tego path nadal zwraca listę episode_plans (poniżej / wyżej).
  router.post('/projects/:projectId/episodes', (_req, res) => {
    res.status(410).json({
      error: 'Endpoint wycofany. Użyj kreatora odcinka w Director\'s Desk (/desk).',
      use_instead: 'director-desk',
    });
  });

  router.get('/episodes/:id', (req, res) => {
    const item = getEpisode(req.params.id);
    if (!item) return res.status(404).json({ error: 'Episode not found' });
    res.json(item);
  });

  router.put('/episodes/:id', (req, res) => {
    const existing = getEpisode(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Episode not found' });
    const item = updateEpisode(req.params.id, {
      title: req.body.title,
      synopsisPl: req.body.synopsis_pl,
      directorNotes: req.body.director_notes,
      status: req.body.status,
      episodeNumber: req.body.episode_number,
    });
    res.json(item);
  });

  router.delete('/episodes/:id', (req, res) => {
    if (!deleteEpisode(req.params.id)) {
      return res.status(404).json({ error: 'Episode not found' });
    }
    res.status(204).end();
  });

  router.get('/episodes/:id/director-context', (req, res) => {
    try {
      res.json(getDirectorContextForEpisode(req.params.id));
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
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
    const metadata = buildDeterministicAssetMetadata({
      asset: existing,
      label: req.body.label,
      filename: req.file.originalname,
    });
    setAssetImageMetadata(image.id, metadata);
    res.status(201).json({ ...image, ai_metadata: metadata });
  });

  router.delete('/asset-images/:imageId', (req, res) => {
    if (!deleteAssetImage(req.params.imageId)) {
      return res.status(404).json({ error: 'Image not found' });
    }
    res.status(204).end();
  });

  // Faza C — Klatka Zero: domyślny composite (pozycja+skala @char) per asset.
  router.put('/assets/:id/composite-default', (req, res) => {
    const existing = getAsset(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Asset not found' });
    const updated = setAssetCompositeDefault(req.params.id, req.body.composite ?? null);
    res.json(updated);
  });

  // Faza C — Klatka Zero: override composite na poziomie sceny (najwyższy priorytet kaskady).
  router.put('/episode-plans/:planId/scenes/:sceneId/composite', (req, res) => {
    const scene = setSceneCompositeOverride(req.params.sceneId, req.body.composite ?? null);
    if (!scene) return res.status(404).json({ error: 'Scene not found' });
    res.json(scene);
  });

  /**
   * Filar 3 — kadry kontynuacji: klatki wyekstrahowane z klipu POPRZEDNIEJ sceny
   * (do Pickera). Scena 0 nie ma poprzednika → pusta lista.
   */
  router.get('/episode-plans/:planId/scenes/:sceneId/continuation-frames', (req, res) => {
    const plan = getEpisodePlan(req.params.planId);
    if (!plan) return res.status(404).json({ error: 'Episode plan not found' });
    const scene = plan.scenes.find((s) => s.id === req.params.sceneId);
    if (!scene) return res.status(404).json({ error: 'Scene not found' });

    const prevScene = plan.scenes
      .filter((s) => s.sort_order < scene.sort_order)
      .sort((a, b) => b.sort_order - a.sort_order)[0] || null;

    const run = getLatestProductionRun(req.params.planId);
    const prevClip = prevScene && run
      ? (run.clips || []).find((c) => c.plan_scene_id === prevScene.id)
      : null;

    res.json({
      scene_id: scene.id,
      sort_order: scene.sort_order,
      current_start_frame: scene.start_frame_path || null,
      auto_continuity: scene.sort_order > 0,
      prev_scene_id: prevScene?.id || null,
      prev_clip_code: prevClip?.clip_code || null,
      frames: prevClip?.frames || [],
    });
  });

  /**
   * Filar 3 — ustaw/wyczyść kadr kontynuacji jako start sceny.
   * `frame_path: null` → cofnięcie do auto-ciągłości (klatka końcowa poprzedniej sceny).
   */
  router.put('/episode-plans/:planId/scenes/:sceneId/start-frame', (req, res) => {
    const scene = setSceneStartFrame(req.params.sceneId, req.body.frame_path ?? null);
    if (!scene) return res.status(404).json({ error: 'Scene not found' });
    res.json(scene);
  });

  /**
   * Faza C — PODGLĄD KOLAŻU Klatki Zero (0 zł, ZERO GPU).
   * Składa @char (wycinek) na @loc (tło) z kaskadą composite: scena → asset → fallback.
   * Źródła: compose (domyślne) / upload gotowej klatki / klatka z biblioteki.
   * Źródło "generowanie AI" = GPU → ODŁOŻONE (poza zakresem).
   */
  router.post('/composite/preview', async (req, res) => {
    try {
      const body = req.body || {};
      const characterAsset = body.characterAssetId ? getAsset(body.characterAssetId) : null;
      const locationAsset = body.locationAssetId ? getAsset(body.locationAssetId) : null;

      const characterRef = body.characterRef || primaryImagePath(characterAsset);
      const backgroundRef = body.backgroundRef || primaryImagePath(locationAsset);

      // Kaskada: override sceny → domyślna assetu (@char) → fallback (hardcoded w resolverze).
      const composite = resolveCompositeConfig(body.sceneComposite, characterAsset?.composite_default);

      const startFrame = await buildStartFrameAsset({
        characterRef,
        backgroundRef,
        uploadsDir,
        composite,
      });

      if (!startFrame) {
        return res.status(422).json({ error: 'Brak obrazów postaci i tła do złożenia kolażu.' });
      }

      res.json({
        data: startFrame.data,
        source: startFrame.source,
        composite,
        width: 480,
        height: 832,
        cost: 0,
      });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
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
      if (!req.body.code?.trim()) {
        return res.status(400).json({ error: 'Code odcinka jest wymagany.' });
      }
      if (typeof req.body.code !== 'string') {
        return res.status(400).json({ error: 'Code musi być tekstem.' });
      }
      if (req.body.target_duration_sec !== undefined && typeof req.body.target_duration_sec !== 'number') {
        return res.status(400).json({ error: 'target_duration_sec musi być liczbą.' });
      }
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
    
    // Walidacja code jeśli jest podany
    if (req.body.code !== undefined) {
      if (typeof req.body.code !== 'string') {
        return res.status(400).json({ error: 'Code musi być tekstem.' });
      }
      if (!req.body.code?.trim()) {
        return res.status(400).json({ error: 'Code odcinka jest wymagany.' });
      }
    }
    
    // Walidacja target_duration_sec jeśli jest podany
    if (req.body.target_duration_sec !== undefined && typeof req.body.target_duration_sec !== 'number') {
      return res.status(400).json({ error: 'target_duration_sec musi być liczbą.' });
    }
    
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
      if (!FROZEN_PLAN_STATUSES.has(plan.status)) {
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

  // AI Director (legacy - endpointy wycofane, użyj Director's Desk /director-desk/*)
  // POST /director/preview - WYCOFANY: użyj Director's Desk
  // POST /director/suggest - WYCOFANY: użyj Director's Desk

  // Video jobs
  router.get('/jobs', (_req, res) => {
    res.json(listVideoJobs().map(formatJobResponse));
  });

  router.get('/jobs/:id', (req, res) => {
    const job = getVideoJob(req.params.id);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    res.json(formatJobResponse(job));
  });

  router.patch('/jobs/:id', async (req, res) => {
    try {
      const job = getVideoJob(req.params.id);
      if (!job) return res.status(404).json({ error: 'Job not found' });

      const { is_canon, project_id, episode_id, scene_index } = req.body;

      if (is_canon === true || is_canon === 1) {
        if (Boolean(job.is_canon) && isCanonAcceptanceComplete(req.params.id)) {
          const project = job.project_id ? getProject(job.project_id) : null;
          return res.json({
            ...formatJobResponse(job),
            series_memory: project?.series_memory || '',
            skipped: true,
          });
        }
        const result = await processCanonAcceptance(req.params.id, { projectId: project_id });
        return res.json({
          ...formatJobResponse(result.job),
          render_summary: result.render_summary,
          series_memory: result.series_memory,
          compaction_source: result.compaction_source,
          skipped: result.skipped ?? false,
        });
      }

      const fields = {};
      if (episode_id !== undefined) fields.episode_id = episode_id;
      if (scene_index !== undefined) fields.scene_index = scene_index;
      if (project_id !== undefined) fields.project_id = project_id;
      if (is_canon === false || is_canon === 0) fields.is_canon = 0;

      const updated = Object.keys(fields).length > 0
        ? updateVideoJob(req.params.id, fields)
        : job;
      res.json(formatJobResponse(updated));
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.post('/jobs', async (req, res) => {
    try {
      const {
        prompt,
        character_id,
        background_id,
        project_id,
        episode_id,
        scene_index,
        director_plan,
        skip_preview,
      } = req.body;
      if (!prompt?.trim()) {
        return res.status(400).json({ error: 'prompt is required' });
      }

      let plan = director_plan;
      if (!plan && !skip_preview) {
        // Legacy: expandScenePrompt wycofane - użyj Director's Desk
        return res.status(410).json({
          error: 'Auto-preview wycofany. Użyj Director\'s Desk (/director-desk/*) aby wygenerować director plan.',
          use_instead: 'director-desk',
        });
      }

      const job = createVideoJob({
        userPrompt: prompt,
        characterId: character_id,
        backgroundId: background_id,
        projectId: project_id,
        episodeId: episode_id,
        sceneIndex: scene_index,
        directorJson: plan,
        renderStrategy: plan?.render_strategy || 'native_i2v',
      });

      enqueueVideoJob({ ...job, director_json: plan }, videoEngine);

      res.status(201).json({
        ...formatJobResponse(job),
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

  // Director's Desk (V2)
  router.get('/director-desk/projects/:projectId', (req, res) => {
    try {
      const episodePlanId = req.query.episode_plan_id || null;
      res.json(getDirectorDeskState(req.params.projectId, episodePlanId));
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.get('/director-desk/projects/:projectId/brain', (req, res) => {
    try {
      const brain = buildProjectBrain(req.params.projectId, {
        episodePlanId: req.query.episode_plan_id || null,
      });
      if (!brain) return res.status(404).json({ error: 'Project not found' });
      res.json(brain);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.post('/director-desk/projects/:projectId/chat', async (req, res) => {
    try {
      const result = await handleDirectorMessage({
        projectId: req.params.projectId,
        episodePlanId: req.body.episode_plan_id || null,
        message: req.body.message,
        confirmAction: req.body.confirm_action || null,
        sideThreadId: req.body.side_thread_id || null,
      });
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.post('/director-desk/side-threads/:threadId/messages', async (req, res) => {
    try {
      const result = await handleSideThreadMessage({
        threadId: req.params.threadId,
        message: req.body.message,
        projectId: req.body.project_id,
        episodePlanId: req.body.episode_plan_id || null,
      });
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.post('/director-desk/side-threads/:threadId/close', async (req, res) => {
    try {
      const result = await closeSideThreadAndMerge({
        threadId: req.params.threadId,
        projectId: req.body.project_id,
        episodePlanId: req.body.episode_plan_id || null,
        decision: req.body.decision || null,
      });
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  return router;
}
