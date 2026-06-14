# 📘 INSTRUKCJA GŁÓWNA — co robić dalej (prosto, krok po kroku)

> Cześć! To jest Twoja mapa. Czytasz ją raz, wykonujesz po kolei, i z każdym krokiem jesteś
> bliżej marzenia: **własnego, darmowego agenta AI (Symbiont)**, który audytuje i bezpiecznie
> naprawia Twoje programy z każdego miejsca na świecie.
>
> Nie musisz znać się na programowaniu. **Twoja rola = decydować i kopiować gotowe teksty.**
> Robotę robią agenci AI. Ty jesteś szefem. 😎

---

## 🎯 O co w tym wszystkim chodzi (w 3 zdaniach)

1. Masz dwa projekty: **kebabkiller** (działający) i **gema0** (starszy prototyp).
2. Chcemy z nich + Twojego marzenia zbudować **jeden nowy produkt: agenta Symbiont**.
3. Żeby zrobić to mądrze, najpierw agent **dokładnie zbada gema0** (twardy audyt), a potem
   zaproponuje, jak to wszystko połączyć. Ty zatwierdzasz kierunek.

To centrum dowodzenia nazywa się **macius**. Wszystko, co robisz, zaczyna się tutaj.

---

## ✅ Zasada numer jeden (zapamiętaj)

> **Agent domyślnie tylko PLANUJE i czyta. Kod pisze dopiero, gdy napiszesz mu: „OK, rób".**

Dzięki temu nic się nie zepsuje przez przypadek. Ty masz kontrolę na każdym kroku.

---

## 🧭 Mapa drogi (5 kroków)

```
KROK 1  Przygotuj komputer (raz)         →  masz narzędzia
KROK 2  Zbuduj katalog "macius"          →  kebabkiller + gema0 + macius razem
KROK 3  Audyt gema0 (agent bada)         →  wiesz, co masz w ręku
KROK 4  Decyzja: jak połączyć            →  wybierasz kierunek (agent doradza)
KROK 5  Budowa MVP (darmowy audyt)       →  pierwszy działający kawałek Symbionta
```

Niżej każdy krok dokładnie. Odhaczaj ☐ → ☑ jak skończysz.

---

## KROK 1 — Przygotuj komputer (robisz to tylko raz)

☐ **1.1** Zainstaluj **Git** → https://git-scm.com (klikasz „Download", instalujesz „dalej, dalej").
☐ **1.2** Zainstaluj **Node.js** (wersja LTS) → https://nodejs.org (przyda się później do uruchamiania).
☐ **1.3** Otwórz **Cursor** (już go masz). To w nim będziesz rozmawiać z agentami AI.

> Nie musisz nic z tego rozumieć „pod maską". To jak zainstalować przeglądarkę — klikasz dalej.

---

## KROK 2 — Zbuduj katalog „macius" (Twoje centrum dowodzenia)

Chcemy taki układ na dysku:

```
macius/                  ← nowy katalog (Twoje repo)
├── kebabkiller/         ← tu wrzucasz kod kebabkiller
├── gema0/               ← tu wrzucasz kod gema0
└── macius/              ← tu wpadnie ta instrukcja i cała architektura
```

☐ **2.1** Utwórz nowy, pusty folder i nazwij go `macius`.
☐ **2.2** Wrzuć do środka folder **`kebabkiller`** (aktualny kod) i folder **`gema0`** (aktualny kod).
☐ **2.3** Dorzuć do środka folder **`macius`** z tą architekturą. Masz **dwie drogi do wyboru**:

