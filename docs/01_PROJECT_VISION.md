# 01. Wizja Projektu: Kebabkiller Studio

> ⚠️ **LEGACY** — źródło prawdy = `docs/11_OPUS_ARCHITECTURE_PROPOSAL.md` + realny kod. Tabela statusów poniżej jest **nieaktualna** (Plan odcinka + Scenarzysta + Reżyser pod plan — już zrobione w Fazach A–B). Wizja produktu wchłonięta do docs/11.

## Czym jest projekt?

**Kebabkiller Studio** — oprogramowanie do tworzenia **serialu viralowych odcinków** 9:16 (TikTok, YouTube Shorts, Reels, Facebook) z postacią Kebabkiller.

Twórca wchodzi do panelu i — wspólnie z **Pomocnikiem / Scenarzystą** — planuje odcinek. Po **jednej akceptacji planu** system generuje **spójne klipy** do montażu na zewnątrz.

**Pełna wizja pipeline’u:** [05_EPISODE_PIPELINE.md](05_EPISODE_PIPELINE.md)  
**Limity silnika:** [CAPABILITIES.md](CAPABILITIES.md)

---

## Kto jest użytkownikiem?

Twórca serialu, który:
- ma pomysł na odcinek (~30–60 s, typowo 45 s),
- współpracuje ze Scenarzystą przy planie,
- wrzuca brakujące zdjęcia do katalogu,
- akceptuje plan i pobiera paczkę klipów do montażu.

---

## Trzy filary produktu

1. **Katalog główny** — biblioteka zdjęć i opisów (postacie, tła, rekwizyty).
2. **Plan odcinka** — pierwszy ekran pracy; wybór z katalogu, preferencje, sceny, lista „do dostarczenia”.
3. **Paczka produkcyjna** — spójne klipy + manifest montażowy po akceptacji planu.

---

## Role AI

| Rola | Odpowiedzialność |
|------|------------------|
| **Scenarzysta** | Plan odcinka z twórcą: fabuła, podział na sceny, wybór z katalogu, lista braków materiałów, recenzja klipów |
| **Reżyser produkcji** | Po akceptacji planu: parametry techniczne, prompty GPU, render kolejki scen — bez angażowania twórcy w technikę |

---

## Kluczowe założenia

1. **Plan pierwszy** — nie render, dopóki plan nie jest zaakceptowany i kompletny materiałowo.
2. **Spójność serialu** — Kebabkiller i świat z katalogu; jeden profil wizualny na odcinek.
3. **1 beat = 1 scena = 1 plik** — montaż składa odcinek z wielu klipów.
4. **Hybrydowe podejście** — panel twórcy + AI; montaż końcowy u twórcy (DaVinci, CapCut).
5. **Bez przepalania GPU** — mock na etapie planu; render po akceptacji.

---

## Stan implementacji (skrót)

| Obszar | Status |
|--------|--------|
| Wizja pipeline’u odcinka | ✅ udokumentowana (`05_EPISODE_PIPELINE.md`) |
| Pojedynczy klip (legacy Studio) | ⚠️ kod istnieje; wymaga profilu I2V + stabilnego RunComfy |
| Plan odcinka + Scenarzysta + katalog | ❌ F1 — do zrobienia |
| Reżyser pod plan | ❌ F2 — do zrobienia |

Operacyjnie: [HANDOFF_AKTUALNY.md](HANDOFF_AKTUALNY.md) · [03_AGENT_STATE_AND_TASKS.md](03_AGENT_STATE_AND_TASKS.md)
