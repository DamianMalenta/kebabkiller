# 05. Koniec okna czatu #1 — Perełki z gema-0 (co warto przenieść)

**Data:** 2026-06-06  
**Kontekst:** Audyt wzorców w `gema0` pod kątem `kebabkiller_studio`.  
**Zasada:** Nie kopiujemy kodu 1:1 ani architektury gema-0. Wybieramy **pojedyncze mechanizmy**, które rozwiązują realne problemy, które już napotkaliśmy.

---

## Werdykt w jednym zdaniu

**gema-0 ma kilka sprawdzonych „perełek” operacyjnych (klucze, retry, fallback providerów), ale jego rdzeń (Oraculum, Rój, AST, RAM workspace) jest nie do przeniesienia i nie powinien być importowany.**

---

## PERŁKA 1 — Walidacja kluczy API (`isValidKey`)

**Gdzie w gema-0:** `backend/ai/aiGateway.mjs` → `isValidKey()`, `resolveValidKey()`

**Co robi:** Odrzuca puste klucze i placeholdery typu `twój_klucz_tutaj`, `your_key_here`.

**Dlaczego warto:** Użytkownik wkleił klucz Gemini (`AQ.`) do `OPENAI_API_KEY` — błąd typu klucza. Walidacja formatu + placeholderów zmniejsza takie pomyłki.

**Jak przenieść (Faza 4.5):**
- Przy zapisie `.env` lub w `/api/health` pokazać: `groq: OK`, `gemini: INVALID_PREFIX`.
- Proste reguły: `GROQ_*` → musi zaczynać się od `gsk_`, `GEMINI_*` → `AQ.`, `OPENAI_*` → `sk-`.

**Nie przenosić:** całego `aiGateway.mjs` (routing Oraculum/Rój).

---

## PERŁKA 2 — Retry z exponential backoff na `fetch failed` / 429

**Gdzie w gema-0:** `backend/ai/aiGateway.mjs` (5 prób, 1s→2s→4s…)  
**Powiązane:** `backend/lib/gemini/generateWithBackoff.mjs` (jitter, RPM limit dla Gemini)

**Co robi:** Gdy Groq/Gemini zwraca 429 lub sieć pada (`fetch failed`), system czeka i ponawia — zamiast od razu wpadać w mock.

**Dlaczego warto:** U Was Gemini ma quota 429, Groq czasem też. Jedna próba → mock to zła UX.

**Jak przenieść:**
- W `backend/src/ai/director.js` owinąć wywołania providerów w 3–5 retry z backoff.
- Dla Gemini opcjonalnie prostszy RPM limit (gema-0 ma pełny jitter — na start wystarczy backoff).

**Nie przenosić:** całego modułu Gemini backoff (420 linii) — overkill na start.

---

## PERŁKA 3 — Fallback chain providerów (Groq → OpenRouter)

**Gdzie w gema-0:** `aiGateway.mjs` — brak Groq → OpenRouter free; OpenRouter z `route: "fallback"`.

**Co robi:** Jeden klucz padnie → drugi provider przejmuje bez restartu serwera.

**Dlaczego warto:** Macie już `GROQ_API_KEY` i `OPENROUTER_API_KEY` w gema-0 `.env`. Kebabkiller ma chain Gemini→Groq→OpenAI→Anthropic, ale **bez OpenRouter** i bez auto-fallbacku przy 429.

**Jak przenieść:**
- Dodać `OPENROUTER_API_KEY` do kebabkiller `.env.example`.
- W `director.js`: po błędzie 429 na Groq, spróbuj OpenRouter (`meta-llama/llama-3.3-70b-instruct:free` lub podobny).

---

## PERŁKA 4 — `NODE_OPTIONS=--use-system-ca` w skryptach npm (nie w .env)

**Gdzie w gema-0:** `.env` → `NODE_OPTIONS=--use-system-ca` (działa bo gema uruchamiane z tego env).

**Lekcja z kebabkiller:** W `.env` + `dotenv` **za późno** — Node czyta `NODE_OPTIONS` przed startem. Naprawiono przez `node --use-system-ca` w `backend/package.json`.

**Perełka:** Ten sam fix co w gema-0, ale **w `package.json` scripts**, nie w `.env`.

---

## PERŁKA 5 — Status providerów na starcie / health

**Gdzie w gema-0:** `moeEnv.mjs` → `getMoeProviderStatus()`, logi w `server.mjs`.

**Co robi:** Przy starcie widać `Groq=OK | OpenRouter=—` zamiast zgadywania.

**Dlaczego warto:** Kebabkiller ma `/api/health` z `llm.configured` — dobry kierunek. Rozszerzyć o `ssl: ok` i `last_provider_used`.

**Jak przenieść:** Już częściowo jest — dodać human-readable komunikaty w UI (Dashboard).

---

## PERŁKA 6 — Odrzucanie pustych odpowiedzi LLM

**Gdzie w gema-0:** `isEmptyGeneratedCode()` w `sanitizeGeneratedCode.mjs`, używane w `aiGateway`.

**Co robi:** LLM zwróci pusty JSON → retry zamiast cichego mocka.

**Jak przenieść:** W `director.js` po `JSON.parse` sprawdzić wymagane pola (`positive_prompt`, `storyboard`). Brak → retry lub błąd widoczny w UI.

---

## CO ŚWIADOMIE NIE PRZENOSIĆ (anty-perełki)

| Element gema-0 | Dlaczego NIE |
|----------------|--------------|
| Oraculum + manifest JSON | Inny domain (generowanie kodu, nie wideo) |
| Shotgun Swarm | Równoległe generowanie plików źródłowych — irrelevant |
| RAM workspace / phantomVM | Architektura pod edycję kodu |
| reactViteProvisioning | Stack web app factory, nie video pipeline |
| EventBroker WebSocket | Sequencer UI — inny produkt |
| Cały monolit Express gema | Kebabkiller ma być lekki i odizolowany |

**Importowanie modułów z gema-0 do kebabkiller = architektoniczny błąd.** Kopiujemy **wzorce**, nie **repozytorium**.

---

## Mapa: perełka → priorytet w kebabkiller

| Perełka | Priorytet | Faza |
|---------|-----------|------|
| `--use-system-ca` w npm scripts | ✅ Zrobione | — |
| Walidacja typu klucza | Wysoki | 4.5 |
| Retry/backoff na LLM | Wysoki | 4.5 |
| OpenRouter fallback | Średni | 4.5 |
| PlanValidator (inspiracja: sanitize) | Wysoki | 4.5 |
| Health / status UI | Niski | 4.5 |
| Gemini RPM jitter | Niski | później |

---

## Pliki gema-0 do ewentualnego zajrzenia (readonly)

```
gema0/backend/ai/aiGateway.mjs       — retry, Groq/OpenRouter, isValidKey
gema0/backend/ai/moeEnv.mjs          — status providerów
gema0/backend/lib/gemini/generateWithBackoff.mjs — zaawansowany backoff Gemini
gema0/.env                           — wzór: GROQ + OPENROUTER + NODE_OPTIONS (nie kopiuj sekretów do repo)
```

**Nie czytać:** `_docs/DLA_WLASCICIELA/`, `gemini-gema/` (reguły projektu gema-0).
