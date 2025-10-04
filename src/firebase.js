// Firebase-konfiguration
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Firebase-konfiguration från miljövariabler
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY_NEW || import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyAVzBrUtELAy6MjMhH7ap_ommh6kk4BBOo',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'kompistorn.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'kompistoren',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'kompistorn.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '144829688897',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:144829688897:web:d433bf2d5ab3c193f6eac0'
};

// Kontrollera om Firebase är korrekt konfigurerad
const isConfigured = firebaseConfig.apiKey && firebaseConfig.projectId;

if (!isConfigured) {
  console.error('Firebase configuration is missing. Please check your environment variables.');
  console.log('Available env vars:', {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY ? 'SET' : 'MISSING',
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ? 'SET' : 'MISSING',
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ? 'SET' : 'MISSING',
  });
}

// Initiera Firebase (endast en gång)
let app;
let auth;
let db;

if (isConfigured) {
  if (!getApps().length) {
    app = initializeApp(firebaseConfig);
  } else {
    app = getApp();
  }
  
  // Exportera Firebase-tjänster
  auth = getAuth(app);
  db = getFirestore(app);
} else {
  console.warn('Firebase not initialized due to missing configuration');
}

export { auth, db };
export default app;
