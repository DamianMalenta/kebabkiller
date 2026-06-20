import fs from 'node:fs';
import path from 'node:path';
import {
  getEpisodePlan,
  updateEpisodePlan,
} from '../db/episodeModels.js';
import {
  createProductionRun,
  updateProductionRun,
  createProductionClip,
  updateProductionClip,
  formatClipCode,
  getLatestProductionRun,
  getProductionRun,
  listProductionClips,
} from '../db/productionModels.js';
import { buildEpisodeVisualProfile, buildSceneDirectorPlan } from '../ai/productionDirector.js';
import { enrichDirectorForRender } from '../ai/directorDesk/workflowBuilder.js';
import { getDirectorProject } from '../db/directorDeskModels.js';
import { getAsset } from '../db/episodeModels.js';

const activeProductions = new Map();
const MAX_CLIP_RETRIES = 3;

export function getActiveProductionCount() {
  return activeProductions.size;
}

function resolveExportDir(outputDir, episodeCode) {
  return path.join(outputDir, 'export', episodeCode);
}

function toPublicOutputPath(outputDir, absolutePath) {
  const rel = path.relative(outputDir, absolutePath).split(path.sep).join('/');
  return `/output/${rel}`;
}

function buildManifest(plan, visualProfile, clips) {
  return {
    episode: plan.code,
    title: plan.title,
    target_duration_sec: plan.target_duration_sec,
    fps: visualProfile.fps,
    resolution: visualProfile.resolution,
    preferences: plan.preferences,
    catalog_used: visualProfile.catalog_used,
    clips: clips.map((clip) => {
      const scene = plan.scenes.find((s) => s.id === clip.plan_scene_id);
      const locationAsset = scene?.location_asset_id ? getAsset(scene.location_asset_id) : null;
      return {
        file: path.basename(clip.output_path || `${clip.clip_code}.webm`),
        clip_code: clip.clip_code,
        sort_order: clip.sort_order,
        scene_pl: clip.user_prompt,
        duration_sec: scene?.duration_sec ?? null,
        location: locationAsset?.name ?? null,
        status: clip.status,
        notes: scene?.description_pl ?? null,
      };
    }),
    produced_at: new Date().toISOString(),
  };
}

function buildReadme(plan, manifest) {
  return [
    `${plan.code} — paczka montażowa Kebabkiller Studio`,
    '',
    `Odcinek: ${plan.title || plan.code}`,
    `Cel: ~${plan.target_duration_sec}s · ${manifest.clips.length} klipów`,
    `Format: ${manifest.resolution.width}x${manifest.resolution.height} · ${manifest.fps} fps · WEBM`,
    '',
    'Kolejność importu (montaż zewnętrzny):',
    ...manifest.clips.map((c, i) => `${i + 1}. ${c.file} — ${c.scene_pl?.slice(0, 60) || ''}`),
    '',
    'Szczegóły: E01_manifest.json',
  ].join('\n');
}

function parseSceneOverrides(scene) {
  if (!scene?.ai_overrides_json) return {};
  try {
    return JSON.parse(scene.ai_overrides_json);
  } catch {
    return {};
  }
}

/**
 * Produkcja = podgląd: ten sam enrichment co Director's Desk (wstrzyknięcie
 * style_tags + anchor do positive_prompt). Bez projektu (np. plan bez serialu)
 * zwracamy plan bez zmian.
 */
function enrichDirectorForProduction(directorJson, plan, scene) {
  if (!plan?.project_id) return directorJson;
  const project = getDirectorProject(plan.project_id);
  if (!project) return directorJson;

  const { enrichedDirector } = enrichDirectorForRender({
    directorJson,
    userPrompt: scene.description_pl,
    project,
    scene: { ...scene, ai_overrides: parseSceneOverrides(scene) },
    generatorTags: project.generator_tags || [],
  });

  return enrichedDirector;
}

async function renderClip(clip, scene, plan, visualProfile, engine, outputDir, exportDir, onClipProgress) {
  updateProductionClip(clip.id, { status: 'directing', progress: 10 });

  let directorJson = await buildSceneDirectorPlan(plan, scene, visualProfile);
  directorJson = enrichDirectorForProduction(directorJson, plan, scene);
  updateProductionClip(clip.id, { directorJson, status: 'rendering', progress: 25 });

  const ext = engine.name === 'mock' ? '.webm' : '.webm';
  const outputPath = path.join(exportDir, `${clip.clip_code}${ext}`);

  const result = await engine.render({
    jobId: clip.clip_code,
    userPrompt: clip.user_prompt,
    directorJson,
    renderStrategy: 'native_i2v',
    outputPath,
    onProgress: (progress) => {
      const percent = typeof progress === 'object' ? progress.percent : progress;
      const mapped = 25 + Math.round((percent / 100) * 70);
      updateProductionClip(clip.id, { progress: mapped });
      onClipProgress?.(clip, mapped);
    },
  });

  const publicPath = toPublicOutputPath(outputDir, result.outputPath);
  updateProductionClip(clip.id, {
    status: 'completed',
    progress: 100,
    outputPath: publicPath,
    completedAt: new Date().toISOString(),
  });

  return publicPath;
}

