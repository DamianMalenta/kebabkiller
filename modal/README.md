# Modal (Kebabkiller Studio)

Serverless GPU pod Wan 2.1 I2V — **docelowy** silnik po walidacji na RunComfy.

## Szybki start (agent lub lokalnie)

```bash
chmod +x scripts/modal-setup.sh
# Token z https://modal.com/settings → API tokens
export MODAL_TOKEN_ID=ak-...
export MODAL_TOKEN_SECRET=as-...
./scripts/modal-setup.sh
```

Albo wpisz `MODAL_TOKEN_ID` i `MODAL_TOKEN_SECRET` do `backend/.env` (nie commituj).

## Pliki

| Plik | Po co |
|------|--------|
| `get_started.py` | Oficjalny tutorial Modal (CPU) |
| `health.py` | Smoke auth bez GPU |
| `wan_contract.py` | Kontrakt node IDs ↔ `wan_workflow_api.json` |
| `requirements.txt` | `pip install -r` |

## Kolejność migracji

1. RunComfy live: smoke `WAN_LENGTH=33` → prod 97 klatek → 3 sceny + resume
2. Zamroź `wan_workflow_api.json` + golden WEBM w `output/export/`
3. PR: `modal/wan_render.py` — Comfy headless na A10/A100 Volume
4. `VIDEO_ENGINE=modal` w `createVideoEngine()` (cienka warstwa jak `runComfyEngine`)

Szczegóły: `docs/MODAL_MIGRATION.md`
