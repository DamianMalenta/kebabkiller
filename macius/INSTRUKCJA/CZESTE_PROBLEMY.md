# 🆘 CZĘSTE PROBLEMY — proste rozwiązania

> Spokojnie. Większość „problemów" to drobiazgi. Tu masz najczęstsze + co kliknąć/napisać.

## „Komenda `git` nie działa / nieznana komenda"
→ Git nie jest zainstalowany albo trzeba zamknąć i otworzyć terminal po instalacji.
Zainstaluj z https://git-scm.com, zamknij terminal, otwórz nowy i spróbuj znowu.

## „Nie wiem, gdzie otworzyć terminal"
→ W Cursorze: menu **Terminal → New Terminal**. Otworzy się na dole. Tam wklejasz komendy.
Upewnij się, że jesteś w swoim folderze `macius` (komenda `cd sciezka/do/macius`).

## „Agent od razu zaczął pisać kod, a ja chciałem tylko plan"
→ Napisz mu: **„Zatrzymaj się. Najpierw plan, bez pisania kodu. Czekam i zatwierdzę."**
Na przyszłość zaczynaj zadanie zdaniem „Najpierw pokaż plan, nie pisz kodu."

## „Czy agent może zmieniać gema0 / kebabkiller?"
→ **Tak.** To lokalne kopie — wolno je przerabiać, ciąć, wyrzucać. Oryginały w repo zostają bezpieczne.
Jedyna prośba: zanim mocno potniesz `gema0`, niech agent **najpierw zrobi audyt** (Krok 3), żebyś
wiedział, co tracisz. I niech **commituje na bieżąco**, żeby dało się cofnąć.

## „Po pobraniu mam w folderze masę plików kebabkillera, których nie chciałem"
→ To normalne, jeśli poszedłeś „grubym" pullem. Najprościej użyj **Drogi B** ze ściągi
(`git checkout ... -- macius`) — ściąga tylko folder `macius`.
Wyjaśnienie i sprzątanie: `../docs/02_MAPA_WORKSPACE.md`.

## „Agent twierdzi coś, czego nie ma w kodzie (zmyśla)"
→ Napisz: **„Nie zgaduj. Pokaż dokładną ścieżkę pliku i cytat, na podstawie którego to mówisz."**
Audyt ma opierać się na faktach z kodu, nie na wrażeniach.

## „Nie rozumiem słowa, którego użył agent"
→ Zajrzyj do [`SLOWNICZEK.md`](SLOWNICZEK.md). Możesz też napisać agentowi:
**„Wytłumacz to prościej, jakbym nie znał się na programowaniu."**

## „Zgubiłem się — nie wiem, na którym kroku jestem"
→ Otwórz `../docs/HANDOFF_AKTUALNY.md` (mówi „co teraz") i
[`00_INSTRUKCJA_GLOWNA.md`](00_INSTRUKCJA_GLOWNA.md) (mapa 5 kroków). Wróć do ostatniego odhaczonego ☑.

## „Boję się, że coś zepsuję"
→ Nie zepsujesz „na żywo". Zasada produktu: zmiany idą przez gałąź i PR, z możliwością cofnięcia
(rollback). A agent domyślnie tylko planuje, dopóki nie napiszesz „OK, rób".

## Wciąż nie działa?
→ Otwórz nowe okno czatu, wklej `../prompts/PROMPT_ONBOARDING.md`, a potem **opisz problem własnymi
słowami** i wklej treść błędu. Agent przeprowadzi Cię dalej.
