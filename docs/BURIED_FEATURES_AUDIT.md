# Buried Treasure Audit — KebabKiller Studio

**Scope:** Full repo scan (backend + frontend)  
**Repo:** `DamianMalenta/kebabkiller`  
**Date:** 2026-06-28  
**Verdict:** Advanced ComfyUI nodes (`IPAdapter`, `ControlNet`, `FaceID`, `LoraLoader`) are **not implemented in executable code** — they exist as architecture/docs/prompt prose. Asset & continuity tooling **is implemented** but several pieces are **legacy, chat-only, or disconnected from the GPU render path**.

---

## Executive summary

| Target | Found in code? | Status |
|--------|----------------|--------|
| `IPAdapter` node | ❌ No ComfyUI node | Docs + LLM system prompt only; workflow uses `CLIPVisionEncode` as weak substitute |
| `ControlNet` / Depth / Canny | ❌ | Docs only (`docs/11_OPUS_ARCHITECTURE_PROPOSAL.md`) |
| `FaceID` | ❌ | Zero matches |
| `LoraLoader` | ❌ | Zero matches; “LoRA” appears once in deprecated LLM prompt |
| Character / Location libraries | ✅ | Dual stack: legacy `characters`/`backgrounds` + unified `assets` |
| 3D Blockouts | ❌ | Not in codebase |
| Asset/Actor selectors | ⚠️ Partial | Selectors in `KlatkaZeroPanel`; scene binding is chat/agent-only |
| Continuity / Snapshots | ✅ Backend | `snapshotStore` + `scene_snapshots`; UI = `ContinuityPicker` |

---

## BACKEND GHOSTS

### 1. Advanced AI nodes — what actually exists

#### A. ComfyUI workflow template (only GPU JSON in repo)

**File:** `backend/src/video/wan_workflow_api.json`

| Node ID | `class_type` | Role |
|---------|--------------|------|
| 54 | `WanImageToVideo` | Core I2V |
| 57 | `CLIPVisionLoader` | Vision encoder load |
| 58 | `CLIPVisionEncode` | Encodes start image (node 59) — **not** `IPAdapter` |
| 59 | `LoadImage` | Start frame input |
| 56 | `KSampler` | Sampling |
| 52 | `SaveWEBM` | Video output |

**Absent:** `IPAdapter`, `ControlNet`, `ControlNetApply`, `Canny`, `Depth`, `FaceID`, `LoraLoader`, or any depth-map nodes.

#### B. Workflow builder / injector (active, but basic)

**File:** `backend/src/video/runComfyEngine.js`

| Function | What it does | Advanced nodes? |
|----------|--------------|-----------------|
| `getWorkflowTemplate()` | Loads `wan_workflow_api.json` | — |
| `buildRunComfyWorkflow(jobId, userPrompt, directorJson, processedAssets)` | Clones template; sets nodes **53, 54, 55, 56, 59** (prompts, dimensions, seed, start image) | **No** IP-Adapter / ControlNet wiring |
| `resolveLoadImageInput()` | Resolves base64 / snapshot / `start_frame_path` → node 59 | — |
| `createRunComfyEngine().render()` | Calls `buildStartFrameAsset()` then `buildRunComfyWorkflow()` | Composite **not** passed (see disconnect §3) |

Commented-out advanced nodes: **none found** (no `// IPAdapter`, `/* ControlNet */`, etc.).

#### C. Dynamic workflow / I2V rules (continuity + profiles, not Comfy nodes)

**File:** `backend/src/ai/directorDesk/workflowBuilder.js`

| Export | Purpose |
|--------|---------|
| `buildDynamicRenderRules()` | `i2v_profile`, camera/background/beats axes, `continuity_mode` |
| `enrichDirectorForRender()` | Injects `style_tags`, living-background prompt, anchor |
| `buildDynamicWorkflowPayload()` | Calls `buildRunComfyWorkflow()` — same basic Wan chain |
| `previewWorkflowForScene()` | Preview payload for Director's Desk agent |

