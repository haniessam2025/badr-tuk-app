import { Stack } from 'expo-router';
import { LogBox } from 'react-native';
import '../firebaseConfig';

// إخفاء كل التحذيرات والرسائل الصفراء غير الهامة من الشاشة
LogBox.ignoreAllLogs(true);

export default function RootLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="welcome" />
      <Stack.Screen name="role" />
      
      {/* شاشات الراكب الجديدة */}
      <Stack.Screen name="passenger-choice" />
      <Stack.Screen name="passenger-signup" />
      <Stack.Screen name="passenger-login" />
      <Stack.Screen name="passenger-home" />
      <Stack.Screen name="passenger-profile" />
      
      {/* شاشات الكابتن */}
      <Stack.Screen name="captain-choice" />
      <Stack.Screen name="captain-signup" />
      <Stack.Screen name="captain-login" />
      <Stack.Screen name="captain-home" />
      <Stack.Screen name="captain-profile" />
      
      {/* شاشة الشات المشتركة */}
      <Stack.Screen name="chat" />
    </Stack>
  );
}