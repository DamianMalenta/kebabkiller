# MACIUS — workspace dla agentów AI (nowe przejście do dokumentacji)

> **To jest nowy, główny punkt wejścia.** Stare przejścia (lejek Kebabkillera w `kebabkiller/docs/`,
> lejek Symbionta w `projekt-symbiont/`) **nadal istnieją jako źródła**, ale **start agenta zaczyna się
> TUTAJ** → [`docs/00_START_TUTAJ.md`](docs/00_START_TUTAJ.md).

**Macius** to „centrum dowodzenia": idealna infrastruktura do pracy agentów AI nad **jednym celem** —
zbudowaniem innowacyjnego oprogramowania na bazie **twardego audytu gema0** + **marzeń właściciela**
(agent Symbiont: darmowy, samohostowany, wpinany w rdzeń, mistrz audytów, bezpieczny na produkcji).

---

## Układ lokalny (tak to wygląda na laptopie)

Tworzysz nowy katalog (= repo `macius`), wrzucasz do niego dwa projekty-źródła i robisz `pull` tej
architektury:

```
macius/                      ← repo git "macius" (ten katalog)
├── kebabkiller/             ← WRZUCASZ: aktualny kod repo Kebabkiller (źródło/wzór + 1. host)
├── gema0/                   ← WRZUCASZ: aktualny kod prototypu gema0 (przedmiot twardego audytu)
└── macius/                  ← PULL: ta infrastruktura (docs, zasady, audyt, szablony, prompty)
```

> Uwaga: po `pull` tej gałęzi w korzeniu pojawią się też pliki repo Kebabkiller (`backend/`,
> `frontend/`, `docs/`, `projekt-symbiont/`). To efekt uboczny pochodzenia gałęzi — **ignoruj je**
> i traktuj `kebabkiller/` (Twój wrzucony folder) jako prawdziwe źródło. Cała NOWA praca dzieje się
> w `macius/`. Szczegóły i porządkowanie: [`docs/02_MAPA_WORKSPACE.md`](docs/02_MAPA_WORKSPACE.md).

---

## Start (czytaj w tej kolejności)

1. [`docs/00_START_TUTAJ.md`](docs/00_START_TUTAJ.md) — mapa i zasady
2. [`docs/01_MISJA.md`](docs/01_MISJA.md) — cel i marzenie
3. [`docs/HANDOFF_AKTUALNY.md`](docs/HANDOFF_AKTUALNY.md) — co robimy teraz

## Co tu jest

| Folder | Po co |
|--------|-------|
| `docs/` | Lejek dokumentacji macius (misja, mapa, zasady, audyt, produkt, roadmapa) |
| `templates/` | Szablony: audyt, ADR, propozycja architektury, zadanie |
| `prompts/` | Gotowe prompty do nowych okien (onboarding, audyt gema0, fuzja) |
| `decyzje/` | ADR — zapisy decyzji architektonicznych |
| `audyty/` | Wyniki audytów (raporty generowane przez agentów) |
| `AGENTS.md` | Kontrakt pracy agenta w tym workspace |
