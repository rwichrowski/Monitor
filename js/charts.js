// Wykresy (Chart.js).

function renderChart() {
    const canvas = document.getElementById('weightChart');
    const ctx = canvas.getContext('2d');
    if (chartInstance) chartInstance.destroy();

    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const tickColor = isDark ? '#94a3b8' : '#64748b';

    const weights = weightEntries.map(e => e.weight).filter(Boolean);
    const pad = 2;
    const yMin = weights.length ? Math.floor(Math.min(...weights) - pad) : 0;
    const yMax = weights.length ? Math.ceil(Math.max(...weights) + pad) : 120;

    chartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: weightEntries.map(e => e.date),
            datasets: [{
                type: 'line',
                label: 'Waga (kg)',
                data: weightEntries.map(e => e.weight),
                borderColor: '#3b82f6',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                fill: true,
                tension: 0.3,
                yAxisID: 'y',
                order: 1
            }, {
                type: 'bar',
                label: 'Netto (kcal)',
                data: weightEntries.map(e => e.calories ? e.calories - (e.burnedCalories || 0) : null),
                backgroundColor: 'rgba(16, 185, 129, 0.55)',
                borderColor: '#10b981',
                borderWidth: 1,
                yAxisID: 'y1',
                stack: 'cal',
                order: 2
            }, {
                type: 'bar',
                label: 'Spalone (kcal)',
                data: weightEntries.map(e => e.burnedCalories || null),
                backgroundColor: 'rgba(110, 231, 183, 0.55)',
                borderColor: '#6ee7b7',
                borderWidth: 1,
                yAxisID: 'y1',
                stack: 'cal',
                order: 3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    type: 'linear',
                    position: 'left',
                    min: yMin,
                    max: yMax,
                    ticks: { color: tickColor }
                },
                y1: {
                    type: 'linear',
                    position: 'right',
                    stacked: true,
                    ticks: { color: tickColor },
                    grid: { drawOnChartArea: false }
                },
                x: { ticks: { color: tickColor } }
            }
        }
    });
}

async function loadFullHistory() {
    const btn = document.getElementById('loadHistoryBtn');
    btn.disabled = true;
    btn.textContent = 'Ładowanie…';
    try {
        const uid = (typeof userId !== 'undefined') ? userId : currentUser.uid;
        const snap = await db.collection('artifacts').doc(appId)
            .collection('users').doc(uid)
            .collection('weights')
            .orderBy('date')
            .get();
        allHistoryEntries = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        btn.textContent = `Załadowano (${allHistoryEntries.length} wpisów)`;
        renderCaloriesVsWeight();
        renderCaloriesVsWeight3();
    } catch (e) {
        btn.disabled = false;
        btn.textContent = 'Załaduj pełną historię';
        console.error(e);
    }
}
window.loadFullHistory = loadFullHistory;

function renderCaloriesVsWeight() {
    caloriesWeightInstance = drawCaloriesVsWeight({
        canvasId: 'caloriesWeightChart',
        warnId: 'caloriesWeightWarning',
        windowDays: 7,
        prevInstance: caloriesWeightInstance
    });
}

function renderCaloriesVsWeight3() {
    caloriesWeight3Instance = drawCaloriesVsWeight({
        canvasId: 'caloriesWeight3Chart',
        warnId: 'caloriesWeight3Warning',
        windowDays: 3,
        prevInstance: caloriesWeight3Instance
    });
}

