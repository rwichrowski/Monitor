// Renderowanie UI: formularz, dashboard, tabele i powiadomienia.

function fillFormForDate(date) {
    const entry = weightEntries.find(e => e.date === date);
    const weightInput = document.getElementById('weightValue');
    const caloriesInput = document.getElementById('caloriesValue');
    const btn = document.getElementById('addBtn');
    if (entry) {
        weightInput.value = entry.weight ?? '';
        caloriesInput.value = entry.calories ?? '';
        btn.textContent = 'Zaktualizuj wpis';
    } else {
        weightInput.value = '';
        caloriesInput.value = '';
        btn.textContent = 'Dodaj do bazy';
    }
}

// Formularz aktywności (zakładka 2) — niezależny od formularza wagi.
function fillActivityFormForDate(date) {
    const entry = weightEntries.find(e => e.date === date);
    const burnedInput = document.getElementById('burnedCaloriesValue');
    const truchtInput = document.getElementById('truchtValue');
    const rowerInput = document.getElementById('rowerValue');
    const silowniaInput = document.getElementById('silowniaValue');
    const pullupsInput = document.getElementById('pullupsValue');
    const pushupsInput = document.getElementById('pushupsValue');
    const rollerAbInput = document.getElementById('rollerAbValue');
    const btn = document.getElementById('saveActivityBtn');
    activityAcc = { trucht: 0, rower: 0, silownia: 0 };
    if (entry) {
        burnedInput.value = entry.burnedCalories ?? '';
        truchtInput.value = entry.trucht_km ?? '';
        rowerInput.value = entry.rower_km ?? '';
        silowniaInput.value = entry.silownia_min ?? '';
        pullupsInput.value = entry.podciagniecia ?? '';
        pushupsInput.value = entry.pompki ?? '';
        rollerAbInput.value = entry.roller_ab ?? '';
        activityAcc.trucht = entry.trucht_km || 0;
        activityAcc.rower = entry.rower_km || 0;
        activityAcc.silownia = entry.silownia_min || 0;
        if (btn) btn.textContent = 'Zaktualizuj aktywność';
    } else {
        burnedInput.value = '';
        truchtInput.value = '';
        rowerInput.value = '';
        silowniaInput.value = '';
        pullupsInput.value = '';
        pushupsInput.value = '';
        rollerAbInput.value = '';
        if (btn) btn.textContent = 'Zapisz aktywność';
    }
}

