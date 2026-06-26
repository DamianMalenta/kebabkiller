/**
 * Filar 3 — silnik ciągłości (kadr z poprzedniej sceny → start następnej).
 * Pokrywa: override klatki startowej, ekstrakcję klatek, łańcuch w produkcji,
 * jawny wybór sceny (Picker) i persystencję start_frame_path.
 */
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { initDatabase, closeDatabase } from '../db/init.js';
import {
  createEpisodePlan,
  createAsset,
  addAssetImage,
  getAsset,
  getEpisodePlan,
  replacePlanScenes,
  acceptEpisodePlan,
  setSceneStartFrame,
  normalizePlanSceneInput,
} from '../db/episodeModels.js';
import { buildStartFrameAsset } from '../video/compositeStartFrame.js';
import { extractClipFrames, pickLastFrame } from '../video/frameExtractor.js';
import { createMockEngine } from '../video/mockEngine.js';
import { processEpisodeProduction } from '../video/productionQueue.js';

function hasFfmpeg() {
  try {
    execFileSync(process.env.FFMPEG_PATH || 'ffmpeg', ['-version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}
const FFMPEG = hasFfmpeg();

function sha256File(absPath) {
  return crypto.createHash('sha256').update(fs.readFileSync(absPath)).digest('hex');
}

/** Public `/output/...` lub absolutną ścieżkę kadru → absolutna ścieżka na dysku (test helper). */
function toAbs(outDir, maybePath) {
  const str = String(maybePath);
  if (/^\/?output\//.test(str)) return path.join(outDir, str.replace(/^\/?output\//, ''));
  if (path.isAbsolute(str)) return str;
  return path.join(outDir, str);
}

let dbPath;
let outputDir;
let workDir;

beforeEach(() => {
  dbPath = path.join(os.tmpdir(), `kk-cont-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);
  outputDir = path.join(os.tmpdir(), `kk-cont-out-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  workDir = path.join(os.tmpdir(), `kk-cont-work-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  fs.mkdirSync(workDir, { recursive: true });
  initDatabase(dbPath);
});

afterEach(() => {
  closeDatabase();
  for (const dir of [outputDir, workDir]) {
    if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
  }
  if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
});

describe('buildStartFrameAsset — override kadru kontynuacji', () => {
  test('startFrameOverride wygrywa nad kompozytem (source=continuation)', async () => {
    const framePath = path.join(workDir, 'prev_last.jpg');
    await sharp({ create: { width: 64, height: 64, channels: 3, background: { r: 10, g: 200, b: 50 } } })
      .jpeg().toFile(framePath);

    const frame = await buildStartFrameAsset({
      characterRef: null,
      backgroundRef: null,
      uploadsDir: workDir,
      startFrameOverride: framePath,
    });

    expect(frame).not.toBeNull();
    expect(frame.source).toBe('continuation');
    expect(frame.data.startsWith('data:image/jpeg;base64,')).toBe(true);
  });

  test('brak pliku override → fallback do kompozytu/postaci, nie wywala', async () => {
    const charPath = path.join(workDir, 'char.jpg');
    await sharp({ create: { width: 64, height: 64, channels: 3, background: { r: 200, g: 10, b: 10 } } })
      .jpeg().toFile(charPath);

    const frame = await buildStartFrameAsset({
      characterRef: charPath,
      backgroundRef: null,
      uploadsDir: workDir,
      startFrameOverride: path.join(workDir, 'does-not-exist.jpg'),
    });

    expect(frame).not.toBeNull();
    expect(frame.source).not.toBe('continuation');
  });
});

describe('extractClipFrames', () => {
  test('nieistniejące wideo → pusta lista', async () => {
    const frames = await extractClipFrames({
      videoPath: path.join(workDir, 'nope.webm'),
      framesDir: path.join(workDir, 'frames'),
      clipCode: 'X_SC01',
    });
    expect(frames).toEqual([]);
  });

  (FFMPEG ? test : test.skip)('wyciąga klatki-kandydatów + klatkę końcową z prawdziwego wideo', async () => {
    const videoPath = path.join(workDir, 'clip.webm');
    execFileSync('ffmpeg', [
      '-y', '-f', 'lavfi', '-i', 'color=c=blue:s=160x288:d=2:r=24',
      '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '40', '-pix_fmt', 'yuv420p', videoPath,
    ], { stdio: 'ignore' });

    const framesDir = path.join(workDir, 'frames');
    const frames = await extractClipFrames({ videoPath, framesDir, clipCode: 'X_SC01', count: 4 });

    expect(frames.length).toBeGreaterThan(0);
    const last = pickLastFrame(frames);
    expect(last).not.toBeNull();
    expect(last.is_last).toBe(true);
    expect(fs.existsSync(last.path)).toBe(true);
  }, 30000);
});

describe('setSceneStartFrame + normalizacja', () => {
  test('normalizePlanSceneInput czyta snake_case i camelCase', () => {
    expect(normalizePlanSceneInput({ start_frame_path: '/output/a.jpg' }).startFramePath).toBe('/output/a.jpg');
    expect(normalizePlanSceneInput({ startFramePath: '/output/b.jpg' }).startFramePath).toBe('/output/b.jpg');
    expect(normalizePlanSceneInput({}).startFramePath).toBeNull();
  });

  test('ustawia i resetuje start_frame_path sceny', () => {
    const char = createAsset({ type: 'character', name: 'H', descriptionPl: 'k', canonEn: 'w' });
    addAssetImage(char.id, { path: '/uploads/h.jpg', isPrimary: true });
    const asset = getAsset(char.id);
    const plan = createEpisodePlan({ code: 'EC1', title: 't', logline: 'l', targetDurationSec: 8 });
    replacePlanScenes(plan.id, [
      { descriptionPl: 'A', durationSec: 4, assetId: char.id, assetImageId: asset.images[0].id },
    ]);
    const sceneId = getEpisodePlan(plan.id).scenes[0].id;

    const set = setSceneStartFrame(sceneId, '/output/export/EC1/frames/EC1_SC01_last.jpg');
    expect(set.start_frame_path).toBe('/output/export/EC1/frames/EC1_SC01_last.jpg');

    const reset = setSceneStartFrame(sceneId, null);
    expect(reset.start_frame_path).toBeNull();
  });
});

describe('łańcuch ciągłości w produkcji (mock engine)', () => {
  function buildPlan(code) {
    const char = createAsset({ type: 'character', name: `H_${code}`, descriptionPl: 'k', canonEn: 'w' });
    addAssetImage(char.id, { path: '/uploads/h.jpg', isPrimary: true });
    const asset = getAsset(char.id);
    const plan = createEpisodePlan({ code, title: 't', logline: 'l', targetDurationSec: 12 });
    replacePlanScenes(plan.id, [
      { descriptionPl: 'Scena 1', durationSec: 2, assetId: char.id, assetImageId: asset.images[0].id },
      { descriptionPl: 'Scena 2', durationSec: 2, assetId: char.id, assetImageId: asset.images[0].id },
      { descriptionPl: 'Scena 3', durationSec: 2, assetId: char.id, assetImageId: asset.images[0].id },
    ]);
    acceptEpisodePlan(plan.id);
    return plan;
  }

  (FFMPEG ? test : test.skip)('scena N>0 startuje z klatki końcowej poprzedniego klipu', async () => {
    const plan = buildPlan('EC2');
    const engine = createMockEngine(outputDir);
    const run = await processEpisodeProduction(plan.id, engine, outputDir);

    expect(run.status).toBe('completed');
    const clips = run.clips.sort((a, b) => a.sort_order - b.sort_order);

    // Scena 0 = kompozyt (brak kadru kontynuacji)
    expect(clips[0].director_json.start_frame_path == null).toBe(true);
    expect(clips[0].frames.length).toBeGreaterThan(0);

    // Sceny 1..N = niemutowalny Snapshot (SSOT) promowany z klatki końcowej poprzedniej sceny
    for (let i = 1; i < clips.length; i += 1) {
      expect(clips[i].director_json.continuity_mode).toBe('last_frame');
      const startPath = clips[i].director_json.start_frame_path;
      expect(typeof startPath).toBe('string');
      // Composite Key w storage: ścieżka to storage/tenants/{tenant_id}/studio/snapshots/<sha256>.jpg
      expect(startPath.replace(/\\/g, '/')).toContain('storage/tenants/default/studio/snapshots/');
      expect(path.basename(startPath)).toMatch(/^[a-f0-9]{64}\.jpg$/);
      expect(fs.existsSync(startPath)).toBe(true);
      // Hash zaszyty w nazwie == realny hash treści (immutable, weryfikowalny).
      expect(path.basename(startPath)).toBe(`${sha256File(startPath)}.jpg`);
      // Ciągłość zachowana: Snapshot to bajt-w-bajt kopia klatki końcowej poprzedniego klipu.
      const prevLast = pickLastFrame(clips[i - 1].frames);
      expect(sha256File(startPath)).toBe(sha256File(toAbs(outputDir, prevLast.path)));
    }
  }, 60000);

  (FFMPEG ? test : test.skip)('jawny wybór sceny (Picker) ma priorytet nad auto-ciągłością', async () => {
    const plan = buildPlan('EC3');
    const scenes = getEpisodePlan(plan.id).scenes.sort((a, b) => a.sort_order - b.sort_order);

    const customFrame = path.join(outputDir, 'export', 'EC3', 'frames', 'custom_pick.jpg');
    fs.mkdirSync(path.dirname(customFrame), { recursive: true });
    await sharp({ create: { width: 48, height: 80, channels: 3, background: { r: 1, g: 2, b: 3 } } })
      .jpeg().toFile(customFrame);
    setSceneStartFrame(scenes[2].id, '/output/export/EC3/frames/custom_pick.jpg');

    const engine = createMockEngine(outputDir);
    const run = await processEpisodeProduction(plan.id, engine, outputDir);
    const clips = run.clips.sort((a, b) => a.sort_order - b.sort_order);

    // Jawny wybór jest zamrażany jako Snapshot (source='manual') i wygrywa nad auto-ciągłością.
    const startPath = clips[2].director_json.start_frame_path;
    expect(startPath.replace(/\\/g, '/')).toContain('storage/tenants/default/studio/snapshots/');
    expect(path.basename(startPath)).toMatch(/^[a-f0-9]{64}\.jpg$/);
    expect(fs.existsSync(startPath)).toBe(true);
    // Treść Snapshotu == jawnie wybrana klatka (bajt-w-bajt).
    expect(sha256File(startPath)).toBe(sha256File(customFrame));
  }, 60000);
});
