import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from 'react';

interface AppContextType {
  isDarkMode: boolean;
  toggleDarkMode: () => void;
  isVibrationEnabled: boolean;
  toggleVibration: () => void;
}

const AppContext = createContext<AppContextType>({
  isDarkMode: false,
  toggleDarkMode: () => {},
  isVibrationEnabled: true,
  toggleVibration: () => {},
});

export const AppProvider = ({ children }: { children: React.ReactNode }) => {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isVibrationEnabled, setIsVibrationEnabled] = useState(true);

  // استرجاع الإعدادات عند فتح التطبيق
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const storedTheme = await AsyncStorage.getItem('isDarkMode');
        if (storedTheme !== null) setIsDarkMode(JSON.parse(storedTheme));
        
        const storedVibration = await AsyncStorage.getItem('isVibrationEnabled');
        if (storedVibration !== null) setIsVibrationEnabled(JSON.parse(storedVibration));
      } catch (e) {
        console.log("Error loading settings:", e);
      }
    };
    loadSettings();
  }, []);

  // دالة الإجبار على تغيير الوضع الداكن
  const toggleDarkMode = async () => {
    setIsDarkMode((prevMode) => {
      const newMode = !prevMode;
      AsyncStorage.setItem('isDarkMode', JSON.stringify(newMode)).catch(e => console.log(e));
      return newMode;
    });
  };

  // دالة الإجبار على تغيير الاهتزاز
  const toggleVibration = async () => {
    setIsVibrationEnabled((prevVib) => {
      const newVib = !prevVib;
      AsyncStorage.setItem('isVibrationEnabled', JSON.stringify(newVib)).catch(e => console.log(e));
      return newVib;
    });
  };

  return (
    <AppContext.Provider value={{ isDarkMode, toggleDarkMode, isVibrationEnabled, toggleVibration }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => useContext(AppContext);