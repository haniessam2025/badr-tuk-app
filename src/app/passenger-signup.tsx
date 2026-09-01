import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { addDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { useState } from 'react';
import { ActivityIndicator, Alert, Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { db } from '../firebaseConfig';

export default function PassengerSignupScreen() {
  const [image, setImage] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [nationalId, setNationalId] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.3, 
      base64: true,
    });

    if (!result.canceled && result.assets && result.assets[0].base64) {
      const base64Image = `data:image/jpeg;base64,${result.assets[0].base64}`;
      setImage(base64Image);
    }
  };

  const handleSignup = async () => {
    if (!name.trim() || !nationalId.trim() || !phone.trim() || !password.trim() || !confirmPassword.trim()) {
      Alert.alert('خطأ', 'يرجى إدخال جميع البيانات المطلوبة.');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('خطأ', 'كلمة السر غير متطابقة.');
      return;
    }

    setLoading(true);
    try {
      const q = query(collection(db, 'passengers'), where('name', '==', name.trim()));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        setLoading(false);
        Alert.alert('خطأ', 'اسم المستخدم مسجل بالفعل. يرجى اختيار اسم آخر أو تسجيل الدخول.');
        return;
      }

      // إضافة صورة افتراضية في حال لم يقم المستخدم باختيار صورة
      const newPassenger = {
        name: name.trim(),
        nationalId: nationalId.trim(),
        phone: phone.trim(),
        password: password.trim(),
        avatar: image || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
      };

      const docRef = await addDoc(collection(db, 'passengers'), newPassenger);

      await AsyncStorage.multiRemove([
        'currentPassengerId',
        'passenger_profile',
        'active_ride'
      ]);

      await AsyncStorage.setItem('currentPassengerId', docRef.id);
      await AsyncStorage.setItem('passenger_profile', JSON.stringify(newPassenger));

      setLoading(false);
      
      router.replace('/passenger-home'); 
    } catch (error) {
      setLoading(false);
      Alert.alert('خطأ', 'حدثت مشكلة أثناء إنشاء الحساب. حاول مرة أخرى.');
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
      <Text style={styles.title}>تسجيل راكب جديد 🛺</Text>

      <View style={styles.avatarContainer}>
        <TouchableOpacity onPress={pickImage}>
          {image ? (
            <Image source={{ uri: image }} style={styles.avatar} />
          ) : (
            <View style={styles.placeholderAvatar}>
              <Text style={styles.placeholderText}>📷 صورة اختيارية</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>اسم المستخدم</Text>
        <TextInput 
          style={styles.input} 
          placeholder="اكتب اسمك هنا" 
          placeholderTextColor="#9ca3af"
          value={name} 
          onChangeText={setName} 
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>الرقم القومي</Text>
        <TextInput 
          style={styles.input} 
          placeholder="الرقم القومي (14 رقم)" 
          placeholderTextColor="#9ca3af"
          keyboardType="numeric"
          value={nationalId} 
          onChangeText={setNationalId} 
          maxLength={14}
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>رقم الموبايل</Text>
        <TextInput 
          style={styles.input} 
          placeholder="اكتب رقم هاتفك" 
          placeholderTextColor="#9ca3af"
          keyboardType="phone-pad"
          value={phone} 
          onChangeText={setPhone} 
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>كلمة السر</Text>
        <TextInput 
          style={styles.input} 
          placeholder="اختر كلمة مرور قوية" 
          placeholderTextColor="#9ca3af"
          secureTextEntry 
          value={password} 
          onChangeText={setPassword} 
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>تأكيد كلمة السر</Text>
        <TextInput 
          style={styles.input} 
          placeholder="أعد كتابة كلمة المرور" 
          placeholderTextColor="#9ca3af"
          secureTextEntry 
          value={confirmPassword} 
          onChangeText={setConfirmPassword} 
        />
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#d97706" style={{ marginTop: 20 }} />
      ) : (
        <TouchableOpacity style={styles.button} onPress={handleSignup}>
          <Text style={styles.buttonText}>تسجيل</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity onPress={() => router.push('/passenger-login')} style={styles.linkButton}>
        <Text style={styles.linkText}>لديك حساب بالفعل؟ تسجيل الدخول</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: { flexGrow: 1, backgroundColor: '#f4f6f9', padding: 24, justifyContent: 'center' },
  title: { fontSize: 26, fontWeight: 'bold', color: '#d97706', textAlign: 'center', marginBottom: 20 },
  avatarContainer: { alignItems: 'center', marginBottom: 25 },
  avatar: { width: 110, height: 110, borderRadius: 55, borderWidth: 3, borderColor: '#d97706' },
  placeholderAvatar: { width: 110, height: 110, borderRadius: 55, backgroundColor: '#e2e8f0', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#cbd5e1', borderStyle: 'dashed' },
  placeholderText: { color: '#64748b', fontSize: 13, fontWeight: 'bold' },
  inputGroup: { marginBottom: 15 },
  label: { fontSize: 14, fontWeight: '600', color: '#4b5563', marginBottom: 5, textAlign: 'right' },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 12, fontSize: 16, textAlign: 'right', color: '#333' },
  button: { backgroundColor: '#10b981', padding: 16, borderRadius: 10, alignItems: 'center', marginTop: 20 },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  linkButton: { marginTop: 20, marginBottom: 40, alignItems: 'center' },
  linkText: { color: '#d97706', fontSize: 16, textDecorationLine: 'underline', fontWeight: 'bold' },
});