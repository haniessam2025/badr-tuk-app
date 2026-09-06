import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { db } from '../firebaseConfig';

export default function CaptainLogin() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  // التحقق التلقائي: لو الكابتن مسجل دخول قبل كده، هيدخل مباشرة بدون ما يكتب حاجة
  useEffect(() => {
    const checkExistingLogin = async () => {
      const captainId = await AsyncStorage.getItem('currentCaptainId');
      if (captainId) {
        router.replace('/captain-home');
      } else {
        setCheckingAuth(false);
      }
    };
    checkExistingLogin();
  }, []);

  const handleLogin = async () => {
    if (!name.trim() || !password.trim()) {
      Alert.alert('تنبيه', 'برجاء إدخال الاسم وكلمة المرور.');
      return;
    }

    setLoading(true);

    try {
      // البحث عن الكابتن في قاعدة البيانات باستخدام الاسم
      const q = query(
        collection(db, 'captains'), 
        where('name', '==', name.trim()), 
        where('password', '==', password.trim())
      );
      
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const captainDoc = querySnapshot.docs[0];
        const data = captainDoc.data();

        // التأكد إن الإدارة لم تقم بحظر الحساب
        if (data.status === 'banned') {
          setLoading(false);
          Alert.alert('عفواً', 'تم إيقاف حسابك من قبل الإدارة. برجاء التواصل مع الدعم الفني.');
          return;
        }

        const profileData = {
          id: captainDoc.id,
          name: data.name || name.trim(),
          phone: data.phone || '',
          vehicle: data.tukTukNumber || data.vehicle || 'توكتوك',
          avatar: data.profileImage || data.avatar || data.image || 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png',
          walletBalance: data.walletBalance || 0 
        };

        // حفظ البيانات في الذاكرة لتفعيل الدخول التلقائي في المرات القادمة
        await AsyncStorage.setItem('currentCaptainId', captainDoc.id);
        await AsyncStorage.setItem('captain_profile', JSON.stringify(profileData));

        router.replace('/captain-home');
      } else {
        Alert.alert('خطأ', 'الاسم أو كلمة المرور غير صحيحة.');
      }
    } catch (error) {
      console.log(error);
      Alert.alert('خطأ', 'حدثت مشكلة أثناء تسجيل الدخول، تأكد من اتصالك بالإنترنت.');
    } finally {
      setLoading(false);
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
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
      style={styles.container}
    >
      <View style={styles.content}>
        <Text style={styles.title}>تسجيل دخول الكابتن 🛺</Text>
        <Text style={styles.subtitle}>أدخل بيانات حسابك لاستقبال الطلبات</Text>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>الاسم</Text>
          <TextInput
            style={styles.input}
            placeholder="أدخل اسمك المسجل"
            placeholderTextColor="#94a3b8"
            value={name}
            onChangeText={setName}
            textAlign="right"
          />
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>كلمة المرور</Text>
          <TextInput
            style={styles.input}
            placeholder="اكتب كلمة المرور"
            placeholderTextColor="#94a3b8"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            textAlign="right"
          />
        </View>

        <TouchableOpacity 
          style={styles.loginButton} 
          onPress={handleLogin}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#000000" />
          ) : (
            <Text style={styles.loginButtonText}>تسجيل الدخول</Text>
          )}
        </TouchableOpacity>

        {/* لينك للذهاب لشاشة إنشاء حساب جديد */}
        <TouchableOpacity style={styles.registerRedirect} onPress={() => router.push('/captain-register')}>
          <Text style={styles.registerRedirectText}>ليس لديك حساب؟ <Text style={styles.registerLink}>سجل ككابتن جديد</Text></Text>
        </TouchableOpacity>

      </View>
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
  loginButton: { backgroundColor: '#eab308', paddingVertical: 16, borderRadius: 12, alignItems: 'center', marginTop: 10, elevation: 2 },
  loginButtonText: { color: '#000000', fontSize: 18, fontWeight: 'bold' },
  registerRedirect: { marginTop: 20, alignItems: 'center', paddingVertical: 10 },
  registerRedirectText: { fontSize: 15, color: '#64748b' },
  registerLink: { color: '#2563eb', fontWeight: 'bold' },
});