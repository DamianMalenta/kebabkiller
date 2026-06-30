import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { stitchEpisodeClips } from '../video/montageEngine.js';

function hasFfmpeg() {
  try {
    execFileSync(process.env.FFMPEG_PATH || 'ffmpeg', ['-version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

const FFMPEG = hasFfmpeg();

describe('montageEngine', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = path.join(os.tmpdir(), `kk-montage-${Date.now()}`);
    fs.mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('stitchEpisodeClips rejects empty clip list', async () => {
    await expect(stitchEpisodeClips([], path.join(tmpDir, 'out.webm')))
      .rejects.toThrow('brak klipów');
  });

  (FFMPEG ? test : test.skip)('stitchEpisodeClips joins two webm clips with stream copy', async () => {
    const clipA = path.join(tmpDir, 'a.webm');
    const clipB = path.join(tmpDir, 'b.webm');
    const out = path.join(tmpDir, 'full.webm');

    for (const [file, color] of [[clipA, 'red'], [clipB, 'blue']]) {
      execFileSync(process.env.FFMPEG_PATH || 'ffmpeg', [
        '-y',
        '-f', 'lavfi',
        '-i', `color=c=${color}:s=320x240:d=1:r=24`,
        '-c:v', 'libvpx-vp9',
        '-b:v', '0',
        '-crf', '40',
        '-pix_fmt', 'yuv420p',
        file,
      ], { stdio: 'ignore' });
    }

    const result = await stitchEpisodeClips([clipA, clipB], out);
    expect(result).toBe(out);
    expect(fs.existsSync(out)).toBe(true);
    expect(fs.statSync(out).size).toBeGreaterThan(0);
  });
});
