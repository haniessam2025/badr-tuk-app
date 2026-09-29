import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { collection, doc, getDoc, getDocs, query, updateDoc, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { db } from '../firebase';
import { useApp } from './AppContext'; // 👈 استدعاء العقل المركزي للمظهر الداكن

export default function PassengerProfile() {
  const router = useRouter();
  const { isDarkMode } = useApp(); // 👈 سحب حالة المظهر الداكن
  
  const [passengerId, setPassengerId] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [avatar, setAvatar] = useState('https://cdn-icons-png.flaticon.com/512/3135/3135715.png');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // --- متغيرات تغيير رقم الهاتف ---
  const [isPhoneModalVisible, setIsPhoneModalVisible] = useState(false);
  const [phoneStep, setPhoneStep] = useState(1);
  const [newPhone, setNewPhone] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [generatedOtp, setGeneratedOtp] = useState('');
  const [isProcessingPhone, setIsProcessingPhone] = useState(false);

  useEffect(() => {
    const loadProfileData = async () => {
      try {
        const id = await AsyncStorage.getItem('currentPassengerId');
        if (id) {
          setPassengerId(id);
          const savedProfile = await AsyncStorage.getItem('passenger_profile');
          if (savedProfile) {
            const parsed = JSON.parse(savedProfile);
            setName(parsed.name || '');
            setPhone(parsed.phone || '');
            setAvatar(parsed.avatar || 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png');
          } else {
            const docRef = doc(db, 'passengers', id);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
              const data = docSnap.data();
              setName(data.name || '');
              setPhone(data.phone || '');
              setAvatar(data.avatar || 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png');
            }
          }
        }
      } catch (error) {
        Alert.alert('خطأ', 'حدثت مشكلة أثناء تحميل بيانات الملف الشخصي');
      } finally {
        setIsLoading(false);
      }
    };
    loadProfileData();
  }, []);

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
      
      const newProfile = { name: name.trim(), phone, avatar };
      await AsyncStorage.setItem('passenger_profile', JSON.stringify(newProfile));
      Alert.alert('نجاح ✅', 'تم تحديث بياناتك بنجاح', [{ text: 'حسناً', onPress: () => router.back() }]);
      
    } catch (error) {
      Alert.alert('خطأ', 'حدثت مشكلة أثناء حفظ البيانات');
    } finally {
      setIsSaving(false);
    }
  };

  const openPhoneEditModal = async () => {
    const activeRide = await AsyncStorage.getItem('active_ride');
    if (activeRide) {
      Alert.alert('تنبيه', 'لا يمكنك تغيير رقم الهاتف أثناء وجود رحلة نشطة.');
      return;
    }
    setNewPhone('');
    setOtpCode('');
    setPhoneStep(1);
    setIsPhoneModalVisible(true);
  };

  const requestPhoneOtp = async () => {
    if (newPhone.length < 10) {
      Alert.alert('تنبيه', 'برجاء إدخال رقم هاتف صحيح');
      return;
    }
    if (newPhone === phone) {
      Alert.alert('تنبيه', 'هذا هو رقمك الحالي بالفعل');
      return;
    }

    setIsProcessingPhone(true);
    try {
      const q = query(collection(db, 'passengers'), where('phone', '==', newPhone));
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        Alert.alert('تنبيه', 'هذا الرقم مسجل بحساب آخر بالفعل.');
        setIsProcessingPhone(false);
        return;
      }

      const otp = Math.floor(1000 + Math.random() * 9000).toString();
      setGeneratedOtp(otp);
      console.log(`OTP Sent to ${newPhone}: ${otp}`); 
      setPhoneStep(2);
    } catch (error) {
      Alert.alert('خطأ', 'حدثت مشكلة أثناء إرسال الكود');
    } finally {
      setIsProcessingPhone(false);
    }
  };

  const verifyAndSaveNewPhone = async () => {
    if (otpCode !== generatedOtp) {
      Alert.alert('خطأ', 'الكود غير صحيح، حاول مرة أخرى');
      return;
    }

    setIsProcessingPhone(true);
    try {
      await updateDoc(doc(db, 'passengers', passengerId), { phone: newPhone });
      
      setPhone(newPhone);
      const updatedProfile = { name, phone: newPhone, avatar };
      await AsyncStorage.setItem('passenger_profile', JSON.stringify(updatedProfile));

      Alert.alert('نجاح', 'تم تغيير رقم الهاتف بنجاح');
      setIsPhoneModalVisible(false);
    } catch (error) {
      Alert.alert('خطأ', 'حدثت مشكلة أثناء حفظ الرقم الجديد');
    } finally {
      setIsProcessingPhone(false);
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

          <View style={styles.phoneLabelRow}>
            <TouchableOpacity onPress={openPhoneEditModal}>
              <Text style={styles.editPhoneText}>تعديل الرقم</Text>
            </TouchableOpacity>
            <Text style={[styles.label, isDarkMode && { color: '#cbd5e1' }]}>رقم الهاتف</Text>
          </View>
          <TextInput
            style={[styles.input, styles.disabledInput, isDarkMode && { backgroundColor: '#0f172a', borderColor: '#1e293b', color: '#94a3b8' }]}
            value={phone}
            editable={false}
            textAlign="right"
          />

          <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={isSaving}>
            {isSaving ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.saveBtnText}>حفظ التعديلات</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>

      <Modal visible={isPhoneModalVisible} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, isDarkMode && { backgroundColor: '#1e293b' }]}>
            {phoneStep === 1 ? (
              <>
                <Text style={[styles.modalTitle, isDarkMode && { color: '#ffffff' }]}>تغيير رقم الهاتف</Text>
                <Text style={[styles.modalSubtitle, isDarkMode && { color: '#94a3b8' }]}>سيتم إرسال كود تحقق (OTP) إلى الرقم الجديد عبر واتساب.</Text>
                <TextInput
                  style={[styles.modalInput, isDarkMode && { backgroundColor: '#334155', borderColor: '#475569', color: '#ffffff' }]}
                  value={newPhone}
                  onChangeText={setNewPhone}
                  keyboardType="phone-pad"
                  placeholder="أدخل الرقم الجديد"
                  placeholderTextColor={isDarkMode ? '#64748b' : '#9ca3af'}
                  textAlign="center"
                />
                <View style={styles.modalButtonsRow}>
                  <TouchableOpacity style={styles.modalPrimaryBtn} onPress={requestPhoneOtp} disabled={isProcessingPhone}>
                    {isProcessingPhone ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.modalBtnText}>إرسال الكود</Text>}
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setIsPhoneModalVisible(false)}>
                    <Text style={styles.modalCancelText}>إلغاء</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <>
                <Text style={[styles.modalTitle, isDarkMode && { color: '#ffffff' }]}>تأكيد الرقم</Text>
                <Text style={[styles.modalSubtitle, isDarkMode && { color: '#94a3b8' }]}>أدخل الكود المكون من 4 أرقام المرسل إلى واتساب</Text>
                <TextInput
                  style={[styles.modalInput, isDarkMode && { backgroundColor: '#334155', borderColor: '#475569', color: '#ffffff' }]}
                  value={otpCode}
                  onChangeText={setOtpCode}
                  keyboardType="numeric"
                  maxLength={4}
                  placeholder="----"
                  placeholderTextColor={isDarkMode ? '#64748b' : '#9ca3af'}
                  textAlign="center"
                />
                <View style={styles.modalButtonsRow}>
                  <TouchableOpacity style={styles.modalPrimaryBtn} onPress={verifyAndSaveNewPhone} disabled={isProcessingPhone}>
                    {isProcessingPhone ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.modalBtnText}>تأكيد وحفظ</Text>}
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setPhoneStep(1)}>
                    <Text style={styles.modalCancelText}>رجوع</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
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
  
  formContainer: { width: '100%', backgroundColor: '#ffffff', padding: 25, borderRadius: 20, elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8 },
  label: { fontSize: 15, fontWeight: 'bold', color: '#374151', marginBottom: 8, textAlign: 'right' },
  phoneLabelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  editPhoneText: { color: '#3b82f6', fontSize: 14, fontWeight: 'bold' },
  
  input: { backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#d1d5db', borderRadius: 12, padding: 15, fontSize: 16, color: '#111827', marginBottom: 20, fontWeight: '600' },
  disabledInput: { backgroundColor: '#e5e7eb', color: '#6b7280', borderColor: '#e5e7eb' },
  
  saveBtn: { backgroundColor: '#2563eb', paddingVertical: 16, borderRadius: 14, alignItems: 'center', elevation: 4, marginTop: 10, shadowColor: '#2563eb', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 6 },
  saveBtnText: { color: '#ffffff', fontSize: 18, fontWeight: 'bold' },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { backgroundColor: '#ffffff', width: '100%', padding: 25, borderRadius: 24, elevation: 5 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#111827', marginBottom: 10, textAlign: 'center' },
  modalSubtitle: { fontSize: 14, color: '#6b7280', textAlign: 'center', marginBottom: 20, lineHeight: 22 },
  modalInput: { backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#d1d5db', borderRadius: 14, padding: 15, fontSize: 18, fontWeight: 'bold', color: '#111827', marginBottom: 20, letterSpacing: 1 },
  modalButtonsRow: { flexDirection: 'row-reverse', gap: 12 },
  modalPrimaryBtn: { flex: 2, backgroundColor: '#2563eb', paddingVertical: 15, borderRadius: 14, alignItems: 'center' },
  modalBtnText: { color: '#ffffff', fontWeight: 'bold', fontSize: 16 },
  modalCancelBtn: { flex: 1, backgroundColor: '#fee2e2', paddingVertical: 15, borderRadius: 14, alignItems: 'center' },
  modalCancelText: { color: '#dc2626', fontWeight: 'bold', fontSize: 16 }
});