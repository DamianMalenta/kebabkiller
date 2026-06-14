# HANDOFF AKTUALNY — Projekt SYMBIONT

**Ostatnia aktualizacja:** 2026-06-14 (sesja #1 — założenie lejka)
**Etap:** PLAN. Zero kodu Symbionta. Lejek dokumentacji utworzony i rozdzielony od Kebabkiller.

---

## ŹRÓDŁO PRAWDY

Wizja: `01_WIZJA_I_MARZENIE.md`. Architektura: `03_ARCHITEKTURA.md`.
To OSOBNY lejek — wiedza Symbionta **tylko** w `projekt-symbiont/`. Kebabkiller = `docs/` (nie mieszać).

---

## TL;DR — stan teraz

- ✅ **Lejek utworzony** — `projekt-symbiont/` z własnym START, wizją, researchem, architekturą, kosztami,
  bezpieczeństwem, instalacją-jako-moduł, roadmapą i zasadami rozdzielenia.
- ✅ **Research zrobiony** — realne narzędzia 2026 (OpenHands/Aider/Cline SDK, Ollama, Groq/Gemini/OpenRouter,
  MCP, git-worktree + diff-only + PR). Patrz `02_BADANIE_ROZWIAZAN.md`.
- ⏳ **Decyzje właściciela do podjęcia** (niżej) — przed pisaniem jakiegokolwiek kodu.
- ❌ **Kod Symbionta** — jeszcze nie istnieje (świadomie; najpierw PLAN + „OK, rób").

---

## DECYZJE DO PODJĘCIA (zanim ruszy kod)

1. **Nazwa** — zostajemy przy „Symbiont"? (patrz `01`).
2. **Silnik agenta** — rekomendacja: **OpenHands SDK** (autonomia + sandbox Docker) lub **Aider** (lekki,
   git-first). Patrz `02` i `03`.
3. **Host Rdzenia** — gdzie stoi „mózg": mały VPS (~1 CPU/1–2 GB) czy darmowy tier? Patrz `04`.
4. **Pierwszy host pilotażowy** — potwierdzamy **Kebabkiller Studio** jako wzór (`08`).
5. **Tryb MVP** — czy MVP = sam **audyt read-only** (najbezpieczniejszy, 0 ryzyka), a edycja przez PR w fazie 2? (rekomendacja: tak).

---

## NASTĘPNY KROK

Po decyzjach 1–5 → **Faza 0** z `07_ROADMAPA.md` (szkielet Rdzenia + manifest tożsamości + audyt read-only na Kebabkiller).
Dopiero wtedy przełączamy z PLAN na Agent.

---

## Prompt do nowego czatu (ten projekt)

```text
Pracujemy nad PROJEKTEM SYMBIONT (NIE Kebabkiller Studio).
Lejek: projekt-symbiont/. Start: projekt-symbiont/docs/00_START_TUTAJ.md → HANDOFF_AKTUALNY.md → 01_WIZJA.
Tryb PLAN — zero kodu, dopóki nie napiszę "OK, rób".
Nie mieszaj z docs/ (to Kebabkiller). Zasady rozdzielenia: projekt-symbiont/docs/08_ROZDZIELENIE_OD_KEBABKILLER.md.
Najpierw pokaż krótki plan kroku z 07_ROADMAPA.md i poczekaj na OK.
```

**Koniec sesji:** `HANDOFF` (dla tego projektu aktualizuj TYLKO pliki w `projekt-symbiont/`).
