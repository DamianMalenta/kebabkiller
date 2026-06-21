# 07. Roadmapa — realny plan etapami (MVP → dalej)

**Zasada:** najpierw to, co **bezpieczne i darmowe** (audyt read-only), potem dopiero edycje.
PLAN-first: każdą fazę zaczynamy od krótkiego planu i „OK, rób".

Pilot/wzór: **Kebabkiller Studio** (pierwszy host). Nie przebudowujemy go — tylko instalujemy Symbionta.

---

## Faza 0 — Szkielet Rdzenia + tożsamość (fundament)

**Cel:** Rdzeń stoi, host Kebabkiller zarejestrowany, panel pokazuje „połączono".

- [ ] Wybór silnika (OpenHands SDK / Cline SDK / Aider) i stacku Rdzenia.
- [ ] Rdzeń: panel (PWA) + auth + rejestr hostów (SQLite) + audit log.
- [ ] Schemat `symbiont.identity.json` (`schema: symbiont/identity@1`).
- [ ] Moduł `@symbiont/host` (Node) — rejestracja + manifest dla Kebabkiller.
- **Done:** z telefonu i laptopa wchodzę na jeden URL, widzę host „Kebabkiller Studio: połączony".

## Faza 1 — Darmowy audyt (MVP, read-only) ⭐

**Cel:** „darmowy mistrz audytów plików" działa end-to-end. Zero ryzyka dla kodu.

- [ ] Serwer MCP Kebabkillera: `list_files`, `read_file`, `run_audit` (zakres `audit_scopes`).
- [ ] Silnik audytu: `ripgrep` + tree-sitter + ESLint/`tsc` + gitleaks + `npm audit`.
- [ ] Panel: uruchom audyt → raport (znaleziska, ryzyka, martwy kod) — **bez LLM = 0 zł**.
- [ ] Opcjonalnie: LLM (bramka free) streszcza raport ludzkim językiem.
- **Done:** „zaudytuj `backend/src/**`" → czytelny raport w panelu, koszt 0 zł, działa z telefonu.

## Faza 2 — Bezpieczne naprawy przez PR

**Cel:** „bezpiecznie tworzyć i naprawiać" — diff → PR, produkcja nietknięta.

- [ ] Tor zmian: git worktree (izolacja) + diff-only + allowlista + PreToolUse (`05`).
- [ ] CI gate (lint/testy) przed akceptacją; PR na repo hosta; brak auto-merge.
- [ ] Panel: „napraw X" → podgląd diffu → utworzony PR (link) → status CI.
- [ ] `capabilities.edit_via_pr = true` dla Kebabkiller (świadomie).
- **Done:** „napraw literówkę w README" → PR z zielonym CI; main/prod nietknięte do akceptacji.

## Faza 3 — Bramka LLM + strażnik kosztów

**Cel:** stabilne ~0 zł nawet przy limitach.

- [ ] Bramka: Groq → Gemini → OpenRouter `:free` → Ollama (failover, quota-aware).
- [ ] Strażnik kosztów: domyślnie tylko free; licznik tierów; alerty; limity kroków/kontekstu.
- **Done:** agent nie pada na 429; rachunek ~0 zł; płatny model tylko po jawnym włączeniu.

## Faza 4 — Wielohost + adaptery

**Cel:** „wszystkie moje oprogramowania" — drugi host innym stackiem.

- [ ] Adapter Python (`symbiont-host`) lub generyczny sidecar MCP.
- [ ] `symbiont init` (kreator instalacji + generacja tożsamości, `06`).
- [ ] Panel: przełącznik między hostami; każdy w swojej tożsamości.
- **Done:** drugi program podłączony w < pół godziny, ten sam panel, osobna tożsamość.

## Faza 5 — Deploy + rollback (opcjonalnie, najwyższe uprawnienia)

**Cel:** domknięcie toru na prod, z bezpiecznikami.

- [ ] `capabilities.deploy` (jawne) + deploy etapowy (canary) + auto-rollback z metryk.
- [ ] Twarde bramki dla auth/migracji/billingu (człowiek wymagany).
- **Done:** zaakceptowany PR → kontrolowany deploy → szybki rollback na żądanie.

---

## Kolejność wartości (dlaczego tak)

1. **Faza 1 (audyt)** daje od razu „darmowego mistrza audytów" przy **zerowym ryzyku** — najlepszy
   stosunek wartości do ryzyka, działa na prod (read-only).
2. **Faza 2 (PR)** dokłada naprawy, ale wciąż bez dotykania żywej produkcji.
3. Reszta to skalowanie (koszty, wielohost, deploy).

## Co świadomie odkładamy

- Auto-merge / agent zatwierdzający własną pracę — **nigdy** (patrz `05`).
- Ciężki sandbox GPU — niepotrzebny do audytu; tylko jeśli host tego wymaga.
- Własny silnik agenta od zera — używamy gotowego open-source (`02`).
