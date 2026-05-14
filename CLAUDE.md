# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Single-file web app (`weight_tracker_cloud.html`) for tracking body weight and daily calorie intake. No build step — open the HTML file directly in a browser.

## Firebase Setup

The app requires a `config.js` file (gitignored) with Firebase credentials:

```js
const firebaseConfig = {
    apiKey: "...",
    authDomain: "...",
    projectId: "...",
    ...
};
```

Copy `config.example.js` to `config.js` and fill in the values from the Firebase Console. The app uses anonymous authentication and Firestore.

## Architecture

Everything lives in `weight_tracker_cloud.html`:

- **Firebase** — anonymous auth + Firestore `onSnapshot` for real-time sync. Data path: `artifacts/weight-tracker-cloud/users/{uid}/weights/{date}` (date as document ID, enabling upsert via `.set()`).
- **`weightEntries`** — in-memory array, sorted by date, rebuilt on every Firestore snapshot.
- **`updateUI()`** — called on every snapshot; re-renders the table, chart, and pre-fills the form for the currently selected date.
- **`fillFormForDate(date)`** — looks up `weightEntries` for the given date and populates weight/calories inputs; changes button label between "Dodaj do bazy" / "Zaktualizuj wpis".
- **Chart.js** — dual-axis line chart (weight on left `y`, calories on right `y1`).

## Key Behaviors

- Saving uses `.set()` (upsert) — re-submitting the same date overwrites the existing entry.
- After save, the form is not cleared manually; the Firestore `onSnapshot` callback re-fires and `fillFormForDate` repopulates the fields from the freshly saved data.
- Date input defaults to today on load; changing it immediately pre-fills or clears the form.