**File:** `backend/src/video/wanConfig.js` — `I2V_PROFILES` (`SMOKE`, `I2V_PRODUCTION`), `resolveWanRenderParams()`, `deterministicSeed()`.

#### D. Alternate GPU engine (fal.ai — also no advanced nodes)

**File:** `backend/src/video/falEngine.js` — `buildStartFrameAsset()` + fal/Kling/WAN API; no Comfy node graph.

#### E. IP-Adapter / LoRA / ControlNet as **text only** (not executable nodes)

| File | Location | Content |
|------|----------|---------|
| `backend/src/ai/director.js` | `SYSTEM_PROMPT_INTENT_ENGINE` (~L74) | “injected automatically via **LoRA/IP-Adapter**” — LLM instruction only |
| `backend/src/ai/director.js` | `@deprecated` header | Legacy director; endpoints withdrawn |
| `backend/src/ai/director.js` | `expandScenePrompt()`, `previewDirectorPlan()`, `suggestEpisodePrompts()` | Deprecated LLM pipeline still in repo + tests |
| `docs/11_OPUS_ARCHITECTURE_PROPOSAL.md` | Multiple sections | Planned: IP-Adapter node, ControlNet/depth, “double lock” identity |
| `docs/02_ARCHITECTURE.md` | L23 | Legacy doc: “IP-Adaptery, ControlNet” |
| `docs/HANDOFF_AKTUALNY.md`, `docs/03_AGENT_STATE_AND_TASKS.md` | — | Faza C-GPU deferred (IP-Adapter blocked on RunComfy deployment) |

**FaceID / LoraLoader / Canny / Depth / blockout:** **zero** backend `.js` / `.json` implementations.

---

### 2. Asset management — backend (active + legacy)

#### Schema (`backend/src/db/schema.sql`)

| Table / column | Purpose |
|----------------|---------|
| `characters`, `backgrounds` | **Legacy** knowledge base (Settings UI) |
| `assets` (`type`: character, location, prop, detail) | **F1 unified catalog** |
| `assets.composite_default_json` | Klatka Zero default placement per character |
| `assets.legacy_character_id`, `legacy_background_id` | Bridge legacy → catalog |
| `asset_images` | Multi-image per asset |
| `plan_scenes.asset_id`, `asset_image_id`, `location_asset_id` | Per-scene character + location binding |
| `plan_scenes.ai_overrides_json` | Scene GPU overrides + `composite` override |
| `plan_scenes.start_frame_path` | Continuity frame pick |
| `episode_plans.catalog_selection_json` | Catalog selection (API only) |
| `projects.default_character_id`, `default_background_id` | **Legacy project defaults — no frontend** |
| `scene_snapshots` | Immutable continuity SSOT |
| `production_clips.snapshot_id`, `snapshot_version` | Take validation vs snapshot |
| `plan_deliverables` | Missing-material tracking |

#### Core functions

| File | Functions |
|------|-----------|
| `backend/src/db/models.js` | `listCharacters`, `createCharacter`, `listBackgrounds`, … |
| `backend/src/db/episodeModels.js` | `listAssets`, `getAsset`, `createAsset`, `setAssetCompositeDefault`, `setSceneCompositeOverride`, `syncLegacyAssetsFromKnowledge`, `getCatalogForScreenwriter`, `setSceneStartFrame` |
| `backend/src/db/directorDeskModels.js` | `updateSceneOverrides`, `buildProjectBrain`, `setAssetImageMetadata` |
| `backend/src/ai/directorDesk/assetMetadata.js` | `buildDeterministicAssetMetadata()` |
| `backend/src/ai/directorDesk/storyboardMock.js` | `buildSceneStoryboardMock()` — layers from `asset_id` / `location_asset_id` |
| `backend/src/ai/productionDirector.js` | `resolveSceneAssetRefs()`, `buildSceneDirectorPlan()` → `character_ref`, `background_ref`, `@ref_id` |
| `backend/src/ai/directorDesk/agentTools.js` | `attachSceneAsset`, `upsertScene`, `linkCanonAsset`, `requestAssetUpload`, `updateSceneOverrides` |
| `backend/src/ai/screenwriter.js` | Episode proposals with `location_asset_id`, `deliverables` |
| `backend/src/video/compositeStartFrame.js` | `resolveCompositeConfig()`, `buildStartFrameAsset()` |
| `backend/src/video/snapshotStore.js` | `freezeSnapshot()` |
| `backend/src/db/snapshotModels.js` | `createSceneSnapshot()`, `validateTakeAgainstSnapshot()` |
| `backend/src/video/productionQueue.js` | `resolveSceneStartSnapshot()`, `promoteFrameToNextSnapshot()`, `renderClip()` |
| `backend/src/api/routes.js` | `/characters/*`, `/backgrounds/*`, `/assets/*`, `/composite/preview`, `/assets/:id/composite-default`, `/episode-plans/.../composite`, `/continuation-frames`, `/start-frame`, `/deliverables/*` |

