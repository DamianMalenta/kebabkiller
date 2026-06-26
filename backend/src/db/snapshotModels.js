/**
 * Snapshot (SSOT ciągłości) — warstwa repozytorium (czyste SQLite, bez fs).
 *
 * Snapshot to NIEMUTOWALNY, content-addressed (sha256) stan startowy sceny.
 * Tabela jest append-only: nie ma UPDATE ani DELETE. Każde "zamrożenie" tworzy
 * nową wersję per (production_run, scena). Take (production_clips) zapisuje
 * snapshot_id + snapshot_version, wobec których był renderowany.
 *
 * fs / hash / content-addressing realizuje warstwa video/snapshotStore.js — tu
 * trzymamy wyłącznie odczyt/zapis wiersza, zgodnie ze stylem pozostałych modeli.
 */
import { v4 as uuidv4 } from 'uuid';
import { getDb } from './init.js';

/** Najwyższa istniejąca wersja snapshotu dla (run, scena); 0 gdy brak. */
export function latestSnapshotVersion(productionRunId, sceneId) {
  const row = getDb().prepare(`
    SELECT MAX(version) AS v FROM scene_snapshots
    WHERE production_run_id = ? AND scene_id = ?
  `).get(productionRunId, sceneId);
  return row?.v ?? 0;
}

/** Najnowszy (najwyższa wersja) snapshot startowy danej sceny w danym runie. */
export function getLatestSceneSnapshot(productionRunId, sceneId) {
  return getDb().prepare(`
    SELECT * FROM scene_snapshots
    WHERE production_run_id = ? AND scene_id = ?
    ORDER BY version DESC LIMIT 1
  `).get(productionRunId, sceneId) || null;
}

export function getSceneSnapshot(id) {
  if (!id) return null;
  return getDb().prepare('SELECT * FROM scene_snapshots WHERE id = ?').get(id) || null;
}

export function listSceneSnapshots(productionRunId, sceneId) {
  return getDb().prepare(`
    SELECT * FROM scene_snapshots
    WHERE production_run_id = ? AND scene_id = ?
    ORDER BY version ASC
  `).all(productionRunId, sceneId);
}

/**
 * Append-only zapis snapshotu. Wersja jest auto-inkrementowana, gdy nie podano.
 * Idempotencja po treści: jeśli najnowszy snapshot sceny ma identyczny
 * `content_hash`, zwracamy go zamiast tworzyć duplikat wersji.
 */
export function createSceneSnapshot({
  productionRunId,
  sceneId,
  sortOrder = 0,
  contentHash,
  storagePath,
  source = 'continuation',
  originClipCode = null,
}) {
  if (!productionRunId || !sceneId) throw new Error('createSceneSnapshot: productionRunId i sceneId są wymagane.');
  if (!contentHash || !storagePath) throw new Error('createSceneSnapshot: contentHash i storagePath są wymagane.');

  const existing = getLatestSceneSnapshot(productionRunId, sceneId);
  if (existing && existing.content_hash === contentHash) {
    return existing;
  }

  const id = uuidv4();
  const version = (existing?.version ?? 0) + 1;
  getDb().prepare(`
    INSERT INTO scene_snapshots (
      id, production_run_id, scene_id, sort_order, version,
      content_hash, storage_path, source, origin_clip_code
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, productionRunId, sceneId, sortOrder, version, contentHash, storagePath, source, originClipCode);

  return getSceneSnapshot(id);
}

/**
 * Walidacja Take wobec Snapshotu (optymistyczna kontrola współbieżności).
 * Czysta funkcja — testowalna bez bazy.
 *
 * @param {object} params
 * @param {string|null} params.clipSnapshotId   snapshot zapisany na klipie
 * @param {number|null} params.clipSnapshotVersion
 * @param {object|null} params.currentSnapshot  aktualny (najnowszy) snapshot sceny
 * @param {boolean}     params.storageExists    czy plik snapshotu istnieje na dysku
 * @returns {{ ok: boolean, reason: string|null }}
 */
export function validateTakeAgainstSnapshot({
  clipSnapshotId,
  clipSnapshotVersion,
  currentSnapshot,
  storageExists,
}) {
  // Scena bez snapshotu (np. scena 0 = kompozyt Klatki Zero) — nic do walidacji.
  if (!clipSnapshotId) return { ok: true, reason: null };

  if (!currentSnapshot) {
    return { ok: false, reason: 'snapshot_missing' };
  }
  if (currentSnapshot.id !== clipSnapshotId) {
    return { ok: false, reason: 'snapshot_superseded' };
  }
  if (clipSnapshotVersion != null && currentSnapshot.version !== clipSnapshotVersion) {
    return { ok: false, reason: 'version_mismatch' };
  }
  if (storageExists === false) {
    return { ok: false, reason: 'storage_missing' };
  }
  return { ok: true, reason: null };
}
