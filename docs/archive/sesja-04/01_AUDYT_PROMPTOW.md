# Raport: Audyt Infrastruktury Promptów (Zero-Hallucination)

**Data:** 2026-06-06  
**Cel:** Głęboki, bezwzględny skan kodu pod kątem ukrytych promptów, sprzeczności i ryzyka "visual drift" (Wan 2.1).

---

## 1. KOMPLETNA MAPA PROMPTÓW

### `backend/src/ai/director.js`
*   **`SYSTEM_PROMPT_INTENT_ENGINE`** (linie 12-30):
    *   **Treść/Zasady:** Wymusza rolę "zero-hallucination intent extraction engine". Zabrania wymyślania wyglądu postaci i tła. Zakazuje zwrotów "blurred background" czy "bokeh" (wymusza sharp focus). Wymusza na sztywno format JSON.
    *   **Polecenie:** `"action_prompt": "string (Detailed cinematic description of ONLY the action, lighting, and camera style)"`
*   **`buildIntentPrompt`** (linie 32-35):
    *   Pobiera aktywne reguły z bazy (Księgi Praw) i dokleja je do prompta jako `KNOWLEDGE BASE - RULES`. Dokleja treść wpisaną przez usera jako `USER SCENE (Polish)`.
*   **`executeAssetBinding`** (linie 71-104):
    *   Buduje ostateczny (hardkodowany) `positive_prompt` sklejając:
        *   `identity_block_en` (z bazy, zdefiniowane przez użytkownika)
        *   opis tła
        *   wyciągnięty przez LLM `actionStr` (po przepuszczeniu przez RegEx z synonimami bluru)
        *   Sztywne modyfikatory (z obiektu `PIPELINE_CONFIG`): `'Vertical 9:16 cinematic video, 1080x1920'` oraz `'highly detailed, sharp focus, smooth motion, native frame rate'`.
    *   Buduje `negative_prompt` sklejając:
        *   `char.negative_prompt` z bazy
        *   Sztywny bazowy negat: `'blurry, low quality, watermark, text overlay, deformed background, melting texture, bokeh, depth of field'`.

### `backend/src/db/init.js`
*   **Domyślna postać Kebabkiller** (linie 47-51):
    *   **`negative_prompt`**: `'human arms, hands, fingers, humanoid torso, face, melting, morphing, extra limbs'`
    *   **`identity_block_en`**: `'Anthropomorphic kebab cone with tiny legs. Grilled meat texture. No human arms, no human face.'`
*   **Księga Praw (rules)** (linie 68-73):
    *   Zaszyte na twardo reguły wpajane LLM: Format 9:16, zakaz anatomii człowieka, zakaz zmiany (dryfu) tła, wymuszenie stosowania negative prompt (paradoks, bo LLM już sam nie układa negatywnego prompta).

---

## 2. KRYTYCZNE SPRZECZNOŚCI (Niespójności)

*   **SPRZECZNOŚĆ 1: KEBAB CONE vs DÜRÜM.**
    *   W `docs/04_AI_DIRECTOR_KNOWLEDGE.md` oraz w poprzednich sesjach wyraźnie ustaliliśmy przejście na tożsamość "dürüm / tortilla wrap" oraz ucieczkę od określenia "cone-shaped kebab". W `director.js` faktycznie usunięto wzmianki o "meat cone".
    *   **BŁĄD W KODZIE:** Plik `backend/src/db/init.js` nadal inicjalizuje bazę z wpisem: `'Anthropomorphic kebab cone with tiny legs...'`! Przy czystym starcie bazy LLM wciąż dostaje sprzeczne z naszymi ustaleniami polecenie o "stożku".
*   **SPRZECZNOŚĆ 2: MARTWA REGUŁA O NEGATYWNYM PROMPCIE.**
    *   W `backend/src/db/init.js` jest reguła podawana do LLM (priorytet 70): *„Zawsze stosuj negative prompt blokujący halucynacje ludzkiej anatomii.”*
    *   To bez sensu, ponieważ według nowej architektury LLM nie składa już i nie zwraca klucza `negative_prompt`. Reguła marnuje tokeny i może mylić "Silnik Intencji".

---

## 3. OCENA RYZYKA DLA WAN 2.1 (Visual Drift)

*   **RYZYKO 1: ZACHĘCANIE DO SŁOWA "CINEMATIC".**
    *   W `SYSTEM_PROMPT_INTENT_ENGINE` każemy modelowi ułożyć akcję tak: `"action_prompt": "string (Detailed cinematic description of ONLY the action, lighting, and camera style)"`.
    *   Modele wideo, słysząc **"cinematic"**, często automatycznie wymuszają w generowanym klipie efekt *shallow depth of field* i *bokeh*, nawet jeśli wymusimy RegEx usuwający "blur". Użycie słowa "cinematic" stanowi zaproszenie do niepożądanego formatowania kadru.
*   **RYZYKO 2: UKRYTE RYZYKO GŁĘBI W TLE.**
    *   W `backend/src/db/init.js`, domyślne tło "Piec_Brick" ma opis: `...blat roboczy na pierwszym planie.` Wyraźny podział na pierwszy i drugi plan wymusza na modelu 3D i modelach dyfuzyjnych rozmycie tła. Należy unikać słowa "pierwszy plan" (foreground), chyba że na pewno chcemy odseparować go głębią ostrości od pieca.
*   **ZABEZPIECZENIA DZIAŁAJĄCE:**
    *   RegEx `blurSynonymsRegex` twardo nadpisuje popularne słowa kluczowe (bokeh, blurry background, defocused) i wymienia je na `sharp focus`. To dobre zabezpieczenie typu fallback.
