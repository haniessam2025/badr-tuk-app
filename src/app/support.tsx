import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { addDoc, collection, doc, getDoc, onSnapshot, orderBy, query, serverTimestamp, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { db } from '../firebase';
import { useApp } from './AppContext'; // العقل المركزي للوضع الداكن

export default function Support() {
  const router = useRouter();
  const { isDarkMode } = useApp();
  
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [userData, setUserData] = useState<any>(null);
  const [myTickets, setMyTickets] = useState<any[]>([]); // 👈 لتخزين التذاكر والردود

  useEffect(() => {
    checkUserTypeAndLoadTickets();
  }, []);

  const checkUserTypeAndLoadTickets = async () => {
    try {
      let currentId = null;
      let currentType = null;
      let currentName = null;

      const captainId = await AsyncStorage.getItem('currentCaptainId');
      if (captainId) {
        const docSnap = await getDoc(doc(db, 'captains', captainId));
        currentId = captainId;
        currentType = 'captain';
        currentName = docSnap.data()?.name;
      } else {
        const passengerId = await AsyncStorage.getItem('currentPassengerId');
        if (passengerId) {
          const docSnap = await getDoc(doc(db, 'passengers', passengerId));
          currentId = passengerId;
          currentType = 'passenger';
          currentName = docSnap.data()?.name;
        }
      }

      if (currentId) {
        setUserData({ id: currentId, type: currentType, name: currentName });
        
        // 👈 جلب الشكاوى والردود الخاصة بهذا المستخدم لحظياً
        const q = query(
          collection(db, 'support_tickets'), // 👈 توحيد المسار مع لوحة الإدارة
          where('senderId', '==', currentId),
          orderBy('timestamp', 'desc')
        );

        const unsubscribe = onSnapshot(q, (snap) => {
          const tickets = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          setMyTickets(tickets);
        });

        return () => unsubscribe();
      }
    } catch (e) {
      console.log('Error loading support data:', e);
    }
  };

  const submitComplaint = async () => {
    if (!message.trim()) {
      Alert.alert('تنبيه', 'برجاء كتابة رسالتك أولاً.');
      return;
    }

    setLoading(true);
    try {
      await addDoc(collection(db, 'support_tickets'), { // 👈 تم التعديل لتسمع في الإدارة فوراً
        senderId: userData?.id || 'unknown',
        senderType: userData?.type || 'unknown',
        senderName: userData?.name || 'مستخدم غير معروف',
        text: message.trim(),
        status: 'pending',
        isReadAdmin: false, // 👈 عشان تنور أحمر في الإدارة
        timestamp: serverTimestamp()
      });
      
      setMessage(''); // تفريغ الخانة بعد الإرسال
      Alert.alert('تم 📩', 'تم إرسال رسالتك للإدارة بنجاح وسيتم الرد عليك قريباً.');
    } catch (error) {
      Alert.alert('خطأ', 'فشل الإرسال، تأكد من اتصالك بالإنترنت.');
    } finally {
      setLoading(false);
    }
  };

  const renderTicket = ({ item }: { item: any }) => (
    <View style={[styles.ticketCard, isDarkMode && { backgroundColor: '#1e293b', borderColor: '#334155' }]}>
      <View style={styles.ticketHeader}>
        <Text style={[styles.ticketDate, isDarkMode && { color: '#94a3b8' }]}>
          {item.timestamp?.toDate ? item.timestamp.toDate().toLocaleDateString('ar-EG') : 'الآن'}
        </Text>
        <Text style={[styles.ticketStatus, item.reply ? { color: '#10b981' } : { color: '#f59e0b' }]}>
          {item.reply ? 'تم الرد ✅' : 'قيد المراجعة ⏳'}
        </Text>
      </View>
      
      <Text style={[styles.ticketText, isDarkMode && { color: '#e2e8f0' }]}>{item.text}</Text>
      
      {/* 👈 هنا هيظهر رد الإدارة بمجرد ما ترد من لوحة التحكم */}
      {item.reply && (
        <View style={[styles.replyBox, isDarkMode && { backgroundColor: '#0f172a', borderColor: '#064e3b' }]}>
          <Text style={[styles.replyTitle, isDarkMode && { color: '#10b981' }]}>رد الإدارة الدعم الفني:</Text>
          <Text style={[styles.replyText, isDarkMode && { color: '#f8fafc' }]}>{item.reply}</Text>
        </View>
      )}
    </View>
  );

  return (
    <KeyboardAvoidingView style={[styles.container, isDarkMode && { backgroundColor: '#0f172a' }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.header, isDarkMode && { borderBottomColor: '#334155' }]}>
        <TouchableOpacity style={[styles.backBtn, isDarkMode && { backgroundColor: '#334155' }]} onPress={() => router.back()}>
          <Text style={[styles.backBtnText, isDarkMode && { color: '#e2e8f0' }]}>رجوع ➔</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, isDarkMode && { color: '#ffffff' }]}>الدعم الفني 🎧</Text>
      </View>

      <FlatList
        data={myTickets}
        keyExtractor={item => item.id}
        renderItem={renderTicket}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 20 }}
        ListHeaderComponent={
          <View style={styles.content}>
            <Text style={[styles.title, isDarkMode && { color: '#eab308' }]}>كيف يمكننا مساعدتك؟</Text>
            <Text style={[styles.subtitle, isDarkMode && { color: '#94a3b8' }]}>اكتب شكواك أو استفسارك هنا، وسيقوم فريق الدعم بمراجعته والرد عليك في أسرع وقت.</Text>

            <TextInput
              style={[styles.input, isDarkMode && { backgroundColor: '#1e293b', borderColor: '#334155', color: '#ffffff' }]}
              placeholder="اكتب رسالتك هنا بالتفصيل..."
              placeholderTextColor={isDarkMode ? "#64748b" : "#94a3b8"}
              multiline
              value={message}
              onChangeText={setMessage}
              textAlign="right"
            />

            <TouchableOpacity style={styles.submitBtn} onPress={submitComplaint} disabled={loading}>
              {loading ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.submitBtnText}>إرسال للإدارة 🚀</Text>}
            </TouchableOpacity>

            {myTickets.length > 0 && (
              <Text style={[styles.historyTitle, isDarkMode && { color: '#cbd5e1' }]}>سجل الشكاوى والرسائل السابقة 👇</Text>
            )}
          </View>
        }
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9', padding: 15, paddingTop: 45 },
  header: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingBottom: 15, borderBottomWidth: 1, borderColor: '#e2e8f0' },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#1e293b' },
  backBtn: { backgroundColor: '#e2e8f0', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8 },
  backBtnText: { color: '#334155', fontWeight: 'bold' },
  content: { marginBottom: 20 },
  title: { fontSize: 22, fontWeight: 'bold', color: '#d97706', marginBottom: 10, textAlign: 'right' },
  subtitle: { fontSize: 14, color: '#64748b', marginBottom: 20, textAlign: 'right', lineHeight: 22 },
  input: { backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 14, padding: 15, fontSize: 16, color: '#1e293b', minHeight: 120, textAlignVertical: 'top', marginBottom: 20 },
  submitBtn: { backgroundColor: '#2563eb', paddingVertical: 15, borderRadius: 14, alignItems: 'center', elevation: 3 },
  submitBtnText: { color: '#ffffff', fontSize: 16, fontWeight: 'bold' },
  
  historyTitle: { textAlign: 'right', fontSize: 16, fontWeight: 'bold', color: '#475569', marginTop: 30, marginBottom: 10 },
  ticketCard: { backgroundColor: '#ffffff', padding: 15, borderRadius: 12, marginBottom: 15, borderWidth: 1, borderColor: '#e2e8f0', elevation: 2 },
  ticketHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 10 },
  ticketDate: { fontSize: 12, color: '#94a3b8', fontWeight: 'bold' },
  ticketStatus: { fontSize: 12, fontWeight: 'bold' },
  ticketText: { fontSize: 15, color: '#1e293b', textAlign: 'right', lineHeight: 22 },
  replyBox: { marginTop: 15, backgroundColor: '#ecfdf5', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#a7f3d0' },
  replyTitle: { fontSize: 13, fontWeight: 'bold', color: '#059669', marginBottom: 5, textAlign: 'right' },
  replyText: { fontSize: 14, color: '#064e3b', textAlign: 'right', lineHeight: 22, fontWeight: 'bold' }
});