**🟢 DROGA A — najprostsza (przez paczkę ZIP, bez komend):**
1. Wejdź na PR z architekturą na GitHubie (link dostałeś w czacie, „macius infra").
2. Pobierz kod gałęzi jako ZIP (przycisk „Code → Download ZIP" na tej gałęzi).
3. Z rozpakowanego ZIP-a skopiuj **tylko folder `macius`** do swojego katalogu `macius`.
4. Gotowe. Pomiń komendy poniżej.

**🟦 DROGA B — przez Git (gdy wolisz komendy):** otwórz terminal w swoim folderze `macius` i wklej:
```bash
git init
git remote add zrodlo https://github.com/DamianMalenta/kebabkiller.git
git fetch zrodlo cursor/macius-infra-6fb4
git checkout zrodlo/cursor/macius-infra-6fb4 -- macius
git remote remove zrodlo
```
> To ściąga **tylko** folder `macius` z architekturą — bez bałaganu. Potem możesz podpiąć własne repo
> „macius" na GitHubie (`git remote add origin <adres-twojego-repo>`), gdy zechcesz mieć je w chmurze.

☐ **2.4** Sprawdź układ: w `macius/` masz teraz trzy foldery: `kebabkiller`, `gema0`, `macius`. ✅

> Więcej o układzie i sprzątaniu: [`../docs/02_MAPA_WORKSPACE.md`](../docs/02_MAPA_WORKSPACE.md).

---

## KROK 3 — Audyt gema0 (agent bada, Ty patrzysz) ⭐

To najważniejszy krok. Agent przeczyta gema0 i powie Ci **faktami**: co jest dobre do użycia,
a co do wyrzucenia. Bez tego łączenie projektów byłoby zgadywaniem.

☐ **3.1** W Cursorze otwórz folder `macius` (ten główny, z trzema podfolderami).
☐ **3.2** Otwórz **nowe okno czatu** z agentem.
☐ **3.3** Skopiuj i wklej **cały** prompt z pliku
[`../prompts/PROMPT_AUDYT_GEMA0.md`](../prompts/PROMPT_AUDYT_GEMA0.md) (jest w środku, gotowy).
☐ **3.4** Agent najpierw pokaże **plan audytu**. Przeczytaj, i jeśli pasuje — napisz **„OK"**.
☐ **3.5** Agent wykona audyt i zapisze raport w `macius/audyty/AUDYT_GEMA0_<data>.md`.

**Co zobaczysz na końcu:** raport z oceną każdej części gema0 jednym z symboli:
- ♻️ **REUŻYJ** — dobre, bierzemy do nowego produktu
- 🔧 **REFAKTOR** — dobry pomysł, trzeba poprawić
- 🧪 **ZBADAJ** — niejasne, sprawdzimy osobno
- 🗑️ **ODRZUĆ** — do wyrzucenia

> Metodyka po ludzku: [`../docs/04_AUDYT_GEMA0.md`](../docs/04_AUDYT_GEMA0.md).

---

## KROK 4 — Decyzja: jak połączyć gema0 z marzeniem

Teraz, gdy znasz fakty, agent zaproponuje **jak spiąć** gema0 i Symbionta w jeden produkt.

☐ **4.1** Nowe okno czatu → wklej prompt z [`../prompts/PROMPT_FUZJA.md`](../prompts/PROMPT_FUZJA.md).
☐ **4.2** Agent pokaże **3 warianty** połączenia (A/B/C) + rekomendację + **innowacyjne pomysły zastosowań**.
☐ **4.3** Ty wybierasz wariant. Agent zapisze decyzję jako „ADR" w `macius/decyzje/` (żeby nie zapomnieć dlaczego).

> Warianty wyjaśnione prosto: [`../docs/05_PRODUKT_DOCELOWY.md`](../docs/05_PRODUKT_DOCELOWY.md).

---

## KROK 5 — Budowa pierwszego kawałka (MVP: darmowy audyt)

Najpierw budujemy część **najbezpieczniejszą i darmową**: agent, który **tylko czyta i audytuje**
pliki (nic nie psuje). To już realna wartość — „darmowy mistrz audytów" z Twojego marzenia.

☐ **5.1** Nowe okno → poproś agenta o realizację **Etapu 3** z [`../docs/06_ROADMAPA_FUZJI.md`](../docs/06_ROADMAPA_FUZJI.md).
☐ **5.2** Pamiętaj zasadę: najpierw PLAN, potem Twoje **„OK, rób"**, dopiero wtedy kod.
☐ **5.3** Gdy zadziała — masz pierwszy fragment Symbionta, dostępny z przeglądarki. 🎉

Dalej idziesz roadmapą: bezpieczne naprawy przez PR → bramka darmowych modeli → wiele programów.

---

## 🧠 Jak rozmawiać z agentem (3 złote zdania)

1. **„Najpierw pokaż plan, nie pisz kodu."** — zawsze na start nowego zadania.
2. **„OK, rób."** — dopiero gdy plan Ci pasuje.
3. **„Nie dotykaj gema0 — tylko czytaj."** — gdy pracujecie nad audytem.

> Masz gotowe prompty w folderze [`../prompts/`](../prompts/) — nie musisz nic wymyślać, kopiuj i wklejaj.

---

## 🆘 Coś nie działa?

Zajrzyj do [`CZESTE_PROBLEMY.md`](CZESTE_PROBLEMY.md) — proste rozwiązania najczęstszych zagwozdek.
Nie znasz słowa? → [`SLOWNICZEK.md`](SLOWNICZEK.md) tłumaczy „komputerowe" słowa po ludzku.
Chcesz ściągę na jednej stronie? → [`SCIAGA.md`](SCIAGA.md).

---

## ❤️ Na koniec

Nie spiesz się. Rób krok po kroku. Po każdym kroku coś masz w ręku. Agent jest cierpliwy i zrobi
robotę — Ty tylko prowadź go za rękę swoimi decyzjami. **To Twój projekt i Twoje marzenie. Dasz radę.**
