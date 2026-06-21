# 03. Architektura — Rdzeń + Moduł + Tożsamość

**Status:** projekt architektury (źródło prawdy techniczne). Grounding: [02_BADANIE_ROZWIAZAN.md](02_BADANIE_ROZWIAZAN.md).

---

## Idea w jednym zdaniu

> **Jeden** samohostowany „mózg" (**Rdzeń Symbionta**), do którego wpinasz **cienkie moduły-adaptery**
> w rdzeń każdego oprogramowania; każdy moduł nadaje agentowi **tożsamość** danego programu
> (manifest + serwer MCP), a Ty sterujesz wszystkim z **jednego panelu** (telefon/laptop).

```
            ┌──────────────────────────────────────────────────────┐
            │              RDZEŃ SYMBIONTA  (hostowany RAZ)          │
            │                                                        │
  telefon ──┤  Panel (PWA, HTTPS+auth)                               │
  laptop  ──┤        │                                               │
            │        ▼                                               │
            │  Orkiestrator agenta  ── Silnik (OpenHands/Cline SDK)  │
            │        │                    │                          │
            │        │            ┌───────┴────────┐                 │
            │        │            ▼                ▼                  │
            │   Bramka LLM    Silnik audytu   Tor bezpiecznych zmian │
            │ (free+Ollama)   (rg/AST/lint)   (worktree→diff→CI→PR)  │
            │        │                                               │
            │   Rejestr hostów + Audit log (SQLite)                  │
            └────────┬───────────────────────────────────────┬──────┘
                     │ MCP (stdio / HTTP+SSE)                  │
        ┌────────────▼───────────┐               ┌────────────▼───────────┐
        │  HOST A: Kebabkiller    │               │  HOST B: inny program   │
        │  ── Moduł Symbiont      │               │  ── Moduł Symbiont      │
        │  ── symbiont.identity   │               │  ── symbiont.identity   │
        │  ── Serwer MCP (pliki,  │               │  ── Serwer MCP          │
        │     DB, logi, API)      │               │                         │
        │  ── Panel w UI hosta    │               │  ── Panel w UI hosta    │
        └─────────────────────────┘               └─────────────────────────┘
```

---

## Trzy elementy

### 1) Rdzeń Symbionta (jeden, hostowany)

Samodzielna usługa (rekomendacja stacku: **Node/Express** lub **Python/FastAPI** — pod wybrany silnik).
Komponenty:

| Komponent | Rola |
|-----------|------|
| **Panel (PWA)** | Jedno UI dla wszystkich hostów; czat + audyty + status runów + linki PR. Dostęp z każdego urządzenia. |
| **Orkiestrator** | Wątki, runy, kolejka, stream SSE, routing do hosta po jego tożsamości. |
| **Silnik agenta** | OpenHands SDK / Cline SDK — pętla agenta, narzędzia, sandbox. |
| **Bramka LLM** | Failover po darmowych tierach + Ollama fallback (patrz `04`). |
| **Silnik audytu** | Czysty kod (rg/AST/lint/gitleaks) — darmowy, deterministyczny. |
| **Tor zmian** | worktree → diff-only → CI → PR → deploy/rollback (patrz `05`). |
| **Rejestr hostów** | Lista podłączonych programów + ich manifesty/tożsamości. |
| **Audit log** | SQLite: kto/co/kiedy zrobił agent (rozliczalność). |

### 2) Moduł-adapter (wpinany w rdzeń hosta)

Cienki pakiet instalowany w oprogramowanie-host (npm/pip/composer — zależnie od stacku hosta).
**Trzy zadania** (szczegóły: [06_INSTALACJA_JAKO_MODUL.md](06_INSTALACJA_JAKO_MODUL.md)):

1. **Rejestruje host** w Rdzeniu, wysyłając **manifest tożsamości**.
2. **Montuje panel** w UI hosta (route/iframe/web-component) — agent dostępny „z panelu oprogramowania,
   w którym go zainstalowałem" (cytat z marzenia).
3. **Wystawia serwer MCP** hosta (pliki, DB, logi, wybrane API) — to jest „wpięcie w strukturę".

### 3) Tożsamość (to, co czyni go „jednym z programem")

**Tożsamość = Manifest + serwer MCP + izolowana przestrzeń pracy.** Plik w rdzeniu hosta, np.
`symbiont.identity.json` (commitowany do repo hosta):

```json
{
  "host_id": "kebabkiller-studio",
  "display_name": "Kebabkiller Studio",
  "stack": { "frontend": "vite-react", "backend": "express-sqlite" },
  "repo": { "url": "https://github.com/.../kebabkiller", "default_ref": "main" },
  "conventions_doc": "docs/00_START_TUTAJ.md",
  "forbidden_paths": ["gema-0/**", "backend/src/ai/director.js", "**/.env"],
  "audit_scopes": ["frontend/src/**", "backend/src/**", "docs/**"],
  "mcp": { "transport": "http", "url": "https://.../mcp", "auth": "bearer" },
  "capabilities": { "audit": true, "edit_via_pr": true, "read_db": true, "deploy": false }
}
```

Dzięki temu **ten sam Rdzeń** zachowuje się inaczej per host: zna jego zasady, zakazane pliki
(np. `gema-0` w Kebabkiller), zakres audytu i co mu wolno. To realizuje W7.

---

## Przepływy (jak to działa w praktyce)

### Audyt (darmowy, read-only) — MVP
```
Panel → Orkiestrator → MCP hosta: listuj/czytaj pliki w audit_scopes
      → Silnik audytu (rg/AST/lint/gitleaks)  [BEZ LLM = 0 zł]
      → (opcjonalnie) LLM: streszczenie raportu
      → Raport w panelu (+ zapis w audit log)
```

### Naprawa (bezpieczna, przez PR) — Faza 2
```
Panel: "napraw X" → Orkiestrator → Silnik agenta w git worktree (izolacja)
      → diff-only patch (allowlista plików) → CI (lint/testy)
      → PR na repo hosta → człowiek/auto akceptuje → deploy etapami → monitor/rollback
                                  (produkcja NIGDY nie edytowana wprost)
```

---

## Dlaczego tak (a nie wrapper na Cursor Cloud)

W lejku Kebabkiller wrapper na Cursor Cloud Agents został **odrzucony** (zależność od zewn. usługi,
brak „własnego" agenta, koszt). Symbiont jest **własny i samohostowany**, więc spełnia W1+W6 i nie
powiela tamtego błędu. Patrz [08_ROZDZIELENIE_OD_KEBABKILLER.md](08_ROZDZIELENIE_OD_KEBABKILLER.md).

---

## Granice i ryzyka (świadome)

| Ryzyko | Mitigacja |
|--------|-----------|
| Darmowe tiery LLM mają limity/jakość | Bramka z failoverem + Ollama; audyt nie używa LLM |
| Sandbox/Docker na małym hoście waży | MVP audyt nie potrzebuje sandboxa; edycje można robić w worktree bez ciężkiego Dockera |
| MCP po HTTP wystawia dane hosta | Auth bearer + zakresy + tożsamość ogranicza ścieżki; brak sekretów prod |
| „Jeden Rdzeń" = pojedynczy punkt awarii | Backup SQLite + prosty redeploy; Rdzeń bezstanowy poza SQLite |
| Agent psuje kod | Tor bezpieczeństwa (`05`): diff-only + CI + PR + rollback; nigdy bez akceptacji |
