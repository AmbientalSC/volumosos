import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithEmailAndPassword, signOut } from "firebase/auth";

// Firebase é usado apenas para Auth (login anônimo + admin) — os dados
// (registros/imagens) foram migrados para Postgres/MinIO via API própria.
//
// Fallback para os valores originais quando as VITE_FIREBASE_* não estão definidas:
// o build do GitHub Pages (`npm run build`, usado até a VPS/Coolify ser validada 100%)
// não passa essas env vars, então sem isso o Auth quebraria no site que ainda está no ar.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyD4QSOz87-naWSPKkQCjEjlFEgWkHdczgc",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "volumosos-d6369.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "volumosos-d6369",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "371995611667",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:371995611667:web:4d5b246de19d62733f25e6",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-B4Z0JLDE85",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Auth
export const auth = getAuth(app);

// Sign in anonymously
export const signInAnonymouslyAsync = async () => {
  try {
    const userCredential = await signInAnonymously(auth);
    console.log("Usuário anônimo conectado:", userCredential.user.uid);
    return userCredential.user;
  } catch (error) {
    console.error("Erro ao fazer login anônimo:", error);
    throw error;
  }
};

// Check authentication state
export const checkAuthState = (callback: (user: any) => void) => {
  return onAuthStateChanged(auth, (user) => {
    if (user) {
      console.log("Estado de autenticação: Usuário logado", user.uid);
    } else {
      console.log("Estado de autenticação: Usuário não logado");
    }
    callback(user);
  });
};
