import { Stack, router } from 'expo-router';
import { doc, onSnapshot } from 'firebase/firestore';
import { useContext, useEffect, useState } from 'react';
import { LogBox } from 'react-native';
import { AppContext, AppProvider } from './AppContext'; // 👈 استدعاء العقل المركزي والسياق

// 🔴 مهم جداً: لازم تفك الكومنت عن الفايربيز وتستدعي db عشان يقرأ زرار الصيانة
import { db } from '../firebase'; // (تأكد إن ده مسار ملف الفايربيز الصحيح عندك)

// إخفاء التحذيرات
LogBox.ignoreAllLogs(true);

// 🛡️ ده "الحارس" اللي هيراقب زرار الصيانة وحالة الرحلة
function MaintenanceGuard({ children }: { children: React.ReactNode }) {
  const [isMaintenanceEnabled, setIsMaintenanceEnabled] = useState(false);
  
  // حلينا مشكلة قراءة البيانات بإضافة (as any) عشان TypeScript ميزعلش
  const context = useContext(AppContext as any); 
  const activeRide = (context as any)?.activeRide; 

  // 1. المراقبة المباشرة لزرار الصيانة في الفايربيز
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', 'pricing'), (docSnap) => {
      if (docSnap.exists()) {
        setIsMaintenanceEnabled(docSnap.data().isMaintenanceEnabled || false);
      }
    });
    return () => unsub();
  }, []);

  // 2. اتخاذ القرار: نطرد اليوزر ولا نستنى يخلص رحلته؟
  useEffect(() => {
    if (isMaintenanceEnabled) {
      if (!activeRide || activeRide.status === 'completed' || activeRide.status === 'cancelled') {
        // 👈 حلينا الخطأ الثالث بإضافة (as never) عشان نتخطى فحص الـ Router
        router.replace('/maintenance' as never); 
      }
    }
  }, [isMaintenanceEnabled, activeRide]);

  return <>{children}</>;
}

// 🏠 المكون الأساسي (اللاي أوت)
export default function RootLayout() {
  return (
    <AppProvider>
      {/* غلفنا الشاشات بالحارس اللي عملناه فوق */}
      <MaintenanceGuard>
        <Stack screenOptions={{ headerShown: false }}>
  <Stack.Screen name="index" />
  <Stack.Screen name="maintenance" options={{ gestureEnabled: false }} />
</Stack>
      </MaintenanceGuard>
    </AppProvider>
  );
}