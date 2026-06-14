# HANDOFF AKTUALNY — stan na teraz

**Ostatnia aktualizacja:** 2026-06-14 (sesja #17)  
**Sesja:** audyt kodu + ostateczna architektura (3 AI + deterministyczny rdzeń)

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

## TL;DR — realny stan kodu (zweryfikowany audytem)

- **Aktywny UI:** Director's Desk (`/desk` → `/api/director-desk/*`) + Katalog + Projekty. ✅
- **Stary flow EpisodePlan:** USUNIĘTY z UI; w repo zostały **osierocone** komponenty (`JobStatus.jsx`, `MobileSceneEditor.jsx`, cały `api.episodePlans`) — do sprzątnięcia. ⚠️
- **Render/produkcja:** działa przez `/episode-plans/:id/produce`, ale ma błędy logiczne (niżej). ⚠️
- **RunComfy GPU:** deployment za ciężki — bloker żywego WEBM. ❌
- **AI-Inżynier Studia:** nie istnieje w kodzie. ❌

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

## Co zrobić jako pierwsze — FAZA A (keystone)

Pure-code, zero GPU, odwracalne:
1. **Jeden planista** — scalić logikę (usunąć duplikację screenwriter vs agentTools vs REST).
2. **Twardy PlanValidator (kod)** jako granica Scenarzysta→Reżyser + frozen plan.
3. **Sprzątnięcie martwego frontendu** (osierocone komponenty starego flow).
4. **Naprawa docs** — HANDOFF + `03_AGENT_STATE_AND_TASKS.md` startują z prawdy.

**Done:** plan poza limitami silnika odrzucony przez kod; jeden kanał zapisu scen; testy zielone.

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
Najpierw przeczytaj plan + kod: screenwriter.js, directorDesk/agentTools.js,
wizardStateMachine.js, episodeModels.js, api/routes.js, DirectorsDesk.jsx.
Pracujemy TYLKO nad FAZĄ A. Pokaż krótki plan Fazy A (pliki, kolejność, testy).
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
