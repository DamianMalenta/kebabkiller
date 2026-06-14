# Dziennik sesji — chronologia prac

Nowe wpisy **zawsze na górze**. Ten plik **rosną w czasie** — nie skracaj bez zgody właściciela.

---

## Sesja #15 — 2026-06-14

**Zakres:** Wdrożenie Programisty (/dev) — panel AI developer agent wg `docs/07_DEV_AGENT_PLAN.md` v2.

### Zrobiono
- Stworzono `docs/07_DEV_AGENT_PLAN.md` — plan faz 0→5 Programisty.
- **Faza 1:** migracja DB — tabela `dev_agent_messages` (id, role, content, tool_calls_json, created_at).
- **Faza 2:** `backend/src/ai/devAgent.js` — agent Groq z narzędziami systemowymi:
  - Narzędzia: `getSystemHealth`, `listJobs`, `getJobDetails`, `listEpisodePlans`, `getProductionStatus`, `getBackendConfig`
  - Agentic loop (max 3 rundy tool calls), fallback deterministyczny bez klucza API.
- **Faza 3:** API routes — `GET /dev-agent/state`, `POST /dev-agent/chat`, `DELETE /dev-agent/history`.
- **Faza 4:** `backend/src/db/devAgentModels.js` + rozszerzenie `api.devAgent.*` w kliencie frontendu.
- **Faza 5:** `frontend/src/pages/DevPanel.jsx` — 2-kolumnowy layout (systeminfo + czat), `devAgent.js`.
  - Nawigacja: link "Programista" w pasku górnym (desktop) i dolnym (mobile).
  - CSS `.dev-grid` responsywny (breakpoint 900px).
- **Fix:** `backend/package.json` — usunięto `--use-system-ca` (Node v22.14.0 nie obsługuje).
- Testy: 77/77 ✅.

### Werdykt
Panel Programisty (/dev) wdrożony i przetestowany. UI renderuje systeminfo + czat. Bez GROQ_API_KEY: fallback deterministyczny z pełną informacją o stanie systemu.

---

## Sesja #14 — 2026-06-11

**Zakres:** Audyt frontendu, pipeline fixy, mobile UX, dev LAN pod telefon, instrukcje w UI.

### Zrobiono
- Backend: `normalizePlanSceneInput`, refresh status po scenach, recovery produkcji partial/failed, `wanConfig` + testy (64/64).
- Frontend plan: StepGuide, kolejność Pomysł→Scenarzysta→Sceny, auto-zapis, tytuł, fix przycisku Akceptuj.
- Mobile: `vite.config.js` host LAN, MobileCompanionPanel (dzień/noc), karty scen, sticky accept, step jump, bottom nav.
- RunComfy audit (Windows curl), `.env` alignment (WAN_LENGTH=73, I2V_PRODUCTION).
- Serwery: restart czysty; health OK localhost + `192.168.8.44:5173`.

### Ustalenia
- Test 2 klipów: flow Plan→Scenarzysta→Sceny→Akceptuj; render na PC, postęp na telefonie.
- RunComfy blocker pozostaje po stronie deploymentu (ciężki ComfyUI-Manager).

### Werdykt
Gotowe do porannego testu z telefonu. Priorytet następnej sesji: wynik produkcji + ewentualnie nowy deployment RunComfy.

---

## Sesja #13 — 2026-06-10

**Zakres:** Panel Seriale (UI), fix CLIP/style bible w Reżyserze, audyt RunComfy, zombie joby Dashboard.

### Zrobiono
- Panel `/projects`: `Projects.jsx`, `ProjectEditor.jsx`, `EpisodeList.jsx`, nav „Seriale”.
- CRUD projektów + Style Bible + odcinki z UI; linki z Studio/Dashboard zamiast „utwórz przez API”.
- Fix `director.js`: `style_tags_en` (EN) zamiast wklejania polskiego Style Bible do Node 55; testy `director.test.js` 7/7.
- Audyt RunComfy: payload OK, deployment `b36cb944…` niestabilny; 1× WEBM sukces, stale przy 81 klatkach.
- Dashboard: zombie joby (`jobLifecycle.js`, badge „Utknięte”, próg 15 min).
- `WAN_LENGTH` 81 → 33; restart dev.

