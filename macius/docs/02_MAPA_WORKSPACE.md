# 02. Mapa workspace — trzy światy, jedno repo

**Cel:** żeby agent nigdy nie pomieszał, gdzie jest co i gdzie wolno pisać.

---

## Układ docelowy (na laptopie)

```
(repo macius)
├── macius/                  ← PRACA: centrum dowodzenia (docs, audyty, decyzje, plan, kod, wizja-symbiont)
├── kebabkiller/             ← KOPIA: działający produkt + 1. host (edytuj swobodnie wg potrzeb)
└── gema0/                   ← KOPIA: prototyp do audytu i kanibalizacji (przerabiaj/tnij do woli)
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

## Czyste, dedykowane repo (bez duplikacji)

Macius żyje teraz w **osobnym, czystym repo `macius`**. Folder `macius/` (ta infrastruktura) ma w sobie
wszystko, czego potrzeba — łącznie z **dołączoną wizją** w `macius/wizja-symbiont/`. Nie ma żadnych
„doczepionych" plików obcego repo.

- `kebabkiller/` i `gema0/` to **kopie**, które wrzucasz obok `macius/`.
- Cała nowa praca i decyzje toczą się **w `macius/`**.
- Jak pobrać i opublikować do repo `macius`: [`../INSTRUKCJA/JAK_POBRAC_DO_REPO_MACIUS.md`](../INSTRUKCJA/JAK_POBRAC_DO_REPO_MACIUS.md).

---

## Zasada złota

> **To są kopie — baw się śmiało.** gema0 i kebabkiller możesz przerabiać, ciąć i przepisywać.
> Oryginały żyją w zdalnych repo. Jedyne, czego pilnujemy: **audyt przed dużym cięciem** i
> **commit na bieżąco** (żeby móc cofnąć). Raporty/decyzje i tak trzymamy w `macius/`.
