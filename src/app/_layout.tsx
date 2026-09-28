import { Stack } from 'expo-router';
import { LogBox } from 'react-native';
import { AppProvider } from './AppContext'; // 👈 استدعاء العقل المركزي

// هنوقف استدعاء الفايربيز مؤقتاً بالكومنت ده لحد ما نختبر الشاشات
// import '../firebase';

// إخفاء التحذيرات
LogBox.ignoreAllLogs(true);

export default function RootLayout() {
  return (
    <AppProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </AppProvider>
  );
}