# 02. Badanie rozwiązań — jakie są sposoby na to (research, realne narzędzia 2026)

**Cel:** Nie wymyślać koła od zera. Sprawdzić, co już istnieje, co jest darmowe/open-source,
i z czego złożyć **innowacyjne, ale realne** rozwiązanie dla Symbionta.

> Wszystkie liczby (tier free, ceny) to stan z researchu czerwiec 2026 — przed wdrożeniem
> zweryfikuj u źródła, bo limity się zmieniają.

---

## A. Silniki agenta (mózg) — open-source, samohostowalne

Te projekty robią dokładnie to, czego potrzebujemy (czytają repo, edytują pliki, odpalają komendy,
robią commit/PR), są darmowe i można je wpiąć jako bibliotekę/SDK — czyli **nie musimy budować
pętli agenta od zera**.

| Narzędzie | Forma | Mocna strona | Dla Symbionta |
|-----------|-------|--------------|---------------|
| **OpenHands** (All-Hands-AI) | SDK (Python) + CLI + Web UI + **sandbox Docker** | Najbardziej autonomiczny: „daj zadanie, wróć po PR". Rozwiązuje 50%+ realnych issues w benchmarkach. MIT (rdzeń). | **Rekomendowany silnik** dla toru „napraw i zrób PR". SDK = wbudowujemy w Rdzeń. |
| **Aider** | CLI, git-first | Chirurgiczne edycje plików, **atomowe commity**, dojrzały. | Lekka alternatywa / tryb „szybki refaktor". |
| **Cline** | **SDK (Node.js)** + rozszerzenie IDE + CLI | „Buduj własnych agentów na tym samym silniku". Apache-2.0. Wsparcie Ollama/Groq/OpenRouter. | Atrakcyjny, bo **Node SDK** pasuje do stacku web (jak Kebabkiller). |
| **Continue** | Rozszerzenie IDE | Open-source Copilot (autocomplete + chat). | Mniej istotny (IDE-centryczny). |

**Wniosek:** wszystkie są **model-agnostyczne** (BYO-key) i działają z modelami lokalnymi przez Ollama.
Symbiont **nie pisze własnego silnika** — wybiera jeden (rekomendacja: **OpenHands SDK** dla autonomii
+ sandbox, ewent. **Cline SDK** jeśli chcemy 100% Node) i dokłada do niego: panel, tożsamość/MCP, tor PR.

Źródła:
- OpenHands — https://github.com/All-Hands-AI/OpenHands (SDK + sandbox Docker, MIT)
- Aider — https://github.com/paul-gauthier/aider (git-first, atomowe commity)
- Cline — https://github.com/cline/cline (Node SDK + IDE + CLI, Apache-2.0)
- Porównanie 2026 — https://rightaichoice.com/blog/open-source-ai-coding-agents-2026-self-hosting-guide

---

## B. Modele (LLM) — jak to zrobić darmowo / prawie darmowo

Audyty plików robimy **czystym kodem** (sekcja D) → 0 zł. LLM potrzebny tylko do rozumowania
i pisania kodu. Tu wchodzą **darmowe tiery** + **lokalny model** jako fallback.

| Dostawca | Darmowy limit (≈) | Modele | Karta? |
|----------|-------------------|--------|--------|
| **Groq** | 30 RPM / **14 400 req/dzień** | Llama 3.x/4, Qwen3, Kimi K2, GPT-OSS | Nie |
| **Google Gemini API** | **1 500 req/dzień** (Flash), 50/dzień (Pro) | Gemini 2.5 Flash / Pro | Nie |
| **OpenRouter** | 50–1000 req/dzień na modelach `:free` | DeepSeek R1, Qwen3-Coder 480B, Llama 4 | Nie |
| **Cerebras** | ~1M tok/dzień | Llama, Qwen3, GPT-OSS | tak (trial) |
| **Ollama (lokalnie)** | **bez limitu** (Twój sprzęt) | Qwen3-Coder, DeepSeek-Coder, Llama, Gemma | — (offline) |

**Wzorzec „bramki LLM" (LLM gateway):** jeden endpoint OpenAI-compatible, który **kaskadowo
przełącza dostawców** przy 429/awarii (failover, circuit breaker, quota-aware). Istnieją gotowe
open-source: **FreeLLM**, **Freeloader** — można użyć/wzorować się. Dzięki temu Symbiont „nigdy nie
widzi 429" i zostaje przy ~0 zł.

Źródła:
- Ranking darmowych LLM 2026 — https://klymentiev.com/blog/best-free-llm-2026
- Bramka free (failover) — https://github.com/marcosremar/freellm , https://github.com/Arnav8452/freeloader
- Ollama / platformy — https://medium.com/codex/open-source-llm-platforms-in-2026-ollama-openrouter-groq-nvidia-nim-which-one-should-you-use-2f11c7ba60bc

---

## C. Wpięcie w host i „tożsamość" — MCP (Model Context Protocol)

