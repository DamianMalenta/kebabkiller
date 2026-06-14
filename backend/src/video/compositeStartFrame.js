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

/**
 * Domyślny composite (fallback "hardcoded" w kaskadzie) — odtwarza dotychczasowe
 * składanie: postać ~52% szerokości / 42% wysokości kadru, wyśrodkowana, dolna krawędź
 * na 90% wysokości (10% marginesu od dołu).
 *   scale       → szerokość postaci jako ułamek szerokości kadru
 *   heightScale → maks. wysokość postaci jako ułamek wysokości kadru (fit: inside)
 *   position.x  → poziomy środek postaci (0..1)
 *   position.y  → pionowe położenie DOLNEJ krawędzi postaci (0..1)
 */
export const DEFAULT_COMPOSITE = Object.freeze({
  scale: 0.52,
  heightScale: 0.42,
  position: Object.freeze({ x: 0.5, y: 0.9 }),
});

/**
 * Kaskada Klatki Zero (Faza C): override sceny → domyślna na assecie (@char) → fallback.
 * Wybór na poziomie obiektu (scena wygrywa w całości), brakujące pola dopełnia DEFAULT_COMPOSITE.
 */
export function resolveCompositeConfig(sceneComposite, assetComposite) {
  const chosen = sceneComposite ?? assetComposite ?? null;
  const pos = chosen?.position ?? {};
  return {
    scale: Number.isFinite(chosen?.scale) ? chosen.scale : DEFAULT_COMPOSITE.scale,
    heightScale: Number.isFinite(chosen?.heightScale) ? chosen.heightScale : DEFAULT_COMPOSITE.heightScale,
    position: {
      x: Number.isFinite(pos.x) ? pos.x : DEFAULT_COMPOSITE.position.x,
      y: Number.isFinite(pos.y) ? pos.y : DEFAULT_COMPOSITE.position.y,
    },
    source: chosen?.source ?? 'compose',
  };
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
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
  composite,
}) {
  const cfg = resolveCompositeConfig(composite, null);
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

  console.log(
    `[StartFrame] Składanie composite ${width}x${height}: tło + postać `
    + `(scale=${cfg.scale}, pos=${cfg.position.x}/${cfg.position.y})`,
  );
  const backgroundLayer = await sharp(bgBuffer)
    .resize(width, height, { fit: 'cover', position: 'centre' })
    .toBuffer();

  const charMaxWidth = Math.max(1, Math.round(width * cfg.scale));
  const charMaxHeight = Math.max(1, Math.round(height * cfg.heightScale));
  const characterLayer = await sharp(charBuffer)
    .resize(charMaxWidth, charMaxHeight, { fit: 'inside' })
    .toBuffer();

  const { width: charW, height: charH } = await sharp(characterLayer).metadata();
  // position.x = poziomy środek postaci; position.y = pionowa DOLNA krawędź postaci.
  const left = clamp(Math.round(width * cfg.position.x - charW / 2), 0, Math.max(0, width - charW));
  const top = clamp(Math.round(height * cfg.position.y - charH), 0, Math.max(0, height - charH));

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
