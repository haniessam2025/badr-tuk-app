import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { db } from '../firebaseConfig';

export default function CaptainLogin() {
  const router = useRouter();
  const [phone, setPhone] = useState('');
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
    if (!phone.trim() || !password.trim()) {
      Alert.alert('تنبيه', 'برجاء إدخال رقم الهاتف وكلمة المرور.');
      return;
    }

    setLoading(true);

    try {
      // البحث عن الكابتن في قاعدة البيانات
      const q = query(
        collection(db, 'captains'), 
        where('phone', '==', phone.trim()), 
        where('password', '==', password.trim())
      );
      
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const captainDoc = querySnapshot.docs[0];
        const data = captainDoc.data();

        const profileData = {
          id: captainDoc.id,
          name: data.name || 'كابتن',
          phone: data.phone || phone.trim(),
          vehicle: data.tukTukNumber || data.vehicle || 'توكتوك',
          avatar: data.profileImage || data.avatar || data.image || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'
        };

        // حفظ البيانات في الذاكرة لتفعيل الدخول التلقائي في المرات القادمة
        await AsyncStorage.setItem('currentCaptainId', captainDoc.id);
        await AsyncStorage.setItem('captain_profile', JSON.stringify(profileData));

        router.replace('/captain-home');
      } else {
        Alert.alert('خطأ', 'رقم الهاتف أو كلمة المرور غير صحيحة.');
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
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
      style={styles.container}
    >
      <View style={styles.content}>
        <Text style={styles.title}>تسجيل دخول الكابتن 👨‍✈️</Text>
        <Text style={styles.subtitle}>أدخل بيانات حسابك لاستقبال الطلبات</Text>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>رقم الهاتف</Text>
          <TextInput
            style={styles.input}
            placeholder="مثال: 01000000000"
            placeholderTextColor="#94a3b8"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
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
  loginButton: { backgroundColor: '#2563eb', paddingVertical: 16, borderRadius: 12, alignItems: 'center', marginTop: 10, elevation: 2 },
  loginButtonText: { color: '#ffffff', fontSize: 18, fontWeight: 'bold' },
});