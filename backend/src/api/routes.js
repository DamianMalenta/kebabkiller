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
  createEpisode,
  updateEpisode,
  deleteEpisode,
  getSeriesContextForLlm,
  getDirectorContextForEpisode,
  isCanonAcceptanceComplete,
} from '../db/models.js';
import {
  expandScenePrompt,
  previewDirectorPlan,
  suggestEpisodePrompts,
  getLlmProviderStatus,
} from '../ai/director.js';
import { processCanonAcceptance } from '../ai/canonPipeline.js';
import { enqueueVideoJob } from '../video/queue.js';

function formatJobResponse(job) {
  return {
    ...job,
    is_canon: Boolean(job.is_canon),
    canon_complete: isCanonAcceptanceComplete(job.id),
    canon_acceptance_in_progress: Boolean(job.canon_acceptance_in_progress),
    director_json: job.director_json ? JSON.parse(job.director_json) : null,
  };
}

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

  // Projects
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
    res.json(listEpisodes(req.params.projectId));
  });

  router.post('/projects/:projectId/episodes', (req, res) => {
    try {
      const project = getProject(req.params.projectId);
      if (!project) return res.status(404).json({ error: 'Project not found' });
      if (!req.body.title?.trim()) {
        return res.status(400).json({ error: 'Tytuł odcinka jest wymagany.' });
      }
      const item = createEpisode({
        projectId: req.params.projectId,
        episodeNumber: req.body.episode_number,
        title: req.body.title,
        synopsisPl: req.body.synopsis_pl,
        directorNotes: req.body.director_notes,
        status: req.body.status,
      });
      res.status(201).json(item);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
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

  // AI Director
  router.post('/director/preview', async (req, res) => {
    try {
      const { prompt, character_id, background_id, project_id, episode_id } = req.body;
      if (!prompt?.trim()) {
        return res.status(400).json({ error: 'prompt is required' });
      }
      const plan = await previewDirectorPlan(prompt, {
        characterId: character_id,
        backgroundId: background_id,
        projectId: project_id,
        episodeId: episode_id,
      });
      res.json(plan);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/director/suggest', async (req, res) => {
    try {
      const { project_id, episode_id, brief_pl, count } = req.body;
      const result = await suggestEpisodePrompts({
        projectId: project_id,
        episodeId: episode_id,
        briefPl: brief_pl,
        count,
      });
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

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
        plan = await expandScenePrompt(prompt, {
          characterId: character_id,
          backgroundId: background_id,
          projectId: project_id,
          episodeId: episode_id,
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

  return router;
}
