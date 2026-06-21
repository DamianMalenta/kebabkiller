# 02. Architektura Systemu

> ⚠️ **LEGACY** — źródło prawdy = `docs/11_OPUS_ARCHITECTURE_PROPOSAL.md` + realny kod. Ten plik opisuje starą architekturę (Groq jako główny provider, green-screen compositing). Aktualna architektura: deterministyczny Reżyser (zero LLM w torze renderu), composite przez depth + IP-Adapter (green-screen odrzucony — docs/11 sekcja C).

System dzieli się na 3 główne warstwy:

## 1. Frontend (Panel Twórcy / Studio UI)
Prosta, nowoczesna aplikacja webowa (np. React + Vite / Tailwind).
- **Widok Promptu:** Pole tekstowe do wpisania sceny (np. "Kebabkiller tańczy na Marsie").
- **Asset Manager (Zarządzanie Złotymi Assetami):** Biblioteka postaci i teł. Możliwość dodania nowego tła ze zdjęciem referencyjnym.
- **Księga Praw (Knowledge Base):** Miejsce, w którym definiujemy i edytujemy wiedzę AI Reżysera (np. wpisujemy "Jeśli Kebabkiller używa magii, jego oczy muszą świecić na zielono").
- **Podgląd / Historia:** Zatwierdzanie wyników, pobieranie gotowych filmów.

## 2. Backend (Orkiestrator & AI Reżyser)
Aplikacja Node.js (Express) + SQLite (`node:sqlite`).
- **AI Reżyser:** łańcuch providerów Gemini → Groq → OpenAI → Anthropic → mock (`backend/src/ai/director.js`). Wymaga `GROQ_API_KEY` (prefiks `gsk_`) w `.env`; SSL: `node --use-system-ca` w `backend/package.json`.
- **Kolejkowanie zadań:** asynchroniczne joby wideo + mock engine (Faza 5: Wan 2.1 / ComfyUI).
- **Baza danych:** SQLite — postacie, tła, reguły, `video_jobs`, ścieżki do uploadów.

## 3. Silnik Renderujący (Video Engine - ComfyUI Serverless / Wan 2.1)
Zewnętrzny lub lokalny serwer obsługujący modele wideo.
- **Technologia API:** Backend wysyła zadanie JSON do API (np. ComfyUI lub Replicate).
- **Architektura Generacji:** Wykorzystuje IP-Adaptery, ControlNet dla póz lub natywne Image-to-Video. 
- **Zasada działania Compositingu (Tło + Postać):** Jeśli chcemy podmieniać tła na dowolne z Asset Managera, modele wideo często "pływają" jeśli próbujemy wymusić 100% zgodności tła tekstowego i obrazowego. Architektura rezerwowa to zielony ekran: generujemy Kebabkillera na prostym tle, odcinamy i komponujemy programowo z idealnym tłem w pożądanej lokalizacji, co daje gwarancję 100% stabilnego tła i elastyczność dodawania dowolnych miejsc. System AI Reżysera może decydować, które rozwiązanie (full render vs green-screen) jest optymalne.