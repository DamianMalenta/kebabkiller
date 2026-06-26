# Architectural Audit — Continuity / Snapshot & Scene / Take Management

**Repo:** `DamianMalenta/kebabkiller` · **HEAD:** `1aeb3d7` (main) · **Date:** 2026-06-26

---

## 0. Premise Mismatch (read this first)

The audit brief assumes a **strict DDD, multi-Silo, multi-tenant, PHP 8+ stack** with **Redis Streams / SQL Outbox** for writes. The repository is **none of those**.

| Brief assumption | Reality in `kebabkiller` |
|---|---|
| PHP 8+ | **Node.js + Express** (ESM). Zero `.php` files. |
| DDD bounded contexts / isolated Silos | Single in-process **monolith**, organised by *technical layer* (`api/`, `db/`, `video/`, `ai/`), not by domain. |
| Multi-tenant with `tenant_id` everywhere | **No `tenant_id` exists anywhere** — schema, queries, or API. `grep -ri tenant backend/src` → 0 hits. |
| Reads via REST, writes via Redis Streams / SQL Outbox | Reads via REST (OK). Writes are **synchronous SQLite** inside the HTTP handler. "Async" production = in-process `setImmediate` + an in-memory `Map`. No Redis, no Outbox, no stream. |
| Immutable `Snapshot` SSOT, `Take` validated against it | **Neither entity exists.** Continuity is a mutable "Domino": the *last frame of the previous clip* is fed forward as the *start reference* of the next scene. |

Because the target architecture does not exist, **most rules below are violated by construction, not by a localized bug.** This is a greenfield-architecture gap, not a regression. The roadmap (§3) is therefore a *target-state* design; the PHP blocks are illustrative of the intended stack, and a pragmatic Node/SQLite equivalent is given alongside since that is what actually ships today.

---

## 1. Current State — where the logic lives

### 1.1 Domain location map

| Concept | Where it actually lives | Notes |
|---|---|---|
| **Scene** | `plan_scenes` table (`schema.sql:182`); `episodeModels.js` (`replacePlanScenes`, `normalizePlanSceneInput`, `setSceneStartFrame`) | Child of `episode_plans` via `episode_plan_id`. No tenant/project FK directly on the scene. |
| **Take / render attempt** | `production_clips` + `video_jobs` (`schema.sql`); `productionModels.js`; `productionQueue.js::renderClip` | A "Take" as *a transaction validated against a reference state* **does not exist**. A clip is a render attempt with `status`/`progress`/retries; nothing validates it against a frozen state. |
| **Snapshot (immutable reference state)** | **No dedicated entity.** Closest analogues: `projects.series_memory` + `series_memory_revisions` (project "canon"), `assets.composite_default_json` (Klatka Zero placement), `plan_scenes.start_frame_path` (continuation frame). | None are immutable, content-addressed, or versioned-as-state. `series_memory_revisions` is the only append-only-ish table, and it is LLM prose, not a render reference. |
| **Continuity ("Domino" / Filar 3)** | `video/frameExtractor.js` (`extractClipFrames`, `pickLastFrame`); `video/compositeStartFrame.js` (`buildStartFrameAsset`); `video/productionQueue.js` (`resolveSceneStartFrame`); `api/routes.js` (`/continuation-frames`, `/start-frame`); `ai/directorDesk/workflowBuilder.js` (`continuity_mode`); `frontend/.../ContinuityPicker.jsx` | This is the heart of the audit. See §1.2. |
| **ReferenceImage** | `asset_images` table + `characters.reference_path` / `backgrounds.reference_path`; `compositeStartFrame.js::resolveUploadPath` | Stored as filesystem paths under `/uploads`; not typed, not content-addressed. |

### 1.2 How continuity actually works (the "Domino")

The reference state for scene *N* is the **end frame of scene *N-1*'s rendered video**:

```
productionQueue.js::processEpisodeProduction
  prevLastFrame = null
  for scene in plan.scenes (ordered by sort_order):
     startFrameOverride = resolveSceneStartFrame(scene, prevLastFrame, outputDir)
     rendered = renderClip(..., startFrameOverride)
     prevLastFrame = rendered.lastFramePublic     # <-- end-of-scene image carried forward
```

