# 01. Wizja i marzenie → produkt

**Status:** wizja (źródło prawdy kierunku). Implementacja: patrz [07_ROADMAPA.md](07_ROADMAPA.md).

---

## Marzenie (słowami właściciela, przełożone na wymagania)

> „Chcę mieć dostęp do własnego agenta — niekoniecznie z Cursora — darmowego mistrza audytów
> plików. Chcę z nim bezpiecznie tworzyć i naprawiać moje oprogramowanie, które stoi już na
> docelowych serwerach, z każdego miejsca na ziemi: telefon czy laptop — ta sama wersja, bez
> utrudnień, koszty zminimalizowane. Agent ma instalować się w **rdzeń** wszystkich moich
> oprogramowań jako kolejny moduł i podczas instalacji wpinać się w strukturę programu, tworząc
> w ten sposób swoją **tożsamość** z tym programem."

## Z marzenia wynika 7 twardych wymagań

| # | Wymaganie | Co to znaczy technicznie |
|---|-----------|--------------------------|
| W1 | **Własny agent, nie zależny od Cursora** | Samohostowany silnik (open-source) + własny panel. Brak vendor lock-in. |
| W2 | **Darmowy mistrz audytów plików** | Audyt = czysty kod (ripgrep/AST/lintery) → 0 zł. Rozumowanie LLM na **darmowych tierach**. |
| W3 | **Bezpieczne tworzenie i naprawa** | Agent nigdy nie edytuje żywej produkcji. Tylko diff → gałąź → testy → PR → wdrożenie z rollbackiem. |
| W4 | **Działa na docelowych serwerach (prod)** | Read-only audyt na prod; zmiany wyłącznie przez pipeline (git/CI/deploy), odwracalne. |
| W5 | **Dostęp z każdego miejsca, ta sama wersja** | „Mózg" hostowany **raz** (web/PWA, HTTPS, auth). Telefon i laptop = ten sam URL = ta sama wersja. |
| W6 | **Minimalny koszt** | Jeden mały/„always-free" host na Rdzeń + darmowe tiery LLM + lokalny fallback. Patrz [04](04_MODEL_KOSZTOW.md). |
| W7 | **Instaluje się w rdzeń jako moduł i ma tożsamość** | Cienki moduł-adapter wpinany do hosta + plik **tożsamości** (`symbiont.identity.*`) + per-host MCP. Patrz [06](06_INSTALACJA_JAKO_MODUL.md). |

---

## Co to JEST, a czym NIE jest

**JEST:**
- Jeden samohostowany „mózg" agenta (**Rdzeń Symbionta**) z panelem web/PWA.
- Cienki **Moduł-adapter** wpinany w rdzeń każdego oprogramowania-hosta.
- **Tożsamość per host** = manifest + dedykowany serwer MCP + izolowana przestrzeń gałęzi/worktree.
- Darmowy silnik audytów plików + bezpieczny tor zmian (diff → PR → deploy → rollback).

**NIE jest:**
- Kolejnym płatnym SaaS-em ani wrapperem na Cursor Cloud (to był odrzucony kierunek w Kebabkiller — patrz [08](08_ROZDZIELENIE_OD_KEBABKILLER.md)).
- Agentem, który dostaje klucze do prod i „sam sobie" wgrywa zmiany na żywo.
- Osobną kopią agenta na każdym urządzeniu (to łamałoby W5 „ta sama wersja").

---

## Nazwa (codename) — do decyzji właściciela

„**Symbiont**" — bo wpina się w rdzeń hosta i żyje z nim w symbiozie (stąd „tożsamość z programem").

Alternatywy: **Rdzeń**, **Strażnik**, **Audytor**, **Rdzeniak**. Zmiana nazwy = tylko zmiana w tym lejku;
nie wpływa na architekturę.

---

## Definicja sukcesu (kiedy marzenie jest spełnione)

1. Wchodzę z telefonu na jeden URL, loguję się, widzę **ten sam** panel co na laptopie.
2. Wybieram host „Kebabkiller Studio" → agent zna jego tożsamość (stack, zasady, pliki).
3. Mówię „zaudytuj katalog X" → dostaję raport audytu **bez kosztu LLM** (czysty kod) + opcjonalne podsumowanie.
4. Mówię „napraw błąd Y" → agent robi **diff w izolowanej gałęzi**, odpala testy, otwiera **PR** — produkcja nietknięta.
5. Po akceptacji PR zmiana trafia na serwer przez normalny deploy, z możliwością **rollbacku**.
6. Rachunek na koniec miesiąca: ~0 zł (lub kilka zł za mały host), bo audyty są darmowe, a LLM jedzie z darmowych tierów.
