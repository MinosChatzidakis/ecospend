import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, setDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyAq5yRzXLef7_kET4uT650u00szAkatk3Q",
  authDomain: "ecospend-ea875.firebaseapp.com",
  projectId: "ecospend-ea875",
  storageBucket: "ecospend-ea875.firebasestorage.app",
  messagingSenderId: "523290459744",
  appId: "1:523290459744:web:bf586e266759cfce760d05"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const newProducts = [
  {
    "name": "ΒΙΚΟΣ ΦΥΣ.ΜΕΤΑΛΛΙΚΟ ΝΕΡΟ 500ML",
    "productCode": "040410",
    "category": "Τρόφιμα",
    "price": 0.16,
    "ecoRating": "A",
    "swapSuggestion": null
  },
  {
    "name": "ΙΟΝ ΣΟΚΟΦΡΕΤΑ 38ΓΡ",
    "productCode": "005421",
    "category": "Snacks/Αλκοόλ",
    "price": 0.51,
    "ecoRating": "D",
    "swapSuggestion": "ΜΑΥΡΗ ΣΟΚΟΛΑΤΑ (FAIR TRADE)"
  },
  {
    "name": "JANNIS ΠΑΣΤΕΛΙ ΣΟΥΣΑΜΙ & ΜΕΛΙ",
    "productCode": "000948",
    "category": "Snacks/Αλκοόλ",
    "price": 1.53,
    "ecoRating": "B",
    "swapSuggestion": null
  },
  {
    "name": "ΡΟΔΟΠΗ ΓΙΑΟΥΡΤΙ ΚΑΤΣΙΚ.4,6% ΛΙ",
    "productCode": "051718",
    "category": "Τρόφιμα",
    "price": 1.45,
    "ecoRating": "A",
    "swapSuggestion": null
  },
  {
    "name": "ΠΑΠΑΔΟΠΟΥΛΟΣ D.BAR MAXI PROTEI",
    "productCode": "058839",
    "category": "Snacks/Αλκοόλ",
    "price": 1.44,
    "ecoRating": "C",
    "swapSuggestion": "ΣΠΙΤΙΚΗ ΜΠΑΡΑ ΔΗΜΗΤΡΙΑΚΩΝ"
  },
  {
    "name": "HUNGRY NOT ΜΠΑΡ ΠΡΩΤ ΦΙΣΤΙΚ&ΜΠ",
    "productCode": "059818",
    "category": "Snacks/Αλκοόλ",
    "price": 1.62,
    "ecoRating": "B",
    "swapSuggestion": null
  },
  {
    "name": "TWININGS ΤΣΑΙ EARLY GREY ΚΟΥΤΙ",
    "productCode": "012194",
    "category": "Τρόφιμα",
    "price": 3.28,
    "ecoRating": "A",
    "swapSuggestion": null
  }
];

async function seedNew() {
  const colRef = collection(db, 'products');
  for (const product of newProducts) {
    const docRef = doc(colRef, product.name);
    await setDoc(docRef, product);
    console.log(`Added NEW: ${product.name}`);
  }
  console.log('New seeding complete!');
  process.exit(0);
}

seedNew().catch(console.error);