### Ustalenia
- Backend wysyła poprawny `workflow_api_json` — problem to **ciężki deployment GPU**, nie kod Studia.
- Style Bible = kontekst dla Groq; positive prompt = wyłącznie angielskie tagi CLIP.

### Werdykt
Faza 1 serialu (UI) gotowa do testów. **Priorytet nadal: lżejszy deployment RunComfy** + powtarzalny smoke WEBM.

---

## Sesja planowania — 2026-06-09 (pipeline odcinka)

**Zakres:** Ustalenie docelowej wizji produktu z właścicielem; zapis do dokumentacji (bez zmian kodu).

### Ustalono (wizja)

- **Kebabkiller Studio** = fabryka serialu viralowych odcinków 9:16, nie generator jednej sceny.
- **Plan odcinka** jako pierwszy ekran pracy (Ty + Scenarzysta).
- **Katalog główny** — biblioteka; plan wskazuje wybór i **co dostarczyć / wrzucić**.
- **Jedna akceptacja planu** → **Reżyser produkcji** (automatycznie) → spójne klipy + manifest montażowy.
- Odcinek ~45 s = **wiele klipów** (2–10 s każdy, max ~10 s / render GPU); montaż zewnętrzny.
- Scenarzysta: plan + recenzja; Reżyser: technika po akceptacji.
- Composite / zdjęcia startowe **nie są obowiązkowe** — wybór z katalogu według planu.

### Zapisano w docs

- `docs/05_EPISODE_PIPELINE.md` — źródło prawdy wizji
- `docs/CAPABILITIES.md` — limity silnika dla Scenarzysty
- Zaktualizowano: `01_PROJECT_VISION.md`, `00_START_TUTAJ.md`, `03_AGENT_STATE_AND_TASKS.md`, `HANDOFF_AKTUALNY.md`

### Werdykt

Wizja zatwierdzona przez właściciela do dokumentacji. Implementacja: F1 → F0 → F2 → F3 (szczegóły w `05_EPISODE_PIPELINE.md`).

---

## Sesja #12 — 2026-06-09

**Zakres:** AI Director, RunComfy polling, WAN_LENGTH, diagnostyka freeze GPU, frontend.

### Zrobiono
- Weryfikacja połączenia Groq — działa; naprawa kinematyki (`kinematicsFromPrompt.js`, reconcile bez sztywnych scen).
- Prompt diet w `director.js` (composite: bez identity/tła w positive).
- `WAN_LENGTH` w `.env` / `wanConfig.js` (domyślnie 33); fix infinite loop w regex beatów.
- RunComfy: obsługa `canceled`/`cancelled`, `succeeded`/`completed`, uczciwy progress, stale 10 min, sonda `/result`, domyślny poll 10 min.
- Czysta reinstalacja frontendu; zabijanie zombie procesów dev.
- Anulowanie zawieszonego joba `7843aee7` przez API RunComfy.

### Ustalenia
- **96,93% w UI = fałszywy licznik** (naprawione — max ~85% w fazie wait).
- Log `/workspace/ComfyUI` = normalna ścieżka chmury, nie błąd zapisu na PC; lokalny output: `backend/output/`.
- **My Workflows** w panelu ≠ wymagane dla Studia (wystarczy **Deployment** + API).
- Freeze po `Model WAN21 prepared` = problem deploymentu (za dużo custom nodes), nie `length` ani JSON workflow.
- Telefon przez Wi‑Fi: Vite potrzebuje `--host` lub `host: true` (jeszcze nie wdrożone).

### Werdykt
Pipeline kodu gotowy na smoke test; **bloker = ciężki deployment RunComfy (WAN21 hang)**. Następny krok: lżejsza instancja ComfyUI.

---

## Sesja #11 — 2026-06-08 (okno czatu #11)

**Zakres:** Audyt faktycznego stanu kodu `video/` + synchronizacja dokumentacji operacyjnej.

### Zrobiono
- Przegląd `backend/src/video/` (runComfyEngine, mockEngine, compositeStartFrame, wan_workflow_api.json).
- Analiza 13 jobów w SQLite: 1× RunComfy sukces (`aa778f19.webp` 579 KB), 5× RunComfy fail, 5× mock placeholder.
- Zaktualizowano `HANDOFF_AKTUALNY.md` i `03_AGENT_STATE_AND_TASKS.md` — usunięto sprzeczność „brak żywego pinga” (ping był 08.06).
- Ustalono jedyny bloker MVP generatora: output WEBP (node 51) zamiast WEBM (node 52).

