import React, { createContext, useContext, useState } from 'react';

// 1. تعريف شكل البيانات اللي هتكون متاحة لكل التطبيق
interface AppContextType {
  isDarkMode: boolean;
  toggleDarkMode: () => void;
}

const AppContext = createContext<AppContextType>({
  isDarkMode: false,
  toggleDarkMode: () => {},
});

// 2. الـ Provider اللي هيحيط بالتطبيق
export const AppProvider = ({ children }: { children: React.ReactNode }) => {
  const [isDarkMode, setIsDarkMode] = useState(false);

  const toggleDarkMode = () => {
    setIsDarkMode((prev) => !prev);
  };

  return (
    <AppContext.Provider value={{ isDarkMode, toggleDarkMode }}>
      {children}
    </AppContext.Provider>
  );
};

// 3. هوك مخصص للاستخدام السريع في أي شاشة
export const useApp = () => useContext(AppContext);

// 4. تصدير افتراضي (Default Export) عشان لو الـ Expo Router قرأ الملف كصفحة ميعترضش نهائياً
export default function AppContextScreen() {
  return null;
}