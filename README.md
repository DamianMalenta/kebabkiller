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

# 3. Uruchomienie (backend :4000 + frontend :5173)
npm run dev
```

Otwórz **http://localhost:5173** — Panel Reżysera.

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
