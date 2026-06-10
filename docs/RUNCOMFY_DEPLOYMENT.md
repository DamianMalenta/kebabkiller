# RunComfy — lżejszy deployment (F0)

**Cel:** uniknąć freeze GPU po `Model WAN21 prepared…` i uzyskać stabilny output WEBM (node 52).

## Problem (stan 2026-06)

Ciężki deployment z ~30+ custom nodes + ComfyUI Manager powoduje zawieszenie po załadowaniu Wan 2.1. Pipeline kodu w Studio jest gotowy; bloker to środowisko GPU.

## Zalecany deployment (ComfyUI-Minimal)

1. **Nowy deployment** w panelu RunComfy (nie reużywaj starego z Managerem).
2. **Wymagane node’y** (z `wan_workflow_api.json`):
   - `WanImageToVideo` (node 54)
   - `SaveWEBM` (node 52) — VP9, 24 fps
   - `KSampler`, `VAELoader`, `UNETLoader`, `CLIPLoader`, `CLIPVision*`, `LoadImage`
3. **Modele:**
   - `wan2.1_i2v_480p_14B_bf16.safetensors`
   - `wan_2.1_vae.safetensors`
   - `umt5_xxl_fp8_e4m3fn_scaled.safetensors` (CLIP type `wan`)
4. **Nie instaluj** ComfyUI-Manager ani zbędnych custom nodes na tym deploymentcie.
5. Skopiuj **Inference URL** (V2) do `RUNCOMFY_ENDPOINT` w `backend/.env`.

## Smoke test WEBM

```bash
# Mock (bez GPU) — testy Jest
npm test --prefix backend

# Live (wymaga kluczy RunComfy)
cd backend
VIDEO_ENGINE=runcomfy WAN_LENGTH=33 npm start
# W Studio lub curl POST /api/jobs z promptem testowym
```

Oczekiwany wynik: plik `backend/output/{jobId}.webm` + `.meta.json`.

## Zmienne F0 (`.env`)

| Zmienna | Domyślnie | Opis |
|---------|-----------|------|
| `WAN_LENGTH` | `33` | Klatki smoke (~1.4 s) |
| `WAN_DENOISE` | `1` | KSampler denoise (smoke) |
| `I2V_PROFILE` | `SMOKE` | `I2V_PRODUCTION` = statyczna kamera, denoise 0.85 |

Profil produkcyjny per scena (plan odcinka): `duration_sec` → `wan_length` w Reżyserze (F2).

## My Workflows vs Deployment

**My Workflows w panelu nie jest wymagane.** Studio wysyła pełny `workflow_api_json` z `wan_workflow_api.json` (bez node 51 WEBP). Wystarczy deployment z poprawnymi modelami i node’ami.
