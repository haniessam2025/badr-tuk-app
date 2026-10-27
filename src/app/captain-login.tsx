import { Ionicons } from '@expo/vector-icons'; // 👈 استدعاء الأيقونات
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { addDoc, collection, doc, getDocs, query, updateDoc, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { db } from '../firebase';

export default function CaptainLogin() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  // 💡 متغير التحكم في إظهار وإخفاء الباسوورد
  const [showPassword, setShowPassword] = useState(false);

  // متغيرات مودال نسيت كلمة المرور
  const [forgotModalVisible, setForgotModalVisible] = useState(false);
  const [forgotPhone, setForgotPhone] = useState('');
  const [forgotName, setForgotName] = useState('');
  const [isSendingForgot, setIsSendingForgot] = useState(false);

  useEffect(() => {
    const checkExistingLogin = async () => {
      try {
        const captainId = await AsyncStorage.getItem('currentCaptainId');
        if (captainId) {
          router.replace('/captain-home');
        } else {
          setCheckingAuth(false);
        }
      } catch (error) {
        setCheckingAuth(false);
      }
    };
    checkExistingLogin();
  }, []);

  const handleLogin = async () => {
    const trimmedInput = name.trim(); // يقبل الاسم أو رقم الهاتف
    const trimmedPassword = password.trim();

    if (!trimmedInput || !trimmedPassword) {
      Alert.alert('تنبيه', 'برجاء إدخال الاسم (أو رقم الهاتف) وكلمة المرور.');
      return;
    }

    if (trimmedInput.toLowerCase() === 'admin' && trimmedPassword === 'admin123') {
router.replace('/admin-dashboard' as any);
      return;
    }

    setLoading(true);

    try {
      // 💡 البحث الذكي: هل المُدخل اسم مستخدم أم رقم هاتف؟
      let q = query(
        collection(db, 'captains'), 
        where('name', '==', trimmedInput), 
        where('password', '==', trimmedPassword)
      );
      
      let querySnapshot = await getDocs(q);

      // لو ملقاش بالاسم، ندور برقم التليفون
      if (querySnapshot.empty) {
        const qPhone = query(
          collection(db, 'captains'), 
          where('phone', '==', trimmedInput), 
          where('password', '==', trimmedPassword)
        );
        querySnapshot = await getDocs(qPhone);
      }

      if (!querySnapshot.empty) {
        const captainDoc = querySnapshot.docs[0];
        const data = captainDoc.data();

        if (data.status === 'banned') {
          setLoading(false);
          Alert.alert('عفواً', 'تم إيقاف حسابك من قبل الإدارة. برجاء التواصل مع الدعم الفني.');
          return;
        }

        if (data.status === 'pending_approval') {
          setLoading(false);
          Alert.alert('قيد المراجعة ⏳', 'حسابك ما زال قيد المراجعة وتدقيق المستندات من الإدارة.');
          return;
        }

        const profileData = {
          id: captainDoc.id,
          name: data.name || trimmedInput,
          phone: data.phone || '',
          vehicle: data.tukTukNumber || data.vehicle || 'توكتوك',
          avatar: data.profileImage || data.avatar || data.image || 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png',
          walletBalance: data.walletBalance || 0 
        };

        const newSessionId = Math.random().toString(36).substring(2) + Date.now().toString(36);

        await AsyncStorage.setItem('currentCaptainId', captainDoc.id);
        await AsyncStorage.setItem('captain_profile', JSON.stringify(profileData));
        await AsyncStorage.setItem('currentSessionId', newSessionId); 
        
        await updateDoc(doc(db, 'captains', captainDoc.id), {
          sessionId: newSessionId
        });

        router.replace('/captain-home');      
      } else {
        Alert.alert('خطأ', 'الاسم (أو الهاتف) أو كلمة المرور غير صحيحة.');
      }
    } catch (error) {
      console.log(error);
      Alert.alert('خطأ', 'حدثت مشكلة أثناء تسجيل الدخول، تأكد من اتصالك بالإنترنت.');
    } finally {
      setLoading(false);
    }
  };

  const submitForgotPassword = async () => {
    if (!forgotPhone.trim() || !forgotName.trim()) {
      Alert.alert('تنبيه', 'برجاء إدخال الاسم ورقم الهاتف للتحقق.');
      return;
    }

    setIsSendingForgot(true);
    try {
      const q = query(collection(db, 'captains'), where('phone', '==', forgotPhone.trim()));
      const snap = await getDocs(q);

      if (snap.empty) {
        Alert.alert('خطأ', 'رقم الهاتف غير مسجل لدينا في حسابات الكباتن.');
        setIsSendingForgot(false);
        return;
      }

      const captainDocData = snap.docs[0].data();
      const captainDocId = snap.docs[0].id;

      await addDoc(collection(db, 'support_tickets'), {
        type: 'password_reset',
        userType: 'captain',
        captainId: captainDocId,
        senderName: forgotName.trim(),
        senderPhone: forgotPhone.trim(),
        message: `طلب استعادة كلمة المرور للحساب (رقم الهاتف: ${forgotPhone.trim()})`,
        status: 'pending',
        isReadAdmin: false,
        timestamp: new Date().getTime()
      });

      Alert.alert('تم إرسال الطلب ✅', 'تم إرسال طلبك للإدارة بنجاح. سيتم مراجعته وإرسال كلمة مرور مؤقتة لك قريباً.');
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
        <ActivityIndicator size="large" color="#eab308" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>تسجيل دخول الكابتن 🛺</Text>
        <Text style={styles.subtitle}>أدخل بيانات حسابك لاستقبال الطلبات</Text>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>الاسم أو رقم الهاتف</Text>
          <TextInput
            style={styles.input}
            placeholder="أدخل اسمك أو رقم هاتفك"
            placeholderTextColor="#94a3b8"
            value={name}
            onChangeText={setName}
            textAlign="right"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        {/* 💡 خانة الباسوورد بعلامة العين المدمجة */}
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
              autoCapitalize="none"
            />
          </View>
        </View>

        <TouchableOpacity style={{ alignSelf: 'flex-start', marginBottom: 10 }} onPress={() => setForgotModalVisible(true)}>
          <Text style={{ color: '#2563eb', fontWeight: 'bold', fontSize: 14 }}>نسيت كلمة المرور؟</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.loginButton} onPress={handleLogin} disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#000000" />
          ) : (
            <Text style={styles.loginButtonText}>تسجيل الدخول</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity 
          style={{ marginTop: 20, alignItems: 'center' }} 
          onPress={() => router.push('/captain-signup')} 
        >
          <Text style={{ color: '#64748b', fontSize: 15 }}>
            ليس لديك حساب؟ <Text style={{ color: '#10b981', fontWeight: 'bold' }}>سجل ككابتن جديد</Text>
          </Text>
        </TouchableOpacity>
      </View>

      <Modal visible={forgotModalVisible} transparent={true} animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>استعادة كلمة المرور</Text>
            <Text style={styles.modalSubtitle}>أدخل اسمك ورقم هاتفك المسجل لتقديم طلب للإدارة.</Text>
            
            <TextInput
              style={styles.modalInput}
              placeholder="الاسم المسجل..."
              placeholderTextColor="#94a3b8"
              value={forgotName}
              onChangeText={setForgotName}
              textAlign="right"
            />

            <TextInput
              style={styles.modalInput}
              placeholder="رقم الهاتف المسجل..."
              placeholderTextColor="#94a3b8"
              keyboardType="phone-pad"
              value={forgotPhone}
              onChangeText={setForgotPhone}
              textAlign="right"
            />

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
  inputContainer: { marginBottom: 15 },
  label: { fontSize: 16, fontWeight: 'bold', color: '#334155', marginBottom: 8, textAlign: 'right' },
  input: { backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 12, padding: 15, fontSize: 16, color: '#0f172a' },
  
  // 💡 تنسيقات الباسوورد والعين
  passwordWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 12, paddingHorizontal: 10 },
  passwordInput: { flex: 1, paddingVertical: 15, fontSize: 16, color: '#0f172a' },
  eyeBtn: { padding: 5 },

  loginButton: { backgroundColor: '#eab308', paddingVertical: 16, borderRadius: 12, alignItems: 'center', marginTop: 10, elevation: 2 },
  loginButtonText: { color: '#000000', fontSize: 18, fontWeight: 'bold' },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { backgroundColor: '#ffffff', width: '100%', padding: 20, borderRadius: 16, elevation: 5 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#1e293b', textAlign: 'center', marginBottom: 5 },
  modalSubtitle: { fontSize: 13, color: '#64748b', textAlign: 'center', marginBottom: 15, lineHeight: 20 },
  modalInput: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, padding: 12, fontSize: 15, color: '#1e293b', marginBottom: 12 },
  modalActions: { flexDirection: 'row-reverse', gap: 10, marginTop: 5 },
  modalSendBtn: { flex: 2, backgroundColor: '#10b981', paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  modalSendBtnText: { color: '#ffffff', fontWeight: 'bold', fontSize: 15 },
  modalCancelBtn: { flex: 1, backgroundColor: '#fee2e2', paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  modalCancelText: { color: '#ef4444', fontWeight: 'bold', fontSize: 15 },
  modalCancelBtnText: { color: '#ef4444', fontWeight: 'bold', fontSize: 14 }
});