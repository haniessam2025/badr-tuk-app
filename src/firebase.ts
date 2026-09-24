// 1. استدعاء الدوال الأساسية من مكتبات فايربيز
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage"; // 👈 استدعاء التخزين الذي أضفته

// 2. إعدادات مشروعك
const firebaseConfig = {
  apiKey: "AIzaSy...", 
  authDomain: "badr-cute.firebaseapp.com",
  projectId: "badr-cute",
  storageBucket: "badr-cute.appspot.com",
  messagingSenderId: "...",
  appId: "..."
};

// 3. تهيئة التطبيق وتصدير الخدمات
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app); // 👈 تصدير التخزين لاستخدامه في الشات