# 03. Stan Projektu, Problemy i Zadania

**Zaktualizowano:** 2026-06-08 (sesja #11)  
**Start agenta:** [00_START_TUTAJ.md](00_START_TUTAJ.md) → [HANDOFF_AKTUALNY.md](HANDOFF_AKTUALNY.md) → ten plik.

---

## OBECNY STATUS (jedno zdanie)

MVP produkcyjny: **UI + Reżyser gotowe**; **generator wideo = 1 udany render RunComfy (WEBP), brak stabilnego WEBM/MP4**.

---

## Faza 5 — checklist generatora

| Krok | Stan | Uwagi |
|------|------|-------|
| Integracja RunComfy API (submit/poll/download) | ✅ | Kod w `runComfyEngine.js` |
| Klatka startowa I2V (composite → node 59) | ✅ | `compositeStartFrame.js` |
| Testy Jest (mock sieci) | ✅ | 4/4 — nie zastępują żywego testu |
| Żywy render na GPU | ⚠️ częściowo | 1× sukces (`aa778f19.webp`), 5× fail |
| Output WEBM/MP4 (node 52) | ❌ | RunComfy API zwraca tylko node 51 — fix w deployment ComfyUI |
| pickRunComfyMedia (kod) | ✅ | Preferuje node 52, loguje fallback + node IDs |
| Stabilność (retry po restarcie, wake cluster) | ❌ | Do zrobienia po WEBM |
| FFmpeg compositing | ❌ | Po stabilnym WEBM |

---

## JAK URUCHOMIĆ

```bash
cd kebabkiller_studio
npm run dev
```

- Frontend: http://localhost:5173  
- Backend: `PORT` z `backend/.env` (lokalnie **4001**)  
- Health: http://localhost:4001/api/health  
- Vite proxy: `frontend/vite.config.js` → backend 4001  

```bash
npm test --prefix backend    # testy mockowane
```

**`.env` — minimum do generatora:**
- `GROQ_API_KEY` (Reżyser)
- `VIDEO_ENGINE=runcomfy`
- `RUNCOMFY_API_KEY` + `RUNCOMFY_ENDPOINT` (format V2: `https://api.runcomfy.net/prod/v2/deployments/{id}/inference`)

---

## OTWARTE PROBLEMY (tylko blokery generatora)

1. **WEBP zamiast WEBM** — `pickRunComfyMedia` nie wymusza node `52`. Fix w `runComfyEngine.js`.
2. **Niestabilne rendery** — historyczne: zły endpoint (404), błąd KSamplera node 56, restart backendu w pollingu.
3. **`.env.example` nieaktualny** — stary URL `.com/v1`; myli przy nowej instalacji.

## ROZWIĄZANE (nie wracaj do tego w handoff)

- Testy Jest zawieszające się — timeout + ES modules OK
- Seed „meat cone” → dürüm w `init.js`
- Endpoint RunComfy V2 w lokalnym `.env` — działa (1 sukces)

## PO GENERATORZE (nie teraz)

- Obraz ref. do Reżysera (VLM QA) — postać idzie przez composite, nie przez LLM
- FFmpeg green-screen compositing
- Wake cluster API (teraz stub)

---

## MAPA DROGOWA (skrót)

### Faza 4.5 — ZAKOŃCZONA
Reżyser, identity_block_en, refs, storyboard preview.

### Faza 5 — W TRAKCIE (focus)
- [x] Kod RunComfyEngine
- [x] Jest mock testy
- [x] Jeden żywy render (WEBP)
- [x] pickRunComfyMedia — preferuj node 52 (kod)
- [x] Drugi żywy render (WEBP 1.48 MB, job `789eca38`)
- [ ] **WEBM z node 52 — PRIORYTET (deployment RunComfy, nie backend)**
- [ ] Stabilny render ze Studio (`npm run dev`)
- [ ] FFmpeg fallback
