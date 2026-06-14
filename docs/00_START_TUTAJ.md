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

| Potrzebujesz… | Czytaj… |
|---------------|---------|
| Historia sesji 1 → 2 → … | [DZIENNIK_SESJI.md](DZIENNIK_SESJI.md) |
| Wizja produktu (skrót) | [01_PROJECT_VISION.md](01_PROJECT_VISION.md) |
| **Pipeline odcinka (źródło prawdy wizji)** | **[05_EPISODE_PIPELINE.md](05_EPISODE_PIPELINE.md)** |
| Limity silnika / Scenarzysta | [CAPABILITIES.md](CAPABILITIES.md) |
| Architektura techniczna | [02_ARCHITECTURE.md](02_ARCHITECTURE.md) |
| **Programista w panelu (Cursor Cloud Agents)** | **[07_DEV_AGENT_PLAN.md](07_DEV_AGENT_PLAN.md)** |
| **Briefing architektury dla OPUS (lokalny Cursor)** | **[10_OPUS_VISION_BRIEFING.md](10_OPUS_VISION_BRIEFING.md)** |
| Jak działa Baza Wiedzy / Reżyser (legacy) | [04_AI_DIRECTOR_KNOWLEDGE.md](04_AI_DIRECTOR_KNOWLEDGE.md) |
| Perełki z gema-0 (wzorce) | [archive/sesja-01/05_PERELKI_Z_GEMA0.md](archive/sesja-01/05_PERELKI_Z_GEMA0.md) |
| Szczegóły końca sesji #1 | [archive/sesja-01/06_PODSUMOWANIE.md](archive/sesja-01/06_PODSUMOWANIE.md) |
| Protokół zamykania sesji | [AGENT_PROTOCOL.md](AGENT_PROTOCOL.md) |
| Audyt spójności docs | [AUDYT_SPÓJNOŚCI_2026-06-06.md](AUDYT_SPÓJNOŚCI_2026-06-06.md) |
| **Osobny projekt: Symbiont (agent-moduł)** — NIE mieszać z tym lejkiem | **[../projekt-symbiont/docs/00_START_TUTAJ.md](../projekt-symbiont/docs/00_START_TUTAJ.md)** |

---

## Zasady (skrót)

1. **Nie dotykaj `gema-0`** — osobny produkt obok.
2. **Źródło prawdy operacyjne:** `HANDOFF_AKTUALNY.md` + `03_AGENT_STATE_AND_TASKS.md`.
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
cd kebabkiller_studio
npm run dev
```

- UI: http://localhost:5173  
- API: `http://localhost:{PORT}/api/health` — `PORT` z `backend/.env` (domyślnie **4000**). Vite proxy synchronizuje się automatycznie (`scripts/read-backend-port.mjs`).

Klucze: `GROQ_API_KEY` (Reżyser), `RUNCOMFY_*` + `VIDEO_ENGINE=runcomfy` (generator).

---

## Gdy kończysz sesję

Napisz agentowi jedno słowo:

```
HANDOFF
```

(lub potocznie „kończymy pracę” — agent rozpozna intencję; szczegóły: [AGENT_PROTOCOL.md](AGENT_PROTOCOL.md))
