# 🎬 Kebabkiller Studio V2 — Kompletna Instrukcja Obsługi

Witaj w nowym Kebabkiller Studio! Aplikacja przeszła transformację z "formularzowej" na **agentową**. Oznacza to, że zamiast wypełniać dziesiątki rubryk, **rozmawiasz z Reżyserem AI**, który w locie układa klocki, tworzy scenariusze i zarządza bazą danych.

Oto jak płynnie przejść przez cały proces bez przepalania budżetu.

---

## 🗺️ Mapa Drogowa (Wielki Obraz)
Proces tworzenia dzieli się na 4 proste etapy:
1. **Katalog** 📦 (Jednorazowe wgranie zdjęć / referencji).
2. **Seriale** 📺 (Założenie nowego tytułu).
3. **Reżyseria (Czat)** 💬 (Zdefiniowanie Kanonu i rozmowa o fabule odcinka).
4. **Produkcja GPU** 🚀 (Wysłanie gotowego planu do RunComfy).

---

## KROK 1: Katalog (Szafa z rekwizytami)
Zanim zaczniesz cokolwiek kręcić, aktorzy i scenografia muszą być na planie.

**Gdzie jesteśmy:** Zakładka `Katalog` w górnym lub dolnym menu.

### Jak wypełniać assety?
*   **Typ:** Wybierz `Postać` (np. Kebabkiller) lub `Lokacja` (np. Piec_Brick).
*   **Nazwa:** Krótka i jasna, bez spacji (np. `Kebabkiller_Hero`).
*   **Opis (dla AI):** Napisz po polsku, co to jest. **(Bardzo ważne!)** Z tego opisu AI korzysta, żeby zrozumieć scenę. 
    *   *Przykład:* "Okrągły kebab w kształcie walca, małe zgrabne nóżki, chrupiąca tortilla."
*   **Kanon (angielski prompt):** To trafi bezpośrednio do GPU. Opisz wygląd w języku diffusion. 
    *   *Przykład:* "Anthropomorphic kebab wrap, tiny legs, grilled tortilla, realistic food photography, high detail."
*   **Zdjęcie (KRYTYCZNE):** Bez dodania JPG/PNG do assetu, GPU wygeneruje losowy szum. System Kebabkiller Studio korzysta z technologii IP-Adapter, która **wymaga** zdjęcia referencyjnego.

> 💡 **Tip:** Pamiętaj, aby po wgraniu kliknąć na zdjęciu "Oznacz jako Primary" (jeśli jest ich więcej).

---

## KROK 2: Seriale (Rejestracja Projektu)
**Gdzie jesteśmy:** Zakładka `Seriale`.

Tutaj zakładasz główny folder dla swojego sezonu. 
1. Kliknij **+ Nowy**.
2. **Nazwa:** Np. `Kebabkiller: Przebudzenie`.
3. **Opis (krótki):** Np. `Mroczna historia walczącego kebaba.`
4. Kliknij **Zapisz**.

Po zapisaniu pojawi się duży, żółty przycisk: **🎬 Otwórz Stół Reżyserski**. Kliknij go!

---

## KROK 3: Stół Reżyserski (Serce Systemu)
**Gdzie jesteśmy:** Zakładka `Reżyseria`.

Ekran dzieli się na dwie części:
*   **Lewa (Mózg Serialu):** Tu widzisz na żywo to, co AI wie o Twoim projekcie (Styl, Tagi, Galeria Kanonu, Storyboard).
*   **Prawa (Czat z Reżyserem):** Tu wydajesz polecenia.

### Faza A: Definiowanie Kanonu (Klimatu)
Gdy wejdziesz tu po raz pierwszy, projekt jest "pusty". W polu czatu wpisz:
> 🗣️ *"Ustal klimat na mroczny, kinowy, dużo dymu i neonów. Dodaj tagi [Cyberpunk], [Mrocznie]. Wrzuć do Kanonu postać Kebabkiller oraz lokację Piec_Brick."*

**Co się stanie?**
AI zaktualizuje lewy panel. Zobaczysz tam zapisany styl, tagi i wybrane zdjęcia. Zrozumie, że w tym serialu zawsze używamy tego konkretnego kebaba i tego pieca.

> 🗣️ *"Zatwierdzam kanon."* (Koniec Fazy A).

### Faza B: Tworzenie Odcinka
Teraz robimy konkretny odcinek (np. E01). Wpisz w czacie:
> 🗣️ *"Zróbmy nowy odcinek. Kebabkiller budzi się w piecu, wyskakuje na blat i walczy z klasycznym kebabem."*

**Co się stanie?**
AI utworzy w bazie Odcinek. 

Teraz poproś o rozbicie na ujęcia:
> 🗣️ *"Rozbij ten pomysł na 3 krótkie sceny po 4 sekundy. Kamera w scenie 1 ma zjeżdżać z góry."*

**Magia Generative UI:** Zamiast ściany tekstu, w czacie pojawią się **Karty Scen** (widgety). Zobaczysz na nich miniaturki zdjęć pobrane z Twojego Katalogu!

### Faza C: Poprawki i Mockowanie (Oszczędzanie pieniędzy)
Jeśli coś Ci nie pasuje na Kartach Scen, po prostu napisz:
> 🗣️ *"W scenie 2 zmień lokację na Ulicę. Kamera niech będzie statyczna."*

Gdy sceny są ułożone, poproś o testowy storyboard:
> 🗣️ *"Wygeneruj storyboard."*

AI wygeneruje poglądowy kolaż (Mock), żebyś upewnił się, czy assety dobrze się spięły.

### Wątki Poboczne (Pytania o pomoc)
Nie wiesz czegoś? Zapytaj ze znakiem zapytania:
> 🗣️ *"Co to znaczy denoise i czy wpłynie na wygląd sceny?"*

AI utworzy w czacie **Niebieski Kafelek (Wątek poboczny)**. Główny projekt nie zostanie zaśmiecony tą rozmową. Kliknij w kafelek, jeśli chcesz kontynuować ten luźny temat.

---

## KROK 4: Zakończenie i Produkcja GPU
Gdy Karty Scen w czacie wyglądają dokładnie tak, jak chciałeś:

> 🗣️ *"Zaakceptuj plan odcinka i pokaż podgląd workflow GPU."*

AI zablokuje odcinek przed dalszą edycją i pokaże zielony widget **Podgląd workflow GPU** z listą zasad, które wynegocjowaliście (jakie fps, jaki denoise).

Następnie powiedz:
> 🗣️ *"Zrób z tego film!"* albo *"Produkuj."*

System spakuje ten czysty, wynegocjowany JSON i bezbłędnie wyśle go do RunComfy. Kasa z konta zejdzie dopiero w tym momencie, na wysoce dopracowany i zweryfikowany plan!

---

## 🛑 CHECKLISTA KRYTYCZNA (Zanim powiesz "Produkuj")
- [ ] Czy `Katalog` ma wgrane fizyczne pliki `.jpg` / `.png` dla użytych postaci/teł?
- [ ] Czy na Kartach Scen (w czacie) widzisz miniaturki zdjęć (Assetów)? (Jeśli widzisz szare pola, AI nie przypięło JPG!).
- [ ] Czy portfel RunComfy jest doładowany?
- [ ] Czy akceptowałeś zmiany w czacie? (Niektóre groźne akcje wysuwają pomarańczową kartę "Tak, akceptuję / Nie").
