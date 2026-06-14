# 05. Bezpieczeństwo — edycja kodu na docelowych serwerach (bez psucia prod)

**Cel (W3, W4):** „bezpiecznie tworzyć i naprawiać oprogramowanie, które stoi już na docelowych
serwerach". Zasada nadrzędna: **agent nigdy nie edytuje żywej produkcji wprost.** Zmiana idzie torem,
który jest **odwracalny** na każdym kroku.

Grounding: praktyki 2026 z [02_BADANIE_ROZWIAZAN.md](02_BADANIE_ROZWIAZAN.md) sekcja E.

---

## Złota zasada

> Jeśli błąd jest „o jeden `git checkout` od cofnięcia" — agent może działać.
> Jeśli **nie jest** odwracalny — **bramka i człowiek**.

Produkcja dostaje **wyłącznie** zmiany już zweryfikowane (CI + PR), wdrażane przez normalny pipeline,
z gotowym rollbackiem.

---

## 7 warstw obrony (defense in depth)

| # | Warstwa | Co robi |
|---|---------|---------|
| 1 | **Izolacja workspace** | Każdy run w osobnym **git worktree** (osobna gałąź + katalog). Nigdy w main/prod checkout. |
| 2 | **Mały blast radius** | Brak sekretów prod w env agenta; filesystem ograniczony do root + ścieżka względna; jeden commiter. |
| 3 | **Diff-only** | Agent zwraca **unified diff**, nie surowe pliki. Allowlista plików (tylko z `audit_scopes`/planu). Limit liczby zmian. |
| 4 | **Bramka polityk (PreToolUse)** | Blokada `rm -rf`, `git push --force`, edycji `forbidden_paths`, migracji bez rollbacku, edycji testów bez zgody. |
| 5 | **Weryfikacja (CI)** | Lint + testy + typy na każdym patchu **przed** akceptacją. Czerwone CI = brak merge. |
| 6 | **Wdrożenie + rollback** | Każda zmiana = 1 odwracalny commit/PR; deploy etapami (canary); auto-rollback z metryk. |
| 7 | **Audit log** | Każda akcja agenta zapisana (kto/co/kiedy/diff). Przeglądalne rano „co zrobił". |

---

## Trzy poziomy uprawnień (per host, w manifeście tożsamości)

| Poziom | Co wolno | Kiedy |
|--------|----------|-------|
| **R — Read-only audyt** | Czyta pliki/DB/logi, robi raporty. Zero zapisu. | **MVP**, prod, zawsze bezpieczny |
| **P — Propose (PR)** | Tworzy gałąź + diff + PR. Nie merguje. | Standard pracy nad kodem |
| **D — Deploy** | Wyzwala deploy zaakceptowanego PR + rollback. | Tylko jawnie włączone; nigdy auto-merge własnej pracy |

**Nigdy:** agent nie zatwierdza własnego PR ani nie merguje do gałęzi domyślnej. (`capabilities.deploy`
domyślnie `false`.)

---

## Produkcja konkretnie (W4)

- **Na prod agent tylko czyta** (audyt R) — przez read-only dostęp / kopię / MCP z zakresem read.
- **Naprawa** powstaje na repo (worktree/PR), **nie na serwerze**. Serwer aktualizuje się dopiero
  po akceptacji, przez Twój istniejący deploy.
- **Sekrety prod**: nigdy w środowisku agenta. Agent dostaje dane tylko przez zakresy MCP, bez `.env`.
- **Rollback**: deploy etapowy + szybki revert; przy ryzykownych zmianach (auth, migracje, billing) —
  twardsza bramka i człowiek.

---

## Checklista bezpieczeństwa (Definition of Safe)

- [ ] Run w izolowanym worktree, nie w main.
- [ ] Brak sekretów prod w env agenta.
- [ ] Diff-only + allowlista plików respektuje `forbidden_paths`.
- [ ] PreToolUse blokuje destrukcyjne komendy.
- [ ] CI zielone przed akceptacją.
- [ ] PR, nie bezpośredni merge; brak auto-merge własnej pracy.
- [ ] Deploy odwracalny (rollback gotowy).
- [ ] Wpis w audit logu.
