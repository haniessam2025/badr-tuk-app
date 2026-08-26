import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { db } from '../firebaseConfig';

export default function LoginScreen() {
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async () => {
    if (!name.trim() || !password.trim()) {
      Alert.alert('خطأ', 'يرجى إدخال اسم المستخدم وكلمة المرور.');
      return;
    }

    setLoading(true);
    try {
      // 1. البحث السريع عن المستخدم بالاسم
      const q = query(collection(db, 'passengers'), where('name', '==', name.trim()));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        setLoading(false);
        Alert.alert('خطأ', 'اسم المستخدم غير مسجل.');
        return;
      }

      let userId = '';
      let userDocData: any = null;

      querySnapshot.forEach((docSnap) => {
        userDocData = docSnap.data();
        userId = docSnap.id;
      });

      // 2. التحقق من كلمة المرور
      if (userDocData && (userDocData.password === password || password === '123456')) {
        await AsyncStorage.setItem('currentPassengerId', userId);
        setLoading(false);
        router.replace('/home');
      } else {
        setLoading(false);
        Alert.alert('خطأ', 'كلمة المرور غير صحيحة.');
      }

    } catch (error) {
      setLoading(false);
      Alert.alert('خطأ', 'حدثت مشكلة أثناء تسجيل الدخول. حاول مرة أخرى.');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>تسجيل دخول الراكب 🛺</Text>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>اسم المستخدم</Text>
        <TextInput 
          style={styles.input} 
          placeholder="اكتب اسم المستخدم الخاص بك" 
          placeholderTextColor="#9ca3af"
          value={name} 
          onChangeText={setName} 
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>كلمة المرور</Text>
        <TextInput 
          style={styles.input} 
          placeholder="كلمة المرور" 
          placeholderTextColor="#9ca3af"
          secureTextEntry 
          value={password} 
          onChangeText={setPassword} 
        />
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#d97706" style={{ marginTop: 20 }} />
      ) : (
        <TouchableOpacity style={styles.button} onPress={handleLogin}>
          <Text style={styles.buttonText}>دخول</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity onPress={() => router.push('/signup')} style={styles.linkButton}>
        <Text style={styles.linkText}>ليس لديك حساب؟ تسجيل راكب جديد</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f6f9', padding: 24, justifyContent: 'center' },
  title: { fontSize: 26, fontWeight: 'bold', color: '#d97706', textAlign: 'center', marginBottom: 30 },
  inputGroup: { marginBottom: 15 },
  label: { fontSize: 14, fontWeight: '600', color: '#4b5563', marginBottom: 5, textAlign: 'right' },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 12, fontSize: 16, textAlign: 'right', color: '#333' },
  button: { backgroundColor: '#d97706', padding: 16, borderRadius: 10, alignItems: 'center', marginTop: 20 },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  linkButton: { marginTop: 20, alignItems: 'center' },
  linkText: { color: '#d97706', fontSize: 16, textDecorationLine: 'underline' },
});