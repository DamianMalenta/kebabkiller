# 03. Stan Projektu, Problemy i Zadania

**Zaktualizowano:** 2026-06-10 (sesja #13)  
**Start agenta:** [00_START_TUTAJ.md](00_START_TUTAJ.md) → [HANDOFF_AKTUALNY.md](HANDOFF_AKTUALNY.md) → ten plik.  
**Wizja docelowa:** [05_EPISODE_PIPELINE.md](05_EPISODE_PIPELINE.md) · [CAPABILITIES.md](CAPABILITIES.md)

---

## OBECNY STATUS (jedno zdanie)

**Kod:** legacy Studio (jeden prompt → jeden job) + panel serialu (F1 UI) + RunComfy zablokowany przez freeze GPU.  
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
| Żywy render na GPU | ⚠️ | 1× WEBM OK; kolejne stale 10 min |
| Output WEBM (node 52) | ⚠️ | `45686cf6.webm` — brak powtarzalności |
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

1. **GPU freeze / stale po WAN21** — deployment `b36cb944…` za ciężki (~30+ custom nodes). Fix: ComfyUI-Minimal / nowy deployment.
2. **Brak powtarzalnego WEBM** — jeden sukces, potem timeout 10 min przy `WAN_LENGTH=81` (naprawione na 33).
3. **Vite bez `host:true`** — dostęp z telefonu wymaga `npm run dev --prefix frontend -- --host`.

## ROZWIĄZANE (sesja #13)

- Panel Seriale `/projects` — CRUD projektów, Style Bible, odcinki
- Polski Style Bible w `positive_prompt` → `style_tags_en` (EN) w `director.js`
- Zombie joby w Dashboard (badge „Utknięte”, próg 15 min)
- `WAN_LENGTH` 81 → 33 w `.env`
- Walidacja API projektów/odcinków (PL error messages)
- Select odcinka w Studio (`episode_id`)

## ROZWIĄZANE (sesja #12)

- Fałszywy progress 96,93% → uczciwy cap ~85%
- Polling ignorował `canceled` (US spelling)
- Sprzeczna kinematyka LLM (sitting + jump)
- `length: 144` → `WAN_LENGTH=33` domyślnie
- Regex infinite loop w `extractMotionBeatsFromPolish`

## PO GENERATORZE (później)

- FFmpeg compositing / opcjonalny stitch podglądu
- `host: true` w vite na stałe
- Wake cluster API (stub)

---

## Faza 1 serialu — checklist

| Krok | Stan | Uwagi |
|------|------|-------|
| Backend projects/episodes CRUD | ✅ | |
| Panel `/projects` UI | ✅ | ProjectEditor, EpisodeList |
| Kanon + pamięć serialowa UI | ✅ | Dashboard + SeriesMemoryPanel |
| Select odcinka w Studio | ✅ | `episode_id` w preview/render |
| Synopsis / director_notes odcinka w UI | ❌ | backlog |

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
