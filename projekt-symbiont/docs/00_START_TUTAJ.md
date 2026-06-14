# 00. START TUTAJ — Projekt SYMBIONT (agent czytaj to na początku)

**Projekt:** Symbiont — darmowy, samohostowany agent AI, który **instaluje się w rdzeń** dowolnego
oprogramowania jako moduł, dostaje **tożsamość** związaną z tym oprogramowaniem i jest **mistrzem
audytów plików** oraz bezpiecznym programistą na docelowych serwerach.

**To OSOBNY projekt od Kebabkiller Studio.** Nie mieszaj lejków — szczegóły niżej.

---

## Start sesji — 3 pliki, ~3 minuty

| Kolejność | Plik | Po co |
|-----------|------|--------|
| **1** | Ten plik | Zasady i mapa lejka Symbiont |
| **2** | [HANDOFF_AKTUALNY.md](HANDOFF_AKTUALNY.md) | **Co robimy TERAZ** (jedna strona) |
| **3** | [01_WIZJA_I_MARZENIE.md](01_WIZJA_I_MARZENIE.md) | Marzenie → produkt (źródło prawdy wizji) |

**Nie czytaj** reszty, dopóki zadanie tego nie wymaga.

---

## Gdzie jest pełna wiedza?

| Potrzebujesz… | Czytaj… |
|---------------|---------|
| Wizja produktu (marzenie → cele) | [01_WIZJA_I_MARZENIE.md](01_WIZJA_I_MARZENIE.md) |
| Jakie są sposoby na to (research, realne narzędzia) | [02_BADANIE_ROZWIAZAN.md](02_BADANIE_ROZWIAZAN.md) |
| Architektura (Rdzeń + Moduł + Tożsamość) | [03_ARCHITEKTURA.md](03_ARCHITEKTURA.md) |
| Jak to ma być darmowe / tanie | [04_MODEL_KOSZTOW.md](04_MODEL_KOSZTOW.md) |
| Bezpieczeństwo (edycja kodu na produkcji) | [05_BEZPIECZENSTWO.md](05_BEZPIECZENSTWO.md) |
| Jak instaluje się „w rdzeń" i dostaje tożsamość | [06_INSTALACJA_JAKO_MODUL.md](06_INSTALACJA_JAKO_MODUL.md) |
| Realny plan etapami (MVP → dalej) | [07_ROADMAPA.md](07_ROADMAPA.md) |
| **Jak rozdzielić od Kebabkiller (nie pomieszać)** | **[08_ROZDZIELENIE_OD_KEBABKILLER.md](08_ROZDZIELENIE_OD_KEBABKILLER.md)** |
| Historia sesji tego projektu | [DZIENNIK_SESJI.md](DZIENNIK_SESJI.md) |

---

## Zasady tego lejka (skrót)

1. **Nie mieszać z Kebabkiller Studio.** Cała wiedza Symbionta żyje w `projekt-symbiont/`.
   Kebabkiller = osobny lejek w `docs/`. Patrz [08_ROZDZIELENIE_OD_KEBABKILLER.md](08_ROZDZIELENIE_OD_KEBABKILLER.md).
2. **Kebabkiller Studio = wzór i pierwszy host (pilotaż)** — na nim testujemy instalację Symbionta,
   ale go nie przebudowujemy „przy okazji".
3. **Domyślnie PLAN, nie Agent.** Kod Symbionta piszemy dopiero po wyraźnym „OK, rób" właściciela.
4. **Źródło prawdy:** ten lejek + realny kod modułu Symbionta (gdy powstanie). Nie zgaduj — cytuj pliki.
5. **Po sesji:** nadpisz `HANDOFF_AKTUALNY.md`, dopisz wpis do `DZIENNIK_SESJI.md`.

---

## Jednozdaniowy pitch

> **Symbiont** = jeden samohostowany „mózg" agenta (dostępny z telefonu i laptopa, ta sama wersja),
> który **wpinasz w rdzeń** każdego swojego oprogramowania cienkim modułem; moduł nadaje mu
> **tożsamość** danego programu (kontekst, zasady, dostęp), a agent robi **darmowe audyty plików**
> i **bezpieczne poprawki przez PR** — nigdy nie psując żywej produkcji.
