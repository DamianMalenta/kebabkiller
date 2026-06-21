import fs from 'node:fs';
import path from 'node:path';
import {
  getEpisodePlan,
  updateEpisodePlan,
} from '../db/episodeModels.js';
import { parseJsonField } from '../utils/json.js';
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
import { extractClipFrames, pickLastFrame } from './frameExtractor.js';

const CONTINUITY_FRAME_COUNT = 6;

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

/** Public `/output/...` lub absolutną ścieżkę kadru → absolutna ścieżka na dysku. */
function toAbsoluteOutputPath(outputDir, maybePath) {
  if (!maybePath) return null;
  if (path.isAbsolute(maybePath) && fs.existsSync(maybePath)) return maybePath;
  const stripped = String(maybePath).replace(/^\/?output\//, '');
  const abs = path.join(outputDir, stripped);
  return fs.existsSync(abs) ? abs : null;
}

/**
 * Silnik ciągłości (Filar 3): kadr startowy sceny.
 *   - jawny wybór użytkownika (`scene.start_frame_path`) ma najwyższy priorytet,
 *   - sceny N>0 bez wyboru → auto-ciągłość z klatki końcowej poprzedniego klipu,
 *   - scena 0 → null (kompozyt Klatki Zero).
 * Zwraca absolutną ścieżkę do obrazu lub null.
 */
function resolveSceneStartFrame(scene, prevLastFramePublic, outputDir) {
  if (scene.start_frame_path) {
    const resolved = toAbsoluteOutputPath(outputDir, scene.start_frame_path);
    if (resolved) return resolved;
    // Jawny wybór niedostępny na dysku — fall-through do auto-ciągłości.
  }
  if (scene.sort_order > 0 && prevLastFramePublic) {
    return toAbsoluteOutputPath(outputDir, prevLastFramePublic);
  }
  return null;
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
        continuity: clip.director_json?.continuity_mode ?? (clip.sort_order > 0 ? 'last_frame' : 'composite'),
        start_frame: clip.director_json?.start_frame_path ?? null,
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
  return parseJsonField(scene?.ai_overrides_json, {});
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

async function renderClip(clip, scene, plan, visualProfile, engine, outputDir, exportDir, startFrameOverride, onClipProgress) {
  updateProductionClip(clip.id, { status: 'directing', progress: 10 });

  let directorJson = await buildSceneDirectorPlan(plan, scene, visualProfile);
  directorJson = enrichDirectorForProduction(directorJson, plan, scene);
  // Silnik ciągłości (Filar 3): wstrzyknięcie kadru kontynuacji (absolutna ścieżka).
  // Robione TUTAJ (warstwa produkcji), nie w deterministycznym buildSceneDirectorPlan,
  // żeby nie naruszyć strażnika determinizmu payloadu GPU.
  if (startFrameOverride) {
    directorJson = { ...directorJson, start_frame_path: startFrameOverride, continuity_mode: 'last_frame' };
  }
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

  // Ekstrakcja klatek-kandydatów + klatki końcowej (do Pickera i auto-ciągłości).
  // Degraduje łagodnie — błąd ekstrakcji nie wywraca renderu klipu.
  let publicFrames = [];
  try {
    const framesDir = path.join(exportDir, 'frames');
    const frames = await extractClipFrames({
      videoPath: result.outputPath,
      framesDir,
      clipCode: clip.clip_code,
      count: CONTINUITY_FRAME_COUNT,
    });
    publicFrames = frames.map((f) => ({ ...f, path: toPublicOutputPath(outputDir, f.path) }));
  } catch (err) {
    console.warn(`[ProductionQueue] Ekstrakcja klatek ${clip.clip_code} nieudana — ciągłość do następnej sceny przerwana (fallback do kompozytu):`, err.message);
  }

  updateProductionClip(clip.id, {
    status: 'completed',
    progress: 100,
    outputPath: publicPath,
    frames: publicFrames,
    completedAt: new Date().toISOString(),
  });

  return { publicPath, lastFramePublic: pickLastFrame(publicFrames)?.path || null };
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
  let prevLastFrame = null;

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

      const startFrameOverride = resolveSceneStartFrame(scene, prevLastFrame, outputDir);

      let retryCount = 0;
      while (retryCount < MAX_CLIP_RETRIES) {
        try {
          const rendered = await renderClip(clip, scene, plan, visualProfile, engine, outputDir, exportDir, startFrameOverride, (c, p) => {
            const runProgress = Math.round(((completed + p / 100) / plan.scenes.length) * 100);
            updateProductionRun(run.id, { progress: runProgress });
          });
          prevLastFrame = rendered.lastFramePublic;
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
  // Silnik ciągłości: wznawiamy łańcuch od klatki końcowej ostatniego ukończonego klipu.
  let prevLastFrame = failedClipIndex > 0 ? (pickLastFrame(clips[failedClipIndex - 1]?.frames || [])?.path || null) : null;
  
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

      const startFrameOverride = resolveSceneStartFrame(scene, prevLastFrame, outputDir);
      
      let retryCount = 0;
      while (retryCount < MAX_CLIP_RETRIES) {
        try {
          const rendered = await renderClip(clip, scene, plan, visualProfile, engine, outputDir, exportDir, startFrameOverride, (c, p) => {
            const runProgress = Math.round(((completed + p / 100) / plan.scenes.length) * 100);
            updateProductionRun(productionRunId, { progress: runProgress });
          });
          prevLastFrame = rendered.lastFramePublic;
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
