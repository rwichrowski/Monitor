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

window.addActivityCalc = () => {
    const activity = document.getElementById('activitySelect').value;
    const quantity = parseFloat(document.getElementById('activityQuantity').value);
    if (isNaN(quantity) || quantity <= 0) return;
    const burned = calcBurnedCalories(activity, quantity);
    const current = parseInt(document.getElementById('burnedCaloriesValue').value) || 0;
    document.getElementById('burnedCaloriesValue').value = current + burned;
    document.getElementById('activityQuantity').value = '';
    activityAcc[activity] = +(activityAcc[activity] + quantity).toFixed(2);
    updateActivityDisplay();
    showToast(`+${burned} kcal spalonych`);
};
