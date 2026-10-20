import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { addDoc, collection, getDocs, query, serverTimestamp, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, KeyboardAvoidingView, Modal, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { db } from '../firebase';

export default function CaptainHistory() {
  const router = useRouter();
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [totalRides, setTotalRides] = useState(0);
  const [totalEarnings, setTotalEarnings] = useState(0);

  // متغيرات مودال بلاغ المفقودات
  const [isLostModalVisible, setIsLostModalVisible] = useState(false);
  const [selectedRide, setSelectedRide] = useState<any>(null);
  const [lostText, setLostText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [captainId, setCaptainId] = useState<string | null>(null);
  const [captainProfile, setCaptainProfile] = useState<any>(null);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      let capId = await AsyncStorage.getItem('currentCaptainId');
      let profileStr = await AsyncStorage.getItem('captain_profile');
      let profile = profileStr ? JSON.parse(profileStr) : null;
      
      if (profile) setCaptainProfile(profile);

      if (!capId && profile) {
        capId = profile.id || profile.uid;
      }

      if (capId) setCaptainId(capId);

      if (!capId) {
        setLoading(false);
        return;
      }

      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const cutoffTimestamp = startOfToday.getTime();

      const q = query(
        collection(db, 'rides'),
        where('captainId', '==', capId),
        where('timestamp', '>=', cutoffTimestamp)
      );
      
      const querySnapshot = await getDocs(q);
      let dailyRides: any[] = [];
      let dailyEarnings = 0;
      let dailyCompletedRides = 0;
      
      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.status === 'completed' || data.status === 'canceled') {
          dailyRides.push({ id: docSnap.id, ...data });
        }
        if (data.status === 'completed') {
          dailyCompletedRides++;
          dailyEarnings += parseFloat(data.price) || 0;
        }
      });

      setTotalEarnings(dailyEarnings);
      setTotalRides(dailyCompletedRides);
      dailyRides.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      setHistory(dailyRides);
    } catch (error: any) {
      console.log('Error fetching history:', error);
      alert("حدث خطأ أثناء جلب السجل: " + error.message);
    } finally {
      setLoading(false);
    }
  };

