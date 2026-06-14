# 02. Mapa workspace — trzy światy, jedno repo

**Cel:** żeby agent nigdy nie pomieszał, gdzie jest co i gdzie wolno pisać.

---

## Układ docelowy (na laptopie)

```
macius/                      ← repo git "macius"
├── kebabkiller/             ← KOPIA: działający produkt + 1. host (edytuj swobodnie wg potrzeb)
├── gema0/                   ← KOPIA: prototyp do audytu i kanibalizacji (przerabiaj/tnij do woli)
└── macius/                  ← PRACA: centrum dowodzenia (docs, audyty, decyzje, plan, kod)
```

> **To wszystko są lokalne KOPIE z repo.** Można je dowolnie przerabiać, ciąć, usuwać, eksperymentować —
> **oryginały (zdalne repozytoria) zostają nietknięte i bezpieczne.** Nie ma „świętych" folderów.

## Trzy obszary i reguły dostępu

| Obszar | Folder | Dostęp | Po co |
|--------|--------|--------|-------|
| **Kebabkiller** | `kebabkiller/` | **read-write** (kopia) | działający produkt + 1. host; źródło wzorców; edytuj gdy zadanie wymaga |
| **gema0** | `gema0/` | **read-write** (kopia) | materiał do audytu i kanibalizacji; przerabiaj/wycinaj swobodnie |
| **macius** | `macius/` | **read-write** | centrum: analizy, audyty, decyzje, roadmapa, kod produktu docelowego |

> Jedyne rozsądne praktyki (nie zakazy): **najpierw audyt, potem cięcie** (żeby wiedzieć, co tniesz)
> oraz **commituj na bieżąco** (żeby każdą zmianę dało się cofnąć).

## Gdzie co zapisywać

| Co tworzysz | Gdzie |
|-------------|-------|
| Raport audytu | `macius/audyty/AUDYT_GEMA0_<data>.md` (wg `templates/AUDYT_TEMPLATE.md`) |
| Decyzja architektoniczna | `macius/decyzje/ADR-XXXX-<temat>.md` (wg `templates/ADR_TEMPLATE.md`) |
| Propozycja architektury / fuzji | `macius/docs/` lub `macius/decyzje/` (wg `templates/PROPOZYCJA_TEMPLATE.md`) |
| Zadanie/backlog | wg `templates/ZADANIE_TEMPLATE.md` |
| Kod produktu docelowego (później) | najlepiej osobny podkatalog w `macius/` (np. `macius/symbiont/`) — albo bezpośrednio przerobiony `gema0/`/`kebabkiller/`, jeśli tak zdecyduje audyt/fuzja |

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

> **To są kopie — baw się śmiało.** gema0 i kebabkiller możesz przerabiać, ciąć i przepisywać.
> Oryginały żyją w zdalnych repo. Jedyne, czego pilnujemy: **audyt przed dużym cięciem** i
> **commit na bieżąco** (żeby móc cofnąć). Raporty/decyzje i tak trzymamy w `macius/`.
