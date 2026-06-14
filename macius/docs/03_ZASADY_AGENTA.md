# 03. Zasady pracy agenta (tryby, anty-halucynacja, bezpieczeństwo, git)

Pełny kontrakt. Skrót jest w [`../AGENTS.md`](../AGENTS.md) i [00_START_TUTAJ.md](00_START_TUTAJ.md).

---

## 1. Tryby pracy (anty-halucynacja)

1. **Domyślnie PLAN, nie Agent.** Agent pisze kod dopiero po wyraźnym „OK, rób" właściciela.
2. **Plan Mode** = architektura, decyzje, warianty, ryzyka. **Zero edycji plików** (poza notatkami w `macius/`).
3. Przed każdą zmianą: **przeczytaj pliki**, nie zgaduj — **cytuj ścieżki** z repo.
4. „Zacznij od pierwszego punktu w handoff" to **backlog**, nie rozkaz implementacji — najpierw plan + pytanie o OK.

## 2. Anty-halucynacja (twarda)

- Każde stwierdzenie o gema0/Kebabkillerze popieraj **cytatem ścieżki/pliku** (np. `gema0/src/x.js`).
- Nie wymyślaj API, zależności, wersji. Jeśli nie wiesz — sprawdź plik lub powiedz „nie ustalono".
- Audyt = **fakty z kodu** (lintery, AST, grep), nie wrażenia.

## 3. Bezpieczeństwo zmian (gdy już piszemy kod produktu)

> Marzenie W3/W4: bezpiecznie na docelowych serwerach.

1. **Izolacja** — praca w osobnej gałędzi/worktree, nigdy w main/prod.
2. **Diff-only** + allowlista plików; brak edycji poza zakresem.
3. **Bramka polityk** — blokada `rm -rf`, `git push --force`, edycji sekretów, migracji bez rollbacku.
4. **Weryfikacja** — lint/testy/typy przed akceptacją.
5. **PR, nie auto-merge.** Agent nigdy nie zatwierdza własnej pracy.
6. **Rollback** — każda zmiana = 1 odwracalny commit; deploy etapowy.
7. **Audit log** — co agent zrobił.

(Rozwinięte w lejku Symbiont: `../../projekt-symbiont/docs/05_BEZPIECZENSTWO.md`.)

## 4. gema0 — read-only

- **Nie modyfikuj `gema0/`.** To wierne źródło do audytu (i zasada repo „nie dotykaj gema-0").
- Wszystkie wnioski, poprawki, propozycje → `macius/`.

## 5. Git

- Osobna gałąź per temat; osobny PR; czytelne, atomowe commity (jeden logiczny zysk = jeden commit).
- Nie mieszaj w jednym PR zmian z różnych światów (gema0-analiza vs. kod macius vs. kebabkiller).
- Bez force-push i amendów bez wyraźnej zgody.

## 6. Dokumentowanie wyników

| Wynik | Szablon | Lokalizacja |
|-------|---------|-------------|
| Audyt | `templates/AUDYT_TEMPLATE.md` | `audyty/` |
| Decyzja | `templates/ADR_TEMPLATE.md` | `decyzje/` |
| Propozycja architektury/fuzji | `templates/PROPOZYCJA_TEMPLATE.md` | `docs/` lub `decyzje/` |
| Zadanie | `templates/ZADANIE_TEMPLATE.md` | gdzie pasuje |

## 7. Definition of Done (dla zadania w macius)

- [ ] Wynik oparty o fakty (cytaty ścieżek), nie zgadywanie.
- [ ] Zapisany w odpowiednim miejscu wg szablonu.
- [ ] `HANDOFF_AKTUALNY.md` zaktualizowany, wpis w `DZIENNIK_SESJI.md`.
- [ ] Jeśli kod: gałąź + PR + zielone testy; produkcja nietknięta.
- [ ] `gema0/` nietknięty.
