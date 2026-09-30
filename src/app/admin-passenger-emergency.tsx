import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { db } from '../firebase';

export default function AdminPassengerEmergency() {
  const router = useRouter();
  // بنستقبل بيانات الراكب اللي ضغطنا عليه
  const { passengerId, passengerName } = useLocalSearchParams(); 
  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (passengerId) fetchEmergencyContacts();
  }, [passengerId]);

  const fetchEmergencyContacts = async () => {
    try {
      // بنجيب الأرقام الخاصة بالراكب ده بس
      const q = query(collection(db, 'emergencyContacts'), where('passengerId', '==', passengerId));
      const snap = await getDocs(q);
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setContacts(data);
    } catch (error) {
      console.log('Error fetching contacts:', error);
    } finally {
      setLoading(false);
    }
  };

  // 📍 السطر ده هو اللي بيفتح شاشة الاتصال في الموبايل بالرقم فوراً
  const makeCall = (phone: string) => {
    Linking.openURL(`tel:${phone}`);
  };

  const renderItem = ({ item }: { item: any }) => (
    <View style={styles.contactCard}>
      <View style={styles.contactInfo}>
        <Text style={styles.contactName}>{item.contactName} <Text style={styles.relation}>({item.relation || 'قريب'})</Text></Text>
        <Text style={styles.contactPhone}>{item.contactPhone}</Text>
      </View>
      
      {/* زرار الاتصال المباشر */}
      <TouchableOpacity style={styles.callBtn} onPress={() => makeCall(item.contactPhone)}>
        <Ionicons name="call" size={24} color="#ffffff" />
        <Text style={styles.callText}>اتصال</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-forward" size={24} color="#ffffff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>طوارئ: {passengerName}</Text>
        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#3b82f6" style={{ marginTop: 50 }} />
      ) : contacts.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="sad-outline" size={60} color="#94a3b8" />
          <Text style={styles.emptyText}>هذا الراكب لم يقم بإضافة أرقام طوارئ.</Text>
        </View>
      ) : (
        <FlatList data={contacts} keyExtractor={(item) => item.id} renderItem={renderItem} contentContainerStyle={{ padding: 15 }} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#1e293b', paddingHorizontal: 20, paddingTop: 50, paddingBottom: 15 },
  backBtn: { padding: 5 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#ffffff' },
  
  contactCard: { flexDirection: 'row-reverse', backgroundColor: '#ffffff', padding: 15, borderRadius: 12, marginBottom: 15, borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center', elevation: 2 },
  contactInfo: { flex: 1, marginRight: 15 },
  contactName: { fontSize: 18, fontWeight: 'bold', color: '#1e293b', textAlign: 'right' },
  relation: { fontSize: 14, color: '#64748b', fontWeight: 'normal' },
  contactPhone: { fontSize: 16, color: '#3b82f6', textAlign: 'right', marginTop: 5 },
  
  callBtn: { flexDirection: 'row-reverse', backgroundColor: '#10b981', paddingHorizontal: 15, paddingVertical: 10, borderRadius: 8, alignItems: 'center', gap: 5 },
  callText: { color: '#ffffff', fontWeight: 'bold', fontSize: 16 },
  
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { fontSize: 16, color: '#64748b', marginTop: 10 }
});