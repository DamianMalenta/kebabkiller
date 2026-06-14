# ⬇️ Jak złożyć i opublikować to w czystym repo `macius`

> Masz puste, czyste repo: **https://github.com/DamianMalenta/macius**.
> Tu masz prosty przepis, jak je wypełnić. Efekt końcowy:
>
> ```
> (repo macius)
> ├── macius/        ← ta infrastruktura (+ dołączona wizja)
> ├── kebabkiller/   ← Twoja kopia
> └── gema0/         ← Twoja kopia
> ```

---

## Krok po kroku (terminal w Cursorze: Terminal → New Terminal)

### 1. Sklonuj puste repo macius
```bash
git clone https://github.com/DamianMalenta/macius.git
cd macius
```

### 2. Pobierz folder `macius` (infrastrukturę) z gałęzi w repo kebabkiller
```bash
git remote add zrodlo https://github.com/DamianMalenta/kebabkiller.git
git fetch zrodlo cursor/macius-infra-6fb4
git checkout FETCH_HEAD -- macius
git remote remove zrodlo
```
> Teraz masz `macius/macius/` z całą dokumentacją, instrukcją i **dołączoną wizją** (`wizja-symbiont/`).

### 3. Wrzuć kopie projektów obok
Skopiuj do tego katalogu swoje foldery **`kebabkiller`** i **`gema0`**.

> ⚠️ Ważne: jeśli w skopiowanych folderach jest ukryty katalog **`.git`** — **usuń go** z obu kopii
> (`kebabkiller/.git` i `gema0/.git`). Inaczej Git potraktuje je jako osobne repozytoria i ich nie zapisze.

### 4. Zacommituj i wypchnij do repo `macius`
```bash
git add -A
git commit -m "init: workspace macius (infrastruktura + wizja + kopie zrodel)"
git branch -M main
git push -u origin main
```

Gotowe — Twoje czyste repo `macius` ma komplet. ✅

---

## 🟢 Wersja bez komend (ZIP)

1. Wejdź: `https://github.com/DamianMalenta/kebabkiller/tree/cursor/macius-infra-6fb4`
2. **Code → Download ZIP**, rozpakuj, znajdź w środku folder **`macius`**.
3. Sklonuj puste repo macius (lub pobierz je „Code → Open with GitHub Desktop").
4. Wklej do niego folder `macius`, dorzuć `kebabkiller/` i `gema0/` (usuń z nich ukryte `.git`).
5. W GitHub Desktop: napisz opis, **Commit to main**, potem **Push origin**.

---

## Nie chcesz commitować kopii kebabkiller/gema0?

Jeśli wolisz trzymać kopie tylko lokalnie (nie wrzucać do repo), utwórz plik `.gitignore`
w korzeniu repo macius z treścią:
```
/kebabkiller/
/gema0/
```
Wtedy w repo wyląduje sama infrastruktura `macius/`, a kopie zostaną na Twoim dysku do pracy.

---

## Co dalej

Otwórz `macius/INSTRUKCJA/00_INSTRUKCJA_GLOWNA.md` i rób Kroki 3→5 (audyt gema0 → decyzja → MVP).
