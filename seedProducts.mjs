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

const products = [
  {
    "name": "ΝΕΡΟ ΕΜΦΙΑΛΩΜΕΝΟ 6X1.5L",
    "productCode": "100001",
    "category": "Τρόφιμα",
    "price": 1.70,
    "ecoRating": "D",
    "swapSuggestion": "ΠΑΓΟΥΡΙ ΠΟΛΛΑΠΛΩΝ ΧΡΗΣΕΩΝ"
  },
  {
    "name": "ΚΑΨΟΥΛΕΣ ΚΑΦΕ ESPRESSO 10ΤΜΧ",
    "productCode": "100002",
    "category": "Τρόφιμα",
    "price": 3.50,
    "ecoRating": "D",
    "swapSuggestion": "ΚΑΦΕΣ ΦΙΛΤΡΟΥ Η ΒΙΟΔΙΑΣΠΩΜΕΝΕΣ ΚΑΨΟΥΛΕΣ"
  },
  {
    "name": "ΜΟΣΧΑΡΙΣΙΟΣ ΚΙΜΑΣ 500G",
    "productCode": "100003",
    "category": "Τρόφιμα",
    "price": 5.80,
    "ecoRating": "D",
    "swapSuggestion": "ΚΙΜΑΣ ΚΟΤΟΠΟΥΛΟ Η ΚΙΜΑΣ ΣΟΓΙΑΣ"
  },
  {
    "name": "ΚΙΜΑΣ ΚΟΤΟΠΟΥΛΟ 500G",
    "productCode": "100004",
    "category": "Τρόφιμα",
    "price": 4.50,
    "ecoRating": "B",
    "swapSuggestion": null
  },
  {
    "name": "ΑΥΓΑ ΑΧΥΡΩΝΑ 6ΑΔΑ",
    "productCode": "100005",
    "category": "Τρόφιμα",
    "price": 2.20,
    "ecoRating": "C",
    "swapSuggestion": "ΑΥΓΑ ΕΛΕΥΘΕΡΑΣ ΒΟΣΚΗΣ"
  },
  {
    "name": "ΑΥΓΑ ΕΛΕΥΘΕΡΑΣ ΒΟΣΚΗΣ 6ΑΔΑ",
    "productCode": "100006",
    "category": "Τρόφιμα",
    "price": 2.80,
    "ecoRating": "A",
    "swapSuggestion": null
  },
  {
    "name": "ΠΛΑΣΤΙΚΗ ΟΔΟΝΤΟΒΟΥΡΤΣΑ",
    "productCode": "100007",
    "category": "Προσωπική Φροντίδα",
    "price": 2.00,
    "ecoRating": "D",
    "swapSuggestion": "ΟΔΟΝΤΟΒΟΥΡΤΣΑ ΜΠΑΜΠΟΥ"
  },
  {
    "name": "ΟΔΟΝΤΟΒΟΥΡΤΣΑ ΜΠΑΜΠΟΥ",
    "productCode": "100008",
    "category": "Προσωπική Φροντίδα",
    "price": 2.50,
    "ecoRating": "A",
    "swapSuggestion": null
  },
  {
    "name": "ΑΠΟΣΜΗΤΙΚΟ SPRAY ΑΕΡΟΖΟΛ",
    "productCode": "100009",
    "category": "Προσωπική Φροντίδα",
    "price": 3.20,
    "ecoRating": "D",
    "swapSuggestion": "ΑΠΟΣΜΗΤΙΚΟ ROLL-ON"
  },
  {
    "name": "ΑΠΟΣΜΗΤΙΚΟ ROLL-ON",
    "productCode": "100010",
    "category": "Προσωπική Φροντίδα",
    "price": 2.90,
    "ecoRating": "B",
    "swapSuggestion": null
  },
  {
    "name": "ΣΦΟΥΓΓΑΡΙ ΚΟΥΖΙΝΑΣ ΣΥΝΘΕΤΙΚΟ",
    "productCode": "100011",
    "category": "Καθαριστικά",
    "price": 1.10,
    "ecoRating": "D",
    "swapSuggestion": "ΣΦΟΥΓΓΑΡΙ ΛΟΥΦΑ Η ΚΥΤΤΑΡΙΝΗΣ"
  },
  {
    "name": "ΜΑΚΑΡΟΝΙΑ ΣΠΑΓΓΕΤΙ NO6 500G",
    "productCode": "100012",
    "category": "Τρόφιμα",
    "price": 1.10,
    "ecoRating": "B",
    "swapSuggestion": null
  },
  {
    "name": "ΕΞΑΙΡΕΤΙΚΟ ΠΑΡΘΕΝΟ ΕΛΑΙΟΛΑΔΟ 1L",
    "productCode": "100013",
    "category": "Τρόφιμα",
    "price": 8.50,
    "ecoRating": "A",
    "swapSuggestion": null
  },
  {
    "name": "ΣΟΚΟΛΑΤΑ ΓΑΛΑΚΤΟΣ 100G",
    "productCode": "100014",
    "category": "Snacks/Αλκοόλ",
    "price": 1.20,
    "ecoRating": "C",
    "swapSuggestion": "ΜΑΥΡΗ ΣΟΚΟΛΑΤΑ (FAIR TRADE)"
  },
  {
    "name": "ΠΛΑΣΤΙΚΗ ΣΑΚΟΥΛΑ ΜΕΓΑΛΗ",
    "productCode": "100015",
    "category": "Είδη Σπιτιού",
    "price": 0.09,
    "ecoRating": "D",
    "swapSuggestion": "ΥΦΑΣΜΑΤΙΝΗ ΤΣΑΝΤΑ ΑΓΟΡΩΝ"
  }
];

async function seed() {
  const colRef = collection(db, 'products');
  for (const product of products) {
    // We use the exact Greek name as the Document ID so we can query it easily from the Scanner!
    const docRef = doc(colRef, product.name);
    await setDoc(docRef, product);
    console.log(`Added: ${product.name}`);
  }
  console.log('Seeding complete!');
  process.exit(0);
}

seed().catch(console.error);
