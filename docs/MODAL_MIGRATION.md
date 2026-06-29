# Migracja RunComfy → Modal

**Cel:** ten sam tor renderu (`composite → workflow JSON → WEBM → snapshot`), inny transport.

## Stan

| Warstwa | RunComfy (teraz) | Modal (następny) |
|---------|------------------|------------------|
| Orkiestracja | Node `productionQueue.js` | bez zmian |
| Parametry GPU | `wanConfig.resolveWanRenderParams()` | bez zmian |
| Workflow JSON | `buildRunComfyWorkflow()` + `wan_workflow_api.json` | ten sam JSON na Volume |
| Submit + poll | `runComfyEngine.js` | `modalEngine.js` (do zrobienia) |
| Auth | `RUNCOMFY_API_KEY` + endpoint | `MODAL_TOKEN_*` |

## Kontrakt joba (zamrożony)

Wejście do silnika GPU (identyczne dla obu):

```json
{
  "job_id": "clip-uuid",
  "director_json": {
    "positive_prompt": "...",
    "negative_prompt": "...",
    "duration_sec": 4,
    "i2v_profile": "I2V_PRODUCTION",
    "seed": 424242,
    "start_frame_path": "/uploads/..."
  }
}
```

Wyjście:

- plik `.webm` (node **52** SaveWEBM)
- `.meta.json` z `engine`, `render_strategy`, `wan_length`, `seed`

Node IDs — `modal/wan_contract.py` + `runComfyEngine.js` (`WEBM_OUTPUT_NODE_ID = '52'`).

## Setup Modal (jednorazowo)

```bash
./scripts/modal-setup.sh
```

Wymaga tokena z panelu Modal (Settings → API tokens). Agent potrzebuje `MODAL_TOKEN_ID` + `MODAL_TOKEN_SECRET` w sekretach lub `backend/.env`.

## Kolejność prac

### Faza R — RunComfy (kredyty opłacone)

1. Panel: ComfyUI-Minimal wg `RUNCOMFY_DEPLOYMENT.md`
2. `./backend/scripts/audit-runcomfy.sh`
3. Smoke: `WAN_LENGTH=33`, 1 klip
4. Prod: `I2V_PRODUCTION`, 1 klip ~97 klatek
5. E2E: 3 sceny + `resumeProductionFromPartial`

### Faza M — Modal scaffold (ten PR)

- [x] `modal/health.py` — CPU smoke
- [x] `modal/wan_contract.py` — dokumentacja kontraktu
- [ ] `modal/wan_render.py` — Comfy + Wan na GPU (po Faza R)
- [ ] `backend/src/video/modalEngine.js` — `createVideoEngine('modal')`

### Faza M-GPU (po zamrożeniu workflow)

1. Modal Volume: modele Wan 2.1 480p 14B (te same co RunComfy)
2. Image: `comfyui-minimal` + custom nodes z deploymentu
3. `@app.function(gpu="A10G", timeout=1200)` — `run_workflow(workflow_api_json)`
4. Web endpoint lub `.spawn()` z Node

## Koszty

- **RunComfy teraz:** płatne kredyty — smoke krótki, unikaj keep-warm
- **Modal później:** scale-to-zero; pierwszy render = cold start + inferencja

## Zmienne `.env` (przyszłe)

```bash
VIDEO_ENGINE=modal
MODAL_TOKEN_ID=
MODAL_TOKEN_SECRET=
# MODAL_APP_NAME=kebabkiller-wan
```
