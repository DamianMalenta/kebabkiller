# Kebabkiller Studio

Automatyczne studio wideo 9:16 z postacią Kebabkiller — Panel Reżysera, AI Director i silnik wideo (RunComfy / mock).

Niezależny projekt. Nie dotykaj `gema-0`.

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

# 3. Uruchomienie (frontend :5173, backend PORT z backend/.env — domyślnie 4000)
npm run dev
```

Otwórz **http://localhost:5173** — Panel Reżysera.

Vite proxy (`frontend/vite.config.js`) czyta port z `backend/.env` — nie trzeba ręcznie synchronizować z frontendem. Jeśli port 4000 jest zajęty, ustaw w `.env` np. `PORT=4001`.

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
