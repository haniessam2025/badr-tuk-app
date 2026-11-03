import { doc, onSnapshot } from 'firebase/firestore';
import { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { db } from '../firebase'; // تأكد إن ده مسار الفايربيز الصح
export const useApp = () => useContext(AppContext);
// 1. تعريف شكل البيانات عشان TypeScript
export const AppContext = createContext<any>(null);

import AsyncStorage from '@react-native-async-storage/async-storage';

export const AppProvider = ({ children }: { children: ReactNode }) => {
  // متغيراتك الحالية (زي بيانات الرحلة أو الكابتن)
  const [activeRide, setActiveRide] = useState(null);
  const [user, setUser] = useState(null);

  // 🌟 إعدادات التطبيق الأساسية (الوضع الداكن والاهتزاز) 🌟
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isVibrationEnabled, setIsVibrationEnabled] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem('isDarkMode').then(v => { if (v) setIsDarkMode(JSON.parse(v)); });
    AsyncStorage.getItem('isVibrationEnabled').then(v => { if (v) setIsVibrationEnabled(JSON.parse(v)); });
  }, []);

  const toggleTheme = () => {
    setIsDarkMode(prev => {
      const newVal = !prev;
      AsyncStorage.setItem('isDarkMode', JSON.stringify(newVal)).catch(() => {});
      return newVal;
    });
  };

  const toggleVibration = () => {
    setIsVibrationEnabled(prev => {
      const newVal = !prev;
      AsyncStorage.setItem('isVibrationEnabled', JSON.stringify(newVal)).catch(() => {});
      return newVal;
    });
  };

  // 🌟 هنا المتغير الجديد اللي هيشيل كل إعدادات اللوحة 🌟
  const [appSettings, setAppSettings] = useState({
    isMaintenanceEnabled: false,
    debtLimit: -50,
    waitingTime: 5,
    searchRadius: 5,
    cancelLimit: 3,
    isPeakEnabled: false,
    peakMultiplier: 1.5,
    isCashEnabled: true,
    isWalletEnabled: true,
    isInstapayEnabled: true,
  });

  // 2. المستمع اللي بيقرأ من اللوحة (Firebase) لايف
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', 'pricing'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setAppSettings({
          isMaintenanceEnabled: data.isMaintenanceEnabled || false,
          debtLimit: Number(data.debtLimit) || -50,
          waitingTime: Number(data.waitingTime) || 5,
          searchRadius: Number(data.searchRadius) || 5,
          cancelLimit: Number(data.cancelLimit) || 3,
          isPeakEnabled: data.isPeakEnabled || false,
          peakMultiplier: Number(data.peakMultiplier) || 1.5,
          isCashEnabled: data.isCashEnabled ?? true,
          isWalletEnabled: data.isWalletEnabled ?? true,
          isInstapayEnabled: data.isInstapayEnabled ?? true,
        });
      }
    });

    return () => unsub(); // تنظيف المستمع لما التطبيق يتقفل
  }, []);

  return (
    <AppContext.Provider value={{ 
      activeRide, 
      setActiveRide, 
      user, 
      setUser, 
      appSettings,
      isDarkMode,      // 👈 تم الإضافة
      toggleTheme,     // 👈 تم الإضافة
      isVibrationEnabled, // 👈 تم الإضافة
      toggleVibration  // 👈 تم الإضافة
    }}>
      {children}
    </AppContext.Provider>
  );
};