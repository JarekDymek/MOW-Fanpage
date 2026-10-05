# MOW — wspólna mapa ekosystemu

Wersja mapy: **2026-10-05**

Ten plik jest tymczasowym, identycznym snapshotem wspólnej mapy MOW umieszczonym w aktywnych repozytoriach, aby ChatGPT/Codex miały ten sam punkt odniesienia do czasu utworzenia osobnego repozytorium **MOW-HUB**. Lokalne `AGENTS.md` i dokumentacja bieżącego repo mają pierwszeństwo w sprawach specyficznych dla danego projektu.

## Zasada nadrzędna

Wspólna wiedza MOW może być używana referencyjnie między projektami, ale **kod, konfiguracja, deploymenty i reguły nie są dziedziczone automatycznie**. Każdy projekt jest autonomiczny, chyba że dokumentacja jawnie opisuje integrację.

## Aktywne domeny

| Kod | Projekt logiczny | Repozytorium / repozytoria |
|---|---|---|
| GH2 | MOW | GH2 — Genialny Harmonogram 2 | `JarekDymek/Genialny-Harmonogram-2` + satelity Deploy/PWA |
| GH3 | MOW | GH3 — Genialny Harmonogram 3 | `JarekDymek/GH3` |
| AUDYTOR-INTERNAT | Audytor Harmonogramu Internatu MOW | `JarekDymek/Audytor-HM` |
| MOW-PLAN | MOW | MÓJ PLAN | `JarekDymek/mow-moj-plan` |
| MOW-ASYSTENT | MOW | ASYSTENT | `AsMOW` (produkcja), `AsMOW-Next` (rozwój), `Asystent-MOW-Open` (wariant publiczny/offline) |
| MOW-FANPAGE | MOW | FANPAGE | `MOW-Fanpage` + `MOW-Fanpage-Zgody-Na-Wizerunek` jako moduł LAB |
| MOW-GRY | MOW | GRY LOGICZNE | `JarekDymek/GryLogiczne2` |

## Zależności i relacje

- **GH2 i GH3 są autonomiczne.** GH3 powstał na bazie GH2, ale nie wolno automatycznie przenosić zmian między nimi.
- **AUDYTOR-INTERNAT** może korzystać z udokumentowanych reguł GH2 jako referencji, ale nie jest GH2/GH3 ani `Harmonogram-MOW`.
- **MOW — MÓJ PLAN** jest nową niezależną aplikacją. `AsMOW-Next` może konsumować jej read-only API.
- **AsMOW (produkcja)** nadal korzysta z `Harmonogram-MOW`; ta zależność jest legacy i ma zostać wygaszona dopiero po faktycznej migracji.
- **Fanpage Zgody** jest podmodułem MOW Fanpage, nie osobnym projektem biznesowym. Docelowy kierunek: integracja z główną aplikacją.
- **GryLogiczne2** jest bieżącą linią MOW Gry Logiczne.

## Repozytoria historyczne / niedomyślne

- `Genialny-Harmonogram` + Deploy/PWA — **GH1, legacy/stable predecessor**.
- `GryLogiczne` — **legacy/reference**, poprzednik `GryLogiczne2`.
- `Harmonogram-MOW` — **legacy active dependency / maintenance only**; nie usuwać, dopóki obecny AsMOW rzeczywiście z niego korzysta.
- `Harmonogram` — **HOLD / legacy candidate**; nie wybierać domyślnie, wymaga osobnej weryfikacji przed archiwizacją.
- `AsystentNewGen` — **HOLD / nie wybierać jako domyślnego następcy**; aktywną nową linią rozwojową jest `AsMOW-Next`.

## Nazewnictwo

W rozmowach, dokumentacji i Codexie używaj kodów: **GH2, GH3, AUDYTOR-INTERNAT, MOW-PLAN, MOW-ASYSTENT, MOW-FANPAGE, MOW-GRY**. Nie używaj ogólnej nazwy „Harmonogram MOW” do opisywania innych aplikacji.

## Plan docelowy

Po udostępnieniu możliwości utworzenia nowego repozytorium ta mapa powinna zostać przeniesiona do prywatnego `JarekDymek/MOW-HUB`. W aktywnych repo pozostaną wtedy krótkie linki do HUB-u i lokalne `AGENTS.md`.
