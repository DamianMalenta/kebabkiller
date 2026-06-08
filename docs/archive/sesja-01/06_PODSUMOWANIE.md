# 06. Koniec okna czatu #1 — Brutalnie szczere podsumowanie

**Data:** 2026-06-06  
**Zakres sesji:** Od audytu „czy budować na gema-0” → niezależny `kebabkiller_studio` → działające MVP → testy AI Reżysera.

---

## Co naprawdę zbudowaliśmy

| Warstwa | Stan | Ocena szczerze |
|---------|------|----------------|
| Decyzja architektoniczna | 100% niezależny projekt obok gema-0 | ✅ **Trafiona** |
| Dokumentacja agenta | README + docs 01–06 | ✅ **Solidna** |
| Backend API + SQLite | CRUD postaci/tła/reguł, jobs | ✅ **Działa** |
| Frontend (Panel Reżysera) | Dashboard, Studio, Baza Wiedzy | ✅ **Użyteczny MVP** |
| AI Reżyser (Groq/Gemini/…) | Plan JSON ze sceny PL | ✅ **Działa po fixie SSL** |
| Silnik wideo | Mock placeholder | ⚠️ **Celowo niedokończony** |
| Spójność wizualna Kebabkillera | Tekst + JPG w bazie | ⚠️ **Plan słaby, wideo zerowe** |

**Brutalna prawda:** Mamy **fabrykę planów wideo**, nie fabrykę **filmów**. To właściwy etap — ale nie mylcie MVP z produktem viralowym.

---

## Co poszło dobrze (bez lukru)

1. **Odrzucenie gema-0 jako hosta** — uniknęliśmy Oraculum/Swarm/RAM w potoku wideo.
2. **UI zamiast „zero UI”** — Panel Reżysera + podgląd planu to właściwa decyzja.
3. **Baza Wiedzy** — edycja postaci/tła/reguł bez dotykania kodu działa.
4. **Iteracyjne debugowanie** — SQLite/Node 24, port 4000, SSL, duplikat Kebabkillera, brak trybu edycji — wszystko naprawione w trakcie sesji.
5. **Testy użytkownika** — sceny „stoi” i „upada” z `Źródło AI: groq` potwierdzają, że pipeline ma sens.

---

## Co poszło słabo (szczerze)

1. **AI Reżyser parafrazuje tożsamość** — mimo dobrego opisu w bazie Groq pisał „bread roll”, „blurred background”. To **luka architektoniczna**, nie wina opisu użytkownika.
2. **Obrazek referencyjny nie uczestniczy w Reżyserze** — JPG jest w bazie, ale LLM go nie widzi.
3. **`negative_prompt` postaci nie trafia do Groq** — zapisany w DB, ignorowany w prompt builderze.
4. **`SYSTEM_PROMPT` w kodzie** nadal sugeruje „meat cone” — konflikt z dürüm/tortilla.
5. **Brak PlanValidator** — plan z błędami przechodzi do UI bez korekty.
6. **Dokumentacja 03_AGENT_STATE** przez chwilę była nieaktualna (OpenAI-only, brak Groq/Gemini) — naprawiane ad hoc.
7. **Księga Praw w docs/04** ma przestarzały przykład postaci (stożkowaty kebab) — nie odzwierciedla Waszej wizji.

---

## Ocena decyzji biznesowych z sesji

| Decyzja | Werdykt |
|---------|---------|
| Kebabkiller jako osobny produkt | ✅ |
| 9:16, spójność postaci+tła | ✅ cel; ⚠️ technicznie jeszcze nie dowiezione |
| Dürüm/tortilla + dwie nogi | ✅ wizja; ⚠️ LLM ją upraszcza |
| Compositing przy upadku | ✅ logiczne; ⚠️ wymaga implementacji FFmpeg |
| Groq jako główny LLM (Gemini 429) | ✅ praktyczne |
| Mock wideo przed prawdziwym silnikiem | ✅ właściwa kolejność |

---

## Stan techniczny na koniec okna #1

### Działa
- `npm run dev` → frontend :5173 + backend :4000
- Baza: Kebabkiller (opis + JPG), Piec_Brick (JPG), 4 reguły seed
- Studio: podgląd planu, `Źródło AI: groq`
- Generowanie mock job → Dashboard „Gotowe”

### Wymaga restartu / uwagi
- Po zmianie `.env` → Ctrl+C → `npm run dev`
- Port 4000 zajęty → `netstat` + `taskkill`
- Gemini quota 429 → normalne; Groq przejmuje

### Nie zrobione (świadomie)
- Prawdziwe wideo (Wan 2.1 / ComfyUI)
- Faza 4.5 (Kanon EN, PlanValidator, referencje w planie)
- Storyboard preview (statyczne klatki)
- VLM QA
- OpenRouter fallback (perełka z gema-0)

---

## Rekomendowany następny krok (okno czatu #2)

**Otwórz Cursor w folderze `kebabkiller_studio` (NIE gema-0).**

### Faza 4.5 (przed drogim wideo)
1. Pole `identity_block_en` + wstrzykiwanie 1:1 do positive prompt
2. PlanValidator (odrzuć `blurred background`, wymuś sharp reference)
3. Wstrzyknij `negative_prompt` postaci do każdego planu
4. Popraw `SYSTEM_PROMPT` (usuń „meat cone”)
5. Retry/backoff LLM (perełka z gema-0)
6. Plan JSON: `character_ref`, `background_ref` ścieżki

### Faza 5
7. Integracja Wan 2.1 / ComfyUI z asset binding (IP-Adapter)

---

## Prompt startowy dla okna czatu #2

```
Kontynuuj Kebabkiller Studio (root = ten folder, NIE gema-0).
Przeczytaj: docs/00_START_TUTAJ.md, docs/HANDOFF_AKTUALNY.md, docs/03_AGENT_STATE_AND_TASKS.md.
Zacznij od Fazy 4.5 w handoff.
```

Szczegóły archiwum tej sesji:
- [05_PERELKI_Z_GEMA0.md](05_PERELKI_Z_GEMA0.md)
- [06_PODSUMOWANIE.md](06_PODSUMOWANIE.md) (ten plik)

---

## Jedno zdanie na koniec

**Zbudowaliśmy solidne MVP „mózgu produkcji”, ale dopóki nie dodamy Kanonu + Walidatora + prawdziwego silnika wideo z referencjami, Kebabkiller nie będzie viralem — będzie dobrze zarządzanym planem na papierze.**

To nie porażka — to **właściwy moment**, żeby nie iść w drogi render zanim Reżyser przestanie parafrazować Waszą tożsamość.
