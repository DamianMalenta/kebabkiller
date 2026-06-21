# Dziennik sesji — Projekt SYMBIONT

> Dopisuj nowe wpisy na górze. Nie nadpisuj historii. Dotyczy WYŁĄCZNIE Symbionta
> (Kebabkiller ma własny `docs/DZIENNIK_SESJI.md`).

---

## Sesja #1 — 2026-06-14 — założenie osobnego lejka

**Cel:** Przełożyć marzenie właściciela na realny plan i utworzyć **osobny lejek dokumentacji**,
rozdzielony od Kebabkiller Studio.

**Zrobione:**
- Utworzono katalog `projekt-symbiont/` (README + `docs/` z pełnym lejkiem `00`–`08`, HANDOFF, dziennik).
- Research realnych rozwiązań 2026 (silniki agentów open-source, darmowe LLM, MCP, bezpieczne edycje):
  zebrane w `02_BADANIE_ROZWIAZAN.md` z linkami źródłowymi.
- Zaprojektowano architekturę **Rdzeń + Moduł + Tożsamość** (`03`), model kosztów (`04`),
  bezpieczeństwo edycji na prod (`05`), instalację-jako-moduł i mechanizm tożsamości (`06`),
  roadmapę etapami z MVP=audyt read-only (`07`).
- Spisano zasady rozdzielenia od Kebabkiller (`08`) + dodano scoped Cursor rule `symbiont-docs.mdc`
  i jeden nieinwazyjny wskaźnik w `docs/00_START_TUTAJ.md` (mapa Kebabkiller).

**Decyzje otwarte:** nazwa, silnik agenta, host Rdzenia, potwierdzenie pilota (Kebabkiller), zakres MVP.
Szczegóły w `HANDOFF_AKTUALNY.md`.

**Następne:** po decyzjach właściciela — Faza 0 z `07_ROADMAPA.md`.
