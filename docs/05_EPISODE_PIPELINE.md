# 05. Pipeline odcinka — wizja produktu

> ⚠️ **ARCHIWUM WIZJI** — treść wchłonięta do `docs/11_OPUS_ARCHITECTURE_PROPOSAL.md` (sekcja "Wizja produktu" + tabela mapowania F1–F4 → Fazy A–F). Ten plik pozostaje jako referencja historyczna — **nie jest źródłem prawdy**.

**Zatwierdzono:** 2026-06-09 (sesja planowania z właścicielem)  
**Status:** ~~wizja docelowa — implementacja w toku (F1 → F2 → F3)~~ → wchłonięta do docs/11 (2026-06-21)

> Skrót dla agenta: [01_PROJECT_VISION.md](01_PROJECT_VISION.md) · Limity silnika: [CAPABILITIES.md](CAPABILITIES.md) · Stan kodu: [HANDOFF_AKTUALNY.md](HANDOFF_AKTUALNY.md)

---

## Czym jest Kebabkiller Studio (docelowo)

Oprogramowanie do tworzenia **serialu viralowych odcinków** 9:16 (TikTok, YouTube Shorts, Reels, Facebook).  
Twórca wchodzi do panelu i — wspólnie z **Pomocnikiem / Scenarzystą** — planuje odcinek. Po **jednej akceptacji planu** system generuje **spójne klipy** gotowe do montażu na zewnątrz (DaVinci, CapCut itd.).

**Nie jest to:** generator jednej losowej sceny z jednego pola promptu.  
**Jest to:** plan odcinka → produkcja → paczka montażowa.

---

## Jedna zasada przepływu

```
Katalog główny (biblioteka zdjęć i opisów)
    ↓
Plan odcinka (Ty + Scenarzysta: wybór, preferencje, sceny, braki materiałów)
    ↓
[Akceptacja planu]  ← jedna bramka przed renderem
    ↓
Reżyser produkcji (automatycznie: technika + render)
    ↓
Klipy + manifest montażowy
    ↓
Recenzja (Ty + Scenarzysta) → ewentualna poprawka pojedynczej sceny w planie
```

---

## Trzy elementy systemu

| Element | Rola |
|---------|------|
| **1. Katalog główny** | Biblioteka: postacie, tła, rekwizyty, detale. Wiele zdjęć na asset. Tylko magazyn — tu nic się nie „produkuje”. |
| **2. Plan odcinka** | **Pierwszy ekran pracy.** Ty i Scenarzysta wybieracie z katalogu, wpisujecie preferencje, dzielicie na sceny, ustalacie co dostarczyć. |
| **3. Paczka produkcyjna** | Wynik: `E01_SC01.webm` … + `E01_manifest.json` + krótki README do montażu. |

**Projekt serialu** (scenografia całej serii) — warstwa opcjonalna na później (F4). MVP = Katalog + Plan odcinka.

---

## Plan odcinka — serce produktu

Po utworzeniu odcinka użytkownik od razu trafia na **Plan**, nie na render.

### Sekcje planu

| Sekcja | Zawartość |
|--------|-----------|
| **Pomysł odcinka** | Logline, ton, docelowy czas (~30–60 s, typowo 45 s) |
| **Wybór z katalogu** | Postać, lokacje, rekwizyty — **narzucone preferencje** na ten odcinek |
| **Preferencje (wspólny tekst)** | Co musi być widoczne, czego unikać, uwagi montażowe — edytowane z Scenarzystą |
| **Do dostarczenia** | Lista braków: czego nie ma w katalogu i co twórca ma wrzucić |
| **Sceny** | Tabela: 1 beat = 1 klip; opis PL; czas docelowy; przypisanie lokacji / zdjęcia z katalogu |

### Statusy planu

