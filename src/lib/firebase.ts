import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, initializeFirestore, persistentLocalCache } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

// Inicializamos de forma segura para Next.js
let firestoreDb;

if (!getApps().length) {
  const app = initializeApp(firebaseConfig);
  // Activamos la caché persistente offline
  firestoreDb = initializeFirestore(app, {
    localCache: persistentLocalCache()
  });
} else {
  const app = getApp();
  firestoreDb = getFirestore(app);
}

// Exportamos como constante para que ninguna página falle
export const db = firestoreDb;