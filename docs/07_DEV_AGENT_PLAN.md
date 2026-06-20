# 07. Programista w panelu — plan wdrożenia (v2)

**Status:** plan zatwierdzony do implementacji (nie wdrożone)  
**Data:** 2026-06-13  
**API:** [Cloud Agents API v1](https://cursor.com/docs/cloud-agent/api/endpoints) (public beta)

---

## TL;DR

Wkładamy **Cursor Cloud Agents** do panelu jako zakładkę **Programista** (`/dev`): własny chat UI + backend proxy do `api.cursor.com`. **Nie** embedujemy `cursor.com` w iframe.

**Osobno** (faza 2b): opcjonalny **Kebabkiller MCP** — agent podczas kodowania czyta dane Studia (odcinki, produkcja) z SQLite przez HTTP MCP.

---

## PROMPT STARTOWY (nowe okno czatu — Agent Mode)

```text
Kebabkiller Studio — wdrożenie Programisty (/dev) wg docs/07_DEV_AGENT_PLAN.md v2.

Przeczytaj:
1. docs/00_START_TUTAJ.md
2. docs/HANDOFF_AKTUALNY.md
3. docs/07_DEV_AGENT_PLAN.md (całość)

Implementuj fazy 0→5 z planu. Branch: cursor/dev-agent-panel-9e33
Nie dotykaj gema-0. Nie usuwaj director.js, mockEngine.js, runComfyEngine.js.
Po każdej fazie: test + krótki raport.
```

---

## 1. Umowa zakresu

### Budujemy (MVP)

| Element | Opis |
|---------|------|
| `/dev` | Strona „Programista” w panelu |
| `/api/dev-agent/*` | Backend proxy do Cursor API v1 |
| SQLite | `dev_agent_threads` + `dev_agent_messages` |
| SSE | Live stream odpowiedzi agenta w UI |

### Nie budujemy w MVP

- iframe `cursor.com`
- edytor plików / terminal w panelu
- merge PR z panelu
- jeden chat Reżyser + Programista
- lokalny runtime `@cursor/sdk` na PC użytkownika
- community pakiet `cursor-cloud-agent-mcp` w panelu (to kierunek Desktop→Cursor, API v0)

### Ograniczenie produktowe (komunikat w UI)

Agent widzi **tylko GitHub**. Niezacommitowane zmiany na dysku użytkownika **nie istnieją** dla agenta. Po zakończeniu runu: merge PR → restart `npm run dev` lokalnie.

---

## 2. Architektura

```
[Przeglądarka /dev]
    │  REST + EventSource (SSE) — ten sam origin (Vite proxy)
    ▼
[Backend Express /api/dev-agent/*]
    │  Bearer CURSOR_API_KEY (tylko serwer)
    │  DEV_PANEL_TOKEN (ochrona endpointów)
    │  SQLite
    ▼
[https://api.cursor.com/v1/agents]
    │  VM + clone repo
    ▼
[github.com/DamianMalenta/kebabkiller]
    └── branch cursor/... → PR (status: sprawdź w GitHub)
```

### Rozdzielenie od Reżyserii

| | Reżyser `/desk` | Programista `/dev` |
|---|---|---|
| Backend | `agentServer.js` | `devAgent/*.js` |
| Routes | `/api/director-desk/*` | `/api/dev-agent/*` |
| LLM | Groq + `agentTools` | Cursor Cloud |
| Efekt | SQLite, produkcja GPU | Git branch + PR |

---

## 3. MCP — trzy znaczenia (nie mylić)

```mermaid
flowchart LR
  subgraph A [Wariant A — ten plan]
    Panel[Panel /dev]
    Backend[Backend proxy]
    CursorAPI[api.cursor.com v1]
    Panel --> Backend --> CursorAPI
  end

  subgraph B [MCP community — NIE dla panelu]
    Desktop[Cursor Desktop]
    MCP1[cursor-cloud-agent-mcp]
    Desktop --> MCP1 --> CursorAPI
  end

  subgraph C [Faza 2b — Kebabkiller MCP]
    Agent[Cloud Agent VM]
    MCP2[Studio MCP HTTP]
    StudioAPI[/api episode-plans ...]
    Agent --> MCP2 --> StudioAPI
  end
```

| Podejście | Cursor w panelu? | Telefon? | Kod w repo? | Dane Studia? |
|-----------|------------------|----------|-------------|--------------|
| **A: Cloud Agents API + UI** | ✅ chat | ✅ | ✅ via PR | ❌ tylko prompt |
| MCP community (Desktop) | ❌ | ❌ | ✅ | ❌ |
| **2b: Kebabkiller MCP** | — | — | ❌ | ✅ |
| **A + 2b razem** | ✅ | ✅ | ✅ | ✅ docelowo |

**Wniosek:** MCP community **nie zastępuje** panelu. Kebabkiller MCP to **uzupełnienie** w fazie 2b.

---

## 4. Korekty względem wersji 1 planu

| Było | Poprawka |
|------|----------|
| „draft PR” gwarantowane | API ma tylko `autoCreatePR: boolean` — **nie** ma pola draft. UI: „PR utworzony — sprawdź w GitHub”. |
| Auth fallback na localhost IP | Za tunelem IP jest złe. Gdy `DEV_PANEL_TOKEN` ustawiony → **zawsze** wymagaj headera `X-Dev-Token`. |
| Tylko raw fetch | OK na MVP. Faza 2: rozważyć `@cursor/sdk` na backendzie (cięższy, mniej boilerplate). |
| — | Faza 0: `GET /v1/repositories` — repo musi być na liście (GitHub App Cursor). |

---

## 5. Zmienne środowiskowe

Dodać do `backend/.env.example` i lokalnego `backend/.env`:

```env
# ─── Programista (Cursor Cloud Agents v1) ─────────────────
CURSOR_API_KEY=                    # Dashboard → API Keys (crsr_...)
CURSOR_REPO_URL=https://github.com/DamianMalenta/kebabkiller
CURSOR_DEFAULT_REF=main
CURSOR_AUTO_CREATE_PR=true
CURSOR_DEFAULT_MODE=agent          # agent | plan

# Ochrona /api/dev-agent/* — WYMAGANE gdy panel na tunnel/LAN publicznym
DEV_PANEL_TOKEN=                   # losowy string; frontend: sessionStorage
```

Jeśli `CURSOR_API_KEY` pusty → `/api/dev-agent/*` zwraca `503` z komunikatem (reszta Studia działa).

---

## 6. Schemat SQLite

Dodać do `backend/src/db/schema.sql` + migracja w `init.js`:

```sql
CREATE TABLE IF NOT EXISTS dev_agent_threads (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL DEFAULT 'Nowy wątek',
  cursor_agent_id TEXT,
  cursor_agent_url TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'archived')),
  last_run_id TEXT,
  last_run_status TEXT,
  pr_url TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_dev_agent_threads_status ON dev_agent_threads(status);

CREATE TABLE IF NOT EXISTS dev_agent_messages (
  id TEXT PRIMARY KEY,
  thread_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system', 'tool')),
  content TEXT NOT NULL DEFAULT '',
  run_id TEXT,
  meta_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (thread_id) REFERENCES dev_agent_threads(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_dev_agent_messages_thread ON dev_agent_messages(thread_id);
```

Model: `backend/src/db/devAgentModels.js` (wzorzec: `directorDeskModels.js`).

---

## 7. Backend — pliki

```
backend/src/devAgent/
  cursorClient.js       # HTTP → api.cursor.com/v1
  promptBuilder.js      # szablon kontekstu Kebabkiller
  devAgentService.js    # logika wątków i runów
  devAgentRoutes.js     # Express + requireDevToken
  sseProxy.js           # pipe SSE Cursor → klient
```

### `cursorClient.js` — mapowanie API v1

| Metoda | Endpoint |
|--------|----------|
| `createAgent` | `POST /v1/agents` |
| `createRun` | `POST /v1/agents/{id}/runs` |
| `getRun` | `GET /v1/agents/{id}/runs/{runId}` |
| `streamRun` | `GET .../stream` + `Last-Event-ID` |
| `cancelRun` | `POST .../cancel` |
| `listArtifacts` | `GET /v1/agents/{id}/artifacts` (faza 2) |

Auth: `Authorization: Bearer ${CURSOR_API_KEY}`

Błędy: `401`, `409 agent_busy`, `429` (backoff), `410 stream_expired` → polling `getRun`.

### Create agent (pierwszy prompt w wątku)

```json
{
  "prompt": { "text": "<wrapped przez promptBuilder>" },
  "repos": [{
    "url": "https://github.com/DamianMalenta/kebabkiller",
    "startingRef": "main"
  }],
  "autoCreatePR": true,
  "workOnCurrentBranch": false,
  "mode": "agent"
}
```

### `promptBuilder.js` — szablon

```text
[Kontekst: Kebabkiller Studio — panel produkcji wideo 9:16]
Repo: frontend (Vite/React) + backend (Express/SQLite) + docs/
Zasady: docs/00_START_TUTAJ.md, .cursor/rules/kebabkiller-docs.mdc
ZAKAZ: nie dotykaj gema-0; nie usuwaj director.js, mockEngine.js, runComfyEngine.js

Zadanie:
{userMessage}
```

Opcjonalny `context` w body: `episode_plan_id`, `error_snippet`.

### API Studia (`devAgentRoutes.js`)

Middleware `requireDevToken`: jeśli `DEV_PANEL_TOKEN` ustawiony → wymagaj `X-Dev-Token` na każdym requeście. **Bez** polegania na `req.ip` (tunnel/proxy).

| Method | Path |
|--------|------|
| `GET` | `/dev-agent/status` |
| `GET` | `/dev-agent/threads` |
| `POST` | `/dev-agent/threads` — `{ message, mode?, context? }` |
| `GET` | `/dev-agent/threads/:id` |
| `POST` | `/dev-agent/threads/:id/messages` |
| `GET` | `/dev-agent/threads/:id/runs/:runId/stream` — SSE proxy |
| `GET` | `/dev-agent/threads/:id/runs/:runId` |
| `POST` | `/dev-agent/threads/:id/runs/:runId/cancel` |
| `POST` | `/dev-agent/threads/:id/archive` |

Podłączenie: `router.use('/dev-agent', createDevAgentRouter())` w `backend/src/api/routes.js`.

### SSE — ważne detale

- `git.branches` w evencie `result` jest **per agent**, nie per run (docs).
- Na `result`: zapisz `pr_url`, `last_run_status`, wiadomość assistant do SQLite.
- `res.flushHeaders()` przed pipe; nie buforuj całego streamu.

---

## 8. Frontend — pliki

```
frontend/src/pages/DevAgent.jsx
frontend/src/components/devAgent/
  DevAgentChat.jsx
  DevAgentSidebar.jsx
  DevRunStatus.jsx
  DevToolCallRow.jsx
frontend/src/hooks/useDevAgentStream.js
```

Zmiany: `App.jsx` (route `/dev`, nav „Programista”), `api/client.js` (sekcja `devAgent`).

Token: modal przy pierwszym wejściu → `sessionStorage.devPanelToken` → header `X-Dev-Token`.

### UI

- Lista wątków (sidebar / drawer na mobile)
- Chat ze streamem (`assistant`, `tool_call`, `result`)
- Status runu: `CREATING | RUNNING | FINISHED | ERROR | CANCELLED | EXPIRED`
- Linki: **Otwórz w Cursor** (`agent.url`), **PR na GitHub** (`pr_url`)
- Przełącznik trybu `plan` / `agent`
- Disable input gdy run aktywny (`409 agent_busy` → komunikat PL)

---

## 9. Fazy wdrożenia

### Faza 0 — Przygotowanie

- [ ] `CURSOR_API_KEY` w `backend/.env`
- [ ] `DEV_PANEL_TOKEN` ustawiony
- [ ] `curl -H "Authorization: Bearer $KEY" https://api.cursor.com/v1/me` → 200
- [ ] `GET /v1/repositories` zawiera `DamianMalenta/kebabkiller`
- [ ] Branch: `cursor/dev-agent-panel-9e33`

### Faza 1 — Backend skeleton

- [ ] Schema + `devAgentModels.js`
- [ ] `cursorClient.js`, `promptBuilder.js`, `devAgentRoutes.js`
- [ ] `POST /dev-agent/threads` działa curl-em

### Faza 2 — SSE proxy

- [ ] `sseProxy.js` + stream endpoint
- [ ] `POST /threads/:id/messages` + obsługa `409 agent_busy`
- [ ] Zapis PR URL po `result`

### Faza 3 — Frontend MVP

- [ ] `/dev` + nav + `useDevAgentStream.js`
- [ ] E2E: prompt → stream → link PR

### Faza 4 — Testy + polish

- [ ] `backend/src/tests/devAgent.test.js`
- [ ] Cancel run, błąd braku klucza, disable input

### Faza 5 — Docs

- [ ] `backend/.env.example`
- [ ] Ten plik — status „wdrożone” + data
- [ ] `HANDOFF_AKTUALNY.md`, `DZIENNIK_SESJI.md`

### Faza 2b — Kebabkiller MCP (po MVP, osobny PR)

- [ ] `backend/src/mcp/studioMcpServer.js` — HTTP/SSE MCP z narzędziami:
  - `get_episode_plan(id)`
  - `list_production_clips(episode_plan_id)`
  - `get_project_brain(project_id)`
- [ ] Endpoint wystawiony na HTTPS (tunnel lub deploy) — Cloud Agent VM musi do niego dojść
- [ ] W `POST /v1/agents` dodać `mcpServers`:
  ```json
  {
    "name": "kebabkiller-studio",
    "type": "http",
    "url": "https://TWOJ-TUNNEL/api/mcp",
    "headers": { "Authorization": "Bearer STUDIO_MCP_TOKEN" }
  }
  ```
- [ ] Alternatywa: `.cursor/mcp.json` w repo + konfiguracja w [cursor.com/agents](https://cursor.com/agents)
- [ ] Przycisk w Reżyserii: „Zgłoś do programisty” → `/dev?prefill=...`

---

## 10. Test akceptacyjny E2E

1. `npm run dev`
2. `http://localhost:5173/dev` → wpisz `DEV_PANEL_TOKEN`
3. Prompt: „W README.md dodaj sekcję 'Programista w panelu' (jedno zdanie). Nic innego nie zmieniaj.”
4. Oczekiwane: stream, tool calls, `FINISHED`, link PR, link Cursor
5. Follow-up w tym samym wątku: „Zmień tytuł sekcji na 'Dev Agent'”
6. `/desk` (Reżyser) nadal działa bez regresji

---

## 11. Pułapki

| Pułapka | Rozwiązanie |
|---------|-------------|
| Klucz w frontendzie | Tylko backend |
| `allowedHosts: 'all'` | Poprawne: `true` (już w main) |
| Drugi prompt podczas RUNNING | `409` + disable UI |
| Stream zerwany (mobile) | `Last-Event-ID`; fallback GET run |
| `410 stream_expired` | Polling co 3s |
| Panel na tunnel bez tokena | Wymagaj `DEV_PANEL_TOKEN` |
| Community MCP w panelu | Nie — v0, kierunek odwrotny |
| `git.branches` per run | To snapshot **agenta** — użyj `latestRunId` do kontekstu UI |

---

## 12. Definition of Done (MVP)

- [ ] `/dev` w nav (desktop + mobile)
- [ ] Prompt → SSE → PR link E2E
- [ ] Follow-up w wątku
- [ ] Token chroni API na tunnel
- [ ] Reżyser nietknięty
- [ ] Testy backendu zielone
- [ ] HANDOFF zaktualizowany

---

## 13. Szacunek diffu

| Obszar | ~linii |
|--------|--------|
| Backend nowe | ~450 |
| Backend zmiany | ~80 |
| Frontend nowe | ~400 |
| Frontend zmiany | ~40 |
| Testy | ~120 |

Jeden PR na MVP (fazy 1–4). Faza 2b (MCP) — osobny PR.
