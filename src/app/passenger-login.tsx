import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { db } from '../firebaseConfig';

export default function PassengerLogin() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  // التحقق مما إذا كان الراكب مسجل الدخول مسبقاً
  useEffect(() => {
    const checkExistingLogin = async () => {
      const passengerId = await AsyncStorage.getItem('currentPassengerId');
      if (passengerId) {
        router.replace('/passenger-home');
      } else {
        setCheckingAuth(false);
      }
    };
    checkExistingLogin();
  }, []);

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      Alert.alert('تنبيه', 'برجاء إدخال اسم المستخدم وكلمة المرور.');
      return;
    }

    setLoading(true);

    try {
      // البحث عن الراكب في قاعدة البيانات باستخدام حقل 'name' المطابق لاسم المستخدم
      const q = query(
        collection(db, 'passengers'), 
        where('name', '==', username.trim()), 
        where('password', '==', password.trim())
      );
      
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const passengerDoc = querySnapshot.docs[0];
        const data = passengerDoc.data();

        const profileData = {
          id: passengerDoc.id,
          name: data.name || username.trim(),
          phone: data.phone || '',
          avatar: data.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'
        };

        // حفظ بيانات الدخول في ذاكرة الهاتف
        await AsyncStorage.setItem('currentPassengerId', passengerDoc.id);
        await AsyncStorage.setItem('passenger_profile', JSON.stringify(profileData));

        // التوجيه للصفحة الرئيسية
        router.replace('/passenger-home');
      } else {
        Alert.alert('خطأ', 'اسم المستخدم أو كلمة المرور غير صحيحة.');
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
        <ActivityIndicator size="large" color="#d97706" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
      style={styles.container}
    >
      <View style={styles.content}>
        <Text style={styles.title}>تسجيل دخول الراكب 🛺</Text>
        <Text style={styles.subtitle}>أدخل بيانات حسابك للمتابعة</Text>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>اسم المستخدم</Text>
          <TextInput
            style={styles.input}
            placeholder="اكتب اسم المستخدم"
            placeholderTextColor="#94a3b8"
            value={username}
            onChangeText={setUsername}
            textAlign="right"
            autoCapitalize="none"
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
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.loginButtonText}>تسجيل الدخول</Text>
          )}
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
  loginButton: { backgroundColor: '#d97706', paddingVertical: 16, borderRadius: 12, alignItems: 'center', marginTop: 10, elevation: 2 },
  loginButtonText: { color: '#ffffff', fontSize: 18, fontWeight: 'bold' },
});