#### Critical disconnect (backend)

`buildStartFrameAsset()` accepts `composite`, but **production engines omit it**:

- `runComfyEngine.js` `render()` (~L482–488): no `composite`
- `falEngine.js` `render()` (~L281–287): no `composite`

Only `POST /composite/preview` in `routes.js` (~L585–591) resolves the cascade `scene → asset → DEFAULT_COMPOSITE`. Saved Klatka Zero settings **do not reach GPU render** today.

Scene `ai_overrides.composite` is written by `setSceneCompositeOverride()` but **never read** in `productionDirector` or render engines.

---

### 3. Continuity backend (built, partially surfaced)

Wired in `productionQueue.js`: snapshot freeze, take validation, frame extraction, continuation injection via `start_frame_path`.

Documented gap: `SNAPSHOT_CONTINUITY_AUDIT.md` at repo root (architectural audit, not runtime code).

---

## FRONTEND GHOSTS

### Mounted & routed (`frontend/src/App.jsx`)

| Route | Component | Asset / continuity role |
|-------|-----------|-------------------------|
| `/catalog` | `Catalog.jsx` | Unified asset CRUD; types character/location/prop/detail; **`KlatkaZeroPanel`** |
| `/settings` | `Settings.jsx` | **Legacy** character + background library (“Baza Wiedzy”) |
| `/desk/:projectId` | `DirectorsDesk.jsx` | Chat wizard + **`ContinuityPicker`** |
| `/projects` | `Projects.jsx` + `ProjectEditor.jsx` | Series memory; **no** asset selectors |
| `/system-agent` | `SystemAgent.jsx` | Unrelated to assets |

---

### Dormant / unmounted / hidden UI

| File | Status | What it was for |
|------|--------|-----------------|
| `frontend/src/components/ProjectPickModal.jsx` | **Unmounted** — zero imports outside self | Modal to assign canon to a project |
| `frontend/src/components/MobileStepNav.jsx` | **Unmounted** | Mobile step jumper (Pomysł → Produkcja) |
| `MobileStickyAccept` (same file) | **Unmounted** | Sticky “Akceptuj plan” CTA |
| `KlatkaZeroPanel.jsx` | **Partially wired** | Mounted in Catalog only; `planId`/`sceneId` props **never passed** → “Zapisz override tej sceny” button hidden; scene override API exists but no UI entry point |
| `KlatkaZeroPanel` source `ai` | **Disabled in UI** | `{ value: 'ai', label: 'Generuj AI (GPU — odłożone)', enabled: false }` |
| Scene asset picker (visual) | **Missing** | `asset_id` / `location_asset_id` set only via Director's Desk **chat agent** (`attachSceneAsset`, `upsertScene`) — no dropdown UI |
| `ai_overrides` panel (camera, denoise, fps) | **Missing** | Backend `updateSceneOverrides` + `WorkflowPreview` widget only; **no** dedicated controls in React |
| Deliverables UI | **Missing** | Backend `/deliverables/*` + `screenwriter.js`; **zero** frontend references |
| `projects.default_character_id` / `default_background_id` | **Missing** | Schema + API accept fields; **no** frontend usage |
| `catalog_selection_json` | **Missing** | API only |
| Prop/detail asset workflow | **Catalog only** | Types exist in `Catalog.jsx`; no scene-binding UI for prop/detail |

