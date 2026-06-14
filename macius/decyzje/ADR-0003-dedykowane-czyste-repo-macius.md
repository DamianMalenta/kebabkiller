# ADR-0003 — Dedykowane, czyste repo `macius` + dołączona wizja

- **Data:** 2026-06-14
- **Status:** zaakceptowana
- **Kontekst workspace:** macius

## Kontekst
Właściciel utworzył osobne, czyste repozytorium **https://github.com/DamianMalenta/macius**. Wcześniej
infrastruktura macius była publikowana na gałęzi repo `kebabkiller`, co przy „grubym" pull powodowało
doczepianie obcych plików w korzeniu. Potrzeba: macius ma być **samodzielny i czysty**.

## Decyzja
- Macius żyje w **dedykowanym repo `macius`**. Układ: `macius/` (infrastruktura) + `kebabkiller/` +
  `gema0/` (kopie) obok siebie w korzeniu repo.
- **Wizja produktu dołączona** jako `macius/wizja-symbiont/` (samodzielna kopia lejka Symbiont) — żeby
  workspace nie zależał od obecności innego repo; wszystkie odwołania `../../projekt-symbiont/...`
  przekierowane na `../wizja-symbiont/...`.
- Publikacja wg `INSTRUKCJA/JAK_POBRAC_DO_REPO_MACIUS.md` (pobierz folder `macius` z gałęzi
  `cursor/macius-infra-6fb4` repo kebabkiller → dodaj kopie → push do repo macius).

## Uwaga techniczna
Token agenta chmurowego jest przypięty do repo `kebabkiller`, więc agent **nie mógł** wypchnąć
bezpośrednio do repo `macius`. Publikację do `macius` wykonuje właściciel wg instrukcji (jednorazowo).

## Konsekwencje
- **Pozytywne:** czysty, samodzielny workspace; brak duplikacji; wizja zawsze pod ręką.
- **Negatywne / koszt:** kopia wizji w dwóch miejscach (źródło w kebabkiller + kopia w macius) — przy
  zmianach wizji trzeba zsynchronizować (rzadkie; wizja jest stabilna).

## Następne kroki
- [ ] Właściciel publikuje macius do repo `macius` (instrukcja).
- [ ] Etap 0 (twardy audyt gema0) bez zmian.
