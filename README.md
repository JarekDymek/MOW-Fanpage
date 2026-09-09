# MOW Fanpage

Samodzielna PWA do przekazywania materiałów z MOW do ręcznej publikacji na Facebooku. Odzyskana lokalnie 7 września 2026 z repozytorium `JarekDymek/MOW-Fanpage` (punkt wyjścia `e271fd514fa0ca679a8669e8711501a561b478da`) i rozmowy „Przygotuj formularz MOW”. Wydanie 1.1.0 przygotowane 9 września 2026 na wyraźne zlecenie publikacji.

## Role i przebieg

1. Wychowawca otwiera `/wychowawca/`, loguje się linkiem e-mail i uzupełnia profil: imię i nazwisko, funkcja, miejsce pracy, opcjonalna grupa. Moderator jest nadawany po stronie bazy.
2. Dodaje tekst, 1–15 zdjęć, wybiera oryginał lub redakcję z akceptacją, określa status wizerunku i zaznacza pięć potwierdzeń. Zdjęcia są przetwarzane do JPEG przed wysłaniem.
3. Moderator korzysta z `/admin/`. Kopiuje tekst do ręcznej redakcji w ChatGPT, wkleja wersję i wysyła autorowi do akceptacji. Aplikacja nie wymaga OpenAI API ani klucza AI.
4. Po akceptacji moderator ogląda orientacyjny podgląd, kopiuje tekst i udostępnia zdjęcia. Dostępne są również zbiorcze pobieranie oraz osobne linki do zdjęć. Podział udostępniania na partie po 10 jest wyborem aplikacji, nie uniwersalnym limitem systemowym.
5. Moderator publikuje ręcznie na Facebooku, następnie wkleja adres konkretnego posta. Status „Proszę o weryfikację” blokuje te czynności w interfejsie; backend także blokuje publikację. Moderator może zapisać weryfikację po rzeczywistym sprawdzeniu dokumentacji placówki.

Wychowawca ma instrukcję na ekranie startowym, rozwijane wyjaśnienia i pomoc `P`; `Esc` zamyka pomoc. Pisanie litery P w polach nie otwiera pomocy.

## Uruchomienie lokalne

Wymagany Node.js 22.12+ lub 24. Na Windows używaj `npm.cmd`, jeśli PowerShell blokuje `npm.ps1`.

```powershell
npm.cmd ci
npm.cmd run dev
```

Serwer nasłuchuje tylko na `127.0.0.1`. Wejścia: `/wychowawca/` i `/admin/`.

```powershell
npm.cmd run build
npm.cmd test
npm.cmd run preview -- --port 4173
```

W drugim terminalu, przy działającym podglądzie:

```powershell
npm.cmd run test:ui
```

Testy UI wymagają Microsoft Edge. Tworzą osobne konteksty przeglądarki z fikcyjnymi danymi i przechwytują wszystkie połączenia do Supabase. Nie wysyłają prawdziwych wiadomości, zdjęć ani postów. Wyniki i zrzuty trafiają do ignorowanego `output/playwright/`. Nie są to testy produkcyjnego RLS ani systemowego panelu udostępniania Androida.

## Konfiguracja i usługi

- Vercel: projekt `mow-fanpage`, ID `prj_FnkC2kabjoROHOwkhy9DHRf2XVyj`, team `team_SprDI3LslqFPjAPin5ITGEYG`. Produkcja: <https://mow-fanpage.vercel.app>. Hosting pozostaje bez zmian.
- Supabase: `tuxtnlqtakhtvdesbmow`. Projekt współdzielony z innymi aplikacjami; MOW korzysta z tabel/RPC `mow_*` i magazynu `mow-materials`. Nie zmieniaj globalnego Site URL ani wspólnych ustawień SMTP bez osobnego uzgodnienia.
- Frontend: opcjonalne `VITE_SUPABASE_URL` i `VITE_SUPABASE_PUBLISHABLE_KEY` (alternatywnie `VITE_SUPABASE_ANON_KEY`). Bez nich kod zachowuje dotychczasowy publiczny adres i klucz publishable. Zwykłe uruchomienie aplikacji łączy się z produkcyjnym Supabase; wyłącznie testy UI przechwytują te połączenia.
- Historyczna funkcja serwerowa używała `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`; opcjonalnie `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`. Sekretów nie odzyskano ani nie zapisano. Nie umieszczaj klucza service role w zmiennych `VITE_*`.
- Magic link powinien wracać na odpowiedni adres `/admin/` lub `/wychowawca/`. Historyczne ustawienia redirectów i Gmail SMTP nie zostały ponownie zweryfikowane.

