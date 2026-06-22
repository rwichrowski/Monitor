# CLAUDE.md

Plik z wytycznymi dla Claude Code przy pracy w tym repozytorium.

## Kontekst domenowy

Aplikacja służy do **osobistego monitorowania redukcji masy ciała** — użytkownik codziennie wpisuje wagę, kalorie spożyte i spalone, a system pokazuje trendy i bilans energetyczny w czasie. Głównym problemem biznesowym jest brak widoczności: bez historii liczb trudno ocenić, czy dieta i aktywność fizyczna faktycznie działają. Aplikacja rozwiązuje to przez dzienne utrwalanie danych i wizualizację zależności między kaloriami a zmianami wagi.

Śledzone aktywności fizyczne: trucht (km), rower (km), siłownia (min). Kalorie spalane są szacowane przez kalkulator MET na podstawie bieżącej wagi użytkownika.

## Struktura projektu

Brak procesu budowania — `weight_tracker_cloud.html` otwiera się bezpośrednio w przeglądarce (`file://`). Kod jest rozbity na zewnętrzne pliki ładowane jako **zwykłe skrypty** (nie moduły ES — te są blokowane z `file://`), więc dzielą globalny scope, a **kolejność ładowania w `<head>` ma znaczenie**:

- `weight_tracker_cloud.html` — tylko markup + tagi `<script>`/`<link>`.
- `styles.css` — style.
- `config.js` — klucze Firebase + `userId` (ignorowany przez git).
- `js/state.js` — globalny stan (zmienne współdzielone); ładowany pierwszy.
- `js/firebase.js` — `initFirebase`, `startSync`, `addEntry`, `saveActivity`, `deleteEntry`, `getUid`.
- `js/ui.js` — formularz, dashboard, tabele, `showToast`.
- `js/charts.js` — wykresy Chart.js + `loadFullHistory`.
- `js/activity.js` — kalkulator MET.
- `js/archive.js` — archiwum miesięczne.
- `js/main.js` — `saveTDEE`, `switchTab`, `window.onload`; ładowany ostatni.

Funkcje wywoływane z inline'owych `onclick=` w HTML muszą być globalne — deklaracje `function foo()` i przypisania `window.foo = ...` to zapewniają.

## Konfiguracja Firebase

Aplikacja wymaga pliku `config.js` (pomijanego przez `.gitignore`) z danymi dostępowymi:

```js
const firebaseConfig = {
    apiKey: "...",
    authDomain: "...",
    projectId: "...",
    ...
};

// Stały identyfikator użytkownika — ten sam na każdym urządzeniu
const userId = "twoje-imie-lub-dowolny-string";
```

Skopiuj `config.example.js` do `config.js` i uzupełnij wartości z Firebase Console. Aplikacja loguje się do Firebase **anonimowo** (żeby reguły Firestore wymagające uwierzytelnienia przepuściły zapisy), ale dane zapisuje pod **stałym `userId`** z `config.js`. Dzięki temu nie ma progu rejestracji, a jednocześnie te same wpisy są widoczne na każdym urządzeniu. Jeśli `userId` nie zostanie zdefiniowany, dane lądują pod anonimowym `uid` danej przeglądarki (osobne na każdym urządzeniu) — patrz wzorzec `(typeof userId !== 'undefined') ? userId : currentUser.uid` powtarzany przy każdym dostępie do Firestore.

## Architektura i kluczowe metody

### Synchronizacja danych

- **`initFirebase()`** — inicjuje połączenie z Firebase, loguje użytkownika anonimowo (`signInAnonymously`) i w callbacku `onAuthStateChanged` uruchamia `startSync()`. Anonimowe auth to celowy wybór: spełnia reguły Firestore wymagające uwierzytelnienia, a jednocześnie nie wymaga rejestracji. Tożsamością danych nie jest jednak anonimowy `uid`, lecz stały `userId` z `config.js` — patrz "Konfiguracja Firebase".

- **`startSync()`** — zakłada nasłuchiwacz `onSnapshot` na kolekcję Firestore ograniczoną do ostatnich 30 dni (`where('date', '>=', cutoff)`). Każda zmiana w bazie (lokalnie lub z innego urządzenia) automatycznie odświeża UI bez konieczności odświeżania strony.
  - Ścieżka danych: `artifacts/weight-tracker-cloud/users/{uid}/weights/{date}`, gdzie `{uid}` to `userId` z configu (lub anonimowy `uid` jako fallback).
  - `{date}` jest ID dokumentu (format `YYYY-MM-DD`), co umożliwia upsert przez `.set()` — ten sam dzień zawsze nadpisuje poprzedni wpis.

### Zarządzanie wpisami

