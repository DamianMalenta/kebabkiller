# RunComfy — lżejszy deployment (F0)

**Cel:** uniknąć freeze GPU po `Model WAN21 prepared…` i uzyskać stabilny output WEBM (node 52).

## STAN 2026-06-15 (sesja #20) — diagnoza + PROTEZA (nie docelowe rozwiązanie)

> **WAŻNE:** poniższe to stopgap niezgodny z planem („nowy deployment, nie reużywaj starego z Managerem"). Docelowo Faza C-GPU = **nowy lekki deployment ComfyUI-Minimal** (sekcja niżej). Bloker „lekki deployment" NADAL otwarty.

Audyt deploymentu `KebabKiller-WAN-Minimal` (`7a8411f1-aad2-4fbb-8c07-6c1d0e724ad7`) wykazał:
- **Przyczyna freeze (potwierdzona):** hardware `AMPERE_24` (24 GB) — za mało na Wan 14B. Stopgap: podbito na `AMPERE_48` przez MCP (NIE cofnięte). To „ulepszanie starego ciężkiego", a nie budowa nowego — sprzeczne z planem.
- **Walidacja pipeline (na protezie):** request `98fbbc41-...` `succeeded` — node 52 → `ComfyUI_00001_.webm` (~6 min 48 s). Render e2e przez backend Studia też OK (`output/export/SMOKE_.../*.webm`). Dowodzi, że łańcuch B+C jest poprawny — ale na ciężkim środowisku.
- **Graf na serwerze ma bug:** deployowany `workflow_api_json` ma poprzestawiane wejścia `KSampler` node 56 → request na nim `failed`. Studio renderuje lokalnym (poprawnym) `wan_workflow_api.json`, więc realna ścieżka działa.
- **Środowisko ciężkie:** `object_info` = 2436 typów węzłów + ComfyUI-Manager → cold start ~5-7 min. To powód, dla którego docelowo budujemy ComfyUI-Minimal.
- **API ≠ panel:** budowy nowego środowiska (wybór ComfyUI-Minimal, instalacja nodów, modele, Cloud Save) NIE da się zrobić przez REST/MCP — to operacja w panelu ComfyUI Cloud. MCP/REST obsługuje tylko cykl życia deploymentu (z gotowego `workflow_id`) + inferencję.

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

## Audyt bez panelu

```bash
cd backend
chmod +x scripts/audit-runcomfy.sh   # raz
./scripts/audit-runcomfy.sh
# opcjonalnie status wiszącego joba:
./scripts/audit-runcomfy.sh --request-id <uuid_z_logu_backendu>
```

Skrypt czyta `RUNCOMFY_*` z `backend/.env`, pobiera ustawienia deploymentu, workflow, listę custom node’ów (`object_info`) i porównuje z lokalnym `wan_workflow_api.json`.

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
