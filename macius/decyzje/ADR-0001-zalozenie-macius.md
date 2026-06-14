# ADR-0001 — Założenie workspace macius jako głównego przejścia do dokumentacji

- **Data:** 2026-06-14
- **Status:** zaakceptowana
- **Kontekst workspace:** macius

## Kontekst
Powstały dwa wątki: produkt **Symbiont** (lejek `projekt-symbiont/`) i potrzeba **fuzji** z prototypem
**gema0** na bazie jego **twardego audytu**. Dotychczasowe przejście do dokumentacji (lejek Kebabkillera
w `docs/`) nie obejmuje tego celu i miesza konteksty. Właściciel poprosił o **całkowitą zmianę przejścia
do dokumentacji** i osobną, idealną infrastrukturę dla agentów AI.

## Decyzja
Tworzymy katalog **`macius/`** jako **główny punkt wejścia** dla agentów. Układ lokalny:
`macius/` (repo) zawiera `kebabkiller/`, `gema0/` (wrzucane przez właściciela) oraz `macius/`
(ta infrastruktura). Start agenta = `macius/docs/00_START_TUTAJ.md`. gema0 i kebabkiller są źródłami
read-only; cała nowa praca dzieje się w `macius/`.

## Rozważane opcje
| Opcja | Plusy | Minusy |
|-------|-------|--------|
| A. macius jako nowy front door (wybrana) | jeden cel, jasne 3 światy, czyste rozdzielenie | duplikacja plików Kebabkillera w korzeniu po pull |
| B. Rozbudować lejek Symbiont | mniej katalogów | miesza produkt z audytem gema0 i z Kebabkillerem |
| C. Trzymać wszystko w `docs/` Kebabkillera | zero nowych katalogów | łamie prośbę o nowe przejście; chaos kontekstów |

## Uzasadnienie
Opcja A realizuje wprost prośbę właściciela (nowe przejście + idealna infrastruktura), daje twarde
rozdzielenie 3 światów i osadza cel (fuzja na bazie audytu gema0) w jednym miejscu.

## Konsekwencje
- **Pozytywne:** jeden, jasny start; metodyka audytu i szablony gotowe; bezpieczne zasady pracy.
- **Negatywne / koszt:** po `git pull` w korzeniu repo macius pojawiają się pliki Kebabkillera —
  traktować jako szum (instrukcja porządkowania w `docs/02_MAPA_WORKSPACE.md`).
- **Ryzyka i mitigacje:** ryzyko mieszania światów → twarde zasady w `AGENTS.md` + scoped Cursor rule.

## Następne kroki
- [ ] Właściciel wrzuca `gema0/` i `kebabkiller/`.
- [ ] Etap 0: twardy audyt gema0 (`docs/04_AUDYT_GEMA0.md`).
- [ ] Etap 1: decyzja o wariancie fuzji (kolejny ADR).
