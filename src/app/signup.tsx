import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { doc, setDoc } from 'firebase/firestore';
import { useState } from 'react';
import { ActivityIndicator, Alert, Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { db } from '../firebaseConfig';

export default function SignupScreen() {
  const [name, setName] = useState('');
  const [nationalId, setNationalId] = useState('');
  const [phone, setPhone] = useState('');
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
      quality: 0.1,
      base64: true,
    });

    if (!result.canceled && result.assets && result.assets[0].base64) {
      setImage(`data:image/jpeg;base64,${result.assets[0].base64}`);
    }
  };

  const handleSignup = async () => {
    if (!name || !nationalId || !phone || !password || !confirmPassword) {
      Alert.alert('خطأ', 'يرجى ملء جميع الحقول المطلوبة.');
      return;
    }

    if (nationalId.length !== 14) {
      Alert.alert('خطأ', 'الرقم القومي يجب أن يكون 14 رقماً.');
      return;
    }

    if (phone.length < 10) {
      Alert.alert('خطأ', 'يرجى إدخال رقم هاتف صحيح.');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('خطأ', 'كلمة المرور وتأكيد كلمة المرور غير متطابقين.');
      return;
    }

    setLoading(true);
    try {
      const userId = 'pass_' + Date.now();

      // حفظ البيانات مباشرة في Firestore بدون انتظار معقد
      await setDoc(doc(db, 'passengers', userId), {
        uid: userId,
        name: name.trim(),
        nationalId: nationalId.trim(),
        phone: phone.trim(),
        password: password,
        image: image,
        createdAt: new Date(),
      });

      setLoading(false);
      Alert.alert('تم بنجاح', 'تم إنشاء الحساب بنجاح.');
      
      // الانتقال المباشر لصفحة تسجيل الدخول أو الرئيسية حسب رغبتك (هنا لصفحة الدخول ليقوم بتسجيل دخوله السريع)
      router.replace('/login');

    } catch (error: any) {
      setLoading(false);
      Alert.alert('خطأ', 'حدثت مشكلة أثناء التسجيل: ' + (error.message || ''));
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
      <View style={styles.container}>
        <Text style={styles.title}>تسجيل راكب جديد 🛺</Text>

        <TouchableOpacity onPress={pickImage} style={styles.imageContainer}>
          {image ? (
            <Image source={{ uri: image }} style={styles.avatar} />
          ) : (
            <View style={styles.placeholderImage}>
              <Text style={styles.placeholderText}>اختياري: اضغط لإضافة صورة 📷</Text>
            </View>
          )}
        </TouchableOpacity>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>اسم المستخدم</Text>
          <TextInput 
            style={styles.input} 
            placeholder="اكتب اسمك الكامل" 
            placeholderTextColor="#9ca3af"
            value={name} 
            onChangeText={setName} 
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>الرقم القومي (14 رقم)</Text>
          <TextInput 
            style={styles.input} 
            placeholder="اكتب الرقم القومي" 
            placeholderTextColor="#9ca3af"
            keyboardType="numeric"
            maxLength={14}
            value={nationalId} 
            onChangeText={setNationalId} 
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>رقم الهاتف</Text>
          <TextInput 
            style={styles.input} 
            placeholder="اكتب رقم الهاتف (يستخدم لتسجيل الدخول)" 
            placeholderTextColor="#9ca3af"
            keyboardType="phone-pad"
            value={phone} 
            onChangeText={setPhone} 
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

        <View style={styles.inputGroup}>
          <Text style={styles.label}>تأكيد كلمة المرور</Text>
          <TextInput 
            style={styles.input} 
            placeholder="أعد إدخال كلمة المرور" 
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
            <Text style={styles.buttonText}>إنشاء الحساب</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity onPress={() => router.push('/login')} style={styles.linkButton}>
          <Text style={styles.linkText}>لديك حساب بالفعل؟ تسجيل الدخول</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: { flexGrow: 1, backgroundColor: '#f4f6f9' },
  container: { flex: 1, backgroundColor: '#f4f6f9', padding: 24, justifyContent: 'center' },
  title: { fontSize: 26, fontWeight: 'bold', color: '#d97706', textAlign: 'center', marginBottom: 20 },
  imageContainer: { alignSelf: 'center', marginBottom: 20 },
  avatar: { width: 90, height: 90, borderRadius: 45, borderWidth: 2, borderColor: '#d97706' },
  placeholderImage: { width: 90, height: 90, borderRadius: 45, backgroundColor: '#e5e7eb', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#d1d5db' },
  placeholderText: { fontSize: 10, color: '#6b7280', textAlign: 'center', padding: 5 },
  inputGroup: { marginBottom: 15 },
  label: { fontSize: 14, fontWeight: '600', color: '#4b5563', marginBottom: 5, textAlign: 'right' },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 12, fontSize: 16, textAlign: 'right', color: '#333' },
  button: { backgroundColor: '#d97706', padding: 16, borderRadius: 10, alignItems: 'center', marginTop: 20 },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  linkButton: { marginTop: 20, alignItems: 'center' },
  linkText: { color: '#d97706', fontSize: 16, textDecorationLine: 'underline' },
});