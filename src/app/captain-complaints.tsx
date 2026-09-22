import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { addDoc, collection, doc, getDoc, getDocs, limit, orderBy, query, serverTimestamp, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, KeyboardAvoidingView, Platform, RefreshControl, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { db } from '../firebase';

export default function CaptainComplaints() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'suggestion' | 'complaint' | 'lost_item'>('suggestion');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [tickets, setTickets] = useState<any[]>([]);
  const [captainData, setCaptainData] = useState<any>(null);
  const [fetching, setFetching] = useState(true);
  const [refreshing, setRefreshing] = useState(false); // 👈 حالة التحديث اليدوي

  // 👈 دالة جلب البيانات الموفرة للباقة
  const fetchTickets = async (captainId: string) => {
    try {
      // 👈 تحديد 50 تذكرة فقط لتقليل القراءات
      const q = query(
        collection(db, 'support_tickets'), 
        where('captainId', '==', captainId), 
        orderBy('timestamp', 'desc'), 
        limit(50)
      );
      const snapshot = await getDocs(q);
      const fetchedTickets = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTickets(fetchedTickets);
    } catch (error) {
      console.log('Error fetching tickets:', error);
    } finally {
      setFetching(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    const init = async () => {
      try {
        const id = await AsyncStorage.getItem('currentCaptainId');
        if (!id) return;
        
        const docRef = doc(db, 'captains', id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setCaptainData({ id, ...docSnap.data() });
        }

        // جلب التذاكر مرة واحدة عند الفتح
        await fetchTickets(id);
      } catch (error) {
        console.log('Error init:', error);
        setFetching(false);
      }
    };

    init();
  }, []);

  // 👈 دالة التحديث عند السحب للأسفل
  const onRefresh = () => {
    if (captainData?.id) {
      setRefreshing(true);
      fetchTickets(captainData.id);
    }
  };

  const submitTicket = async () => {
    if (content.trim().length < 5) {
      Alert.alert('تنبيه', 'برجاء كتابة تفاصيل واضحة (5 أحرف على الأقل).');
      return;
    }
    setLoading(true);
    try {
      const newTicket = {
        captainId: captainData.id,
        captainName: captainData.name || 'غير مسجل',
        captainPhone: captainData.phone || 'غير مسجل',
        userType: 'captain',
        pushToken: captainData.pushToken || '',
        type: activeTab,
        content: content.trim(),
        status: 'pending',
        reply: '',
        timestamp: serverTimestamp()
      };
      
      const docRef = await addDoc(collection(db, 'support_tickets'), newTicket);
      
      // 👈 إضافة التذكرة للشاشة محلياً لتوفير استهلاك إعادة الجلب من فايربيز
      setTickets(prev => [{ id: docRef.id, ...newTicket }, ...prev]);
      
      Alert.alert('نجاح ✅', 'تم إرسال رسالتك للإدارة بنجاح وسيتم التواصل معك قريباً.');
      setContent('');
    } catch (error) {
      Alert.alert('خطأ', 'حدثت مشكلة أثناء الإرسال.');
    } finally {
      setLoading(false);
    }
  };

  const renderTicket = ({ item }: { item: any }) => (
    <View style={styles.ticketCard}>
      <View style={styles.ticketHeader}>
        <Text style={[
          styles.ticketType, 
          item.type === 'lost_item' ? { color: '#2563eb' } : item.type === 'suggestion' ? { color: '#eab308' } : { color: '#ef4444' }
        ]}>
          {item.type === 'lost_item' ? '🔍 مفقودات' : item.type === 'suggestion' ? '💡 مقترح' : '⚠️ شكوى'}
        </Text>
        <Text style={[styles.ticketStatus, { color: item.status === 'replied' ? '#10b981' : '#f59e0b' }]}>
          {item.status === 'replied' ? 'تم الرد' : 'قيد المراجعة'}
        </Text>
      </View>
      <Text style={styles.ticketContent}>{item.content}</Text>
      
      {item.status === 'replied' && item.reply ? (
        <View style={styles.replyBox}>
          <Text style={styles.replyTitle}>رد الإدارة:</Text>
          <Text style={styles.replyContent}>{item.reply}</Text>
        </View>
      ) : null}
    </View>
  );

  const getPlaceholderText = () => {
    if (activeTab === 'lost_item') return 'عثرت على شيء في مركبتك؟ أو فقدت شيئاً؟ اكتب التفاصيل هنا...';
    if (activeTab === 'suggestion') return 'اكتب مقترحك هنا لتطوير التطبيق...';
    return 'اكتب تفاصيل شكواك هنا...';
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}><Text style={styles.backBtnText}>رجوع ⬅️</Text></TouchableOpacity>
        <Text style={styles.headerTitle}>المقترحات والشكاوى</Text>
      </View>

      <View style={styles.tabsRow}>
        <TouchableOpacity style={[styles.tabBtn, activeTab === 'complaint' && styles.tabBtnActive]} onPress={() => setActiveTab('complaint')}>
          <Text style={[styles.tabText, activeTab === 'complaint' && styles.tabTextActive]}>شكوى</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tabBtn, activeTab === 'suggestion' && styles.tabBtnActive]} onPress={() => setActiveTab('suggestion')}>
          <Text style={[styles.tabText, activeTab === 'suggestion' && styles.tabTextActive]}>مقترح</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tabBtn, activeTab === 'lost_item' && styles.tabBtnActiveLost]} onPress={() => setActiveTab('lost_item')}>
          <Text style={[styles.tabText, activeTab === 'lost_item' && styles.tabTextActive]}>مفقودات 🔍</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.inputArea}
          placeholder={getPlaceholderText()}
          placeholderTextColor="#94a3b8"
          multiline
          value={content}
          onChangeText={setContent}
          textAlign="right"
        />
        <TouchableOpacity style={styles.submitBtn} onPress={submitTicket} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>إرسال للإدارة</Text>}
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>سجل رسائلك السابقة</Text>
      {fetching ? (
        <ActivityIndicator size="large" color="#2563eb" style={{ marginTop: 20 }} />
      ) : (
        <FlatList
          data={tickets}
          keyExtractor={(item) => item.id}
          renderItem={renderTicket}
          showsVerticalScrollIndicator={false}
          /* 👈 إضافة ميزة السحب للتحديث هنا */
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#2563eb']} tintColor="#2563eb" />
          }
          ListEmptyComponent={<Text style={styles.emptyText}>لا توجد رسائل سابقة.</Text>}
        />
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9', padding: 15, paddingTop: 45 },
  header: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#1e293b' },
  backBtn: { backgroundColor: '#e2e8f0', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8 },
  backBtnText: { color: '#334155', fontWeight: 'bold' },
  tabsRow: { flexDirection: 'row-reverse', marginBottom: 15, gap: 8 },
  tabBtn: { flex: 1, paddingVertical: 12, backgroundColor: '#e2e8f0', borderRadius: 10, alignItems: 'center' },
  tabBtnActive: { backgroundColor: '#2563eb' },
  tabBtnActiveLost: { backgroundColor: '#0284c7' },
  tabText: { fontSize: 13, fontWeight: 'bold', color: '#475569' },
  tabTextActive: { color: '#ffffff' },
  inputContainer: { backgroundColor: '#ffffff', padding: 15, borderRadius: 12, elevation: 2, marginBottom: 20 },
  inputArea: { height: 100, backgroundColor: '#f8fafc', borderRadius: 8, padding: 10, borderWidth: 1, borderColor: '#cbd5e1', textAlignVertical: 'top', color: '#1e293b', marginBottom: 15 },
  submitBtn: { backgroundColor: '#10b981', paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  submitBtnText: { color: '#ffffff', fontWeight: 'bold', fontSize: 16 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#334155', marginBottom: 10, textAlign: 'right' },
  ticketCard: { backgroundColor: '#ffffff', padding: 15, borderRadius: 10, marginBottom: 10, elevation: 1, borderWidth: 1, borderColor: '#e2e8f0' },
  ticketHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 8 },
  ticketType: { fontWeight: 'bold', color: '#1e293b' },
  ticketStatus: { fontWeight: 'bold', fontSize: 12 },
  ticketContent: { color: '#475569', textAlign: 'right', lineHeight: 22 },
  replyBox: { marginTop: 10, backgroundColor: '#ecfdf5', padding: 10, borderRadius: 8, borderWidth: 1, borderColor: '#a7f3d0' },
  replyTitle: { fontWeight: 'bold', color: '#065f46', textAlign: 'right', marginBottom: 5 },
  replyContent: { color: '#064e3b', textAlign: 'right', fontSize: 14, lineHeight: 22 },
  emptyText: { textAlign: 'center', color: '#94a3b8', marginTop: 20 }
});