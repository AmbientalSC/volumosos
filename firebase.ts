// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAuth, signInAnonymously, onAuthStateChanged } from "firebase/auth";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBXyIEcFNt6q0dIxlEyxnq-leNRdA17Cls",
  authDomain: "volumosos-d81a1.firebaseapp.com",
  projectId: "volumosos-d81a1",
  storageBucket: "volumosos-d81a1.firebasestorage.app",
  messagingSenderId: "737889001008",
  appId: "1:737889001008:web:d02789a273994e951957f5",
  measurementId: "G-42YK47YXD2"
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

export const db = getFirestore(app);
export const storage = getStorage(app);