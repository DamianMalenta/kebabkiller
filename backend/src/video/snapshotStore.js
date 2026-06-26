/**
 * Snapshot (SSOT ciągłości) — warstwa content-addressed storage.
 *
 * "Zamraża" klatkę (klatkę końcową poprzedniego klipu LUB jawny wybór użytkownika)
 * w NIEMUTOWALNY plik adresowany treścią: `frames/snap_<sha256>.jpg`. Dzięki temu
 * snapshot nie znika i nie zmienia się, nawet jeśli zmienny plik `_last.jpg`
 * zostanie nadpisany przez ponowny render. Następnie deleguje zapis wiersza do
 * warstwy repozytorium (db/snapshotModels.js).
 *
 * To jest poprawka rdzennego anty-wzorca "Domino": scena N+1 nigdy nie sięga po
 * zmienny plik output/ sceny N — czyta swój własny, zamrożony Snapshot.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createSceneSnapshot } from '../db/snapshotModels.js';

export function hashFileSha256(absPath) {
  const buf = fs.readFileSync(absPath);
  return crypto.createHash('sha256').update(buf).digest('hex');
}

/**
 * Zamraża klatkę źródłową w content-addressed snapshot i zapisuje wiersz.
 *
 * @param {object} params
 * @param {string} params.productionRunId
 * @param {string} params.sceneId            scena, dla której to jest stan STARTOWY
 * @param {number} params.sortOrder
 * @param {string} params.sourceAbsPath      absolutna ścieżka klatki źródłowej (na dysku)
 * @param {string} params.exportDir          absolutny katalog eksportu runu
 * @param {(abs: string) => string} params.toPublic  mapper abs → public `/output/...`
 * @param {string} [params.source]           'continuation' | 'manual' | ...
 * @param {string|null} [params.originClipCode]
 * @returns {object|null} wiersz snapshotu (z polem `storage_abs`) lub null gdy źródło niedostępne
 */
export function freezeSnapshot({
  productionRunId,
  sceneId,
  sortOrder = 0,
  sourceAbsPath,
  exportDir,
  toPublic,
  source = 'continuation',
  originClipCode = null,
}) {
  if (!sourceAbsPath || !fs.existsSync(sourceAbsPath)) return null;

  const contentHash = hashFileSha256(sourceAbsPath);
  const framesDir = path.join(exportDir, 'frames');
  fs.mkdirSync(framesDir, { recursive: true });

  const storageAbs = path.join(framesDir, `snap_${contentHash}.jpg`);
  // Content-addressed: jeśli plik o tej treści już istnieje, nie nadpisujemy
  // (niemutowalność). Inaczej kopiujemy raz.
  if (!fs.existsSync(storageAbs)) {
    fs.copyFileSync(sourceAbsPath, storageAbs);
  }

  const storagePath = toPublic(storageAbs);
  const snapshot = createSceneSnapshot({
    productionRunId,
    sceneId,
    sortOrder,
    contentHash,
    storagePath,
    source,
    originClipCode,
  });

  return { ...snapshot, storage_abs: storageAbs };
}