export async function processEpisodeProduction(episodePlanId, engine, outputDir) {
  if (activeProductions.has(episodePlanId)) return getLatestProductionRun(episodePlanId);

  const plan = getEpisodePlan(episodePlanId);
  if (!plan) throw new Error('Plan odcinka nie istnieje.');
  if (plan.status !== 'zaakceptowany' && plan.status !== 'gotowy' && plan.status !== 'w_produkcji') {
    throw new Error('Produkcja wymaga zaakceptowanego planu odcinka.');
  }
  if (!plan.scenes.length) throw new Error('Plan nie ma scen do renderu.');

  activeProductions.set(episodePlanId, true);

  const visualProfile = buildEpisodeVisualProfile(plan);
  const exportDir = resolveExportDir(outputDir, plan.code);
  fs.mkdirSync(exportDir, { recursive: true });

  const run = createProductionRun({
    episodePlanId,
    exportDir,
    visualProfile,
    clipsTotal: plan.scenes.length,
  });

  updateEpisodePlan(episodePlanId, { status: 'w_produkcji' });
  updateProductionRun(run.id, { status: 'running' });

  const clips = [];
  let completed = 0;

  try {
    for (const scene of plan.scenes) {
      const clipCode = formatClipCode(plan.code, scene.sort_order);
      const userPrompt = scene.description_pl;
      const clip = createProductionClip({
        productionRunId: run.id,
        planSceneId: scene.id,
        sortOrder: scene.sort_order,
        clipCode,
        userPrompt,
      });
      clips.push(clip);

      let retryCount = 0;
      while (retryCount < MAX_CLIP_RETRIES) {
        try {
          await renderClip(clip, scene, plan, visualProfile, engine, outputDir, exportDir, (c, p) => {
            const runProgress = Math.round(((completed + p / 100) / plan.scenes.length) * 100);
            updateProductionRun(run.id, { progress: runProgress });
          });
          completed += 1;
          updateProductionRun(run.id, { clipsCompleted: completed });
          break; // Success, exit retry loop
        } catch (err) {
          retryCount++;
          if (retryCount >= MAX_CLIP_RETRIES) {
            console.error(`[ProductionQueue] Clip ${clipCode} failed after ${MAX_CLIP_RETRIES} retries:`, err.message);
            updateProductionClip(clip.id, {
              status: 'failed',
              errorMessage: err.message,
              progress: 0,
            });
            throw err;
          }
          console.warn(`[ProductionQueue] Retrying clip ${clipCode} (${retryCount}/${MAX_CLIP_RETRIES})`);
        }
      }
    }

    const hydratedClips = listProductionClips(run.id);

    const manifest = buildManifest(plan, visualProfile, hydratedClips);
    const manifestAbs = path.join(exportDir, `${plan.code}_manifest.json`);
    const readmePath = path.join(exportDir, `${plan.code}_README.txt`);
    fs.writeFileSync(manifestAbs, JSON.stringify(manifest, null, 2));
    fs.writeFileSync(readmePath, buildReadme(plan, manifest));

    updateProductionRun(run.id, {
      status: 'completed',
      progress: 100,
      manifestPath: toPublicOutputPath(outputDir, manifestAbs),
      exportDir: toPublicOutputPath(outputDir, exportDir),
      completedAt: new Date().toISOString(),
    });
    updateEpisodePlan(episodePlanId, { status: 'gotowy' });

    return getLatestProductionRun(episodePlanId);
  } catch (err) {
    updateProductionRun(run.id, {
      status: completed > 0 ? 'partial' : 'failed',
      errorMessage: err.message,
      clipsCompleted: completed,
    });
    updateEpisodePlan(episodePlanId, { status: 'zaakceptowany' });
    throw err;
  } finally {
    activeProductions.delete(episodePlanId);
  }
}

