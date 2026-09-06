import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { doc, getDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { db } from '../firebaseConfig';

export default function CaptainDocs() {
  const router = useRouter();
  const [docs, setDocs] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDocs();
  }, []);

  const fetchDocs = async () => {
    try {
      const captainId = await AsyncStorage.getItem('currentCaptainId');
      if (!captainId) return;

      const docRef = doc(db, 'captains', captainId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        setDocs(docSnap.data());
      }
    } catch (error) {
      console.log('Error fetching docs:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}><Text style={styles.backBtnText}>رجوع ⬅️</Text></TouchableOpacity>
        <Text style={styles.headerTitle}>المستندات الرسمية 📄</Text>
      </View>

      {loading ? (
        <View style={styles.centerContainer}><ActivityIndicator size="large" color="#d97706" /></View>
      ) : !docs ? (
        <View style={styles.centerContainer}><Text style={styles.emptyText}>لم يتم العثور على مستندات.</Text></View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 30 }}>
          <View style={styles.docCard}>
            <Text style={styles.docLabel}>البطاقة (الوجه)</Text>
            {docs.idFront ? <Image source={{ uri: docs.idFront }} style={styles.docImage} /> : <Text style={styles.missingText}>غير متوفر</Text>}
          </View>
          
          <View style={styles.docCard}>
            <Text style={styles.docLabel}>البطاقة (الظهر)</Text>
            {docs.idBack ? <Image source={{ uri: docs.idBack }} style={styles.docImage} /> : <Text style={styles.missingText}>غير متوفر</Text>}
          </View>

          <View style={styles.docCard}>
            <Text style={styles.docLabel}>صورة التوكتوك / المركبة</Text>
            {docs.vehicleImage ? <Image source={{ uri: docs.vehicleImage }} style={styles.docImage} /> : <Text style={styles.missingText}>غير متوفر</Text>}
          </View>
        </ScrollView>
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
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { fontSize: 16, color: '#64748b', fontWeight: 'bold' },
  docCard: { backgroundColor: '#ffffff', padding: 15, borderRadius: 14, marginBottom: 15, borderWidth: 1, borderColor: '#e2e8f0', elevation: 2 },
  docLabel: { fontSize: 16, fontWeight: 'bold', color: '#d97706', marginBottom: 10, textAlign: 'right' },
  docImage: { width: '100%', height: 200, borderRadius: 10, backgroundColor: '#e2e8f0', resizeMode: 'cover' },
  missingText: { textAlign: 'center', color: '#ef4444', padding: 20, backgroundColor: '#fee2e2', borderRadius: 10 }
});