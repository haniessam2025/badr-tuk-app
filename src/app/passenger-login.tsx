import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { addDoc, collection, doc, getDocs, query, updateDoc, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { db } from '../firebase';

export default function PassengerLogin() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  
  // متغير التحكم في إظهار وإخفاء الباسوورد
  const [showPassword, setShowPassword] = useState(false);

  const [forgotModalVisible, setForgotModalVisible] = useState(false);
  const [forgotPhone, setForgotPhone] = useState('');
  const [forgotName, setForgotName] = useState('');
  const [isSendingForgot, setIsSendingForgot] = useState(false);

  useEffect(() => {
    const checkExistingLogin = async () => {
      try {
        const passengerId = await AsyncStorage.getItem('currentPassengerId');
        if (passengerId) {
          router.replace('/passenger-home');
        } else {
          setCheckingAuth(false);
        }
      } catch (e) {
        setCheckingAuth(false);
      }
    };
    checkExistingLogin();
  }, []);

  const handleLogin = async () => {
    const trimmedInput = username.trim();
    const trimmedPassword = password.trim();

    if (!trimmedInput || !trimmedPassword) {
      Alert.alert('تنبيه', 'برجاء إدخال اسم المستخدم أو رقم الهاتف وكلمة المرور');
      return;
    }

    setLoading(true);
    try {
      let q = query(collection(db, 'passengers'), where('name', '==', trimmedInput), where('password', '==', trimmedPassword));
      let querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        const qPhone = query(collection(db, 'passengers'), where('phone', '==', trimmedInput), where('password', '==', trimmedPassword));
        querySnapshot = await getDocs(qPhone);
      }

      if (!querySnapshot.empty) {
        const passengerDoc = querySnapshot.docs[0];
        const data = passengerDoc.data();

        if (data.status === 'banned') {
          setLoading(false);
          Alert.alert('عفواً', 'تم حظر حسابك من قبل الإدارة.');
          return;
        }

        const profileData = {
          id: passengerDoc.id,
          name: data.name || trimmedInput,
          phone: data.phone || '',
          avatar: data.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'
        };

        const newSessionId = Math.random().toString(36).substring(2) + Date.now().toString(36);
        
        await AsyncStorage.setItem('currentPassengerId', passengerDoc.id);
        await AsyncStorage.setItem('passenger_profile', JSON.stringify(profileData));
        await AsyncStorage.setItem('currentSessionId', newSessionId); 
        
        await updateDoc(doc(db, 'passengers', passengerDoc.id), { sessionId: newSessionId });

        router.replace('/passenger-home');
      } else {
        Alert.alert('خطأ', 'اسم المستخدم (أو الهاتف) أو كلمة المرور غير صحيحة');
      }
    } catch (error) {
      Alert.alert('خطأ', 'حدثت مشكلة أثناء تسجيل الدخول، تأكد من اتصالك بالإنترنت');
    } finally {
      setLoading(false);
    }
  };

  const submitForgotPassword = async () => {
    if (!forgotPhone.trim() || !forgotName.trim()) {
      Alert.alert('تنبيه', 'برجاء إدخال الاسم ورقم الهاتف المسجل.');
      return;
    }

    setIsSendingForgot(true);
    try {
      const q = query(collection(db, 'passengers'), where('phone', '==', forgotPhone.trim()));
      const snap = await getDocs(q);

      if (snap.empty) {
        Alert.alert('خطأ', 'رقم الهاتف غير مسجل لدينا في حسابات الركاب.');
        setIsSendingForgot(false);
        return;
      }

      await addDoc(collection(db, 'support_tickets'), {
        type: 'password_reset',
        userType: 'passenger',
        passengerId: snap.docs[0].id,
        senderName: forgotName.trim(),
        senderPhone: forgotPhone.trim(),
        message: `طلب استعادة كلمة المرور للراكب (رقم الهاتف: ${forgotPhone.trim()})`,
        status: 'pending',
        isReadAdmin: false,
        timestamp: new Date().getTime()
      });

      Alert.alert('تم إرسال الطلب ✅', 'تم إرسال طلبك للإدارة بنجاح. سيتم مراجعته وإرسال كلمة المرور المؤقتة عبر الواتساب قريباً.');
      setForgotModalVisible(false);
      setForgotPhone('');
      setForgotName('');
    } catch (error) {
      Alert.alert('خطأ', 'حدثت مشكلة أثناء إرسال الطلب.');
    } finally {
      setIsSendingForgot(false);
    }
  };

  if (checkingAuth) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#d97706" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>تسجيل دخول الراكب</Text>
        <Text style={styles.subtitle}>أدخل بيانات حسابك للمتابعة</Text>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>اسم المستخدم أو رقم الهاتف</Text>
          <TextInput
            style={styles.input}
            placeholder="اكتب اسم المستخدم أو الهاتف"
            placeholderTextColor="#94a3b8"
            value={username}
            onChangeText={setUsername}
            textAlign="right"
            autoCapitalize="none"
          />
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>كلمة المرور</Text>
          <View style={styles.passwordWrapper}>
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
              <Ionicons name={showPassword ? 'eye-outline' : 'eye-off-outline'} size={24} color="#94a3b8" />
            </TouchableOpacity>
            <TextInput
              style={styles.passwordInput}
              placeholder="اكتب كلمة المرور"
              placeholderTextColor="#94a3b8"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              textAlign="right"
            />
          </View>
        </View>

        <TouchableOpacity style={{ alignSelf: 'flex-start', marginBottom: 10 }} onPress={() => setForgotModalVisible(true)}>
          <Text style={{ color: '#0284c7', fontWeight: 'bold', fontSize: 14 }}>نسيت كلمة المرور؟</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.loginButton} onPress={handleLogin} disabled={loading}>
          {loading ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.loginButtonText}>تسجيل الدخول</Text>}
        </TouchableOpacity>

        {/* 💡 زرار التسجيل كراكب جديد المضاف حديثاً */}
        <TouchableOpacity 
          style={{ marginTop: 25, alignItems: 'center' }} 
          onPress={() => router.push('/passenger-signup')} 
        >
          <Text style={{ color: '#64748b', fontSize: 15 }}>
            ليس لديك حساب؟ <Text style={{ color: '#0284c7', fontWeight: 'bold' }}>سجل كراكب جديد</Text>
          </Text>
        </TouchableOpacity>
      </View>

      <Modal visible={forgotModalVisible} transparent={true} animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>استعادة كلمة المرور</Text>
            <Text style={styles.modalSubtitle}>أدخل اسمك ورقم هاتفك المسجل لتقديم طلب للإدارة.</Text>
            <TextInput style={styles.modalInput} placeholder="الاسم المسجل..." placeholderTextColor="#94a3b8" value={forgotName} onChangeText={setForgotName} textAlign="right" />
            <TextInput style={styles.modalInput} placeholder="رقم الهاتف المسجل..." placeholderTextColor="#94a3b8" keyboardType="phone-pad" value={forgotPhone} onChangeText={setForgotPhone} textAlign="right" />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalSendBtn} onPress={submitForgotPassword} disabled={isSendingForgot}>
                {isSendingForgot ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalSendBtnText}>إرسال للإدارة 🚀</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setForgotModalVisible(false)}>
                <Text style={styles.modalCancelBtnText}>إلغاء</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8fafc' },
  content: { flex: 1, justifyContent: 'center', padding: 20 },
  title: { fontSize: 26, fontWeight: 'bold', color: '#1e293b', textAlign: 'center', marginBottom: 10 },
  subtitle: { fontSize: 16, color: '#64748b', textAlign: 'center', marginBottom: 40 },
  inputContainer: { marginBottom: 20 },
  label: { fontSize: 16, fontWeight: 'bold', color: '#334155', marginBottom: 8, textAlign: 'right' },
  input: { backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 12, padding: 15, fontSize: 16, color: '#0f172a' },
  
  passwordWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 12, paddingHorizontal: 10 },
  passwordInput: { flex: 1, paddingVertical: 15, fontSize: 16, color: '#0f172a' },
  eyeBtn: { padding: 5 },

  loginButton: { backgroundColor: '#d97706', paddingVertical: 16, borderRadius: 12, alignItems: 'center', marginTop: 10, elevation: 2 },
  loginButtonText: { color: '#ffffff', fontSize: 18, fontWeight: 'bold' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { backgroundColor: '#ffffff', width: '100%', padding: 20, borderRadius: 16, elevation: 5 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#1e293b', textAlign: 'center', marginBottom: 5 },
  modalSubtitle: { fontSize: 13, color: '#64748b', textAlign: 'center', marginBottom: 15, lineHeight: 20 },
  modalInput: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, padding: 12, fontSize: 15, color: '#1e293b', marginBottom: 12 },
  modalActions: { flexDirection: 'row-reverse', gap: 10, marginTop: 5 },
  modalSendBtn: { flex: 2, backgroundColor: '#10b981', paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  modalSendBtnText: { color: '#ffffff', fontWeight: 'bold', fontSize: 15 },
  modalCancelBtn: { flex: 1, backgroundColor: '#fee2e2', paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  modalCancelBtnText: { color: '#ef4444', fontWeight: 'bold', fontSize: 14 }
});