import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

export function resolveUploadPath(referencePath, uploadsDir) {
  if (!referencePath || !uploadsDir) return null;

  if (fs.existsSync(referencePath)) return referencePath;

  const normalized = referencePath.replace(/\\/g, '/');
  const uploadsMatch = normalized.match(/^\/?uploads\/(.+)$/i);
  if (uploadsMatch) {
    return path.join(uploadsDir, uploadsMatch[1]);
  }

  if (!normalized.includes('/')) {
    return path.join(uploadsDir, normalized);
  }

  return path.join(uploadsDir, path.basename(normalized));
}

function toDataUri(buffer, mimeType = 'image/jpeg') {
  return `data:${mimeType};base64,${buffer.toString('base64')}`;
}

async function loadImageBuffer(imagePath) {
  if (!imagePath || !fs.existsSync(imagePath)) return null;
  return fs.readFileSync(imagePath);
}

/**
 * Builds a 9:16 start frame: background (cover) + character (centered lower third).
 * Returns { type: 'base64', data, source: 'composite'|'character'|'background' } or null.
 */
export async function buildStartFrameAsset({
  characterRef,
  backgroundRef,
  uploadsDir,
  width = 480,
  height = 832,
}) {
  const charPath = resolveUploadPath(characterRef, uploadsDir);
  const bgPath = resolveUploadPath(backgroundRef, uploadsDir);

  const charBuffer = await loadImageBuffer(charPath);
  const bgBuffer = await loadImageBuffer(bgPath);

  if (!charBuffer && !bgBuffer) {
    console.warn('[StartFrame] Brak obrazów postaci i tła — pomijam klatkę startową.');
    return null;
  }

  if (charBuffer && !bgBuffer) {
    console.log('[StartFrame] Tylko postać (brak ref tła) — wysyłam oryginalny ref postaci.');
    return {
      type: 'base64',
      data: toDataUri(charBuffer, mimeFromPath(charPath)),
      source: 'character',
    };
  }

  if (!charBuffer && bgBuffer) {
    console.log('[StartFrame] Tylko tło — wysyłam samo tło jako klatkę startową.');
    const frame = await sharp(bgBuffer).resize(width, height, { fit: 'cover', position: 'centre' }).jpeg({ quality: 92 }).toBuffer();
    return { type: 'base64', data: toDataUri(frame), source: 'background' };
  }

  console.log(`[StartFrame] Składanie composite ${width}x${height}: tło + postać`);
  const backgroundLayer = await sharp(bgBuffer)
    .resize(width, height, { fit: 'cover', position: 'centre' })
    .toBuffer();

  const charMaxWidth = Math.round(width * 0.52);
  const charMaxHeight = Math.round(height * 0.42);
  const characterLayer = await sharp(charBuffer)
    .resize(charMaxWidth, charMaxHeight, { fit: 'inside' })
    .toBuffer();

  const { width: charW, height: charH } = await sharp(characterLayer).metadata();
  const left = Math.max(0, Math.round((width - charW) / 2));
  const top = Math.max(0, Math.round(height - charH - height * 0.1));

  const composed = await sharp(backgroundLayer)
    .composite([{ input: characterLayer, left, top }])
    .jpeg({ quality: 92 })
    .toBuffer();

  return {
    type: 'base64',
    data: toDataUri(composed),
    source: 'composite',
  };
}

function mimeFromPath(filePath) {
  const ext = path.extname(filePath || '').toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  return 'image/jpeg';
}
