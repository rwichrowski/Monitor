# CLAUDE.md

Plik z wytycznymi dla Claude Code przy pracy w tym repozytorium.

## Kontekst domenowy

Aplikacja służy do **osobistego monitorowania redukcji masy ciała** — użytkownik codziennie wpisuje wagę, kalorie spożyte i spalone, a system pokazuje trendy i bilans energetyczny w czasie. Głównym problemem biznesowym jest brak widoczności: bez historii liczb trudno ocenić, czy dieta i aktywność fizyczna faktycznie działają. Aplikacja rozwiązuje to przez dzienne utrwalanie danych i wizualizację zależności między kaloriami a zmianami wagi.

Śledzone aktywności fizyczne: trucht (km), rower (km), siłownia (min). Kalorie spalane są szacowane przez kalkulator MET na podstawie bieżącej wagi użytkownika.

## Struktura projektu

Cała aplikacja żyje w jednym pliku: `weight_tracker_cloud.html`. Brak procesu budowania — plik otwiera się bezpośrednio w przeglądarce.

## Konfiguracja Firebase

Aplikacja wymaga pliku `config.js` (pomijanego przez `.gitignore`) z danymi dostępowymi:

```js
const firebaseConfig = {
    apiKey: "...",
    authDomain: "...",
    projectId: "...",
    ...
};
```

Skopiuj `config.example.js` do `config.js` i uzupełnij wartości z Firebase Console. Aplikacja korzysta z anonimowego logowania i Firestore — użytkownik nie musi zakładać konta, a dane są przypisane do anonimowego `uid` przeglądarki.

## Architektura i kluczowe metody

### Synchronizacja danych

- **`initFirebase()`** — inicjuje połączenie z Firebase i loguje użytkownika anonimowo. Anonimowe auth to celowy wybór: nie chcemy progu rejestracji, ale chcemy trwałości danych między sesjami w tej samej przeglądarce.

- **`startSync()`** — zakłada nasłuchiwacz `onSnapshot` na kolekcję Firestore ograniczoną do ostatnich 30 dni. Każda zmiana w bazie (lokalnie lub z innego urządzenia) automatycznie odświeża UI bez konieczności odświeżania strony.
  - Ścieżka danych: `artifacts/weight-tracker-cloud/users/{uid}/weights/{date}`
  - `{date}` jest ID dokumentu (format `YYYY-MM-DD`), co umożliwia upsert przez `.set()` — ten sam dzień zawsze nadpisuje poprzedni wpis.

### Zarządzanie wpisami

- **`addEntry()`** — zapisuje dzienny pomiar: wagę, kalorie spożyte, kalorie spalone oraz poszczególne aktywności (`trucht_km`, `rower_km`, `silownia_min`). Używa `.set()` (nie `.add()`), żeby ponowne zapisanie tego samego dnia nadpisało istniejący wpis zamiast tworzyć duplikat. Po zapisie formularz nie jest czyszczony ręcznie — `onSnapshot` odpala się sam i `fillFormForDate` uzupełnia pola świeżymi danymi.

- **`deleteEntry(id)`** — usuwa wpis po dacie (`id` = data dokumentu). Wymaga potwierdzenia, bo operacja jest nieodwracalna.

### Stan formularza

- **`weightEntries`** — tablica w pamięci, posortowana rosnąco po dacie, przebudowywana przy każdym snapshocie. To jedyne źródło prawdy dla całego UI.

- **`fillFormForDate(date)`** — wyszukuje wpis w `weightEntries` dla wybranej daty i uzupełnia pola formularza. Jeśli wpis istnieje, zmienia przycisk na "Zaktualizuj wpis"; jeśli nie — na "Dodaj do bazy". Resetuje też akumulator aktywności (`activityAcc`) do wartości z istniejącego wpisu.

- **`activityAcc`** — obiekt `{ trucht, rower, silownia }` akumulujący aktywności dodane kalkulatorem w trakcie sesji edycji danego dnia. Przy zmianie daty jest resetowany. Przy zapisie jego wartości trafiają do Firestore jako oddzielne pola.

### Kalkulator aktywności

- **`addActivityCalc()`** — przelicza dystans/czas aktywności na spalone kalorie metodą MET × waga × czas i dodaje wynik do pola "Spalone kalorie". Jednocześnie aktualizuje `activityAcc`, żeby przy zapisie Firestore wiedział ile km trucht/rower i ile minut siłowni było danego dnia.

- **`calcBurnedCalories(activity, quantity)`** — silnik kalkulatora MET. Wartości MET: trucht = 8.7, rower = 7.5, siłownia = 4.0. Jako wagę bazową bierze ostatni wpis z `weightEntries` (domyślnie 117 kg jeśli brak danych) — dlatego szacunki są bardziej trafne w miarę uzupełniania danych.

### Renderowanie UI