## Backend i sprawdzenie obiegu

Odzyskano cztery rzeczywiste migracje MOW i wdrożoną funkcję `mow-notify-workflow`. Przestarzałe pliki pozostają w `supabase/archive/` jako referencje, których nie wolno wdrażać. Migracja `20260908073639_mow_workflow_integrity.sql` ogranicza granty, blokuje akceptację starej wersji i oznaczenie niegotowego materiału jako opublikowanego, ujednolica limit profilu.

8 września sprawdzono RLS sześciu tabel i prywatny bucket. Test transakcyjny na danych syntetycznych w rzeczywistej bazie przeszedł: izolacja autora/zdjęć, wysłanie, dwie redakcje, odrzucenie starej akceptacji, blokada wizerunku i zapis prawidłowego adresu posta. Transakcję wycofano, bez zachowania testowych kont lub materiałów. Nie modyfikowano istniejących materiałów ani wspólnej konfiguracji Auth.

Funkcja powiadomień zapisuje komunikaty wewnątrz aplikacji; nie wysyła Web Push ani e-maili. Magic link zależy od istniejącej konfiguracji Auth/SMTP; dostarczenia prawdziwego e-maila nie testowano. Testy przeglądarkowe używają atrap odpowiedzi, nie autentycznych sesji pracowników. Formularz zgody wymaga uzupełnienia adresu fanpage’a, dat, retencji i informacji o transferach przez placówkę.

## Naprawy w wydaniu

- Jeden kod aplikacji w `src/app.js`, budowany z przypiętymi zależnościami i lockfile. Usunięto zależność startu od GitHub/CDN; odzyskano CSS i manifesty obu wejść. Ekran startu i błąd importu mają czytelny komunikat.
- Wywołania profilu odbywają się poza callbackiem blokady Auth. Odświeżenie tokenu tego samego użytkownika nie przebudowuje wypełnianego formularza.
- Zbiorcze generowanie linków zdjęć zastępuje do 15 osobnych żądań. Błąd odczytu fotografii jest widoczny zamiast cichego pominięcia pliku.
- Pobieranie zdjęć działa niezależnie od Web Share. API może odmówić z powodu polityki, aktywacji użytkownika lub decyzji systemu; liczba zdjęć nie jest jedyną możliwą przyczyną ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/share)).
- Wysyłanie ma licznik zapisanych zdjęć, stan oczekiwania i osobny ekran sukcesu. Stały identyfikator z autora, treści i przetworzonych zdjęć oraz unikalne klucze bazy chronią przed powieleniem identycznego materiału, także po utracie odpowiedzi lub w dwóch kartach. Ponowienie sprawdza istniejący zapis i nie nadpisuje plików. Zmiana treści lub zdjęć oznacza nowy materiał; nie jest to semantyczne wykrywanie podobnych postów. Formularz po zamknięciu nie jest automatycznie odtwarzany: kopię tekstu należy zachować, ponowne wybranie identycznych danych umożliwia rozpoznanie zapisu. Starsze zgłoszenia z losowymi identyfikatorami nie są objęte tym rozpoznawaniem.
- Nowy service worker nie buforuje prywatnych odpowiedzi API ani fotografii. Czyści wyłącznie dawne cache `mow-fanpage-vN`; zachowuje localStorage i IndexedDB. Bez internetu wyświetla informację o połączeniu.
- Vite 7.3.6 usuwa podatności wykryte w odzyskanej wersji 7.1.7. Testy bezpieczeństwa kontrolują izolację cache i adresy publikacji.

## Zasady pracy

`AGENTS.md` zawiera pełny tryb ECO i ochronę danych dla wszystkich plików repozytorium. Publikacja, push i merge wymagają wyraźnego osobnego zlecenia. Historia rozmowy pozostaje w prywatnym katalogu roboczym poza repozytorium.

## Interfejs 1.1.0

Pięć kroków z czerwonym oznaczeniem braków, tekstowym statusem i delikatnym podświetleniem następnego kroku. Nawigacja w górnym panelu i przyciski Dalej pod sekcjami. Duże, kontrastowe przyciski, responsywny układ oraz respektowanie prefers-reduced-motion. Pełna instrukcja startowa jest zwinięta; przycisk pomocy nie zasłania formularza. Limity przygotowania zdjęć: 15 plików, do 20 MiB każdy i 120 MiB łącznie; gotowe JPEG do 3 MiB. Żądania kończą oczekiwanie po 45 sekundach, bez automatycznej pętli wysyłania. Moderator nie otrzymuje na liście nieukończonych szkiców.
