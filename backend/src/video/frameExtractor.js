/**
 * Silnik ciągłości (Filar 3) — ekstrakcja klatek z wygenerowanego klipu.
 *
 * Po wyrenderowaniu klipu wyciągamy:
 *   - klatkę KOŃCOWĄ (`is_last: true`) — domyślny start kolejnej sceny (auto-ciągłość),
 *   - N równomiernie rozłożonych klatek-kandydatów — do Pickera (użytkownik wybiera
 *     kadr z poprzedniej sceny na start następnej).
 *
 * Degraduje łagodnie: brak ffmpeg / nieczytelne wideo (np. placeholder mock) → [].
 */
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const FFMPEG = process.env.FFMPEG_PATH || 'ffmpeg';
const FFPROBE = process.env.FFPROBE_PATH || 'ffprobe';

async function probeDurationSec(videoPath) {
  try {
    const { stdout } = await execFileAsync(FFPROBE, [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      videoPath,
    ]);
    const dur = Number.parseFloat(String(stdout).trim());
    return Number.isFinite(dur) && dur > 0 ? dur : null;
  } catch {
    return null;
  }
}

async function extractFrameAt(videoPath, outPath, { seekArgs }) {
  try {
    await execFileAsync(FFMPEG, [
      '-y',
      ...seekArgs,
      '-i', videoPath,
      '-frames:v', '1',
      '-q:v', '3',
      outPath,
    ]);
    return fs.existsSync(outPath) && fs.statSync(outPath).size > 0;
  } catch {
    return false;
  }
}

/**
 * Wyciąga klatki-kandydatów + klatkę końcową z klipu.
 * @returns {Promise<Array<{ path, label, timestamp_sec, is_last }>>} absolutne ścieżki .jpg
 */
export async function extractClipFrames({ videoPath, framesDir, clipCode, count = 6 }) {
  if (!videoPath || !fs.existsSync(videoPath)) return [];
  fs.mkdirSync(framesDir, { recursive: true });

  const duration = await probeDurationSec(videoPath);
  const frames = [];

  if (duration) {
    const sampleCount = Math.max(1, count);
    for (let i = 0; i < sampleCount; i += 1) {
      const t = (duration * (i + 1)) / (sampleCount + 1);
      const outPath = path.join(framesDir, `${clipCode}_f${String(i + 1).padStart(2, '0')}.jpg`);
      // -ss przed -i = szybki, dokładny w praktyce dla I2V
      const ok = await extractFrameAt(videoPath, outPath, { seekArgs: ['-ss', t.toFixed(3)] });
      if (ok) {
        frames.push({ path: outPath, label: `${t.toFixed(1)}s`, timestamp_sec: Number(t.toFixed(3)), is_last: false });
      }
    }
  }

  // Klatka końcowa (auto-ciągłość). -sseof = seek od końca.
  const lastPath = path.join(framesDir, `${clipCode}_last.jpg`);
  const lastOk = await extractFrameAt(videoPath, lastPath, { seekArgs: ['-sseof', '-0.1'] })
    || await extractFrameAt(videoPath, lastPath, { seekArgs: [] });
  if (lastOk) {
    frames.push({
      path: lastPath,
      label: 'koniec',
      timestamp_sec: duration ? Number(duration.toFixed(3)) : null,
      is_last: true,
    });
  }

  return frames;
}

export function pickLastFrame(frames = []) {
  return frames.find((f) => f.is_last) || frames[frames.length - 1] || null;
}