| Status | Znaczenie |
|--------|-----------|
| `szkic` | Pisanie ze Scenarzystą |
| `brakuje_materialow` | Są otwarte pozycje w „Do dostarczenia” |
| `gotowy_do_akceptacji` | Wszystkie sceny mają przypisane materiały |
| `zaakceptowany` | Można uruchomić produkcję |
| `w_produkcji` | Trwa render scen |
| `gotowy` | Paczka montażowa do pobrania |

Przycisk **„Akceptuj plan”** aktywny tylko gdy brak otwartych braków materiałów.

### Pętla: plan → braki → wrzucasz → plan

1. Scenarzysta analizuje plan i wypisuje, czego brakuje w katalogu.  
2. Twórca wrzuca JPG → trafia do katalogu → plan automatycznie podpina pod scenę.  
3. Pozycja znika z „Do dostarczenia”.  
4. Gdy lista pusta → gotowy do akceptacji.

**Katalog nie jest „wypełnij wszystko na start”** — to plan mówi, co wrzucić.

---

## Scenarzysta (Pomocnik)

### Zna

- [CAPABILITIES.md](CAPABILITIES.md) — limity silnika GPU
- zawartość katalogu przypisaną do odcinka
- zasady: 1 beat = 1 scena = 1 plik wideo

### Robi z twórcą

| Moment | Działanie |
|--------|-----------|
| **Pisanie planu** | Pomaga wybrać z katalogu, wpisać preferencje, podzielić odcinek na sceny, wskazać braki materiałów |
| **Po renderze** | Pomaga ocenić klipy, zaproponować poprawkę **jednej sceny** w planie |

### Nie robi

- Nie ustawia parametrów ComfyUI / node’ów
- Nie zastępuje akceptacji planu przez twórcę
- Nie renderuje samodzielnie

---

## Reżyser produkcji

**Uruchamiany automatycznie po akceptacji planu.** Twórca nie edytuje promptów GPU ręcznie (chyba że wraca do planu).

### Wejście

Zaakceptowany plan odcinka: sceny, czasy, wybór z katalogu, preferencje.

### Działanie (per scena)

| Z planu | Reżyser ustawia |
|---------|-----------------|
| Opis sceny PL | `positive_prompt` EN |
| Preferencje odcinka | wspólny styl, negative |
| Wybór z katalogu | `canon_en`, opcjonalne JPG jako klatka startowa |
| Czas sceny (np. 6 s) | `WAN_LENGTH` (np. 145 klatek @ 24 fps) |
| Lokacja / postać | ten sam profil wizualny co reszta odcinka |

### Profil wizualny odcinka (jeden na cały odcinek)

- Format: 9:16, 480×832, 24 fps  
- Kamera: **statyczna** (cały odcinek)  
- Jeden stos negative na odcinek  
- Spójne bloki tekstowe z katalogu  
- **Nie miesza** stylów między scenami  

### Relacja do obecnego `director.js`

Obecny `director.js` (pojedynczy prompt → jeden job) zostanie **zastąpiony / przebudowany** na Reżysera produkcji czytającego plan odcinka. Plik pozostaje do czasu migracji (złota zasada w handoff).

---

## Długość klipów

- **Jeden render GPU:** max **~10 s** (241 klatek @ 24 fps). Cały odcinek 45 s **nigdy** nie jest jednym plikiem.
- **Domyślnie w planie:** 3–5 s na scenę (sweet spot jakości).
- **Dłuższe sceny (5–9 s):** dozwolone dla spokojnych ujęć (stoi, lekki przechył).
- **Krótsze (2–4 s):** akcja (skok, upadek, szybki ruch).
- Czas per scena ustala **plan**; Reżyser mapuje na `WAN_LENGTH`.

Szczegóły: [CAPABILITIES.md](CAPABILITIES.md).

---

## Paczka montażowa

```
/export/E01/
  E01_SC01.webm
  E01_SC02.webm
  ...
  E01_manifest.json
  E01_README.txt
```

### `E01_manifest.json` (szkic)

