

import { initializeApp, getApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCG4hkpBWL2chZKjcDSox3N8VOb5Cr9qrA",
  authDomain: "questionnaire-b99ce.firebaseapp.com",
  projectId: "questionnaire-b99ce",
  storageBucket: "questionnaire-b99ce.firebasestorage.app",
  messagingSenderId: "147617113820",
  appId: "1:147617113820:web:1aa1eed772bcd27145b619",
  measurementId: "G-L66VLSTCKZ"
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db };