- **`addEntry()`** (zakładka „Waga i kalorie") — zapisuje dzienny pomiar: wagę i kalorie spożyte. Używa `.set(..., { merge: true })` (nie `.add()`), żeby ponowne zapisanie tego samego dnia zaktualizowało istniejący wpis **bez kasowania aktywności** zapisanej osobno w zakładce 2. Po zapisie formularz nie jest czyszczony ręcznie — `onSnapshot` odpala się sam i `fillFormForDate` uzupełnia pola świeżymi danymi.

- **`saveActivity()`** (zakładka „Aktywność") — zapisuje aktywność dnia: kalorie spalone, `trucht_km`, `rower_km`, `silownia_min` oraz liczbę podciągnięć (`podciagniecia`) i pompek (`pompki`). Również `.set(..., { merge: true })`, więc nie nadpisuje wagi/kalorii z zakładki 1 i można zapisać aktywność dla dnia bez wpisu wagi. Ma własny selektor daty (`#activityDate`), niezależny od daty pomiaru wagi. Kalorie spalone pochodzą **tylko** z truchtu/roweru/siłowni — podciągnięcia i pompki nie zwiększają `burnedCalories`.

- **`deleteEntry(id)`** — usuwa wpis po dacie (`id` = data dokumentu). Wymaga potwierdzenia, bo operacja jest nieodwracalna.

### Stan formularza

- **`weightEntries`** — tablica w pamięci, posortowana rosnąco po dacie, przebudowywana przy każdym snapshocie. To jedyne źródło prawdy dla całego UI.

- **`fillFormForDate(date)`** (zakładka 1) — wyszukuje wpis w `weightEntries` dla wybranej daty i uzupełnia pola wagi/kalorii. Jeśli wpis istnieje, zmienia przycisk na "Zaktualizuj wpis"; jeśli nie — na "Dodaj do bazy".

- **`fillActivityFormForDate(date)`** (zakładka 2) — odpowiednik dla formularza aktywności: uzupełnia spalone kalorie, trucht/rower/siłownię, podciągnięcia i pompki oraz resetuje `activityAcc` do wartości z istniejącego wpisu dla daty z `#activityDate`. Przełącza etykietę przycisku między „Zapisz aktywność" a „Zaktualizuj aktywność". Oba `fill*` są wołane z `updateUI()` po każdym snapshocie.

- **`activityAcc`** — obiekt `{ trucht, rower, silownia }` akumulujący aktywności dodane kalkulatorem w trakcie sesji edycji danego dnia (zakładka 2). Przy zmianie daty aktywności jest resetowany. Przy zapisie jego wartości trafiają do Firestore jako oddzielne pola. Podciągnięcia/pompki nie są w `activityAcc` — to bezpośrednie pola liczbowe czytane przy zapisie.

### Kalkulator aktywności

- **`recalcBurned()`** — czyta trzy pola liczbowe (`#truchtValue` km, `#rowerValue` km, `#silowniaValue` min), przelicza je metodą MET × waga × czas i wpisuje **sumę** do pola "Spalone kalorie" w zakładce 2. Wołana z `oninput` każdego z trzech pól, więc spalone kalorie aktualizują się na żywo podczas pisania. Jednocześnie ustawia `activityAcc` na bieżące wartości pól (nadpisuje, nie akumuluje), żeby przy zapisie Firestore wiedział ile km trucht/rower i ile minut siłowni było danego dnia. Obsługuje tylko trucht/rower/siłownię — podciągnięcia i pompki nie liczą kalorii.

- **`calcBurnedCalories(activity, quantity)`** — silnik kalkulatora MET. Wartości MET: trucht = 8.7, rower = 7.5, siłownia = 4.0. Jako wagę bazową bierze ostatni wpis z `weightEntries` (domyślnie 117 kg jeśli brak danych) — dlatego szacunki są bardziej trafne w miarę uzupełniania danych.

### Renderowanie UI

- **`updateUI()`** — wywoływana po każdym snapshocie; orkiestruje przerenderowanie tabeli historii, tabeli aktywności, wykresu postępów oraz obu wykresów zależności kalorie–waga. Jeden punkt wejścia dla całego odświeżenia UI.

- **`renderTable()`** — tabela historii wpisów posortowana od najnowszego. Pokazuje wagę, kalorie spożyte i spalone.

- **`renderActivityTable()`** — tabela aktywności fizycznych w zakładce "Aktywność". Pokazuje wszystkie dni (dni bez aktywności są wyszarzone), liczy sumy za 30 dni (trucht km, rower km, siłownia min, podciągnięcia szt., pompki szt.) i wyświetla je w kafelkach podsumowania nad tabelą.


- **`renderChart()`** — wykres słupkowo-liniowy (Chart.js) z podwójną osią Y: waga na lewej (`y`), kalorie netto i spalone na prawej (`y1`). Skala wagi jest przycinana do zakresu danych ±2 kg, żeby zmiany były czytelne.

- **`drawCaloriesVsWeight({ canvasId, warnId, windowDays, prevInstance })`** — wspólny silnik wykresu "Spożyte kcal vs zmiana wagi" oparty o **średnią kroczącą** o oknie `windowDays`, z punktem na każdy dzień kalendarzowy (a nie kubełkowanie tygodniowe). Niszczy `prevInstance` i zwraca nową instancję Chart.js (lub `null`, gdy brak canvasu/danych).
  - Waga dnia `D` = średnia z dostępnych pomiarów w oknie `[D−(windowDays−1) … D]`; spożyte kcal dnia `D` = średnia z okna `[D−windowDays … D−1]`. Okno kcal jest **przesunięte o jeden dzień**, bo kalorie bieżącego dnia wpisuje się zwykle wieczorem lub nazajutrz.
  - Zmiana wagi liczona względem pierwszej policzalnej średniej kroczącej (baseline). Luki nie wywracają średniej (uśrednianie po dostępnych wpisach, `spanGaps: true`).
  - Źródłem jest `allHistoryEntries ?? weightEntries` — domyślnie tylko 30 dni, a po kliknięciu "Załaduj pełną historię" pełen zakres (patrz `loadFullHistory()`). Bez pełnej historii najwcześniejsze ~`windowDays−1` punktów liczy się z niepełnego okna.
  - Gdy w ostatnich 30 dniach brakuje pomiarów wagi, nad wykresem pojawia się ostrzeżenie (`warnId`) z listą brakujących dni.

- **`renderCaloriesVsWeight()`** / **`renderCaloriesVsWeight3()`** — cienkie wrappery na `drawCaloriesVsWeight()`: pierwszy rysuje wariant **7-dniowy** (`#caloriesWeightChart`, `caloriesWeightInstance`), drugi **3-dniowy** (`#caloriesWeight3Chart`, `caloriesWeight3Instance`). Oba czytają z tego samego źródła danych, więc "Załaduj pełną historię" odświeża je naraz.

- **`loadFullHistory()`** — jednorazowo pobiera całą kolekcję `weights` (bez limitu 30 dni), zapisuje do `allHistoryEntries` i przerysowuje oba wykresy średniej kroczącej (`renderCaloriesVsWeight()` + `renderCaloriesVsWeight3()`). Wywoływana przyciskiem w karcie wykresu 7-dniowego.

- **`allHistoryEntries`** — pełna historia wpisów ładowana na żądanie; `null` dopóki użytkownik nie kliknie "Załaduj pełną historię". Domyślnie wykresy korzystają z 30-dniowego `weightEntries`.

### Pozostałe

- **`switchTab(n)`** — przełącza między trzema zakładkami: "Waga i kalorie" (`#tab1`), "Aktywność" (`#tab2`), "Archiwum" (`#tab3`). Otwarcie zakładki Archiwum automatycznie wywołuje `loadMonthlyTab()`.

- **`saveTDEE(val)`** — zapisuje TDEE (dzienne zapotrzebowanie kaloryczne) do `localStorage`, żeby nie trzeba było wpisywać go przy każdym otwarciu. TDEE jest kluczowe dla wykresu postępów i kafelka dashboardu — bez niego nie wiadomo, ile kalorii to "za dużo". Pole `#tdeeValue` mieszka w nagłówku karty "Wykres postępów", a jego `onchange` woła `updateUI()`, żeby odświeżyć wszystkie zależne widoki.

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

- `.set(..., { merge: true })` zamiast `.add()` to celowe — każda data jest unikalna, ponowny zapis tego samego dnia to aktualizacja, nie nowy dokument. **Merge jest kluczowy**, bo waga/kalorie (zakładka 1, `addEntry`) i aktywność (zakładka 2, `saveActivity`) zapisują się do **tego samego dokumentu dnia osobnymi zapisami** — bez merge jeden nadpisałby pola drugiego.
- Formularz po zapisie uzupełnia się danymi z bazy (przez `onSnapshot → fillFormForDate` / `fillActivityFormForDate`), a nie zostaje wyczyszczony — użytkownik widzi co faktycznie wylądowało w Firestore.
- Dane są ograniczone do ostatnich 30 dni w `startSync()` — celowe ograniczenie, żeby nie ładować całej historii przy każdym otwarciu. Pełną historię ciągnie się osobno przez `loadFullHistory()` tylko na żądanie.
- `activityAcc` musi być zsynchronizowany z datą aktywności (`#activityDate`) — przy każdej zmianie daty (`fillActivityFormForDate`) jest resetowany do wartości z istniejącego wpisu.
- Tożsamością danych w Firestore jest stały `userId` z `config.js`, a nie anonimowy `uid` — każdy dostęp do bazy używa wzorca `(typeof userId !== 'undefined') ? userId : currentUser.uid`. Zmiana `userId` = inny zestaw danych.
- `renderCaloriesVsWeight()` używa średniej kroczącej 7 dni, więc pełne okno dla najwcześniejszego punktu wymaga danych z ~6 dni przed nim. Przy domyślnym 30-dniowym `weightEntries` pierwsze punkty są liczone z niepełnego okna — dopiero `loadFullHistory()` daje komplet.
