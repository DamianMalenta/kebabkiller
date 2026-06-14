# 🗒️ ŚCIĄGA — wszystko na jednej stronie

> Wydrukuj lub trzymaj otwarte obok. Pełna wersja: [`00_INSTRUKCJA_GLOWNA.md`](00_INSTRUKCJA_GLOWNA.md).

## Układ na dysku
```
macius/
├── kebabkiller/   (wrzucasz)
├── gema0/         (wrzucasz)
└── macius/        (pobierasz architekturę)
```

## Pobranie architektury (Droga B — Git)
```bash
git init
git remote add zrodlo https://github.com/DamianMalenta/kebabkiller.git
git fetch zrodlo cursor/macius-infra-6fb4
git checkout zrodlo/cursor/macius-infra-6fb4 -- macius
git remote remove zrodlo
```
(Droga A = pobierz ZIP gałęzi z GitHuba i skopiuj sam folder `macius`.)

## 3 złote zdania do agenta
1. „Najpierw pokaż plan, nie pisz kodu."
2. „OK, rób." (gdy plan pasuje)
3. „To kopie — możesz przerabiać, ale najpierw audyt." (gema0/kebabkiller wolno ciąć; oryginały bezpieczne)

## Kolejność działań
| Krok | Co robisz | Gotowy prompt |
|------|-----------|---------------|
| 1 | Audyt gema0 | `../prompts/PROMPT_AUDYT_GEMA0.md` |
| 2 | Decyzja o fuzji | `../prompts/PROMPT_FUZJA.md` |
| 3 | Onboarding nowego okna (zawsze) | `../prompts/PROMPT_ONBOARDING.md` |

## Gdzie co ląduje
- Raporty audytu → `macius/audyty/`
- Decyzje (ADR) → `macius/decyzje/`
- Stan „co teraz" → `macius/docs/HANDOFF_AKTUALNY.md`

## Zasada bezpieczeństwa
- Lokalne kopie (`gema0/`, `kebabkiller/`) → **przerabiaj śmiało** (oryginały w repo bezpieczne); commituj, by móc cofnąć.
- Żywa produkcja (wdrożony produkt) → agent **nigdy** nie zmienia jej wprost: gałąź → testy → PR → rollback.
