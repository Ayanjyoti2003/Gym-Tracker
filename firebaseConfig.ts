import AsyncStorage from "@react-native-async-storage/async-storage";
import { getApp, getApps, initializeApp } from "firebase/app";
// @ts-ignore
import { getAuth, initializeAuth, getReactNativePersistence } from "@firebase/auth";
import { initializeFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDMDI0EGvFHTxUBsmuIF_0WLKk9x8d5QI8",
  authDomain: "gym-tracker-a830b.firebaseapp.com",
  projectId: "gym-tracker-a830b",
  storageBucket: "gym-tracker-a830b.firebasestorage.app",
  messagingSenderId: "283664965101",
  appId: "1:283664965101:web:4de638652ef32a4c515be4",
  measurementId: "G-01Y1Z4JTGV",
};

// Prevent multiple Firebase instances during Fast Refresh
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

let auth: any;

try {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
} catch {
  // Auth was already initialized
  auth = getAuth(app);
}

const db = initializeFirestore(app, {});

export { app, auth, db };
