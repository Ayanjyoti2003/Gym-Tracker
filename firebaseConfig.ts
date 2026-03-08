import { getApp, getApps, initializeApp } from 'firebase/app';
import { initializeAuth } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
// @ts-ignore - TS incorrectly flags this missing export, though it works perfectly at runtime in RN/Expo!
import { getReactNativePersistence } from 'firebase/auth';

// Your web app's Firebase configuration
// REPLACE THESE with the actual config from your Firebase project console
const firebaseConfig = {
  apiKey: "AIzaSyDMDI0EGvFHTxUBsmuIF_0WLKk9x8d5QI8",
  authDomain: "gym-tracker-a830b.firebaseapp.com",
  projectId: "gym-tracker-a830b",
  storageBucket: "gym-tracker-a830b.firebasestorage.app",
  messagingSenderId: "283664965101",
  appId: "1:283664965101:web:4de638652ef32a4c515be4",
  measurementId: "G-01Y1Z4JTGV"
};



// Initialize Firebase
// We check if apps already exist to avoid re-initializing during Fast Refresh in Expo
let app;
if (getApps().length === 0) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp();
}

// Initialize Auth with AsyncStorage for persistence across app restarts
const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage)
});

// Initialize Firestore
// React Native does not support true IndexedDB persistence out of the box with the Web SDK
// We rely on AsyncStorage for our manual offline support in lib/storage.ts anyway
const db = initializeFirestore(app, {});

export { app, auth, db };
