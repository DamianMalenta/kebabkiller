# 04. AI Reżyser i Zarządzanie Wiedzą (Knowledge Base)

> Mapa docs: [00_START_TUTAJ.md](00_START_TUTAJ.md) · Stan: [HANDOFF_AKTUALNY.md](HANDOFF_AKTUALNY.md)

## Jak „pamięta” AI Reżyser?

**Nie ma pamięci czatu.** Przy każdym kliknięciu „Pokaż jak zrozumiałeś” backend:
1. Czyta **świeżo** z SQLite: wybraną postać, tło, aktywne reguły
2. Skleja jeden prompt i wysyła do Groq/Gemini (nowe zapytanie, bez historii)
3. Zwraca plan JSON do UI

**Pamięć trwała = Baza Wiedzy** (edycja w UI → zapis w DB → następny request widzi zmiany).

**Obecne ograniczenia (Faza 4.5 to naprawi):**
- JPG referencyjny **nie jest wysyłany** do LLM (tylko tekst opisu)
- `negative_prompt` z karty postaci **nie jest wstrzykiwany** do Groq (jest w DB, brak w kodzie)
- LLM **parafrazuje** opis — planowany **Kanon EN** kopiowany 1:1

## Księga Praw + katalog assetów

| Źródło | Co trafia do Reżysera |
|--------|------------------------|
| Opis postaci (PL) | Tak |
| Opis tła (PL) | Tak |
| Reguły aktywne | Tak |
| `negative_prompt` postaci | **Nie (bug — do naprawy)** |
| Plik JPG | **Nie (Faza 4.5/5)** |

## Przykład postaci Kebabkiller (aktualna wizja)

- **PL (Baza Wiedzy):** dürüm / tortilla wrap, cylinder, dwie nogi, brak rąk/twarzy, sztywna bryła
- **Negative (EN):** `human face, arms, hands, cone-shaped kebab, pita bread…`
- **Scena (Studio, PL):** np. „Kebabkiller potyka się i leży na blacie”

## Jak unikać nieporozumień?

1. Edytuj postać przez **Edytuj** (nie duplikuj nazwy „Kebabkiller”).
2. Sprawdź plan w Studio — pole **Źródło AI** musi być `groq`, nie `mock`.
3. Po zmianie opisu kliknij podgląd **od nowa** (stary plan obok formularza się nie odświeża sam).
4. Koniec sesji → napisz agentowi **`HANDOFF`** ([AGENT_PROTOCOL.md](AGENT_PROTOCOL.md)).
