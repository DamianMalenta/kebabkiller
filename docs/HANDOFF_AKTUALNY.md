# HANDOFF AKTUALNY — stan na teraz

**Ostatnia aktualizacja:** 2026-06-14 (sesja #15)  
**Sesja:** Programista (/dev) panel — AI developer agent

---

## ZŁOTA ZASADA (Nie zmieniać)

Nie usuwać `director.js`, `mockEngine.js`, `runComfyEngine.js`.  
`wan_workflow_api.json` = lokalny szablon; Studio wysyła pełny `workflow_api_json`.  
Deployment RunComfy = środowisko GPU; panel overrides ≠ payload ze Studia.

---

## TL;DR

- **Plan odcinka (F1):** UI z krokami 0–6, Scenarzysta, auto-zapis scen, walidacja, akceptacja → produkcja. ✅
- **Mobile:** Vite `host:true`, LAN `http://192.168.8.44:5173`, karty scen, sticky „Akceptuj”, dolny pasek nav, panel dzień/noc. ✅
- **Backend:** `wanConfig` (WAN_LENGTH dla I2V), recovery partial/failed → retry; testy **77/77**. ✅
- **Dev serwery:** backend **4000**, frontend **5173** — health OK. ✅
- **Programista (/dev):** panel AI developer agent — system info + Groq chat + fallback deterministyczny. ✅
- **RunComfy:** deployment `b36cb944…` ciężki (ComfyUI-Manager) — bloker żywego WEBM. ❌
- **Backlog:** F3 recenzja; Scenarzysta + `series_memory`; picker `asset_image_id`.

---

## Co zrobić jako pierwsze

1. **Programista (/dev):** http://localhost:5173/dev — sprawdź system, joby, plany. Gdy GROQ_API_KEY ustawiony — działa AI chat. Bez klucza — fallback deterministyczny.
2. **Test z telefonu (Wi‑Fi):** http://192.168.8.44:5173 → Katalog → Nowy odcinek → kroki 1–6 → Akceptuj → obserwuj Produkcję.
3. Jeśli render **failed** — logi backendu + RunComfy; ewentualnie nowy deployment Minimal (patrz `docs/RUNCOMFY_DEPLOYMENT.md`).
4. Po udanym teście 2 klipów — rozważyć F3 lub podpięcie Scenarzysty do pamięci serialu.

---

## Stan techniczny

| Element | Status |
|---------|--------|
| Plan odcinka + instrukcje UI (desktop + mobile) | ✅ |
| Mobile: karty scen, sticky accept, step jump, bottom nav | ✅ |
| Vite LAN (`host: true` w `vite.config.js`) | ✅ |
| `canAccept` tylko właściwe statusy | ✅ |
| Auto-zapis scen (select + blur) | ✅ |
| `wanConfig` + `.env` spójne (WAN_LENGTH=73, I2V_PRODUCTION) | ✅ |
| Backend testy | ✅ 77/77 |
| Programista (/dev) panel + API + DB | ✅ |
| RunComfy stabilny | ❌ |
| Scenarzysta + series_memory | ❌ backlog |
| F3 recenzja klipów | ❌ |

---

## `.env` — ważne klucze

```env
VIDEO_ENGINE=runcomfy
RUNCOMFY_ENDPOINT=https://api.runcomfy.net/prod/v2/deployments/b36cb944-1eed-4cea-8e63-ef99667db566/inference
PORT=4001
WAN_LENGTH=73
I2V_PROFILE=I2V_PRODUCTION
GROQ_API_KEY=...
```

Telefon: ten sam Wi‑Fi co PC; **nie** otwieraj backendu :4001 bezpośrednio — API idzie przez Vite proxy.

---

## Prompt do nowego czatu

```text
Kebabkiller Studio — sesja #14: mobile UX + plan odcinka gotowy do testu z telefonu.

Przeczytaj HANDOFF_AKTUALNY.md i 05_EPISODE_PIPELINE.md.
Priorytet: wynik testu 2 klipów z telefonu (LAN 192.168.8.44:5173); jeśli produkcja failed — RunComfy deployment.
```

**Koniec sesji:** `HANDOFF`

---

## Pliki kluczowe

```text
frontend/src/pages/EpisodePlan.jsx
frontend/src/components/MobileNightWelcome.jsx
frontend/src/components/MobileSceneEditor.jsx
frontend/src/components/MobileStepNav.jsx
frontend/src/components/StepGuide.jsx
frontend/vite.config.js
backend/src/video/wanConfig.js
backend/src/video/productionQueue.js
backend/src/db/episodeModels.js
backend/scripts/audit-runcomfy.sh
```