- **`updateUI()`** — wywoływana po każdym snapshocie; orkiestruje przerenderowanie tabeli historii, tabeli aktywności, wykresu postępów i wykresu bilansu tygodniowego. Jeden punkt wejścia dla całego odświeżenia UI.

- **`renderTable()`** — tabela historii wpisów posortowana od najnowszego. Pokazuje wagę, kalorie spożyte i spalone.

- **`renderActivityTable()`** — tabela aktywności fizycznych w zakładce "Aktywność". Filtruje tylko dni z co najmniej jedną aktywnością, liczy sumy za 30 dni (trucht km, rower km, siłownia min) i wyświetla je w kafelkach podsumowania nad tabelą.

- **`renderChart()`** — wykres słupkowo-liniowy (Chart.js) z podwójną osią Y: waga na lewej (`y`), kalorie netto i spalone na prawej (`y1`). Skala wagi jest przycinana do zakresu danych ±2 kg, żeby zmiany były czytelne.

- **`renderScatter()`** — wykres tygodniowy pokazujący skumulowany bilans kaloryczny (kcal powyżej/poniżej TDEE) na tle zmiany wagi względem tygodnia startowego. Pozwala ocenić, czy teoria kaloryczna przekłada się na praktykę — spodziewamy się korelacji między ujemnym bilansem a spadkiem wagi.

- **`isoWeekKey(dateStr)`** — zamienia datę na klucz tygodnia ISO (`YYYY-Www`), używany do grupowania danych w wykresie tygodniowym.

### Pozostałe

- **`switchTab(n)`** — przełącza między trzema zakładkami: "Waga i kalorie" (`#tab1`), "Aktywność" (`#tab2`), "Archiwum" (`#tab3`). Otwarcie zakładki Archiwum automatycznie wywołuje `loadMonthlyTab()`.

- **`saveTDEE(val)`** — zapisuje TDEE (dzienne zapotrzebowanie kaloryczne) do `localStorage`, żeby nie trzeba było wpisywać go przy każdym otwarciu. TDEE jest kluczowe dla wykresu bilansu — bez niego nie wiadomo, ile kalorii to "za dużo".

- **`showToast(msg)`** — wyświetla krótkie powiadomienie na dole ekranu. Znika automatycznie po 3 sekundach.

### Archiwum miesięczne

Zakładka "Archiwum" pokazuje aktywność fizyczną zagregowaną per miesiąc (trucht km, rower km, siłownia min, liczba dni). Dane są pre-agregowane w Firestore w kolekcji `monthly_summaries`, żeby uniknąć pobierania całej historii przy każdym otwarciu.

- **`loadMonthlyTab()`** — pobiera wszystkie dokumenty z `monthly_summaries` i renderuje tabelę. Bieżący miesiąc jest zawsze wyliczany na żywo z `weightEntries` (bez odczytu z Firestore) i oznaczony tagiem "bieżący".

- **`renderMonthlyTable(summaries)`** — renderuje tabelę miesięczną z danych przekazanych jako obiekt `{ 'YYYY-MM': { trucht_km, rower_km, silownia_min, days_count } }`.

- **`recomputeAllMonths()`** — logika lazy agregacji:
  - Jeśli `monthly_summaries` zawiera jakiekolwiek dokumenty: pobiera i zapisuje tylko **poprzedni miesiąc** (aktualny jest zawsze live).
  - Jeśli `monthly_summaries` jest pusta (pierwsze uruchomienie): pobiera całą historię jednym zapytaniem i agreguje wszystkie przeszłe miesiące naraz.

- **`computeMonthFromEntries(month)`** — wylicza agregat dla podanego miesiąca z danych w pamięci (`weightEntries`). Używane tylko dla bieżącego miesiąca.

- **Ścieżka danych**: `artifacts/weight-tracker-cloud/users/{uid}/monthly_summaries/{YYYY-MM}`
  - Dokument zawiera: `month`, `trucht_km`, `rower_km`, `silownia_min`, `days_count`, `computed_at`.
  - Klucz dokumentu to `YYYY-MM`, co umożliwia upsert przez `.set()`.

## Kluczowe zachowania — pułapki

- `.set()` zamiast `.add()` to celowe — każda data jest unikalna, ponowny zapis tego samego dnia to aktualizacja, nie nowy dokument.
- Formularz po zapisie uzupełnia się danymi z bazy (przez `onSnapshot → fillFormForDate`), a nie zostaje wyczyszczony — użytkownik widzi co faktycznie wylądowało w Firestore.
- Dane są ograniczone do ostatnich 30 dni w `startSync()` — celowe ograniczenie, żeby nie ładować całej historii przy każdym otwarciu.
- `activityAcc` musi być zsynchronizowany z datą formularza — przy każdej zmianie daty (`fillFormForDate`) jest resetowany do wartości z istniejącego wpisu.
