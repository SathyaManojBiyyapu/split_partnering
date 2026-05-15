import { initializeApp, getApps } from "firebase/app";

import {
  getAuth,
  GoogleAuthProvider,
} from "firebase/auth";

import { getFirestore } from "firebase/firestore";

/* ---------------- FIREBASE CONFIG ---------------- */

const firebaseConfig = {
  apiKey: "AIzaSyBx11nyHmS-xw1jyeDEX_Qxsd4cGhJqk18",

  authDomain:
    "splitpartnering.firebaseapp.com",

  projectId: "splitpartnering",

  storageBucket:
    "splitpartnering.firebasestorage.app",

  messagingSenderId: "656417651216",

  appId:
    "1:656417651216:web:cd20cd09120190171ea895",

  measurementId: "G-Z9LQZ49T2B",
};

/* ---------------- PREVENT REINITIALIZATION ---------------- */

const app =
  getApps().length === 0
    ? initializeApp(firebaseConfig)
    : getApps()[0];

/* ---------------- SERVICES ---------------- */

export const auth = getAuth(app);

export const db = getFirestore(app);

export const googleProvider =
  new GoogleAuthProvider();