export function enqueueEpisodeProduction(episodePlanId, engine, outputDir) {
  setImmediate(() => {
    processEpisodeProduction(episodePlanId, engine, outputDir).catch((err) => {
      console.error(`[ProductionQueue] Episode ${episodePlanId} production failed:`, err.message);
    });
  });
}

/**
 * Resume production from a partial run - continues from first failed clip
 */
export async function resumeProductionFromPartial(productionRunId, engine, outputDir) {
  const existingRun = getProductionRun(productionRunId);
  if (!existingRun) throw new Error('Production run not found');
  if (existingRun.status !== 'partial') throw new Error('Only partial runs can be resumed');
  
  const plan = getEpisodePlan(existingRun.episode_plan_id);
  if (!plan) throw new Error('Plan odcinka nie istnieje.');
  
  // Atomic check-and-set: use set() return value to verify we were the first
  const wasAlreadyActive = activeProductions.has(plan.id);
  if (wasAlreadyActive) {
    return existingRun;
  }
  activeProductions.set(plan.id, true);
  
  const visualProfile = existingRun.visual_profile;
  const exportDir = existingRun.export_dir;
  
  updateProductionRun(productionRunId, { status: 'running' });
  updateEpisodePlan(plan.id, { status: 'w_produkcji' });
  
  const clips = listProductionClips(productionRunId);
  const failedClipIndex = clips.findIndex(c => c.status === 'failed');
  
  if (failedClipIndex === -1) {
    // No failed clips found, mark as completed
    updateProductionRun(productionRunId, { status: 'completed', progress: 100 });
    updateEpisodePlan(plan.id, { status: 'gotowy' });
    activeProductions.delete(plan.id);
    return getProductionRun(productionRunId);
  }
  
  let completed = clips.filter(c => c.status === 'completed').length;
  
  try {
    // Continue from first failed clip
    for (let i = failedClipIndex; i < plan.scenes.length; i++) {
      const scene = plan.scenes[i];
      const clipCode = formatClipCode(plan.code, scene.sort_order);
      const userPrompt = scene.description_pl;
      
      // Check if clip already exists
      let clip = clips.find(c => c.clip_code === clipCode);
      if (!clip) {
        clip = createProductionClip({
          productionRunId,
          planSceneId: scene.id,
          sortOrder: scene.sort_order,
          clipCode,
          userPrompt,
        });
      }
      
      let retryCount = 0;
      while (retryCount < MAX_CLIP_RETRIES) {
        try {
          await renderClip(clip, scene, plan, visualProfile, engine, outputDir, exportDir, (c, p) => {
            const runProgress = Math.round(((completed + p / 100) / plan.scenes.length) * 100);
            updateProductionRun(productionRunId, { progress: runProgress });
          });
          completed += 1;
          updateProductionRun(productionRunId, { clipsCompleted: completed });
          break;
        } catch (err) {
          retryCount++;
          if (retryCount >= MAX_CLIP_RETRIES) {
            console.error(`[ProductionQueue] Clip ${clipCode} failed after ${MAX_CLIP_RETRIES} retries:`, err.message);
            updateProductionClip(clip.id, {
              status: 'failed',
              errorMessage: err.message,
              progress: 0,
            });
            throw err;
          }
          console.warn(`[ProductionQueue] Retrying clip ${clipCode} (${retryCount}/${MAX_CLIP_RETRIES})`);
        }
      }
    }
    
    const hydratedClips = listProductionClips(productionRunId);
    const manifest = buildManifest(plan, visualProfile, hydratedClips);
    const manifestAbs = path.join(exportDir, `${plan.code}_manifest.json`);
    const readmePath = path.join(exportDir, `${plan.code}_README.txt`);
    fs.writeFileSync(manifestAbs, JSON.stringify(manifest, null, 2));
    fs.writeFileSync(readmePath, buildReadme(plan, manifest));
    
    updateProductionRun(productionRunId, {
      status: 'completed',
      progress: 100,
      manifestPath: toPublicOutputPath(outputDir, manifestAbs),
      exportDir: toPublicOutputPath(outputDir, exportDir),
      completedAt: new Date().toISOString(),
    });
    updateEpisodePlan(plan.id, { status: 'gotowy' });
    
    return getProductionRun(productionRunId);
  } catch (err) {
    updateProductionRun(productionRunId, {
      status: completed > clips.filter(c => c.status === 'completed').length ? 'partial' : 'failed',
      errorMessage: err.message,
      clipsCompleted: completed,
    });
    updateEpisodePlan(plan.id, { status: 'zaakceptowany' });
    throw err;
  } finally {
    activeProductions.delete(plan.id);
  }
}
