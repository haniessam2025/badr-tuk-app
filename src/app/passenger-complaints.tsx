import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { addDoc, collection, doc, getDoc, onSnapshot, orderBy, query, serverTimestamp, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { db } from '../firebase';
import { useApp } from './AppContext';

export default function PassengerComplaints() {
  const router = useRouter();
  const { isDarkMode } = useApp();
  
  const [activeTab, setActiveTab] = useState<'complaint' | 'suggestion' | 'lost'>('complaint');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [userData, setUserData] = useState<any>(null);
  const [myTickets, setMyTickets] = useState<any[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const passengerId = await AsyncStorage.getItem('currentPassengerId');
      if (!passengerId) return;

      const docSnap = await getDoc(doc(db, 'passengers', passengerId));
      const passengerName = docSnap.exists() ? docSnap.data().name : 'راكب';

      setUserData({ id: passengerId, type: 'passenger', name: passengerName });
      
      // جلب الرسائل السابقة الخاصة بالراكب
      const q = query(
        collection(db, 'complaints_tickets'),
        where('senderId', '==', passengerId),
        orderBy('timestamp', 'desc')
      );

      const unsubscribe = onSnapshot(q, (snap) => {
        const tickets = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setMyTickets(tickets);
      });

      return () => unsubscribe();
    } catch (e) {
      console.log('Error loading data:', e);
    }
  };

  const submitComplaint = async () => {
    if (!message.trim()) return Alert.alert('تنبيه', 'برجاء كتابة رسالتك أولاً.');

    setLoading(true);
    try {
      await addDoc(collection(db, 'complaints_tickets'), {
        senderId: userData?.id || 'unknown',
        senderType: userData?.type || 'unknown',
        senderName: userData?.name || 'مستخدم غير معروف',
        text: message.trim(),
        status: 'pending',
        isReadAdmin: false,
        ticketType: activeTab, // (complaint, suggestion, lost)
        timestamp: serverTimestamp()
      });
      
      setMessage('');
      Alert.alert('تم 📩', 'تم إرسال رسالتك للإدارة بنجاح.');
    } catch (error) {
      Alert.alert('خطأ', 'فشل الإرسال، تأكد من اتصالك بالإنترنت.');
    } finally {
      setLoading(false);
    }
  };

  const filteredTickets = myTickets.filter(t => t.ticketType === activeTab);

  const getPlaceholderText = () => {
    if (activeTab === 'complaint') return 'اكتب تفاصيل شكواك هنا...';
    if (activeTab === 'suggestion') return 'اكتب مقترحك هنا لتطوير التطبيق...';
    return 'عثرت على شيء في مركبتك؟ أو فقدت شيئاً؟ اكتب التفاصيل هنا...';
  };

  const getTabTitleText = () => {
    if (activeTab === 'complaint') return 'سجل الشكاوى السابقة';
    if (activeTab === 'suggestion') return 'سجل المقترحات السابقة';
    return 'سجل المفقودات السابقة';
  };

  const renderTicket = ({ item }: { item: any }) => {
    return (
      <View style={[styles.ticketCard, isDarkMode && { backgroundColor: '#1e293b', borderColor: '#334155' }]}>
        <View style={styles.ticketHeader}>
          <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 5 }}>
            {item.ticketType === 'lost' && <Ionicons name="search" size={16} color="#3b82f6" />}
            <Text style={{ fontSize: 15, fontWeight: 'bold', color: '#3b82f6' }}>
              {item.ticketType === 'complaint' ? 'شكوى' : item.ticketType === 'suggestion' ? 'مقترح' : 'مفقودات'}
            </Text>
          </View>
          <Text style={[styles.ticketStatus, item.reply ? { color: '#10b981' } : { color: '#f59e0b' }]}>
            {item.reply ? 'تم الرد ✔️' : 'قيد المراجعة ⏳'}
          </Text>
        </View>
        
        <Text style={[styles.ticketText, isDarkMode && { color: '#e2e8f0' }]}>{item.text}</Text>
        
        {item.reply && (
          <View style={[styles.replyBox, isDarkMode && { backgroundColor: '#0f172a', borderColor: '#064e3b' }]}>
            <Text style={[styles.replyTitle, isDarkMode && { color: '#10b981' }]}>رد الإدارة (خدمة العملاء):</Text>
            <Text style={[styles.replyText, isDarkMode && { color: '#f8fafc' }]}>{item.reply}</Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <KeyboardAvoidingView style={[styles.container, isDarkMode && { backgroundColor: '#0f172a' }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.header, isDarkMode && { borderBottomColor: '#334155' }]}>
        <TouchableOpacity style={[styles.backBtn, isDarkMode && { backgroundColor: '#334155' }]} onPress={() => router.back()}>
          <Text style={[styles.backBtnText, isDarkMode && { color: '#e2e8f0' }]}>رجوع ➔</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, isDarkMode && { color: '#ffffff' }]}>المقترحات والشكاوى</Text>
      </View>

      <FlatList
        data={filteredTickets}
        keyExtractor={item => item.id}
        renderItem={renderTicket}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 20 }}
        ListHeaderComponent={
          <View style={styles.content}>
            
            {/* التابات الثلاثة (شكوى، مقترح، مفقودات) */}
            <View style={styles.tabsContainer}>
              <TouchableOpacity 
                style={[styles.tabBtn, activeTab === 'complaint' && styles.tabActive, isDarkMode && activeTab !== 'complaint' && { backgroundColor: '#1e293b' }]} 
                onPress={() => { setActiveTab('complaint'); setMessage(''); }}
              >
                <Text style={[styles.tabText, activeTab === 'complaint' && { color: '#ffffff' }, isDarkMode && activeTab !== 'complaint' && { color: '#94a3b8' }]}>شكوى</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.tabBtn, activeTab === 'suggestion' && styles.tabActive, isDarkMode && activeTab !== 'suggestion' && { backgroundColor: '#1e293b' }]} 
                onPress={() => { setActiveTab('suggestion'); setMessage(''); }}
              >
                <Text style={[styles.tabText, activeTab === 'suggestion' && { color: '#ffffff' }, isDarkMode && activeTab !== 'suggestion' && { color: '#94a3b8' }]}>مقترح</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.tabBtn, activeTab === 'lost' && styles.tabActive, isDarkMode && activeTab !== 'lost' && { backgroundColor: '#1e293b' }]} 
                onPress={() => { setActiveTab('lost'); setMessage(''); }}
              >
                <Text style={[styles.tabText, activeTab === 'lost' && { color: '#ffffff' }, isDarkMode && activeTab !== 'lost' && { color: '#94a3b8' }]}>مفقودات 🔍</Text>
              </TouchableOpacity>
            </View>

            {/* صندوق الكتابة */}
            <View style={[styles.inputBox, isDarkMode && { backgroundColor: '#1e293b', borderColor: '#334155' }]}>
              <TextInput
                style={[styles.input, isDarkMode && { color: '#ffffff' }]}
                placeholder={getPlaceholderText()}
                placeholderTextColor={isDarkMode ? "#64748b" : "#94a3b8"}
                multiline
                value={message}
                onChangeText={setMessage}
                textAlign="right"
              />

              <TouchableOpacity style={[styles.submitBtn, { backgroundColor: '#10b981' }]} onPress={submitComplaint} disabled={loading}>
                {loading ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.submitBtnText}>إرسال للإدارة</Text>}
              </TouchableOpacity>
            </View>

            <Text style={[styles.historyTitle, isDarkMode && { color: '#cbd5e1' }]}>
              {getTabTitleText()}
            </Text>

            {filteredTickets.length === 0 && (
              <Text style={{ textAlign: 'center', color: '#94a3b8', marginTop: 30, fontSize: 16 }}>لا توجد رسائل سابقة.</Text>
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
  
  tabsContainer: { flexDirection: 'row-reverse', gap: 10, marginBottom: 20 },
  tabBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: '#e2e8f0', alignItems: 'center' },
  tabActive: { backgroundColor: '#2563eb' },
  tabText: { fontSize: 16, fontWeight: 'bold', color: '#475569' },

  inputBox: { backgroundColor: '#ffffff', borderRadius: 16, padding: 15, elevation: 2, marginBottom: 30, borderWidth: 1, borderColor: '#e2e8f0' },
  input: { fontSize: 16, color: '#1e293b', minHeight: 120, textAlignVertical: 'top', marginBottom: 15 },
  submitBtn: { paddingVertical: 15, borderRadius: 10, alignItems: 'center' },
  submitBtnText: { color: '#ffffff', fontSize: 16, fontWeight: 'bold' },
  
  historyTitle: { textAlign: 'right', fontSize: 18, fontWeight: 'bold', color: '#1e293b', marginBottom: 15 },
  ticketCard: { backgroundColor: '#ffffff', padding: 15, borderRadius: 12, marginBottom: 15, borderWidth: 1, borderColor: '#e2e8f0', elevation: 2 },
  ticketHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 10, alignItems: 'center' },
  ticketStatus: { fontSize: 12, fontWeight: 'bold' },
  ticketText: { fontSize: 15, color: '#1e293b', textAlign: 'right', lineHeight: 22 },
  replyBox: { marginTop: 15, backgroundColor: '#ecfdf5', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#a7f3d0' },
  replyTitle: { fontSize: 14, fontWeight: 'bold', color: '#059669', marginBottom: 5, textAlign: 'right' },
  replyText: { fontSize: 15, color: '#064e3b', textAlign: 'right', lineHeight: 24, fontWeight: 'bold' }
});