// Wspólny silnik wykresu "Spożyte kcal vs zmiana wagi" — średnia krocząca o
// konfigurowalnym oknie (windowDays). Zwraca utworzoną instancję Chart.js (lub null).
function drawCaloriesVsWeight({ canvasId, warnId, windowDays, prevInstance }) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return null;
    const ctx = canvas.getContext('2d');
    if (prevInstance) prevInstance.destroy();

    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const tickColor = isDark ? '#94a3b8' : '#64748b';

    const sourceEntries = allHistoryEntries ?? weightEntries;

    // Indeks wpisów po dacie (YYYY-MM-DD) — dla szybkiego wglądu po dniu
    const byDate = {};
    sourceEntries.forEach(e => { byDate[e.date] = e; });

    const datesPresent = Object.keys(byDate).sort();
    const warnDiv = document.getElementById(warnId);
    if (!datesPresent.length) {
        if (warnDiv) warnDiv.classList.add('hidden');
        return null;
    }

    // Ciągły zakres dni kalendarzowych: od najstarszego wpisu do dziś
    const toISO = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const startDay = new Date(datesPresent[0] + 'T00:00:00');
    const endDay = new Date(); endDay.setHours(0, 0, 0, 0);
    const days = [];
    for (let d = new Date(startDay); d <= endDay; d.setDate(d.getDate() + 1)) days.push(toISO(d));

    // Średnia pola w oknie [anchor−back ... anchor−front] (dni wstecz), z dostępnych wpisów
    const avgInWindow = (anchorIdx, front, back, field) => {
        let sum = 0, n = 0;
        for (let k = front; k <= back; k++) {
            const e = byDate[days[anchorIdx - k]];
            if (e && e[field]) { sum += e[field]; n++; }
        }
        return n ? sum / n : null;
    };

    // Waga: średnia z okna [D−(windowDays−1) … D]; kcal: okno przesunięte o dzień [D−windowDays … D−1]
    const weightAvg = days.map((_, i) => avgInWindow(i, 0, windowDays - 1, 'weight'));
    const kcalAvg = days.map((_, i) => avgInWindow(i, 1, windowDays, 'calories'));

    const baseIdx = weightAvg.findIndex(v => v !== null);
    const baseWeight = baseIdx >= 0 ? weightAvg[baseIdx] : null;

    const labels = days.map(d => `${d.slice(8, 10)}.${d.slice(5, 7)}`);
    const weightChanges = weightAvg.map(v =>
        (v === null || baseWeight === null) ? null : +((v - baseWeight).toFixed(2)));
    const avgCalories = kcalAvg.map(v => v === null ? null : Math.round(v));

    // Ostrzeżenie o brakujących pomiarach wagi w ostatnich 30 dniach
    if (warnDiv) {
        const missing = days.slice(-30).filter(d => !(byDate[d] && byDate[d].weight));
        if (missing.length) {
            const shown = missing.slice(-7).map(d => `${d.slice(8, 10)}.${d.slice(5, 7)}`);
            const more = missing.length > shown.length ? ` (+${missing.length - shown.length} wcześniej)` : '';
            warnDiv.textContent = `Brakuje wagi z ${missing.length} dni: ${shown.join(', ')}${more}. Uzupełnij, aby średnia krocząca była dokładna.`;
            warnDiv.classList.remove('hidden');
        } else {
            warnDiv.classList.add('hidden');
        }
    }

    return new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [
                {
                    label: 'Zmiana wagi (kg)',
                    data: weightChanges,
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59,130,246,0.1)',
                    yAxisID: 'y',
                    tension: 0.3,
                    pointRadius: 4,
                    spanGaps: true
                },
                {
                    label: 'Śr. spożyte kcal/dzień',
                    data: avgCalories,
                    borderColor: '#f43f5e',
                    backgroundColor: 'rgba(244,63,94,0.08)',
                    yAxisID: 'y1',
                    tension: 0.3,
                    pointRadius: 4,
                    spanGaps: true
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                tooltip: {
                    callbacks: {
                        label: (item) => item.datasetIndex === 0
                            ? `Waga: ${item.raw > 0 ? '+' : ''}${item.raw} kg`
                            : `Spożyte: ${item.raw} kcal/dzień`
                    }
                }
            },
            scales: {
                y: {
                    type: 'linear',
                    position: 'left',
                    title: { display: true, text: 'Zmiana wagi (kg)', color: tickColor },
                    ticks: { color: tickColor }
                },
                y1: {
                    type: 'linear',
                    position: 'right',
                    title: { display: true, text: 'Śr. kcal spożyte/dzień', color: tickColor },
                    ticks: { color: tickColor },
                    grid: { drawOnChartArea: false }
                },
                x: { ticks: { color: tickColor } }
            }
        }
    });
}
