// Połączenie z Firebase, logowanie i dostęp do danych (Firestore).

const initFirebase = async () => {
    const statusText = document.getElementById('statusText');
    const statusIcon = document.getElementById('statusIcon');

    if (typeof firebaseConfig === 'undefined') {
        statusText.innerText = "Brak pliku config.js!";
        statusIcon.classList.add('text-red-500');
        return;
    }

    firebase.initializeApp(firebaseConfig);
    auth = firebase.auth();
    db = firebase.firestore();

    try {
        await auth.signInAnonymously();

        auth.onAuthStateChanged((user) => {
            if (user) {
                currentUser = user;
                statusIcon.classList.add('text-green-500', 'animate-pulse');
                statusText.innerText = "Połączono z Firebase";
                startSync();
            }
        });
    } catch (error) {
        console.error("Auth Error:", error);
        statusText.innerText = "Błąd autoryzacji";
    }
};

const startSync = () => {
    const uid = (typeof userId !== 'undefined') ? userId : currentUser.uid;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    const cutoffDate = cutoff.toISOString().split('T')[0];

    const path = db.collection('artifacts').doc(appId)
                   .collection('users').doc(uid)
                   .collection('weights')
                   .where('date', '>=', cutoffDate);

    path.onSnapshot((snapshot) => {
        weightEntries = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        weightEntries.sort((a, b) => new Date(a.date) - new Date(b.date));
        updateUI();
    }, (error) => {
        console.error("Firestore error:", error);
    });
};

window.addEntry = async () => {
    const weightInput = document.getElementById('weightValue');
    const caloriesInput = document.getElementById('caloriesValue');
    const burnedInput = document.getElementById('burnedCaloriesValue');
    const dateInput = document.getElementById('weightDate');
    const weight = parseFloat(weightInput.value);
    const calories = parseInt(caloriesInput.value);
    const burnedCalories = parseInt(burnedInput.value);
    const date = dateInput.value;

    if (!currentUser || isNaN(weight) || !date) {
        showToast("Wprowadź poprawne dane");
        return;
    }

    try {
        const uid = (typeof userId !== 'undefined') ? userId : currentUser.uid;
        await db.collection('artifacts').doc(appId)
            .collection('users').doc(uid)
            .collection('weights').doc(date).set({
                date,
                weight,
                calories: isNaN(calories) ? null : calories,
                burnedCalories: isNaN(burnedCalories) ? null : burnedCalories,
                trucht_km: activityAcc.trucht || null,
                rower_km: activityAcc.rower || null,
                silownia_min: activityAcc.silownia || null,
                timestamp: Date.now()
            });
        showToast("Zapisano!");
    } catch (e) {
        showToast("Błąd zapisu");
    }
};

window.deleteEntry = async (id) => {
    if (!confirm(`Usunąć wpis z dnia ${id}?`)) return;
    try {
        const uid = (typeof userId !== 'undefined') ? userId : currentUser.uid;
        await db.collection('artifacts').doc(appId)
            .collection('users').doc(uid)
            .collection('weights').doc(id).delete();
        showToast("Usunięto");
    } catch (e) { showToast("Błąd usuwania"); }
};

function getUid() {
    return (typeof userId !== 'undefined') ? userId : currentUser.uid;
}
