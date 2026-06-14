# ADR-0002 — Lokalne kopie (gema0, kebabkiller) wolno dowolnie edytować

- **Data:** 2026-06-14
- **Status:** zaakceptowana (aktualizuje ADR-0001)
- **Kontekst workspace:** macius

## Kontekst
ADR-0001 i pierwsza wersja docs traktowały `gema0/` (i częściowo `kebabkiller/`) jako **read-only**
(„nie dotykać"). Właściciel doprecyzował: w workspace `macius/` pracujemy na **lokalnych kopiach**
wrzuconych z repozytoriów. Oryginały żyją w zdalnych repo, więc kopie można **dowolnie przerabiać,
ciąć, usuwać i eksperymentować** bez ryzyka dla źródeł.

## Decyzja
- `gema0/` i `kebabkiller/` w `macius/` mają dostęp **read-write** — wolno je swobodnie modyfikować.
- Znosimy hard-regułę „NIE modyfikuj gema0" w obrębie workspace macius.
- Utrzymujemy **dwie dobre praktyki** (rekomendacje, nie zakazy):
  1. **Audyt przed dużym cięciem** `gema0/` — żeby świadomie wiedzieć, co reużyć, a co wyrzucić
     (audyt to faza obserwacji = fotografia stanu, podczas niej nie zmieniamy plików).
  2. **Commituj na bieżąco** — żeby każdą zmianę dało się cofnąć.
- **Rozróżnienie:** swoboda dotyczy lokalnych kopii. Bezpieczny tor (gałąź → testy → PR → rollback,
  nigdy edycji prod wprost) odnosi się do **wdrożonego produktu na żywych serwerach**, nie do kopii.

## Konsekwencje
- **Pozytywne:** pełna swoboda kanibalizacji gema0 i przeróbek kebabkillera; szybsze prototypowanie fuzji.
- **Negatywne / koszt:** brak — oryginały są w zdalnych repo; historia w gicie pozwala cofać.
- **Zmienione pliki:** `AGENTS.md`, `docs/00`, `docs/02`, `docs/03`, `docs/04`, `.cursor/rules/macius-workspace.mdc`,
  `prompts/*`, `templates/ZADANIE_TEMPLATE.md`, `audyty/README.md`, `INSTRUKCJA/*`.

## Następne kroki
- [ ] Bez zmian w roadmapie — Etap 0 (audyt gema0) nadal pierwszy, ale teraz jako wstęp do swobodnych przeróbek.
