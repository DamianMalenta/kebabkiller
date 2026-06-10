# Kebabkiller Studio — agent notes

## Cursor Cloud specific instructions

### Stack

Monorepo: **npm** at repo root, `backend/` (Express + SQLite), `frontend/` (React + Vite). Node **≥ 22.4** required (`--experimental-sqlite`).

### Dependencies

From repo root:

```bash
npm install
npm run install:all
```

### Configuration

```bash
cp backend/.env.example backend/.env
```

For local smoke tests without external APIs:

- `PORT=4001` — **must match** `frontend/vite.config.js` proxy target (default proxy is `4001`, while `.env.example` uses `4000`).
- `VIDEO_ENGINE=mock` — placeholder video output in `backend/output/` (no RunComfy GPU).

Real AI Director / RunComfy: set `GROQ_API_KEY` (or other LLM keys) and `RUNCOMFY_*` with `VIDEO_ENGINE=runcomfy` in `backend/.env`.

### Running dev servers (Linux / Cloud)

`npm run dev` calls `node --use-system-ca` in `backend/package.json`. That flag is **Windows-only**; on Linux it exits with `bad option: --use-system-ca`.

Use this instead from repo root:

```bash
npx concurrently "sh -c 'cd backend && node --experimental-sqlite --watch src/index.js'" "npm run dev --prefix frontend"
```

- UI: http://localhost:5173  
- API health: http://localhost:4001/api/health  

On Windows, use `npm run dev` as documented in `README.md`.

### Tests and build

| Task | Command |
|------|---------|
| Backend unit tests | `cd backend && npm test` |
| Frontend production build | `npm run build --prefix frontend` |

There is **no** ESLint or `npm run lint` script in this repo.

### Services

| Service | Required for UI smoke | Notes |
|---------|----------------------|-------|
| Backend API | Yes | SQLite file at `backend/data/studio.db` on first start |
| Frontend (Vite) | Yes | Proxies `/api` → backend |
| LLM (Groq etc.) | No | Falls back to mock director without keys |
| RunComfy | No | Use `VIDEO_ENGINE=mock` for offline render queue |

### Hello-world smoke

1. `curl http://localhost:4001/api/health` → `{"ok":true,...}`
2. Open http://localhost:5173 → **Studio** → **Pokaż jak zrozumiałeś** (director preview)
3. **Generuj wideo** queues a mock job; status on Dashboard
