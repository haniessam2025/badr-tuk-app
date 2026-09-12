import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { db } from '../firebaseConfig';

export default function PassengerHistory() {
  const router = useRouter();
  const [rides, setRides] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const passengerId = await AsyncStorage.getItem('currentPassengerId');
      if (!passengerId) return;

      const q = query(
        collection(db, 'rides'),
        where('passengerId', '==', passengerId)
      );
      const snap = await getDocs(q);
      const fetchedRides = snap.docs.map(d => d.data());
      
      // الترتيب من الأحدث للأقدم
      fetchedRides.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      setRides(fetchedRides);
    } catch (error) {
      console.log('Error fetching history:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed': return 'مكتملة ✅';
      case 'canceled': return 'ملغاة ❌';
      default: return 'غير مكتملة ⏳';
    }
  };

  const renderItem = ({ item }: { item: any }) => (
    <View style={styles.rideCard}>
      <View style={styles.rideHeader}>
        <Text style={styles.dateText}>
          {item.timestamp ? new Date(item.timestamp).toLocaleDateString('ar-EG') : 'بدون تاريخ'}
        </Text>
        <Text style={styles.statusText}>{getStatusText(item.status)}</Text>
      </View>
      <Text style={styles.routeText}>من: {item.pickupLocation}</Text>
      <Text style={styles.routeText}>إلى: {item.destinationLocation || item.destinationsList?.join('، ')}</Text>
      <View style={styles.rideFooter}>
        <Text style={styles.captainText}>الكابتن: {item.captainName || 'غير مسجل'}</Text>
        <Text style={styles.priceText}>{item.price ? `${item.price} جنيه` : '---'}</Text>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>رجوع ➔</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>سجل رحلاتي</Text>
        <View style={{ width: 50 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#d97706" />
        </View>
      ) : rides.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>لم تقم بأي رحلات حتى الآن</Text>
        </View>
      ) : (
        <FlatList
          data={rides}
          keyExtractor={(_, index) => index.toString()}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 15, paddingBottom: 30 }}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  header: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#ffffff', padding: 15, paddingTop: 40, borderBottomWidth: 1, borderColor: '#e2e8f0' },
  backButton: { padding: 8, backgroundColor: '#f8fafc', borderRadius: 8 },
  backButtonText: { color: '#0f172a', fontWeight: 'bold', fontSize: 13 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#1e293b' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { color: '#64748b', fontSize: 16, fontWeight: 'bold' },
  rideCard: { backgroundColor: '#ffffff', padding: 15, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: '#e2e8f0', elevation: 2 },
  rideHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 10, borderBottomWidth: 1, borderColor: '#f1f5f9', paddingBottom: 8 },
  dateText: { fontSize: 13, color: '#64748b', fontWeight: 'bold' },
  statusText: { fontSize: 13, color: '#334155', fontWeight: 'bold' },
  routeText: { fontSize: 14, color: '#1e293b', marginBottom: 5, textAlign: 'right', fontWeight: 'bold' },
  rideFooter: { flexDirection: 'row-reverse', justifyContent: 'space-between', marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderColor: '#f1f5f9' },
  captainText: { fontSize: 13, color: '#64748b' },
  priceText: { fontSize: 15, color: '#10b981', fontWeight: 'bold' }
});