---
name: kinowa-ciemnia-pivot
description: Audytuje i planuje pivot KebabKiller Studio z wirtualnego 3D/suwaków na architekturę Kinowej Ciemni (bulk upload → Vision AI audit → kwarantanna → AI pre-processing → matryca scenopisu → równoległy Wan 2.1 → FFmpeg montaż). Używaj przy refaktorze architektury, inwentaryzacji kodu, decyzjach keep/_legacy, lub gdy user wspomina Ciemnię, Klatki Zero, pipeline produkcyjny.
disable-model-invocation: true
---

# Kinowa Ciemnia — pivot architektoniczny

## Docelowy pipeline (7 kroków)

1. **WSAD** — hurtowy upload surowych zdjęć z telefonu (produkt w realnej lokacji).
2. **AI AUDYT** — Vision AI analizuje zdjęcia, proponuje prompty naprawcze.
3. **KWARANTANNA** — UI karta (Zatwierdź / Popraw) per zdjęcie.
4. **PRE-PROCESSING** — zaakceptowane zdjęcia → inpainting / color grading → „Klatki Zero".
5. **MATRYCA SCENOPISU** — pary Start→Koniec = płynny ruch; pojedyncze = hard cut.
6. **RÓWNOLEGŁY WYPAŁ** — async sceny do Wan 2.1 z twardym denoise.
7. **AUTO-MONTAŻ** — FFmpeg na backendzie Node.js → gotowy `.mp4`.

## Zasady audytu

Przy każdym przeglądzie kodu klasyfikuj pliki do **4 sekcji** (raport po polsku):

| Sekcja | Pytanie |
|--------|---------|
| ZGODNE Z NOWĄ WIZJĄ | Co pasuje od razu? |
| PEREŁKI DO OCALENIA | Co jest fundamentem (auth, DB, upload, API)? |
| LEPSZE ROZWIĄZANIA W KODZIE | Co w kodzie jest mądrzejsze niż naiwny plan? |
| DO KWARANTANNY | Co do `_legacy`? |

**Złote zasady z repo (nie łamać):**
- Nie dotykać `gema-0`.
- Nie usuwać hurtem: `director.js`, `mockEngine.js`, `runComfyEngine.js`.
- `wan_workflow_api.json` = lokalny szablon; Studio wysyła pełny `workflow_api_json`.
- Stary `docs/11` opisuje poprzednią wizję (postać na tle) — pivot = nowy SSOT w docs + kod.

## Mapa reuse (skrót)

### ZGODNE / rozszerzyć

| Obszar | Ścieżki |
|--------|---------|
| Upload (pojedynczy) | `backend/src/api/routes.js` (multer), `frontend/src/pages/Catalog.jsx` |
| Plany + sceny | `backend/src/db/episodeModels.js`, `/episode-plans/*` |
| Produkcja + manifest | `backend/src/video/productionQueue.js`, `backend/src/db/productionModels.js` |
| Silnik Wan 2.1 | `backend/src/video/runComfyEngine.js`, `wan_workflow_api.json`, `wanConfig.js` |
| Alternatywa fal.ai | `backend/src/video/falEngine.js` |
| Mock bez GPU | `backend/src/video/mockEngine.js` |
| Karty + approval | `frontend/src/components/AssetCard.jsx`, `ChatWidgets.jsx` → `ConfirmationCard` |
| Scene matrix (szkielet) | `frontend/src/components/SceneWorkbench.jsx`, `SceneCard` |

### PEREŁKI (fundament)

| Obszar | Ścieżki |
|--------|---------|
| Walidacja planu | `backend/src/ai/planValidator.js`, `validateEpisodePlan` |
| Deterministyczny render | `backend/src/ai/productionDirector.js`, `deterministicSeed` w `wanConfig.js` |
| Enrichment GPU | `backend/src/ai/directorDesk/workflowBuilder.js` |
| Snapshot SSOT | `backend/src/video/snapshotStore.js`, `backend/src/db/snapshotModels.js` |
| FFmpeg (klatek) | `backend/src/video/frameExtractor.js` |
| Tenant + security | `backend/src/tenant/tenantContext.js`, helmet/rate-limit w `index.js` |
| LLM utils | `backend/src/utils/llm.js` (Vision audit) |
| API client | `frontend/src/api/client.js` |
| Job lifecycle | `frontend/src/utils/jobLifecycle.js` (orphan — podpiąć) |

