import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import sharp from 'sharp';
import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { initDatabase, closeDatabase } from '../db/init.js';
import {
  createEpisodePlan,
  acceptEpisodePlan,
  replacePlanScenes,
  getEpisodePlan,
  updateEpisodePlan,
  assertPlanFramesConfirmedForProduction,
  setSceneStartFrameSource,
  ensureSceneOneDarkroom,
} from '../db/episodeModels.js';
import { createSceneAsset } from '../db/darkroomModels.js';
import { START_FRAME_SOURCE } from '../video/startFrameSource.js';
import { processEpisodeProduction } from '../video/productionQueue.js';
import { getLatestProductionRun } from '../db/productionModels.js';

let dbPath;
let outputDir;
let uploadsDir;

function hasFfmpeg() {
  try {
    execFileSync(process.env.FFMPEG_PATH || 'ffmpeg', ['-version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

const FFMPEG = hasFfmpeg();

beforeEach(async () => {
  dbPath = path.join(os.tmpdir(), `kk-darkroom-queue-${Date.now()}.db`);
  outputDir = path.join(os.tmpdir(), `kk-darkroom-out-${Date.now()}`);
  uploadsDir = path.join(os.tmpdir(), `kk-darkroom-up-${Date.now()}`);
  fs.mkdirSync(uploadsDir, { recursive: true });
  initDatabase(dbPath);
});

afterEach(() => {
  closeDatabase();
  if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
  for (const dir of [outputDir, uploadsDir]) {
    if (dir && fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
  }
});

async function writeRawFrame(filename) {
  const rawDir = path.join(uploadsDir, 'raw');
  fs.mkdirSync(rawDir, { recursive: true });
  const abs = path.join(rawDir, filename);
  await sharp({
    create: { width: 720, height: 1280, channels: 3, background: { r: 120, g: 80, b: 40 } },
  }).jpeg().toFile(abs);
  return `/uploads/raw/${filename}`;
}

function configureDarkroomScenes(planId, { scene1Previous = false } = {}) {
  ensureSceneOneDarkroom(planId);
  const plan = getEpisodePlan(planId);
  for (const scene of plan.scenes) {
    if (scene.sort_order === 0) continue;
    setSceneStartFrameSource(
      scene.id,
      scene1Previous && scene.sort_order === 1
        ? START_FRAME_SOURCE.PREVIOUS_SCENE
        : START_FRAME_SOURCE.DARKROOM,
    );
  }
}

describe('productionQueue — Kinowa Ciemnia + start_frame_source', () => {
  test('assertPlanFramesConfirmed: darkroom per scena gdy oba mają źródło darkroom', () => {
    const plan = createEpisodePlan({ code: 'DR01', title: 'Darkroom', logline: 'Test' });
    replacePlanScenes(plan.id, [
      { descriptionPl: 'Scena A', durationSec: 4 },
      { descriptionPl: 'Scena B', durationSec: 4 },
    ]);
    configureDarkroomScenes(plan.id);

    createSceneAsset({
      episodePlanId: plan.id,
      rawImagePath: '/uploads/raw/a.jpg',
      status: 'APPROVED',
      aiProposedPrompt: 'Slow dolly back with fire glow.',
      sortOrder: 0,
    });
    createSceneAsset({
      episodePlanId: plan.id,
      rawImagePath: '/uploads/raw/b.jpg',
      status: 'APPROVED',
      aiProposedPrompt: 'Static camera, drifting smoke particles.',
      sortOrder: 1,
    });

    expect(() => assertPlanFramesConfirmedForProduction(plan.id)).not.toThrow();
  });

  test('assertPlanFramesConfirmed: previous_scene na scenie 2 — asset tylko na scenie 1', () => {
    const plan = createEpisodePlan({ code: 'DR01H', title: 'Hybrid', logline: 'Test' });
    replacePlanScenes(plan.id, [
      { descriptionPl: 'Scena A', durationSec: 4 },
      { descriptionPl: 'Scena B — ciągłość', durationSec: 4 },
    ]);
    configureDarkroomScenes(plan.id, { scene1Previous: true });

    createSceneAsset({
      episodePlanId: plan.id,
      rawImagePath: '/uploads/raw/a.jpg',
      status: 'APPROVED',
      aiProposedPrompt: 'Slow dolly back with fire glow.',
      sortOrder: 0,
    });

    expect(() => assertPlanFramesConfirmedForProduction(plan.id)).not.toThrow();
  });

  test('assertPlanFramesConfirmed: brak assetu na scenie darkroom → błąd', () => {
    const plan = createEpisodePlan({ code: 'DR01X', title: 'No anchor', logline: 'Test' });
    replacePlanScenes(plan.id, [
      { descriptionPl: 'Scena A', durationSec: 4 },
      { descriptionPl: 'Scena B', durationSec: 4 },
    ]);
    ensureSceneOneDarkroom(plan.id);
    const loaded = getEpisodePlan(plan.id);
    setSceneStartFrameSource(loaded.scenes[1].id, START_FRAME_SOURCE.DARKROOM);

    createSceneAsset({
      episodePlanId: plan.id,
      rawImagePath: '/uploads/raw/b.jpg',
      status: 'APPROVED',
      aiProposedPrompt: 'Only scene 2 has asset.',
      sortOrder: 1,
    });

    expect(() => assertPlanFramesConfirmedForProduction(plan.id)).toThrow(/Scena 1:.*Ciemni/);
  });

  test('ensureSceneOneDarkroom: scena 2+ bez kadru Ciemni dostaje ciągłość z poprzedniej', () => {
    const plan = createEpisodePlan({ code: 'DR01Y', title: 'No source', logline: 'Test' });
    replacePlanScenes(plan.id, [
      { descriptionPl: 'Scena A', durationSec: 4 },
      { descriptionPl: 'Scena B', durationSec: 4 },
    ]);
    ensureSceneOneDarkroom(plan.id);

    createSceneAsset({
      episodePlanId: plan.id,
      rawImagePath: '/uploads/raw/a.jpg',
      status: 'APPROVED',
      aiProposedPrompt: 'Anchor only.',
      sortOrder: 0,
    });

    const loaded = getEpisodePlan(plan.id);
    expect(loaded.scenes[1].start_frame_source).toBe(START_FRAME_SOURCE.PREVIOUS_SCENE);
    expect(() => assertPlanFramesConfirmedForProduction(plan.id)).not.toThrow();
  });

  (FFMPEG ? test : test.skip)('produkcja używa kadrów Ciemni według start_frame_source=darkroom', async () => {
    const plan = createEpisodePlan({ code: 'DR02', title: 'Darkroom render', logline: 'Test' });
    replacePlanScenes(plan.id, [
      { descriptionPl: 'Opis PL sceny — nie powinien trafić do GPU', durationSec: 4 },
    ]);
    ensureSceneOneDarkroom(plan.id);
    updateEpisodePlan(plan.id, { status: 'zaakceptowany' });

    const rawPath = await writeRawFrame('frame0.jpg');
    const motionPrompt = 'Slow pull-back with warm firelight and drifting embers, cinematic 8k.';

    createSceneAsset({
      episodePlanId: plan.id,
      rawImagePath: rawPath,
      status: 'APPROVED',
      aiProposedPrompt: motionPrompt,
      sortOrder: 0,
    });

    let captured;
    const engine = {
      name: 'mock-darkroom',
      async render(args) {
        captured = args;
        fs.mkdirSync(path.dirname(args.outputPath), { recursive: true });
        execFileSync(process.env.FFMPEG_PATH || 'ffmpeg', [
          '-y',
          '-f', 'lavfi',
          '-i', 'color=c=0x334455:s=480x832:d=1:r=24',
          '-c:v', 'libvpx-vp9',
          '-b:v', '0',
          '-crf', '40',
          '-pix_fmt', 'yuv420p',
          args.outputPath,
        ], { stdio: 'ignore' });
        return { outputPath: args.outputPath };
      },
    };

    const run = await processEpisodeProduction(plan.id, engine, outputDir, 'default', uploadsDir);

    expect(run.status).toBe('completed');
    expect(captured.userPrompt).toBe(motionPrompt);
    expect(captured.processedAssets.startFrame.source).toBe('darkroom');
    expect(captured.directorJson.continuity_mode).toBe('darkroom');
    expect(getEpisodePlan(plan.id).status).toBe('gotowy');
    expect(getLatestProductionRun(plan.id).clips[0].user_prompt).toBe(motionPrompt);
  }, 30000);
});