**MCP** to otwarty standard (JSON-RPC 2.0, „USB-C dla AI"), którym hosty AI (Cursor, Claude, Windsurf…)
podłączają się do narzędzi i danych. Architektura **Host → Klient → Serwer**:

- **Host** = aplikacja z LLM (u nas: Rdzeń Symbionta).
- **Klient** = łącznik 1:1 do jednego serwera MCP (bramka bezpieczeństwa, zgody usera).
- **Serwer MCP** = wystawia **narzędzia / zasoby / prompty** danego systemu (pliki, DB, logi, API).

**To jest klucz do „tożsamości z programem":** każdy host (oprogramowanie) dostaje **własny serwer
MCP**, który wystawia jego pliki/DB/logi jako narzędzia. Jeden Rdzeń Symbionta + N serwerów MCP =
ten sam agent, różne tożsamości. Transport:
- **stdio** — serwer odpalany lokalnie jako podproces (host na tej samej maszynie),
- **Streamable HTTP (SSE)** — serwer zdalny / multi-user (dostęp z telefonu/laptopa, sekcja W5).

Źródła:
- Architektura MCP — https://modelcontextprotocol.io/docs/learn/architecture
- Przewodnik MCP 2026 — https://akshayghalme.com/blogs/mcp-servers-complete-guide/

---

## D. Audyt plików „za darmo" — czysty kod, bez LLM

Audyt = analiza statyczna, nie rozumowanie LLM. Dlatego jest **darmowy i deterministyczny**:

| Warstwa audytu | Narzędzia (open-source) |
|----------------|-------------------------|
| Szybkie wyszukiwanie / wzorce | `ripgrep` (rg), `git grep` |
| Struktura / AST | tree-sitter, `@babel/parser` (JS/TS), `ast` (Py) |
| Lint / jakość | ESLint, Ruff, `tsc --noEmit`, semgrep (reguły bezpieczeństwa) |
| Sekrety / podatności | gitleaks, `npm audit`, trivy |
| Metryki / martwy kod | madge (cykle importów), depcheck, cloc |

LLM wkracza **dopiero na końcu** (opcjonalnie) — do podsumowania raportu ludzkim językiem. Surowy
audyt = 0 zł i działa nawet offline. To realizuje W2 „darmowy mistrz audytów".

---

## E. Bezpieczne edycje (na produkcji) — wzorce z praktyki 2026

Konsensus branżowy „jak pozwolić agentowi edytować kod bezpiecznie":

1. **Izolacja workspace** — każdy run w osobnym **git worktree** (osobna gałąź + katalog), nigdy w main/prod.
2. **Mały blast radius** — jeden commiter (agent nie trzyma „młotka" git), brak sekretów prod w env agenta,
   ograniczony filesystem (root + ścieżka względna).
3. **Diff-only** — agent zwraca **unified diff**, nie surowe pliki; allowlista plików z planu; limit liczby zmian.
4. **Bramka polityk (PreToolUse)** — blokada `rm`, `push --force`, migracji bez planu rollbacku, edycji
   testów bez zgody itp.
5. **Weryfikacja** — CI (lint/testy/typy) na każdym patchu **zanim** cokolwiek trafi do akceptacji.
6. **Rollback** — każda zmiana = jeden odwracalny commit/PR; deploy etapami (canary), auto-rollback z metryk.
7. **Audit log** — wszystkie akcje agenta logowane i przeglądalne.

**Zasada nadrzędna:** agent **nigdy nie zatwierdza własnej pracy** i **nie merguje do gałęzi domyślnej**.
Produkcja dostaje tylko zmiany już zweryfikowane i odwracalne. To realizuje W3 i W4.

Źródła:
- Sandbox + worktrees — https://mikemcquaid.com/sandboxed-agent-worktrees-my-coding-and-ai-setup-in-2026/
- Permission modes / single-committer — https://munderdiffl.in/blog/agent-security-and-sandboxing/
- Diff-only + CI gate + rollback — https://medium.com/@ThinkingLoop/when-your-ai-edits-code-who-holds-the-seatbelt-12c0f670cee1

---

## F. Dostęp z każdego miejsca, „ta sama wersja" (W5)

- **Rdzeń hostowany RAZ** jako usługa web → panel jako **PWA** (działa na telefonie jak apka).
- **HTTPS + auth** (token/OAuth) + opcjonalny tunel (Cloudflare Tunnel/Tailscale) jeśli Rdzeń stoi w domu.
- Telefon i laptop uderzają w **ten sam URL** → zawsze ta sama wersja, zero instalacji per-urządzenie.
- Transport zdarzeń (stream odpowiedzi): **SSE** (Server-Sent Events) — lekki, działa zza tunelu/proxy.

---

## Podsumowanie: z czego składamy Symbionta

| Klocek | Wybór (rekomendacja) | Realizuje |
|--------|----------------------|-----------|
| Silnik agenta | OpenHands SDK (lub Cline SDK / Aider) | W1, W3 |
| Audyt plików | rg + tree-sitter + lintery + gitleaks | W2 |
| Modele | Bramka free (Groq→Gemini→OpenRouter) + Ollama fallback | W2, W6 |
| Tożsamość/host | Manifest + **serwer MCP per host** (stdio/HTTP) | W7 |
| Bezpieczeństwo | worktree + diff-only + CI + PR + rollback + audit log | W3, W4 |
| Dostęp | Rdzeń jako PWA, HTTPS+auth, SSE, jeden URL | W5 |
| Hosting | 1 mały host / darmowy tier na Rdzeń | W6 |

Innowacja Symbionta = **nie nowy silnik**, tylko **sposób złożenia**: jeden samohostowany Rdzeń +
**moduł nadający tożsamość** (manifest + MCP) wpinany w rdzeń dowolnego programu, z darmowym
audytem i twardym torem bezpieczeństwa. Szczegóły: [03_ARCHITEKTURA.md](03_ARCHITEKTURA.md).
