import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { collection, doc, getDocs, orderBy, query, updateDoc, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { db } from '../firebase';
import { useApp } from './AppContext';

export default function CaptainNotifications() {
  const { isDarkMode } = useApp();
  const router = useRouter();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadNotifications();
  }, []);

  const loadNotifications = async () => {
    try {
      const captainId = await AsyncStorage.getItem('currentCaptainId');
      if (!captainId) return;

      const q = query(
        collection(db, 'notifications'),
        where('userId', '==', captainId),
        orderBy('timestamp', 'desc')
      );

      const snap = await getDocs(q);
      const notifs: any[] = [];
      
      snap.forEach((d) => {
        notifs.push({ id: d.id, ...d.data() });
        // بمجرد فتح الصفحة، بنحول كل الإشعارات لـ "مقروءة" عشان البادج الأحمر يختفي
        if (!d.data().read) {
          updateDoc(doc(db, 'notifications', d.id), { read: true });
        }
      });

      setNotifications(notifs);
    } catch (error) {
      console.log("Error loading notifications: ", error);
    } finally {
      setLoading(false);
    }
  };

  const handleNotifClick = (item: any) => {
    if (item.actionRoute) {
      router.push(item.actionRoute);
    }
  };

  // 📍 دالة ذكية لمعالجة التاريخ أياً كان نوعه من الفايربيز
  const formatNotificationTime = (timestamp: any) => {
    if (!timestamp) return 'منذ قليل';
    try {
      let date;
      if (timestamp.toDate) {
        date = timestamp.toDate(); // لو جاي كـ Firebase Timestamp Object
      } else if (timestamp.seconds) {
        date = new Date(timestamp.seconds * 1000); // لو جاي كثواني
      } else {
        date = new Date(timestamp); // لو جاي كملي ثانية عادي
      }
      
      if (isNaN(date.getTime())) return '';
      
      return date.toLocaleString('ar-EG', { hour: 'numeric', minute: 'numeric', day: 'numeric', month: 'short' });
    } catch (error) {
      return '';
    }
  };

  const renderItem = ({ item }: { item: any }) => (
    <TouchableOpacity 
      style={[
        styles.card, 
        isDarkMode && { backgroundColor: '#1e293b', borderColor: '#334155' }, 
        !item.read && { borderRightWidth: 4, borderRightColor: '#3b82f6', backgroundColor: isDarkMode ? '#1e3a8a' : '#eff6ff' }
      ]}
      onPress={() => handleNotifClick(item)}
      disabled={!item.actionRoute} 
    >
      <View style={styles.iconContainer}>
        <Ionicons name={item.icon || "notifications"} size={26} color="#3b82f6" />
      </View>
      <View style={styles.textContainer}>
        <Text style={[styles.title, isDarkMode && { color: '#ffffff' }]}>{item.title || 'إشعار جديد'}</Text>
        <Text style={[styles.message, isDarkMode && { color: '#cbd5e1' }]}>{item.message}</Text>
        <Text style={styles.time}>{formatNotificationTime(item.timestamp)}</Text>
      </View>
      {item.actionRoute && (
        <Ionicons name="chevron-back" size={20} color="#94a3b8" style={{ alignSelf: 'center' }} />
      )}
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, isDarkMode && { backgroundColor: '#0f172a' }]}>
      <View style={[styles.header, isDarkMode && { backgroundColor: '#1e293b', borderBottomColor: '#334155' }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-forward" size={24} color={isDarkMode ? "#ffffff" : "#1e293b"} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, isDarkMode && { color: '#ffffff' }]}>الإشعارات</Text>
        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#3b82f6" style={{ marginTop: 50 }} />
      ) : notifications.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="notifications-off-outline" size={80} color={isDarkMode ? "#334155" : "#cbd5e1"} />
          <Text style={[styles.emptyText, isDarkMode && { color: '#94a3b8' }]}>لا توجد إشعارات حالياً</Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 15, paddingBottom: 30 }}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#ffffff', paddingHorizontal: 20, paddingTop: 50, paddingBottom: 15, borderBottomWidth: 1, borderBottomColor: '#e2e8f0', elevation: 2 },
  backBtn: { padding: 5 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#1e293b' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { fontSize: 18, color: '#64748b', fontWeight: 'bold', marginTop: 15 },
  card: { flexDirection: 'row-reverse', backgroundColor: '#ffffff', padding: 15, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: '#e2e8f0', elevation: 1 },
  iconContainer: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#dbeafe', justifyContent: 'center', alignItems: 'center', marginLeft: 15 },
  textContainer: { flex: 1, justifyContent: 'center' },
  title: { fontSize: 16, fontWeight: 'bold', color: '#0f172a', textAlign: 'right', marginBottom: 4 },
  message: { fontSize: 14, color: '#475569', textAlign: 'right', lineHeight: 22 },
  time: { fontSize: 11, color: '#94a3b8', textAlign: 'left', marginTop: 8 }
});