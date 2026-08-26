import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth, getReactNativePersistence, initializeAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDq5trvT-Hfw1y7nwllqe3a2A0uf9AevOS",
  authDomain: "badr-cute.firebaseapp.com",
  projectId: "badr-cute",
  storageBucket: "badr-cute.appspot.com",
  messagingSenderId: "520549143229",
  appId: "1:520549143229:web:78217432829541a23f1dd4"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

let authInstance;
try {
  authInstance = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
} catch (e) {
  authInstance = getAuth(app);
}

export const auth = authInstance;
export const db = getFirestore(app);