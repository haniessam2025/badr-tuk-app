import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { addDoc, collection, doc, getDoc, limit, onSnapshot, orderBy, query, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { db } from '../firebase';

export default function LiveSupportChat() {
  const router = useRouter();
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  
  const [userId, setUserId] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>('مستخدم');
  const [userType, setUserType] = useState<'captain' | 'passenger'>('passenger');
  
  const flatListRef = useRef<FlatList>(null);

  // 1. تحديد هوية المستخدم (كابتن أو راكب)
  useEffect(() => {
    const identifyUser = async () => {
      try {
        let id = await AsyncStorage.getItem('currentCaptainId');
        if (id) {
          setUserId(id); setUserType('captain');
          const profileStr = await AsyncStorage.getItem('captain_profile');
          if (profileStr) setUserName(JSON.parse(profileStr).name);
        } else {
          id = await AsyncStorage.getItem('currentPassengerId');
          if (id) {
            setUserId(id); setUserType('passenger');
            const profileStr = await AsyncStorage.getItem('passenger_profile');
            if (profileStr) setUserName(JSON.parse(profileStr).name);
          }
        }
      } catch (error) {}
    };
    identifyUser();
  }, []);

  // 2. الاستماع للرسايل بأقل استهلاك (أحدث 30 رسالة فقط)
  useEffect(() => {
    if (!userId) return;

    // توفير القراءات: قراءة 30 رسالة فقط مرتبة من الأحدث
    const q = query(
      collection(db, 'support_chats', userId, 'messages'),
      orderBy('timestamp', 'desc'),
      limit(30)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMessages(msgs);
      setLoading(false);
      
      // تصفير عداد الرسايل الغير مقروءة للمستخدم فوراً
      if (msgs.length > 0) {
        updateDoc(doc(db, 'support_chats', userId), { unreadUserCount: 0 }).catch(() => {});
      }
    });

    // فصل الاتصال بالفايربيز بمجرد خروج المستخدم من الشاشة (توفير هائل للباقة)
    return () => unsubscribe();
  }, [userId]);

  // 3. إرسال رسالة جديدة
  const sendMessage = async () => {
    if (!inputText.trim() || !userId) return;

    const messageText = inputText.trim();
    setInputText(''); // تفريغ الخانة فوراً لسرعة الاستجابة

    try {
      const chatDocRef = doc(db, 'support_chats', userId);
      const chatDoc = await getDoc(chatDocRef);

      // إذا كانت دي أول رسالة، ننشئ الملف التعريفي للدردشة
      if (!chatDoc.exists()) {
        await setDoc(chatDocRef, {
          userId,
          userName,
          userType,
          lastMessage: messageText,
          lastMessageTime: serverTimestamp(),
          unreadAdminCount: 1,
          unreadUserCount: 0,
          status: 'open'
        });
      } else {
        // تحديث الملف التعريفي بآخر رسالة لسهولة عرضها في لوحة الأدمن
        await updateDoc(chatDocRef, {
          lastMessage: messageText,
          lastMessageTime: serverTimestamp(),
          unreadAdminCount: (chatDoc.data()?.unreadAdminCount || 0) + 1,
          status: 'open' // إعادة فتح التذكرة لو كانت مغلقة
        });
      }

      // إضافة الرسالة نفسها في المجموعة الفرعية
      await addDoc(collection(db, 'support_chats', userId, 'messages'), {
        text: messageText,
        sender: 'user',
        timestamp: serverTimestamp()
      });

    } catch (error) {
      console.log('Error sending support message', error);
    }
  };

  const renderMessage = ({ item }: { item: any }) => {
    const isUser = item.sender === 'user';
    return (
      <View style={[styles.msgWrapper, isUser ? styles.msgRight : styles.msgLeft]}>
        <View style={[styles.msgBubble, isUser ? styles.userBubble : styles.adminBubble]}>
          <Text style={[styles.msgText, isUser ? styles.userText : styles.adminText]}>{item.text}</Text>
        </View>
      </View>
    );
  };

  return (
<KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'padding'} 
      keyboardVerticalOffset={0}
    >      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>رجوع</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>الدعم الفني المباشر 🎧</Text>
        <View style={{ width: 50 }} />
      </View>

      <View style={styles.chatArea}>
        {loading ? (
          <ActivityIndicator size="large" color="#3b82f6" style={{ marginTop: 50 }} />
        ) : messages.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateIcon}>👋</Text>
            <Text style={styles.emptyStateTitle}>أهلاً بك في الدعم الفني</Text>
            <Text style={styles.emptyStateDesc}>اكتب مشكلتك أو استفسارك وسيقوم أحد ممثلي خدمة العملاء بالرد عليك في أقرب وقت.</Text>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={item => item.id}
            renderItem={renderMessage}
            inverted // لقلب القائمة عشان أحدث رسالة تظهر تحت زي واتساب
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingVertical: 15 }}
          />
        )}
      </View>

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="اكتب رسالتك هنا..."
          placeholderTextColor="#94a3b8"
          value={inputText}
          onChangeText={setInputText}
          multiline
          textAlign="right"
        />
        <TouchableOpacity style={[styles.sendBtn, !inputText.trim() && { opacity: 0.5 }]} onPress={sendMessage} disabled={!inputText.trim()}>
          <Text style={styles.sendBtnIcon}>➤</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  header: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#ffffff', padding: 15, paddingTop: 50, borderBottomWidth: 1, borderColor: '#e2e8f0', elevation: 2 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#1e293b' },
  backBtn: { backgroundColor: '#e2e8f0', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  backBtnText: { color: '#334155', fontWeight: 'bold' },
  chatArea: { flex: 1, paddingHorizontal: 15 },
  
  emptyState: { alignItems: 'center', justifyContent: 'center', flex: 1, padding: 20 },
  emptyStateIcon: { fontSize: 50, marginBottom: 15 },
  emptyStateTitle: { fontSize: 18, fontWeight: 'bold', color: '#1e293b', marginBottom: 8 },
  emptyStateDesc: { fontSize: 14, color: '#64748b', textAlign: 'center', lineHeight: 22 },

  msgWrapper: { width: '100%', marginVertical: 5, flexDirection: 'row' },
  msgRight: { justifyContent: 'flex-start' },
  msgLeft: { justifyContent: 'flex-end' },
  
  msgBubble: { maxWidth: '80%', padding: 12, borderRadius: 16 },
  userBubble: { backgroundColor: '#3b82f6', borderTopRightRadius: 4 },
  adminBubble: { backgroundColor: '#ffffff', borderTopLeftRadius: 4, borderWidth: 1, borderColor: '#e2e8f0' },
  
  msgText: { fontSize: 15, lineHeight: 22 },
  userText: { color: '#ffffff', textAlign: 'right' },
  adminText: { color: '#1e293b', textAlign: 'right' },

  // 👇 هنا ضاعفنا المسافة السفلية (خليناها 70 بدل 25) عشان يترفع 3 سطور لفوق 👇
inputContainer: { flexDirection: 'row-reverse', alignItems: 'flex-end', padding: 10, paddingBottom: Platform.OS === 'ios' ? 20 : 15, backgroundColor: '#ffffff', borderTopWidth: 1, borderColor: '#e2e8f0' },  
  input: { flex: 1, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 20, paddingHorizontal: 15, paddingVertical: 10, paddingTop: 12, maxHeight: 100, minHeight: 45, fontSize: 15, color: '#1e293b' },
  sendBtn: { backgroundColor: '#3b82f6', width: 45, height: 45, borderRadius: 22.5, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  sendBtnIcon: { color: '#ffffff', fontSize: 18, transform: [{ rotateY: '180deg' }] }
});