### LEPSZE NIŻ NAIWNY PLAN

1. **Frozen plan + PlanValidator** — twardy stop przed GPU (nie tylko UI).
2. **Deterministyczny builder** (`productionDirector.js`) — zero LLM na torze renderu.
3. **Snapshot content-addressed** — lepsze niż mutowalne pliki `_last.jpg`.
4. **Dual engine** (`mock`/`runcomfy`/`fal`) — równoległość bez przepisywania submit/poll.
5. **Take validation** — odrzuca klip jeśli snapshot wyparty w trakcie renderu.
6. **Resume po `plan_scene_id`** — nie po indeksie tablicy (`resolveResumePoint`).
7. **Deliverables + resolve** — wzorzec „brak materiału → upload → zamknięcie luki".

### DO `_legacy`

| Obszar | Ścieżki |
|--------|---------|
| Legacy postacie/tła | `characters`/`backgrounds` tabele, `/characters/*`, `/backgrounds/*`, `Settings.jsx` tabs |
| Stary job queue | `backend/src/video/queue.js`, `/jobs/*`, `video_jobs` tabela |
| Composite @char+@loc | `compositeStartFrame.js` (kaskada sliderów), `/composite/preview`, `KlatkaZeroPanel.jsx` |
| Wizard martwy | `wizardStateMachine.js` (dead transitions), `storyboardMock.js` |
| Stary director LLM | `director.js` (render path — chroniony plik) |
| Stare odcinki | tabela `episodes`, `POST /projects/:id/episodes` → 410 OK |
| Orphan UI | `ProjectPickModal.jsx`, `MobileStepNav.jsx`, `MobileCompanionPanel`, default export `ContinuityPicker` |
| Canon na video_jobs | `canonPipeline.js` |
| Asset metadata bez Vision | `assetMetadata.js` — zastąpić Vision audit |
| Zewnętrzny montaż README | `productionQueue.js` `buildReadme` — zastąpić FFmpeg concat |

## Greenfield (brak w kodzie)

- `POST /ingest/bulk` + tabele `ingest_batches`, `ingest_photos`, `audit_results`
- Vision AI worker (propozycje promptów naprawczych)
- UI kwarantanny (grid kart ze statusami audit)
- `video/montage.js` — FFmpeg concat/xfade → `.mp4`
- Równoległy dispatcher w `productionQueue` (dziś: `for` sekwencyjny, L308)
- Logika pary Start→Koniec vs hard cut w matrycy

## Kolejność migracji (Plan Mode)

1. Schema + API ingest/kwarantanna (bez zmian render path).
2. Vision audit worker → statusy na zdjęciach.
3. Zatwierdzone zdjęcia → `assets` / `plan_scenes` (matryca).
4. `productionQueue` → pool równoległy + opcjonalne zależności snapshot.
5. `montageEpisode(runId)` + endpoint + UI download.
6. Przenieś composite/suwaki za flagę `_legacy`.

## Raport — szablon odpowiedzi

```markdown
# Audyt pivot: Kinowa Ciemnia

## 1. ZGODNE Z NOWĄ WIZJĄ
- [ścieżka] — dlaczego

## 2. PEREŁKI DO OCALENIA
- [ścieżka] — rola

## 3. LEPSZE ROZWIĄZANIA W KODZIE
- [mechanizm] — dlaczego lepszy

## 4. DO KWARANTANNY (_legacy)
- [ścieżka] — dlaczego sprzeczne
```

## Dodatkowe zasoby

- Szczegółowy audyt sesji: odpowiedź agenta z pełną listą plików.
- Stary SSOT (do zastąpienia): `docs/11_OPUS_ARCHITECTURE_PROPOSAL.md`.
- Handoff operacyjny: `docs/HANDOFF_AKTUALNY.md`.
