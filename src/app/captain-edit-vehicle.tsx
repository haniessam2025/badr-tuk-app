import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { db } from '../firebaseConfig';

const YEARS = Array.from({ length: 28 }, (_, i) => (2000 + i).toString()).reverse();
const CAR_BRANDS = ['كيا', 'هيونداي', 'بي واي دي', 'نيسان', 'شيفروليه', 'تويوتا', 'رينو', 'بيجو', 'سكودا', 'ام جي', 'شيري', 'لادا', 'سوزوكي', 'فيات', 'أخرى'];
const CAR_MODELS = ['سيراتو', 'النترا', 'اف 3', 'صني', 'أوبترا', 'أفيو', 'لانسير', 'كورولا', 'لوجان', 'تيبو', 'أريزو', 'تيجو', 'لانوس', 'فيرنا', 'أخرى'];

export default function CaptainEditVehicle() {
  const router = useRouter();
  const [captainId, setCaptainId] = useState('');
  
  // تمت إضافة scooter هنا
  const [vehicleCategory, setVehicleCategory] = useState<'car' | 'tuktuk_alt' | 'scooter'>('tuktuk_alt');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [carBrand, setCarBrand] = useState('');
  const [carModel, setCarModel] = useState('');
  const [carYear, setCarYear] = useState('');
  const [carColor, setCarColor] = useState('');
  const [carPlate, setCarPlate] = useState('');
  
  const [tuktukNumber, setTuktukNumber] = useState(''); // نستخدمه لرقم بديل التوكتوك والسكوتر
  const [scooterModel, setScooterModel] = useState(''); // موديل السكوتر

  const [images, setImages] = useState<any>({
    carLicenseFront: null, 
    carLicenseBack: null, 
    drivingLicenseFront: null, 
    drivingLicenseBack: null, 
    carFrontImage: null, 
    tuktukImage: null,
    scooterImage: null // تمت إضافة صورة السكوتر
  });

  const [isDropdownVisible, setIsDropdownVisible] = useState(false);
  const [dropdownData, setDropdownData] = useState<string[]>([]);
  const [dropdownTarget, setDropdownTarget] = useState<'carBrand' | 'carModel' | 'carYear' | null>(null);
  const [dropdownTitle, setDropdownTitle] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const id = await AsyncStorage.getItem('currentCaptainId');
      if (!id) return;
      setCaptainId(id);
      const docSnap = await getDoc(doc(db, 'captains', id));
      if (docSnap.exists()) {
        const data = docSnap.data();
        setVehicleCategory(data.vehicleCategory || 'tuktuk_alt');
        
        if (data.vehicleCategory === 'car') {
          setCarBrand(data.carBrand || ''); setCarModel(data.carModel || ''); setCarYear(data.carYear || '');
          setCarColor(data.carColor || ''); setCarPlate(data.carPlate || '');
          setImages((prev: any) => ({ ...prev, carLicenseFront: data.carLicenseFront, carLicenseBack: data.carLicenseBack, drivingLicenseFront: data.drivingLicenseFront, drivingLicenseBack: data.drivingLicenseBack, carFrontImage: data.vehicleImage }));
        } else if (data.vehicleCategory === 'scooter') {
          setScooterModel(data.vehicle ? data.vehicle.replace('سكوتر ', '') : '');
          setTuktukNumber(data.tuktukNumber || '');
          setImages((prev: any) => ({ ...prev, scooterImage: data.vehicleImage }));
        } else {
          setTuktukNumber(data.tuktukNumber || '');
          setImages((prev: any) => ({ ...prev, tuktukImage: data.vehicleImage }));
        }
      }
    } catch (e) {} finally { setIsLoading(false); }
  };

  const openDropdown = (target: 'carBrand' | 'carModel' | 'carYear', title: string, data: string[]) => {
    setDropdownTarget(target); setDropdownTitle(title); setDropdownData(data); setIsDropdownVisible(true);
  };

  const selectDropdownItem = (item: string) => {
    if (dropdownTarget === 'carBrand') setCarBrand(item);
    if (dropdownTarget === 'carModel') setCarModel(item);
    if (dropdownTarget === 'carYear') setCarYear(item);
    setIsDropdownVisible(false);
  };

  const pickImage = async (field: string) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;
    let result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, quality: 0.2, base64: true });
    if (!result.canceled && result.assets) {
      setImages((prev: any) => ({ ...prev, [field]: `data:image/jpeg;base64,${result.assets[0].base64}` }));
    }
  };

  const renderImageBox = (title: string, field: string) => (
    <TouchableOpacity style={styles.imageBoxContainer} onPress={() => pickImage(field)}>
      {images[field] ? <Image source={{ uri: images[field] }} style={styles.boxImage} /> : (
        <View style={styles.boxPlaceholder}><Text style={styles.boxIcon}>📷</Text><Text style={styles.boxText}>{title}</Text></View>
      )}
    </TouchableOpacity>
  );

  const saveUpdates = async () => {
    if (vehicleCategory === 'car') {
      if (!carBrand || !carModel || !carYear || !carColor || !carPlate) { Alert.alert('تنبيه', 'يرجى إكمال بيانات السيارة.'); return; }
      if (!images.carLicenseFront || !images.carLicenseBack || !images.drivingLicenseFront || !images.drivingLicenseBack || !images.carFrontImage) { 
        Alert.alert('تنبيه', 'يرجى إرفاق جميع الرخص وصورة السيارة.'); return; 
      }
    } else if (vehicleCategory === 'scooter') {
      if (!scooterModel) { Alert.alert('تنبيه', 'يرجى إدخال موديل السكوتر.'); return; }
      if (!images.scooterImage) { Alert.alert('تنبيه', 'يرجى إرفاق صورة السكوتر.'); return; }
    } else {
      if (!images.tuktukImage) { Alert.alert('تنبيه', 'يرجى إرفاق صورة بديل التوكتوك.'); return; }
    }

    setIsSaving(true);
    try {
      const updateData: any = { vehicleCategory };
      if (vehicleCategory === 'car') {
        updateData.carBrand = carBrand; updateData.carModel = carModel; updateData.carYear = carYear;
        updateData.carColor = carColor; updateData.carPlate = carPlate;
        updateData.carLicenseFront = images.carLicenseFront; updateData.carLicenseBack = images.carLicenseBack;
        updateData.drivingLicenseFront = images.drivingLicenseFront; updateData.drivingLicenseBack = images.drivingLicenseBack;
        updateData.vehicleImage = images.carFrontImage;
        updateData.vehicle = `${carBrand} ${carModel}`;
      } else if (vehicleCategory === 'scooter') {
        updateData.tuktukNumber = tuktukNumber;
        updateData.vehicleImage = images.scooterImage;
        updateData.vehicle = `سكوتر ${scooterModel}`;
      } else {
        updateData.tuktukNumber = tuktukNumber;
        updateData.vehicleImage = images.tuktukImage;
        updateData.vehicle = 'بديل توكتوك';
      }

      await updateDoc(doc(db, 'captains', captainId), updateData);
      Alert.alert('تم ✅', 'تم تحديث بيانات بساطك بنجاح.', [{ text: 'حسناً', onPress: () => router.back() }]);
    } catch (e) { Alert.alert('خطأ', 'حدثت مشكلة أثناء الحفظ.'); } finally { setIsSaving(false); }
  };

  if (isLoading) return <View style={{flex: 1, justifyContent: 'center', alignItems: 'center'}}><ActivityIndicator size="large" color="#2563eb" /></View>;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}><Text style={styles.backBtnText}>رجوع ⬅️</Text></TouchableOpacity>
          <Text style={styles.headerTitle}>تعديل بساطك 🪄</Text>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" removeClippedSubviews={Platform.OS === 'android'}>
          <View style={styles.sectionContainer}>
            <View style={styles.vehicleTypeTabs}>
              <TouchableOpacity style={[styles.vTypeBtn, vehicleCategory === 'car' && styles.vTypeBtnActive]} onPress={() => setVehicleCategory('car')}>
                <Text style={[styles.vTypeText, vehicleCategory === 'car' && styles.vTypeTextActive]}>🚗 سيارة</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.vTypeBtn, vehicleCategory === 'tuktuk_alt' && styles.vTypeBtnActive]} onPress={() => setVehicleCategory('tuktuk_alt')}>
                <Text style={[styles.vTypeText, vehicleCategory === 'tuktuk_alt' && styles.vTypeTextActive]}>🛺 بديل توكتوك</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.vTypeBtn, vehicleCategory === 'scooter' && styles.vTypeBtnActive]} onPress={() => setVehicleCategory('scooter')}>
                <Text style={[styles.vTypeText, vehicleCategory === 'scooter' && styles.vTypeTextActive]}>🛵 سكوتر</Text>
              </TouchableOpacity>
            </View>

            {vehicleCategory === 'car' && (
              <View>
                <Text style={styles.label}>ماركة السيارة</Text>
                <TouchableOpacity style={styles.dropdownTrigger} onPress={() => openDropdown('carBrand', 'اختر ماركة السيارة', CAR_BRANDS)}><Text style={styles.dropdownText}>{carBrand || 'اضغط للاختيار 🔽'}</Text></TouchableOpacity>
                <Text style={styles.label}>نوع السيارة</Text>
                <TouchableOpacity style={styles.dropdownTrigger} onPress={() => openDropdown('carModel', 'اختر نوع السيارة', CAR_MODELS)}><Text style={styles.dropdownText}>{carModel || 'اضغط للاختيار 🔽'}</Text></TouchableOpacity>
                <Text style={styles.label}>موديل السنة</Text>
                <TouchableOpacity style={styles.dropdownTrigger} onPress={() => openDropdown('carYear', 'اختر سنة الموديل', YEARS)}><Text style={styles.dropdownText}>{carYear || 'اضغط للاختيار 🔽'}</Text></TouchableOpacity>
                <Text style={styles.label}>لون السيارة</Text>
                <TextInput style={styles.input} placeholder="مثال: فضي، أسود" value={carColor} onChangeText={setCarColor} textAlign="right" />
                <Text style={styles.label}>رقم اللوحة</Text>
                <TextInput style={styles.input} placeholder="مثال: أ ب ج 123" value={carPlate} onChangeText={setCarPlate} textAlign="right" />

                <Text style={styles.sectionSubtitle}>صور رخصة القيادة</Text>
                <View style={styles.imagesRow}>{renderImageBox("الرخصة (أمام)", "drivingLicenseFront")}{renderImageBox("الرخصة (خلف)", "drivingLicenseBack")}</View>

                <Text style={styles.sectionSubtitle}>صور رخصة السيارة</Text>
                <View style={styles.imagesRow}>{renderImageBox("الرخصة (أمام)", "carLicenseFront")}{renderImageBox("الرخصة (خلف)", "carLicenseBack")}</View>

                <Text style={styles.sectionSubtitle}>صورة السيارة الأمامية</Text>
                {renderImageBox("صورة للسيارة شاملة اللوحة", "carFrontImage")}
              </View>
            )}

            {vehicleCategory === 'tuktuk_alt' && (
              <View>
                <Text style={styles.label}>رقم المركبة (إن وجد)</Text>
                <TextInput style={styles.input} placeholder="أدخل الرقم أو اتركها فارغة" value={tuktukNumber} onChangeText={setTuktukNumber} textAlign="right" />
                <Text style={styles.sectionSubtitle}>صورة المركبة</Text>
                {renderImageBox("إرفاق صورة للمركبة", "tuktukImage")}
              </View>
            )}

            {vehicleCategory === 'scooter' && (
              <View>
                <Text style={styles.label}>موديل السكوتر</Text>
                <TextInput style={styles.input} placeholder="مثال: كيمكو، SYM" value={scooterModel} onChangeText={setScooterModel} textAlign="right" />

                <Text style={styles.label}>رقم اللوحة (إن وجد)</Text>
                <TextInput style={styles.input} placeholder="أدخل الرقم أو اتركها فارغة" value={tuktukNumber} onChangeText={setTuktukNumber} textAlign="right" />
                
                <Text style={styles.sectionSubtitle}>صورة السكوتر</Text>
                {renderImageBox("إرفاق صورة للسكوتر", "scooterImage")}
              </View>
            )}

            <TouchableOpacity style={styles.submitBtn} onPress={saveUpdates} disabled={isSaving}>
              {isSaving ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>حفظ التعديلات ✅</Text>}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>

      <Modal visible={isDropdownVisible} transparent={true} animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{dropdownTitle}</Text>
            <FlatList data={dropdownData} keyExtractor={(item, index) => index.toString()} renderItem={({item}) => (
              <TouchableOpacity style={styles.modalItem} onPress={() => selectDropdownItem(item)}><Text style={styles.modalItemText}>{item}</Text></TouchableOpacity>
            )} />
            <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setIsDropdownVisible(false)}><Text style={styles.modalCancelText}>إلغاء</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc', paddingTop: 45 },
  header: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingHorizontal: 15 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#1e293b' },
  backBtn: { backgroundColor: '#e2e8f0', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8 },
  backBtnText: { color: '#334155', fontWeight: 'bold' },
  scrollContent: { paddingHorizontal: 15, paddingBottom: 40 },
  sectionContainer: { backgroundColor: '#ffffff', padding: 20, borderRadius: 16, elevation: 2 },
  label: { fontSize: 15, fontWeight: 'bold', color: '#475569', textAlign: 'right', marginBottom: 8, marginTop: 15 },
  input: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, padding: 12, fontSize: 15, color: '#0f172a' },
  dropdownTrigger: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, padding: 14, alignItems: 'flex-end' },
  dropdownText: { fontSize: 15, color: '#0f172a', fontWeight: 'bold' },
  sectionSubtitle: { fontSize: 16, fontWeight: 'bold', color: '#1e293b', textAlign: 'center', marginTop: 25, marginBottom: 15, borderTopWidth: 1, borderColor: '#f1f5f9', paddingTop: 15 },
  imagesRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', gap: 10 },
  imageBoxContainer: { flex: 1, height: 120, backgroundColor: '#f8fafc', borderRadius: 12, borderWidth: 1, borderColor: '#cbd5e1', borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  boxImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  boxPlaceholder: { alignItems: 'center' },
  boxIcon: { fontSize: 24, marginBottom: 5 },
  boxText: { fontSize: 12, color: '#64748b', fontWeight: 'bold', textAlign: 'center', paddingHorizontal: 5 },
  submitBtn: { backgroundColor: '#2563eb', paddingVertical: 15, borderRadius: 12, alignItems: 'center', marginTop: 30, elevation: 3 },
  submitBtnText: { color: '#ffffff', fontSize: 18, fontWeight: 'bold' },
  
  // تحديث التبويبات لتشمل السكوتر بشكل أفضل
  vehicleTypeTabs: { flexDirection: 'row-reverse', justifyContent: 'center', gap: 10, marginBottom: 20 },
  vTypeBtn: { flex: 1, paddingVertical: 15, alignItems: 'center', borderRadius: 12, backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#cbd5e1' },
  vTypeBtnActive: { backgroundColor: '#eff6ff', borderColor: '#3b82f6', borderWidth: 2 },
  vTypeText: { fontSize: 14, fontWeight: 'bold', color: '#64748b' },
  vTypeTextActive: { color: '#2563eb' },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '60%' },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#1e293b', textAlign: 'center', marginBottom: 15 },
  modalItem: { paddingVertical: 15, borderBottomWidth: 1, borderColor: '#f1f5f9', alignItems: 'center' },
  modalItemText: { fontSize: 16, color: '#334155', fontWeight: 'bold' },
  modalCancelBtn: { marginTop: 15, paddingVertical: 15, backgroundColor: '#fee2e2', borderRadius: 12, alignItems: 'center' },
  modalCancelText: { color: '#ef4444', fontSize: 16, fontWeight: 'bold' },
});