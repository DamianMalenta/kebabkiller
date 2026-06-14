# 02. Mapa workspace — trzy światy, jedno repo

**Cel:** żeby agent nigdy nie pomieszał, gdzie jest co i gdzie wolno pisać.

---

## Układ docelowy (na laptopie)

```
macius/                      ← repo git "macius"
├── kebabkiller/             ← ŹRÓDŁO 1: istniejący produkt + 1. host pilotażowy (read-only)
├── gema0/                   ← ŹRÓDŁO 2: prototyp do twardego audytu (read-only, NIE dotykać)
└── macius/                  ← PRACA: cała nowa robota (docs, audyty, decyzje, plan, później kod)
```

## Trzy światy i reguły dostępu

| Świat | Folder | Dostęp | Po co |
|-------|--------|--------|-------|
| **Kebabkiller** | `kebabkiller/` | **read-only** (chyba że zadanie jawnie jego dotyczy) | wzór architektury + pierwszy host dla Symbionta |
| **gema0** | `gema0/` | **read-only, NIE modyfikować** | przedmiot twardego audytu; źródło komponentów do ewentualnego reużycia |
| **macius** | `macius/` | **read-write** | nowa praca: analizy, audyty, decyzje, roadmapa, kod produktu docelowego |

## Gdzie co zapisywać

| Co tworzysz | Gdzie |
|-------------|-------|
| Raport audytu | `macius/audyty/AUDYT_GEMA0_<data>.md` (wg `templates/AUDYT_TEMPLATE.md`) |
| Decyzja architektoniczna | `macius/decyzje/ADR-XXXX-<temat>.md` (wg `templates/ADR_TEMPLATE.md`) |
| Propozycja architektury / fuzji | `macius/docs/` lub `macius/decyzje/` (wg `templates/PROPOZYCJA_TEMPLATE.md`) |
| Zadanie/backlog | wg `templates/ZADANIE_TEMPLATE.md` |
| Kod produktu docelowego (później) | osobny podkatalog w `macius/` (np. `macius/symbiont/`), NIE w `gema0/`/`kebabkiller/` |

---

## Uwaga o „duplikacji" po pull

Ta architektura jest publikowana na gałęzi pochodzącej z repo Kebabkiller, więc po `git pull` w korzeniu
repo `macius` pojawią się również pliki Kebabkillera (`backend/`, `frontend/`, `docs/`, `projekt-symbiont/`).

**Jak to traktować:**
- **Prawdziwe źródła** = foldery, które WRZUCASZ ręcznie: `kebabkiller/` i `gema0/`.
- Pliki Kebabkillera w korzeniu repo macius → **ignoruj** (lub usuń, jeśli wolisz czysto). Nie są
  potrzebne do pracy macius. `projekt-symbiont/` w korzeniu zostaw — to wygodne, pełne źródło wizji.
- Cała NOWA praca i tak dzieje się **wyłącznie w `macius/`**.

> Jeśli chcesz idealnie czysto: po pierwszym pull usuń z korzenia `backend/`, `frontend/`, `docs/`,
> `README.md` Kebabkillera, zostawiając tylko `kebabkiller/`, `gema0/`, `macius/` (+ opcjonalnie
> `projekt-symbiont/`). To kosmetyka — nie wpływa na pracę agenta.

---

## Zasada złota

> **Audyt i wnioski o gema0 → piszemy w `macius/`, nigdy w `gema0/`.**
> gema0 pozostaje nietknięty jako wierne źródło prawdy do audytu.
