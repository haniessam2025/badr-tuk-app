import { useRouter } from 'expo-router';
import { addDoc, collection, doc, getDocs, limit, orderBy, query, serverTimestamp, updateDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, KeyboardAvoidingView, Platform, RefreshControl, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { db } from '../firebase';

export default function AdminComplaints() {
  const router = useRouter();
  
  const [activeMainTab, setActiveMainTab] = useState<'complaint' | 'suggestion' | 'lost_item'>('complaint');
  const [activeSubTab, setActiveSubTab] = useState<'captain' | 'passenger'>('captain');

  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false); // 👈 حالة التحديث اليدوي
  const [replyText, setReplyText] = useState<{ [key: string]: string }>({});
  const [sendingId, setSendingId] = useState<string | null>(null);

  // 👈 دالة جلب البيانات الموفرة للباقة (مرة واحدة بدلاً من المراقبة المستمرة)
  const fetchTickets = async () => {
    try {
      // 👈 تحديد 100 تذكرة فقط لتقليل القراءات (Reads)
      const q = query(collection(db, 'support_tickets'), orderBy('timestamp', 'desc'), limit(100));
      const snapshot = await getDocs(q);
      setTickets(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (error) {
      console.log(error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchTickets();
  };

  const sendPushNotification = async (expoPushToken: string, title: string, body: string) => {
    if (!expoPushToken) return;
    try {
      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: expoPushToken, sound: 'default', title, body, data: { route: '/captain-complaints' } }),
      });
    } catch (error) { console.log(error); }
  };

  const handleReply = async (ticket: any) => {
    const text = replyText[ticket.id];
    if (!text || text.trim().length === 0) {
      Alert.alert('تنبيه', 'برجاء كتابة الرد أولاً.');
      return;
    }
    setSendingId(ticket.id);
    try {
      await updateDoc(doc(db, 'support_tickets', ticket.id), {
        reply: text.trim(),
        status: 'replied',
        isReadAdmin: true
      });
      
      await addDoc(collection(db, 'notifications'), {
        userId: ticket.captainId || ticket.passengerId, 
        userType: ticket.userType || (ticket.captainId ? 'captain' : 'passenger'),
        title: 'رد من الإدارة 📩',
        message: `تم الرد على ${ticket.type === 'suggestion' ? 'مقترحك' : ticket.type === 'lost_item' ? 'بلاغ المفقودات' : 'شكواك'}:\n"${text.trim()}"`,
        timestamp: serverTimestamp(),
        read: false,
        sender: 'الإدارة'
      });

      await sendPushNotification(ticket.pushToken, 'رد جديد من الإدارة 📩', 'تم الرد على رسالتك، تفقد سجل الشكاوى والمفقودات.');
      
      // 👈 تحديث البيانات محلياً لتوفير استهلاك فايربيز بدلاً من إعادة جلبها
      setTickets(prev => prev.map(t => t.id === ticket.id ? { ...t, reply: text.trim(), status: 'replied', isReadAdmin: true } : t));
      
      Alert.alert('نجاح', 'تم إرسال الرد للمستخدم.');
      setReplyText({ ...replyText, [ticket.id]: '' });
    } catch (error) {
      Alert.alert('خطأ', 'حدثت مشكلة أثناء إرسال الرد.');
    } finally {
      setSendingId(null);
    }
  };

  const filteredTickets = tickets.filter(ticket => {
    const matchType = activeMainTab === 'suggestion' ? ticket.type === 'suggestion' 
                    : activeMainTab === 'lost_item' ? ticket.type === 'lost_item' 
                    : (ticket.type !== 'suggestion' && ticket.type !== 'lost_item');
    
    const isCaptain = ticket.userType === 'captain' || ticket.captainId;
    const matchRole = activeSubTab === 'captain' ? isCaptain : !isCaptain;

    return matchType && matchRole;
  });

  useEffect(() => {
    const unreadInCurrentView = filteredTickets.filter(t => !t.isReadAdmin);
    if (unreadInCurrentView.length > 0) {
      unreadInCurrentView.forEach(async (ticket) => {
        try {
          await updateDoc(doc(db, 'support_tickets', ticket.id), { isReadAdmin: true });
          // تحديث محلي لإلغاء العداد الأحمر فوراً دون قراءة جديدة من فايربيز
          setTickets(prev => prev.map(t => t.id === ticket.id ? { ...t, isReadAdmin: true } : t));
        } catch (e) {}
      });
    }
  }, [activeMainTab, activeSubTab, tickets]);

  const unreadTickets = tickets.filter(t => !t.isReadAdmin);
  const unreadComplaintsCount = unreadTickets.filter(t => t.type !== 'suggestion' && t.type !== 'lost_item').length;
  const unreadSuggestionsCount = unreadTickets.filter(t => t.type === 'suggestion').length;
  const unreadLostItemsCount = unreadTickets.filter(t => t.type === 'lost_item').length;
  
  const unreadForActiveMainTab = unreadTickets.filter(t => {
    if (activeMainTab === 'suggestion') return t.type === 'suggestion';
    if (activeMainTab === 'lost_item') return t.type === 'lost_item';
    return t.type !== 'suggestion' && t.type !== 'lost_item';
  });

  const unreadCaptainsCount = unreadForActiveMainTab.filter(t => t.userType === 'captain' || t.captainId).length;
  const unreadPassengersCount = unreadForActiveMainTab.filter(t => t.userType !== 'captain' && !t.captainId).length;

  const renderTicket = ({ item }: { item: any }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={[
          styles.typeBadge, 
          item.type === 'lost_item' ? { backgroundColor: '#0ea5e9' } : item.type === 'suggestion' ? { backgroundColor: '#eab308' } : { backgroundColor: '#ef4444' }
        ]}>
          {item.type === 'lost_item' ? '🔍 مفقودات' : item.type === 'suggestion' ? '💡 مقترح' : '⚠️ شكوى'}
        </Text>
        <Text style={styles.dateText}>{item.timestamp ? new Date(item.timestamp.toDate()).toLocaleDateString('ar-EG') : ''}</Text>
      </View>
      <View style={styles.userInfoBox}>
        <Text style={styles.infoText}>المرسل: {item.captainName || item.senderName || 'غير مسجل'}</Text>
        <Text style={styles.infoText}>رقم الهاتف: {item.captainPhone || item.senderPhone || 'غير مسجل'}</Text>
      </View>
      <View style={styles.contentBox}>
        <Text style={styles.contentText}>{item.content}</Text>
      </View>

      {item.status === 'replied' || item.reply ? (
        <View style={styles.repliedBox}>
          <Text style={styles.repliedTitle}>تم الرد:</Text>
          <Text style={styles.repliedText}>{item.reply}</Text>
        </View>
      ) : (
        <View style={styles.replyActionBox}>
          <TextInput
            style={styles.replyInput}
            placeholder="اكتب ردك هنا..."
            placeholderTextColor="#64748b"
            multiline
            value={replyText[item.id] || ''}
            onChangeText={(text) => setReplyText({ ...replyText, [item.id]: text })}
            textAlign="right"
          />
          <TouchableOpacity style={styles.sendReplyBtn} onPress={() => handleReply(item)} disabled={sendingId === item.id}>
            {sendingId === item.id ? <ActivityIndicator color="#000" size="small" /> : <Text style={styles.sendReplyText}>إرسال الرد</Text>}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}><Text style={styles.backBtnText}>رجوع ⬅️</Text></TouchableOpacity>
        <Text style={styles.headerTitle}>شكاوى ومقترحات ومفقودات 📬</Text>
      </View>

      <View style={styles.mainTabsContainer}>
        <TouchableOpacity style={[styles.mainTab, activeMainTab === 'complaint' && styles.mainTabActiveComplaint]} onPress={() => setActiveMainTab('complaint')}>
          <Text style={[styles.mainTabText, activeMainTab === 'complaint' && styles.mainTabTextActive]}>شكاوى ⚠️</Text>
          {unreadComplaintsCount > 0 && (
            <View style={styles.badge}><Text style={styles.badgeText}>{unreadComplaintsCount}</Text></View>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={[styles.mainTab, activeMainTab === 'suggestion' && styles.mainTabActiveSuggestion]} onPress={() => setActiveMainTab('suggestion')}>
          <Text style={[styles.mainTabText, activeMainTab === 'suggestion' && styles.mainTabTextActive]}>مقترحات 💡</Text>
          {unreadSuggestionsCount > 0 && (
            <View style={styles.badge}><Text style={styles.badgeText}>{unreadSuggestionsCount}</Text></View>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={[styles.mainTab, activeMainTab === 'lost_item' && styles.mainTabActiveLostItem]} onPress={() => setActiveMainTab('lost_item')}>
          <Text style={[styles.mainTabText, activeMainTab === 'lost_item' && styles.mainTabTextActive]}>مفقودات 🔍</Text>
          {unreadLostItemsCount > 0 && (
            <View style={styles.badge}><Text style={styles.badgeText}>{unreadLostItemsCount}</Text></View>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.subTabsContainer}>
        <TouchableOpacity style={[styles.subTab, activeSubTab === 'captain' && styles.subTabActive]} onPress={() => setActiveSubTab('captain')}>
          <Text style={[styles.subTabText, activeSubTab === 'captain' && styles.subTabTextActive]}>من الكباتن 👨‍✈️</Text>
          {unreadCaptainsCount > 0 && (
            <View style={styles.subBadge}><Text style={styles.badgeText}>{unreadCaptainsCount}</Text></View>
          )}
        </TouchableOpacity>
        
        <TouchableOpacity style={[styles.subTab, activeSubTab === 'passenger' && styles.subTabActive]} onPress={() => setActiveSubTab('passenger')}>
          <Text style={[styles.subTabText, activeSubTab === 'passenger' && styles.subTabTextActive]}>من الركاب 👤</Text>
          {unreadPassengersCount > 0 && (
            <View style={styles.subBadge}><Text style={styles.badgeText}>{unreadPassengersCount}</Text></View>
          )}
        </TouchableOpacity>
      </View>

      {loading ? <ActivityIndicator size="large" color="#eab308" style={{ marginTop: 50 }} /> : (
        <FlatList
          data={filteredTickets}
          keyExtractor={(item) => item.id}
          renderItem={renderTicket}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 20 }}
          /* 👈 إضافة السحب للأسفل للتحديث (Pull to Refresh) */
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#eab308']} tintColor="#eab308" />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>لا توجد بيانات متاحة في هذا القسم حالياً.</Text>
            </View>
          }
        />
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a', padding: 15, paddingTop: 45 },
  header: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  headerTitle: { fontSize: 16, fontWeight: 'bold', color: '#eab308' },
  backBtn: { backgroundColor: '#334155', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8 },
  backBtnText: { color: '#f8fafc', fontWeight: 'bold' },

  mainTabsContainer: { flexDirection: 'row-reverse', gap: 6, marginBottom: 15 },
  mainTab: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center', backgroundColor: '#1e293b', borderWidth: 1, borderColor: '#334155', position: 'relative' },
  mainTabActiveComplaint: { backgroundColor: '#be123c', borderColor: '#be123c' },
  mainTabActiveSuggestion: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  mainTabActiveLostItem: { backgroundColor: '#0284c7', borderColor: '#0284c7' },
  mainTabText: { fontSize: 13, fontWeight: 'bold', color: '#94a3b8' },
  mainTabTextActive: { color: '#ffffff' },

  subTabsContainer: { flexDirection: 'row-reverse', backgroundColor: '#1e293b', borderRadius: 10, padding: 4, marginBottom: 20 },
  subTab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8, position: 'relative' },
  subTabActive: { backgroundColor: '#eab308' },
  subTabText: { fontSize: 14, fontWeight: 'bold', color: '#94a3b8' },
  subTabTextActive: { color: '#000000' },

  badge: { position: 'absolute', top: -6, right: -6, backgroundColor: '#ef4444', minWidth: 20, height: 20, borderRadius: 10, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#0f172a', elevation: 2 },
  subBadge: { position: 'absolute', top: 2, right: 2, backgroundColor: '#ef4444', minWidth: 18, height: 18, borderRadius: 9, justifyContent: 'center', alignItems: 'center' },
  badgeText: { color: '#ffffff', fontSize: 10, fontWeight: 'bold' },

  emptyContainer: { alignItems: 'center', marginTop: 40 },
  emptyText: { color: '#64748b', fontSize: 15 },

  card: { backgroundColor: '#1e293b', padding: 15, borderRadius: 14, marginBottom: 15, borderWidth: 1, borderColor: '#334155' },
  cardHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 12, alignItems: 'center' },
  typeBadge: { fontWeight: 'bold', color: '#f8fafc', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, fontSize: 12 },
  dateText: { color: '#94a3b8', fontSize: 12 },
  
  userInfoBox: { backgroundColor: '#0f172a', padding: 12, borderRadius: 10, marginBottom: 12, borderWidth: 1, borderColor: '#334155' },
  infoText: { textAlign: 'right', color: '#f8fafc', fontWeight: 'bold', marginBottom: 4, fontSize: 13 },
  
  contentBox: { marginBottom: 15, paddingHorizontal: 5 },
  contentText: { textAlign: 'right', color: '#cbd5e1', lineHeight: 22, fontSize: 14 },
  
  replyActionBox: { borderTopWidth: 1, borderColor: '#334155', paddingTop: 15 },
  replyInput: { backgroundColor: '#0f172a', color: '#f8fafc', borderRadius: 10, padding: 12, minHeight: 70, textAlign: 'right', textAlignVertical: 'top', marginBottom: 10, borderWidth: 1, borderColor: '#334155' },
  sendReplyBtn: { backgroundColor: '#eab308', paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  sendReplyText: { color: '#000000', fontWeight: 'bold', fontSize: 15 },
  
  repliedBox: { backgroundColor: '#064e3b', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#059669' },
  repliedTitle: { fontWeight: 'bold', color: '#a7f3d0', textAlign: 'right', marginBottom: 5, fontSize: 13 },
  repliedText: { color: '#ecfdf5', textAlign: 'right', fontSize: 14, lineHeight: 20 }
});