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
    const dateInput = document.getElementById('weightDate');
    const weight = parseFloat(weightInput.value);
    const calories = parseInt(caloriesInput.value);
    const date = dateInput.value;

    if (!currentUser || isNaN(weight) || !date) {
        showToast("Wprowadź poprawne dane");
        return;
    }

    try {
        const uid = (typeof userId !== 'undefined') ? userId : currentUser.uid;
        // merge: aktywność dnia (zakładka 2) zapisywana osobno — nie nadpisujemy jej
        await db.collection('artifacts').doc(appId)
            .collection('users').doc(uid)
            .collection('weights').doc(date).set({
                date,
                weight,
                calories: isNaN(calories) ? null : calories,
                timestamp: Date.now()
            }, { merge: true });
        showToast("Zapisano!");
    } catch (e) {
        showToast("Błąd zapisu");
    }
};

window.saveActivity = async () => {
    const dateInput = document.getElementById('activityDate');
    const burnedInput = document.getElementById('burnedCaloriesValue');
    const pullupsInput = document.getElementById('pullupsValue');
    const pushupsInput = document.getElementById('pushupsValue');
    const rollerAbInput = document.getElementById('rollerAbValue');
    const date = dateInput.value;
    const burnedCalories = parseInt(burnedInput.value);
    const pullups = parseInt(pullupsInput.value);
    const pushups = parseInt(pushupsInput.value);
    const rollerAb = parseInt(rollerAbInput.value);

    if (!currentUser || !date) {
        showToast("Wybierz datę");
        return;
    }

    try {
        const uid = (typeof userId !== 'undefined') ? userId : currentUser.uid;
        // merge: nie nadpisujemy wagi/kalorii zapisanych w zakładce 1.
        // Spalone kalorie liczone tylko z truchtu/roweru/siłowni — podciągnięcia i pompki ich nie zwiększają.
        await db.collection('artifacts').doc(appId)
            .collection('users').doc(uid)
            .collection('weights').doc(date).set({
                date,
                burnedCalories: isNaN(burnedCalories) ? null : burnedCalories,
                trucht_km: activityAcc.trucht || null,
                rower_km: activityAcc.rower || null,
                silownia_min: activityAcc.silownia || null,
                podciagniecia: isNaN(pullups) ? null : pullups,
                pompki: isNaN(pushups) ? null : pushups,
                roller_ab: isNaN(rollerAb) ? null : rollerAb,
                timestamp: Date.now()
            }, { merge: true });
        showToast("Zapisano aktywność!");
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
