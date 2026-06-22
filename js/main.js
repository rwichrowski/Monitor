// Ustawienia, nawigacja zakładek i start aplikacji.

function saveTDEE(val) {
    localStorage.setItem('tdee', val);
}

function switchTab(n) {
    [1, 2, 3].forEach(i => {
        document.getElementById(`tab${i}`).classList.toggle('hidden', n !== i);
        const btn = document.getElementById(`tab${i}Btn`);
        btn.classList.toggle('bg-blue-600', n === i);
        btn.classList.toggle('text-white', n === i);
        btn.classList.toggle('bg-slate-800', n !== i);
        btn.classList.toggle('text-slate-400', n !== i);
    });
    if (n === 3) loadMonthlyTab();
}

window.onload = () => {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('weightDate').value = today;
    document.getElementById('weightDate').addEventListener('change', (e) => {
        fillFormForDate(e.target.value);
    });
    document.getElementById('activityDate').value = today;
    document.getElementById('activityDate').addEventListener('change', (e) => {
        fillActivityFormForDate(e.target.value);
    });
    const savedTDEE = localStorage.getItem('tdee');
    if (savedTDEE) document.getElementById('tdeeValue').value = savedTDEE;
    initFirebase();
};
