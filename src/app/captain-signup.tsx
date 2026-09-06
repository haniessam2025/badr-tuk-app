import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { db } from '../firebaseConfig';

export default function CaptainRegister() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  // البيانات النصية
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [vehicle, setVehicle] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // الصور
  const [avatar, setAvatar] = useState<string | null>(null);
  const [idFront, setIdFront] = useState<string | null>(null);
  const [idBack, setIdBack] = useState<string | null>(null);
  const [vehicleImage, setVehicleImage] = useState<string | null>(null);

  // دالة فتح الكاميرا أو الاستوديو مع ضغط الصورة العالي
  const pickImage = async (setImageState: React.Dispatch<React.SetStateAction<string | null>>, title: string) => {
    Alert.alert(
      `إرفاق ${title}`,
      'اختر من أين تريد إرفاق الصورة',
      [
        {
          text: '📸 التقاط بالكاميرا',
          onPress: async () => {
            const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
            if (permissionResult.granted === false) {
              Alert.alert('تنبيه', 'يجب السماح بالوصول للكاميرا.');
              return;
            }
            let result = await ImagePicker.launchCameraAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              allowsEditing: true,
              quality: 0.05, // تم تقليل الجودة لـ 5% لتصغير حجم البيانات
              base64: true,
            });
            if (!result.canceled && result.assets[0].base64) {
              setImageState(`data:image/jpeg;base64,${result.assets[0].base64}`);
            }
          }
        },
        {
          text: '🖼️ اختيار من الاستوديو',
          onPress: async () => {
            let result = await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              allowsEditing: true,
              quality: 0.05, // تم تقليل الجودة لـ 5% لتصغير حجم البيانات
              base64: true,
            });
            if (!result.canceled && result.assets[0].base64) {
              setImageState(`data:image/jpeg;base64,${result.assets[0].base64}`);
            }
          }
        },
        { text: 'إلغاء', style: 'cancel' }
      ]
    );
  };

  const handleRegister = async () => {
    if (!name || !phone || !vehicle || !password || !confirmPassword) {
      Alert.alert('بيانات ناقصة', 'برجاء ملء جميع الحقول النصية المطلوبة.');
      return;
    }

    if (!idFront || !idBack || !vehicleImage) {
      Alert.alert('صور ناقصة', 'برجاء إرفاق صور البطاقة (الوجه والظهر) وصورة التوكتوك لتوثيق حسابك.');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('خطأ', 'كلمتا المرور غير متطابقتين، برجاء التأكد والمحاولة مرة أخرى.');
      return;
    }

    setLoading(true);
    try {
      await addDoc(collection(db, 'captains'), {
        name,
        phone,
        vehicle,
        password, 
        avatar: avatar || 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png', 
        idFront,
        idBack,
        vehicleImage,
        isOnline: false,
        walletBalance: 0, 
        status: 'pending_approval', 
        createdAt: serverTimestamp(),
      });

      setLoading(false);
      Alert.alert(
        'تم التسجيل بنجاح! 🎉',
        'تم رفع بياناتك وصورك بأمان. جاري مراجعة حسابك من قبل الإدارة وسيمكنك تسجيل الدخول قريباً.',
        [{ text: 'حسناً، للانتقال لشاشة الدخول', onPress: () => router.replace('/captain-login') }]
      );
    } catch (error: any) {
      setLoading(false);
      Alert.alert('سبب الخطأ الحقيقي 🚨', error.message || 'حدثت مشكلة أثناء إنشاء الحساب، تأكد من اتصالك بالإنترنت.');
      console.log("Firebase Error: ", error);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        
        <View style={styles.header}>
          <Text style={styles.headerTitle}>انضم إلينا ككابتن 🛺</Text>
          <Text style={styles.headerSubtitle}>قم بتعبئة بياناتك وإرفاق الأوراق المطلوبة</Text>
        </View>

        <View style={styles.avatarContainer}>
          <TouchableOpacity onPress={() => pickImage(setAvatar, 'الصورة الشخصية')} style={styles.avatarPicker}>
            {avatar ? (
              <Image source={{ uri: avatar }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarPlaceholderText}>صورة شخصية (اختياري)</Text>
            )}
            <View style={styles.avatarBadge}><Text style={styles.badgeText}>📷</Text></View>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>البيانات الأساسية</Text>
        <TextInput style={styles.input} placeholder="الاسم ثلاثي" placeholderTextColor="#94a3b8" value={name} onChangeText={setName} />
        <TextInput style={styles.input} placeholder="رقم الهاتف (واتساب)" placeholderTextColor="#94a3b8" keyboardType="phone-pad" value={phone} onChangeText={setPhone} />
        <TextInput style={styles.input} placeholder="رقم وموديل التوكتوك (مثال: بجاج 2022 - أ ب ج 123)" placeholderTextColor="#94a3b8" value={vehicle} onChangeText={setVehicle} />

        <Text style={styles.sectionTitle}>الأوراق الرسمية (مطلوب)</Text>
        
        <TouchableOpacity style={styles.cardPlaceholder} onPress={() => pickImage(setIdFront, 'وجه البطاقة')}>
          {idFront ? (
            <Image source={{ uri: idFront }} style={styles.cardImage} />
          ) : (
            <View style={styles.placeholderContent}>
              <Text style={styles.placeholderIcon}>🪪</Text>
              <Text style={styles.placeholderText}>اضغط لتصوير وجه البطاقة</Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.cardPlaceholder} onPress={() => pickImage(setIdBack, 'ظهر البطاقة')}>
          {idBack ? (
            <Image source={{ uri: idBack }} style={styles.cardImage} />
          ) : (
            <View style={styles.placeholderContent}>
              <Text style={styles.placeholderIcon}>🪪</Text>
              <Text style={styles.placeholderText}>اضغط لتصوير ظهر البطاقة</Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={[styles.cardPlaceholder, { height: 180 }]} onPress={() => pickImage(setVehicleImage, 'صورة التوكتوك')}>
          {vehicleImage ? (
            <Image source={{ uri: vehicleImage }} style={styles.cardImage} />
          ) : (
            <View style={styles.placeholderContent}>
              <Text style={styles.placeholderIcon}>🛺</Text>
              <Text style={styles.placeholderText}>اضغط لتصوير التوكتوك بوضوح</Text>
            </View>
          )}
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>إعدادات الأمان</Text>
        <TextInput style={styles.input} placeholder="كلمة المرور" placeholderTextColor="#94a3b8" secureTextEntry value={password} onChangeText={setPassword} />
        <TextInput style={styles.input} placeholder="تأكيد كلمة المرور" placeholderTextColor="#94a3b8" secureTextEntry value={confirmPassword} onChangeText={setConfirmPassword} />

        <TouchableOpacity style={styles.registerButton} onPress={handleRegister} disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#000" />
          ) : (
            <Text style={styles.registerButtonText}>إنشاء حساب وتوثيق البيانات</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.loginRedirect} onPress={() => router.push('/captain-login')}>
          <Text style={styles.loginRedirectText}>لديك حساب بالفعل؟ <Text style={styles.loginLink}>تسجيل الدخول</Text></Text>
        </TouchableOpacity>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  scrollContent: { padding: 20, paddingBottom: 40, paddingTop: 60 },
  header: { alignItems: 'center', marginBottom: 25 },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#1e293b', marginBottom: 5 },
  headerSubtitle: { fontSize: 14, color: '#64748b' },
  
  avatarContainer: { alignItems: 'center', marginBottom: 20 },
  avatarPicker: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#e2e8f0', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#cbd5e1', position: 'relative' },
  avatarImage: { width: '100%', height: '100%', borderRadius: 50 },
  avatarPlaceholderText: { fontSize: 12, color: '#64748b', textAlign: 'center', padding: 5 },
  avatarBadge: { position: 'absolute', bottom: 0, right: 0, backgroundColor: '#ffffff', borderRadius: 15, padding: 4, elevation: 2 },
  badgeText: { fontSize: 16 },

  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#334155', marginBottom: 12, textAlign: 'right', marginTop: 10 },
  input: { backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 12, padding: 14, fontSize: 15, marginBottom: 15, color: '#0f172a', textAlign: 'right', elevation: 1 },
  
  cardPlaceholder: { 
    width: '100%', 
    height: 160, 
    backgroundColor: '#f1f5f9', 
    borderWidth: 2, 
    borderColor: '#cbd5e1', 
    borderStyle: 'dashed', 
    borderRadius: 16, 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginBottom: 15,
    overflow: 'hidden'
  },
  cardImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  placeholderContent: { alignItems: 'center' },
  placeholderIcon: { fontSize: 35, marginBottom: 8 },
  placeholderText: { fontSize: 14, color: '#64748b', fontWeight: 'bold' },

  registerButton: { backgroundColor: '#eab308', paddingVertical: 16, borderRadius: 12, alignItems: 'center', marginTop: 10, elevation: 3 },
  registerButtonText: { color: '#000000', fontSize: 18, fontWeight: 'bold' },
  
  loginRedirect: { marginTop: 20, alignItems: 'center' },
  loginRedirectText: { fontSize: 15, color: '#64748b' },
  loginLink: { color: '#2563eb', fontWeight: 'bold' },
});