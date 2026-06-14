# 09. Briefing: spięcie Symbiont × gema-0 (zadanie analityczne, BEZ kodu)

**Status:** zadanie badawcze dla nowego okna. **Tryb: tylko analiza i propozycja — ZERO kodu.**

---

## Kontekst (cel nadrzędny)

Mamy dwa pomysły, które chcemy potencjalnie **spiąć w jeden innowacyjny projekt**:

1. **Symbiont** — darmowy, samohostowany agent AI, który instaluje się **w rdzeń** dowolnego
   oprogramowania jako moduł, dostaje **tożsamość** tego programu, robi **darmowe audyty plików**
   i **bezpieczne** naprawy przez PR. Pełny opis: ten lejek (`projekt-symbiont/docs/00`–`08`).
2. **gema-0** — wcześniejszy prototyp właściciela. Kod zostanie **dograny lokalnie** do osobnego
   katalogu obok tego repo (folder `gema-0/`). W tym repo go nie ma — pojawi się po stronie laptopa.

> Uwaga: w lejku Kebabkiller obowiązuje zasada „nie dotykaj gema-0". Tu jej nie łamiemy —
> zadanie jest **read-only**: tylko czytamy gema-0, nic w nim nie zmieniamy.

---

## Co ma zrobić nowe okno (zakres)

1. **Zapoznać się z celem Symbionta** — przeczytać `projekt-symbiont/docs/00 → 01 → 03 → 06`.
2. **Zbadać katalog `gema-0/`** (read-only): stack, architektura, co już robi, mocne strony,
   ograniczenia, co da się ponownie wykorzystać.
3. **Zestawić oba pomysły** — tabela: co wnosi gema-0, co wnosi Symbiont, gdzie się pokrywają,
   gdzie uzupełniają, gdzie kolidują.
4. **Zaproponować spięcie w jeden projekt** — 2–3 warianty architektury (np. gema-0 jako host/silnik
   wewnątrz Symbionta, albo Symbiont jako warstwa-moduł nad gema-0), z ryzykami i rekomendacją.
5. **Wymienić kilka innowacyjnych zastosowań** połączonego rozwiązania.
6. **Krótki plan dalszych kroków** (PLAN, nie implementacja).

## Twarde zasady dla nowego okna

- **NIE pisać kodu.** Tylko analiza + propozycja (Plan Mode).
- **NIE modyfikować gema-0** ani kodu Kebabkillera — tylko czytać.
- Nie mieszać lejków: notatki Symbionta → `projekt-symbiont/`; Kebabkiller → `docs/`.
- Cytować realne ścieżki/pliki z `gema-0/` (anty-halucynacja), nie zgadywać.

## Wynik oczekiwany (deliverable)

Jeden zwięzły dokument-propozycja (może trafić do `projekt-symbiont/docs/10_PROPOZYCJA_SPIECIA.md`):
zestawienie + warianty architektury + rekomendacja + lista innowacyjnych zastosowań + następne kroki.
