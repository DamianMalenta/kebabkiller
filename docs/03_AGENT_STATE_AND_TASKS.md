# 03. Stan Projektu, Problemy i Zadania

**Zaktualizowano:** 2026-06-09 (sesja planowania pipeline’u odcinka)  
**Start agenta:** [00_START_TUTAJ.md](00_START_TUTAJ.md) → [HANDOFF_AKTUALNY.md](HANDOFF_AKTUALNY.md) → ten plik.  
**Wizja docelowa:** [05_EPISODE_PIPELINE.md](05_EPISODE_PIPELINE.md) · [CAPABILITIES.md](CAPABILITIES.md)

---

## OBECNY STATUS (jedno zdanie)

**Kod:** legacy Studio (jeden prompt → jeden job) + RunComfy zablokowany przez freeze GPU.  
**Wizja:** Plan odcinka pierwszy → akceptacja → Reżyser produkcji → paczka montażowa (do implementacji F1–F3).

---

## Faza 5 — checklist generatora

| Krok | Stan | Uwagi |
|------|------|-------|
| Integracja RunComfy API (submit/poll/download) | ✅ | cancel, stale, sonda `/result` |
| Klatka startowa I2V (composite → node 59) | ✅ | `compositeStartFrame.js` |
| `workflow_api_json` bez node 51 | ✅ | node 52 SaveWEBM |
| `WAN_LENGTH` konfigurowalny (domyślnie 33) | ✅ | `wanConfig.js` + `.env` |
| AI Director + kinematyka multi-beat | ✅ | `kinematicsFromPrompt.js` |
| Testy Jest (runComfy + kinematics) | ✅ | focused pass |
| Żywy render na GPU | ❌ | freeze WAN21; job `7843aee7` canceled |
| Output WEBM (node 52) | ❌ | nie doszło do downloadu |
| Lżejszy deployment RunComfy | ❌ | **PRIORYTET** |
| FFmpeg compositing | ❌ | po stabilnym WEBM |

---

## JAK URUCHOMIĆ

```bash
cd kebabkiller_studio
npm run dev
```

- Frontend: http://localhost:5173  
- Backend: `PORT` z `backend/.env` (lokalnie **4001**)  
- Health: http://localhost:4001/api/health  

```bash
npm test --prefix backend
```

**`.env` — minimum:**
- `GROQ_API_KEY`, `VIDEO_ENGINE=runcomfy`
- `RUNCOMFY_API_KEY` + `RUNCOMFY_ENDPOINT` (V2 inference URL)
- `WAN_LENGTH=33` (smoke test)

---

## OTWARTE PROBLEMY (blokery)

1. **GPU freeze po WAN21** — log ComfyUI stoi na `Model WAN21 prepared…`; deployment z ~30+ custom nodes + Manager fetch. Fix: ComfyUI-Minimal / nowy deployment.
2. **Brak potwierdzonego WEBM** — pipeline nie doszedł do `Saved … bytes → backend/output/`.
3. **Vite bez `host:true`** — dostęp z telefonu wymaga `npm run dev --prefix frontend -- --host`.

## ROZWIĄZANE (sesja #12)

- Fałszywy progress 96,93% → uczciwy cap ~85%
- Polling ignorował `canceled` (US spelling)
- Sprzeczna kinematyka LLM (sitting + jump)
- `length: 144` → `WAN_LENGTH=33` domyślnie
- Regex infinite loop w `extractMotionBeatsFromPolish`

## PO GENERATORZE (później)

- Projekt serialu / biblia serii (F4)
- FFmpeg compositing / opcjonalny stitch podglądu
- `host: true` w vite na stałe
- Wake cluster API (stub)

---

## MAPA DROGOWA (wizja 2026-06 — szczegóły w `05_EPISODE_PIPELINE.md`)

### F1 — Plan odcinka + Scenarzysta + katalog (PRIORYTET produktowy)
- [ ] Model danych: `assets`, `asset_images`, `episode_plans`, `plan_scenes`
- [ ] UI: Plan odcinka jako pierwszy ekran
- [ ] Scenarzysta (LLM + CAPABILITIES.md)
- [ ] Sekcja „Do dostarczenia” + wrzutka do katalogu
- [ ] Walidacja planu przed akceptacją

### F0 — Silnik klipu I2V (fundament techniczny)
- [ ] Profil `I2V_PRODUCTION` (static camera, 1 beat)
- [ ] `wanConfig`: denoise, mapowanie czas → klatek per scena
- [ ] Lżejszy deployment RunComfy + smoke WEBM

### F2 — Reżyser produkcji
- [x] Plan `zaakceptowany` → kolejka renderu scen (`productionQueue.js`)
- [x] Jeden profil wizualny na odcinek (`productionDirector.js`)
- [x] `E01_manifest.json` + nazewnictwo klipów (`output/export/E01/`)

### Backlog (po F2)
- [ ] **Doprecyzowanie Scenarzysty** — lepsze prompty, pętla doprecyzowania z twórcą, walidacja multi-beat w opisach scen

### F3 — Recenzja i poprawki
- [ ] Podgląd klipów, re-render pojedynczej sceny

### Faza 5 (legacy) — W TRAKCIE technicznie
- [x] Kod RunComfyEngine + workflow_api_json
- [x] AI Director kinematyka + prompt diet
- [x] Polling cancel/stale/honest progress
- [ ] **Lżejszy deployment RunComfy**
- [ ] Pierwszy stabilny `.webm` w `backend/output/`
