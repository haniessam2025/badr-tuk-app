import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

export default function ChatScreen() {
  const router = useRouter();
  const { senderType } = useLocalSearchParams(); // لتمييز ما إذا كان المرسل "passenger" أو "captain"
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState('');

  useEffect(() => {
    loadMessages();
    const interval = setInterval(loadMessages, 1000); // تحديث لحظي للرسائل كل ثانية
    return () => clearInterval(interval);
  }, []);

  const loadMessages = async () => {
    try {
      const storedChat = await AsyncStorage.getItem('ride_chat');
      if (storedChat) {
        setMessages(JSON.parse(storedChat));
      }
    } catch (e) {
      console.log(e);
    }
  };

  const sendMessage = async () => {
    if (!inputText.trim()) return;

    const newMessage = {
      id: Date.now().toString(),
      sender: senderType === 'captain' ? 'captain' : 'passenger',
      text: inputText,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    try {
      const storedChat = await AsyncStorage.getItem('ride_chat');
      const currentMessages = storedChat ? JSON.parse(storedChat) : [];
      const updatedMessages = [...currentMessages, newMessage];
      
      await AsyncStorage.setItem('ride_chat', JSON.stringify(updatedMessages));
      setMessages(updatedMessages);
      setInputText('');
    } catch (e) {
      console.log(e);
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
      style={styles.container}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>⬅ رجوع</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>💬 محادثة الرحلة الفورية</Text>
      </View>

      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.chatList}
        renderItem={({ item }) => {
          const isMe = item.sender === (senderType === 'captain' ? 'captain' : 'passenger');
          return (
            <View style={[styles.messageBubble, isMe ? styles.myMessage : styles.otherMessage]}>
              <Text style={[styles.messageText, isMe ? styles.myMessageText : styles.otherMessageText]}>
                {item.text}
              </Text>
              <Text style={[styles.timeText, isMe ? styles.myTimeText : styles.otherTimeText]}>
                {item.time}
              </Text>
            </View>
          );
        }}
      />

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="اكتب رسالتك هنا..."
          placeholderTextColor="#94a3b8"
          value={inputText}
          onChangeText={setInputText}
        />
        <TouchableOpacity style={styles.sendButton} onPress={sendMessage}>
          <Text style={styles.sendButtonText}>إرسال ✈️</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  header: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffffff', padding: 15, paddingTop: 45, borderBottomWidth: 1, borderBottomColor: '#e2e8f0', elevation: 2 },
  backBtn: { paddingVertical: 5, paddingHorizontal: 10, backgroundColor: '#f1f5f9', borderRadius: 8 },
  backBtnText: { fontWeight: 'bold', color: '#334155' },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#1e293b', flex: 1, textAlign: 'center', marginRight: 40 },
  chatList: { padding: 15, paddingBottom: 20 },
  messageBubble: { maxWidth: '75%', padding: 12, borderRadius: 16, marginBottom: 12, elevation: 1 },
  myMessage: { backgroundColor: '#2563eb', alignSelf: 'flex-end', borderBottomRightRadius: 2 },
  otherMessage: { backgroundColor: '#ffffff', alignSelf: 'flex-start', borderBottomLeftRadius: 2, borderWidth: 1, borderColor: '#e2e8f0' },
  messageText: { fontSize: 15, textAlign: 'right' },
  myMessageText: { color: '#ffffff' },
  otherMessageText: { color: '#1e293b' },
  timeText: { fontSize: 10, marginTop: 4, textAlign: 'left' },
  myTimeText: { color: '#93c5fd' },
  otherTimeText: { color: '#94a3b8' },
  inputContainer: { flexDirection: 'row', padding: 12, backgroundColor: '#ffffff', borderTopWidth: 1, borderTopColor: '#e2e8f0', alignItems: 'center' },
  input: { flex: 1, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 12, paddingHorizontal: 15, paddingVertical: 10, fontSize: 14, textAlign: 'right', color: '#0f172a', marginLeft: 10 },
  sendButton: { backgroundColor: '#10b981', paddingVertical: 11, paddingHorizontal: 16, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  sendButtonText: { color: '#ffffff', fontWeight: 'bold', fontSize: 14 },
});