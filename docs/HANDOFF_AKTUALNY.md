# HANDOFF AKTUALNY — stan na teraz

**Ostatnia aktualizacja:** 2026-06-09 (sesja #12)  
**Sesja:** #12

---

## ZŁOTA ZASADA (Nie zmieniać)

Nie usuwać `director.js`, `mockEngine.js`, `runComfyEngine.js`.  
`wan_workflow_api.json` = lokalny szablon; Studio wysyła pełny `workflow_api_json` (bez node 51).  
Deployment RunComfy = środowisko GPU + modele; **My Workflows w panelu nie jest wymagane** do API ze Studia.

---

## TL;DR

- **AI Reżyser (Groq):** działa; kinematyka wieloetapowa naprawiona (`kinematicsFromPrompt.js`) — bez sztywnych scen.
- **RunComfy payload:** poprawny (`workflow_api_json`, node 52, `length` z `WAN_LENGTH`, domyślnie **33**).
- **Bloker generatora:** GPU **wisi na WAN21** (log ComfyUI urywa się po `Model WAN21 prepared…`) — nawet przy 33 klatkach; deployment za ciężki (dziesiątki custom nodes + Manager fetch przy starcie).
- **Polling backendu:** naprawiony (`canceled`/`cancelled`, uczciwy %, stale po 10 min, sonda `/result`).
- **Żywy job `7843aee7`:** anulowany ręcznie (API cancel) po ~7+ min `in_progress` bez postępu w logu.

---

## Co zrobić jako pierwsze

1. **RunComfy → nowy/lżejszy deployment** (np. **ComfyUI-Minimal** + tylko nody Wan) **albo** wyłączenie ComfyUI-Manager przy starcie joba — obecny `wan_workflow_api` v1 wiesza się na WAN21.
2. Po nowym deploymencie: jeden smoke test ze Studia (`WAN_LENGTH=33`), oczekiwany log: sampling po WAN21, plik `backend/output/{jobId}.webm`.
3. Jeśli GPU znów stoi >5 min na WAN21 → **Cancel** w panelu RunComfy (backend przerwie po 10 min ze komunikatem).

---

## Stan techniczny

| Element | Status |
|---------|--------|
| Groq / `POST /api/director/preview` | ✅ `_source: groq` |
| Kinematyka (siedzi→skacze) | ✅ reconcile z promptu PL |
| Prompt diet (composite refs) | ✅ krótszy positive |
| `WAN_LENGTH` w `.env` | ✅ domyślnie 33 |
| `workflow_api_json` bez node 51 | ✅ |
| Polling: `canceled`, stale 10 min | ✅ |
| Uczciwy progress (max ~85% w wait) | ✅ |
| Żywy WEBM po fixie deploymentu | ❌ GPU freeze WAN21 |
| WEBM z node 52 w API | ⚠️ niezweryfikowane (job nie doszedł do końca) |

---

## `.env` — ważne klucze

```env
VIDEO_ENGINE=runcomfy
RUNCOMFY_ENDPOINT=.../deployments/{id}/inference
GROQ_API_KEY=...
WAN_LENGTH=33

# opcjonalnie RunComfy:
# RUNCOMFY_STALE_AFTER_MS=600000
# RUNCOMFY_POLL_MAX_ATTEMPTS=120
```

---

## Prompt do nowego czatu

```text
Kebabkiller Studio — sesja #12. AI Director OK; RunComfy wisi na WAN21 (ciężki deployment).

Przeczytaj HANDOFF_AKTUALNY.md. Pomóż postawić lżejszy deployment RunComfy (ComfyUI-Minimal) lub zdiagnozować freeze WAN21, potem jeden smoke test WEBM przy WAN_LENGTH=33.
```

**Koniec sesji:** `HANDOFF`

---

## Pliki kluczowe

```text
backend/src/ai/kinematicsFromPrompt.js   ← beaty z PL, reconcile LLM
backend/src/ai/director.js
backend/src/video/runComfyEngine.js      ← polling, cancel, stale
backend/src/video/wanConfig.js           ← WAN_LENGTH
backend/.env.example
frontend/vite.config.js                  ← brak host:true (telefon wymaga --host)
```
