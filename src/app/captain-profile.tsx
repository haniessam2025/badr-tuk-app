import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { addDoc, collection, doc, getDoc, getDocs, query, updateDoc, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { db } from '../firebaseConfig';

export default function CaptainProfile() {
  const router = useRouter();
  const [captainId, setCaptainId] = useState('');
  const [originalData, setOriginalData] = useState<any>(null);
  
  // حقول التعديل الأساسية
  const [editName, setEditName] = useState('');
  const [editAvatar, setEditAvatar] = useState('https://cdn-icons-png.flaticon.com/512/3135/3135715.png');
  
  // حقول المركبة الديناميكية
  const [vehicleCategory, setVehicleCategory] = useState<'car' | 'tuktuk_alt' | 'scooter'>('tuktuk_alt');
  
  // بيانات السيارة
  const [carBrand, setCarBrand] = useState('');
  const [carModelName, setCarModelName] = useState('');
  const [carYear, setCarYear] = useState('');
  const [carColor, setCarColor] = useState('');
  const [carPlate, setCarPlate] = useState('');
  
  // بيانات بديل التوكتوك
  const [tuktukImage, setTuktukImage] = useState('');
  const [tuktukNumber, setTuktukNumber] = useState('');
  
  // بيانات السكوتر
  const [scooterImage, setScooterImage] = useState('');
  const [scooterPlate, setScooterPlate] = useState('');

  // حقول للعرض فقط
  const [phone, setPhone] = useState('');
  const [walletBalance, setWalletBalance] = useState(0);
  const [rating, setRating] = useState(5);
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // متغيرات تغيير رقم الهاتف (OTP)
  const [isPhoneModalVisible, setIsPhoneModalVisible] = useState(false);
  const [phoneStep, setPhoneStep] = useState(1);
  const [newPhone, setNewPhone] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [generatedOtp, setGeneratedOtp] = useState('');
  const [isProcessingPhone, setIsProcessingPhone] = useState(false);

  useEffect(() => {
    loadProfileData();
  }, []);

  const loadProfileData = async () => {
    try {
      const id = await AsyncStorage.getItem('currentCaptainId');
      if (!id) {
        router.replace('/captain-login');
        return;
      }
      setCaptainId(id);

      const docRef = doc(db, 'captains', id);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        setOriginalData(data);
        
        setEditName(data.name || '');
        setEditAvatar(data.profileImage || data.avatar || data.image || 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png');
        
        setVehicleCategory(data.vehicleCategory || 'tuktuk_alt');
        if (data.vehicleDetails) {
          setCarBrand(data.vehicleDetails.brand || '');
          setCarModelName(data.vehicleDetails.modelName || '');
          setCarYear(data.vehicleDetails.year || data.vehicleDetails.model || '');
          setCarColor(data.vehicleDetails.color || '');
          setCarPlate(data.vehicleDetails.plate || '');
          setTuktukImage(data.vehicleDetails.image || '');
          setTuktukNumber(data.vehicleDetails.number || '');
          setScooterImage(data.vehicleDetails.image || '');
          setScooterPlate(data.vehicleDetails.plate || '');
        } else {
          setTuktukNumber(data.tukTukNumber || data.vehicle || '');
        }

        setPhone(data.phone || '');
        setWalletBalance(data.walletBalance || 0);
        setRating(data.rating || 5);
      }
    } catch (error) {
      Alert.alert('خطأ', 'حدثت مشكلة أثناء تحميل البيانات');
    } finally {
      setIsLoading(false);
    }
  };

  const showImagePickerOptions = (setTargetState: React.Dispatch<React.SetStateAction<string>>) => {
    Alert.alert(
      'اختيار صورة',
      'التقط صورة جديدة أو اختر من المعرض',
      [
        { text: 'إلغاء', style: 'cancel' },
        { text: 'معرض الصور', onPress: () => pickImageFromGallery(setTargetState) },
        { text: 'الكاميرا', onPress: () => takePhotoWithCamera(setTargetState) }
      ]
    );
  };

  const pickImageFromGallery = async (setTargetState: React.Dispatch<React.SetStateAction<string>>) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('تنبيه', 'نحتاج صلاحية الوصول لمعرض الصور');
      return;
    }

    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.1, 
      base64: true,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      setTargetState(`data:image/jpeg;base64,${result.assets[0].base64}`);
    }
  };

  const takePhotoWithCamera = async (setTargetState: React.Dispatch<React.SetStateAction<string>>) => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('تنبيه', 'نحتاج صلاحية الكاميرا لالتقاط الصورة');
      return;
    }

    let result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.1, 
      base64: true,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      setTargetState(`data:image/jpeg;base64,${result.assets[0].base64}`);
    }
  };

  const submitUpdateRequest = async () => {
    if (!editName.trim()) {
      Alert.alert('تنبيه', 'برجاء إدخال الاسم');
      return;
    }

    let vehicleStr = '';
    let detailsObj = {};

    if (vehicleCategory === 'car') {
      if (!carBrand || !carModelName || !carYear || !carColor || !carPlate) {
        Alert.alert('تنبيه', 'برجاء إدخال جميع بيانات السيارة (الماركة، الطراز، سنة الصنع، اللون، اللوحة)');
        return;
      }
      vehicleStr = `سيارة ${carBrand} ${carModelName} - ${carYear} - ${carColor} - ${carPlate}`;
      detailsObj = { brand: carBrand, modelName: carModelName, year: carYear, color: carColor, plate: carPlate };
    } else if (vehicleCategory === 'tuktuk_alt') {
      if (!tuktukImage) {
        Alert.alert('تنبيه', 'برجاء إرفاق صورة للمركبة');
        return;
      }
      vehicleStr = tuktukNumber ? `بديل توكتوك - ${tuktukNumber}` : `بديل توكتوك`;
      detailsObj = { image: tuktukImage, number: tuktukNumber };
    } else if (vehicleCategory === 'scooter') {
      if (!scooterImage || !scooterPlate) {
        Alert.alert('تنبيه', 'برجاء إرفاق صورة السكوتر ورقم اللوحة');
        return;
      }
      vehicleStr = `سكوتر - ${scooterPlate}`;
      detailsObj = { image: scooterImage, plate: scooterPlate };
    }

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'update_requests'), {
        type: 'captain_profile_update',
        captainId: captainId,
        captainPhone: phone,
        oldData: {
          name: originalData.name,
          vehicle: originalData.vehicle || originalData.tukTukNumber,
          vehicleCategory: originalData.vehicleCategory || 'tuktuk_alt',
          avatar: originalData.profileImage || originalData.avatar || originalData.image,
        },
        newData: {
          name: editName.trim(),
          vehicle: vehicleStr,
          vehicleCategory: vehicleCategory,
          vehicleDetails: detailsObj,
          avatar: editAvatar,
        },
        status: 'pending',
        timestamp: new Date().getTime()
      });

      Alert.alert(
        'تم إرسال الطلب',
        'تم إرسال طلب التعديل للإدارة بنجاح. سيتم مراجعة الطلب وتحديث ملفك قريباً.',
        [{ text: 'حسناً', onPress: () => router.back() }]
      );
    } catch (error) {
      Alert.alert('خطأ', 'حدثت مشكلة أثناء إرسال طلب التعديل');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openPhoneEditModal = async () => {
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
      const q = query(collection(db, 'captains'), where('phone', '==', newPhone));
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        Alert.alert('تنبيه', 'هذا الرقم مسجل بحساب كابتن آخر بالفعل.');
        setIsProcessingPhone(false);
        return;
      }

      const otp = Math.floor(1000 + Math.random() * 9000).toString();
      setGeneratedOtp(otp);
      console.log(`Captain OTP Sent to ${newPhone}: ${otp}`); 
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
      await updateDoc(doc(db, 'captains', captainId), { phone: newPhone });
      setPhone(newPhone);
      Alert.alert('نجاح', 'تم تغيير رقم الهاتف بنجاح ويمكنك تسجيل الدخول به لاحقاً.');
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
        <ActivityIndicator size="large" color="#10b981" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#f0fdf4' }}>
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backBtnText}>➔ رجوع</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>ملف الكابتن</Text>
          <View style={{ width: 60 }} />
        </View>

        {/* تم إضافة ستايل هنا لحل مشكلة السكرول وإعطائه عرض 100% */}
        <ScrollView 
          style={{ flex: 1, width: '100%' }}
          contentContainerStyle={styles.scrollContent} 
          keyboardShouldPersistTaps="handled" 
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.avatarContainer}>
            <Image source={{ uri: editAvatar }} style={styles.avatar} />
            <TouchableOpacity style={styles.editAvatarBtn} onPress={() => showImagePickerOptions(setEditAvatar)}>
              <Text style={styles.editAvatarIcon}>📷</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.statsContainer}>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>المحفظة</Text>
              <Text style={styles.statValue}>{walletBalance.toFixed(2)} ج</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>التقييم العام</Text>
              <Text style={[styles.statValue, { color: '#f59e0b' }]}>★ {rating}</Text>
            </View>
          </View>

          <View style={styles.formContainer}>
            <Text style={styles.label}>الاسم الرباعي</Text>
            <TextInput
              style={styles.input}
              value={editName}
              onChangeText={setEditName}
              placeholder="الاسم الرباعي"
              placeholderTextColor="#94a3b8"
              textAlign="right"
            />

            <Text style={styles.label}>نوع المركبة</Text>
            <View style={styles.vehicleTypeTabs}>
              <TouchableOpacity style={[styles.vTypeBtn, vehicleCategory === 'car' && styles.vTypeBtnActive]} onPress={() => setVehicleCategory('car')}>
                <Text style={[styles.vTypeText, vehicleCategory === 'car' && styles.vTypeTextActive]}>سيارة</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.vTypeBtn, vehicleCategory === 'tuktuk_alt' && styles.vTypeBtnActive]} onPress={() => setVehicleCategory('tuktuk_alt')}>
                <Text style={[styles.vTypeText, vehicleCategory === 'tuktuk_alt' && styles.vTypeTextActive]}>بديل توكتوك</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.vTypeBtn, vehicleCategory === 'scooter' && styles.vTypeBtnActive]} onPress={() => setVehicleCategory('scooter')}>
                <Text style={[styles.vTypeText, vehicleCategory === 'scooter' && styles.vTypeTextActive]}>سكوتر</Text>
              </TouchableOpacity>
            </View>

            {vehicleCategory === 'car' && (
              <View style={styles.dynamicFieldsContainer}>
                <View style={styles.rowInputs}>
                  <View style={styles.halfInput}>
                    <Text style={styles.label}>الطراز (مثال: فيرنا)</Text>
                    <TextInput style={styles.input} value={carModelName} onChangeText={setCarModelName} placeholder="فيرنا" placeholderTextColor="#94a3b8" textAlign="right" />
                  </View>
                  <View style={styles.halfInput}>
                    <Text style={styles.label}>الماركة (مثال: هيونداي)</Text>
                    <TextInput style={styles.input} value={carBrand} onChangeText={setCarBrand} placeholder="هيونداي" placeholderTextColor="#94a3b8" textAlign="right" />
                  </View>
                </View>
                <View style={styles.rowInputs}>
                  <View style={styles.halfInput}>
                    <Text style={styles.label}>اللون</Text>
                    <TextInput style={styles.input} value={carColor} onChangeText={setCarColor} placeholder="فضي" placeholderTextColor="#94a3b8" textAlign="right" />
                  </View>
                  <View style={styles.halfInput}>
                    <Text style={styles.label}>سنة الصنع</Text>
                    <TextInput style={styles.input} value={carYear} onChangeText={setCarYear} placeholder="2022" placeholderTextColor="#94a3b8" textAlign="right" keyboardType="numeric" />
                  </View>
                </View>
                <View style={{ width: '100%' }}>
                  <Text style={styles.label}>رقم اللوحة</Text>
                  <TextInput style={styles.input} value={carPlate} onChangeText={setCarPlate} placeholder="أ ب ج 123" placeholderTextColor="#94a3b8" textAlign="right" />
                </View>
              </View>
            )}

            {vehicleCategory === 'tuktuk_alt' && (
              <View style={styles.dynamicFieldsContainer}>
                <Text style={styles.label}>صورة المركبة (إلزامي)</Text>
                <TouchableOpacity style={styles.imageUploadBtn} onPress={() => showImagePickerOptions(setTuktukImage)}>
                  {tuktukImage ? <Image source={{ uri: tuktukImage }} style={styles.uploadedImg} /> : <Text style={styles.uploadText}>+ اضغط للالتقاط أو المعرض</Text>}
                </TouchableOpacity>
                <Text style={styles.label}>رقم المركبة (إن وجد)</Text>
                <TextInput style={styles.input} value={tuktukNumber} onChangeText={setTuktukNumber} placeholder="مثال: 12345" placeholderTextColor="#94a3b8" textAlign="right" />
              </View>
            )}

            {vehicleCategory === 'scooter' && (
              <View style={styles.dynamicFieldsContainer}>
                <Text style={styles.label}>صورة السكوتر (إلزامي)</Text>
                <TouchableOpacity style={styles.imageUploadBtn} onPress={() => showImagePickerOptions(setScooterImage)}>
                  {scooterImage ? <Image source={{ uri: scooterImage }} style={styles.uploadedImg} /> : <Text style={styles.uploadText}>+ اضغط للالتقاط أو المعرض</Text>}
                </TouchableOpacity>
                <Text style={styles.label}>رقم اللوحة (إلزامي)</Text>
                <TextInput style={styles.input} value={scooterPlate} onChangeText={setScooterPlate} placeholder="مثال: س ع 123" placeholderTextColor="#94a3b8" textAlign="right" />
              </View>
            )}

            <View style={styles.phoneLabelRow}>
              <TouchableOpacity onPress={openPhoneEditModal}>
                <Text style={styles.editPhoneText}>تعديل الرقم</Text>
              </TouchableOpacity>
              <Text style={styles.label}>رقم الهاتف الأساسي</Text>
            </View>
            <TextInput
              style={[styles.input, styles.disabledInput]}
              value={phone}
              editable={false}
              textAlign="right"
            />
            <Text style={styles.hintText}>* يجب تأكيد ملكية الرقم الجديد بـ OTP لتغييره.</Text>

            <TouchableOpacity style={styles.submitBtn} onPress={submitUpdateRequest} disabled={isSubmitting}>
              {isSubmitting ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.submitBtnText}>إرسال طلب تعديل للإدارة</Text>
              )}
            </TouchableOpacity>
            <Text style={styles.infoText}>أي تعديل في (الاسم، الصورة، أو بيانات المركبة) يتطلب مراجعة وموافقة الإدارة لضمان أمان الركاب.</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f0fdf4' },
  header: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#ffffff', padding: 15, paddingTop: 50, borderBottomWidth: 1, borderColor: '#d1fae5', elevation: 2 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#064e3b' },
  backBtn: { paddingVertical: 8, paddingHorizontal: 12, backgroundColor: '#ecfdf5', borderRadius: 8 },
  backBtnText: { color: '#059669', fontWeight: 'bold', fontSize: 14 },
  
  // تم تعديل التنسيقات هنا لضمان امتداد السكرول بكامل الشاشة
  scrollContent: { flexGrow: 1, padding: 20 },
  
  avatarContainer: { alignSelf: 'center', position: 'relative', marginBottom: 20, marginTop: 10 },
  avatar: { width: 130, height: 130, borderRadius: 65, borderWidth: 4, borderColor: '#10b981', backgroundColor: '#e2e8f0' },
  editAvatarBtn: { position: 'absolute', bottom: 0, right: 5, backgroundColor: '#f59e0b', width: 42, height: 42, borderRadius: 21, justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: '#ffffff', elevation: 4 },
  editAvatarIcon: { fontSize: 18, color: '#ffffff' },
  
  statsContainer: { flexDirection: 'row-reverse', backgroundColor: '#ffffff', width: '100%', padding: 15, borderRadius: 16, elevation: 2, marginBottom: 20, borderWidth: 1, borderColor: '#d1fae5' },
  statBox: { flex: 1, alignItems: 'center' },
  statLabel: { fontSize: 13, color: '#64748b', fontWeight: 'bold', marginBottom: 5 },
  statValue: { fontSize: 18, fontWeight: 'bold', color: '#10b981' },
  statDivider: { width: 1, backgroundColor: '#e2e8f0', marginHorizontal: 10 },
  
  formContainer: { width: '100%', backgroundColor: '#ffffff', padding: 20, borderRadius: 16, elevation: 2, borderWidth: 1, borderColor: '#f1f5f9' },
  label: { fontSize: 14, fontWeight: 'bold', color: '#475569', marginBottom: 8, textAlign: 'right' },
  
  vehicleTypeTabs: { flexDirection: 'row-reverse', justifyContent: 'center', gap: 10, marginBottom: 15 },
  vTypeBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 10, backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#cbd5e1' },
  vTypeBtnActive: { backgroundColor: '#ecfdf5', borderColor: '#10b981', borderWidth: 2 },
  vTypeText: { fontSize: 13, fontWeight: 'bold', color: '#64748b' },
  vTypeTextActive: { color: '#059669' },
  
  dynamicFieldsContainer: { width: '100%', marginBottom: 10 },
  rowInputs: { flexDirection: 'row-reverse', justifyContent: 'space-between', gap: 10 },
  halfInput: { flex: 1 },
  
  imageUploadBtn: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 12, height: 130, justifyContent: 'center', alignItems: 'center', marginBottom: 15, borderStyle: 'dashed', overflow: 'hidden' },
  uploadText: { color: '#94a3b8', fontWeight: 'bold', fontSize: 14 },
  uploadedImg: { width: '100%', height: '100%', resizeMode: 'cover' },
  
  phoneLabelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  editPhoneText: { color: '#10b981', fontSize: 13, fontWeight: 'bold' },

  input: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 12, padding: 14, fontSize: 15, color: '#0f172a', marginBottom: 15, fontWeight: 'bold' },
  disabledInput: { backgroundColor: '#e2e8f0', color: '#64748b' },
  hintText: { fontSize: 11, color: '#f59e0b', textAlign: 'right', marginTop: -10, marginBottom: 20 },
  infoText: { fontSize: 11, color: '#64748b', textAlign: 'center', marginTop: 15, lineHeight: 18 },
  
  submitBtn: { backgroundColor: '#10b981', paddingVertical: 15, borderRadius: 12, alignItems: 'center', elevation: 3, marginTop: 5 },
  submitBtnText: { color: '#ffffff', fontSize: 16, fontWeight: 'bold' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { backgroundColor: '#ffffff', width: '100%', padding: 25, borderRadius: 20, elevation: 5 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#1e293b', marginBottom: 10, textAlign: 'center' },
  modalSubtitle: { fontSize: 13, color: '#64748b', textAlign: 'center', marginBottom: 20, lineHeight: 20 },
  modalInput: { backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 12, padding: 15, fontSize: 18, fontWeight: 'bold', color: '#0f172a', marginBottom: 20, letterSpacing: 1 },
  modalButtonsRow: { flexDirection: 'row-reverse', gap: 10 },
  modalPrimaryBtn: { flex: 2, backgroundColor: '#10b981', paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  modalBtnText: { color: '#ffffff', fontWeight: 'bold', fontSize: 15 },
  modalCancelBtn: { flex: 1, backgroundColor: '#fee2e2', paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  modalCancelText: { color: '#ef4444', fontWeight: 'bold', fontSize: 15 }
});