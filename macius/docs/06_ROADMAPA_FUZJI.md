# 06. Roadmapa fuzji — etapy od audytu do MVP

**Zasada:** najpierw **fakty** (audyt), potem **decyzja** (ADR), potem **najbezpieczniejszy** kawałek
produktu (darmowy audyt read-only), dopiero później edycje i deploy. PLAN-first.

---

## Etap 0 — Audyt gema0 (fundament) ⭐

- [ ] Odpal twardy audyt wg [04_AUDYT_GEMA0.md](04_AUDYT_GEMA0.md) (prompt: `../prompts/PROMPT_AUDYT_GEMA0.md`).
- [ ] Raport w `audyty/AUDYT_GEMA0_<data>.md` (z werdyktem ♻️/🔧/🧪/🗑️ per komponent).
- **Done:** mamy fakty: co reużyć, co odrzucić, mapowanie na W1–W7.

## Etap 1 — Decyzja o wariancie fuzji

- [ ] Zestaw gema0 × marzenie (prompt: `../prompts/PROMPT_FUZJA.md`).
- [ ] Wybierz wariant A/B/C z [05_PRODUKT_DOCELOWY.md](05_PRODUKT_DOCELOWY.md).
- [ ] Zapisz **ADR** w `decyzje/` (decyzja + uzasadnienie + odrzucone opcje + konsekwencje).
- **Done:** jeden zatwierdzony kierunek, udokumentowany.

## Etap 2 — Szkielet macius (produkt) + tożsamość

- [ ] Załóż `macius/symbiont/` (kod produktu) — osobno od `gema0/`/`kebabkiller/`.
- [ ] Wybór silnika agenta + stacku Rdzenia (patrz `../../projekt-symbiont/docs/02_BADANIE_ROZWIAZAN.md`).
- [ ] Schemat `symbiont.identity.json` + rejestr hostów.
- **Done:** Rdzeń stoi, pierwszy host (np. gema0 lub Kebabkiller) zarejestrowany w panelu.

## Etap 3 — Darmowy audyt read-only (MVP, zero ryzyka) ⭐

- [ ] Serwer MCP hosta: `list_files`/`read_file`/`run_audit`.
- [ ] Silnik audytu (rg/AST/lint/gitleaks) — **bez LLM = 0 zł**.
- [ ] Panel: uruchom audyt → raport, dostęp z telefonu/laptopa.
- **Done:** „darmowy mistrz audytów" działa end-to-end na realnym hoście.

## Etap 4 — Bezpieczne naprawy przez PR

- [ ] Tor: worktree → diff-only → CI → PR → rollback (`../../projekt-symbiont/docs/05_BEZPIECZENSTWO.md`).
- [ ] Panel: „napraw X" → diff → PR (link) → status CI.
- **Done:** naprawa bez dotykania żywej produkcji.

## Etap 5 — Bramka LLM + strażnik kosztów

- [ ] Failover Groq→Gemini→OpenRouter→Ollama; domyślnie tylko free; liczniki/alerty.
- **Done:** stabilne ~0 zł.

## Etap 6 — Wielohost + adaptery

- [ ] Kreator `symbiont init`; drugi host innym stackiem.
- **Done:** „wszystkie moje oprogramowania", ten sam panel, osobne tożsamości.

---

## Kolejność wartości (dlaczego tak)

1. **Audyt** daje fakty przy zerowym ryzyku.
2. **MVP = darmowy audyt read-only** daje od razu wartość bez ryzyka dla kodu.
3. Naprawy/koszty/wielohost = skalowanie.

## Powiązanie z lejkiem Symbiont

Etapy 2–6 są rozwinięte technicznie w `../../projekt-symbiont/docs/07_ROADMAPA.md`.
Macius spina je z **konkretem gema0** (co reużyć) i prowadzi pracę agentów.
