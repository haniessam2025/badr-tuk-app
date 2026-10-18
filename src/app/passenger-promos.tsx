import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import { doc, getDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { db } from '../firebase';
import { useApp } from './AppContext'; // تأكد إن المسار ده صح حسب مشروعك

export default function PassengerPromos() {
  const { isDarkMode } = useApp();
  const router = useRouter();
  const [promos, setPromos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMyPromos();
  }, []);

  const loadMyPromos = async () => {
    try {
      const passengerId = await AsyncStorage.getItem('currentPassengerId');
      if (!passengerId) return;

      const docRef = doc(db, 'app_settings', 'pricing');
      const snap = await getDoc(docRef);
      
      if (snap.exists()) {
        const allPromos = snap.data().promoCodes || [];
        
        // تاريخ اليوم بصيغة YYYY-MM-DD للمقارنة
        const today = new Date().toISOString().split('T')[0];

        const myValidPromos = allPromos.filter((p: any) => {
          // 1. التأكد إن الكود مفعل ولم ينتهِ تاريخه
          if (!p.isActive || (p.expiryDate && p.expiryDate < today)) return false;
          
          // 2. التأكد إن الكود مخصص للكل أو للراكب ده تحديداً
          if (p.scope === 'specific' && (!p.selectedUsers || !p.selectedUsers.includes(passengerId))) {
            return false;
          }
          return true;
        });

        setPromos(myValidPromos);
      }
    } catch (error) {
      console.log("Error loading promos: ", error);
    } finally {
      setLoading(false);
    }
  };

  const copyCode = async (code: string) => {
    await Clipboard.setStringAsync(code);
    Alert.alert('تم النسخ بنجاح', `تم نسخ الكود (${code}) وتقدر تستخدمه في رحلتك القادمة!`);
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'غير محدد';
    const parts = dateStr.split('-');
    if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`; 
    return dateStr;
  };

  const renderItem = ({ item }: { item: any }) => (
    <View style={[styles.card, isDarkMode && { backgroundColor: '#1e293b', borderColor: '#334155' }]}>
      <View style={styles.cardHeader}>
        <View style={styles.discountBadge}>
          <Text style={styles.discountText}>
            خصم {item.discountValue} {item.discountType === 'fixed' ? 'جنيه' : '%'}
          </Text>
        </View>
        <Text style={[styles.expiryText, isDarkMode && { color: '#94a3b8' }]}>
          ⏳ صالح حتى: {formatDate(item.expiryDate)}
        </Text>
      </View>

      <View style={styles.codeContainer}>
        <Text style={[styles.codeText, isDarkMode && { color: '#ffffff' }]}>{item.code}</Text>
        <TouchableOpacity 
          style={styles.copyBtn} 
          onPress={() => copyCode(item.code)}
        >
          <Ionicons name="copy-outline" size={20} color="#ffffff" />
          <Text style={styles.copyBtnText}>نسخ الكود</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={[styles.container, isDarkMode && { backgroundColor: '#0f172a' }]}>
      <View style={[styles.header, isDarkMode && { backgroundColor: '#1e293b', borderBottomColor: '#334155' }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-forward" size={24} color={isDarkMode ? "#ffffff" : "#1e293b"} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, isDarkMode && { color: '#ffffff' }]}>أكواد الخصم 🎁</Text>
        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#10b981" style={{ marginTop: 50 }} />
      ) : promos.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="ticket-outline" size={80} color={isDarkMode ? "#334155" : "#cbd5e1"} />
          <Text style={[styles.emptyText, isDarkMode && { color: '#94a3b8' }]}>لا توجد أكواد خصم متاحة حالياً</Text>
        </View>
      ) : (
        <FlatList
          data={promos}
          keyExtractor={(item, index) => index.toString()}
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
  card: { backgroundColor: '#ffffff', padding: 15, borderRadius: 12, marginBottom: 15, borderWidth: 1, borderColor: '#e2e8f0', elevation: 1 },
  cardHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  discountBadge: { backgroundColor: '#fef08a', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  discountText: { color: '#854d0e', fontWeight: 'bold', fontSize: 14 },
  expiryText: { fontSize: 13, color: '#64748b', fontWeight: 'bold' },
  codeContainer: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f1f5f9', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#cbd5e1', borderStyle: 'dashed' },
  codeText: { fontSize: 18, fontWeight: 'bold', color: '#0f172a', letterSpacing: 2 },
  copyBtn: { flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: '#10b981', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 6, gap: 5 },
  copyBtnText: { color: '#ffffff', fontWeight: 'bold', fontSize: 14 }
});