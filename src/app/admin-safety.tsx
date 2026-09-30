
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { collection, doc, onSnapshot, orderBy, query, updateDoc, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { db } from '../firebase';

export default function AdminSafety() {
  const router = useRouter();
  const [sosAlerts, setSosAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // مراقبة الاستغاثات الحية (Real-time)
    const q = query(collection(db, 'sos_alerts'), where('status', '==', 'active'), orderBy('timestamp', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const alerts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setSosAlerts(alerts);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // 🗑️ دالة مسح استغاثة واحدة (أو تغيير حالتها لمغلقة)
  // 🗑️ دالة مسح (إغلاق) استغاثة واحدة مع التحديث الفوري
  const handleDeleteAlert = async (alertId: string) => {
    Alert.alert(
      "تأكيد إغلاق الاستغاثة",
      "هل أنت متأكد من إنهاء هذه الاستغاثة وإزالتها من القائمة؟",
      [
        { text: "إلغاء", style: "cancel" },
        { 
          text: "إغلاق وحذف", 
          style: "destructive", 
          onPress: async () => {
            try {
              // 1️⃣ تحديث فوري محلياً عشان تختفي من الشاشة في أقل من ثانية
              setSosAlerts(prev => prev.filter(item => item.id !== alertId));

              // 2️⃣ التحديث في قاعدة البيانات في الخلفية
              await updateDoc(doc(db, 'sos_alerts', alertId), {
                status: 'closed'
              });
            } catch (error) {
              Alert.alert("خطأ", "فشل تحديث حالة الاستغاثة.");
            }
          } 
        }
      ]
    );
  };

  // 🧹 دالة مسح كل الاستغاثات النشطة مع التحديث الفوري
  const handleClearAll = async () => {
    if (sosAlerts.length === 0) return;
    Alert.alert(
      "إغلاق جميع الاستغاثات ⚠️",
      "هل أنت متأكد من إغلاق ومسح جميع الاستغاثات الحالية؟",
      [
        { text: "إلغاء", style: "cancel" },
        { 
          text: "نعم، إغلاق الكل", 
          style: "destructive", 
          onPress: async () => {
            try {
              // 1️⃣ تفريغ القائمة محلياً فوراً
              setSosAlerts([]);

              // 2️⃣ التحديث في قاعدة البيانات
              for (const item of sosAlerts) {
                await updateDoc(doc(db, 'sos_alerts', item.id), {
                  status: 'closed'
                });
              }
            } catch (error) {
              Alert.alert("خطأ", "حدث خطأ أثناء تحديث الاستغاثات.");
            }
          } 
        }
      ]
    );
  };
  const renderItem = ({ item }: { item: any }) => (
    <View style={styles.alertCardWrapper}>
      {/* كارت الاستغاثة نفسه (لما يدوس عليه يفتح أرقام الطوارئ) */}
      <TouchableOpacity 
        style={styles.alertCard}
        onPress={() => router.push({ pathname: '/admin-passenger-emergency', params: { passengerId: item.passengerId, passengerName: item.passengerName } })}
      >
        <View style={styles.alertIcon}>
          <Ionicons name="warning" size={26} color="#ffffff" />
        </View>
        <View style={styles.alertInfo}>
          <Text style={styles.alertTitle}>استغاثة طارئة! 🚨</Text>
          <Text style={styles.alertText}>الراكب: {item.passengerName}</Text>
          <Text style={styles.alertText}>رقم الراكب: {item.passengerPhone}</Text>
          <Text style={styles.alertTime}>{new Date(item.timestamp).toLocaleTimeString('ar-EG')}</Text>
        </View>
        <Ionicons name="chevron-back" size={22} color="#ef4444" />
      </TouchableOpacity>

      {/* زرار مسح استغاثة مفردة */}
      <TouchableOpacity style={styles.deleteSingleBtn} onPress={() => handleDeleteAlert(item.id)}>
        <Ionicons name="trash-outline" size={18} color="#ef4444" />
        <Text style={styles.deleteSingleText}>مسح</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-forward" size={24} color="#ffffff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>الأمان والطوارئ (SOS)</Text>
        
        {/* زرار مسح الكل يظهر فقط لو فيه استغاثات */}
        {sosAlerts.length > 0 ? (
          <TouchableOpacity onPress={handleClearAll} style={styles.clearAllBtn}>
            <Text style={styles.clearAllText}>مسح الكل</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 50 }} />
        )}
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#ef4444" style={{ marginTop: 50 }} />
      ) : sosAlerts.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="shield-checkmark" size={60} color="#10b981" />
          <Text style={styles.emptyText}>الوضع آمن. لا توجد استغاثات حالياً.</Text>
        </View>
      ) : (
        <FlatList data={sosAlerts} keyExtractor={(item) => item.id} renderItem={renderItem} contentContainerStyle={{ padding: 15 }} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#ef4444', padding: 20, paddingTop: 50 },
  headerTitle: { color: '#ffffff', fontSize: 18, fontWeight: 'bold' },
  backBtn: { padding: 5 },
  
  clearAllBtn: { backgroundColor: '#b91c1c', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  clearAllText: { color: '#ffffff', fontSize: 13, fontWeight: 'bold' },

  alertCardWrapper: { marginBottom: 15 },
  alertCard: { flexDirection: 'row-reverse', backgroundColor: '#fee2e2', borderWidth: 2, borderColor: '#ef4444', padding: 15, borderTopLeftRadius: 12, borderTopRightRadius: 12, alignItems: 'center' },
  alertIcon: { width: 45, height: 45, borderRadius: 22.5, backgroundColor: '#ef4444', justifyContent: 'center', alignItems: 'center', marginLeft: 15 },
  alertInfo: { flex: 1 },
  alertTitle: { fontSize: 17, fontWeight: 'bold', color: '#b91c1c', textAlign: 'right' },
  alertText: { fontSize: 14, color: '#7f1d1d', textAlign: 'right', marginTop: 2 },
  alertTime: { fontSize: 12, color: '#991b1b', textAlign: 'left', marginTop: 4 },

  deleteSingleBtn: { flexDirection: 'row-reverse', backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fca5a5', borderBottomLeftRadius: 12, borderBottomRightRadius: 12, paddingVertical: 8, justifyContent: 'center', alignItems: 'center', gap: 5 },
  deleteSingleText: { color: '#ef4444', fontWeight: 'bold', fontSize: 13 },

  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { fontSize: 18, color: '#10b981', fontWeight: 'bold', marginTop: 10 }
});