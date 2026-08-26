import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { useState } from 'react';
import { ActivityIndicator, Alert, Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { auth, db } from '../firebaseConfig';

export default function CaptainSignupScreen() {
  const [name, setName] = useState('');
  const [nationalId, setNationalId] = useState('');
  const [phone, setPhone] = useState('');
  const [tukTukNumber, setTukTukNumber] = useState('');
  const [tukTukModel, setTukTukModel] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [image, setImage] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
      base64: true,
    });

    if (!result.canceled && result.assets && result.assets[0].base64) {
      const base64Image = `data:image/jpeg;base64,${result.assets[0].base64}`;
      setImage(base64Image);
    }
  };

  const handleSignup = async () => {
    if (!name || !nationalId || !phone || !tukTukNumber || !password || !confirmPassword) {
      Alert.alert('خطأ', 'يرجى ملء جميع الحقول الإلزامية.');
      return;
    }

    if (nationalId.length !== 14) {
      Alert.alert('خطأ', 'الرقم القومي يجب أن يكون 14 رقماً.');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('خطأ', 'كلمة المرور غير متطابقة.');
      return;
    }

    setLoading(true);
    try {
      const fakeEmail = `${phone.trim()}_captain@badrcute.com`;
      const userCredential = await createUserWithEmailAndPassword(auth, fakeEmail, password);
      const user = userCredential.user;

      await setDoc(doc(db, 'captains', user.uid), {
        uid: user.uid,
        name: name.trim(),
        nationalId: nationalId.trim(),
        phone: phone.trim(),
        tukTukNumber: tukTukNumber.trim(),
        tukTukModel: tukTukModel.trim() || 'توكتوك قياسي',
        image: image || '',
        createdAt: new Date(),
      });

      Alert.alert('تم بنجاح', 'تم إنشاء حساب الكابتن بنجاح.');
      router.replace('/captain-home');

    } catch (error: any) {
      let errorMessage = 'حدث خطأ أثناء التسجيل.';
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = 'رقم الهاتف مستخدم من قبل.';
      }
      Alert.alert('خطأ', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.scrollContainer}>
      <View style={styles.container}>
        <Text style={styles.title}>تسجيل كابتن جديد 👨‍✈️🛺</Text>

        <TouchableOpacity onPress={pickImage} style={styles.imageContainer}>
          {image ? (
            <Image source={{ uri: image }} style={styles.avatar} />
          ) : (
            <View style={styles.placeholderImage}>
              <Text style={styles.placeholderText}>اختياري: صورتك الشخصية 📷</Text>
            </View>
          )}
        </TouchableOpacity>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>اسم الكابتن</Text>
          <TextInput style={styles.input} placeholder="اكتب اسمك الكامل" placeholderTextColor="#9ca3af" value={name} onChangeText={setName} />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>الرقم القومي (14 رقم)</Text>
          <TextInput style={styles.input} placeholder="الرقم القومي" placeholderTextColor="#9ca3af" keyboardType="numeric" maxLength={14} value={nationalId} onChangeText={setNationalId} />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>رقم الهاتف</Text>
          <TextInput style={styles.input} placeholder="رقم الهاتف للتواصل والدخول" placeholderTextColor="#9ca3af" keyboardType="phone-pad" value={phone} onChangeText={setPhone} />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>رقم لوحة التوكتوك</Text>
          <TextInput style={styles.input} placeholder="مثال: أ ب ج 123" placeholderTextColor="#9ca3af" value={tukTukNumber} onChangeText={setTukTukNumber} />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>موديل أو لون التوكتوك</Text>
          <TextInput style={styles.input} placeholder="مثال: باجاج أصفر موديل 2024" placeholderTextColor="#9ca3af" value={tukTukModel} onChangeText={setTukTukModel} />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>كلمة المرور</Text>
          <TextInput style={styles.input} placeholder="كلمة المرور" placeholderTextColor="#9ca3af" secureTextEntry value={password} onChangeText={setPassword} />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>تأكيد كلمة المرور</Text>
          <TextInput style={styles.input} placeholder="أعد إدخال كلمة المرور" placeholderTextColor="#9ca3af" secureTextEntry value={confirmPassword} onChangeText={setConfirmPassword} />
        </View>

        {loading ? (
          <ActivityIndicator size="large" color="#2563eb" style={{ marginTop: 20 }} />
        ) : (
          <TouchableOpacity style={styles.button} onPress={handleSignup}>
            <Text style={styles.buttonText}>تسجيل الكابتن</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity onPress={() => router.push('/captain-login')} style={styles.linkButton}>
          <Text style={styles.linkText}>لديك حساب بالفعل؟ تسجيل الدخول</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: { flexGrow: 1, backgroundColor: '#f4f6f9' },
  container: { flex: 1, backgroundColor: '#f4f6f9', padding: 24, justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: 'bold', color: '#2563eb', textAlign: 'center', marginBottom: 20 },
  imageContainer: { alignSelf: 'center', marginBottom: 20 },
  avatar: { width: 90, height: 90, borderRadius: 45, borderWidth: 2, borderColor: '#2563eb' },
  placeholderImage: { width: 90, height: 90, borderRadius: 45, backgroundColor: '#e5e7eb', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#d1d5db' },
  placeholderText: { fontSize: 10, color: '#6b7280', textAlign: 'center', padding: 5 },
  inputGroup: { marginBottom: 15 },
  label: { fontSize: 14, fontWeight: '600', color: '#4b5563', marginBottom: 5, textAlign: 'right' },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 12, fontSize: 16, textAlign: 'right', color: '#333' },
  button: { backgroundColor: '#2563eb', padding: 16, borderRadius: 10, alignItems: 'center', marginTop: 20 },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  linkButton: { marginTop: 20, alignItems: 'center' },
  linkText: { color: '#2563eb', fontSize: 16, textDecorationLine: 'underline' },
});