import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { db } from '../firebaseConfig';

export default function PassengerRatings() {
  const router = useRouter();
  const [ratings, setRatings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRatings();
  }, []);

  const fetchRatings = async () => {
    try {
      const passengerId = await AsyncStorage.getItem('currentPassengerId');
      if (!passengerId) return;

      // سحب التقييمات الموجهة لهذا الراكب تحديداً من قبل الكباتن
      const q = query(
        collection(db, 'ratings'),
        where('passengerId', '==', passengerId),
        where('type', '==', 'captain_rating_passenger')
      );
      const snap = await getDocs(q);
      const fetchedRatings = snap.docs.map(d => d.data());
      
      // الترتيب من الأحدث للأقدم
      fetchedRatings.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      setRatings(fetchedRatings);
    } catch (error) {
      console.log('Error fetching ratings:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderItem = ({ item }: { item: any }) => (
    <View style={styles.ratingCard}>
      <View style={styles.ratingHeader}>
        <Text style={styles.stars}>{'★'.repeat(item.rating || 5)}{'☆'.repeat(5 - (item.rating || 5))}</Text>
        <Text style={styles.dateText}>
          {item.timestamp ? new Date(item.timestamp).toLocaleDateString('ar-EG') : ''}
        </Text>
      </View>
      <Text style={styles.reason}>"{item.reason || 'راكب ممتاز'}"</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>رجوع ➔</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>تقييماتي</Text>
        <View style={{ width: 50 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#d97706" />
        </View>
      ) : ratings.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>لم تتلقَ أي تقييمات من الكباتن حتى الآن</Text>
        </View>
      ) : (
        <FlatList
          data={ratings}
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
  ratingCard: { backgroundColor: '#ffffff', padding: 15, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: '#e2e8f0', elevation: 2 },
  ratingHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  stars: { fontSize: 18, color: '#f59e0b', textAlign: 'right' },
  reason: { fontSize: 15, color: '#334155', textAlign: 'right', fontStyle: 'italic', marginTop: 5 },
  dateText: { fontSize: 12, color: '#94a3b8' }
});