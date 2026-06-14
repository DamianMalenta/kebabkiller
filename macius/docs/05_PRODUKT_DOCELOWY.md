# 05. Produkt docelowy — fuzja gema0 × marzenie

**Status:** wizja docelowa. Konkrety wariantów decydujemy po audycie (ADR w `decyzje/`).

---

## Co budujemy

**Symbiont** — własny, darmowy, samohostowany agent AI, który:
- instaluje się **w rdzeń** dowolnego oprogramowania jako moduł i dostaje jego **tożsamość**,
- jest **mistrzem audytów plików** (darmowo, czystym kodem),
- **bezpiecznie** tworzy i naprawia kod na docelowych serwerach (diff → PR → rollback),
- jest dostępny **z każdego miejsca** (jeden Rdzeń, panel PWA, ta sama wersja),
- kosztuje **~0 zł** (darmowe tiery LLM + lokalny fallback; audyt bez LLM).

Architektura: **Rdzeń + Moduł + Tożsamość**. Pełny opis: `../../projekt-symbiont/docs/03_ARCHITEKTURA.md`.

## Gdzie wchodzi gema0

gema0 to materiał wejściowy. Po audycie ([04](04_AUDYT_GEMA0.md)) jego komponenty trafiają do jednej
z ról:

| Rola w produkcie docelowym | Co z gema0 może tu wejść (do potwierdzenia audytem) |
|----------------------------|------------------------------------------------------|
| Rdzeń / silnik | gotowe, sprawdzone fragmenty logiki (♻️ REUŻYJ) |
| Moduł-adapter / integracje | wzorce wpięcia w host, jeśli istnieją |
| Audyt / analiza plików | istniejące narzędzia/skrypty analizy |
| UI / panel | komponenty interfejsu nadające się do reużycia |
| Odrzucone | dług/poza celem (🗑️) |

## Trzy możliwe warianty fuzji (do rozstrzygnięcia ADR)

| Wariant | Idea | Kiedy sensowny |
|---------|------|----------------|
| **A. gema0 jako silnik w Symbioncie** | bierzemy rdzeń gema0 i obudowujemy go warstwą Symbionta (moduł, tożsamość, panel) | gdy audyt pokaże, że gema0 ma mocny, reużywalny rdzeń |
| **B. Symbiont jako warstwa nad gema0** | gema0 zostaje, Symbiont wpina się w jego rdzeń jako moduł (dogfooding: gema0 = pierwszy host) | gdy gema0 jest wartościowy jako *produkt*, a nie jako silnik agenta |
| **C. Zielone pole + perełki** | budujemy Symbionta od nowa wg lejka, przenosząc tylko ♻️ komponenty z gema0 | gdy audyt pokaże dużo długu, mało reużycia |

> Rekomendację wybiera się **po audycie**, na bazie liczby komponentów ♻️/🔧 vs 🗑️. Zapis: ADR w `decyzje/`.

## Kryteria wyboru wariantu

- Ile realnie da się reużyć (liczba ♻️/🔧 z audytu)?
- Czy stack gema0 pasuje do W1–W7 (samohosting, darmowość, MCP/moduł)?
- Koszt utrzymania vs. koszt przepisania.
- Ryzyko bezpieczeństwa (dług, podatności) przy reużyciu.

## Po wyborze → roadmapa

Wybrany wariant przekłada się na etapy w [06_ROADMAPA_FUZJI.md](06_ROADMAPA_FUZJI.md).