function updateUI() {
    renderTable();
    renderActivityTable();
    renderChart();
    renderCaloriesVsWeight();
    renderCaloriesVsWeight3();
    renderDashboard();
    fillFormForDate(document.getElementById('weightDate').value);
    fillActivityFormForDate(document.getElementById('activityDate').value);
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function renderDashboard() {
    const el = document.getElementById('dashboardSummary');
    if (!el || !weightEntries.length) return;

    const latest = weightEntries[weightEntries.length - 1];
    const prevEntry = weightEntries.length > 1 ? weightEntries[weightEntries.length - 2] : null;

    // Tile 1: Aktualna waga
    document.getElementById('dash-weight').textContent = latest.weight.toFixed(1);
    const deltaEl = document.getElementById('dash-weight-delta');
    if (prevEntry) {
        const delta = latest.weight - prevEntry.weight;
        const sign = delta > 0 ? '+' : '';
        const color = delta < 0 ? 'text-green-400' : delta > 0 ? 'text-red-400' : 'text-slate-400';
        deltaEl.textContent = `${sign}${delta.toFixed(1)} kg vs ${prevEntry.date}`;
        deltaEl.className = `text-xs mt-2 ${color}`;
    } else {
        deltaEl.textContent = 'pierwszy wpis';
        deltaEl.className = 'text-xs mt-2 opacity-40';
    }

    // Tile 2: Trend tygodniowy
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];
    const weekOldEntries = weightEntries.filter(e => e.date <= sevenDaysAgoStr && e.weight);
    const weekOldEntry = weekOldEntries.length ? weekOldEntries[weekOldEntries.length - 1] : null;

    const trendEl = document.getElementById('dash-trend');
    const trendBarEl = document.getElementById('dash-trend-bar');
    const trendSubEl = document.getElementById('dash-trend-sub');
    const trendIconEl = document.getElementById('dash-trend-icon');

    if (weekOldEntry) {
        const trend = latest.weight - weekOldEntry.weight;
        const sign = trend > 0 ? '+' : '';
        const isGood = trend <= 0;
        trendEl.textContent = `${sign}${trend.toFixed(1)}`;
        trendEl.className = `text-3xl font-bold ${isGood ? 'text-green-400' : 'text-red-400'}`;
        trendBarEl.className = `absolute top-0 left-0 right-0 h-0.5 ${isGood ? 'bg-green-500' : 'bg-red-500'}`;
        trendSubEl.textContent = `${weekOldEntry.weight.toFixed(1)} → ${latest.weight.toFixed(1)} kg (od ${weekOldEntry.date})`;
        if (trendIconEl) {
            trendIconEl.setAttribute('data-lucide', trend < 0 ? 'trending-down' : trend > 0 ? 'trending-up' : 'minus');
            trendIconEl.className = `w-4 h-4 ${isGood ? 'text-green-400' : 'text-red-400'}`;
        }
    } else {
        trendEl.textContent = 'brak';
        trendEl.className = 'text-3xl font-bold text-slate-400';
        trendSubEl.textContent = 'zbyt mało danych';
    }

    // Tile 3: Bilans kcal
    const tdee = parseInt(document.getElementById('tdeeValue').value) || 2000;
    const today = new Date().toISOString().split('T')[0];
    const todayEntry = weightEntries.find(e => e.date === today);

    const kcalEl = document.getElementById('dash-kcal');
    const kcalBarEl = document.getElementById('dash-kcal-bar');
    const kcalSubEl = document.getElementById('dash-kcal-sub');

    let kcalBalance = null;
    let kcalLabel = '';

    if (todayEntry && todayEntry.calories) {
        const net = todayEntry.calories - (todayEntry.burnedCalories || 0);
        kcalBalance = net - tdee;
        kcalLabel = `dziś: ${net} kcal netto`;
    } else {
        const last7 = weightEntries.filter(e => e.date >= sevenDaysAgoStr && e.calories);
        if (last7.length) {
            const avgNet = last7.reduce((s, e) => s + e.calories - (e.burnedCalories || 0), 0) / last7.length;
            kcalBalance = Math.round(avgNet - tdee);
            kcalLabel = `śr. 7 dni: ${Math.round(avgNet)} kcal netto`;
        }
    }

    if (kcalBalance !== null) {
        const sign = kcalBalance > 0 ? '+' : '';
        const isDeficit = kcalBalance < 0;
        kcalEl.textContent = `${sign}${kcalBalance}`;
        kcalEl.className = `text-3xl font-bold ${isDeficit ? 'text-green-400' : 'text-orange-400'}`;
        kcalBarEl.className = `absolute top-0 left-0 right-0 h-0.5 ${isDeficit ? 'bg-green-500' : 'bg-orange-500'}`;
        kcalSubEl.textContent = kcalLabel;
    } else {
        kcalEl.textContent = 'brak';
        kcalEl.className = 'text-3xl font-bold text-slate-400';
        kcalSubEl.textContent = 'brak danych kalorycznych';
    }

    el.classList.remove('opacity-0');
}

