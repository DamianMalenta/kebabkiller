import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { resolveUploadPath } from './compositeStartFrame.js';
import { getApprovedSceneAssetForSortOrder } from '../db/darkroomModels.js';
import { WAN_QUALITY } from './wanConfig.js';

function mimeFromPath(filePath) {
  const ext = path.extname(filePath || '').toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  return 'image/jpeg';
}

export function resolveDarkroomMotionPrompt(sceneAsset) {
  return (sceneAsset.user_override_prompt || sceneAsset.ai_proposed_prompt || '').trim();
}

/**
 * Surowy kadr z Ciemni → data URI 9:16 dla węzła LoadImage (RunComfy/fal).
 */
export async function buildDarkroomStartFrame({
  rawImagePath,
  uploadsDir,
  width = WAN_QUALITY.width,
  height = WAN_QUALITY.height,
}) {
  const absPath = resolveUploadPath(rawImagePath, uploadsDir);
  if (!absPath || !fs.existsSync(absPath)) {
    throw new Error(`Kinowa Ciemnia: brak pliku klatki na dysku (${rawImagePath}).`);
  }

  const buffer = await sharp(absPath)
    .resize(width, height, { fit: 'cover', position: 'centre' })
    .jpeg({ quality: 92 })
    .toBuffer();

  return {
    type: 'base64',
    data: `data:${mimeFromPath(absPath)};base64,${buffer.toString('base64')}`,
    source: 'darkroom',
  };
}

/**
 * Zatwierdzony asset Ciemni dla sceny (mapowanie po sort_order).
 * @returns {Promise<{ sceneAsset, motionPrompt, startFrame, processedAssets }|null>}
 */
export async function resolveDarkroomSceneInput({ episodePlanId, sceneSortOrder, uploadsDir }) {
  const sceneAsset = getApprovedSceneAssetForSortOrder(episodePlanId, sceneSortOrder);
  if (!sceneAsset) return null;

  const motionPrompt = resolveDarkroomMotionPrompt(sceneAsset);
  if (!motionPrompt) {
    throw new Error(`Kinowa Ciemnia: scena ${sceneSortOrder + 1} nie ma promptu ruchu.`);
  }

  const startFrame = await buildDarkroomStartFrame({
    rawImagePath: sceneAsset.raw_image_path,
    uploadsDir,
  });

  return {
    sceneAsset,
    motionPrompt,
    startFrame,
    processedAssets: { startFrame },
  };
}
