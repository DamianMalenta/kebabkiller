# HANDOFF AKTUALNY — stan na teraz

**Ostatnia aktualizacja:** 2026-06-10 (sesja #13)  
**Sesja:** #13 (+ wizja pipeline’u z 2026-06-09 w docs)

---

## ZŁOTA ZASADA (Nie zmieniać)

Nie usuwać `director.js`, `mockEngine.js`, `runComfyEngine.js`.  
`wan_workflow_api.json` = lokalny szablon; Studio wysyła pełny `workflow_api_json` (bez node 51).  
Deployment RunComfy = środowisko GPU + modele; **My Workflows w panelu nie jest wymagane** do API ze Studia.

---

## TL;DR

- **Wizja produktu zapisana:** [05_EPISODE_PIPELINE.md](05_EPISODE_PIPELINE.md) + [CAPABILITIES.md](CAPABILITIES.md) + zaktualizowany [01_PROJECT_VISION.md](01_PROJECT_VISION.md).
- **Panel Seriale (`/projects`):** CRUD projektów, Style Bible, odcinki, pamięć serialowa — bez Postmana. ✅
- **AI Reżyser:** Style Bible **nie wkleja** polskiego do `positive_prompt` — Groq zwraca `style_tags_en` (EN tagi CLIP). ✅
- **RunComfy payload:** poprawny; **1× WEBM sukces** (`45686cf6`, ~9 min); kolejne joby wiszą 10 min (deployment `b36cb944…` niestabilny / za ciężki).
- **`WAN_LENGTH=33`** przywrócone w `.env` (było 81 — pogarszało timeout).
- **Dashboard:** badge „Utknięte” dla zombie jobów (>15 min bez postępu).
- **Następna implementacja:** F1 (plan + Scenarzysta + katalog), potem F0 (silnik klipu), F2 (Reżyser pod plan).

---

## Wizja w jednym akapicie

Katalog główny → **Plan odcinka** (wybór z katalogu, preferencje, sceny, lista „do dostarczenia”) → **akceptacja** → **Reżyser produkcji** (auto: klatki, prompty, render) → paczka `E01_SC*.webm` + manifest. Odcinek 45 s = wiele klipów (2–10 s każdy), montaż u twórcy.

---

## Co zrobić jako pierwsze

1. **RunComfy → nowy/lżejszy deployment** (ComfyUI-Minimal + tylko nody Wan + SaveWEBM) — obecny `b36cb944-1eed-4cea-8e63-ef99667db566` niestabilny (freeze WAN21).
2. Anuluj wiszące requesty w panelu RunComfy; smoke test ze Studia przy `WAN_LENGTH=33`.
3. Oczekiwany wynik: log sampling po WAN21 → `backend/output/{jobId}.webm`.
4. **F1:** model danych + UI planu odcinka + Scenarzysta + sekcja braków materiałów.
5. **F2:** Reżyser produkcji czytający zaakceptowany plan.

---

## Stan techniczny

| Element | Status |
|---------|--------|
| Panel `/projects` (projekty + odcinki) | ✅ |
| „Zatwierdź Kanon” + `SeriesMemoryPanel` | ✅ |
| Groq / `style_tags_en` (EN CLIP, bez PL w Node 55) | ✅ |
| `workflow_api_json` bez node 51 | ✅ |
| `WAN_LENGTH=33` w `.env` | ✅ |
| Zombie joby w Dashboard | ✅ |
| RunComfy payload / polling | ✅ |
| RunComfy deployment stabilny | ❌ ciężki / freeze WAN21 |
| WEBM powtarzalnie | ⚠️ 1 sukces, potem stale |
| Plan odcinka / Scenarzysta / katalog w UI | ❌ F1 |
| Reżyser pod plan | ❌ F2 |

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
Kebabkiller Studio — sesja #13. Panel Seriale + fix CLIP (style_tags_en) gotowe; wizja w docs/05_EPISODE_PIPELINE.md; RunComfy niestabilny.

Przeczytaj HANDOFF_AKTUALNY.md i 05_EPISODE_PIPELINE.md.
Priorytet: lżejszy deployment RunComfy (ComfyUI-Minimal) lub diagnoza freeze WAN21, potem powtarzalny smoke test WEBM przy WAN_LENGTH=33.
Kontynuacja produktowa: F1 (plan odcinka + Scenarzysta + katalog).
```

**Koniec sesji:** `HANDOFF`

---

## Dokumentacja wizji

| Plik | Zawartość |
|------|-----------|
| [05_EPISODE_PIPELINE.md](05_EPISODE_PIPELINE.md) | Pełna wizja: plan, role, flow, MVP, fazy |
| [CAPABILITIES.md](CAPABILITIES.md) | Limity silnika (klatki, czas, zasady scen) |
| [01_PROJECT_VISION.md](01_PROJECT_VISION.md) | Skrót wizji |
| [03_AGENT_STATE_AND_TASKS.md](03_AGENT_STATE_AND_TASKS.md) | Roadmapa F0–F3 |

## Pliki kluczowe (implementacja)

```text
frontend/src/pages/Projects.jsx
frontend/src/components/ProjectEditor.jsx
frontend/src/components/EpisodeList.jsx
frontend/src/utils/jobLifecycle.js          ← zombie joby Dashboard
backend/src/ai/director.js                  ← style_tags_en, system prompt CLIP
backend/src/video/runComfyEngine.js
backend/src/video/wanConfig.js
backend/.env
```
