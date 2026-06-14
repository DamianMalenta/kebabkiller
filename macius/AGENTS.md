# AGENTS.md — kontrakt pracy agenta w workspace MACIUS

> Czytasz to, bo pracujesz w katalogu `macius/`. To jest Twój kontrakt. Stosuj go zawsze.
> Pełne zasady: [`docs/03_ZASADY_AGENTA.md`](docs/03_ZASADY_AGENTA.md).

## Start każdej sesji (obowiązkowo)
1. `macius/docs/00_START_TUTAJ.md`
2. `macius/docs/01_MISJA.md`
3. `macius/docs/HANDOFF_AKTUALNY.md`

## Cel nadrzędny
Zbudować **jedno** innowacyjne oprogramowanie na bazie **twardego audytu gema0** + **marzeń
właściciela** (agent Symbiont). Macius = miejsce pracy; `gema0/` i `kebabkiller/` = źródła.

## To są KOPIE — wolno wszystko
`gema0/` i `kebabkiller/` w `macius/` to **lokalne kopie** wrzucone z repo. **Można je dowolnie
przerabiać, ciąć, usuwać, eksperymentować** — oryginały (zdalne repozytoria) zostają nietknięte i bezpieczne.

## Trzy obszary (różne role, nie różne prawa do edycji)
- `gema0/` — prototyp, **materiał do audytu i kanibalizacji**. Edytuj swobodnie (po wcześniejszym audycie).
- `kebabkiller/` — działający produkt + 1. host pilotażowy. Edytuj swobodnie, jeśli zadanie tego wymaga.
- `macius/` — centrum dowodzenia: docs, audyty, decyzje, plan, kod produktu docelowego.

## Zasady twarde
1. **Domyślnie PLAN, nie Agent.** Kod piszesz dopiero po wyraźnym „OK, rób" właściciela.
2. **Anty-halucynacja:** nie zgaduj — czytaj realne pliki i **cytuj ścieżki** (np. `gema0/src/...`).
3. **Audyt = fakty z kodu**, nie wrażenia. Wynik audytu → `macius/audyty/` wg `templates/AUDYT_TEMPLATE.md`.
4. **Decyzje architektoniczne** zapisuj jako ADR w `macius/decyzje/` (`templates/ADR_TEMPLATE.md`).
5. **Audyt przed cięciem:** zanim mocno przerobisz `gema0/`, zrób (lub miej) audyt — żeby wiedzieć, co tniesz.
6. **Git = bezpiecznik:** rób commity/gałęzie na bieżąco, żeby każdą zmianę dało się cofnąć (to kopie, więc baw się śmiało).
7. **Żywa produkcja ≠ kopie.** Swoboda dotyczy lokalnych kopii. Wdrożenie produktu na realne serwery
   idzie bezpiecznym torem: gałąź → testy → PR → rollback (nigdy edycji prod wprost).

## Koniec sesji
Aktualizuj `macius/docs/HANDOFF_AKTUALNY.md` i dopisz wpis do `macius/docs/DZIENNIK_SESJI.md`.
