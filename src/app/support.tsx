import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { addDoc, collection, doc, getDoc, serverTimestamp } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { db } from '../firebaseConfig';

export default function Support() {
  const router = useRouter();
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [userData, setUserData] = useState<any>(null);

  useEffect(() => {
    checkUserType();
  }, []);

  const checkUserType = async () => {
    try {
      const captainId = await AsyncStorage.getItem('currentCaptainId');
      if (captainId) {
        const docSnap = await getDoc(doc(db, 'captains', captainId));
        setUserData({ id: captainId, type: 'captain', name: docSnap.data()?.name });
        return;
      }

      const passengerId = await AsyncStorage.getItem('currentPassengerId');
      if (passengerId) {
        const docSnap = await getDoc(doc(db, 'passengers', passengerId));
        setUserData({ id: passengerId, type: 'passenger', name: docSnap.data()?.name });
      }
    } catch (e) {
      console.log(e);
    }
  };

  const submitComplaint = async () => {
    if (!message.trim()) {
      Alert.alert('تنبيه', 'برجاء كتابة رسالتك أولاً.');
      return;
    }

    setLoading(true);
    try {
      await addDoc(collection(db, 'complaints'), {
        senderId: userData?.id || 'unknown',
        senderType: userData?.type || 'unknown',
        senderName: userData?.name || 'مستخدم غير معروف',
        text: message.trim(),
        status: 'pending',
        timestamp: serverTimestamp()
      });
      
      Alert.alert('تم 📩', 'تم إرسال رسالتك للإدارة بنجاح وسيتم الرد عليك قريباً.', [
        { text: 'حسناً', onPress: () => router.back() }
      ]);
    } catch (error) {
      Alert.alert('خطأ', 'فشل الإرسال، تأكد من اتصالك بالإنترنت.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}><Text style={styles.backBtnText}>رجوع ⬅️</Text></TouchableOpacity>
        <Text style={styles.headerTitle}>الدعم الفني 🎧</Text>
      </View>

      <View style={styles.content}>
        <Text style={styles.title}>كيف يمكننا مساعدتك؟</Text>
        <Text style={styles.subtitle}>اكتب شكواك أو استفسارك هنا، وسيقوم فريق الدعم بمراجعته والرد عليك فوراً.</Text>

        <TextInput
          style={styles.input}
          placeholder="اكتب رسالتك هنا بالتفصيل..."
          placeholderTextColor="#94a3b8"
          multiline
          value={message}
          onChangeText={setMessage}
          textAlign="right"
        />

        <TouchableOpacity style={styles.submitBtn} onPress={submitComplaint} disabled={loading}>
          {loading ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.submitBtnText}>إرسال للإدارة 🚀</Text>}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9', padding: 15, paddingTop: 45 },
  header: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#1e293b' },
  backBtn: { backgroundColor: '#e2e8f0', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8 },
  backBtnText: { color: '#334155', fontWeight: 'bold' },
  content: { flex: 1 },
  title: { fontSize: 22, fontWeight: 'bold', color: '#d97706', marginBottom: 10, textAlign: 'right' },
  subtitle: { fontSize: 14, color: '#64748b', marginBottom: 20, textAlign: 'right', lineHeight: 22 },
  input: { backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 14, padding: 15, fontSize: 16, color: '#1e293b', minHeight: 150, textAlignVertical: 'top', marginBottom: 20 },
  submitBtn: { backgroundColor: '#2563eb', paddingVertical: 15, borderRadius: 14, alignItems: 'center', elevation: 3 },
  submitBtnText: { color: '#ffffff', fontSize: 16, fontWeight: 'bold' }
});