# Protokół agenta — zamykanie sesji / handoff

## Kiedy stosować

**Nie ma automatycznego skryptu** — agent rozpoznaje **intencję**, nie dokładną pisownię.

### Jedyny trigger zalecany (zero polskich znaków, 1 słowo)

```
HANDOFF
```

Wklej samo `HANDOFF` na końcu sesji — najmniej nieporozumień, najmniej tokenów w odpowiedzi.

### Inne formy — agent i tak powinien zadziałać

Rozpoznaj luźno (wielkość liter, brak ę/ą/ł, literówki), np.:
- `kończymy pracę`, `konczym prace`, `konczymy prace`
- `przekazujemy do nowego okna`, `nowe okno czatu`
- `przygotuj handoff`, `zamykamy sesję`

**Nie uruchamiaj protokołu**, gdy user tylko **wspomina** o końcu pracy w treści (np. „jak skończymy pracę nad Fazą 5…”) — wtedy to plan, nie handoff.

---

## Oszczędność tokenów

| Sytuacja | Co czyta agent |
|----------|----------------|
| Zwykła wiadomość w trakcie sesji | **Nic** z docs (pracuje z kontekstu czatu) |
| **Start nowego okna czatu** | Tylko 3 pliki: `00_START`, `HANDOFF_AKTUALNY`, `03` |
| User napisał **HANDOFF** (lub równoważnik) | Protokół poniżej + ewentualnie szybki rzut oka na `03` |

**Nie** czytaj dziennika, archiwum ani 01/02/04 przy handoff — chyba że sesja tego wymagała.

Po handoff odpowiedz **krótko**: „Zaktualizowałem HANDOFF + dziennik. W nowym czacie wklej prompt z HANDOFF.” — bez powtarzania całej historii.

---

## Obowiązkowe kroki agenta (kolejność)

### 1. Zaktualizuj `HANDOFF_AKTUALNY.md`
Jeden plik, **nadpisz całość**. Musi zawierać:
- datę + numer sesji
- TL;DR (3–5 linii)
- co działa / co nie działa
- **jedno** jasne „zrób to jako pierwsze”
- prompt do wklejenia w nowym czacie
- ścieżki kluczowych plików kodu (jeśli się zmieniły)

### 2. Dopisz wpis na górę `DZIENNIK_SESJI.md`
Struktura wpisu:
```
## Sesja #N — YYYY-MM-DD
**Zakres:** …
### Zrobiono
### Naprawiono
### Ustalenia
### Werdykt
### Archiwum (opcjonalnie)
```
**Nie duplikuj** całego handoff — dziennik to chronologia, handoff to „stan teraz”.

### 3. Zaktualizuj `03_AGENT_STATE_AND_TASKS.md`
- checkboxy roadmapy
- znane bugi
- data aktualizacji

### 4. Archiwum (tylko gdy sesja duża)
Jeśli sesja wymaga długiego audytu (jak perełki z gema-0):
- utwórz `docs/archive/sesja-NN/` z plikami szczegółowymi
- w dzienniku tylko link — **nie** powielaj w handoff

### 5. NIE rób
- Nie twórz nowego pliku `KONIEC_OKNA_X` za każdym razem ( chaos )
- Nie rozbudowuj README o kolejne linki — trzymaj mapę w `00_START_TUTAJ.md`
- Nie commituj bez prośby usera

---

## Start nowej sesji (agent)

Czytaj **tylko**:
1. `docs/00_START_TUTAJ.md`
2. `docs/HANDOFF_AKTUALNY.md`
3. `docs/03_AGENT_STATE_AND_TASKS.md`

Reszta — gdy zadanie tego wymaga lub user wskaże.

---

## Dla właściciela (człowiek)

W nowym czacie (folder `kebabkiller_studio`) wklej prompt z sekcji **Prompt** w `HANDOFF_AKTUALNY.md` — albo samo:

> Kontynuuj Kebabkiller Studio. Przeczytaj 00_START, HANDOFF_AKTUALNY, 03. Zacznij od Fazy 4.5.
