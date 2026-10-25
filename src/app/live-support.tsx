import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, onSnapshot, orderBy, query, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, FlatList, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { db } from '../firebase';
import { useApp } from './AppContext';

// مكون الـ 3 نقط المتحركة (أنيميشن احترافي)
const TypingIndicator = () => {
  const opacity1 = useRef(new Animated.Value(0.3)).current;
  const opacity2 = useRef(new Animated.Value(0.3)).current;
  const opacity3 = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animate = () => {
      Animated.sequence([
        Animated.timing(opacity1, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(opacity2, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(opacity3, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.parallel([
          Animated.timing(opacity1, { toValue: 0.3, duration: 300, useNativeDriver: true }),
          Animated.timing(opacity2, { toValue: 0.3, duration: 300, useNativeDriver: true }),
          Animated.timing(opacity3, { toValue: 0.3, duration: 300, useNativeDriver: true }),
        ])
      ]).start(() => animate());
    };
    animate();
  }, []);

  return (
    <View style={[styles.msgWrapper, styles.msgLeft]}>
      <View style={[styles.msgBubble, styles.adminBubble, { flexDirection: 'row', width: 65, justifyContent: 'space-evenly', paddingVertical: 12, paddingHorizontal: 15 }]}>
        <Animated.Text style={{ opacity: opacity1, fontSize: 18, color: '#94a3b8', marginTop: -5 }}>●</Animated.Text>
        <Animated.Text style={{ opacity: opacity2, fontSize: 18, color: '#94a3b8', marginTop: -5 }}>●</Animated.Text>
        <Animated.Text style={{ opacity: opacity3, fontSize: 18, color: '#94a3b8', marginTop: -5 }}>●</Animated.Text>
      </View>
    </View>
  );
};

export default function SupportLiveChat() {
  const router = useRouter();
  const { isDarkMode } = useApp();
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [chatId, setChatId] = useState<string | null>(null);
  const [userData, setUserData] = useState<any>(null);
  const [chatStatus, setChatStatus] = useState('active'); 
  const [isAdminTyping, setIsAdminTyping] = useState(false);
  
  const flatListRef = useRef<FlatList>(null);
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { initChat(); }, []);

  const initChat = async () => {
    let currentId = await AsyncStorage.getItem('currentPassengerId');
    let type = 'passenger';
    let name = 'مستخدم غير مسجل';
    let phone = 'غير مسجل';

    if (currentId) {
      const docSnap = await getDoc(doc(db, 'passengers', currentId));
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.name) name = data.name;
        if (data.phone) phone = data.phone;
      }
    } else {
      currentId = await AsyncStorage.getItem('currentCaptainId');
      type = 'captain';
      if (currentId) {
        const docSnap = await getDoc(doc(db, 'captains', currentId));
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.name) name = data.name;
          if (data.phone) phone = data.phone;
        }
      }
    }
    
    if (currentId) {
      setUserData({ id: currentId, type, name, phone }); // 👈 إضافة رقم الهاتف عشان الداشبورد تعرفه
      
      const q = query(collection(db, 'support_chats'), where('userId', '==', currentId), where('status', '==', 'active'));
      const snap = await getDocs(q);
      
      if (!snap.empty) {
        const existingChatId = snap.docs[0].id;
        setChatId(existingChatId);
        listenToMessages(existingChatId);
      } else {
        setLoading(false);
      }
    }
  };

  const listenToMessages = (cId: string) => {
    updateDoc(doc(db, 'support_chats', cId), { unreadUser: false }).catch(e=>e);

    const q = query(collection(db, 'support_chats', cId, 'messages'), orderBy('timestamp', 'asc'));
    onSnapshot(q, (snap) => {
      setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 200);
    });

    onSnapshot(doc(db, 'support_chats', cId), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setChatStatus(data.status || 'active');
        
        if (data.adminTyping) setIsAdminTyping(true);
        else setIsAdminTyping(false);

        if (data.status === 'closed') {
          setTimeout(async () => {
            try {
              const msgsQuery = query(collection(db, 'support_chats', cId, 'messages'));
              const msgsSnap = await getDocs(msgsQuery);
              msgsSnap.forEach(async (msgDoc) => {
                await deleteDoc(msgDoc.ref);
              });
              await deleteDoc(doc(db, 'support_chats', cId));
            } catch (error) {}
          }, 3000);
        }
      }
    });
  };

  const handleTextChange = async (text: string) => {
    setInputText(text);

    if (!chatId) return; 

    try {
      await updateDoc(doc(db, 'support_chats', chatId), { userTyping: true });

      if (typingTimeout.current) clearTimeout(typingTimeout.current);
      
      typingTimeout.current = setTimeout(async () => {
        await updateDoc(doc(db, 'support_chats', chatId), { userTyping: false });
      }, 2000);
    } catch (error) {}
  };

  const sendMessage = async () => {
    if (!inputText.trim() || !userData) return;

    const messageText = inputText.trim();
    setInputText('');

    let currentChatId = chatId;

    if (!currentChatId) {
      // 👈 السر هنا: لازم نكتب الأسماء زي ما الداشبورد بتقرأها بالظبط عشان متتلخبطش وتودي الشات في حتة تانية
      const chatRef = doc(db, 'support_chats', userData.id); // نستخدم الـ ID بتاع اليوزر عشان الداشبورد تعرفه بسهولة
      await updateDoc(chatRef, {
        userId: userData.id,
        userType: userData.type,
        userName: userData.name, 
        userPhone: userData.phone, 
        senderName: userData.name, // 👈 احتياطي
        senderPhone: userData.phone, // 👈 احتياطي
        status: 'active',
        lastMessage: messageText,
        lastUpdatedAt: serverTimestamp(), // 👈 تغييرها عشان الداشبورد بتدور عليها
        unreadAdmin: true,
        unreadUser: false,
        userTyping: false,
        timestamp: serverTimestamp(),
        isClosed: false 
      }).catch(async (e) => {
         // لو الدوكيومنت مش موجود، ننشئه
         await setDoc(chatRef, {
          userId: userData.id,
          userType: userData.type,
          userName: userData.name, 
          userPhone: userData.phone, 
          senderName: userData.name,
          senderPhone: userData.phone,
          status: 'active',
          lastMessage: messageText,
          lastUpdatedAt: serverTimestamp(), 
          unreadAdmin: true,
          unreadUser: false,
          userTyping: false,
          timestamp: serverTimestamp(),
          isClosed: false 
         });
      });

      currentChatId = chatRef.id;
      setChatId(currentChatId);
      listenToMessages(currentChatId);
    } else {
      await updateDoc(doc(db, 'support_chats', currentChatId), {
        lastMessage: messageText,
        lastUpdatedAt: serverTimestamp(), // 👈 تحديث الوقت للترتيب
        unreadAdmin: true,
        status: 'active',
        userTyping: false
      });
    }

    await addDoc(collection(db, 'support_chats', currentChatId, 'messages'), {
      text: messageText,
      sender: 'user',
      timestamp: serverTimestamp()
    });
  };

  const renderMessage = ({ item }: { item: any }) => {
    const isUser = item.sender === 'user';
    return (
      <View style={[styles.msgWrapper, isUser ? styles.msgRight : styles.msgLeft]}>
        <View style={[styles.msgBubble, isUser ? styles.userBubble : styles.adminBubble, isDarkMode && !isUser && { backgroundColor: '#1e293b' }]}>
          <Text style={[styles.msgText, isUser ? styles.userText : (isDarkMode ? { color: '#e2e8f0' } : styles.adminText)]}>{item.text}</Text>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView style={[styles.container, isDarkMode && { backgroundColor: '#0f172a' }]} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : -35}>
      <View style={[styles.header, isDarkMode && { borderBottomColor: '#334155' }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-forward" size={24} color="#334155" />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, isDarkMode && { color: '#ffffff' }]}>المحادثة المباشرة 💬</Text>
      </View>

      <View style={styles.chatArea}>
        {loading ? (
          <ActivityIndicator size="large" color="#3b82f6" style={{ marginTop: 50 }} />
        ) : messages.length === 0 ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
            <Text style={{ textAlign: 'center', color: '#64748b', fontSize: 16, lineHeight: 24, fontWeight: 'bold' }}>
              برجاء إرسال مشكلتك وسيقوم أحد ممثلي خدمة العملاء بالتواصل مع حضرتك في أقرب وقت.
            </Text>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={item => item.id}
            renderItem={renderMessage}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingVertical: 15 }}
            ListFooterComponent={isAdminTyping ? <TypingIndicator /> : null} 
          />
        )}
      </View>

      {chatStatus === 'closed' ? (
        <View style={[styles.inputContainer, isDarkMode && { borderTopColor: '#334155', backgroundColor: '#0f172a' }, { justifyContent: 'center' }]}>
          <Text style={{ color: '#ef4444', fontWeight: 'bold', textAlign: 'center', fontSize: 14 }}>
            عذراً - لقد تم إنهاء هذه المحادثة .. نشكرك على التواصل معنا
          </Text>
        </View>
      ) : (
        <View style={[styles.inputContainer, isDarkMode && { borderTopColor: '#334155', backgroundColor: '#0f172a' }]}>
          <TextInput
            style={[styles.input, isDarkMode && { backgroundColor: '#1e293b', color: '#fff', borderColor: '#334155' }]}
            placeholder="اكتب رسالتك..."
            placeholderTextColor="#94a3b8"
            value={inputText}
            onChangeText={handleTextChange}
            textAlign="right"
          />
          <TouchableOpacity style={styles.sendBtn} onPress={sendMessage}>
            <Ionicons name="send" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc', paddingTop: 40 },
  header: { flexDirection: 'row-reverse', alignItems: 'center', padding: 15, borderBottomWidth: 1, borderColor: '#e2e8f0', backgroundColor: 'transparent' },
  backBtn: { padding: 8, backgroundColor: '#e2e8f0', borderRadius: 8 },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: 'bold', color: '#1e293b', marginRight: 40 },
  chatArea: { flex: 1, paddingHorizontal: 15 },
  
  msgWrapper: { width: '100%', marginVertical: 5, flexDirection: 'row' },
  msgRight: { justifyContent: 'flex-start' },
  msgLeft: { justifyContent: 'flex-end' },
  
  msgBubble: { maxWidth: '80%', padding: 12, borderRadius: 16 },
  userBubble: { backgroundColor: '#3b82f6', borderTopRightRadius: 4 },
  adminBubble: { backgroundColor: '#ffffff', borderTopLeftRadius: 4, borderWidth: 1, borderColor: '#e2e8f0' },
  
  msgText: { fontSize: 15, lineHeight: 22 },
  userText: { color: '#ffffff', textAlign: 'right' },
  adminText: { color: '#1e293b', textAlign: 'right' },

  inputContainer: { flexDirection: 'row-reverse', paddingHorizontal: 10, paddingTop: 10, paddingBottom: 60, borderTopWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#fff', alignItems: 'center' },
  input: { flex: 1, backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 20, paddingHorizontal: 15, paddingVertical: 10, fontSize: 15 },
  sendBtn: { backgroundColor: '#10b981', width: 45, height: 45, borderRadius: 22.5, justifyContent: 'center', alignItems: 'center', marginRight: 10 }
});