import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { db } from '../firebaseConfig';

export default function PassengerLogin() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  // التحقق لو الراكب مسجل دخول قبل كده عشان ندخله مباشرة
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

  const handleQuickLogin = async () => {
    if (!name.trim() || !phone.trim()) {
      Alert.alert('تنبيه', 'برجاء كتابة الاسم ورقم الهاتف للمتابعة.');
      return;
    }

    if (phone.length < 10) {
      Alert.alert('تنبيه', 'برجاء إدخال رقم هاتف صحيح.');
      return;
    }

    setLoading(true);

    try {
      // إنشاء حساب سريع للراكب في فايربيس بدون باسورد
      const newPassengerRef = await addDoc(collection(db, 'passengers'), {
        name: name.trim(),
        phone: phone.trim(),
        avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150', // صورة افتراضية
        createdAt: serverTimestamp(),
      });

      const profileData = {
        id: newPassengerRef.id,
        name: name.trim(),
        phone: phone.trim(),
        avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'
      };

      // حفظ البيانات في ذاكرة الهاتف
      await AsyncStorage.setItem('currentPassengerId', newPassengerRef.id);
      await AsyncStorage.setItem('passenger_profile', JSON.stringify(profileData));

      // التوجيه للصفحة الرئيسية
      router.replace('/passenger-home');
    } catch (error) {
      console.log(error);
      Alert.alert('خطأ', 'حدثت مشكلة أثناء الدخول، تأكد من اتصالك بالإنترنت.');
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
        <Text style={styles.title}>أهلاً بك في تطبيق التوكتوك 🛺</Text>
        <Text style={styles.subtitle}>أدخل بياناتك لطلب مشوارك فوراً بدون تعقيد</Text>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>الاسم</Text>
          <TextInput
            style={styles.input}
            placeholder="اكتب اسمك هنا"
            value={name}
            onChangeText={setName}
            textAlign="right"
          />
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>رقم الهاتف</Text>
          <TextInput
            style={styles.input}
            placeholder="مثال: 01012345678"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            textAlign="right"
          />
        </View>

        <TouchableOpacity 
          style={styles.loginButton} 
          onPress={handleQuickLogin}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.loginButtonText}>دخول سريع 🚀</Text>
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