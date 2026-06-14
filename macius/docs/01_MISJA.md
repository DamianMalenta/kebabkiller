# 01. Misja i marzenie → wymagania

**Status:** źródło prawdy kierunku dla workspace macius.

---

## Misja (jedno zdanie)

> Z **twardego audytu gema0** i **marzeń właściciela** zbudować **jedno innowacyjne oprogramowanie**:
> własnego, **darmowego, samohostowanego agenta AI (Symbiont)**, który instaluje się **w rdzeń**
> dowolnego programu, dostaje jego **tożsamość**, jest **mistrzem audytów plików** i **bezpiecznie**
> tworzy/naprawia kod na docelowych serwerach — dostępny **z każdego miejsca**, przy **minimalnym koszcie**.

## Marzenie → 7 twardych wymagań

| # | Wymaganie | Znaczenie techniczne |
|---|-----------|----------------------|
| W1 | Własny agent, nie zależny od Cursora | Samohostowany silnik open-source + własny panel |
| W2 | Darmowy mistrz audytów plików | Audyt = czysty kod (rg/AST/lint) = 0 zł; LLM tylko na darmowych tierach |
| W3 | Bezpieczne tworzenie i naprawa | Nigdy edycji prod wprost; diff → gałąź → testy → PR → rollback |
| W4 | Działa na docelowych serwerach | Read-only audyt na prod; zmiany tylko przez pipeline, odwracalne |
| W5 | Dostęp z każdego miejsca, ta sama wersja | „Mózg" hostowany raz (PWA, HTTPS+auth); telefon i laptop = ten sam URL |
| W6 | Minimalny koszt | 1 mały/„always-free" host + darmowe LLM + lokalny fallback |
| W7 | Instaluje się w rdzeń jako moduł + tożsamość | Cienki moduł-adapter + manifest tożsamości + serwer MCP per host |

> Pełne rozwinięcie marzenia, architektury (Rdzeń+Moduł+Tożsamość), kosztów i bezpieczeństwa:
> dołączony lejek wizji — [`../wizja-symbiont/`](../wizja-symbiont/).

## Rola gema0 w misji

gema0 to **wcześniejszy prototyp** właściciela. Zanim cokolwiek połączymy, robimy **twardy audyt**
(fakty z kodu): co już działa, co jest wartościowe do ponownego użycia, co jest długiem, co odrzucić.
Audyt jest **fundamentem** decyzji o fuzji. Metodyka: [04_AUDYT_GEMA0.md](04_AUDYT_GEMA0.md).

## Definicja sukcesu workspace macius

1. Istnieje **twardy raport audytu gema0** (fakty, ścieżki, oceny) w `audyty/`.
2. Istnieje **propozycja fuzji** gema0 × marzenie w 2–3 wariantach + rekomendacja (ADR w `decyzje/`).
3. Istnieje **roadmapa** doprowadzenia do MVP produktu docelowego.
4. Agent w każdej sesji wie: skąd start (ten lejek), co wolno (zasady), gdzie pisać wyniki.
