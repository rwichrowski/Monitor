# Monitor — tracker redukcji masy ciała

Prosta, jednoplikowa aplikacja webowa do **osobistego monitorowania redukcji wagi**. Codziennie wpisujesz wagę, kalorie spożyte i spalone oraz aktywność fizyczną, a aplikacja pokazuje trendy i bilans energetyczny w czasie — żeby było widać, czy dieta i ruch faktycznie działają.

Dane synchronizują się przez Firebase (Firestore), więc te same wpisy masz na każdym urządzeniu i w każdej przeglądarce.

## Funkcje

- **Dzienny wpis** — waga, kalorie spożyte, kalorie spalone; ponowny zapis tego samego dnia nadpisuje poprzedni (bez duplikatów).
- **Kalkulator spalonych kalorii** — przelicza trucht (km), rower (km) i siłownię (min) na kcal metodą MET × waga × czas, biorąc Twoją aktualną wagę.
- **Wykres postępów** — waga vs kalorie netto/spalone na podwójnej osi.
- **Spożyte kcal vs zmiana wagi** — średnia krocząca 7 dni: punkt na każdy dzień, waga z 7 dni do dziś zestawiona ze średnim spożyciem kcal z 7 dni do wczoraj (kcal są przesunięte o dzień, bo wpisuje się je zwykle wieczorem lub nazajutrz). Ostrzega, gdy brakuje pomiarów wagi.
- **Zakładka Aktywność** — tabela treningów + podsumowanie 30 dni (km truchtu, km roweru, minuty siłowni).
- **Archiwum miesięczne** — aktywność zagregowana per miesiąc, pre-liczona w Firestore, żeby nie ciągnąć całej historii.

## Stack

- Czysty HTML + JavaScript (bez procesu budowania).
- [Chart.js](https://www.chartjs.org/) do wykresów, Tailwind (CDN) do stylów.
- [Firebase](https://firebase.google.com/) — Authentication (logowanie anonimowe) + Firestore (dane).

## Uruchomienie

Brak instalacji i kroku budowania — aplikacja to jeden plik `weight_tracker_cloud.html`.

1. **Skopiuj konfigurację:**

   ```sh
   cp config.example.js config.js
   ```

2. **Uzupełnij `config.js`** danymi z [Firebase Console](https://console.firebase.google.com/) (Project settings → Your apps):

   ```js
   const firebaseConfig = {
       apiKey: "...",
       authDomain: "...",
       projectId: "...",
       // ... reszta pól z konsoli
   };

   // Stały identyfikator użytkownika — ten sam na każdym urządzeniu.
   // Dzięki niemu dane są wspólne między przeglądarkami, mimo logowania anonimowego.
   const userId = "twoje-imie-lub-dowolny-string";
   ```

3. **W Firebase Console włącz:**
   - Authentication → metoda **Anonymous**,
   - **Firestore Database** (tryb produkcyjny lub testowy).

4. **Otwórz `weight_tracker_cloud.html`** w przeglądarce (bezpośrednio lub przez dowolny serwer statyczny).

> `config.js` jest w `.gitignore` — Twoje klucze nie trafią do repozytorium.

### Jak działa logowanie

Aplikacja loguje się do Firebase **anonimowo** (żeby reguły Firestore wymagające uwierzytelnienia przepuściły zapisy), ale dane zapisuje pod **stałym `userId`** z `config.js`. Dzięki temu nie ma progu rejestracji, a jednocześnie te same wpisy widzisz na każdym urządzeniu. Jeśli pominiesz `userId`, dane będą przypisane do anonimowego `uid` danej przeglądarki (osobne na każdym urządzeniu).

## Struktura danych w Firestore

```
artifacts/weight-tracker-cloud/users/{userId}/
├── weights/{YYYY-MM-DD}            # dzienny wpis: waga, kalorie, aktywności
└── monthly_summaries/{YYYY-MM}     # pre-agregat miesięczny aktywności
```

ID dokumentu wpisu to data (`YYYY-MM-DD`), co pozwala na upsert przez `.set()` — jeden dzień = jeden dokument.

Aby ograniczyć transfer, bieżący widok nasłuchuje tylko **ostatnich 30 dni**; pełną historię ładuje się na żądanie przyciskiem w karcie wykresu.

## Struktura projektu

| Plik | Rola |
|------|------|
| `weight_tracker_cloud.html` | Cała aplikacja (UI + logika + style). |
| `config.example.js` | Szablon konfiguracji Firebase. |
| `config.js` | Twoje klucze (ignorowane przez git). |
| `CLAUDE.md` | Wytyczne i dokumentacja architektury dla pracy z kodem. |

Szczegółowy opis metod i architektury znajdziesz w [`CLAUDE.md`](./CLAUDE.md).