- `episode`, `target_duration_sec`, `fps`, `resolution`
- `catalog_used` — co z katalogu
- `preferences` — tekst z planu
- `clips[]` — kolejność, `scene_pl`, `duration_sec`, `suggested_trim`, `location`, `notes`

Montaż zewnętrzny: import folderu, kolejność z manifestu, jeden format.

---

## Recenzja i poprawki

- Podgląd klipów w UI produkcji.
- Status per scena: `approved` / `needs_revision`.
- Poprawka = edycja **jednej sceny** w planie → re-render **tylko tego klipu** z tym samym profilem odcinka.
- Reszta odcinka bez zmian.

---

## UI docelowe (MVP)

```
[Katalog]  →  [Plan odcinka + Scenarzysta]  →  [Produkcja i eksport]
```

| Ekran | Funkcja |
|-------|---------|
| **Katalog** | Assety, galerie JPG, opisy PL + canon EN |
| **Plan odcinka** | Domyślny widok nowego odcinka; akceptacja |
| **Produkcja** | Postęp renderu, podgląd, pobranie paczki |

Dashboard: lista odcinków i statusy.

---

## Mapowanie problemów technicznych (stan 2026-06)

| Problem dziś | Rozwiązanie w wizji |
|--------------|---------------------|
| Multi-beat w jednym klipie | Plan dzieli na sceny; 1 beat = 1 plik |
| Levitacja / dziwny ruch | Profil I2V: static camera, 1 beat, denoise < 1, anchor „feet on surface” |
| Prompt diet wycinał scenografię | Przy planie: pełny tekst z katalogu + preferencje |
| Composite wymuszony | Katalog informuje plan; klatka startowa opcjonalna, wybór w planie |
| `$` za debug GPU | Mock do akceptacji planu; GPU tylko po `zaakceptowany` |
| Storyboard dekoracyjny | Tabela scen w planie = prawdziwa lista renderów |

---

## Fazy implementacji

| Faza | Zakres | Efekt |
|------|--------|-------|
| **F1** | Plan odcinka + Scenarzysta + katalog + „Do dostarczenia” | Praca na planie bez GPU |
| **F0** | Silnik klipu I2V (profil produkcji, denoise, długość per scena) | Jeden poprawny klip |
| **F2** | Reżyser produkcji: plan → kolejka renderu + manifest | Odcinek jako paczka |
| **F3** | Recenzja + re-render pojedynczej sceny | Pętla poprawek |
| **F4** | Projekt serialu (biblia serii, domyślne assety) | Opcjonalnie |

**Kolejność:** F1 (plan pierwszy) → F0 (silnik) → F2 (Reżyser pod plan) → F3.

---

## Definicja MVP (sukces)

1. Katalog: Kebabkiller + lokacje + zdjęcia.  
2. Ze Scenarzystą: plan odcinka ~45 s, wybór z katalogu, lista braków uzupełniona.  
3. Akceptacja planu **raz**.  
4. System renderuje spójne klipy + manifest.  
5. Montaż zewnętrzny bez walki z formatem.  
6. Jedna scena do poprawy → edycja planu → re-render tylko jej.

---

## Powiązane dokumenty

| Dokument | Po co |
|----------|-------|
| [01_PROJECT_VISION.md](01_PROJECT_VISION.md) | Skrót wizji |
| [CAPABILITIES.md](CAPABILITIES.md) | Limity silnika dla Scenarzysty |
| [02_ARCHITECTURE.md](02_ARCHITECTURE.md) | Warstwy techniczne (do aktualizacji przy F2) |
| [04_AI_DIRECTOR_KNOWLEDGE.md](04_AI_DIRECTOR_KNOWLEDGE.md) | Stan starego Reżysera (legacy do migracji) |
| [HANDOFF_AKTUALNY.md](HANDOFF_AKTUALNY.md) | Co robić teraz w kodzie |
