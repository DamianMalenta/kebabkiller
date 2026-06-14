# 00. START TUTAJ — workspace MACIUS (agent czytaj to na początku)

**To jest GŁÓWNE, nowe przejście do dokumentacji.** Stare lejki są źródłami, ale start zaczyna się tu.

**Cel nadrzędny:** zbudować **jedno** innowacyjne oprogramowanie na bazie **twardego audytu gema0**
+ **marzeń właściciela** (agent **Symbiont**: darmowy, samohostowany, wpinany w rdzeń, mistrz audytów,
bezpieczny na produkcji, dostępny z każdego miejsca, ~0 zł).

---

## Start sesji — 3 pliki, ~3 minuty

| Kolejność | Plik | Po co |
|-----------|------|--------|
| **1** | Ten plik | Mapa i zasady workspace |
| **2** | [01_MISJA.md](01_MISJA.md) | Cel + marzenie → wymagania |
| **3** | [HANDOFF_AKTUALNY.md](HANDOFF_AKTUALNY.md) | Co robimy TERAZ |

**Nie czytaj** reszty, dopóki zadanie tego nie wymaga.

---

## Mapa dokumentacji

| Potrzebujesz… | Czytaj… |
|---------------|---------|
| Misja, marzenie, wymagania | [01_MISJA.md](01_MISJA.md) |
| Układ workspace + zasady rozdzielenia 3 światów | [02_MAPA_WORKSPACE.md](02_MAPA_WORKSPACE.md) |
| Zasady pracy agenta (tryby, bezpieczeństwo, git) | [03_ZASADY_AGENTA.md](03_ZASADY_AGENTA.md) |
| **Twardy audyt gema0 — metodyka + checklist** | **[04_AUDYT_GEMA0.md](04_AUDYT_GEMA0.md)** |
| Produkt docelowy (fuzja gema0 × marzenie) | [05_PRODUKT_DOCELOWY.md](05_PRODUKT_DOCELOWY.md) |
| Roadmapa fuzji (etapy) | [06_ROADMAPA_FUZJI.md](06_ROADMAPA_FUZJI.md) |
| Szablony (audyt, ADR, propozycja, zadanie) | [`../templates/`](../templates/) |
| Gotowe prompty do nowych okien | [`../prompts/`](../prompts/) |
| Decyzje architektoniczne (ADR) | [`../decyzje/`](../decyzje/) |
| Historia sesji | [DZIENNIK_SESJI.md](DZIENNIK_SESJI.md) |

### Źródła głębsze (poza macius, jeśli obecne w repo)
- Pełna wizja Symbionta: `../../projekt-symbiont/docs/00_START_TUTAJ.md`
- Wewnętrzny lejek Kebabkillera: `../../kebabkiller/docs/00_START_TUTAJ.md` (lub `../../docs/` w korzeniu)

---

## Zasady (skrót — pełne w [03](03_ZASADY_AGENTA.md))

1. **PLAN domyślnie.** Kod dopiero po „OK, rób".
2. **Anty-halucynacja:** cytuj realne ścieżki, nie zgaduj.
3. **Trzy światy:** `gema0/` (audyt, read-only), `kebabkiller/` (źródło/host), `macius/` (nowa praca). Nie mieszać.
4. **Nie dotykaj `gema0/`** — audyt jest read-only.
5. **Wyniki:** audyty → `audyty/`, decyzje → `decyzje/`, wg szablonów.
6. **Po sesji:** aktualizuj `HANDOFF_AKTUALNY.md` + dopisz do `DZIENNIK_SESJI.md`.

---

## Pierwszy ruch (rekomendacja)

Jeśli `gema0/` jest już w workspace → odpal **twardy audyt** wg [04_AUDYT_GEMA0.md](04_AUDYT_GEMA0.md)
(prompt gotowy: [`../prompts/PROMPT_AUDYT_GEMA0.md`](../prompts/PROMPT_AUDYT_GEMA0.md)). Audyt to
fundament — bez niego fuzja to zgadywanie.