```js
// productionQueue.js:58
function resolveSceneStartFrame(scene, prevLastFramePublic, outputDir) {
  if (scene.start_frame_path) { /* explicit user pick wins */ }
  if (scene.sort_order > 0 && prevLastFramePublic) {
    return toAbsoluteOutputPath(outputDir, prevLastFramePublic); // auto-continuity
  }
  return null; // scene 0 -> composite "Klatka Zero"
}
```

```js
// frameExtractor.js:92 — the "reference" is literally the last extracted frame
export function pickLastFrame(frames = []) {
  return frames.find((f) => f.is_last) || frames[frames.length - 1] || null;
}
```

`workflowBuilder.js:56` encodes the same rule declaratively: `continuity_mode = sort_order > 0 ? 'last_frame' : 'composite'`. The frame is injected into the GPU payload at render time in `renderClip` (`productionQueue.js:147`), deliberately *outside* the deterministic `buildSceneDirectorPlan` to avoid tripping the determinism golden test.

**Reads** are REST: `GET /episode-plans/:planId/scenes/:sceneId/continuation-frames` returns candidate frames; **writes** are REST too: `PUT .../start-frame` calls `setSceneStartFrame` → synchronous `UPDATE plan_scenes`.

---

## 2. Violations List

### CRITICAL

- **C1 — State Management: end-of-scene image is the start reference (no Snapshot SSOT).** Exactly the anti-pattern called out in the brief. `resolveSceneStartFrame` + `pickLastFrame(is_last)` feed the previous clip's final frame into the next scene. The "reference state" is a **mutable, derived, side-effecting JPEG on disk** (`/output/export/<ep>/frames/<clip>_last.jpg`), produced by `ffmpeg -sseof`. It is not immutable, not content-addressed, not validated. Drift compounds scene-over-scene.
- **C2 — No immutable Snapshot entity at all.** There is no table, value object, or hash representing "the frozen reference state of scene *N*". `start_frame_path` is a *public URL string* that can vanish from disk (the code even has a fall-through for "explicit pick not on disk"), so the reference is not durable and cannot be re-derived deterministically.
- **C3 — Multi-tenant rigor: `tenant_id` is entirely absent.** No query, repository method, or route enforces a tenant. The strongest boundary is `project_id`, and it is **nullable/optional**: `episode_plans.project_id` is nullable (`schema.sql:173`), `video_jobs.project_id` is nullable, and **`assets` have no project/tenant scope whatsoever** (global catalog). `getLatestProductionRun(planId)` and `getAsset(id)` resolve purely by primary key. Any caller with an `id` reads any tenant's data.

### HIGH

- **H1 — Silo isolation: continuity logic leaks across every layer.** A single concept (the continuation frame) is smeared across DB (`plan_scenes.start_frame_path`), filesystem (`/output/.../frames`), HTTP (`/start-frame` body), production orchestration (`productionQueue`), the GPU payload (`director_json.start_frame_path`), and the frontend picker. No module owns it; there is no bounded context boundary to violate because there are no boundaries.
- **H2 — Communication: writes are synchronous, not async via Redis Streams / Outbox.** State changes (`setSceneStartFrame`, `updateProductionClip`, `updateProductionRun`) are blocking SQLite writes in the request thread. The only "async" path, `enqueueEpisodeProduction`, is `setImmediate(() => process...)` guarded by an **in-memory `Map` (`activeProductions`)** — lost on restart, not durable, not distributable, no outbox, no replay.
- **H3 — Take is not a validated transaction.** A clip render (`renderClip`) mutates state and retries up to 3× but performs **no validation against a frozen reference**. `planValidator.js` validates the *plan* against engine limits, not a take against a snapshot. There is no optimistic-concurrency / version check.

### MEDIUM / LOW

