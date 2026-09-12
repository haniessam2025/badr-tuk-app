import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { collection, doc, getDoc, getDocs, query, updateDoc, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { db } from '../firebaseConfig';

export default function PassengerProfile() {
  const router = useRouter();
  const [passengerId, setPassengerId] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [avatar, setAvatar] = useState('https://cdn-icons-png.flaticon.com/512/3135/3135715.png');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // متغيرات تغيير رقم الهاتف
  const [isPhoneModalVisible, setIsPhoneModalVisible] = useState(false);
  const [phoneStep, setPhoneStep] = useState(1); // 1: إدخال الرقم الجديد، 2: إدخال الـ OTP
  const [newPhone, setNewPhone] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [generatedOtp, setGeneratedOtp] = useState('');
  const [isProcessingPhone, setIsProcessingPhone] = useState(false);

  useEffect(() => {
    loadProfileData();
  }, []);

  const loadProfileData = async () => {
    try {
      const id = await AsyncStorage.getItem('currentPassengerId');
      if (!id) {
        router.replace('/passenger-login');
        return;
      }
      setPassengerId(id);

      const savedProfile = await AsyncStorage.getItem('passenger_profile');
      if (savedProfile) {
        const parsed = JSON.parse(savedProfile);
        setName(parsed.name || '');
        setPhone(parsed.phone || '');
        if (parsed.avatar && parsed.avatar.length > 50) setAvatar(parsed.avatar);
      }

      const docRef = doc(db, 'passengers', id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        setName(data.name || '');
        setPhone(data.phone || '');
        if (data.avatar || data.image) setAvatar(data.avatar || data.image);
      }
    } catch (error) {
      Alert.alert('خطأ', 'حدثت مشكلة أثناء تحميل البيانات');
    } finally {
      setIsLoading(false);
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
      await updateDoc(doc(db, 'passengers', passengerId), {
        name: name.trim(),
        avatar: avatar,
      });

      const newProfile = { name: name.trim(), phone, avatar };
      await AsyncStorage.setItem('passenger_profile', JSON.stringify(newProfile));

      Alert.alert('نجاح', 'تم تحديث بياناتك بنجاح', [{ text: 'حسناً', onPress: () => router.back() }]);
    } catch (error) {
      Alert.alert('خطأ', 'حدثت مشكلة أثناء حفظ البيانات');
    } finally {
      setIsSaving(false);
    }
  };

  // --- دوال تغيير رقم الهاتف ---
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
      // 1. فحص هل الرقم مسجل لحساب آخر
      const q = query(collection(db, 'passengers'), where('phone', '==', newPhone));
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        Alert.alert('تنبيه', 'هذا الرقم مسجل بحساب آخر بالفعل.');
        setIsProcessingPhone(false);
        return;
      }

      // 2. توليد كود عشوائي من 4 أرقام
      const otp = Math.floor(1000 + Math.random() * 9000).toString();
      setGeneratedOtp(otp);

      // 3. إرسال الـ OTP عبر واتساب (استبدل الرابط بـ API واتساب الخاص بك مثل UltraMsg)
      const message = `كود التحقق الخاص بك في تطبيق براق هو: ${otp}`;
      
      /* 
       ملاحظة: هذا السطر مجرد نموذج لإرسال الطلب للسيرفر الخارجي.
       لتفعيله فعلياً، يجب استخدام خدمة مثل UltraMsg أو غيرها.
       
       await fetch('https://api.ultramsg.com/YOUR_INSTANCE/messages/chat', {
         method: 'POST',
         headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
         body: `token=YOUR_TOKEN&to=${newPhone}&body=${encodeURIComponent(message)}`
       });
      */

      // محاكاة للإرسال للتجربة
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
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#d97706" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>➔ رجوع</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>الملف الشخصي</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.avatarContainer}>
          <Image source={{ uri: avatar }} style={styles.avatar} />
          <TouchableOpacity style={styles.editAvatarBtn} onPress={pickImage}>
            <Text style={styles.editAvatarIcon}>📷</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.formContainer}>
          <Text style={styles.label}>الاسم</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="أدخل اسمك"
            placeholderTextColor="#94a3b8"
            textAlign="right"
          />

          <View style={styles.phoneLabelRow}>
            <TouchableOpacity onPress={openPhoneEditModal}>
              <Text style={styles.editPhoneText}>تعديل الرقم</Text>
            </TouchableOpacity>
            <Text style={styles.label}>رقم الهاتف</Text>
          </View>
          <TextInput
            style={[styles.input, styles.disabledInput]}
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

      {/* نافذة تغيير رقم الهاتف */}
      <Modal visible={isPhoneModalVisible} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {phoneStep === 1 ? (
              <>
                <Text style={styles.modalTitle}>تغيير رقم الهاتف</Text>
                <Text style={styles.modalSubtitle}>سيتم إرسال كود تحقق (OTP) إلى الرقم الجديد عبر واتساب.</Text>
                <TextInput
                  style={styles.modalInput}
                  value={newPhone}
                  onChangeText={setNewPhone}
                  keyboardType="phone-pad"
                  placeholder="أدخل الرقم الجديد"
                  placeholderTextColor="#94a3b8"
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
                <Text style={styles.modalTitle}>تأكيد الرقم</Text>
                <Text style={styles.modalSubtitle}>أدخل الكود المكون من 4 أرقام المرسل إلى واتساب</Text>
                <TextInput
                  style={styles.modalInput}
                  value={otpCode}
                  onChangeText={setOtpCode}
                  keyboardType="numeric"
                  maxLength={4}
                  placeholder="----"
                  placeholderTextColor="#94a3b8"
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
  container: { flex: 1, backgroundColor: '#f8fafc' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8fafc' },
  header: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#ffffff', padding: 15, paddingTop: 50, borderBottomWidth: 1, borderColor: '#e2e8f0' },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#1e293b' },
  backBtn: { paddingVertical: 8, paddingHorizontal: 12, backgroundColor: '#f1f5f9', borderRadius: 8 },
  backBtnText: { color: '#475569', fontWeight: 'bold', fontSize: 14 },
  scrollContent: { flexGrow: 1, padding: 20, alignItems: 'center' },
  avatarContainer: { position: 'relative', marginBottom: 30, marginTop: 20 },
  avatar: { width: 120, height: 120, borderRadius: 60, borderWidth: 3, borderColor: '#3b82f6', backgroundColor: '#e2e8f0' },
  editAvatarBtn: { position: 'absolute', bottom: 0, right: 0, backgroundColor: '#d97706', width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#ffffff', elevation: 3 },
  editAvatarIcon: { fontSize: 18, color: '#ffffff' },
  formContainer: { width: '100%', backgroundColor: '#ffffff', padding: 20, borderRadius: 16, elevation: 2, borderWidth: 1, borderColor: '#f1f5f9' },
  label: { fontSize: 14, fontWeight: 'bold', color: '#475569', marginBottom: 8, textAlign: 'right' },
  phoneLabelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  editPhoneText: { color: '#3b82f6', fontSize: 13, fontWeight: 'bold' },
  input: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 12, padding: 14, fontSize: 16, color: '#0f172a', marginBottom: 20, fontWeight: 'bold' },
  disabledInput: { backgroundColor: '#e2e8f0', color: '#64748b' },
  saveBtn: { backgroundColor: '#2563eb', paddingVertical: 15, borderRadius: 12, alignItems: 'center', elevation: 3, marginTop: 10 },
  saveBtnText: { color: '#ffffff', fontSize: 16, fontWeight: 'bold' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { backgroundColor: '#ffffff', width: '100%', padding: 25, borderRadius: 20, elevation: 5 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#1e293b', marginBottom: 10, textAlign: 'center' },
  modalSubtitle: { fontSize: 13, color: '#64748b', textAlign: 'center', marginBottom: 20, lineHeight: 20 },
  modalInput: { backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 12, padding: 15, fontSize: 18, fontWeight: 'bold', color: '#0f172a', marginBottom: 20, letterSpacing: 1 },
  modalButtonsRow: { flexDirection: 'row-reverse', gap: 10 },
  modalPrimaryBtn: { flex: 2, backgroundColor: '#2563eb', paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  modalBtnText: { color: '#ffffff', fontWeight: 'bold', fontSize: 15 },
  modalCancelBtn: { flex: 1, backgroundColor: '#fee2e2', paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  modalCancelText: { color: '#ef4444', fontWeight: 'bold', fontSize: 15 }
});