function renderTable() {
    const historyBody = document.getElementById('historyBody');
    const sorted = [...weightEntries].sort((a, b) => new Date(b.date) - new Date(a.date));
    historyBody.innerHTML = sorted.map(e => `
        <tr class="border-b border-slate-700/50 hover:bg-slate-700/20 transition-colors">
            <td class="py-3 px-4">${e.date}</td>
            <td class="py-3 px-4 font-bold text-blue-400">${e.weight.toFixed(1)} kg</td>
            <td class="py-3 px-4 font-bold text-green-400">${e.calories ? e.calories + ' kcal' : '-'}</td>
            <td class="py-3 px-4 font-bold text-orange-400">${e.burnedCalories ? e.burnedCalories + ' kcal' : '-'}</td>
            <td class="py-3 px-4 text-right">
                <button onclick="deleteEntry('${e.id}')" class="text-red-400 hover:scale-110 transition-transform">
                     <i data-lucide="trash-2" class="w-4 h-4"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

function renderActivityTable() {
    const body = document.getElementById('activityBody');
    if (!body) return;
    const sorted = [...weightEntries].sort((a, b) => new Date(b.date) - new Date(a.date));
    const rows = sorted; // pokazuj wszystkie dni, nie tylko z aktywnością

    const totalTrucht = weightEntries.reduce((s, e) => s + (e.trucht_km || 0), 0);
    const totalRower = weightEntries.reduce((s, e) => s + (e.rower_km || 0), 0);
    const totalSilownia = weightEntries.reduce((s, e) => s + (e.silownia_min || 0), 0);
    const totalPullups = weightEntries.reduce((s, e) => s + (e.podciagniecia || 0), 0);
    const totalPushups = weightEntries.reduce((s, e) => s + (e.pompki || 0), 0);
    const totalRollerAb = weightEntries.reduce((s, e) => s + (e.roller_ab || 0), 0);

    document.getElementById('sumTrucht').textContent = totalTrucht > 0 ? totalTrucht.toFixed(1) + ' km' : '-';
    document.getElementById('sumRower').textContent = totalRower > 0 ? totalRower.toFixed(1) + ' km' : '-';
    document.getElementById('sumSilownia').textContent = totalSilownia > 0 ? totalSilownia + ' min' : '-';
    document.getElementById('sumPullups').textContent = totalPullups > 0 ? totalPullups + ' szt.' : '-';
    document.getElementById('sumPushups').textContent = totalPushups > 0 ? totalPushups + ' szt.' : '-';
    document.getElementById('sumRollerAb').textContent = totalRollerAb > 0 ? totalRollerAb + ' szt.' : '-';

    if (!rows.length) {
        body.innerHTML = `<tr><td colspan="8" class="py-8 text-center opacity-40 text-sm">Brak danych — dodaj wpisy w zakładce Waga</td></tr>`;
        return;
    }
    body.innerHTML = rows.map(e => {
        const hasActivity = e.trucht_km || e.rower_km || e.silownia_min || e.podciagniecia || e.pompki || e.roller_ab;
        const rowClass = hasActivity
            ? 'border-b border-slate-700/50 hover:bg-slate-700/20 transition-colors'
            : 'border-b border-slate-700/30 hover:bg-slate-700/10 transition-colors opacity-40';
        return `
        <tr class="${rowClass}">
            <td class="py-3 px-4 text-slate-300">${e.date}</td>
            <td class="py-3 px-4 font-bold text-blue-400">${e.trucht_km ? e.trucht_km + ' km' : '-'}</td>
            <td class="py-3 px-4 font-bold text-green-400">${e.rower_km ? e.rower_km + ' km' : '-'}</td>
            <td class="py-3 px-4 font-bold text-purple-400">${e.silownia_min ? e.silownia_min + ' min' : '-'}</td>
            <td class="py-3 px-4 font-bold text-amber-400">${e.podciagniecia ? e.podciagniecia + ' szt.' : '-'}</td>
            <td class="py-3 px-4 font-bold text-rose-400">${e.pompki ? e.pompki + ' szt.' : '-'}</td>
            <td class="py-3 px-4 font-bold text-cyan-400">${e.roller_ab ? e.roller_ab + ' szt.' : '-'}</td>
            <td class="py-3 px-4 font-bold text-orange-400">${e.burnedCalories ? e.burnedCalories + ' kcal' : '-'}</td>
        </tr>`;
    }).join('');
}

function showToast(msg) {
    const toast = document.getElementById('toast');
    document.getElementById('toastMsg').innerText = msg;
    toast.classList.remove('translate-y-20', 'opacity-0');
    setTimeout(() => toast.classList.add('translate-y-20', 'opacity-0'), 3000);
}
