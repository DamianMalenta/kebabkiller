# HANDOFF AKTUALNY — stan na teraz

**Ostatnia aktualizacja:** 2026-06-13 (sesja #16)  
**Sesja:** plan Programista (/dev) + fix Vite tunnel

---

## ZŁOTA ZASADA (Nie zmieniać)

Nie usuwać `director.js`, `mockEngine.js`, `runComfyEngine.js`.  
`wan_workflow_api.json` = lokalny szablon; Studio wysyła pełny `workflow_api_json`.  
Deployment RunComfy = środowisko GPU; panel overrides ≠ payload ze Studia.

---

## TL;DR

- **Programista w panelu:** plan wdrożenia v2 gotowy → **`docs/07_DEV_AGENT_PLAN.md`** (Cursor Cloud Agents API + `/dev`). ❌ nie wdrożone
- **Vite + Cloudflare tunnel:** `allowedHosts: true` zmergowane (PR #7). ✅
- **Stół Reżyserski** (`/desk`): chat + wizard + agentTools. ✅
- **RunComfy / produkcja GPU:** nadal bloker deploymentu. ❌
- **Backlog produktowy:** F3 recenzja; Scenarzysta + `series_memory`

---

## Co zrobić jako pierwsze

1. **Wdrożenie Programisty:** nowy czat → prompt z `docs/07_DEV_AGENT_PLAN.md` → fazy 0–5.
2. Przed kodem: `CURSOR_API_KEY` + `GET /v1/repositories` (repo na liście GitHub App).
3. Po MVP: faza 2b Kebabkiller MCP (agent czyta odcinki/produkcję ze Studia).

---

## Stan techniczny

| Element | Status |
|---------|--------|
| Plan Programista (`07_DEV_AGENT_PLAN.md` v2) | ✅ |
| Vite tunnel (`allowedHosts: true`) | ✅ |
| Stół Reżyserski `/desk` | ✅ |
| Programista `/dev` (kod) | ❌ |
| Kebabkiller MCP (faza 2b) | ❌ backlog |
| RunComfy stabilny | ❌ |

---

## `.env` — nowe klucze (Programista, po wdrożeniu)

```env
CURSOR_API_KEY=           # Dashboard → API Keys
CURSOR_REPO_URL=https://github.com/DamianMalenta/kebabkiller
CURSOR_DEFAULT_REF=main
DEV_PANEL_TOKEN=          # ochrona /api/dev-agent/* na tunnel
```

Istniejące: `GROQ_API_KEY`, `VIDEO_ENGINE`, `PORT`, `RUNCOMFY_*` — bez zmian.

---

## Prompt do nowego czatu

```text
Kebabkiller Studio — wdrożenie Programisty (/dev) wg docs/07_DEV_AGENT_PLAN.md v2.

Przeczytaj: 00_START_TUTAJ.md, HANDOFF_AKTUALNY.md, 07_DEV_AGENT_PLAN.md.
Implementuj fazy 0→5. Branch: cursor/dev-agent-panel-9e33.
Nie dotykaj gema-0.
```

**Koniec sesji:** `HANDOFF`

---

## Pliki kluczowe

```text
docs/07_DEV_AGENT_PLAN.md          ← plan wdrożenia (źródło prawdy)
frontend/src/pages/DirectorsDesk.jsx
backend/src/ai/directorDesk/agentServer.js
frontend/vite.config.js
backend/src/api/routes.js
```
