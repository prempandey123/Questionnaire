

import { initializeApp, getApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyBw8R0I1JS-aiKFkXJ41_x7M367Cct1Tf8",
  authDomain: "herosteels-quiz.firebaseapp.com",
  projectId: "herosteels-quiz",
  storageBucket: "herosteels-quiz.firebasestorage.app",
  messagingSenderId: "787656898836",
  appId: "1:787656898836:web:ea9846107a045a02122a01",
  measurementId: "G-N182PJLLDZ"
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db };