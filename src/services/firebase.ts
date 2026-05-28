import { initializeApp } from 'firebase/app';
// @ts-ignore
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

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

// @ts-ignore - type definitions might be missing in this exact version
const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage)
});
const db = getFirestore(app);

export { auth, db };
