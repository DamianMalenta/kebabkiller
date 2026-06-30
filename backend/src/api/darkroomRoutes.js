import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { getEpisodePlan } from '../db/episodeModels.js';
import {
  createSceneAssetsBatch,
  listSceneAssetsByEpisodePlan,
  reviewSceneAsset,
} from '../db/darkroomModels.js';
import { runAuditForEpisodePlan } from '../services/visionAiMockService.js';

const ALLOWED_RAW_MIMES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
]);

export function createDarkroomRouter({ uploadsDir }) {
  const router = Router();
  const rawUploadsDir = path.join(uploadsDir, 'raw');
  fs.mkdirSync(rawUploadsDir, { recursive: true });

  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, rawUploadsDir),
    filename: (_req, file, cb) => {
      const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
      cb(null, `${Date.now()}_${safe}`);
    },
  });

  const upload = multer({
    storage,
    limits: { fileSize: 25 * 1024 * 1024, files: 50 },
    fileFilter: (_req, file, cb) => {
      if (ALLOWED_RAW_MIMES.has(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error(`Niedozwolony typ pliku: ${file.mimetype}`), false);
      }
    },
  });

  router.post('/episode-plans/:episode_plan_id/audit', (req, res) => {
    try {
      const episodePlanId = req.params.episode_plan_id;
      const result = runAuditForEpisodePlan(episodePlanId);
      res.json({
        episode_plan_id: episodePlanId,
        count: result.count,
        scene_assets: result.updated,
      });
    } catch (err) {
      const status = err.message === 'Plan odcinka nie istnieje.' ? 404 : 400;
      res.status(status).json({ error: err.message });
    }
  });

  router.get('/episode-plans/:episode_plan_id/assets', (req, res) => {
    try {
      const episodePlanId = req.params.episode_plan_id;
      if (!getEpisodePlan(episodePlanId)) {
        return res.status(404).json({ error: 'Plan odcinka nie istnieje.' });
      }
      const sceneAssets = listSceneAssetsByEpisodePlan(episodePlanId);
      res.json({
        episode_plan_id: episodePlanId,
        count: sceneAssets.length,
        scene_assets: sceneAssets,
      });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.put('/assets/:asset_id/review', (req, res) => {
    try {
      const assetId = req.params.asset_id;
      const { status, user_override_prompt: userOverridePrompt } = req.body || {};
      if (!status) {
        return res.status(400).json({ error: 'Pole status jest wymagane.' });
      }
      const updated = reviewSceneAsset(assetId, { status, userOverridePrompt });
      if (!updated) {
        return res.status(404).json({ error: 'Scene asset nie istnieje.' });
      }
      res.json(updated);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.post('/upload-batch', upload.array('images', 50), (req, res) => {
    try {
      const episodePlanId = req.body?.episode_plan_id?.trim?.() || req.body?.episode_plan_id;
      if (!episodePlanId) {
        return res.status(400).json({ error: 'Pole episode_plan_id jest wymagane.' });
      }
      if (!getEpisodePlan(episodePlanId)) {
        return res.status(404).json({ error: 'Plan odcinka nie istnieje.' });
      }

      const files = req.files || [];
      if (files.length === 0) {
        return res.status(400).json({ error: 'Wymagana co najmniej jedna grafika w polu images.' });
      }

      const items = files.map((file) => ({
        episodePlanId,
        rawImagePath: `/uploads/raw/${file.filename}`,
      }));

      const sceneAssets = createSceneAssetsBatch(items);

      res.status(201).json({
        episode_plan_id: episodePlanId,
        count: sceneAssets.length,
        scene_assets: sceneAssets,
      });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  return router;
}
