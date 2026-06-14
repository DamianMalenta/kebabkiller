# MACIUS — workspace dla agentów AI (główne przejście do dokumentacji)

> **To jest główny punkt wejścia.** Start agenta zaczyna się TUTAJ → [`docs/00_START_TUTAJ.md`](docs/00_START_TUTAJ.md).
> Pełna wizja produktu jest **dołączona** w [`wizja-symbiont/`](wizja-symbiont/) (samodzielna kopia).

**Macius** to „centrum dowodzenia": idealna infrastruktura do pracy agentów AI nad **jednym celem** —
zbudowaniem innowacyjnego oprogramowania na bazie **twardego audytu gema0** + **marzeń właściciela**
(agent Symbiont: darmowy, samohostowany, wpinany w rdzeń, mistrz audytów, bezpieczny na produkcji).

---

## Układ w repo `macius` (na laptopie)

To repo (`macius`) jest dedykowane i czyste. Wrzucasz do niego kopie dwóch projektów-źródeł obok
folderu z tą infrastrukturą:

```
(repo macius)
├── macius/                  ← TA infrastruktura: docs, instrukcja, audyt, szablony, prompty, wizja-symbiont
├── kebabkiller/             ← WRZUCASZ: kopia kodu Kebabkiller (źródło/wzór + 1. host)
└── gema0/                   ← WRZUCASZ: kopia prototypu gema0 (materiał do audytu i kanibalizacji)
```

> To są **lokalne kopie** — `kebabkiller/` i `gema0/` możesz dowolnie przerabiać; oryginały w ich
> repo są bezpieczne. Cała nowa praca i decyzje toczą się w `macius/`.
> Jak to pobrać/opublikować: [`INSTRUKCJA/JAK_POBRAC_DO_REPO_MACIUS.md`](INSTRUKCJA/JAK_POBRAC_DO_REPO_MACIUS.md).

---

## 👉 Dla właściciela (start tutaj, prosto)

Jeśli nie chcesz wchodzić w szczegóły techniczne — przeczytaj **prostą instrukcję krok po kroku**:
**[`INSTRUKCJA/00_INSTRUKCJA_GLOWNA.md`](INSTRUKCJA/00_INSTRUKCJA_GLOWNA.md)** (+ ściąga, słowniczek,
częste problemy w folderze [`INSTRUKCJA/`](INSTRUKCJA/)).

## Start dla agenta (czytaj w tej kolejności)

1. [`docs/00_START_TUTAJ.md`](docs/00_START_TUTAJ.md) — mapa i zasady
2. [`docs/01_MISJA.md`](docs/01_MISJA.md) — cel i marzenie
3. [`docs/HANDOFF_AKTUALNY.md`](docs/HANDOFF_AKTUALNY.md) — co robimy teraz

## Co tu jest

| Folder | Po co |
|--------|-------|
| `INSTRUKCJA/` | Prosta instrukcja dla właściciela (krok po kroku, ściąga, słowniczek, jak pobrać) |
| `docs/` | Lejek dokumentacji macius (misja, mapa, zasady, audyt, produkt, roadmapa) |
| `wizja-symbiont/` | Dołączona, pełna wizja produktu (architektura, koszty, bezpieczeństwo, instalacja) |
| `templates/` | Szablony: audyt, ADR, propozycja architektury, zadanie |
| `prompts/` | Gotowe prompty do nowych okien (onboarding, audyt gema0, fuzja) |
| `decyzje/` | ADR — zapisy decyzji architektonicznych |
| `audyty/` | Wyniki audytów (raporty generowane przez agentów) |
| `AGENTS.md` | Kontrakt pracy agenta w tym workspace |
