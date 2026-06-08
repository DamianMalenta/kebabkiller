# HANDOFF AKTUALNY — stan na teraz

**Ostatnia aktualizacja:** 2026-06-08 (sesja #11 — fix pickRunComfyMedia + żywy test)  
**Sesja:** #11

---

## ZŁOTA ZASADA (Nie zmieniać)

Nie usuwać `director.js`, `mockEngine.js`, `runComfyEngine.js`.  
`wan_workflow_api.json` = lokalny szablon inputs; workflow na RunComfy = źródło prawdy deploymentu.

---

## TL;DR

**Generator działa end-to-end.** Żywy test (job `789eca38`, 08.06) → 1.48 MB animowany WEBP w ~9 min.  
**Kod backendu:** `pickRunComfyMedia` naprawiony — preferuje node `52` WEBM, loguje fallback.  
**Bloker WEBM:** RunComfy API **nie zwraca node 52** — tylko node `51` (SaveAnimatedWEBP). Fix po stronie **deploymentu ComfyUI** (nie backendu).

---

## Co zrobić jako pierwsze

1. **Panel RunComfy → Deployment → workflow:** upewnij się, że node `SaveWEBM` (52) eksportuje wideo do API (obecnie w odpowiedzi jest tylko node `51`).
2. Opcje: usunąć/wyłączyć node 51 z workflow, albo naprawić SaveWEBM; po zmianie — redeploy i jeden render ze Studio.
3. Render ze Studio: `npm run dev` (backend ma `--use-system-ca` — bez tego `fetch failed` do RunComfy).

---

## Stan techniczny

| Element | Status |
|---------|--------|
| pickRunComfyMedia (node 52 → WEBM) | ✅ w kodzie |
| Testy Jest | ✅ 8/8 |
| Żywy render RunComfy | ✅ WEBP 1.48 MB (`789eca38...webp`) |
| WEBM z node 52 | ❌ deployment nie zwraca tego outputu |

---

## Prompt do nowego czatu

```text
Kebabkiller Studio — generator działa (WEBP z RunComfy). Brak WEBM bo deployment nie zwraca node 52.

Przeczytaj HANDOFF_AKTUALNY.md. Pomóż naprawić workflow ComfyUI na RunComfy (SaveWEBM node 52 w API outputs), potem potwierdź .webm w output/.
```

**Koniec sesji:** `HANDOFF`

---

## Pliki kluczowe

```text
backend/src/video/runComfyEngine.js   ← pickRunComfyMedia, WEBM_OUTPUT_NODE_ID='52'
backend/src/video/wan_workflow_api.json
backend/package.json                  ← dev/start używają --use-system-ca
```
