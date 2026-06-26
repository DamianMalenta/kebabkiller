/**
 * Snapshot (SSOT ciągłości) — warstwa repozytorium (czyste SQLite, bez fs).
 *
 * Snapshot to NIEMUTOWALNY, content-addressed (sha256) stan startowy sceny.
 * Tabela jest append-only: nie ma UPDATE ani DELETE. Każde "zamrożenie" tworzy
 * nową wersję per (tenant, production_run, scena). Take (production_clips)
 * zapisuje snapshot_id + snapshot_version, wobec których był renderowany.
 *
 * fs / hash / content-addressing realizuje warstwa video/snapshotStore.js — tu
 * trzymamy wyłącznie odczyt/zapis wiersza, zgodnie ze stylem pozostałych modeli.
 *
 * MULTI-TENANT (ślepy odczyt, zero global lookups):
 *   - `tenantId` jest PIERWSZYM, WYMAGANYM argumentem każdej metody,
 *   - każde zapytanie ma `WHERE tenant_id = :tenant_id` (egzekwowane przez guard
 *     scripts/checkTenantScope.mjs — SQL bez tego filtra blokuje build),
 *   - `tenant_id` jest walidowany jako czyste ASCII przy zapisie.
 */
import { v4 as uuidv4 } from 'uuid';
import { getDb } from './init.js';
import { assertTenantId } from '../tenant/tenantContext.js';

/** Najwyższa istniejąca wersja snapshotu dla (tenant, run, scena); 0 gdy brak. */
export function latestSnapshotVersion(tenantId, productionRunId, sceneId) {
  assertTenantId(tenantId);
  const row = getDb().prepare(`
    SELECT MAX(version) AS v FROM scene_snapshots
    WHERE tenant_id = :tenant_id AND production_run_id = :production_run_id AND scene_id = :scene_id
  `).get({ tenant_id: tenantId, production_run_id: productionRunId, scene_id: sceneId });
  return row?.v ?? 0;
}

/** Najnowszy (najwyższa wersja) snapshot startowy danej sceny w danym runie. */
export function getLatestSceneSnapshot(tenantId, productionRunId, sceneId) {
  assertTenantId(tenantId);
  return getDb().prepare(`
    SELECT * FROM scene_snapshots
    WHERE tenant_id = :tenant_id AND production_run_id = :production_run_id AND scene_id = :scene_id
    ORDER BY version DESC LIMIT 1
  `).get({ tenant_id: tenantId, production_run_id: productionRunId, scene_id: sceneId }) || null;
}

export function getSceneSnapshot(tenantId, id) {
  assertTenantId(tenantId);
  if (!id) return null;
  return getDb().prepare(`
    SELECT * FROM scene_snapshots
    WHERE tenant_id = :tenant_id AND id = :id
  `).get({ tenant_id: tenantId, id }) || null;
}

export function listSceneSnapshots(tenantId, productionRunId, sceneId) {
  assertTenantId(tenantId);
  return getDb().prepare(`
    SELECT * FROM scene_snapshots
    WHERE tenant_id = :tenant_id AND production_run_id = :production_run_id AND scene_id = :scene_id
    ORDER BY version ASC
  `).all({ tenant_id: tenantId, production_run_id: productionRunId, scene_id: sceneId });
}

/**
 * Append-only zapis snapshotu. Wersja jest auto-inkrementowana, gdy nie podano.
 * Idempotencja po treści: jeśli najnowszy snapshot sceny ma identyczny
 * `content_hash`, zwracamy go zamiast tworzyć duplikat wersji.
 *
 * @param {string} tenantId  PIERWSZY, wymagany argument (czyste ASCII).
 */
export function createSceneSnapshot(tenantId, {
  productionRunId,
  sceneId,
  sortOrder = 0,
  contentHash,
  storagePath,
  source = 'continuation',
  originClipCode = null,
}) {
  assertTenantId(tenantId);
  if (!productionRunId || !sceneId) throw new Error('createSceneSnapshot: productionRunId i sceneId są wymagane.');
  if (!contentHash || !storagePath) throw new Error('createSceneSnapshot: contentHash i storagePath są wymagane.');

  const existing = getLatestSceneSnapshot(tenantId, productionRunId, sceneId);
  if (existing && existing.content_hash === contentHash) {
    return existing;
  }

  const id = uuidv4();
  const version = (existing?.version ?? 0) + 1;
  getDb().prepare(`
    INSERT INTO scene_snapshots (
      id, tenant_id, production_run_id, scene_id, sort_order, version,
      content_hash, storage_path, source, origin_clip_code
    ) VALUES (
      :id, :tenant_id, :production_run_id, :scene_id, :sort_order, :version,
      :content_hash, :storage_path, :source, :origin_clip_code
    )
  `).run({
    id,
    tenant_id: tenantId,
    production_run_id: productionRunId,
    scene_id: sceneId,
    sort_order: sortOrder,
    version,
    content_hash: contentHash,
    storage_path: storagePath,
    source,
    origin_clip_code: originClipCode,
  });

  return getSceneSnapshot(tenantId, id);
}

/**
 * Walidacja Take wobec Snapshotu (optymistyczna kontrola współbieżności).
 * Czysta funkcja — testowalna bez bazy. Nie dotyka SQL, więc nie podlega
 * regule WHERE tenant_id; izolację najemcy zapewnia warstwa odczytu, która
 * dostarcza tu `currentSnapshot` już zawężony do tenant_id.
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
