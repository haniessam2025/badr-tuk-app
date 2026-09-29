import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { addDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { db } from '../firebase';
import { useApp } from './AppContext';

export default function PassengerHistory() {
  const router = useRouter();
  const { isDarkMode } = useApp(); 

  const [rides, setRides] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalRides, setTotalRides] = useState(0);

  // 👈 متغيرات المفقودات
  const [isLostItemModalVisible, setIsLostItemModalVisible] = useState(false);
  const [selectedRide, setSelectedRide] = useState<any>(null);
  const [lostItemText, setLostItemText] = useState('');
  const [isSubmittingLost, setIsSubmittingLost] = useState(false);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const passengerId = await AsyncStorage.getItem('currentPassengerId');
      if (!passengerId) {
        setLoading(false);
        return;
      }

      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const cutoffTimestamp = startOfToday.getTime();

      const q = query(
        collection(db, 'rides'),
        where('passengerId', '==', passengerId),
        where('timestamp', '>=', cutoffTimestamp)
      );
      
      const snap = await getDocs(q);
      let dailyRides: any[] = [];
      let dailyCompleted = 0;

      snap.docs.forEach(d => {
        const data = d.data();
        data.id = d.id; // حفظ ID الرحلة
        if (data.status === 'completed' || data.status === 'canceled' || data.status === 'cancelled_by_passenger') {
          dailyRides.push(data);
        }
        if (data.status === 'completed') {
          dailyCompleted++;
        }
      });

      dailyRides.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      
      setTotalRides(dailyCompleted);
      setRides(dailyRides);
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
      case 'cancelled_by_passenger': return 'ملغاة ❌';
      default: return 'غير مكتملة ⏳';
    }
  };

  const getCaptainName = (item: any) => {
    let name = item.captainName || item.driverName || item.captain_name || item.captainInfo?.name;
    
    if (typeof name === 'string' && name.trim() === '') {
      name = null;
    }

    if (!name && item.offers && item.captainId) {
      const acceptedOffer = item.offers.find((o: any) => o.captainId === item.captainId);
      if (acceptedOffer && acceptedOffer.captainName && acceptedOffer.captainName.trim() !== '') {
        name = acceptedOffer.captainName.trim();
      }
    }

    return name ? name : 'غير مسجل';
  };

  // 👈 دالة فتح نافذة المفقودات
  const openLostItemModal = (ride: any) => {
    setSelectedRide(ride);
    setLostItemText('');
    setIsLostItemModalVisible(true);
  };

  // 👈 دالة إرسال البلاغ
  const submitLostItem = async () => {
    if (!lostItemText.trim()) {
      Alert.alert('تنبيه', 'برجاء كتابة تفاصيل المفقودات');
      return;
    }
    setIsSubmittingLost(true);
    try {
      await addDoc(collection(db, 'lost_items'), {
        rideId: selectedRide.id,
        reporterId: selectedRide.passengerId,
        reporterType: 'passenger',
        captainId: selectedRide.captainId || 'unknown',
        details: lostItemText.trim(),
        timestamp: new Date().getTime(),
        status: 'pending' // pending يعني لسة الإدارة بتراجعه
      });
      Alert.alert('تم الإرسال ✅', 'تم إرسال بلاغ المفقودات للإدارة وسيتم التواصل معك قريباً.');
      setIsLostItemModalVisible(false);
    } catch (error) {
      Alert.alert('خطأ', 'حدثت مشكلة أثناء إرسال البلاغ');
    } finally {
      setIsSubmittingLost(false);
    }
  };

  const renderItem = ({ item }: { item: any }) => (
    <View style={[styles.rideCard, isDarkMode && { backgroundColor: '#1e293b', borderColor: '#334155' }]}>
      <View style={[styles.rideHeader, isDarkMode && { borderBottomColor: '#334155' }]}>
        <Text style={[styles.dateText, isDarkMode && { color: '#94a3b8' }]}>
          {item.timestamp ? new Date(item.timestamp).toLocaleDateString('ar-EG') : 'بدون تاريخ'}
        </Text>
        <Text style={[styles.statusText, isDarkMode && { color: '#cbd5e1' }]}>{getStatusText(item.status)}</Text>
      </View>
      <Text style={[styles.routeText, isDarkMode && { color: '#e2e8f0' }]}>من: {item.pickupLocation}</Text>
      <Text style={[styles.routeText, isDarkMode && { color: '#e2e8f0' }]}>إلى: {item.destinationLocation || item.destinationsList?.join('، ')}</Text>
      <View style={[styles.rideFooter, isDarkMode && { borderTopColor: '#334155' }]}>
        <Text style={[styles.captainText, isDarkMode && { color: '#94a3b8' }]} numberOfLines={1}>
          الكابتن: {getCaptainName(item)}
        </Text>
        <Text style={styles.priceText}>{item.price ? `${item.price} جنيه` : '---'}</Text>
      </View>
      
      {/* 👈 زرار الإبلاغ عن مفقودات الجديد */}
      {item.status === 'completed' && (
        <TouchableOpacity style={[styles.lostItemBtn, isDarkMode && { backgroundColor: '#334155' }]} onPress={() => openLostItemModal(item)}>
          <Text style={[styles.lostItemBtnText, isDarkMode && { color: '#fbbf24' }]}>الإبلاغ عن مفقودات 🎒</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <View style={[styles.container, isDarkMode && { backgroundColor: '#0f172a' }]}>
      <View style={[styles.header, isDarkMode && { backgroundColor: '#1e293b', borderColor: '#334155' }]}>
        <TouchableOpacity style={[styles.backButton, isDarkMode && { backgroundColor: '#334155' }]} onPress={() => router.back()}>
          <Text style={[styles.backButtonText, isDarkMode && { color: '#e2e8f0' }]}>رجوع ➔</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, isDarkMode && { color: '#ffffff' }]}>سجل رحلاتي</Text>
        <View style={{ width: 50 }} />
      </View>

      {!loading && (
        <View style={[styles.summaryCard, isDarkMode && { backgroundColor: '#1e293b', borderColor: '#3b82f6', borderWidth: 1 }]}>
          <Text style={styles.summaryLabel}>رحلات اليوم المكتملة</Text>
          <Text style={styles.summaryValue}>{totalRides}</Text>
        </View>
      )}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#d97706" />
        </View>
      ) : rides.length === 0 ? (
        <View style={styles.center}>
          <Text style={[styles.emptyText, isDarkMode && { color: '#cbd5e1' }]}>لم تقم بأي رحلات حتى الآن</Text>
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

      {/* 👈 نافذة الإبلاغ عن المفقودات */}
      <Modal visible={isLostItemModalVisible} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, isDarkMode && { backgroundColor: '#1e293b' }]}>
            <Text style={[styles.modalTitle, isDarkMode && { color: '#ffffff' }]}>الإبلاغ عن مفقودات</Text>
            <Text style={[styles.modalSubtitle, isDarkMode && { color: '#cbd5e1' }]}>اكتب تفاصيل الأشياء التي فقدتها في هذه الرحلة، وسنقوم بالتواصل معك ومع الكابتن بأسرع وقت.</Text>
            
            <TextInput 
              style={[styles.modalInputArea, isDarkMode && { backgroundColor: '#334155', color: '#ffffff', borderColor: '#475569' }]} 
              placeholder="مثال: نسيت محفظة سوداء على الكرسي الخلفي..."
              placeholderTextColor={isDarkMode ? '#64748b' : '#94a3b8'}
              value={lostItemText}
              onChangeText={setLostItemText}
              multiline={true}
            />
            
            <View style={styles.modalButtonsRow}>
              <TouchableOpacity style={styles.modalPrimaryBtn} onPress={submitLostItem} disabled={isSubmittingLost}>
                {isSubmittingLost ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.modalBtnText}>إرسال البلاغ</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setIsLostItemModalVisible(false)}>
                <Text style={styles.modalCancelText}>إلغاء</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  summaryCard: { backgroundColor: '#1e293b', borderRadius: 12, padding: 15, marginHorizontal: 15, marginTop: 15, alignItems: 'center', elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4 },
  summaryLabel: { color: '#94a3b8', fontSize: 14, fontWeight: 'bold', marginBottom: 5 },
  summaryValue: { color: '#eab308', fontSize: 24, fontWeight: 'bold' },
  rideCard: { backgroundColor: '#ffffff', padding: 15, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: '#e2e8f0', elevation: 2 },
  rideHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 10, borderBottomWidth: 1, borderColor: '#f1f5f9', paddingBottom: 8 },
  dateText: { fontSize: 13, color: '#64748b', fontWeight: 'bold' },
  statusText: { fontSize: 13, color: '#334155', fontWeight: 'bold' },
  routeText: { fontSize: 14, color: '#1e293b', marginBottom: 5, textAlign: 'right', fontWeight: 'bold' },
  rideFooter: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderColor: '#f1f5f9' },
  captainText: { flex: 1, fontSize: 14, color: '#64748b', textAlign: 'right', fontWeight: 'bold', marginRight: 5 },
  priceText: { fontSize: 16, color: '#10b981', fontWeight: 'bold', marginLeft: 10 },
  
  // تصميمات المفقودات
  lostItemBtn: { marginTop: 12, paddingVertical: 10, backgroundColor: '#fffbeb', borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: '#fde68a' },
  lostItemBtnText: { color: '#d97706', fontWeight: 'bold', fontSize: 14 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { backgroundColor: '#ffffff', width: '100%', padding: 20, borderRadius: 20, elevation: 5 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#1e293b', marginBottom: 10, textAlign: 'center' },
  modalSubtitle: { fontSize: 13, color: '#64748b', textAlign: 'center', marginBottom: 20, lineHeight: 22 },
  modalInputArea: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 12, padding: 15, fontSize: 14, color: '#0f172a', marginBottom: 20, textAlign: 'right', minHeight: 100, textAlignVertical: 'top' },
  modalButtonsRow: { flexDirection: 'row-reverse', gap: 10 },
  modalPrimaryBtn: { flex: 2, backgroundColor: '#d97706', paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  modalBtnText: { color: '#ffffff', fontWeight: 'bold', fontSize: 15 },
  modalCancelBtn: { flex: 1, backgroundColor: '#fee2e2', paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  modalCancelText: { color: '#ef4444', fontWeight: 'bold', fontSize: 15 }
});