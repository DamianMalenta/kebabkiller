# Kebabkiller Studio

Automatyczne studio seriali — Panel Reżysera, AI Director i silnik wideo (RunComfy / mock).


## Wymagania

- Node.js **≥ 22.4** (backend używa `--experimental-sqlite`)
- Klucze API w `backend/.env` (szablon: `backend/.env.example`)

## Szybki start

```bash
# 1. Zależności (root + backend + frontend)
npm run install:all

# 2. Konfiguracja
cp backend/.env.example backend/.env
# Uzupełnij klucze: GEMINI_API_KEY, RUNCOMFY_API_KEY, RUNCOMFY_ENDPOINT

# 3. Uruchomienie (studio2: frontend :5174, backend :4005 — patrz backend/.env)
npm run dev
# lub: npm run restart:dev  |  npm run status:dev
```

Otwórz **http://localhost:5174** — Panel Reżysera.

Porty czyta `backend/.env` (`PORT`, `FRONTEND_PORT`) przez `scripts/read-backend-port.mjs` + `read-frontend-port.mjs`. **Nie używaj :4001/:5173** — zarezerwowane dla macius/Symbiont (`scripts/dev-ports.mjs`).

> Backend startuje z `node --use-system-ca` (wymagane dla połączenia z RunComfy na Windows).

## Struktura

| Katalog | Opis |
|---------|------|
| `backend/` | Express API, AI Director, kolejka renderów, RunComfy engine |
| `frontend/` | React + Vite — Studio, Dashboard, Settings |
| `docs/` | Handoff agenta, architektura, dziennik sesji |

## Testy

```bash
cd backend && npm test
```

## Agent (Cursor)

Zacznij od: `docs/00_START_TUTAJ.md` → `docs/HANDOFF_AKTUALNY.md` → `docs/03_AGENT_STATE_AND_TASKS.md`
