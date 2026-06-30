/**
 * Montaż odcinka — sklejanie klipów scen w jeden plik (FFmpeg concat demuxer).
 * Klipy Wan 2.1 mają ten sam kodek i rozdzielczość → `-c copy` bez re-enkodowania.
 */
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const FFMPEG = process.env.FFMPEG_PATH || 'ffmpeg';

/** Ścieżka do wpisu w pliku listy concat (forward slashes, escape apostrofów). */
function escapeConcatPath(absPath) {
  return path.resolve(absPath).replace(/\\/g, '/').replace(/'/g, "'\\''");
}

/**
 * Łączy klipy w kolejności tablicy twardym cięciem (stream copy).
 * @param {string[]} clipPaths — absolutne ścieżki do plików wideo (ta sama kolejność co sceny)
 * @param {string} outputPath — docelowy plik (np. `.webm`)
 * @returns {Promise<string>} outputPath po sukcesie
 */
export async function stitchEpisodeClips(clipPaths, outputPath) {
  if (!Array.isArray(clipPaths) || clipPaths.length === 0) {
    throw new Error('Montaż: brak klipów do połączenia.');
  }

  for (const clipPath of clipPaths) {
    if (!clipPath || !fs.existsSync(clipPath)) {
      throw new Error(`Montaż: brak pliku klipu: ${clipPath || '(pusty)'}`);
    }
    const stat = fs.statSync(clipPath);
    if (!stat.isFile() || stat.size === 0) {
      throw new Error(`Montaż: klip pusty lub niedostępny: ${clipPath}`);
    }
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });

  const listContent = clipPaths.map((p) => `file '${escapeConcatPath(p)}'`).join('\n');
  const listPath = path.join(
    os.tmpdir(),
    `kk-concat-${Date.now()}-${Math.random().toString(36).slice(2)}.txt`,
  );

  try {
    fs.writeFileSync(listPath, listContent, 'utf8');
    await execFileAsync(FFMPEG, [
      '-y',
      '-f', 'concat',
      '-safe', '0',
      '-i', listPath,
      '-c', 'copy',
      outputPath,
    ], { maxBuffer: 10 * 1024 * 1024 });
  } catch (err) {
    const detail = (err.stderr || err.stdout || err.message || '').toString().trim();
    throw new Error(`Montaż FFmpeg nieudany: ${detail || 'nieznany błąd'}`);
  } finally {
    try {
      fs.unlinkSync(listPath);
    } catch {
      // plik tymczasowy już usunięty lub niedostępny
    }
  }

  if (!fs.existsSync(outputPath) || fs.statSync(outputPath).size === 0) {
    throw new Error('Montaż FFmpeg: plik wyjściowy nie powstał lub jest pusty.');
  }

  return outputPath;
}