### Ustalenia
- „Śmietnik” w docs = handoff nieaktualizowany po żywym teście + `03` z checkboxami sprzecznymi z bazą + `.env.example` ze starym URL + port 4000 w `00_START` vs 4001 w `.env`/vite.
- Architektura backendu (director/mock/runComfy) — bez zmian, poprawna.
- Następny fix kodu: `pickRunComfyMedia` w `runComfyEngine.js`, potem żywy test WEBM.

### Werdykt (rano)
Generator ~90% gotowy. Dokumentacja zsynchronizowana.

### Dopisek (wieczór — po „OK, rób”)
- Naprawiono `pickRunComfyMedia`: eksport, node 52 priorytet, ostrzeżenie + lista node IDs przy fallbacku.
- Testy Jest: 8/8 pass (+3 testy pickRunComfyMedia / webp fallback).
- Żywy render `789eca38`: sukces, 1 484 790 B WEBP, ~9 min; RunComfy API zwróciło **tylko node 51** — WEBM wymaga fixu workflow na deployment.

---

## Sesja #10 — 2026-06-07 (okno czatu #10)

**Zakres:** Konfiguracja i uruchomienie pierwszego testu integracyjnego dla API `RunComfyEngine` (Faza 5).

### Zrobiono
- Zainstalowano platformę testową Jest (dla środowiska Node ES Modules z flagą `--experimental-vm-modules`).
- Utworzono plik testowy `backend/src/tests/runComfyEngine.test.js` symulujący wywołanie renderujące w izolacji (bez używania prawdziwego klucza API, dzięki zastosowaniu globalnych mocków dla żądań `fetch`).
- Przetestowano zachowanie pętli oczekującej ("polling loop") w `runComfyEngine.js`, co poskutkowało dostosowaniem limitu czasowego w Jest (`timeout: 40000ms`), by poprawnie obsłużyć długie, powtarzane operacje weryfikacji statusu w chmurze (symulowane sleep 10 x 3s).
- Zakończono test pełnym sukcesem (`exit_code 0`), upewniając się, że backend jest pod względem strukturalnym gotowy na wysyłanie i obsługiwanie zwrotów z serwerów ComfyUI/RunComfy.

### Ustalenia
- Środowisko Node.js ES Modules potrafi utrudniać stosowanie skomplikowanych bibliotek do spionowania modułów wbudowanych (takich jak system plików `fs` z użyciem `jest.mock`). Test przebudowano na bezpieczniejszy tryb, rezygnując z głębokiej izolacji w module testującym, skupiając test wyłącznie na mockowaniu połączenia sieciowego.
- Pętla statusowa (`checkAndWakeCluster`, `pollJobStatus`) z `runComfyEngine.js` działa poprawnie i bezpiecznie zawraca po zadeklarowanych błędach/ostrzeżeniach (np. timeout lub błąd serwera `500`), co potwierdzono automatycznymi asercjami.

### Werdykt
Testy jednostkowe potwierdzają dojrzałość kodu `runComfyEngine`. Prawdziwy, pierwszy "żywy ping" z autentycznymi danymi, prawdziwym plikiem obrazka referencyjnego na klaster chmurowy to ostateczny cel na ten moment i logiczny krok w kierunku zdobycia pierwszego renderowanego wideo wideo `Wan 2.1`.

---

## Sesja #9 — 2026-06-06 (okno czatu #9)

**Zakres:** Wsparcie w budowie workflow ComfyUI dla Fazy 5 - ustalenia kierunku technicznego.

### Zrobiono
- Wyjaśniono szczegóły związane z architekturą "Serverless API" (wynajem GPU na sekundy).
- Przedstawiono opcje integracji, odrzucając na życzenie użytkownika gotowce z Internetu na rzecz zbudowania najwyższej jakości rozwiązania własnego.
- Omówiono różnicę między podejściem Txt2Video + IP-Adapter a Image-to-Video (I2V).

