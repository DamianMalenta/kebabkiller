# HANDOFF AKTUALNY — stan na teraz

**Ostatnia aktualizacja:** 2026-06-10 (merge main + F0–F2 + P0)  
**Sesja:** #13 + pipeline odcinka + fixy P0

---

## ZŁOTA ZASADA (Nie zmieniać)

Nie usuwać `director.js`, `mockEngine.js`, `runComfyEngine.js`.  
`wan_workflow_api.json` = lokalny szablon; Studio wysyła pełny `workflow_api_json` (bez node 51).  
Deployment RunComfy = środowisko GPU + modele; **My Workflows w panelu nie jest wymagane** do API ze Studia.

---

## TL;DR

- **Wizja produktu:** [05_EPISODE_PIPELINE.md](05_EPISODE_PIPELINE.md) + [CAPABILITIES.md](CAPABILITIES.md).
- **Seriale (`/projects`):** CRUD projektów, Style Bible, odcinki serialowe, pamięć serialowa, kanon. ✅
- **Plan odcinka (F1):** katalog, Scenarzysta, plan scen, deliverables. ✅
- **Produkcja (F0+F2):** I2V_PRODUCTION, Reżyser produkcji, manifest export. ✅
- **P0 fixy:** recovery jobów po restarcie, zombie od `updated_at`, czyszczenie planu w Studio. ✅
- **AI Reżyser:** `style_tags_en` (EN CLIP) + kontekst serialowy + profil I2V. ✅
- **RunComfy:** deployment niestabilny (freeze WAN21) — bloker żywego WEBM. ❌
- **Backlog:** doprecyzowanie Scenarzysty; F3 (recenzja + re-render sceny).

---

## Wizja w jednym akapicie

Katalog główny → **Plan odcinka** (wybór z katalogu, preferencje, sceny, lista „do dostarczenia”) → **akceptacja** → **Reżyser produkcji** (auto: klatki, prompty, render) → paczka `E01_SC*.webm` + manifest. Odcinek 45 s = wiele klipów (2–10 s każdy), montaż u twórcy.

---

## Co zrobić jako pierwsze

1. **RunComfy → nowy/lżejszy deployment** (ComfyUI-Minimal + tylko nody Wan + SaveWEBM).
2. Anuluj wiszące requesty w panelu RunComfy; smoke test ze Studia przy `WAN_LENGTH=33`.
3. Oczekiwany wynik: log sampling po WAN21 → `backend/output/{jobId}.webm`.
4. **Doprecyzowanie Scenarzysty** (czytanie `series_memory` z projektów).

---

## Stan techniczny

| Element | Status |
|---------|--------|
| Panel `/projects` (projekty + odcinki serialowe) | ✅ |
| „Zatwierdź Kanon” + `SeriesMemoryPanel` | ✅ |
| Groq / `style_tags_en` (EN CLIP) | ✅ |
| Plan odcinka / Scenarzysta / katalog w UI | ✅ F1 |
| Reżyser pod plan + manifest | ✅ F2 |
| P0: recovery, zombie, stale plan | ✅ |
| RunComfy deployment stabilny | ❌ freeze WAN21 |
| WEBM powtarzalnie | ⚠️ 1 sukces, potem stale |
| Doprecyzowanie Scenarzysty | ❌ backlog |
| Recenzja klipów (F3) | ❌ |

---

## `.env` — ważne klucze

```env
VIDEO_ENGINE=runcomfy
RUNCOMFY_ENDPOINT=https://api.runcomfy.net/prod/v2/deployments/b36cb944-1eed-4cea-8e63-ef99667db566/inference
GROQ_API_KEY=...
WAN_LENGTH=33
PORT=4001
```

---

## Prompt do nowego czatu

```text
Kebabkiller Studio — merge main + F1–F2 + P0 gotowy. Seriale + plan odcinka + produkcja w jednym main.

Przeczytaj HANDOFF_AKTUALNY.md i 05_EPISODE_PIPELINE.md.
Priorytet: lżejszy deployment RunComfy lub diagnoza freeze WAN21, potem smoke test WEBM.
```

**Koniec sesji:** `HANDOFF`

---

## Pliki kluczowe

```text
frontend/src/pages/Projects.jsx
frontend/src/pages/EpisodePlan.jsx
frontend/src/pages/Catalog.jsx
frontend/src/utils/jobLifecycle.js
backend/src/ai/director.js
backend/src/video/queue.js
backend/src/api/routes.js
```
