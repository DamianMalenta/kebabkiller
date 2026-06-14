# 04. Twardy audyt gema0 — metodyka + checklist

**Cel:** zamienić prototyp gema0 w **fakty**: co działa, co jest wartościowe, co jest długiem, co
odrzucić. To **fundament** decyzji o fuzji (bez audytu fuzja = zgadywanie).

**Zasada:** audyt = **fakty z kodu**, nie wrażenia. Wynik → `audyty/`.

> **Audyt to faza obserwacji** — robimy „fotografię" stanu gema0 *zanim* zaczniemy ciąć. Sam `gema0/`
> to lokalna kopia i **wolno go potem dowolnie przerabiać/wycinać** (oryginał w repo jest bezpieczny).
> Audyt robimy najpierw tylko po to, żeby świadomie wiedzieć, co reużyć, a co wyrzucić.

---

## 0. Przygotowanie

- Potwierdź, że `gema0/` jest w workspace (jeśli nie — poproś właściciela o wrzucenie).
- Ustal narzędzia (wszystkie darmowe): `ripgrep`, `cloc`/`tokei`, lintery stacku, `gitleaks`,
  `npm audit`/`pip-audit`, `madge`/`depcheck` (jeśli JS), tree-sitter/AST.

## 1. Inwentaryzacja (co to w ogóle jest)

| Pytanie | Jak ustalić (fakt) |
|---------|--------------------|
| Stack i języki | pliki manifestu (`package.json`, `pyproject.toml`, …), `cloc`/`tokei` |
| Struktura | drzewo katalogów; punkty wejścia (`main`, `index`, serwery) |
| Zależności | manifesty + lockfile; ile, jak świeże, czy porzucone |
| Rozmiar/zakres | LOC per moduł, liczba plików, największe pliki |
| Jak się uruchamia | skrypty `dev/build/start`, README gema0, zmienne env |

## 2. Architektura i jakość

| Obszar | Sygnały do zebrania |
|--------|---------------------|
| Granice modułów | cykle importów (`madge`), sprzężenia, „god files" |
| Warstwy | gdzie logika, gdzie I/O, gdzie UI; czy są pomieszane |
| Wzorce | powtarzalne rozwiązania, abstrakcje, „perełki" do reużycia |
| Dług techniczny | duplikacja, martwy kod (`depcheck`), TODO/FIXME (`rg "TODO|FIXME|HACK"`) |
| Testy | czy są, pokrycie, czy przechodzą |
| Stabilność | znane bugi, miejsca kruche, magiczne stałe |

## 3. Bezpieczeństwo i koszty

| Obszar | Jak |
|--------|-----|
| Sekrety w repo | `gitleaks detect` |
| Podatności zależności | `npm audit` / `pip-audit` / `trivy` |
| Niebezpieczne wzorce | `semgrep` (eval, shell injection, brak walidacji) |
| Koszty runtime | czy woła płatne API/LLM/GPU; gdzie i jak często |

## 4. Dopasowanie do marzenia (mapowanie na W1–W7)

Dla każdego wymagania z [01_MISJA.md](01_MISJA.md) oceń, co gema0 **już daje**, a czego brakuje:

| Wymaganie | gema0 ma? | Dowód (ścieżka) | Luka |
|-----------|-----------|-----------------|------|
| W1 własny agent | ? | | |
| W2 audyt plików | ? | | |
| W3 bezpieczne zmiany | ? | | |
| W4 prod | ? | | |
| W5 dostęp zewsząd | ? | | |
| W6 niski koszt | ? | | |
| W7 moduł+tożsamość | ? | | |

## 5. Werdykt per komponent (najważniejsze)

Każdy istotny moduł gema0 dostaje **jedną z 4 ocen**:

| Ocena | Znaczenie | Co dalej |
|-------|-----------|----------|
| ♻️ **REUŻYJ** | wartościowe, pasuje do produktu docelowego | przenieś/zaadaptuj do macius |
| 🔧 **REFAKTOR** | dobry pomysł, słaba realizacja | przepisz wg zasad macius |
| 🧪 **ZBADAJ** | niejasne / ryzykowne | osobny spike przed decyzją |
| 🗑️ **ODRZUĆ** | dług / nieaktualne / poza celem | nie przenoś |

## 6. Wynik audytu (deliverable)

Zapisz raport w `macius/audyty/AUDYT_GEMA0_<RRRR-MM-DD>.md` wg
[`../templates/AUDYT_TEMPLATE.md`](../templates/AUDYT_TEMPLATE.md). Raport MUSI zawierać:

1. Podsumowanie wykonawcze (5–10 zdań: czym jest gema0, stan, główne wnioski).
2. Inwentaryzacja (sekcja 1).
3. Architektura + jakość + dług (sekcje 2–3) z **cytatami ścieżek**.
4. Mapowanie na W1–W7 (sekcja 4).
5. Werdykt per komponent (sekcja 5) — tabela.
6. Top 5 ryzyk + top 5 „perełek" do reużycia.
7. Rekomendacja wejścia w fuzję (→ [06_ROADMAPA_FUZJI.md](06_ROADMAPA_FUZJI.md)).

> Prompt gotowy do odpalenia: [`../prompts/PROMPT_AUDYT_GEMA0.md`](../prompts/PROMPT_AUDYT_GEMA0.md).
