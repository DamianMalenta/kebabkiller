# Księga możliwości silnika — Kebabkiller Studio

**Wersja:** 1.0 (2026-06-09)  
**Dla:** Scenarzysta, Reżyser produkcji, twórca  
**Źródło techniczne:** `backend/src/video/wanConfig.js`, `wan_workflow_api.json`, Wan 2.1 I2V 480p

> Wizja produktu: [05_EPISODE_PIPELINE.md](05_EPISODE_PIPELINE.md)

---

## Format wyjścia (stały)

| Parametr | Wartość |
|----------|---------|
| Proporcje | 9:16 |
| Rozdzielczość | 480 × 832 px |
| FPS | 24 |
| Kontener | WEBM (VP9), node 52 w workflow |

Ten sam format dla **wszystkich** klipów w odcinku — ułatwia montaż.

---

## Jeden klip GPU — limity

| Parametr | Min | Domyślnie (smoke) | Max | Czas @ 24 fps |
|----------|-----|-------------------|-----|----------------|
| `WAN_LENGTH` (klatki) | 17 | 33 | **241** | ~0,7 s – **~10 s** |

- **Cały odcinek (np. 45 s) = wiele klipów**, nigdy jeden render.
- Długość **per scena** ustala plan odcinka; Reżyser mapuje sekundy → klatki.

### Zalecany czas sceny w planie

| Typ sceny | Czas | Klatki (orient.) |
|-----------|------|------------------|
| Akcja (skok, upadek) | 2–4 s | 49–97 |
| Standard | 3–5 s | 73–121 |
| Spokojna (stoi, napięcie) | 5–8 s | 121–193 |
| Absolutne max | ~10 s | 241 |

---

## Zasady planowania scen (obowiązkowe)

1. **1 beat = 1 scena = 1 plik wideo.**  
2. **Kamera statyczna** w całym odcinku (v1). Ruch kamery = montaż zewnętrzny.  
3. **Nie łączyć** w jednej scenie: siedzenie → skok → cień → oddalanie kamery.  
4. **Spójność:** ten sam bohater i ten sam profil wizualny w całym odcinku.  
5. **Materiały:** scena bez przypisanego assetu / zdjęcia z katalogu → plan nie do akceptacji.

---

## Katalog a generacja

- Zdjęcia z katalogu **nie muszą** być automatycznie sklejane (composite).  
- Plan wskazuje, **które** zdjęcie lub opis z katalogu obowiązuje w scenie.  
- Reżyser dobiera sposób użycia **jednolicie** w ramach odcinka (profil wizualny).  
- Brak zdjęcia w katalogu → pozycja w „Do dostarczenia” w planie.

---

## Koszt i dev

| Tryb | Kiedy |
|------|-------|
| `VIDEO_ENGINE=mock` | Pisanie planu, walidacja, dev — **0 USD GPU** |
| `VIDEO_ENGINE=runcomfy` | Po akceptacji planu, render zatwierdzonych scen |

Render partiami (kolejka scen), nie „strzelaj w ciemno”.

---

## Czego silnik NIE umie (v1)

| Niemożliwe | Alternatywa |
|------------|-------------|
| Jeden plik 45 s | 8–18 klipów w planie |
| Płynny dolly / zoom w I2V | Montaż zewnętrzny |
| Wiele beatów w jednym klipie bez artefaktów | Podział na sceny w planie |
| Gwarancja bez lewitacji przy złym planie | Plan: stopy na powierzchni, 1 beat, statyczna kamera |

---

## Odcinek 45 s — przykłady podziału

**Wariant A — mniej plików:** 8 scen × ~5,5 s  
**Wariant B — więcej kontroli:** 15 scen × ~3 s  

Scenarzysta pomaga dobrać wariant przy pisaniu planu.

---

## Aktualizacje

Przy zmianie `wanConfig.js`, modelu Wan lub workflow — podnieś wersję tego dokumentu i powiadom Scenarzystę (system prompt).
