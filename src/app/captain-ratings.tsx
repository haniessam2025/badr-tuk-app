import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { db } from '../firebaseConfig';

export default function CaptainRatings() {
  const router = useRouter();
  const [ratings, setRatings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRatings();
  }, []);

  const fetchRatings = async () => {
    try {
      const captainId = await AsyncStorage.getItem('currentCaptainId');
      if (!captainId) return;

      // سحب تقييمات الركاب لهذا الكابتن تحديداً
      const q = query(
        collection(db, 'ratings'),
        where('captainId', '==', captainId),
        where('type', '==', 'passenger_rating_captain')
      );
      
      const snap = await getDocs(q);
      const fetchedRatings = snap.docs.map(d => d.data());
      
      // الترتيب من الأحدث للأقدم بناءً على الوقت
      fetchedRatings.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      
      setRatings(fetchedRatings);
    } catch (error) {
      console.log(error);
    } finally {
      setLoading(false);
    }
  };

  const renderItem = ({ item }: { item: any }) => (
    <View style={styles.ratingCard}>
      <Text style={styles.stars}>{'⭐'.repeat(item.rating || 5)}</Text>
      <Text style={styles.reason}>"{item.reason || 'ممتاز'}"</Text>
      <Text style={styles.dateText}>
        {item.timestamp ? new Date(item.timestamp).toLocaleDateString('ar-EG') : ''}
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>رجوع ⬅️</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>تقييماتي ⭐</Text>
        <View style={{ width: 50 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#eab308" />
        </View>
      ) : ratings.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>لم تتلقَ أي تقييمات حتى الآن.</Text>
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
  header: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#ffffff', padding: 15, paddingTop: Platform.OS === 'android' ? 45 : 45, elevation: 3 },
  backButton: { padding: 8, backgroundColor: '#f8fafc', borderRadius: 8 },
  backButtonText: { color: '#0f172a', fontWeight: 'bold', fontSize: 13 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#1e293b' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { color: '#64748b', fontSize: 16, fontWeight: 'bold' },
  ratingCard: { backgroundColor: '#ffffff', padding: 15, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: '#e2e8f0', elevation: 2 },
  stars: { fontSize: 18, marginBottom: 8, textAlign: 'right' },
  reason: { fontSize: 15, color: '#334155', textAlign: 'right', fontStyle: 'italic', marginBottom: 8 },
  dateText: { fontSize: 12, color: '#94a3b8', textAlign: 'left' }
});