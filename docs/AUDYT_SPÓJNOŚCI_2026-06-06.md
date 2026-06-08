# Audyt spójności dokumentacji — 2026-06-06

**Cel:** Weryfikacja przed nowym oknem czatu #2.  
**Werdykt:** ✅ **Spójne po poprawkach** (patrz sekcja „Naprawiono”).

---

## Mapa warstw (źródło prawdy)

| Warstwa | Pliki | Kiedy czytać |
|---------|-------|--------------|
| Start | `00_START_TUTAJ.md` | Zawsze na początku sesji |
| Stan teraz | `HANDOFF_AKTUALNY.md` | Zawsze na początku sesji |
| Roadmapa | `03_AGENT_STATE_AND_TASKS.md` | Zawsze na początku sesji |
| Historia | `DZIENNIK_SESJI.md` | Gdy potrzeba kontekstu sesji 1…N |
| Protokół | `AGENT_PROTOCOL.md` | Przy `HANDOFF` |
| Głębia | `01`, `02`, `04`, `archive/` | Tylko gdy zadanie wymaga |
| Wejście repo | `README.md` | → wskazuje na `00_START` |

---

## Zgodność z kodem (MVP)

| Dokument mówi | Kod | Status |
|---------------|-----|--------|
| Groq + chain LLM | `director.js` PROVIDERS | ✅ |
| `node:sqlite` | `db/init.js` DatabaseSync | ✅ |
| `--use-system-ca` | `backend/package.json` scripts | ✅ |
| Edytuj/Usuń postacie | `Settings.jsx` + API | ✅ |
| Mock wideo | `mockEngine.js` | ✅ |
| negative_prompt → Groq | `director.js` buildUserPrompt | ❌ znany bug (Faza 4.5) |
| JPG → LLM | brak | ❌ znany gap (Faza 4.5/5) |
| PlanValidator | brak | ❌ planowane |

---

## Naprawiono w tym audycie

1. **`04_AI_DIRECTOR_KNOWLEDGE.md`** — usunięto przestarzały „stożek/meat cone”; dodano jak działa pamięć
2. **`02_ARCHITECTURE.md`** — aktualny stack (Groq, node:sqlite, SSL)
3. **`archive/sesja-01/06_PODSUMOWANIE.md`** — martwe linki do `docs/05_…` / `docs/06_…`
4. **`HANDOFF_AKTUALNY.md`** — prompt startowy zgodny z `00_START` (3 pliki)
5. **`AGENT_PROTOCOL.md`** — spójny prompt dla właściciela
6. **`03`** — link do kolejności czytania
7. **`.cursor/rules`** — `alwaysApply: true`, glob `**/*` (działa gdy root = kebabkiller_studio)

---

## Świadome rozbieżności (OK)

- **Archiwum sesji #1** opisuje stan sprzed reorganizacji docs — to zamrożona historia, nie handoff
- **HANDOFF** jest nadpisywany co sesję; **DZIENNIK** rośnie
- **01 wizja** celowo ogólna — nie duplikuje roadmapy z `03`

---

## Checklist przed oknem #2

- [x] Brak martwych linków do `05_KONIEC…` / `06_KONIEC…` w aktywnych docs
- [x] Jeden trigger: `HANDOFF`
- [x] Prompt startowy spójny w HANDOFF + AGENT_PROTOCOL + archive/06
- [x] Root Cursora = `kebabkiller_studio`

**Gotowe do nowego okna czatu.**
