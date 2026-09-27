import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, limit, onSnapshot, orderBy, query, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, FlatList, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { db } from '../firebase';

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

export default function LiveSupportChat() {
  const router = useRouter();
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [isAdminTyping, setIsAdminTyping] = useState(false);
  
  const [userId, setUserId] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>('مستخدم');
  const [userType, setUserType] = useState<'captain' | 'passenger'>('passenger');
  
  const flatListRef = useRef<FlatList>(null);
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 1. تحديد هوية المستخدم
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

  // 2. الاستماع للرسايل
  useEffect(() => {
    if (!userId) return;

    const q = query(
      collection(db, 'support_chats', userId, 'messages'),
      orderBy('timestamp', 'desc'),
      limit(30)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMessages(msgs);
      setLoading(false);
      
      if (msgs.length > 0) {
        updateDoc(doc(db, 'support_chats', userId), { unreadUserCount: 0 }).catch(() => {});
      }
    });

    return () => unsubscribe();
  }, [userId]);

  // 3. مراقبة حالة المحادثة من الإدارة (الإغلاق ومراقبة كتابة الإدارة)
  useEffect(() => {
    if (!userId) return;

    const chatDocRef = doc(db, 'support_chats', userId);
    const unsubscribeStatus = onSnapshot(chatDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        
        // إظهار النقط لو الإدارة بتكتب
        if (data.adminTyping) setIsAdminTyping(true);
        else setIsAdminTyping(false);

        // الإغلاق الآلي
        if (data.status === 'closed') {
          Alert.alert('تنبيه ⚠️', 'سيتم إغلاق هذه المحادثة بعد 3 ثوان ...');
          setTimeout(async () => {
            try {
              const msgsQuery = query(collection(db, 'support_chats', userId, 'messages'));
              const msgsSnap = await getDocs(msgsQuery);
              msgsSnap.forEach(async (msgDoc) => {
                await deleteDoc(msgDoc.ref);
              });
              await deleteDoc(chatDocRef);
            } catch (error) {}
            router.back();
          }, 3000);
        }
      }
    });

    return () => unsubscribeStatus();
  }, [userId]);

  // تحديث حالة الكتابة الخاصة بالمستخدم في الفايربيز
  const handleTextChange = async (text: string) => {
    setInputText(text);

    if (!userId || messages.length === 0) return; 

    try {
      await updateDoc(doc(db, 'support_chats', userId), { userTyping: true });

      if (typingTimeout.current) clearTimeout(typingTimeout.current);
      
      typingTimeout.current = setTimeout(async () => {
        await updateDoc(doc(db, 'support_chats', userId), { userTyping: false });
      }, 2000);
    } catch (error) {}
  };

  // 4. إرسال رسالة جديدة
  const sendMessage = async () => {
    if (!inputText.trim() || !userId) return;

    const messageText = inputText.trim();
    setInputText('');

    try {
      const chatDocRef = doc(db, 'support_chats', userId);
      const chatDoc = await getDoc(chatDocRef);

      if (!chatDoc.exists()) {
        await setDoc(chatDocRef, {
          userId,
          userName,
          userType,
          lastMessage: messageText,
          lastMessageTime: serverTimestamp(),
          unreadAdminCount: 1,
          unreadUserCount: 0,
          status: 'open',
          userTyping: false
        });
      } else {
        await updateDoc(chatDocRef, {
          lastMessage: messageText,
          lastMessageTime: serverTimestamp(),
          unreadAdminCount: (chatDoc.data()?.unreadAdminCount || 0) + 1,
          status: 'open',
          userTyping: false // إيقاف علامة الكتابة فور الإرسال
        });
      }

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
    >
      <View style={styles.header}>
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
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
            <Text style={{ textAlign: 'center', color: '#64748b', fontSize: 16, lineHeight: 24, fontWeight: 'bold' }}>
              برجاء ارسال مشكلتك وسيقوم أحد ممثلي خدمة العملاء بالتواصل مع حضرتك في أقرب وقت
            </Text>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={item => item.id}
            renderItem={renderMessage}
            inverted
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingVertical: 15 }}
            ListHeaderComponent={isAdminTyping ? <TypingIndicator /> : null} // هنا بتظهر النقط
          />
        )}
      </View>

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="اكتب رسالتك هنا..."
          placeholderTextColor="#94a3b8"
          value={inputText}
          onChangeText={handleTextChange} 
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
  
  msgWrapper: { width: '100%', marginVertical: 5, flexDirection: 'row' },
  msgRight: { justifyContent: 'flex-start' },
  msgLeft: { justifyContent: 'flex-end' },
  
  msgBubble: { maxWidth: '80%', padding: 12, borderRadius: 16 },
  userBubble: { backgroundColor: '#3b82f6', borderTopRightRadius: 4 },
  adminBubble: { backgroundColor: '#ffffff', borderTopLeftRadius: 4, borderWidth: 1, borderColor: '#e2e8f0' },
  
  msgText: { fontSize: 15, lineHeight: 22 },
  userText: { color: '#ffffff', textAlign: 'right' },
  adminText: { color: '#1e293b', textAlign: 'right' },

  inputContainer: { flexDirection: 'row-reverse', alignItems: 'flex-end', padding: 10, paddingBottom: Platform.OS === 'ios' ? 25 : 35, backgroundColor: '#ffffff', borderTopWidth: 1, borderColor: '#e2e8f0' },  
  input: { flex: 1, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 20, paddingHorizontal: 15, paddingVertical: 10, paddingTop: 12, maxHeight: 100, minHeight: 45, fontSize: 15, color: '#1e293b' },
  sendBtn: { backgroundColor: '#3b82f6', width: 45, height: 45, borderRadius: 22.5, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  sendBtnIcon: { color: '#ffffff', fontSize: 18, transform: [{ rotateY: '180deg' }] }
});