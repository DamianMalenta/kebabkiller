# 06. Instalacja „w rdzeń" i mechanizm tożsamości

**Cel (W7):** „instaluje się w rdzeń wszystkich moich oprogramowań jako kolejny moduł i podczas
instalacji wpina się w strukturę programu, tworząc swoją **tożsamość** z tym programem."

To jest serce innowacji Symbionta. Tu opisujemy **jak** moduł się wpina i **jak** powstaje tożsamość.

---

## Co to znaczy „w rdzeń jako moduł"

Symbiont **nie przepisuje** Twojego programu. Dokłada **cienki moduł-adapter** (1 pakiet), tak jak
dokładasz dowolną bibliotekę. Moduł wykonuje przy instalacji **3 wpięcia**:

```
[Oprogramowanie-HOST]
   ├── (istniejący kod hosta)
   └── moduł Symbiont  ← instalowany jak kolejny moduł
         1) rejestracja + manifest tożsamości   → łączy host z Rdzeniem
         2) montaż panelu w UI hosta            → agent „z panelu programu"
         3) serwer MCP hosta                    → wpięcie w strukturę (pliki/DB/logi)
```

---

## Krok po kroku: kreator instalacji (`symbiont init`)

Moduł dostarcza komendę kreatora, która **tworzy tożsamość** w trakcie instalacji:

1. **Wykrycie hosta** — kreator skanuje repo: stack (package.json / pyproject / composer.json),
   strukturę katalogów, repo git, pliki konwencji (np. `docs/00_START_TUTAJ.md`).
2. **Propozycja tożsamości** — generuje `symbiont.identity.json` (patrz niżej) z sensownymi domyślnymi:
   `audit_scopes`, `forbidden_paths`, `capabilities` (domyślnie tylko audyt R).
3. **Akceptacja właściciela** — przeglądasz i potwierdzasz (PLAN-first; nic nie rusza bez OK).
4. **Wpięcie panelu** — dodaje route/komponent panelu do UI hosta (lub iframe do Rdzenia).
5. **Wystawienie MCP** — generuje serwer MCP hosta (narzędzia: `list_files`, `read_file`, `run_audit`,
   opcjonalnie `query_db`, `read_logs`).
6. **Rejestracja w Rdzeniu** — wysyła manifest; Rdzeń dodaje host do rejestru. Od tej chwili host ma
   **tożsamość** i jest widoczny w jednym panelu obok innych.

> Wynik: ten sam Rdzeń, nowa „osobowość" dopasowana do tego konkretnego programu.

---

## Plik tożsamości — `symbiont.identity.json`

Commitowany do **rdzenia repo hosta** (to czyni tożsamość trwałą i wersjonowaną):

```json
{
  "schema": "symbiont/identity@1",
  "host_id": "kebabkiller-studio",
  "display_name": "Kebabkiller Studio",
  "stack": { "frontend": "vite-react", "backend": "express-sqlite" },
  "repo": { "url": "https://github.com/.../kebabkiller", "default_ref": "main" },
  "conventions_doc": "docs/00_START_TUTAJ.md",
  "audit_scopes": ["frontend/src/**", "backend/src/**", "docs/**"],
  "forbidden_paths": ["gema-0/**", "backend/src/ai/director.js",
                      "backend/src/engines/mockEngine.js",
                      "backend/src/engines/runComfyEngine.js", "**/.env"],
  "capabilities": { "audit": true, "edit_via_pr": false, "read_db": true, "deploy": false },
  "mcp": { "transport": "http", "endpoint": "/symbiont/mcp", "auth": "bearer" },
  "panel": { "mount": "/symbiont", "mode": "embed" }
}
```

Pola kluczowe dla „tożsamości":
- **`conventions_doc`** — agent czyta zasady tego programu (jego „kulturę").
- **`forbidden_paths`** — czego NIE wolno dotykać (np. `gema-0`, `director.js` w Kebabkiller).
- **`audit_scopes`** — gdzie audytować.
- **`capabilities`** — co wolno (domyślnie tylko audyt; reszta włączana świadomie).

---

## Trzy wpięcia — szczegóły

### 1) Rejestracja + manifest
Moduł przy starcie hosta woła Rdzeń (`POST /hosts/register`) z manifestem + tokenem. Rdzeń weryfikuje
i dodaje do rejestru. Token wiąże host z Rdzeniem (auth dla MCP).

### 2) Panel w UI hosta
Dwa warianty (wg `panel.mode`):
- **embed** — iframe/route do panelu Rdzenia, scoped tokenem hosta (najmniej kodu w hoście).
- **native** — lekki web-component renderowany w UI hosta, gadający z Rdzeniem po API.

Efekt: otwierasz swój program → jest zakładka „Symbiont" → ten sam agent, ale w tożsamości tego programu.

### 3) Serwer MCP hosta
Standaryzowany serwer (stdio lokalnie / HTTP+SSE zdalnie) wystawiający narzędzia hosta. Dzięki MCP
**jeden Rdzeń obsługuje dowolny stack** — host implementuje tylko swój serwer MCP (cienki), reszta
jest wspólna.

---

## Adaptery per stack (żeby „wszystkie oprogramowania")

Moduł ma warianty pod popularne stacki — wszystkie mówią tym samym MCP/manifestem do Rdzenia:

| Stack hosta | Forma modułu |
|-------------|--------------|
| Node/JS (np. Kebabkiller) | pakiet npm `@symbiont/host` + middleware Express |
| Python | pakiet pip `symbiont-host` + ASGI/WSGI mount |
| PHP/Laravel | pakiet composer + service provider |
| Inny | generyczny serwer MCP (kontener sidecar) + manifest ręcznie |

---

## Dlaczego to jest „tożsamość", a nie tylko konfiguracja

Bo na tożsamość składają się **trzy trwałe, wersjonowane** rzeczy w rdzeniu hosta:
1. **Manifest** (kim jest host, jego zasady, granice),
2. **Serwer MCP** (jak host udostępnia siebie agentowi — jego „zmysły"),
3. **Izolowana przestrzeń pracy** (gałęzie/worktree w repo hosta — jego „ręce", bezpiecznie).

Usuwasz moduł → znika tożsamość, host wraca do stanu sprzed instalacji (odwracalność).
