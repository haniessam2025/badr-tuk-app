import { Stack } from 'expo-router';
import { LogBox } from 'react-native';

// هنوقف استدعاء الفايربيز مؤقتاً بالكومنت ده لحد ما نختبر الشاشات
// import '../firebase';
// إخفاء التحذيرات
LogBox.ignoreAllLogs(true);

export default function RootLayout() {
  return (
    // السطر ده لوحده كفيل يقرأ كل الشاشات اللي في الفولدر أوتوماتيك من غير ما ترصهم!
    <Stack screenOptions={{ headerShown: false }} />
  );
}