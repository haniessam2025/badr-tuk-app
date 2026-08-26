import { Stack } from 'expo-router';
import { LogBox } from 'react-native';
import '../firebaseConfig';
// إخفاء كل التحذيرات والرسائل الصفراء غير الهامة من الشاشة
LogBox.ignoreAllLogs(true);
export default function RootLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="role" />
      <Stack.Screen name="choice" />
      <Stack.Screen name="signup" />
      <Stack.Screen name="login" />
      <Stack.Screen name="home" />
      <Stack.Screen name="captain-choice" />
      <Stack.Screen name="captain-signup" />
      <Stack.Screen name="captain-login" />
      <Stack.Screen name="captain-home" />
    </Stack>
  );
}