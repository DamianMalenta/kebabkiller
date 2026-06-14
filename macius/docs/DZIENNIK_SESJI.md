# Dziennik sesji — workspace MACIUS

> Dopisuj nowe wpisy na górze. Nie nadpisuj historii.

---

## Sesja #2 — 2026-06-14 — czyste repo + samodzielność

**Cel:** Przygotować macius pod **dedykowane, czyste repo** `DamianMalenta/macius` i uczynić go samodzielnym.

**Zrobione:**
- Zniesiona reguła „read-only" dla `gema0/`/`kebabkiller/` — to lokalne kopie, wolno je przerabiać (ADR-0002).
- **Dołączona pełna wizja** jako `wizja-symbiont/` (kopia lejka Symbiont); odwołania `../../projekt-symbiont`
  → `../wizja-symbiont` (ADR-0003). Workspace nie zależy już od obcego repo.
- Nowy przewodnik `INSTRUKCJA/JAK_POBRAC_DO_REPO_MACIUS.md` (publikacja do czystego repo macius).
- Uproszczone README + `02_MAPA_WORKSPACE` (układ czystego repo, bez „duplikacji po pull").
- Uwaga: token agenta chmurowego jest przypięty do repo kebabkiller, więc push do repo `macius`
  wykonuje właściciel wg instrukcji.

**Następne:** właściciel publikuje do repo macius → Etap 0 (twardy audyt gema0).

---

## Sesja #1 — 2026-06-14 — założenie workspace macius

**Cel:** Stworzyć idealną infrastrukturę do pracy agentów AI nad celem (Symbiont) na bazie twardego
audytu gema0 + marzeń właściciela. Całkowicie zmienić przejście do dokumentacji (nowy front door).

**Zrobione:**
- Utworzono `macius/` z pełnym lejkiem: `README.md`, `AGENTS.md`, `docs/00`–`06`, HANDOFF, dziennik.
- Metodyka **twardego audytu gema0** (`04`) + szablon raportu (`templates/AUDYT_TEMPLATE.md`).
- Mapa 3 światów (kebabkiller/gema0/macius) + zasady rozdzielenia i bezpieczeństwa (`02`, `03`).
- Wizja produktu docelowego + 3 warianty fuzji (`05`) + roadmapa (`06`).
- Szablony (ADR, propozycja, zadanie), prompty (onboarding/audyt/fuzja), ADR-0001, folder `audyty/`.
- Scoped Cursor rule `macius-workspace.mdc` (start sesji = macius).

**Następne:** właściciel wrzuca `gema0/` → odpalamy Etap 0 (twardy audyt).
