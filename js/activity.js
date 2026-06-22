// Kalkulator spalonych kalorii (metoda MET).

function calcBurnedCalories(activity, quantity) {
    const weight = weightEntries.length > 0
        ? weightEntries[weightEntries.length - 1].weight
        : 117;
    const MET = { trucht: 8.7, rower: 7.5, silownia: 4.0 }[activity];
    const hours = activity === 'trucht' ? quantity / (60 / 7)
                : activity === 'rower'  ? quantity / 18
                : quantity / 60;
    return Math.round(MET * weight * hours);
}

// Przelicza spalone kalorie z trzech pól (trucht/rower/siłownia) metodą MET
// i wpisuje sumę do pola "Spalone kalorie". Wołane z oninput każdego pola.
window.recalcBurned = () => {
    const trucht = parseFloat(document.getElementById('truchtValue').value) || 0;
    const rower = parseFloat(document.getElementById('rowerValue').value) || 0;
    const silownia = parseFloat(document.getElementById('silowniaValue').value) || 0;
    activityAcc = { trucht, rower, silownia };
    const burned =
        (trucht > 0 ? calcBurnedCalories('trucht', trucht) : 0) +
        (rower > 0 ? calcBurnedCalories('rower', rower) : 0) +
        (silownia > 0 ? calcBurnedCalories('silownia', silownia) : 0);
    document.getElementById('burnedCaloriesValue').value = burned || '';
};
