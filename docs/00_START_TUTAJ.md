# 00. START TUTAJ (agent — czytaj tylko to na początku)

**Projekt:** Kebabkiller Studio — niezależny od `gema-0`.  
**Cel:** Pionowe wideo 9:16 z postacią Kebabkiller (Panel Reżysera + AI + silnik wideo).

---

## Start sesji — 3 pliki, ~3 minuty

| Kolejność | Plik | Po co |
|-----------|------|--------|
| **1** | Ten plik | Zasady i mapa |
| **2** | [HANDOFF_AKTUALNY.md](HANDOFF_AKTUALNY.md) | **Co robimy TERAZ** (jedna strona) |
| **3** | [03_AGENT_STATE_AND_TASKS.md](03_AGENT_STATE_AND_TASKS.md) | Roadmapa + znane bugi |

**Nie czytaj** reszty, dopóki zadanie tego nie wymaga.

---

## Gdzie jest pełna wiedza?

| Potrzebujesz… | Czytaj… | Uwagi |
|---------------|---------|-------|
| **ŹRÓDŁO PRAWDY architektury + wizji** | **[11_OPUS_ARCHITECTURE_PROPOSAL.md](11_OPUS_ARCHITECTURE_PROPOSAL.md)** | **Jedyne źródło prawdy** |
| Historia sesji 1 → 2 → … | [DZIENNIK_SESJI.md](DZIENNIK_SESJI.md) | |
| Limity silnika / Scenarzysta | [CAPABILITIES.md](CAPABILITIES.md) | |
| Protokół zamykania sesji | [AGENT_PROTOCOL.md](AGENT_PROTOCOL.md) | |
| Audyt spójności docs | [AUDYT_SPÓJNOŚCI_2026-06-06.md](AUDYT_SPÓJNOŚCI_2026-06-06.md) | |
| Perełki z gema-0 | [archive/sesja-01/05_PERELKI_Z_GEMA0.md](archive/sesja-01/05_PERELKI_Z_GEMA0.md) | |

### Dokumenty LEGACY (nie implementuj — historyczne)

| Plik | Dlaczego legacy |
|------|-----------------|
| [01_PROJECT_VISION.md](01_PROJECT_VISION.md) | Tabela statusów nieaktualna |
| [02_ARCHITECTURE.md](02_ARCHITECTURE.md) | Stara architektura (Groq, green-screen) — sprzeczna z docs/11 |
| [04_AI_DIRECTOR_KNOWLEDGE.md](04_AI_DIRECTOR_KNOWLEDGE.md) | Stary model Reżysera LLM, fazy 4.x nie istnieją |
| [05_EPISODE_PIPELINE.md](05_EPISODE_PIPELINE.md) | Wizja wchłonięta do docs/11 (archiwum) |
| [07_DEV_AGENT_PLAN.md](07_DEV_AGENT_PLAN.md) | Kierunek **odrzucony** (docs/11 sekcja G) |
| [10_OPUS_VISION_BRIEFING.md](10_OPUS_VISION_BRIEFING.md) | Jednorazowy briefing — historyczny |
| [archive/06_INSTRUKCJA_OBSLUGI_V2.md](archive/06_INSTRUKCJA_OBSLUGI_V2.md) | Opisuje UI które nie istnieje |

---

## Zasady (skrót)

1. **Nie dotykaj `gema-0`** — osobny produkt obok.
2. **Źródło prawdy:** `docs/11_OPUS_ARCHITECTURE_PROPOSAL.md` (architektura + wizja) + `HANDOFF_AKTUALNY.md` + `03_AGENT_STATE_AND_TASKS.md` (operacyjne).
3. **Po każdej sesji** — aktualizuj handoff i dopisz wpis do dziennika (patrz protokół).

---

## Cursor — najlepszy tryb (właściciel)

1. **File → Open Folder** → tylko `kebabkiller_studio` (nie `gema-0`).
2. **Model:** Gemini 3.1 Pro (duży kontekst — docs + kod naraz).
3. **Max Mode:** włącz przy **planowaniu** architektury; wyłącz na codzienne drobne poprawki.
4. **Shift+Tab** → **Plan Mode** na start sesji; **Agent** dopiero po Twoim „OK, rób”.
5. Prompt startowy → sekcja w [HANDOFF_AKTUALNY.md](HANDOFF_AKTUALNY.md) (wersja „PLAN, bez kodu”).

---

## Uruchomienie (dev)

```bash
cd kebabkiller_studio2/kebabkiller
npm run dev
# status: npm run status:dev  |  restart: npm run restart:dev
```

- UI: http://localhost:5174  
- API: http://localhost:4005/api/health (`PORT` + `FRONTEND_PORT` w `backend/.env`; domyślnie **4005/5174**). Macius/Symbiont: **8787/4001/5173** — osobny stack.

Klucze: `GROQ_API_KEY` (Reżyser), `RUNCOMFY_*` + `VIDEO_ENGINE=runcomfy` (generator).

---

## Gdy kończysz sesję

Napisz agentowi jedno słowo:

```
HANDOFF
```

(lub potocznie „kończymy pracę” — agent rozpozna intencję; szczegóły: [AGENT_PROTOCOL.md](AGENT_PROTOCOL.md))
