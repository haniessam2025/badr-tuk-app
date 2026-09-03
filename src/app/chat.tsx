import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { addDoc, collection, doc, getDoc, getDocs, increment, onSnapshot, orderBy, query, updateDoc, where } from 'firebase/firestore';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Keyboard, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { db } from '../firebaseConfig';

export default function ChatScreen() {
  const router = useRouter();
  const { senderType } = useLocalSearchParams(); 
  
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState('');
  const [rideId, setRideId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  
  // حالة لمراقبة الكيبورد (مفتوحة ولا مقفولة)
  const [isKeyboardVisible, setKeyboardVisible] = useState(false);
  
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    loadActiveRide();

    // تشغيل مراقب الكيبورد لضبط حركة المستطيل
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const keyboardDidShowListener = Keyboard.addListener(showEvent, () => {
      setKeyboardVisible(true);
      // النزول لآخر رسالة تلقائياً أول ما الكيبورد تفتح
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    });
    const keyboardDidHideListener = Keyboard.addListener(hideEvent, () => {
      setKeyboardVisible(false);
    });

    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, []);

  const loadActiveRide = async () => {
    try {
      const savedRide = await AsyncStorage.getItem('active_ride');
      if (savedRide) {
        const rideData = JSON.parse(savedRide);
        if (rideData && rideData.id) {
          setRideId(rideData.id);
          markMessagesAsRead(rideData.id);
          listenToMessages(rideData.id);
          return;
        }
      }

      let userId = '';
      let field = '';
      if (senderType === 'passenger') {
        userId = await AsyncStorage.getItem('currentPassengerId') || '';
        field = 'passengerId';
      } else {
        userId = await AsyncStorage.getItem('currentCaptainId') || '';
        field = 'captainId';
      }

      if (userId) {
        const q = query(collection(db, 'rides'), where(field, '==', userId));
        const snap = await getDocs(q);
        const activeDoc = snap.docs.find(d => ['accepted', 'captain_arrived', 'passenger_on_the_way', 'in_progress'].includes(d.data().status));
        
        if (activeDoc) {
          setRideId(activeDoc.id);
          markMessagesAsRead(activeDoc.id);
          listenToMessages(activeDoc.id);
          return;
        }
      }

      setLoading(false);
      Alert.alert('تنبيه', 'لم نتمكن من العثور على رحلة نشطة لبدء الشات.');
    } catch (e) {
      console.log(e);
      setLoading(false);
    }
  };

  const markMessagesAsRead = async (id: string) => {
    try {
      const rideRef = doc(db, 'rides', id);
      if (senderType === 'passenger') {
        await updateDoc(rideRef, { unreadCountPassenger: 0 });
      } else {
        await updateDoc(rideRef, { unreadCountCaptain: 0 });
      }
    } catch (error) {
      console.log('Error resetting unread count:', error);
    }
  };

  const listenToMessages = (id: string) => {
    const messagesRef = collection(db, 'rides', id, 'messages');
    const q = query(messagesRef, orderBy('timestamp', 'asc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMessages(msgs);
      setLoading(false);
      
      setTimeout(() => {
        if (msgs.length > 0) {
          flatListRef.current?.scrollToEnd({ animated: true });
        }
      }, 200);
    });

    return unsubscribe;
  };

  const sendMessage = async () => {
    if (!inputText.trim()) return;
    
    if (!rideId) {
      Alert.alert('خطأ', 'جاري تحميل بيانات الرحلة، جرب ثانية...');
      return;
    }

    const messageText = inputText.trim();
    setInputText(''); 

    try {
      const messagesRef = collection(db, 'rides', rideId, 'messages');
      await addDoc(messagesRef, {
        text: messageText,
        sender: senderType,
        timestamp: new Date().getTime(),
      });

      const rideRef = doc(db, 'rides', rideId);
      const rideSnap = await getDoc(rideRef);
      
      if (rideSnap.exists()) {
        const rideData = rideSnap.data();
        let targetToken = '';
        let newUnreadCount = 1;
        let senderNameStr = senderType === 'passenger' ? 'الراكب' : 'الكابتن';

        if (senderType === 'passenger') {
          newUnreadCount = (rideData.unreadCountCaptain || 0) + 1;
          await updateDoc(rideRef, { unreadCountCaptain: increment(1) });
          targetToken = rideData.captainPushToken; 
        } else {
          newUnreadCount = (rideData.unreadCountPassenger || 0) + 1;
          await updateDoc(rideRef, { unreadCountPassenger: increment(1) });
          targetToken = rideData.passengerPushToken; 
        }

        if (targetToken) {
          sendPushNotification(targetToken, senderNameStr, messageText, newUnreadCount);
        }
      }
      
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);

    } catch (error) {
      Alert.alert('خطأ', 'حدثت مشكلة أثناء إرسال الرسالة.');
    }
  };

  const sendPushNotification = async (expoPushToken: string, title: string, body: string, badgeCount: number) => {
    const message = {
      to: expoPushToken,
      sound: 'default',
      title: `رسالة جديدة من ${title} 💬`,
      body: body,
      badge: badgeCount, 
      data: { route: 'chat' },
    };

    try {
      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
      });
    } catch (error) {
      console.log('Notification Error:', error);
    }
  };

  const makeFreeCall = async () => {
    try {
      const myId = senderType === 'passenger' 
        ? await AsyncStorage.getItem('currentPassengerId') 
        : await AsyncStorage.getItem('currentCaptainId');
        
      const myProfileStr = senderType === 'passenger' 
        ? await AsyncStorage.getItem('passenger_profile') 
        : await AsyncStorage.getItem('captain_profile');
        
      const myName = myProfileStr ? JSON.parse(myProfileStr).name : (senderType === 'passenger' ? 'راكب' : 'كابتن');

      if (!rideId) {
        Alert.alert('خطأ', 'رقم الرحلة غير متوفر للمكالمة.');
        return;
      }

      router.push({
        pathname: '/voice-call',
        params: {
          rideId: rideId,
          userName: myName,
          userId: myId || 'user_123'
        }
      });
    } catch (e) {
      console.log(e);
    }
  };

  const renderMessage = ({ item }: { item: any }) => {
    const isMe = item.sender === senderType;
    return (
      <View style={[styles.messageBubble, isMe ? styles.myMessage : styles.otherMessage]}>
        <Text style={[styles.messageText, isMe ? styles.myMessageText : styles.otherMessageText]}>
          {item.text}
        </Text>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return (
    // استخدام الشاشة بالكامل داخل الكيبورد عشان نزق كل حاجة فوق بشكل إجباري وسليم
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'padding'} 
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>رجوع ⬅️</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {senderType === 'passenger' ? 'مراسلة الكابتن 🛺' : 'مراسلة الراكب 👤'}
        </Text>
        <TouchableOpacity style={styles.callHeaderBtn} onPress={makeFreeCall}>
          <Text style={styles.callHeaderBtnText}>📞 اتصال مجاني</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        contentContainerStyle={styles.chatList}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => {
          if (messages.length > 0) {
            flatListRef.current?.scrollToEnd({ animated: true });
          }
        }}
      />

      {/* المستطيل اللي بيرتفع وينزل مع الكيبورد */}
      <View style={[
        styles.inputContainer, 
        // لو الكيبورد مفتوحة، المستطيل هينزل يرسى عليها بمسافة 10 بس عشان تشوف الكلام
        // لو مقفولة، هيترفع 45 بيكسل (حوالي 3 سطور)
        { marginBottom: isKeyboardVisible ? (Platform.OS === 'ios' ? 10 : 5) : 45 }
      ]}>
        <TextInput
          style={styles.input}
          placeholder="اكتب رسالتك هنا..."
          placeholderTextColor="#94a3b8"
          value={inputText}
          onChangeText={setInputText}
          multiline
        />
        <TouchableOpacity style={styles.sendButton} onPress={sendMessage}>
          <Text style={styles.sendButtonText}>إرسال 🚀</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f1f5f9' },
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#ffffff', padding: 15, paddingTop: Platform.OS === 'android' ? 45 : 45, elevation: 3 },
  backButton: { padding: 8, backgroundColor: '#f8fafc', borderRadius: 8 },
  backButtonText: { color: '#0f172a', fontWeight: 'bold', fontSize: 13 },
  headerTitle: { fontSize: 16, fontWeight: 'bold', color: '#1e293b' },
  callHeaderBtn: { backgroundColor: '#2563eb', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8 },
  callHeaderBtnText: { color: '#ffffff', fontWeight: 'bold', fontSize: 13 },
  
  chatList: { 
    padding: 15, 
    paddingBottom: 20,
    flexGrow: 1, 
    justifyContent: 'flex-end' 
  }, 
  
  messageBubble: { maxWidth: '80%', padding: 12, borderRadius: 16, marginBottom: 10 },
  myMessage: { alignSelf: 'flex-start', backgroundColor: '#2563eb', borderBottomLeftRadius: 4 },
  otherMessage: { alignSelf: 'flex-end', backgroundColor: '#e2e8f0', borderBottomRightRadius: 4 },
  
  messageText: { fontSize: 16, lineHeight: 22 },
  myMessageText: { color: '#ffffff', textAlign: 'left' },
  otherMessageText: { color: '#0f172a', textAlign: 'right' },
  
  inputContainer: { 
    flexDirection: 'row-reverse', 
    alignItems: 'flex-end', 
    padding: 10, 
    backgroundColor: '#ffffff', 
    borderWidth: 1, 
    borderColor: '#e2e8f0',
    borderRadius: 25, // شكل الكبسولة الأنيق
    marginHorizontal: 15,
    elevation: 3, // ظل خفيف بيدي شكل طافي شيك جداً
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  input: { 
    flex: 1, 
    backgroundColor: '#f8fafc', 
    borderWidth: 1, 
    borderColor: '#cbd5e1', 
    borderRadius: 20, 
    paddingHorizontal: 15, 
    paddingTop: 10, 
    paddingBottom: 10, 
    fontSize: 16, 
    textAlign: 'right', 
    maxHeight: 120, 
    minHeight: 45,
    marginLeft: 10 
  },
  sendButton: { 
    backgroundColor: '#10b981', 
    height: 45, 
    paddingHorizontal: 20, 
    borderRadius: 20, 
    justifyContent: 'center',
    alignItems: 'center'
  },
  sendButtonText: { color: '#ffffff', fontWeight: 'bold', fontSize: 16 },
});