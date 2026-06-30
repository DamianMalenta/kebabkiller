# HANDOFF AKTUALNY — stan na teraz

**Ostatnia aktualizacja:** 2026-06-30 (P0: Klatka Zero gate backend + lock produkcji w SQLite; Wave 3 ≠ done)
**Poprzednia sesja właściciela:** #21 (Faza E). Po niej: PR #13–#17, potem PR #20–#22 (ciągłość / snapshot).

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
- **Faza D — częściowo** ✅ (PR #17 + **#20–#22**): silnik ciągłości (Filar 3) z **Snapshot SSOT** (zamiast antywzorca „Domino”), walidacja Take vs zamrożony Snapshot, Picker w UI (`ContinuityPicker.jsx`), resume partial po `plan_scene_id` (fix #21). Tenant-scope snapshotów (#22, na razie `default`). **Do weryfikacji e2e z GPU:** pełny odcinek 3 scen + retry po partial failure.
- **Faza E** ✅ (sesja #21): AI-Inżynier MVP — osobny moduł `backend/src/ai/systemAgent/` + `/api/system-agent/*` (bramka tokenem `SYSTEM_AGENT_TOKEN`), pętla diagnoza read-only → propose → apply (checkpoint git + bramka testów + auto-rollback) → [Cofnij] + Dziennik Napraw, panel UI „AI-Inżynier". Render-path NIETKNIĘTY.
- **Devin PRs #13–#16** (cross-cutting): refactor shared utils (`backend/src/utils/`), security hardening (helmet, rate limiting, path traversal), error handling, +90 unit testów.
- **Devin PRs #20–#22** (ciągłość): `scene_snapshots` + `snapshotStore.freezeSnapshot` + `validateTakeAgainstSnapshot`; fix superseded snapshot (#21); `resolveResumePoint` po tożsamości sceny (#21); `tenantContext.js` + guard `checkTenantScope.mjs` (#22). Audyt: `SNAPSHOT_CONTINUITY_AUDIT.md`.
- **Testy:** `npm test --prefix backend` = **257 pass** (3 skipped); `vite build` OK.
- **Tor Twórcy Wave 0–2 + 4 (UI/API):** ✅ ProductionPanel, PlanReadiness, recovery, Katalog, mobile, resume API, ZIP.
- **Tor Twórcy Wave 3:** ❌ **NIE DONE** — brak ComfyUI-Minimal deployment + smoke WEBM na GPU. Backend P0 (2026-06-30): `assertPlanFramesConfirmedForProduction` na produce/accept+produce; lock produkcji w DB (`idx_production_runs_one_active_per_plan`), bez `activeProductions` Map.

---

## CO DZIAŁA / CO NIE

**Działa:** cały tor bez GPU. Podgląd kolażu Klatki Zero (`POST /composite/preview`, 0 zł) + panel w Katalogu (suwaki pozycja/skala/źródło, live preview). Pipeline B+C potwierdzony e2e na GPU (na protezie AMPERE_48). AI-Inżynier (Faza E) — pętla naprawcza z cofaniem; **wymaga ustawienia `SYSTEM_AGENT_TOKEN` w `backend/.env`** (bez tokena moduł jest wyłączony — bezpieczne domyślne; token wpisz też w panelu „AI-Inżynier"). Ciągłość: zamrożony Snapshot per scena (content-addressed `sha256`), Take walidowany przed `completed`, manual `start_frame_path` → snapshot `source=manual`, resume po `plan_scene_id`. Picker kadru w Director's Desk. Security: helmet + rate limiting + path traversal guard.
**Nie działa / brak:** docelowy lekki deployment RunComfy (ComfyUI-Minimal). Serwerowy graf ma bug KSampler (Studio ratuje się lokalnym `wan_workflow_api.json`). Resume partial + pełna ciągłość Snapshot — **niezweryfikowane e2e na GPU** po #20–#22.

---

## ZRÓB TO JAKO PIERWSZE

**Zbuduj nowy lekki deployment `ComfyUI-Minimal` w panelu ComfyUI Cloud** wg `docs/RUNCOMFY_DEPLOYMENT.md` (tylko wymagane node'y + 3 modele, BEZ ComfyUI-Manager), wklej Inference URL do `RUNCOMFY_ENDPOINT` w `backend/.env`. **Tego nie da się zrobić przez API/MCP — to operacja w panelu.**
Dopiero po tym ma sens TOR KOD Fazy C-GPU (IP-Adapter + wpięcie composite/osi do `runComfyEngine.js`/`wan_workflow_api.json` — pod review + zielonymi testami; sekcja H/63 na to pozwala). Równolegle sensowny smoke e2e Fazy D: 3 sceny + partial resume na GPU.

---

## JAK URUCHOMIĆ

```bash
npm run dev
npm test --prefix backend
npm run status:dev
npm run cleanup:studio-health --prefix backend   # opcjonalnie: smoke/zombie w DB
```

- Frontend: http://localhost:5174 · Backend: http://localhost:4005
- **Tor twórcy:** Katalog → Reżyseria (`/desk`) → Gotowość planu → Produkcja → WEBM w UI

---

## Prompt do nowego czatu

```text
Kontynuuj Kebabkiller Studio. Źródło prawdy = docs/11_OPUS_ARCHITECTURE_PROPOSAL.md + realny kod.
Tryb PLAN — zero edycji kodu, dopóki nie napiszę "OK, rób".
Stan: Fazy A, B, C (bez GPU), E ZROBIONE. Faza D częściowo (Snapshot SSOT + Picker + resume po plan_scene_id; e2e GPU do weryfikacji).
Część C-GPU odłożona do czasu zbudowania lekkiego deploymentu ComfyUI-Minimal (panel RunComfy, nie kod).
Najpierw przeczytaj docs/11 (sekcje D, F, H) + docs/RUNCOMFY_DEPLOYMENT.md + SNAPSHOT_CONTINUITY_AUDIT.md.
Następne opcje: (a) TOR KOD Fazy C-GPU, (b) smoke e2e Fazy D na GPU (3 sceny + resume),
(c) Faza F (Studio-lustro UI).
Nie dotykaj: gema-0, .env. Commit per krok, npm test --prefix backend przed i po.
```

**Koniec sesji:** `HANDOFF`

---

## Pliki kluczowe (zmienione od PR #20–#22)

```text
SNAPSHOT_CONTINUITY_AUDIT.md                   ← audyt architektury ciągłości (C1/C2/C3)
docs/11_OPUS_ARCHITECTURE_PROPOSAL.md          ← źródło prawdy
docs/RUNCOMFY_DEPLOYMENT.md                    ← jak zbudować lekki deployment
backend/src/video/snapshotStore.js             ← freezeSnapshot (content-addressed)
backend/src/db/snapshotModels.js               ← repo snapshotów (tenant-scoped)
backend/src/tenant/tenantContext.js            ← multi-tenant plumbing (default)
backend/scripts/checkTenantScope.mjs           ← guard SQL tenant_id (pretest)
backend/src/video/productionQueue.js           ← Snapshot/Take/resume/enterTenant
backend/src/video/frameExtractor.js            ← ekstrakcja klatek z klipu (Filar 3)
backend/src/video/compositeStartFrame.js       ← kaskada composite + pozycja/skala
backend/src/ai/systemAgent/                    ← AI-Inżynier (Faza E)
frontend/src/components/ContinuityPicker.jsx   ← Picker kadru kontynuacji
frontend/src/components/KlatkaZeroPanel.jsx    ← panel Klatki Zero
```