// 👈 دالة إرسال بلاغ المفقودات للكابتن لتروح مباشرة على قسم "بلاغات الكباتن" في الداشبورد
  const submitLostItem = async () => {
    if (!lostText.trim()) {
      Alert.alert('تنبيه', 'برجاء كتابة تفاصيل الأغراض التي عثرت عليها.');
      return;
    }
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'trip_lost_items'), {
        reporterId: captainId || 'unknown',
        reporterType: 'captain', // 👈 دي اللي بتخليه يروح في تابة (بلاغات الكباتن) في الداشبورد
        reporterName: captainProfile?.name || selectedRide.captainName || 'كابتن',
        reporterPhone: captainProfile?.phone || selectedRide.captainPhone || 'بدون رقم',
        
        tripId: selectedRide.id,
        tripDate: selectedRide.timestamp ? new Date(selectedRide.timestamp).toLocaleDateString('ar-EG') : 'رحلة سابقة',
        
        captainName: captainProfile?.name || selectedRide.captainName || 'كابتن',
        captainPhone: captainProfile?.phone || selectedRide.captainPhone || 'غير مسجل',
        
        pickupLocation: selectedRide.pickupLocation || '',
        destinationLocation: selectedRide.destinationLocation || selectedRide.destinationsList?.join(' - ') || '',
        
        text: `عثرت على أغراض منسية: ${lostText.trim()}`,
        status: 'pending',
        isReadAdmin: false, // 👈 بتنور اللمبة الصفراء في الداشبورد
        timestamp: serverTimestamp()
      });

      // 👈 إرسال إشعار فوري للإدارة
      await addDoc(collection(db, 'notifications'), {
        userId: 'admin',
        userType: 'admin',
        title: 'بلاغ مفقودات رحلة من كابتن 🔍',
        message: `بلاغ عثور على أغراض من الكابتن: ${captainProfile?.name || 'كابتن'}`,
        read: false,
        timestamp: serverTimestamp()
      });

      Alert.alert('تم الإرسال ✅', 'تم إبلاغ الإدارة بالعثور على الأغراض بنجاح وسيتم التواصل معك.');
      setIsLostModalVisible(false);
      setLostText('');
    } catch (error) {
      console.log('Error submitting captain lost item:', error);
      Alert.alert('خطأ', 'حدثت مشكلة أثناء إرسال البلاغ.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDate = (timestamp: number) => {
    if (!timestamp) return 'غير محدد';
    const date = new Date(timestamp);
    return date.toLocaleDateString('ar-EG') + ' - ' + date.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
  };

  // دالة رسم كارت الرحلة في السجل
  const renderItem = ({ item }: { item: any }) => {
    const isCanceled = item.status === 'canceled' || item.status === 'cancelled_by_passenger';
    const finalPrice = parseInt(item.price || '0');
    
    // 👈 الصراحة والوضوح: لو العمولة مش متسجلة في الداتابيز تبقى صفر فوراً (بدون أي تخمين)
    const commissionAmount = item.commissionAmount !== undefined ? Number(item.commissionAmount) : 0;
    const commissionPercent = item.commissionPercent !== undefined ? Number(item.commissionPercent) : 0;
    
    const netProfit = finalPrice - commissionAmount;

    // ضبط شكل الوجهة لو كانت متعددة
    const dropoffText = item.destinationsList && item.destinationsList.length > 0 
      ? item.destinationsList.join(' - ') 
      : item.destinationLocation || 'غير محدد';

    return (
      <View style={[styles.card, isCanceled && styles.cardCanceled]}>
        <View style={styles.cardHeader}>
          <Text style={styles.dateText}>{formatDate(item.timestamp)}</Text>
          <Text style={[styles.statusBadge, isCanceled && styles.statusBadgeCanceled]}>
            {isCanceled ? '❌ ملغية' : '✅ مكتملة'}
          </Text>
        </View>
        
        <View style={styles.routeContainer}>
          <Text style={styles.routeText} numberOfLines={1}>📍 من: {item.pickupLocation}</Text>
          <Text style={styles.routeText} numberOfLines={2}>🏁 إلى: {dropoffText}</Text>
        </View>

        {/* 🧾 الفاتورة المصغرة للرحلات المكتملة */}
        {!isCanceled && (
          <View style={styles.miniReceipt}>
            <View style={styles.receiptRow}>
              <Text style={styles.receiptLabel}>الإجمالي (من الراكب):</Text>
              <Text style={styles.receiptValue}>{finalPrice} ج</Text>
            </View>
            <View style={styles.receiptRow}>
              <Text style={[styles.receiptLabel, {color: commissionAmount > 0 ? '#ef4444' : '#64748b'}]}>
                عمولة بُرَاق ({commissionPercent}%):
              </Text>
              <Text style={[styles.receiptValue, {color: commissionAmount > 0 ? '#ef4444' : '#64748b'}]}>
                -{commissionAmount} ج
              </Text>
            </View>
            <View style={styles.receiptDivider} />
            <View style={styles.receiptRow}>
              <Text style={[styles.receiptLabel, {color: '#10b981', fontWeight: 'bold'}]}>صافي ربحك:</Text>
              <Text style={[styles.receiptValue, {color: '#10b981', fontWeight: 'bold', fontSize: 15}]}>{netProfit} ج</Text>
            </View>
          </View>
        )}

        {isCanceled && (
          <View style={styles.cardFooter}>
            <Text style={styles.passengerText}>👤 الراكب: {item.name}</Text>
            <Text style={[styles.priceText, {color: '#ef4444'}]}>💰 {item.price} ج</Text>
          </View>
        )}

        {!isCanceled && (
          <TouchableOpacity 
            style={styles.lostBtn} 
            onPress={() => {
              setSelectedRide(item);
              setLostText('');
              setIsLostModalVisible(true);
            }}
          >
            <Ionicons name="cube-outline" size={16} color="#d97706" />
            <Text style={styles.lostBtnText}>عثرت على مفقودات في هذه الرحلة 🎒</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}><Text style={styles.backBtnText}>رجوع ⬅️</Text></TouchableOpacity>
        <Text style={styles.headerTitle}>سجل الرحلات 📜</Text>
      </View>

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

      {/* 🎒 مودال إدخال تفاصيل المفقودات */}
      <Modal visible={isLostModalVisible} transparent={true} animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>إبلاغ عن مفقودات عثرت عليها 🎒</Text>
            <Text style={styles.modalSubtitle}>اكتب وصفاً للأغراض المنسية لتوصيلها لصاحبها عبر الإدارة.</Text>
            
            <TextInput
              style={styles.modalInput}
              placeholder="مثال: محفظة، هاتف، حقيبة..."
              placeholderTextColor="#94a3b8"
              multiline
              value={lostText}
              onChangeText={setLostText}
              textAlign="right"
            />

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalSendBtn} onPress={submitLostItem} disabled={isSubmitting}>
                {isSubmitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalSendBtnText}>إرسال للإدارة 🚀</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setIsLostModalVisible(false)}>
                <Text style={styles.modalCancelBtnText}>إلغاء</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9', padding: 15, paddingTop: 45 },
  header: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#1e293b' },
  backBtn: { backgroundColor: '#e2e8f0', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8 },
  backBtnText: { color: '#334155', fontWeight: 'bold' },
  
  summaryCard: { flexDirection: 'row-reverse', backgroundColor: '#1e293b', borderRadius: 16, padding: 20, marginBottom: 20, elevation: 4 },
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
  cardFooter: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginTop: 5, marginBottom: 10 },
  passengerText: { fontSize: 13, color: '#475569' },
  priceText: { fontSize: 16, fontWeight: 'bold', color: '#10b981' },

  // 🧾 تنسيقات الفاتورة المصغرة
  miniReceipt: { backgroundColor: '#f8fafc', padding: 10, borderRadius: 10, marginTop: 5, marginBottom: 10, borderWidth: 1, borderColor: '#e2e8f0' },
  receiptRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  receiptLabel: { fontSize: 12, color: '#64748b', fontWeight: 'bold' },
  receiptValue: { fontSize: 13, color: '#1e293b', fontWeight: 'bold' },
  receiptDivider: { height: 1, backgroundColor: '#cbd5e1', marginVertical: 4 },

  lostBtn: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fef3c7', paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#fde68a', gap: 6, marginTop: 5 },
  lostBtnText: { color: '#d97706', fontSize: 12, fontWeight: 'bold' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { backgroundColor: '#ffffff', width: '100%', padding: 20, borderRadius: 16, elevation: 5 },
  modalTitle: { fontSize: 17, fontWeight: 'bold', color: '#1e293b', textAlign: 'center', marginBottom: 5 },
  modalSubtitle: { fontSize: 12, color: '#64748b', textAlign: 'center', marginBottom: 15 },
  modalInput: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, padding: 12, minHeight: 80, textAlignVertical: 'top', fontSize: 14, color: '#1e293b', marginBottom: 15 },
  modalActions: { flexDirection: 'row-reverse', gap: 10 },
  modalSendBtn: { flex: 2, backgroundColor: '#d97706', paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  modalSendBtnText: { color: '#ffffff', fontWeight: 'bold', fontSize: 14 },
  modalCancelBtn: { flex: 1, backgroundColor: '#fee2e2', paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  modalCancelBtnText: { color: '#ef4444', fontWeight: 'bold', fontSize: 14 },
});