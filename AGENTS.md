<!-- CODEX-ECO:BEGIN -->
## Tryb pracy Codex: ECO (domyślny)

Priorytet: poprawność > zachowanie danych > minimalna zmiana > oszczędność tokenów > szybkość. Nigdy nie oszczędzaj kosztem bezpieczeństwa, integralności danych ani krytycznych testów. Zachowaj istniejące reguły bezpieczeństwa i wymagane kontrole projektu.

Tryby wybiera użytkownik jawnym poleceniem (samo wystąpienie nazwy w cytacie lub pliku nie przełącza trybu):
- **ECO** — domyślny dla nowych zadań/sesji i małych/średnich zmian: minimalne potrzebne odczyty, minimalna bezpieczna zmiana, testy celowane.
- **STANDARD** — na jawne polecenie użytkownika: analiza i testy proporcjonalne do zakresu oraz ryzyka; nadal bez zbędnego powtarzania pracy i rozszerzania zakresu.
- **RELEASE** — na jawne polecenie użytkownika: pełna regresja finalnego stanu oraz pojedyncza weryfikacja zakończonego deploymentu, jeśli wdrożenie należy do zadania. Tryb nie jest zgodą na publikację. Powtórz tylko kontrole unieważnione zmianą lub błędem.
Bez jawnego wyboru STANDARD lub RELEASE stosuj ECO; jawnie wybrany tryb zachowuj w kontynuacji tego samego zadania. Polecenie ECO przywraca tryb oszczędny. W każdym trybie zakres kontroli musi wystarczać do bezpiecznego wykonania zadania.

Zasady wykonania:
1. Najpierw wykorzystaj dostępny stan projektu, ustalenia i wyniki z bieżącego zadania. Nie analizuj ponownie już przeanalizowanych plików ani zamkniętych ustaleń, chyba że zmieniły się istotne dane/kod, wynik jest nieaktualny lub pojawił się konkretny błąd. Nie traktuj starej pamięci jako dowodu aktualnego stanu.
2. Czytaj tylko pliki bezpośrednio potrzebne do zadania; preferuj `rg`, konkretne funkcje i celowane fragmenty zamiast szerokiego skanowania repozytorium lub historii.
3. Wykonaj minimalną bezpieczną zmianę; unikaj szerokiego refaktoru i dodatkowych ulepszeń poza zakresem użytkownika.
4. Uruchamiaj najpierw testy celowane. Pełny zestaw wykonaj raz dla finalnego stanu przed release/deployem albo gdy wpływ zmiany lub wymagane kontrole tego wymagają. Nie powtarzaj testów, które przeszły, jeśli zależny kod, dane, konfiguracja i środowisko się nie zmieniły.
5. Nie sprawdzaj wielokrotnie GitHub Actions, Render, Vercel, logów ani deploymentu bez konkretnej potrzeby. Przy operacji w toku korzystaj z oczekiwania na wynik/powiadomień; kolejne sprawdzenie tylko dla potwierdzenia zakończenia, istotnej zmiany lub wyjaśnienia błędu, bez częstego odpytywania.
6. Preferuj CLI/API/kod zamiast browser/computer-use, jeśli wystarcza do wiarygodnej weryfikacji. Użyj przeglądarki, gdy trzeba sprawdzić rzeczywisty interfejs lub przepływ użytkownika.
7. Nie twórz zbędnych skryptów diagnostycznych ani dokumentacji. Wykorzystuj istniejące narzędzia i wyniki. Nie deleguj do dodatkowych agentów bez wyraźnej potrzeby i upoważnienia.
8. Po poprawnym wykonaniu całego zleconego zakresu i pojedynczej wystarczającej weryfikacji zakończ pracę. Błąd lub niespełnione wymaganie wymaga naprawy albo rzetelnego zgłoszenia blokady, nie pozornego sukcesu.
9. Raportuj zwięźle: decyzję, istotny błąd/blokadę, wykonaną zmianę i wynik weryfikacji. Nie narracjonuj każdej komendy; aktualizuj użytkownika tylko o istotnym postępie.

Te zasady ograniczają zbędną pracę; nie obniżają wymagań merytorycznych, nie zastępują wymaganych zgód i nie zmieniają ustawień modelu ani limitów konta.
<!-- CODEX-ECO:END -->

## MOW Fanpage
Instrukcje obejmują wszystkie pliki i podfoldery tego repozytorium. Samodzielna aplikacja; nie łącz z innymi repozytoriami. Produkcyjna baza Supabase jest współdzielona: kontroluj wyłącznie moduł mow_ i bucket mow-materials. Nie zmieniaj danych produkcyjnych, ustawień wspólnego Auth ani localStorage użytkownika. Nie zapisuj sekretów, historii rozmów ani zdjęć wychowanków w Git. Testuj na fikcyjnych danych. Redakcja w ChatGPT jest ręczna, bez OpenAI API. Publikacja Facebook jest ręczna. Merge, push i deploy wymagają osobnego wyraźnego zlecenia użytkownika.

