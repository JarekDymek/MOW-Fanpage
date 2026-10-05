<!-- CODEX-ECO:BEGIN -->
## Tryb pracy Codex: ECO (domyślny)

Priorytet: poprawność > zachowanie danych > minimalna zmiana > oszczędność tokenów > szybkość. Nigdy nie oszczędzaj kosztem bezpieczeństwa, integralności danych ani krytycznych testów.

- **ECO** — domyślny: minimalne potrzebne odczyty, minimalna bezpieczna zmiana, testy celowane.
- **STANDARD** — na jawne polecenie użytkownika: analiza i testy proporcjonalne do zakresu oraz ryzyka.
- **RELEASE** — na jawne polecenie użytkownika: pełna regresja finalnego stanu oraz pojedyncza weryfikacja zakończonego deploymentu, jeśli wdrożenie należy do zadania.

Czytaj tylko pliki potrzebne do zadania, preferuj `rg`, nie rozszerzaj zakresu bez potrzeby, nie powtarzaj poprawnych testów bez zmiany zależnego kodu i raportuj zwięźle.
<!-- CODEX-ECO:END -->

# MOW | FANPAGE

## Tożsamość projektu

- Projekt logiczny: **MOW | FANPAGE**
- Kod: **MOW-FANPAGE**
- Repo główne: `JarekDymek/MOW-Fanpage`
- Repo modułu LAB: `JarekDymek/MOW-Fanpage-Zgody-Na-Wizerunek`
- Status: **ACTIVE**
- Cel docelowy: jedna aplikacja do obsługi procesu materiałów na fanpage oraz kontroli zgód.

## Relacja z modułem Zgody

`MOW-Fanpage-Zgody-Na-Wizerunek` **nie jest osobnym projektem biznesowym**. To eksperymentalny podmoduł projektu MOW | FANPAGE, obecnie utrzymywany w oddzielnym repozytorium wyłącznie dla bezpiecznego rozwoju i testów.

Docelowo jego zweryfikowane mechanizmy mają zostać zintegrowane z główną aplikacją MOW Fanpage. Nie kopiuj go mechanicznie ani nie łącz repozytoriów bez jawnego zadania migracyjnego.

## Granice

- Nie łącz Fanpage z GH2, GH3, Audytorem, MOW — Mój Plan ani Asystentem na poziomie kodu bez jawnej integracji.
- Produkcyjna baza Supabase jest współdzielona: kontroluj wyłącznie moduł `mow_*` i bucket `mow-materials`.
- Nie zmieniaj globalnych ustawień Auth/SMTP ani innych aplikacji współdzielących Supabase bez osobnego zlecenia.
- Nie zapisuj sekretów, historii rozmów ani zdjęć wychowanków w Git.
- Testuj na danych fikcyjnych.
- Redakcja w ChatGPT i publikacja na Facebooku pozostają ręczne, jeśli aktualna architektura nie stanowi inaczej.
