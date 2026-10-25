import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Stack } from 'expo-router';
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { LogBox, Modal, StyleSheet, Text, View } from 'react-native';
import { db } from '../firebase';
import { AppProvider } from './AppContext';

LogBox.ignoreAllLogs(true);

// 🛡️ الحارس الذكي المستقل (لا يعتمد على AppContext البطيء)
function MaintenanceGuard({ children }: { children: React.ReactNode }) {
  const [isMaintenanceEnabled, setIsMaintenanceEnabled] = useState(false);
  
  // null = جاري التحميل، false = معندوش رحلة، true = معاه رحلة شغالة
  const [hasActiveRide, setHasActiveRide] = useState<boolean | null>(null);

  // 1. مراقبة الصيانة
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', 'pricing'), (docSnap) => {
      if (docSnap.exists()) setIsMaintenanceEnabled(docSnap.data().isMaintenanceEnabled === true);
    });
    return () => unsub();
  }, []);

  // 2. الفحص المباشر والسريع للرحلات من الداتابيز (استقلال تام عن العقل المركزي)
  useEffect(() => {
    let unsubRides: any = null;

    const checkActiveRides = async () => {
      try {
        const captainId = await AsyncStorage.getItem('currentCaptainId');
        const passengerId = await AsyncStorage.getItem('currentPassengerId');
        
        const userId = captainId || passengerId;
        const idField = captainId ? 'captainId' : 'passengerId';

        if (userId) {
          const q = query(collection(db, 'rides'), where(idField, '==', userId));

          unsubRides = onSnapshot(q, (snap) => {
            const activeStatuses = ['accepted', 'captain_arrived', 'passenger_on_the_way', 'waiting_for_scan', 'in_progress'];
            let foundActive = false;
            
            snap.forEach((document) => {
              if (activeStatuses.includes(document.data().status)) foundActive = true;
            });
            
            setHasActiveRide(foundActive); // كده عرفنا الحقيقة 100%
          }, () => {
            setHasActiveRide(false);
          });
        } else {
          setHasActiveRide(false);
        }
      } catch (error) {
        setHasActiveRide(false);
      }
    };

    checkActiveRides();

    return () => {
      if (unsubRides) unsubRides();
    };
  }, []);

  // 3. الشاشة هتظهر فقط لو: الصيانة شغالة + التطبيق اتأكد 100% إن مفيش رحلة
  const showMaintenance = isMaintenanceEnabled && hasActiveRide === false;

  return (
    <View style={{ flex: 1 }}>
      {children}
      
      {/* الشاشة تظهر بسطح التطبيق وتختفي بهدوء بدون طرد أو تخريب للراوتر */}
      <Modal visible={showMaintenance} animationType="fade" transparent={false}>
        <View style={styles.maintenanceContainer}>
          <Ionicons name="construct" size={80} color="#ef4444" />
          <Text style={styles.title}>التطبيق في وضع الصيانة 🛠️</Text>
          <Text style={styles.subtitle}>
            نحن نقوم ببعض التحديثات الهامة لتحسين الخدمة. نعتذر عن الإزعاج وسنعود للعمل في أقرب وقت.
          </Text>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  maintenanceContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8fafc', padding: 20 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#1e293b', marginTop: 20, marginBottom: 10, textAlign: 'center' },
  subtitle: { fontSize: 16, color: '#64748b', textAlign: 'center', lineHeight: 24 }
});

export default function RootLayout() {
  return (
    <AppProvider>
      <MaintenanceGuard>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="maintenance" options={{ gestureEnabled: false }} />
        </Stack>
      </MaintenanceGuard>
    </AppProvider>
  );
}