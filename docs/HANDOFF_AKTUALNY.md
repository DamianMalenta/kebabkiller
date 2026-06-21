# HANDOFF AKTUALNY — stan na teraz

**Ostatnia aktualizacja:** 2026-06-21 (audyt docs — synchronizacja dokumentacji z kodem po pracach Devina)
**Poprzednia sesja właściciela:** #21 (Faza E). Po niej: 5 PR-ów Devina (#13–#17) zmergowanych do main.

---

## ŹRÓDŁO PRAWDY (czytaj to, nie sprzeczne docs)

**Plan architektury:** `docs/11_OPUS_ARCHITECTURE_PROPOSAL.md` (śledzony w repo).
Dokumentacja w `docs/` ma **wiele sprzecznych wersji** — NIE traktuj jej jako prawdy. Prawda = **`docs/11` + realny kod**.

---

## ZŁOTA ZASADA (Nie zmieniać)

Nie usuwać/przepisywać hurtem: `director.js`, `mockEngine.js`, `runComfyEngine.js`.
`wan_workflow_api.json` = lokalny szablon; Studio wysyła pełny `workflow_api_json`.
Nie dotykać `gema-0`.

---

## TL;DR — stan kodu

- **Faza A** ✅ (PlanValidator + frozen plan, jeden kanał zapisu scen, sprzątnięty wizard/frontend, legacy POST=410).
- **Faza B** ✅ (deterministyczny Reżyser: `@ID`/`ref_id`, jeden builder, stały seed, podgląd==produkcja, golden test).
- **Faza C — część BEZ GPU** ✅ (sesja #20): osie I2V (kamera/tło/beats), żywe tło odpięte od kamery, Klatka Zero z kaskadą composite + podgląd kolażu 0 zł + panel UI.
- **Faza C — część GPU** ❌ ODŁOŻONA: node IP-Adapter, wpięcie composite/osi do realnego workflow, realny render klipu, AI-gen klatki. Bloker = **brak lekkiego deploymentu ComfyUI-Minimal** (stary jest za ciężki; proteza AMPERE_48 udowodniła pipeline, ale to nie docelowe).
- **Faza D — częściowo** ✅ (Devin PR #17): silnik ciągłości (Filar 3) — `frameExtractor.js` (ekstrakcja klatek z klipu), `resolveSceneStartFrame` (auto-ciągłość: last_frame z poprzedniej sceny), `ContinuityPicker.jsx` (Picker w UI), tabela `continuity_frames`. Domino + Picker **gotowe**. Resume partial do weryfikacji z GPU.
- **Faza E** ✅ (sesja #21): AI-Inżynier MVP — osobny moduł `backend/src/ai/systemAgent/` + `/api/system-agent/*` (bramka tokenem `SYSTEM_AGENT_TOKEN`), pętla diagnoza read-only → propose → apply (checkpoint git + bramka testów + auto-rollback) → [Cofnij] + Dziennik Napraw, panel UI „AI-Inżynier". Render-path NIETKNIĘTY.
- **Devin PRs #13–#16** (cross-cutting): refactor shared utils (`backend/src/utils/`), security hardening (helmet, rate limiting, path traversal), error handling, +90 unit testów.
- **Testy:** `npm test --prefix backend` = **227 total** (226 pass, 1 naprawiony w audycie); `vite build` OK.

---

## CO DZIAŁA / CO NIE

**Działa:** cały tor bez GPU. Podgląd kolażu Klatki Zero (`POST /composite/preview`, 0 zł) + panel w Katalogu (suwaki pozycja/skala/źródło, live preview). Pipeline B+C potwierdzony e2e na GPU (na protezie AMPERE_48). AI-Inżynier (Faza E) — pętla naprawcza z cofaniem; **wymaga ustawienia `SYSTEM_AGENT_TOKEN` w `backend/.env`** (bez tokena moduł jest wyłączony — bezpieczne domyślne; token wpisz też w panelu „AI-Inżynier"). Silnik ciągłości (Filar 3) — auto-ciągłość klatek + Picker w Director's Desk. Security: helmet + rate limiting + path traversal guard.
**Nie działa / brak:** docelowy lekki deployment RunComfy (ComfyUI-Minimal). Serwerowy graf ma bug KSampler (Studio ratuje się lokalnym `wan_workflow_api.json`).

---

## ZRÓB TO JAKO PIERWSZE

**Zbuduj nowy lekki deployment `ComfyUI-Minimal` w panelu ComfyUI Cloud** wg `docs/RUNCOMFY_DEPLOYMENT.md` (tylko wymagane node'y + 3 modele, BEZ ComfyUI-Manager), wklej Inference URL do `RUNCOMFY_ENDPOINT` w `backend/.env`. **Tego nie da się zrobić przez API/MCP — to operacja w panelu.**
Dopiero po tym ma sens TOR KOD Fazy C-GPU (IP-Adapter + wpięcie composite/osi do `runComfyEngine.js`/`wan_workflow_api.json` — pod review + zielonymi testami; sekcja H/63 na to pozwala).

---

## JAK URUCHOMIĆ

```bash
cd kebabkiller_studio2/kebabkiller
npm run dev
npm test --prefix backend
npm run status:dev
```

- Frontend: http://localhost:5174 · Backend: http://localhost:4005 (`PORT` + `FRONTEND_PORT` w `backend/.env`). Macius: :5173/:4001 — nie koliduje.

---

## Prompt do nowego czatu

```text
Kontynuuj Kebabkiller Studio. Źródło prawdy = docs/11_OPUS_ARCHITECTURE_PROPOSAL.md + realny kod.
Tryb PLAN — zero edycji kodu, dopóki nie napiszę "OK, rób".
Stan: Fazy A, B, C (bez GPU), E ZROBIONE. Faza D częściowo (Domino + Picker gotowe).
Część C-GPU odłożona do czasu zbudowania lekkiego deploymentu ComfyUI-Minimal (panel RunComfy, nie kod).
Najpierw przeczytaj docs/11 (sekcje D, F, H) + docs/RUNCOMFY_DEPLOYMENT.md.
Następne opcje: (a) TOR KOD Fazy C-GPU, (b) dokończenie Fazy D (resume partial),
(c) Faza F (Studio-lustro UI).
Nie dotykaj: gema-0, .env. Commit per krok, npm test --prefix backend przed i po.
```

**Koniec sesji:** `HANDOFF`

---

## Pliki kluczowe (zmienione od sesji #20)

```text
docs/11_OPUS_ARCHITECTURE_PROPOSAL.md          ← źródło prawdy
docs/RUNCOMFY_DEPLOYMENT.md                    ← jak zbudować lekki deployment
backend/src/video/wanConfig.js                 ← osie I2V (kamera/tło/beats)
backend/src/ai/directorDesk/workflowBuilder.js ← żywe tło + osie
backend/src/video/compositeStartFrame.js       ← kaskada composite + pozycja/skala
backend/src/video/frameExtractor.js            ← ekstrakcja klatek z klipu (Filar 3)
backend/src/video/productionQueue.js           ← resolveSceneStartFrame + ciągłość
backend/src/ai/systemAgent/                    ← AI-Inżynier (Faza E)
backend/src/utils/                             ← shared utilities (llm, json, async, prompt)
backend/src/db/episodeModels.js + schema.sql   ← continuity_frames + composite_default_json
backend/src/api/routes.js                      ← endpointy ciągłości + security
backend/src/index.js                           ← helmet + rate limiting
frontend/src/components/ContinuityPicker.jsx   ← Picker kadru kontynuacji
frontend/src/components/KlatkaZeroPanel.jsx    ← panel Klatki Zero
```
