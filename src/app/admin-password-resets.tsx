import { collection, doc, getDocs, query, updateDoc, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { db } from '../firebase';

export default function AdminPasswordResets() {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPasswordRequests = async () => {
    try {
      const q = query(
        collection(db, 'support_tickets'),
        where('type', '==', 'password_reset'),
        where('status', '==', 'pending')
      );
      const querySnapshot = await getDocs(q);
      const list: any[] = [];
      querySnapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      setRequests(list);
    } catch (error) {
      console.log(error);
      Alert.alert('خطأ', 'فشل تحميل طلبات استعادة كلمة المرور');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPasswordRequests();
  }, []);

  const handleSendTempPassword = async (item: any) => {
    try {
      const tempPassword = 'Temp@' + Math.floor(1000 + Math.random() * 9000);
      const targetCollection = item.userType === 'captain' ? 'captains' : 'passengers';
      const targetUserId = item.captainId || item.passengerId;

      if (targetUserId) {
        await updateDoc(doc(db, targetCollection, targetUserId), {
          password: tempPassword
        });
      }

      await updateDoc(doc(db, 'support_tickets', item.id), {
        status: 'resolved',
        tempPasswordSent: tempPassword
      });

      // معالجة رقم الهاتف للواتساب المصري
      let phone = item.senderPhone || item.phone || '';
      phone = phone.replace(/\D/g, ''); 
      if (phone.startsWith('0')) {
        phone = '2' + phone; 
      } else if (!phone.startsWith('20')) {
        phone = '20' + phone;
      }

      const userName = item.senderName || 'عزيزنا المستخدم';
      const message = `مرحباً ${userName} 🛺\nطلبك لاستعادة كلمة المرور في تطبيق بُرَاق تم بنجاح.\nكلمة المرور المؤقتة الخاصة بك هي:\n*${tempPassword}*\n\nبرجاء تسجيل الدخول بها وتغييرها فوراً من إعدادات حسابك.`;
      
      const whatsappUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;

      Alert.alert(
        'تم توليد الباسورد بنجاح ✅', 
        `الباسورد المؤقت هو: ${tempPassword}\n\nهل تريد فتحه وإرساله عبر الواتساب فوراً؟`,
        [
          { text: 'إلغاء', style: 'cancel' },
          { 
            text: 'إرسال عبر الواتساب 💬', 
            onPress: () => {
              Linking.openURL(whatsappUrl).catch(() => {
                Alert.alert('خطأ', 'تعذر فتح تطبيق الواتساب على جهازك.');
              });
            } 
          }
        ]
      );

      fetchPasswordRequests();
    } catch (error) {
      console.log(error);
      Alert.alert('خطأ', 'حدثت مشكلة أثناء إرسال الباسورد المؤقت.');
    }
  };

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#eab308" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.headerTitle}>طلبات تغيير وتعديل كلمات المرور 🔑</Text>
      
      {requests.length === 0 ? (
        <Text style={styles.noData}>لا توجد طلبات استعادة كلمة مرور معلقة حالياً.</Text>
      ) : (
        <FlatList
          data={requests}
          keyExtractor={(item: any) => item.id}
          renderItem={({ item }: { item: any }) => (
            <View style={styles.card}>
              <View style={styles.row}>
                <Text style={styles.label}>نوع الحساب:</Text>
                <Text style={[styles.value, { color: item.userType === 'captain' ? '#d97706' : '#2563eb', fontWeight: 'bold' }]}>
                  {item.userType === 'captain' ? 'كابتن 🛺' : 'راكب 👤'}
                </Text>
              </View>

              <View style={styles.row}>
                <Text style={styles.label}>اسم صاحب الحساب:</Text>
                <Text style={styles.value}>{item.senderName || 'غير مسجل'}</Text>
              </View>

              <View style={styles.row}>
                <Text style={styles.label}>رقم الهاتف:</Text>
                <Text style={styles.value}>{item.senderPhone || item.phone || 'غير مسجل'}</Text>
              </View>

              <TouchableOpacity 
                style={styles.actionButton} 
                onPress={() => handleSendTempPassword(item)}
              >
                <Text style={styles.actionButtonText}>توليد وإرسال باسورد مؤقت ⚡</Text>
              </TouchableOpacity>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#f8fafc' },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: '#1e293b', marginBottom: 20, textAlign: 'right' },
  noData: { textAlign: 'center', color: '#64748b', fontSize: 16, marginTop: 40 },
  card: { backgroundColor: '#ffffff', borderRadius: 12, padding: 16, marginBottom: 15, borderWidth: 1, borderColor: '#e2e8f0', elevation: 2 },
  row: { flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 8 },
  label: { fontSize: 14, color: '#64748b', fontWeight: 'bold' },
  value: { fontSize: 14, color: '#0f172a' },
  actionButton: { backgroundColor: '#10b981', paddingVertical: 12, borderRadius: 8, alignItems: 'center', marginTop: 10 },
  actionButtonText: { color: '#ffffff', fontWeight: 'bold', fontSize: 14 }
});