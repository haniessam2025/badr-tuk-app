import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { db } from '../firebaseConfig';

export default function CaptainHistory() {
  const router = useRouter();
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // متغيرات للإحصائيات
  const [totalRides, setTotalRides] = useState(0);
  const [totalEarnings, setTotalEarnings] = useState(0);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const captainId = await AsyncStorage.getItem('currentCaptainId');
      if (!captainId) return;

      const q = query(
        collection(db, 'rides'),
        where('captainId', '==', captainId)
      );

      const querySnapshot = await getDocs(q);
      const rides: any[] = [];
      let completedCount = 0;
      let earningsSum = 0;

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.status === 'completed' || data.status === 'canceled') {
          rides.push({ id: doc.id, ...data });
          
          // حساب الإحصائيات للرحلات المكتملة فقط
          if (data.status === 'completed') {
            completedCount++;
            earningsSum += parseFloat(data.price) || 0;
          }
        }
      });

      // ترتيب من الأحدث للأقدم
      rides.sort((a, b) => b.timestamp - a.timestamp);
      setHistory(rides);
      setTotalRides(completedCount);
      setTotalEarnings(earningsSum);

    } catch (error) {
      console.log('Error fetching history:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (timestamp: number) => {
    if (!timestamp) return 'غير محدد';
    const date = new Date(timestamp);
    return date.toLocaleDateString('ar-EG') + ' - ' + date.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
  };

  const renderItem = ({ item }: { item: any }) => (
    <View style={[styles.card, item.status === 'canceled' && styles.cardCanceled]}>
      <View style={styles.cardHeader}>
        <Text style={styles.dateText}>{formatDate(item.timestamp)}</Text>
        <Text style={[styles.statusBadge, item.status === 'canceled' && styles.statusBadgeCanceled]}>
          {item.status === 'completed' ? '✅ مكتملة' : '❌ ملغية'}
        </Text>
      </View>
      <View style={styles.routeContainer}>
        <Text style={styles.routeText}>📍 من: {item.pickupLocation}</Text>
        <Text style={styles.routeText}>🏁 إلى: {item.destinationLocation}</Text>
      </View>
      <View style={styles.cardFooter}>
        <Text style={styles.passengerText}>👤 الراكب: {item.name}</Text>
        <Text style={styles.priceText}>💰 {item.price} ج</Text>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}><Text style={styles.backBtnText}>رجوع ⬅️</Text></TouchableOpacity>
        <Text style={styles.headerTitle}>سجل الرحلات 📜</Text>
      </View>

      {/* كارت ملخص الإحصائيات */}
      {!loading && (
        <View style={styles.summaryCard}>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryLabel}>إجمالي الأرباح</Text>
            <Text style={styles.summaryValue}>{totalEarnings.toFixed(2)} ج</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryBox}>
            <Text style={styles.summaryLabel}>الرحلات المكتملة</Text>
            <Text style={styles.summaryValue}>{totalRides}</Text>
          </View>
        </View>
      )}

      {loading ? (
        <View style={styles.centerContainer}><ActivityIndicator size="large" color="#d97706" /></View>
      ) : history.length === 0 ? (
        <View style={styles.centerContainer}><Text style={styles.emptyText}>لم تقم بأي رحلات حتى الآن.</Text></View>
      ) : (
        <FlatList
          data={history}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 20 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9', padding: 15, paddingTop: 45 },
  header: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#1e293b' },
  backBtn: { backgroundColor: '#e2e8f0', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8 },
  backBtnText: { color: '#334155', fontWeight: 'bold' },
  
  // تنسيقات كارت الملخص
  summaryCard: { flexDirection: 'row-reverse', backgroundColor: '#1e293b', borderRadius: 16, padding: 20, marginBottom: 20, elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4 },
  summaryBox: { flex: 1, alignItems: 'center' },
  summaryDivider: { width: 1, backgroundColor: '#334155', marginHorizontal: 10 },
  summaryLabel: { fontSize: 13, color: '#94a3b8', marginBottom: 5, fontWeight: 'bold' },
  summaryValue: { fontSize: 24, color: '#eab308', fontWeight: 'bold' },

  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { fontSize: 16, color: '#64748b', fontWeight: 'bold' },
  card: { backgroundColor: '#ffffff', padding: 15, borderRadius: 14, marginBottom: 15, borderWidth: 1, borderColor: '#e2e8f0', elevation: 2 },
  cardCanceled: { borderColor: '#fca5a5', backgroundColor: '#fef2f2' },
  cardHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 10, borderBottomWidth: 1, borderColor: '#f1f5f9', paddingBottom: 10 },
  dateText: { fontSize: 13, color: '#64748b', fontWeight: 'bold' },
  statusBadge: { backgroundColor: '#d1fae5', color: '#047857', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, fontSize: 11, fontWeight: 'bold', overflow: 'hidden' },
  statusBadgeCanceled: { backgroundColor: '#fee2e2', color: '#ef4444' },
  routeContainer: { marginBottom: 10 },
  routeText: { fontSize: 14, color: '#334155', fontWeight: 'bold', marginBottom: 4, textAlign: 'right' },
  cardFooter: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginTop: 5 },
  passengerText: { fontSize: 13, color: '#475569' },
  priceText: { fontSize: 16, fontWeight: 'bold', color: '#10b981' }
});