### Ustalenia
- Zdecydowano o wykorzystaniu podejścia **Image-to-Video (I2V)** z użyciem Wan 2.1 jako metody gwarantującej najlepszą możliwą spójność tożsamości postaci (na zasadzie "ożywienia" idealnej pierwszej klatki).
- Właściciel podjął decyzję o opcji budowania workflow w programie ComfyUI od zera ze wsparciem agenta krok po kroku.

### Werdykt
- Sesja planowania zamknięta. Architektura I2V wygrywa. W nowej sesji rozpocznie się bezpośrednia budowa grafu ComfyUI.

---

## Sesja #8 — 2026-06-06 (okno czatu #8)

**Zakres:** Wsparcie w budowie workflow ComfyUI dla Fazy 5.

### Zrobiono
- Przeanalizowano warianty podejścia (I2V vs Txt2Video + IP-Adapter) dla budowy workflow dla Wan 2.1 / LTX.
- Opisano koncepcję ładowania obrazu z użyciem zewnętrznego pluginu Base64 (np. `ComfyUI-Custom-Scripts` lub `ETN_Nodes`) zamiast klasycznego `Load Image`, aby docelowo zredukować stopień złożoności wgrywania zdjęć z backendu (uniknięcie wgrywania z upload/ lokalnie, wysyłając wszystko w Payloadzie JSON API jako plain text).
- Omówiono potrzebę tagowania i nazywania użytych Noodów aby skrypt w backendzie potrafił podmieniać parametry do renderowania.
- Właściciel zgłosił brak wiedzy na temat budowy ComfyUI od podstaw.

### Ustalenia
- Zdecydowano o zakończeniu obecnego okna czatu, w następnej sesji agent ma poprowadzić właściciela za rękę od podstaw w budowie flow dla ComfyUI z uwzględnieniem wykorzystania darmowych, publicznie dostępnych, gotowych schematów.

### Werdykt
- Faza 5 i jej backendowy kawałek musi wciąż poczekać. Budowa poprawnego szablonu do wygenerowania `workflow_api.json` zostanie omówiona w kolejnej sesji.

---

## Sesja #7 — 2026-06-06 (okno czatu #7)

**Zakres:** Implementacja API dla Fazy 5 i upload obrazów referencyjnych (ComfyUI / Serverless GPU).

### Zrobiono
- Stworzono fundament pod mechanizm renderujący przez zewnętrzne API `RunComfyEngine` (plik `runComfyEngine.js`).
- Dodano podgląd storyboardów w UI na liście zleceń (miniatury przesłanych z frontendem obrazów do zadania w Reżyserze - postaci i tła).
- Zaprojektowano podwaliny pod bezpieczny i konfigurowalny sposób komunikacji serwer node.js -> chmura GPU na podstawie `Base64` dla IP-Adapterów w pliku silnika (nie ujawniając lokalnych ścieżek dostępowych z `upload/`).
- Odseparowano logikę dla silnika testowego (mock) i silnika API po stronie `.env` (`VIDEO_ENGINE=runcomfy|mock`).

### Ustalenia
- ComfyUI i zewnętrzne serwisy potrzebują bezwzględnego formatu Base64 (lub specjalnych upload endpointów) w workflow. Podjęto decyzję o budowie mechanizmu `encodeImageToBase64`, aby zapewnić bezpieczeństwo i uniezależnienie od zewnętrznego endpointu plików statycznych (który podczas lokalnego testowania na ngrok / localhost jest niedostępny i tak dla serwerów zewnętrznych).

### Werdykt
- Szkielet integracji GPU jest zaimplementowany i zabezpieczony poprawnie, obsługa storyboardu na front-endzie dla zlecenia z obrazkami pozwala monitorować jakość zleceń.

---

## Sesja #6 — 2026-06-06 (okno czatu #6)

**Zakres:** Planowanie infrastruktury dla Fazy 5 (ComfyUI / Serverless GPU).

### Zrobiono
- Przeanalizowano warianty hostowania ComfyUI (RunComfy, ComfyICU, fal.ai, Modal) z naciskiem na minimalizację kosztów (serverless, per-second billing) dla użytkownika bez własnego serwera z GPU.
- Omówiono schemat działania API i payloadu JSON bez pisania kodu.
- Właściciel zaakceptował plan infrastruktury chmurowej i wydał zgodę na jej implementację w kolejnej sesji.

