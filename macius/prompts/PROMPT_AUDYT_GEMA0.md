# Prompt — twardy audyt gema0 (Etap 0)

Warunek: `gema0/` jest już w workspace. Skopiuj do nowego okna:

```text
Pracujemy w workspace MACIUS. Zadanie: TWARDY AUDYT katalogu gema0/. TRYB: tylko analiza, ZERO kodu, READ-ONLY.

Przeczytaj najpierw: macius/AGENTS.md, macius/docs/00_START_TUTAJ.md, macius/docs/01_MISJA.md,
macius/docs/04_AUDYT_GEMA0.md, macius/templates/AUDYT_TEMPLATE.md.

Wykonaj audyt gema0/ wg metodyki z 04_AUDYT_GEMA0.md — FAKTY z kodu, cytuj ścieżki (gema0/...):
1. Inwentaryzacja (stack, wejścia, zależności, rozmiar, jak uruchomić).
2. Architektura + jakość + dług (cykle, warstwy, duplikacja, martwy kod, TODO/FIXME, testy).
3. Bezpieczeństwo + koszty (sekrety, podatności, niebezpieczne wzorce, płatne API/LLM/GPU).
4. Mapowanie na marzenie W1–W7 (czego gema0 już dostarcza, gdzie luki).
5. Werdykt per komponent: ♻️ REUŻYJ / 🔧 REFAKTOR / 🧪 ZBADAJ / 🗑️ ODRZUĆ (z uzasadnieniem).
6. Top 5 ryzyk + top 5 perełek do reużycia.
7. Rekomendacja wejścia w fuzję.

Użyj darmowych narzędzi (ripgrep, cloc/tokei, lintery, gitleaks, npm audit/pip-audit, madge/depcheck) — bez płatnych usług.
NIE modyfikuj gema0/. Wynik zapisz do: macius/audyty/AUDYT_GEMA0_<dzisiejsza-data>.md wg szablonu.
Najpierw pokaż mi plan audytu (jakie komendy/sekcje) i poczekaj na "OK".
```