- **M1 — Cross-context SQL joins.** Single SQLite DB; `render_summaries` FK-joins `video_jobs` + `projects` + `episodes`; production reads join `plan_scenes` ↔ `assets`. Technically "no cross-silo queries" only because there are no silos — but joins span what *should* be separate bounded contexts (catalog vs. planning vs. production vs. memory).
- **M2 — Data encoding: mostly disciplined, one gap.** Good: IDs are `uuidv4` (ASCII); `ref_id` is slugified to `^[a-z0-9_]+$` via `slugifyAssetName` (NFKD + diacritic strip, `episodeModels.js:62`); `director.js:115` explicitly forbids pasting Polish into JSON output; descriptions/JSON payloads are UTF-8 (Polish). Gap: **stored file paths are not normalized to ASCII** — uploaded filenames flow through `resolveUploadPath`/`path.basename` verbatim, so a UTF-8 upload name becomes part of a "technical" path. SKUs/keys rule is otherwise satisfied for `ref_id`.

---

## 3. Refactoring Roadmap — Snapshot as Single Source of Truth

Goal: replace the Domino with an **immutable, content-addressed `Snapshot`** that a `Take` is validated against, scoped by `tenant_id`, written via an Outbox.

> The blocks below are in **PHP 8+** as requested (target stack). Because the shipping code is Node/SQLite, a pragmatic JS equivalent is noted after each so this is actionable today.

### 3.1 Immutable Snapshot value object (content-addressed, frozen)

```php
<?php
declare(strict_types=1);

namespace Studio\Continuity\Domain;

/** Immutable reference state for the START of a scene. Single Source of Truth. */
final class Snapshot
{
    public function __construct(
        public readonly SnapshotId $id,          // ASCII ULID/UUID
        public readonly TenantId   $tenantId,    // MANDATORY
        public readonly SceneId    $sceneId,
        public readonly string     $contentHash, // sha256 of the image bytes (ASCII hex)
        public readonly string     $storageKey,  // ASCII, immutable object-store key
        public readonly int        $version,
        public readonly \DateTimeImmutable $createdAt,
    ) {}

    /** A snapshot is frozen: there is no setter and no "update". A change = a new Snapshot. */
    public static function freeze(
        TenantId $tenant, SceneId $scene, string $bytesSha256, string $storageKey, int $version
    ): self {
        return new self(
            SnapshotId::generate(), $tenant, $scene,
            $bytesSha256, $storageKey, $version, new \DateTimeImmutable()
        );
    }
}
```

*JS equivalent:* a `snapshots` table (`id, tenant_id, scene_id, content_hash, storage_key, version, created_at`, UNIQUE(`tenant_id`,`scene_id`,`version`)) + a frozen `Object.freeze` DTO. Replace `start_frame_path` (a mutable URL) with `snapshot_id` (FK to an immutable row). The image is stored content-addressed (`frames/<sha256>.jpg`) so it can never be silently overwritten.

### 3.2 Take = transaction validated against the Snapshot

```php
<?php
declare(strict_types=1);

namespace Studio\Continuity\Domain;

final class Take
{
    public function __construct(
        public readonly TakeId     $id,
        public readonly TenantId   $tenantId,
        public readonly SceneId    $sceneId,
        public readonly SnapshotId $basedOn,     // the SSOT it was rendered from
        public readonly int        $snapshotVersion,
    ) {}

    /** Reject a take whose snapshot drifted (optimistic concurrency on the SSOT). */
    public static function open(Snapshot $ref, SceneId $scene): self
    {
        if (!$ref->sceneId->equals($scene)) {
            throw new ContinuityViolation('Take references a snapshot from another scene.');
        }
        return new self(TakeId::generate(), $ref->tenantId, $scene, $ref->id, $ref->version);
    }

    public function assertStillValid(Snapshot $current): void
    {
        if ($current->version !== $this->snapshotVersion) {
            throw new StaleSnapshot("Snapshot v{$this->snapshotVersion} is stale; current v{$current->version}.");
        }
    }
}
```

*JS equivalent:* before `renderClip`, load the scene's `snapshot_id`+`version`; persist them on the `production_clips` row; re-check the version immediately before marking `completed`. This turns C1/H3 into a guarded transaction instead of a feed-forward side effect. **Auto-continuity (`sort_order>0 ? last_frame`) becomes: "promote the chosen frame into a NEW immutable Snapshot for scene N", never "reach into scene N-1's output dir".**

### 3.3 Tenant-scoped repository (C3 fix — `tenant_id` is non-optional)

