import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { addDoc, collection, doc, getDocs, onSnapshot, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { db } from '../firebase';
import { useApp } from './AppContext';

export default function PassengerProfile() {
  const router = useRouter();
  const { isDarkMode } = useApp();
  
  const [passengerId, setPassengerId] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [avatar, setAvatar] = useState('https://cdn-icons-png.flaticon.com/512/3135/3135715.png');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [hidePhoneNumber, setHidePhoneNumber] = useState(false);

  const [isEditingPhone, setIsEditingPhone] = useState(false);
  const [newPhone, setNewPhone] = useState('');
  const [submittingPhone, setSubmittingPhone] = useState(false);

  useEffect(() => {
    let unsubscribe: () => void;

    const loadProfileData = async () => {
      try {
        const id = await AsyncStorage.getItem('currentPassengerId');
        if (id) {
          setPassengerId(id);
          
          // 1️⃣ تحميل سريع من الذاكرة عشان الشاشة تفتح فورا
          const savedProfile = await AsyncStorage.getItem('passenger_profile');
          if (savedProfile) {
            const parsed = JSON.parse(savedProfile);
            setName(parsed.name || '');
            setPhone(parsed.phone || '');
            setAvatar(parsed.avatar || 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png');
            setHidePhoneNumber(parsed.hidePhoneNumber || false);
          }

          // 2️⃣ مراقبة حية (Real-time) من الفايربيز: أول ما الإدارة توافق، الرقم بيتحدث فوراً وتلقائياً!
          unsubscribe = onSnapshot(doc(db, 'passengers', id), async (docSnap) => {
            if (docSnap.exists()) {
              const data = docSnap.data();
              setName(data.name || '');
              setPhone(data.phone || '');
              setAvatar(data.avatar || 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png');
              setHidePhoneNumber(data.hidePhoneNumber || false);

              // تحديث الذاكرة المحلية بالبيانات الجديدة المعتمدة
              const newProfile = { id, name: data.name, phone: data.phone, avatar: data.avatar, hidePhoneNumber: data.hidePhoneNumber };
              await AsyncStorage.setItem('passenger_profile', JSON.stringify(newProfile));
            }
          });
        }
      } catch (error) {
        console.log(error);
      } finally {
        setIsLoading(false);
      }
    };

    loadProfileData();

    // إيقاف المراقبة عند الخروج من الشاشة للحفاظ على الباقة
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const togglePhonePrivacy = async () => {
    const newValue = !hidePhoneNumber;
    setHidePhoneNumber(newValue);
    if (passengerId) {
      await updateDoc(doc(db, 'passengers', passengerId), { hidePhoneNumber: newValue });
    }
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('تنبيه', 'نحتاج صلاحية الوصول لمعرض الصور لتغيير صورتك الشخصية');
      return;
    }

    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.3,
      base64: true,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const base64Image = `data:image/jpeg;base64,${result.assets[0].base64}`;
      setAvatar(base64Image);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('تنبيه', 'برجاء إدخال اسمك');
      return;
    }

    setIsSaving(true);
    try {
      const updates = {
        name: name.trim(),
        avatar: avatar,
      };

      await updateDoc(doc(db, 'passengers', passengerId), updates);
      Alert.alert('نجاح ✅', 'تم تحديث بياناتك بنجاح', [{ text: 'حسناً', onPress: () => router.back() }]);
    } catch (error) {
      Alert.alert('خطأ', 'حدثت مشكلة أثناء حفظ البيانات');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePhoneUpdateRequest = async () => {
    if (!newPhone.trim() || newPhone.trim().length < 10) {
      Alert.alert('تنبيه', 'برجاء إدخال رقم هاتف جديد وصحيح.');
      return;
    }
    
    if (newPhone.trim() === phone) {
      Alert.alert('تنبيه', 'الرقم الجديد مطابق للرقم الحالي.');
      return;
    }

    const activeRide = await AsyncStorage.getItem('active_ride');
    if (activeRide) {
      Alert.alert('تنبيه', 'لا يمكنك طلب تغيير رقم الهاتف أثناء وجود رحلة نشطة.');
      return;
    }

    setSubmittingPhone(true);
    try {
      const q = query(collection(db, 'passengers'), where('phone', '==', newPhone.trim()));
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        Alert.alert('تنبيه', 'هذا الرقم مسجل بحساب آخر بالفعل.');
        setSubmittingPhone(false);
        return;
      }

      await addDoc(collection(db, 'update_requests'), {
        type: 'passenger_phone_update',
        userType: 'passenger',
        passengerId: passengerId,
        passengerName: name,
        oldData: { phone: phone },
        newData: { phone: newPhone.trim() },
        status: 'pending',
        timestamp: serverTimestamp()
      });

      Alert.alert('تم الإرسال ✅', 'تم إرسال طلب تغيير الرقم للإدارة بنجاح، سيتم تغييره فور الموافقة.');
      setIsEditingPhone(false);
      setNewPhone('');
    } catch (error) {
      Alert.alert('خطأ', 'حدثت مشكلة أثناء إرسال الطلب.');
    } finally {
      setSubmittingPhone(false);
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, isDarkMode && { backgroundColor: '#0f172a' }]}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={[styles.container, isDarkMode && { backgroundColor: '#0f172a' }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.header, isDarkMode && { backgroundColor: '#1e293b', borderColor: '#334155' }]}>
        <TouchableOpacity style={[styles.backBtn, isDarkMode && { backgroundColor: '#334155', borderColor: '#475569' }]} onPress={() => router.back()}>
          <Text style={[styles.backBtnText, isDarkMode && { color: '#e2e8f0' }]}>➔ رجوع</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, isDarkMode && { color: '#ffffff' }]}>الملف الشخصي</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.avatarContainer}>
          <Image source={{ uri: avatar }} style={[styles.avatar, isDarkMode && { borderColor: '#1e40af', backgroundColor: '#334155' }]} />
          <TouchableOpacity style={[styles.editAvatarBtn, isDarkMode && { borderColor: '#1e293b' }]} onPress={pickImage}>
            <Text style={styles.editAvatarIcon}>📷</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.formContainer, isDarkMode && { backgroundColor: '#1e293b', shadowOpacity: 0.3 }]}>
          <Text style={[styles.label, isDarkMode && { color: '#cbd5e1' }]}>الاسم</Text>
          <TextInput
            style={[styles.input, isDarkMode && { backgroundColor: '#334155', borderColor: '#475569', color: '#ffffff' }]}
            value={name}
            onChangeText={setName}
            placeholder="أدخل اسمك"
            placeholderTextColor={isDarkMode ? '#64748b' : '#9ca3af'}
            textAlign="right"
          />

          <View style={[styles.privacyBox, isDarkMode && { backgroundColor: '#334155', borderColor: '#475569' }]}>
            <View style={{ flex: 1, marginRight: 10 }}>
              <Text style={[styles.privacyTitle, isDarkMode && { color: '#ffffff' }]}>إخفاء رقم الهاتف 🛡️</Text>
              <Text style={[styles.privacySub, isDarkMode && { color: '#94a3b8' }]}>عند التفعيل، سيتواصل معك الكابتن عبر المكالمات المجانية أو المحادثة فقط.</Text>
            </View>
            <Switch
              value={hidePhoneNumber}
              onValueChange={togglePhonePrivacy}
              trackColor={{ false: '#cbd5e1', true: '#10b981' }}
              thumbColor={'#ffffff'}
            />
          </View>

          <View style={[styles.phoneUpdateCard, isDarkMode && { backgroundColor: '#1e293b', borderColor: '#475569' }]}>
            <View style={styles.phoneUpdateHeader}>
              <TouchableOpacity onPress={() => setIsEditingPhone(!isEditingPhone)}>
                <Text style={styles.phoneUpdateEditBtn}>{isEditingPhone ? 'إلغاء ✖' : 'تعديل الرقم'}</Text>
              </TouchableOpacity>
              <Text style={[styles.phoneUpdateTitle, isDarkMode && { color: '#ffffff' }]}>رقم الهاتف الأساسي</Text>
            </View>

            <View style={[styles.phoneInputBox, isDarkMode && { backgroundColor: '#0f172a' }]}>
              <TextInput
                style={[styles.phoneInputField, isDarkMode && { color: '#cbd5e1' }]}
                value={isEditingPhone ? newPhone : phone}
                onChangeText={setNewPhone}
                editable={isEditingPhone}
                keyboardType="phone-pad"
                placeholder="أدخل الرقم الجديد..."
                placeholderTextColor="#94a3b8"
                textAlign="center"
              />
            </View>

            {isEditingPhone && (
              <>
                <Text style={styles.otpWarningText}>* سيتم مراجعة الرقم الجديد من قبل الإدارة لتأكيده.</Text>
                
                <TouchableOpacity 
                  style={styles.savePhoneBtn} 
                  onPress={handlePhoneUpdateRequest}
                  disabled={submittingPhone}
                >
                  {submittingPhone ? <ActivityIndicator color="#fff" /> : <Text style={styles.savePhoneBtnText}>إرسال طلب تعديل / حفظ</Text>}
                </TouchableOpacity>

                <Text style={[styles.adminNoteText, isDarkMode && { color: '#94a3b8' }]}>أي تعديل في البيانات يتطلب مراجعة وموافقة الإدارة لضمان أمان الركاب.</Text>
              </>
            )}
          </View>

          <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={isSaving}>
            {isSaving ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.saveBtnText}>حفظ التعديلات العامة</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f9fafb' },
  header: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#ffffff', padding: 15, paddingTop: 50, borderBottomWidth: 1, borderColor: '#e5e7eb' },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#111827' },
  backBtn: { paddingVertical: 8, paddingHorizontal: 12, backgroundColor: '#f3f4f6', borderRadius: 8 },
  backBtnText: { color: '#4b5563', fontWeight: 'bold', fontSize: 14 },
  scrollContent: { flexGrow: 1, padding: 20, alignItems: 'center' },
  
  avatarContainer: { position: 'relative', marginBottom: 30, marginTop: 20 },
  avatar: { width: 120, height: 120, borderRadius: 60, borderWidth: 3, borderColor: '#3b82f6', backgroundColor: '#e5e7eb' },
  editAvatarBtn: { position: 'absolute', bottom: 0, right: 0, backgroundColor: '#d97706', width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: '#ffffff', elevation: 4 },
  editAvatarIcon: { fontSize: 18, color: '#ffffff' },
  
  formContainer: { width: '100%', backgroundColor: '#ffffff', padding: 25, borderRadius: 20, elevation: 3 },
  label: { fontSize: 15, fontWeight: 'bold', color: '#374151', marginBottom: 8, textAlign: 'right' },
  input: { backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#d1d5db', borderRadius: 12, padding: 15, fontSize: 16, color: '#111827', marginBottom: 20, fontWeight: '600' },
  
  privacyBox: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#ffffff', padding: 15, borderRadius: 12, marginBottom: 20, borderWidth: 1, borderColor: '#e2e8f0', elevation: 1 },
  privacyTitle: { fontSize: 16, fontWeight: 'bold', color: '#1e293b', textAlign: 'right' },
  privacySub: { fontSize: 12, color: '#64748b', textAlign: 'right', marginTop: 4 },

  phoneUpdateCard: { backgroundColor: '#ffffff', borderRadius: 16, padding: 20, marginBottom: 20, elevation: 1, borderWidth: 1, borderColor: '#e2e8f0' },
  phoneUpdateHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  phoneUpdateTitle: { fontSize: 16, fontWeight: 'bold', color: '#334155' },
  phoneUpdateEditBtn: { fontSize: 14, fontWeight: 'bold', color: '#10b981' },
  phoneInputBox: { backgroundColor: '#e2e8f0', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 15, marginBottom: 10 },
  phoneInputField: { fontSize: 20, fontWeight: 'bold', color: '#475569', textAlign: 'center', letterSpacing: 2 },
  otpWarningText: { fontSize: 12, color: '#d97706', textAlign: 'right', marginBottom: 15 },
  savePhoneBtn: { backgroundColor: '#10b981', paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginBottom: 15 },
  savePhoneBtnText: { color: '#ffffff', fontSize: 16, fontWeight: 'bold' },
  adminNoteText: { fontSize: 11, color: '#64748b', textAlign: 'center', lineHeight: 18 },

  saveBtn: { backgroundColor: '#2563eb', paddingVertical: 16, borderRadius: 14, alignItems: 'center', elevation: 4, shadowColor: '#2563eb', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 6 },
  saveBtnText: { color: '#ffffff', fontSize: 18, fontWeight: 'bold' },
});