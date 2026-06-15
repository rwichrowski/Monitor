// Globalny stan aplikacji — współdzielony między wszystkimi skryptami.
// Plik musi być ładowany jako pierwszy (po config.js).
let auth, db;
let currentUser = null;
let weightEntries = [];
let chartInstance = null;
let caloriesWeightInstance = null;
let caloriesWeight3Instance = null;
let activityAcc = { trucht: 0, rower: 0, silownia: 0 };
let allHistoryEntries = null; // pełna historia — ładowana na żądanie
const appId = 'weight-tracker-cloud';
