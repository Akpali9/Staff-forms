import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

  const firebaseConfig = {
    apiKey: "AIzaSyBlwtRmabCPMU43QJ54h1Fm8nvmhsW98Hc",
    authDomain: "staff-b8ba6.firebaseapp.com",
    projectId: "staff-b8ba6",
    storageBucket: "staff-b8ba6.firebasestorage.app",
    messagingSenderId: "191077343426",
    appId: "1:191077343426:web:c872a0462df4db14999b5b",
    measurementId: "G-XRS939MXBL"
  };

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
