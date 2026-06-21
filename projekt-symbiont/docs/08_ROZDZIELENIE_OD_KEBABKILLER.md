# 08. Rozdzielenie od Kebabkiller Studio — jak NIE pomieszać pracy

**Cel (wyraźna prośba właściciela):** „stwórz osobny lejek do tego projektu, ustal jak to dobrze
rozdzielić, żeby nie pomieszać pracy nad Kebabkiller Studio a tym moim pomysłem."

Ten plik jest **kontraktem rozdzielenia**. Trzymamy się go w każdej sesji.

---

## Dwa osobne lejki (jedno repo, dwa światy)

| | Kebabkiller Studio | Projekt Symbiont |
|---|---|---|
| **Czym jest** | Produkt: wideo 9:16 z postacią Kebabkiller | Produkt: agent-moduł do dowolnego oprogramowania |
| **Lejek docs** | `docs/` | `projekt-symbiont/docs/` |
| **Start** | `docs/00_START_TUTAJ.md` | `projekt-symbiont/docs/00_START_TUTAJ.md` |
| **Handoff** | `docs/HANDOFF_AKTUALNY.md` | `projekt-symbiont/docs/HANDOFF_AKTUALNY.md` |
| **Dziennik** | `docs/DZIENNIK_SESJI.md` | `projekt-symbiont/docs/DZIENNIK_SESJI.md` |
| **Kod** | `backend/`, `frontend/` | (przyszłość) `symbiont/` — osobny katalog, NIE w backend/frontend |
| **Cursor rule** | `.cursor/rules/kebabkiller-docs.mdc` | `.cursor/rules/symbiont-docs.mdc` (scoped na `projekt-symbiont/**`) |
| **Gałęzie git** | `cursor/<temat>-...` (kebab) | `cursor/symbiont-<temat>-...` (prefiks `symbiont-`) |

**Relacja:** Kebabkiller jest **pierwszym hostem (pilotem/wzorem)** dla Symbionta. To jedyne ich
powiązanie. Pracując nad Symbiontem **nie przebudowujemy** Kebabkillera — najwyżej instalujemy w nim moduł.

---

## 7 zasad, żeby nie pomieszać

1. **Wiedza Symbionta tylko w `projekt-symbiont/`.** Nigdy nie dopisuj planów Symbionta do `docs/`.
2. **Wiedza Kebabkillera tylko w `docs/`.** Nie kopiuj tu jego roadmap/handoffów.
3. **Osobne handoffy i dzienniki.** `HANDOFF` dla Symbionta aktualizuje TYLKO pliki w `projekt-symbiont/`.
4. **Osobne gałęzie i PR.** Praca nad Symbiontem → gałąź z prefiksem `cursor/symbiont-...`, osobny PR.
   Nie mieszaj zmian Symbionta i Kebabkillera w jednym commicie/PR.
5. **Kod Symbionta poza `backend/`/`frontend/`.** Gdy ruszy implementacja → osobny top-level katalog
   `symbiont/` (lub osobne repo). Nie wstrzykuj go w kod Kebabkillera.
6. **Zakazy Kebabkillera obowiązują, gdy jest hostem.** Instalując Symbionta w Kebabkillerze: nie
   dotykaj `gema-0`, nie usuwaj `director.js`/`mockEngine.js`/`runComfyEngine.js`, nie ruszaj `.env`.
   (Trafią do `forbidden_paths` w jego tożsamości — patrz `06`.)
7. **Jeden wskaźnik, zero mieszania treści.** W mapie Kebabkillera (`docs/00_START_TUTAJ.md`) jest
   **jeden link** do tego lejka — i tyle. Treści się nie przenikają.

---

## Czym Symbiont różni się od odrzuconego „Programisty /dev" w Kebabkillerze

W lejku Kebabkillera (`docs/07_DEV_AGENT_PLAN.md`, `docs/HANDOFF_AKTUALNY.md`) kierunek **„Programista
/dev na Cursor Cloud Agents" został ODRZUCONY**. Symbiont **nie wskrzesza** tamtego — jest inny:

| | Odrzucony „Programista /dev" | Symbiont |
|---|---|---|
| Silnik | Cursor Cloud Agents (zewn. usługa, klucz) | **Własny, samohostowany** open-source |
| Koszt | zależny od Cursor | **~0 zł** (free tiery + Ollama) |
| Zasięg | tylko Kebabkiller | **dowolne oprogramowanie** (moduł + tożsamość) |
| Audyt | brak osobnego | **darmowy mistrz audytów** (czysty kod) |
| Własność | nie „własny agent" | **w pełni Twój**, wpięty w rdzeń hosta |

Symbiont realizuje to, czego tamten plan nie dał: **własny, darmowy, przenośny** agent. Dlatego żyje
jako osobny projekt, a nie jako wznowienie odrzuconego kierunku Kebabkillera.

---

## Mechanizm techniczny rozdzielenia (w repo)

- **Scoped Cursor rule:** `.cursor/rules/symbiont-docs.mdc` (`alwaysApply: false`, `globs:
  projekt-symbiont/**`) — agent dostaje zasady Symbionta tylko, gdy pracuje w jego katalogu.
- **Reguła Kebabkillera niezmieniona** poza jednym zdaniem-wskaźnikiem (że Symbiont to osobny lejek).
- **Brak współdzielonych plików stanu** — każdy projekt ma własny START/HANDOFF/DZIENNIK.

> Dzięki temu otwierając sesję nad Symbiontem czytasz lejek Symbionta; nad Kebabkillerem — lejek
> Kebabkillera. Dwa światy, jedno repo, zero mieszania.