```php
<?php
declare(strict_types=1);

namespace Studio\Continuity\Infrastructure;

final class SnapshotRepository
{
    public function __construct(private \PDO $db) {}

    public function ofScene(TenantId $tenant, SceneId $scene): ?Snapshot
    {
        // tenant_id is ALWAYS in the WHERE clause — no method can read cross-tenant.
        $stmt = $this->db->prepare(
            'SELECT * FROM snapshots
             WHERE tenant_id = :tenant AND scene_id = :scene
             ORDER BY version DESC LIMIT 1'
        );
        $stmt->execute([':tenant' => (string) $tenant, ':scene' => (string) $scene]);
        $row = $stmt->fetch(\PDO::FETCH_ASSOC);
        return $row ? SnapshotMapper::fromRow($row) : null;
    }
}
```

*JS equivalent:* add `tenant_id TEXT NOT NULL` to every domain table; make every `getDb().prepare(...)` in `episodeModels.js` / `productionModels.js` / `directorDeskModels.js` take a `tenantId` and include `WHERE tenant_id = ?`. Add a single choke-point helper so `getAsset(id)` cannot be called without a tenant. This is the largest mechanical change and the highest-priority fix.

### 3.4 Writes via Outbox (H2 fix — durable, replayable)

```php
<?php
declare(strict_types=1);

namespace Studio\Continuity\Application;

final class PromoteFrameToSnapshot
{
    public function __construct(private \PDO $db, private SnapshotRepository $repo) {}

    public function handle(TenantId $t, SceneId $scene, string $bytes): void
    {
        $this->db->beginTransaction();
        try {
            $prev = $this->repo->ofScene($t, $scene);
            $snap = Snapshot::freeze($t, $scene, hash('sha256', $bytes),
                                     ObjectStore::put($t, $bytes), ($prev?->version ?? 0) + 1);

            $this->insertSnapshot($snap);                 // state change
            $this->insertOutbox($t, 'snapshot.frozen', [  // SAME tx -> Outbox
                'snapshot_id' => (string) $snap->id, 'scene_id' => (string) $scene,
            ]);
            $this->db->commit();
        } catch (\Throwable $e) {
            $this->db->rollBack();
            throw $e;
        }
        // A relay process drains `outbox` -> Redis Stream `XADD continuity.events ...`
    }
}
```

*JS equivalent:* add an `outbox` table; in the same SQLite transaction as the state write, insert the event row; a small relay (interval/worker) reads unsent rows and `XADD`s to Redis, marking them sent. Replace the in-memory `activeProductions` Map + `setImmediate` with a durable job claimed off the stream so production survives restarts. Reads stay on REST (already compliant).

### 3.5 Module / Silo isolation (H1, M1) & encoding (M2)

- **Isolate** continuity into one module that owns Snapshot/Take/ReferenceImage: e.g. `backend/src/continuity/{domain,app,infra}`. Other layers depend on its **application service**, never on `plan_scenes.start_frame_path` or `/output` paths directly. No cross-context SQL join leaves the module; cross-context reads go through the REST API / events.
- **Encoding:** keep `ref_id` slug discipline; **additionally** normalize every stored technical path/key to ASCII at the boundary (content-addressed `frames/<sha256>.jpg` from §3.1 makes paths ASCII by construction). Keep descriptions/canon/JSON UTF-8.

---

## Appendix — Evidence index

- Domino / start-frame: `backend/src/video/productionQueue.js:58,64,91,147`, `backend/src/video/frameExtractor.js:76-93`, `backend/src/video/compositeStartFrame.js:82-95`
- Continuity API: `backend/src/api/routes.js:511-555`
- Continuity rule: `backend/src/ai/directorDesk/workflowBuilder.js:56,88,151`
- Schema (no `tenant_id`; nullable `project_id`): `backend/src/db/schema.sql`, `backend/src/db/init.js:66-178`
- Tenant absence: `grep -ri tenant backend/src` → 0 matches
- Repositories (PK/`project_id`-only scoping, synchronous): `backend/src/db/episodeModels.js`, `backend/src/db/productionModels.js`
- ASCII slug / UTF-8 boundary: `backend/src/db/episodeModels.js:62-77`, `backend/src/ai/director.js:115`
