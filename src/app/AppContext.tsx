import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from 'react';

type AppContextType = {
  isDarkMode: boolean;
  isVibrationEnabled: boolean;
  toggleTheme: (value: boolean) => void;
  toggleVibration: (value: boolean) => void;
};

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider = ({ children }: { children: React.ReactNode }) => {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isVibrationEnabled, setIsVibrationEnabled] = useState(true);

  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const savedTheme = await AsyncStorage.getItem('app_theme');
        const savedVib = await AsyncStorage.getItem('app_vibration');
        
        if (savedTheme === 'dark') setIsDarkMode(true);
        if (savedVib === 'disabled') setIsVibrationEnabled(false);
      } catch (error) {
        console.log("Error loading prefs", error);
      }
    };
    loadPreferences();
  }, []);

  const toggleTheme = async (value: boolean) => {
    setIsDarkMode(value);
    await AsyncStorage.setItem('app_theme', value ? 'dark' : 'light');
  };

  const toggleVibration = async (value: boolean) => {
    setIsVibrationEnabled(value);
    await AsyncStorage.setItem('app_vibration', value ? 'enabled' : 'disabled');
  };

  return (
    <AppContext.Provider value={{ isDarkMode, isVibrationEnabled, toggleTheme, toggleVibration }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
};