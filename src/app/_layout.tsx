import * as Notifications from 'expo-notifications';
import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { LogBox } from 'react-native';

// هنوقف استدعاء الفايربيز مؤقتاً بالكومنت ده لحد ما نختبر الشاشات
// import '../firebase';

// إخفاء التحذيرات
LogBox.ignoreAllLogs(true);

export default function RootLayout() {
  
  useEffect(() => {
    // إنشاء قناة الإشعارات وتحديد الصوت الخاص بيها أول ما التطبيق يفتح
    Notifications.setNotificationChannelAsync('badr-alerts', {
      name: 'Badr TukTuk Alerts',
      importance: Notifications.AndroidImportance.MAX,
      sound: 'badr_alert.mp3', // اسم ملف الصوت اللي هيشتغل
    });
  }, []);

  return (
    // السطر ده لوحده كفيل يقرأ كل الشاشات اللي في الفولدر أوتوماتيك من غير ما ترصهم!
    <Stack screenOptions={{ headerShown: false }} />
  );
}