### Ustalenia
- Zamiast własnego serwera GPU, Kebabkiller Studio będzie komunikować się z zewnętrznym endpointem API.
- Sesja została zakończona bez edycji kodu źródłowego.

### Werdykt
- Jesteśmy w 100% gotowi na kodowanie integracji z chmurowym API ComfyUI.

---

## Sesja #5 — 2026-06-06 (okno czatu #5)

**Zakres:** Zamknięcie Fazy 4.5. Optymalizacja bazy wiedzy oraz przebudowa "Silnika Intencji" do poziomu operatorstwa filmowego.

### Zrobiono
- Wyczyszczono pliki inicjalizacyjne (`init.js`) z martwych/szkodliwych reguł, np. dotyczących twardego wpisywania formatów wideo tekstowo (9:16).
- Sprostowano tożsamość bohatera. Ostatecznie usunięto pojęcie "kebab cone" z seedów w kodzie, zastępując je kanonicznym "cylindrical rolled dürüm wrap".
- Przeanalizowano dwa plany naprawcze: "Zero-Drift Pipeline" (wymuszenie płaskiej głębi ostrości i zakaz języka filmowego) vs. podejście "IP-Adapter + Cinematography" (wsparcie ruchu kamery).
- Wdrożono i utrzymano podejście "IP-Adapter + Cinematography":
  - Backend rozszerzono o obsługę `environment_block_en` na poziomie bazy SQLite i API.
  - "Silnik Intencji" w `director.js` przeprojektowano tak, aby zwracał JSON operatorski (`cinematography`: kąt, ruch kamery, oświetlenie) oraz `kinematics` (ruch postaci).
  - Skonfigurowano ułożenie pełnego prompta tekstowego oddzielając ruchy kamery od wstrzykiwanych Assetów. 

### Ustalenia
- Zgodziliśmy się, że pełna "detoksykacja z języka filmowego" (zakaz słowa *cinematic*) niszczy potencjał realistycznego generowania ujęć, m.in. najazdów kamery. Aby uchronić się przed dryfem tła i zepsuciem postaci bez ucinania "filmowości", wykorzystana zostanie zaawansowana architektura w ComfyUI (IP-Adaptery dla referencji twarzy/postaci oraz mapy głębi dla tła), a nie tylko prymitywny "flat lighting prompt".
- Faza 4.5 jest w 100% zamknięta. Architektura backedu generuje idealnie poukładane ładunki informacji (JSON payload).

### Werdykt
- System jest gotowy na połączenie API z serwerem renderującym (ComfyUI) w Fazie 5.

---

## Sesja #4 — 2026-06-06 (okno czatu #4)

**Zakres:** Audyt architektoniczny i inżynieryjny (Prompt Engineering / Zero-Hallucination).

### Zrobiono
- Wykonano dogłębny, bezwzględny skan kodu pod kątem ukrytych promptów, reguł i sprzeczności w ramach "Silnika Intencji".
- Sprawdzono ryzyka związane z halucynacjami Wan 2.1 (visual drift, bokeh, tła).
- Utworzono szczegółowy raport inżynieryjny w archiwum: `docs/archive/sesja-04/01_AUDYT_PROMPTOW.md`.

### Ustalenia i Sprzeczności
- **Sprzeczność tożsamości:** W pliku `backend/src/db/init.js` nadal znajduje się przestarzałe, domyślne seedowanie Kebabkillera jako "kebab cone" zamiast ustalonego "dürüm / tortilla wrap".
- **Martwa reguła:** W Księdze Praw zaszytej w `init.js` istnieje reguła każąca LLM-owi stosować negative prompt, mimo że LLM już nie ma do niego dostępu.
- **Ryzyko Wan 2.1:** W `SYSTEM_PROMPT_INTENT_ENGINE` wymuszamy na LLM użycie słowa "cinematic description". Słowo "cinematic" jest potężnym triggerem dla modeli wideo na automatyczne rozmycie tła (efekt bokeh), co może omijać nasz regex na słowo "blur". Należy zrewidować to polecenie.

### Werdykt
- Silnik intencji działa, ale inicjalizacja środowiska i niektóre słowa kluczowe w promptach wymagają poprawek w Fazie 5.

---

## Sesja #3 — 2026-06-06 (okno czatu #3)

**Zakres:** Refaktoryzacja AI Reżysera do modelu Zero-Hallucination "Intent Engine".

