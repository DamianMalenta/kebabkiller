# 07. Plan: Programista (/dev) — v2

**Cel:** Nowy panel AI „Programista" dostępny pod trasą `/dev`, przeznaczony dla właściciela studia do monitorowania systemu, debugowania pipeline'u i technicznego wsparcia developerskiego (bez wiedzy Reżysera o kreatywnym procesie).

**Zasada:** Programista jest agentem read-mostly — może inspekcjonować stan systemu, wyświetlać logi, diagnozować produkcję i sugerować konfigurację. Nie ma prawa zapisu do kanonu serialu ani scen (to domena Reżysera).

---

## Fazy implementacji

### Faza 0 — Przygotowanie (branch + plan)
- [x] Gałąź `cursor/dev-agent-panel-9e33`
- [x] Plik `docs/07_DEV_AGENT_PLAN.md` v2

### Faza 1 — Backend: DB schema
- `dev_agent_messages` — historia czatu z Programistą (id, role, content, tool_calls_json, created_at)
- Migracja w `init.js` (podejście `CREATE TABLE IF NOT EXISTS`)

### Faza 2 — Backend: AI logika (`src/ai/devAgent.js`)
- Agent Groq (llama-3.3-70b) z zestawem narzędzi systemowych
- Narzędzia read-only: `getSystemHealth`, `listJobs`, `getJobDetails`, `listEpisodePlans`, `getProductionStatus`, `listAssets`, `getBackendConfig`
- Fallback do odpowiedzi tekstowej (bez kluczy API)

### Faza 3 — Backend: API routes
- `GET /dev-agent/state` — historia czatu + stan systemu
- `POST /dev-agent/chat` — wyślij wiadomość do Programisty
- `DELETE /dev-agent/history` — wyczyść historię czatu

### Faza 4 — Backend: devAgentModels.js + API client
- `insertDevMessage`, `listDevMessages`, `clearDevHistory` w `devAgentModels.js`
- Rozszerzenie `api.devAgent.*` w `frontend/src/api/client.js`

### Faza 5 — Frontend: strona `/dev` + nawigacja
- `frontend/src/pages/DevPanel.jsx` — dwukolumnowy layout
  - Lewa kolumna: metryki systemu (health, jobs count, assets count, env config)
  - Prawa kolumna: chat z Programistą (input + historia)
- Komponent `DevSystemInfo.jsx` — karty stanu (backend health, jobs, produkcja)
- Dodanie linka `/dev` do nawigacji (pasek górny + `MobileQuickNav`)
- Komponent `DevChat.jsx` — uproszczony czat (bez wizardów, bez widgetów)

---

## Narzędzia Programisty (tool catalog)

| Narzędzie | Opis |
|-----------|------|
| `getSystemHealth` | Stan backendu: PORT, VIDEO_ENGINE, klucze API (bez wartości) |
| `listJobs` | Lista ostatnich n video_jobs ze statusami |
| `getJobDetails` | Pełne szczegóły joba (director_json, output_path) |
| `listEpisodePlans` | Lista planów odcinków ze statusami |
| `getProductionStatus` | Najnowszy production_run dla planu |
| `listAssets` | Katalog assetów (typy, liczby) |
| `getBackendConfig` | Konfiguracja: WAN_LENGTH, I2V_PROFILE, PORT (bez kluczy) |

---

## Layout frontendu

```
/dev
├── SystemInfoPanel (lewa / góra mobile)
│   ├── HealthCard — backend OK/ERROR
│   ├── JobsCard — X jobów, ostatni status
│   ├── ProductionCard — aktywna produkcja?
│   └── ConfigCard — env summary (bez kluczy)
└── DevChatPanel (prawa / dół mobile)
    ├── MessageList — historia czatu
    └── ChatInput — wpisz zapytanie do Programisty
```

---

## Zasady (nie zmieniać)

- Programista **nie dotyka** `director_chat_messages` (oddzielna tabela)
- Nie używać stanu kreacyjnego (wizard_step, canon) — to domena `/desk`
- Brak możliwości renderowania/akceptowania planów z poziomu `/dev`
- Historia czatu persystuje w SQLite (można czyścić przez UI)
