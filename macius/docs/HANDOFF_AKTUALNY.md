# HANDOFF AKTUALNY — workspace MACIUS

**Ostatnia aktualizacja:** 2026-06-14 (sesja #1 — założenie workspace)
**Etap:** infrastruktura gotowa. Czekamy na wrzucenie `gema0/` + start twardego audytu (Etap 0).

---

## ŹRÓDŁO PRAWDY
Misja: `01_MISJA.md`. Mapa: `02_MAPA_WORKSPACE.md`. Audyt: `04_AUDYT_GEMA0.md`. Start: `00_START_TUTAJ.md`.

## TL;DR — stan teraz
- ✅ Workspace macius utworzony: docs (00–06), AGENTS.md, README, szablony, prompty, decyzje, audyty/.
- ✅ **Prosta instrukcja dla właściciela**: `INSTRUKCJA/` (główna + ściąga + słowniczek + częste problemy + jak pobrać do repo macius).
- ✅ **Dołączona pełna wizja** w `wizja-symbiont/` → workspace jest samodzielny (ADR-0003).
- ✅ **Kopie wolno edytować** — zniesiona reguła read-only dla gema0/kebabkiller (ADR-0002).
- ✅ **Dedykowane czyste repo:** https://github.com/DamianMalenta/macius (publikacja wg `INSTRUKCJA/JAK_POBRAC_DO_REPO_MACIUS.md`).
- ✅ Zasady 3 światów (kebabkiller/gema0/macius), anty-halucynacja, bezpieczeństwo, git — spisane.
- ⏳ `gema0/` do wrzucenia lokalnie przez właściciela (źródło twardego audytu).
- ❌ Audyt gema0 — jeszcze nieodpalony (Etap 0). To pierwszy ruch.

## NASTĘPNY KROK (rekomendacja)
1. Właściciel wrzuca `gema0/` i `kebabkiller/` do korzenia repo macius.
2. Nowe okno: odpal **twardy audyt gema0** wg `04_AUDYT_GEMA0.md` (prompt: `../prompts/PROMPT_AUDYT_GEMA0.md`).
3. Wynik → `audyty/AUDYT_GEMA0_<data>.md`. Potem decyzja o wariancie fuzji (ADR).

## Prompt do nowego okna
Patrz `../prompts/PROMPT_ONBOARDING.md` (start), `../prompts/PROMPT_AUDYT_GEMA0.md` (audyt),
`../prompts/PROMPT_FUZJA.md` (zestawienie i propozycja).

**Koniec sesji:** aktualizuj ten plik + dopisz wpis do `DZIENNIK_SESJI.md`.
