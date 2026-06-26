/**
 * Snapshot (SSOT ciągłości) — warstwa content-addressed storage.
 *
 * "Zamraża" klatkę (klatkę końcową poprzedniego klipu LUB jawny wybór użytkownika)
 * w NIEMUTOWALNY plik adresowany treścią. Composite Key w storage (wymóg
 * infrastruktury): ścieżka to ZAWSZE
 *   storage/tenants/{tenant_id}/studio/snapshots/{sha256}.jpg
 * gdzie {tenant_id} jest czystym ASCII. Dzięki temu snapshot nie znika i nie
 * zmienia się, nawet jeśli zmienny plik `_last.jpg` zostanie nadpisany przez
 * ponowny render, a izolacja najemcy jest wymuszona już na poziomie ścieżki.
 * Następnie deleguje zapis wiersza do warstwy repozytorium (db/snapshotModels.js).
 *
 * To jest poprawka rdzennego anty-wzorca "Domino": scena N+1 nigdy nie sięga po
 * zmienny plik output/ sceny N — czyta swój własny, zamrożony Snapshot.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createSceneSnapshot } from '../db/snapshotModels.js';
import { assertTenantId } from '../tenant/tenantContext.js';

export function hashFileSha256(absPath) {
  const buf = fs.readFileSync(absPath);
  return crypto.createHash('sha256').update(buf).digest('hex');
}

/**
 * Buduje absolutną ścieżkę snapshotu wg obowiązującego standardu:
 *   {storageRoot}/storage/tenants/{tenant_id}/studio/snapshots/{sha256}.jpg
 * `tenantId` walidowany jako czyste ASCII (nie może zawierać znaków ścieżki).
 */
export function snapshotStoragePath(storageRoot, tenantId, sha256) {
  assertTenantId(tenantId);
  return path.join(storageRoot, 'storage', 'tenants', tenantId, 'studio', 'snapshots', `${sha256}.jpg`);
}

/**
 * Zamraża klatkę źródłową w content-addressed snapshot i zapisuje wiersz.
 *
 * @param {string} tenantId                  PIERWSZY, wymagany argument (czyste ASCII).
 * @param {object} params
 * @param {string} params.productionRunId
 * @param {string} params.sceneId            scena, dla której to jest stan STARTOWY
 * @param {number} params.sortOrder
 * @param {string} params.sourceAbsPath      absolutna ścieżka klatki źródłowej (na dysku)
 * @param {string} params.storageRoot        absolutny root storage (= OUTPUT_DIR, serwowany pod /output)
 * @param {(abs: string) => string} params.toPublic  mapper abs → public `/output/...`
 * @param {string} [params.source]           'continuation' | 'manual' | ...
 * @param {string|null} [params.originClipCode]
 * @returns {object|null} wiersz snapshotu (z polem `storage_abs`) lub null gdy źródło niedostępne
 */
export function freezeSnapshot(tenantId, {
  productionRunId,
  sceneId,
  sortOrder = 0,
  sourceAbsPath,
  storageRoot,
  toPublic,
  source = 'continuation',
  originClipCode = null,
}) {
  assertTenantId(tenantId);
  if (!sourceAbsPath || !fs.existsSync(sourceAbsPath)) return null;

  const contentHash = hashFileSha256(sourceAbsPath);
  const storageAbs = snapshotStoragePath(storageRoot, tenantId, contentHash);
  fs.mkdirSync(path.dirname(storageAbs), { recursive: true });

  // Content-addressed: jeśli plik o tej treści już istnieje, nie nadpisujemy
  // (niemutowalność). Inaczej kopiujemy raz.
  if (!fs.existsSync(storageAbs)) {
    fs.copyFileSync(sourceAbsPath, storageAbs);
  }

  const storagePath = toPublic(storageAbs);
  const snapshot = createSceneSnapshot(tenantId, {
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
