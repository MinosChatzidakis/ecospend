import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyAq5yRzXLef7_kET4uT650u00szAkatk3Q",
  authDomain: "ecospend-ea875.firebaseapp.com",
  projectId: "ecospend-ea875",
  storageBucket: "ecospend-ea875.firebasestorage.app",
  messagingSenderId: "523290459744",
  appId: "1:523290459744:web:bf586e266759cfce760d05",
  measurementId: "G-S0E8XER4M4"
};

const app = initializeApp(firebaseConfig);

// Use standard getAuth. It automatically handles persistence perfectly on the Web.
const auth = getAuth(app);
const db = getFirestore(app);

export { auth, db };
