# HANDOFF AKTUALNY — stan na teraz

**Ostatnia aktualizacja:** 2026-06-14 (sesja #18)  
**Sesja:** wdrożenie FAZY A (keystone) — pure-code, zero GPU/LLM, odwracalne

---

## ŹRÓDŁO PRAWDY (czytaj to, nie sprzeczne docs)

**Plan architektury:** `docs/11_OPUS_ARCHITECTURE_PROPOSAL.md` (śledzony w repo — działa w każdym oknie/klonie)  
Dokumentacja w `docs/` ma **wiele sprzecznych wersji** — NIE traktuj jej jako prawdy. Prawda = **`docs/11_OPUS_ARCHITECTURE_PROPOSAL.md` + realny kod**.

---

## ZŁOTA ZASADA (Nie zmieniać)

Nie usuwać `director.js`, `mockEngine.js`, `runComfyEngine.js`.  
`wan_workflow_api.json` = lokalny szablon; Studio wysyła pełny `workflow_api_json`.  
Nie dotykać `gema-0`.

---

## TL;DR — realny stan kodu (po Fazie A)

- **Aktywny UI:** Director's Desk (`/desk` → `/api/director-desk/*`) + Katalog + Projekty. ✅
- **Stary flow EpisodePlan:** legacy. Osierocone komponenty (`JobStatus.jsx`, `MobileSceneEditor.jsx`, `api.episodePlans`, `api.projects.createEpisode`) **usunięte** (Faza A, krok 5). ✅
- **Jeden kanał zapisu scen:** REST / Director's Desk / Scenarzysta zbiegają się do jednego writera w `episodeModels` (guard + walidacja). ✅
- **PlanValidator + frozen plan:** plan poza limitami silnika odrzucony przez kod; zaakceptowany plan jest zamrożony (`assertPlanEditable`). ✅
- **Legacy `POST /projects/:id/episodes`:** wycofany (410 → kreator Desk); tabela `episodes` i `GET/PUT/DELETE /episodes/:id` nietknięte. ✅
- **Render/produkcja:** działa przez `/episode-plans/:id/produce`, ale ma błędy logiczne renderu (Domino/determinizm/styl) — **Faza B+**. ⚠️
- **RunComfy GPU:** deployment za ciężki — bloker żywego WEBM. ❌
- **AI-Inżynier Studia:** nie istnieje w kodzie (Faza E). ❌

---

## KIERUNEK (zatwierdzony) — 3 rozdzielone AI + deterministyczny rdzeń

- **Scenarzysta** — plan w granicach `CAPABILITIES`, bez odlatywania.
- **Reżyser produkcji** — deterministyczna paczka GPU z zaakceptowanego planu (zero LLM w torze renderu).
- **AI-Inżynier Studia** — naprawa oprogramowania na żywo, z cofaniem (NIE drugi Reżyser).
- **Rdzeń (kod, nie AI):** PlanValidator, `@ID` compiler, stały seed, Domino, Strażnik Kosztów.

## ODRZUCONE kierunki (nie wracać)

- Programista `/dev` wg `07_DEV_AGENT_PLAN.md`, Cursor Cloud Agents jako tor naprawy, PR #9 (Groq /dev) jako Reżyser/Programista, Cursor w iframe, merge gema-0, „jeden chat robi wszystko".

---

## Błędy logiczne do naprawy (potwierdzone w kodzie)

1. **Domino martwe** — `continuity_mode:'last_frame'` ustawiany, nigdy nieczytany (`productionQueue.js` → `runComfyEngine.js`).
2. **Brak determinizmu** — losowy seed `Math.random()` w `runComfyEngine.js:184` + LLM temp 0.2–0.4.
3. **Podgląd ≠ produkcja** — produkcja omija `buildDynamicWorkflowPayload`; styl serialu nie trafia do `positive_prompt`.
4. **Brak stabilnych ID** — assety to losowe `uuid`; `executeAssetBinding` bierze pierwszą postać z bazy.
5. **Tło zamrożone** — `I2V_PRODUCTION` mrozi kadr (denoise+static+anchor); brak osi animacji tła.
6. **Dwóch planistów + 3 kanały zapisu scen** (screenwriter / agentTools / REST).
7. **Brak IP-Adapter** w workflow mimo deklaracji w prompcie.

---

## FAZA A (keystone) — ZROBIONE ✅

Pure-code, zero GPU/LLM, odwracalne (commit per krok):
1. ✅ **PlanValidator + frozen plan** — `assertPlanEditable` + `FROZEN_PLAN_STATUSES` w `episodeModels`; nowy `backend/src/ai/planValidator.js`.
2. ✅ **Jeden kanał zapisu scen** — screenwriter / agentTools / REST przez wspólny writer; test `sceneWriteChannel`.
3. ✅ **Martwe stany wizarda** — usunięte `setSceneAnchors`/`reorderScenes`; `canAdvance(ASSETS)` wymaga przypisanych assetów.
4. ✅ **Legacy POST odcinka** — `POST /projects/:id/episodes` → 410.
5. ✅ **Martwy frontend** — usunięte `JobStatus`, `MobileSceneEditor`, `api.episodePlans`, `api.projects.createEpisode`.
6. ✅ **Docs** — ten plik + `03_AGENT_STATE_AND_TASKS.md` startują z prawdy.

**Done:** plan poza limitami odrzucony przez kod; jeden kanał zapisu scen; docs zgodne z kodem; `npm test --prefix backend` = 92 pass; `vite build` OK.

## Następny krok — FAZA B (deterministyczny Reżyser)

`@ID` compiler (`ref_id`/`kind` w assetach), jeden builder promptu, stały seed, produkcja używa tej samej logiki co podgląd, wstrzyknięcie `style_tags`/anchor. **Done:** 2× ten sam plan = ten sam payload. Szczegóły: `docs/11_OPUS_ARCHITECTURE_PROPOSAL.md` (sekcja D).

---

## JAK URUCHOMIĆ

```bash
cd kebabkiller
npm run dev
npm test --prefix backend
```

- Frontend: http://localhost:5173 · Backend: `PORT` z `backend/.env` (proxy Vite czyta ten sam plik).

---

## Prompt do nowego czatu

```text
Wdrażamy plan: docs/11_OPUS_ARCHITECTURE_PROPOSAL.md

Tryb PLAN — zero edycji kodu, dopóki nie napiszę "OK, rób".
Źródło prawdy = docs/11_OPUS_ARCHITECTURE_PROPOSAL.md + realny kod. IGNORUJ sprzeczne docs.
FAZA A jest ZROBIONA (PlanValidator+frozen plan, jeden kanał zapisu scen,
sprzątnięty wizard/frontend, legacy POST=410). Teraz FAZA B (deterministyczny Reżyser).
Najpierw przeczytaj plan + kod: productionDirector.js, i2vProduction.js,
productionQueue.js, runComfyEngine.js (read-only), wanConfig.js, episodeModels.js.
Pokaż krótki plan Fazy B (pliki, kolejność, testy).
Nie dotykaj: director.js, mockEngine.js, runComfyEngine.js, gema-0, .env.
Przed i po zmianach: npm test --prefix backend.
```

**Koniec sesji:** `HANDOFF`

---

## Pliki kluczowe

```text
docs/11_OPUS_ARCHITECTURE_PROPOSAL.md                           ← źródło prawdy
backend/src/ai/screenwriter.js
backend/src/ai/directorDesk/agentTools.js
backend/src/ai/directorDesk/wizardStateMachine.js
backend/src/db/episodeModels.js
backend/src/api/routes.js
frontend/src/pages/DirectorsDesk.jsx
```
