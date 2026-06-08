# zmiany.md — handoff dla architekta (sesja 2026-06-08)

## Cel sesji
Stabilny **WEBM** z RunComfy + spójność prompt/GPU + jakość first (bez tnienia steps/length).

## Zmiany w kodzie

| Plik | Co |
|------|-----|
| `backend/src/video/runComfyEngine.js` | Submit **`workflow_api_json`** zamiast `overrides`; **bez node 51** (WEBP); node **52** = output |
| `backend/src/video/wan_workflow_api.json` | Usunięty node 51; poprawny KSampler (steps 20, cfg 6, uni_pc) |
| `backend/src/video/wanConfig.js` | **NOWY** — `WAN_QUALITY` + `WAN_FORMAT_PROMPT` (single source of truth) |
| `backend/src/ai/director.js` | Prompt: `480x832` z `wanConfig` (było `1080x1920`) |
| `backend/src/video/mockEngine.js` | Meta resolution `480x832` |
| `backend/src/tests/runComfyEngine.test.js` | +testy `buildRunComfyWorkflow`, weryfikacja body `/inference` |

**Testy:** 10/10 pass.

## Parametry produkcyjne (`WAN_QUALITY`)
`480×832`, `length: 33`, `steps: 20` — jawne w payloadzie, nie z deploymentu RunComfy.

## Odkrycia (RunComfy export użytkownika)
- Te same **node IDs** 49–62 — mapowanie backendu OK.
- Deployment miał **node 51+52** → API zwracało tylko WEBP.
- Eksport RunComfy: **zepsuty KSampler 56** (`steps:6`, `cfg:"uni_pc"`, pola zamienione) — nasz JSON to naprawia przez dynamic workflow.

## Nie zrobione (świadomie)
- FFmpeg WEBP→WEBM fallback
- Ręczna naprawa workflow w panelu RunComfy (opcjonalna — kod omija deployment)
- Zmiana układu composite (postać/tło) — bez OK właściciela

## Weryfikacja po wdrożeniu
1. Restart backend `npm run dev`
2. Jeden render ze Studio
3. Log: `workflow_api_json, nodes: ...` **bez 51**; download `node 52`
4. `backend/output/{jobId}.webm`

## Ryzyko
Jeśli RunComfy odrzuci `workflow_api_json` (brak node/custom node) — wrócić do planu A: Cloud Save bez 51 + PATCH `workflow_version`.