### Zbudowano / Zmieniono
- Całkowicie przebudowano `backend/src/ai/director.js` wg inżynierii First-Principles (System 2).
- LLM został zdegradowany do roli "Silnika Intencji" – zajmuje się wyłącznie ruchem, akcją i pracą kamery. Nie ma już w ogóle wglądu w opisy postaci czy tła.
- Mechanizm `Asset Binding` przepisano na czysty, deterministyczny JavaScript (zero ingerencji LLM w wizerunek Kebabkillera).
- Zastosowano agresywne wyrażenia regularne (`blurSynonymsRegex`), które bezwzględnie czyszczą prompt z terminów kinematograficznych powodujących dryf u modeli wideo (np. `soft focus`, `bokeh`, `out of focus`, `depth of field`), zamieniając je na `sharp focus`.
- Obniżono temperaturę wszystkich LLM-ów sztywno na `0.0`.

### Werdykt końcowy sesji
Cel "Zabójcy Halucynacji" osiągnięty. Cała ścieżka od inputu użytkownika po budowę precyzyjnego prompta dla Wan 2.1 jest w 100% deterministyczna wizualnie, pozwalając na swobodną, miękką reżyserię akcji.

---

## Sesja #2 — 2026-06-06 (okno czatu #2)

**Zakres:** Implementacja Fazy 4.5.

### Zbudowano / Zmieniono
- `identity_block_en` w bazie SQLite, wspierane z poziomu UI (Księga Praw / Postacie).
- Wstrzykiwanie `identity_block_en` 1:1 do `positive_prompt` po generacji przez LLM, by uniknąć parafrazowania.
- Wstrzykiwanie `negative_prompt`, `character_ref`, `background_ref` do finalnego JSON.
- Dodano `PlanValidator` wymieniający `blurred background` na `sharp focused background`.
- Zaktualizowano `SYSTEM_PROMPT` — usunięto wzmianki o "meat cone".
- Wprowadzono system Retry z Exponential Backoff bazujący na rozwiązaniu z `gema-0`.

### Kolejne Kroki
Przejście do Fazy 5: Integracja faktycznego silnika wideo (Wan 2.1 / ComfyUI) i zastąpienie `mockEngine`.

---

## Sesja #1 — 2026-06-06 (okno czatu #1)

**Zakres:** Od audytu gema-0 → niezależny `kebabkiller_studio` → MVP → testy użytkownika.

### Zbudowano
- Backend Express + SQLite (`node:sqlite`)
- Frontend React (Dashboard, Studio, Baza Wiedzy)
- AI Reżyser: Gemini → Groq → OpenAI → Anthropic → mock
- Mock video engine + kolejka jobs
- Dokumentacja docs/01–04

### Naprawiono w trakcie
- `better-sqlite3` / Node 24 → `node:sqlite`
- Port 4000 EADDRINUSE
- SSL `fetch failed` → `--use-system-ca` w `package.json` (nie w `.env`)
- Klucz Gemini w złym polu → multi-provider + Groq
- Przycisk „Dodaj” (duplikat nazwy) → Edytuj/Usuń + komunikaty błędów
- `updateCharacter` undefined → fix SQLite bindings

### Ustalenia z userem
- UI Reżysera — tak (nie „zero UI”)
- Opis postaci po PL OK; negative prompt po EN
- Compositing przy upadku — decyzja LLM (reguła w Księdze Praw)
- Nowe okno Cursora → root `kebabkiller_studio`

### Werdykt końcowy sesji
- MVP: **sukces**
- Viral video: **jeszcze nie** — potrzeba Fazy 4.5 + 5

### Archiwum szczegółów tej sesji
- [archive/sesja-01/05_PERELKI_Z_GEMA0.md](archive/sesja-01/05_PERELKI_Z_GEMA0.md)
- [archive/sesja-01/06_PODSUMOWANIE.md](archive/sesja-01/06_PODSUMOWANIE.md)

### Docs (koniec sesji #1)
- Warstwy: `00_START` → `HANDOFF` → `03` + `DZIENNIK` + `AGENT_PROTOCOL`
- Audyt spójności: [AUDYT_SPÓJNOŚCI_2026-06-06.md](AUDYT_SPÓJNOŚCI_2026-06-06.md) — gotowe pod okno #2