---

### Mounted but limited asset UI

| File | Role | Limitation |
|------|------|------------|
| `AssetCard.jsx` | Card for catalog + settings | Display/edit only |
| `ContinuityPicker.jsx` | Frame picker per scene N>0 | Requires prior production render for frames |
| `SeriesBrainSidebar.jsx` | Read-only canon gallery | No attach/edit; `onRemoveTag` prop unused |
| `ChatWidgets.jsx` | `SceneCard`, `AssetUploadRequest`, `WorkflowPreview` | Agent-driven widgets; `AssetUploadRequest` points user to Catalog — no inline upload |
| `ProjectEditor.jsx` | Style bible + `SeriesMemoryPanel` | No character/location/default asset pickers |

---

### Dual asset libraries (intentional split, easy to confuse)

1. **Settings → Postacie / Tła** — legacy `api.characters` / `api.backgrounds`
2. **Catalog → Assety** — unified `api.assets` (used by episode production via `syncLegacyAssetsFromKnowledge`)

Production path uses **catalog** (`asset_id`, `location_asset_id`), not Settings forms directly.

---

## Architecture vs implementation (planned “treasure” map)

From `docs/11_OPUS_ARCHITECTURE_PROPOSAL.md` — **planned, not coded:**

```
Postać (@char)  → composite Klatka Zero + IP-Adapter (2nd identity lock)
Tło (@loc)      → depth ControlNet (geometry) + living background prompt
```

**What ships instead:**

```
Start frame     → sharp composite (DEFAULT_COMPOSITE hardcoded in prod) OR continuation JPEG/snapshot
Identity lock   → CLIPVisionEncode on composite image only
Geometry lock   → prompt text only (no depth map)
```

---

## Evidence index (quick navigation)

| Feature | Best file to open |
|---------|-------------------|
| Only workflow JSON | `backend/src/video/wan_workflow_api.json` |
| Workflow mutation | `backend/src/video/runComfyEngine.js` → `buildRunComfyWorkflow` |
| IP-Adapter prose (not node) | `backend/src/ai/director.js` L62–74 |
| Composite cascade (preview only) | `backend/src/api/routes.js` L575–609 |
| Composite disconnect in prod | `runComfyEngine.js` L482, `falEngine.js` L281 |
| Scene asset binding (data) | `backend/src/ai/productionDirector.js` → `resolveSceneAssetRefs` |
| Agent asset tools (no UI) | `backend/src/ai/directorDesk/agentTools.js` |
| Klatka Zero UI | `frontend/src/components/KlatkaZeroPanel.jsx` |
| Continuity UI | `frontend/src/components/ContinuityPicker.jsx` |
| Unmounted modals/nav | `ProjectPickModal.jsx`, `MobileStepNav.jsx` |
| Snapshot SSOT | `backend/src/video/snapshotStore.js`, `backend/src/db/snapshotModels.js` |

---

## Bottom line

**Not buried — actually built:** unified asset catalog, legacy knowledge base, Klatka Zero preview, composite defaults API, scene asset refs in DB, storyboard mocks, continuity picker, snapshot/take validation, I2V profile enrichment.

**Buried / disconnected / never built:**

- **All named advanced Comfy nodes** — roadmap + one LLM prompt line; workflow stops at `CLIPVisionEncode`.
- **Klatka Zero → production** — composite positioning saved in UI/DB but not passed to `buildStartFrameAsset()` in render engines.
- **Scene-level asset & advanced parameter UI** — agent/chat only; no visual Actor/Location selectors in Director's Desk.
- **Deliverables, project default characters, catalog selection, mobile step nav, project pick modal** — backend or components exist; UI not hooked up.
- **3D blockouts, location templates (as distinct from `type=location` assets), FaceID, LoraLoader** — not found in codebase.
