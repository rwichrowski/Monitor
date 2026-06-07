// Archiwum miesięczne — agregaty aktywności pre-liczone w Firestore.

function monthlySummariesRef() {
    return db.collection('artifacts').doc(appId)
             .collection('users').doc(getUid())
             .collection('monthly_summaries');
}

function monthKeyFromDate(dateStr) {
    return dateStr.slice(0, 7);
}

function formatMonthLabel(mk) {
    const names = ['Styczeń','Luty','Marzec','Kwiecień','Maj','Czerwiec',
                   'Lipiec','Sierpień','Wrzesień','Październik','Listopad','Grudzień'];
    const [year, month] = mk.split('-');
    return `${names[parseInt(month) - 1]} ${year}`;
}

function computeMonthFromEntries(month) {
    const entries = weightEntries.filter(e => e.date.startsWith(month));
    return {
        month,
        trucht_km: +entries.reduce((s, e) => s + (e.trucht_km || 0), 0).toFixed(2),
        rower_km: +entries.reduce((s, e) => s + (e.rower_km || 0), 0).toFixed(2),
        silownia_min: entries.reduce((s, e) => s + (e.silownia_min || 0), 0),
        days_count: entries.length
    };
}

async function loadMonthlyTab() {
    const body = document.getElementById('monthlyBody');
    body.innerHTML = `<tr><td colspan="5" class="py-8 text-center opacity-40 text-sm">Ładowanie...</td></tr>`;

    const snap = await monthlySummariesRef().orderBy('month', 'desc').get();
    const summaries = {};
    snap.docs.forEach(doc => { summaries[doc.id] = doc.data(); });

    const currentMonth = new Date().toISOString().slice(0, 7);
    const live = computeMonthFromEntries(currentMonth);
    live.isLive = true;
    summaries[currentMonth] = live;

    renderMonthlyTable(summaries);
}

function renderMonthlyTable(summaries) {
    const body = document.getElementById('monthlyBody');
    const months = Object.keys(summaries).sort().reverse();

    const hasAny = months.some(m => {
        const s = summaries[m];
        return s.trucht_km > 0 || s.rower_km > 0 || s.silownia_min > 0;
    });

    if (!hasAny) {
        body.innerHTML = `<tr><td colspan="5" class="py-8 text-center opacity-40 text-sm">Brak danych o aktywności</td></tr>`;
        return;
    }

    body.innerHTML = months.map(m => {
        const s = summaries[m];
        const liveTag = s.isLive
            ? `<span class="text-[10px] bg-blue-900/50 text-blue-400 px-1.5 py-0.5 rounded ml-2">bieżący</span>`
            : '';
        return `
        <tr class="border-b border-slate-700/50 hover:bg-slate-700/20 transition-colors">
            <td class="py-3 px-4 font-semibold">${formatMonthLabel(m)}${liveTag}</td>
            <td class="py-3 px-4 font-bold text-blue-400">${s.trucht_km > 0 ? s.trucht_km.toFixed(1) + ' km' : '-'}</td>
            <td class="py-3 px-4 font-bold text-green-400">${s.rower_km > 0 ? s.rower_km.toFixed(1) + ' km' : '-'}</td>
            <td class="py-3 px-4 font-bold text-purple-400">${s.silownia_min > 0 ? s.silownia_min + ' min' : '-'}</td>
            <td class="py-3 px-4 text-slate-400 text-xs">${s.days_count || 0} dni</td>
        </tr>`;
    }).join('');
}

window.recomputeAllMonths = async () => {
    const btn = document.getElementById('recomputeBtn');
    btn.disabled = true;
    btn.textContent = 'Przeliczanie...';
    try {
        const existingSnap = await monthlySummariesRef().get();
        const hasHistory = existingSnap.size > 0;
        const currentMonth = new Date().toISOString().slice(0, 7);
        const batch = db.batch();
        const ref = monthlySummariesRef();

        if (hasHistory) {
            // Są dane historyczne — odśwież tylko poprzedni miesiąc (aktualny jest zawsze live)
            const prevDate = new Date();
            prevDate.setDate(1);
            prevDate.setMonth(prevDate.getMonth() - 1);
            const prevMonth = prevDate.toISOString().slice(0, 7);
            const nextMk = currentMonth;

            const snap = await db.collection('artifacts').doc(appId)
                                 .collection('users').doc(getUid())
                                 .collection('weights')
                                 .where('date', '>=', prevMonth + '-01')
                                 .where('date', '<', nextMk + '-01')
                                 .get();
            if (!snap.empty) {
                const entries = snap.docs.map(d => d.data());
                batch.set(ref.doc(prevMonth), {
                    month: prevMonth,
                    trucht_km: +entries.reduce((s, e) => s + (e.trucht_km || 0), 0).toFixed(2),
                    rower_km: +entries.reduce((s, e) => s + (e.rower_km || 0), 0).toFixed(2),
                    silownia_min: entries.reduce((s, e) => s + (e.silownia_min || 0), 0),
                    days_count: entries.length,
                    computed_at: Date.now()
                });
            }
        } else {
            // Brak historii — pobierz wszystko i zaagreguj po miesiącach
            const snap = await db.collection('artifacts').doc(appId)
                                 .collection('users').doc(getUid())
                                 .collection('weights')
                                 .orderBy('date').get();
            const byMonth = {};
            snap.docs.forEach(doc => {
                const e = doc.data();
                const mk = monthKeyFromDate(e.date);
                if (!byMonth[mk]) byMonth[mk] = [];
                byMonth[mk].push(e);
            });
            Object.entries(byMonth).forEach(([month, entries]) => {
                if (month >= currentMonth) return; // aktualny miesiąc zawsze live
                batch.set(ref.doc(month), {
                    month,
                    trucht_km: +entries.reduce((s, e) => s + (e.trucht_km || 0), 0).toFixed(2),
                    rower_km: +entries.reduce((s, e) => s + (e.rower_km || 0), 0).toFixed(2),
                    silownia_min: entries.reduce((s, e) => s + (e.silownia_min || 0), 0),
                    days_count: entries.length,
                    computed_at: Date.now()
                });
            });
        }

        await batch.commit();
        showToast('Przeliczono!');
        await loadMonthlyTab();
    } catch (e) {
        showToast('Błąd przeliczania');
        console.error(e);
    } finally {
        btn.disabled = false;
        btn.textContent = 'Przelicz historię';
    }
};
