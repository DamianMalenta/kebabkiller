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

## Trzy światy (NIE mieszać)
- `kebabkiller/` — istniejący produkt + 1. host pilotażowy. **Tylko czytaj** (chyba że zadanie jawnie dotyczy Kebabkillera).
- `gema0/` — prototyp do **twardego audytu**. **Tylko czytaj. Nie modyfikuj** (zasada repo: nie dotykaj gema-0).
- `macius/` — tu powstaje NOWA praca (analizy, decyzje, plan, później kod produktu docelowego).

## Zasady twarde
1. **Domyślnie PLAN, nie Agent.** Kod piszesz dopiero po wyraźnym „OK, rób" właściciela.
2. **Anty-halucynacja:** nie zgaduj — czytaj realne pliki i **cytuj ścieżki** (np. `gema0/src/...`).
3. **Audyt = fakty z kodu**, nie wrażenia. Wynik audytu → `macius/audyty/` wg `templates/AUDYT_TEMPLATE.md`.
4. **Decyzje architektoniczne** zapisuj jako ADR w `macius/decyzje/` (`templates/ADR_TEMPLATE.md`).
5. **Bezpieczeństwo zmian:** nigdy edycji żywej produkcji wprost; tor: gałąź → diff → testy → PR → rollback.
6. **Git:** osobna gałąź per temat (prefiks zależny od repo macius u właściciela), osobny PR, czytelne commity.
7. **Nie modyfikuj `gema0/`.** Audyt jest read-only. Wnioski i propozycje trzymaj w `macius/`.

## Koniec sesji
Aktualizuj `macius/docs/HANDOFF_AKTUALNY.md` i dopisz wpis do `macius/docs/DZIENNIK_SESJI.md`.
