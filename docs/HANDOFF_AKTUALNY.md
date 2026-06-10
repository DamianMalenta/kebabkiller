# HANDOFF AKTUALNY — stan na teraz

**Ostatnia aktualizacja:** 2026-06-09 (sesja planowania pipeline’u)  
**Sesja:** planowanie produktowe (bez zmian kodu)

---

## ZŁOTA ZASADA (Nie zmieniać)

Nie usuwać `director.js`, `mockEngine.js`, `runComfyEngine.js`.  
`wan_workflow_api.json` = lokalny szablon; Studio wysyła pełny `workflow_api_json` (bez node 51).  
Deployment RunComfy = środowisko GPU + modele; **My Workflows w panelu nie jest wymagane** do API ze Studia.

---

## TL;DR

- **Wizja produktu zapisana:** [05_EPISODE_PIPELINE.md](05_EPISODE_PIPELINE.md) + [CAPABILITIES.md](CAPABILITIES.md) + zaktualizowany [01_PROJECT_VISION.md](01_PROJECT_VISION.md).
- **Kierunek:** Plan odcinka (Ty + Scenarzysta) jako pierwszy krok → akceptacja → Reżyser produkcji → spójne klipy + manifest montażowy.
- **Kod:** bez zmian w tej sesji; legacy Studio + RunComfy freeze WAN21 nadal aktualny technicznie.
- **Następna implementacja:** F1 (plan + Scenarzysta + katalog), potem F0 (silnik klipu), F2 (Reżyser pod plan).

---

## Wizja w jednym akapicie

Katalog główny → **Plan odcinka** (wybór z katalogu, preferencje, sceny, lista „do dostarczenia”) → **akceptacja** → **Reżyser produkcji** (auto: klatki, prompty, render) → paczka `E01_SC*.webm` + manifest. Odcinek 45 s = wiele klipów (2–10 s każdy), montaż u twórcy.

---

## Co zrobić jako pierwsze (gdy „OK, rób”)

1. **F1:** model danych + UI planu odcinka + Scenarzysta + sekcja braków materiałów.
2. **F0 równolegle / zaraz po:** profil I2V_PRODUCTION, lżejszy RunComfy, smoke WEBM.
3. **F2:** Reżyser produkcji czytający zaakceptowany plan.

---

## Stan techniczny (legacy — bez zmian)

| Element | Status |
|---------|--------|
| Groq / `POST /api/director/preview` | ✅ |
| RunComfy payload / polling | ✅ |
| Żywy WEBM po fixie deploymentu | ❌ GPU freeze WAN21 |
| Plan odcinka / Scenarzysta / katalog w UI | ❌ F1 |
| Reżyser pod plan | ❌ F2 |

---

## Prompt do nowego czatu

```text
Kebabkiller Studio — wizja w docs/05_EPISODE_PIPELINE.md.

Przeczytaj HANDOFF_AKTUALNY.md i 05_EPISODE_PIPELINE.md.
Kontynuuj od F1 (plan odcinka + Scenarzysta + katalog) lub F0 (silnik klipu) — według priorytetu właściciela.
```

**Koniec sesji:** `HANDOFF`

---

## Dokumentacja wizji

| Plik | Zawartość |
|------|-----------|
| [05_EPISODE_PIPELINE.md](05_EPISODE_PIPELINE.md) | Pełna wizja: plan, role, flow, MVP, fazy |
| [CAPABILITIES.md](CAPABILITIES.md) | Limity silnika (klatki, czas, zasady scen) |
| [01_PROJECT_VISION.md](01_PROJECT_VISION.md) | Skrót wizji |
| [03_AGENT_STATE_AND_TASKS.md](03_AGENT_STATE_AND_TASKS.md) | Roadmapa F0–F3 |
