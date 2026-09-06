import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { addDoc, collection, getDocs, query, serverTimestamp, where } from 'firebase/firestore';
import { useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { db } from '../firebaseConfig';

// --- بيانات القوائم المنسدلة ---
const YEARS = Array.from({ length: 28 }, (_, i) => (2000 + i).toString()).reverse();
const CAR_BRANDS = ['كيا', 'هيونداي', 'بي واي دي', 'نيسان', 'شيفروليه', 'تويوتا', 'رينو', 'بيجو', 'سكودا', 'ام جي', 'شيري', 'لادا', 'سوزوكي', 'فيات', 'أخرى'];
const CAR_MODELS = ['سيراتو', 'النترا', 'اف 3', 'صني', 'أوبترا', 'أفيو', 'لانسير', 'كورولا', 'لوجان', 'تيبو', 'أريزو', 'تيجو', 'لانوس', 'فيرنا', 'أخرى'];

export default function CaptainRegister() {
  const router = useRouter();
  
  // --- حالة التبويبات ---
  const [activeTab, setActiveTab] = useState<'basic' | 'vehicle'>('basic');
  const [vehicleCategory, setVehicleCategory] = useState<'car' | 'tuktuk_alt'>('car');

  // --- البيانات الأساسية ---
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // --- بيانات المركبة (سيارة) ---
  const [carBrand, setCarBrand] = useState('');
  const [carModel, setCarModel] = useState('');
  const [carYear, setCarYear] = useState('');
  const [carColor, setCarColor] = useState('');
  const [carPlate, setCarPlate] = useState('');

  // --- بيانات المركبة (بديل التوكتوك) ---
  const [tuktukNumber, setTuktukNumber] = useState('');

  // --- الصور ---
  const [images, setImages] = useState<any>({
    profile: null,
    idFront: null,
    idBack: null,
    carLicenseFront: null,
    carLicenseBack: null,
    drivingLicenseFront: null,
    drivingLicenseBack: null,
    carFrontImage: null,
    tuktukImage: null,
  });

  const [isLoading, setIsLoading] = useState(false);

  // --- متغيرات القائمة المنسدلة (Dropdown Modal) ---
  const [isDropdownVisible, setIsDropdownVisible] = useState(false);
  const [dropdownData, setDropdownData] = useState<string[]>([]);
  const [dropdownTarget, setDropdownTarget] = useState<'carBrand' | 'carModel' | 'carYear' | null>(null);
  const [dropdownTitle, setDropdownTitle] = useState('');

  const openDropdown = (target: 'carBrand' | 'carModel' | 'carYear', title: string, data: string[]) => {
    setDropdownTarget(target);
    setDropdownTitle(title);
    setDropdownData(data);
    setIsDropdownVisible(true);
  };

  const selectDropdownItem = (item: string) => {
    if (dropdownTarget === 'carBrand') setCarBrand(item);
    if (dropdownTarget === 'carModel') setCarModel(item);
    if (dropdownTarget === 'carYear') setCarYear(item);
    setIsDropdownVisible(false);
  };

  // --- دالة اختيار الصور (مع تقليل الجودة لتسريع الواجهة) ---
  const pickImage = async (field: string) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('تنبيه', 'نحتاج صلاحية المعرض لاختيار الصورة.');
      return;
    }
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.2, // تم تقليل الجودة لـ 0.2 لتخفيف الحمل على الذاكرة وتسريع التمرير
      base64: true,
    });
    if (!result.canceled && result.assets && result.assets.length > 0) {
      setImages((prev: any) => ({ ...prev, [field]: `data:image/jpeg;base64,${result.assets[0].base64}` }));
    }
  };

  // --- تحويل ImageBox لدالة عادية لمنع إعادة بناء المكونات الثقيلة (إصلاح ثقل الشاشة) ---
  const renderImageBox = (title: string, field: string, isAvatar = false) => (
    <TouchableOpacity style={isAvatar ? styles.avatarContainer : styles.imageBoxContainer} onPress={() => pickImage(field)}>
      {images[field] ? (
        <Image source={{ uri: images[field] }} style={isAvatar ? styles.avatarImage : styles.boxImage} />
      ) : (
        <View style={isAvatar ? styles.avatarPlaceholder : styles.boxPlaceholder}>
          <Text style={styles.boxIcon}>{isAvatar ? '👤' : '📷'}</Text>
          <Text style={styles.boxText}>{title}</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  // --- دالة التسجيل الأساسية ---
  const handleRegister = async () => {
    if (!name || !phone || !password || !confirmPassword) { Alert.alert('تنبيه', 'يرجى إكمال جميع البيانات الأساسية.'); return; }
    if (password !== confirmPassword) { Alert.alert('تنبيه', 'كلمتا المرور غير متطابقتين.'); return; }
    if (!images.profile || !images.idFront || !images.idBack) { Alert.alert('تنبيه', 'يرجى إرفاق الصورة الشخصية وصور البطاقة.'); return; }

    if (vehicleCategory === 'car') {
      if (!carBrand || !carModel || !carYear || !carColor || !carPlate) { Alert.alert('تنبيه', 'يرجى إكمال بيانات السيارة.'); return; }
      if (!images.carLicenseFront || !images.carLicenseBack || !images.drivingLicenseFront || !images.drivingLicenseBack || !images.carFrontImage) { 
        Alert.alert('تنبيه', 'يرجى إرفاق جميع صور رخص السيارة والقيادة وصورة السيارة.'); return; 
      }
    } else {
      if (!images.tuktukImage) { Alert.alert('تنبيه', 'يرجى إرفاق صورة بديل التوكتوك.'); return; }
    }

    setIsLoading(true);
    try {
      const q = query(collection(db, 'captains'), where('phone', '==', phone));
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) { Alert.alert('تنبيه', 'رقم الهاتف مسجل بالفعل.'); setIsLoading(false); return; }

      const captainData: any = {
        name, phone, password,
        avatar: images.profile,
        idFront: images.idFront,
        idBack: images.idBack,
        vehicleCategory,
        walletBalance: 0,
        isOnline: false,
        status: 'pending',
        timestamp: serverTimestamp()
      };

      if (vehicleCategory === 'car') {
        captainData.carBrand = carBrand; captainData.carModel = carModel; captainData.carYear = carYear;
        captainData.carColor = carColor; captainData.carPlate = carPlate;
        captainData.carLicenseFront = images.carLicenseFront; captainData.carLicenseBack = images.carLicenseBack;
        captainData.drivingLicenseFront = images.drivingLicenseFront; captainData.drivingLicenseBack = images.drivingLicenseBack;
        captainData.vehicleImage = images.carFrontImage; 
        captainData.vehicle = `${carBrand} ${carModel}`;
      } else {
        captainData.tuktukNumber = tuktukNumber;
        captainData.vehicleImage = images.tuktukImage;
        captainData.vehicle = 'بديل توكتوك';
      }

      await addDoc(collection(db, 'captains'), captainData);
      Alert.alert('نجاح ✅', 'تم تسجيل طلبك بنجاح. سيتم مراجعة بياناتك وتفعيل حسابك قريباً.', [
        { text: 'حسناً', onPress: () => router.replace('/captain-login') }
      ]);
    } catch (error) {
      Alert.alert('خطأ', 'حدثت مشكلة أثناء التسجيل.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.container}>
        <Text style={styles.mainTitle}>تسجيل كابتن جديد 🛺</Text>

        <View style={styles.tabsContainer}>
          <TouchableOpacity style={[styles.tabBtn, activeTab === 'basic' && styles.tabBtnActive]} onPress={() => setActiveTab('basic')}>
            <Text style={[styles.tabText, activeTab === 'basic' && styles.tabTextActive]}>البيانات الأساسية</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tabBtn, activeTab === 'vehicle' && styles.tabBtnActive]} onPress={() => setActiveTab('vehicle')}>
            <Text style={[styles.tabText, activeTab === 'vehicle' && styles.tabTextActive]}>بيانات المركبة</Text>
          </TouchableOpacity>
        </View>

        {/* تم إضافة keyboardShouldPersistTaps و removeClippedSubviews لتحسين الأداء */}
        <ScrollView 
          showsVerticalScrollIndicator={false} 
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          removeClippedSubviews={Platform.OS === 'android'}
        >
          
          {/* ================= التبويب الأول: البيانات الأساسية ================= */}
          {activeTab === 'basic' && (
            <View style={styles.sectionContainer}>
              <View style={styles.avatarWrapper}>
                {renderImageBox("إضافة صورتك", "profile", true)}
              </View>

              <Text style={styles.label}>الاسم الرباعي</Text>
              <TextInput style={styles.input} placeholder="ادخل اسمك الكامل" value={name} onChangeText={setName} textAlign="right" />

              <Text style={styles.label}>رقم الهاتف</Text>
              <TextInput style={styles.input} placeholder="ادخل رقم الهاتف" value={phone} onChangeText={setPhone} keyboardType="phone-pad" textAlign="right" />

              <Text style={styles.label}>كلمة المرور</Text>
              <TextInput style={styles.input} placeholder="اكتب كلمة مرور قوية" value={password} onChangeText={setPassword} secureTextEntry textAlign="right" />

              <Text style={styles.label}>تأكيد كلمة المرور</Text>
              <TextInput style={styles.input} placeholder="أعد كتابة كلمة المرور" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry textAlign="right" />

              <Text style={styles.sectionSubtitle}>صور البطاقة الشخصية</Text>
              <View style={styles.imagesRow}>
                {renderImageBox("البطاقة (أمام)", "idFront")}
                {renderImageBox("البطاقة (خلف)", "idBack")}
              </View>

              <TouchableOpacity style={styles.nextBtn} onPress={() => setActiveTab('vehicle')}>
                <Text style={styles.nextBtnText}>التالي: بيانات المركبة ⬅️</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ================= التبويب الثاني: بيانات المركبة ================= */}
          {activeTab === 'vehicle' && (
            <View style={styles.sectionContainer}>
              
              <View style={styles.vehicleTypeTabs}>
                <TouchableOpacity style={[styles.vTypeBtn, vehicleCategory === 'car' && styles.vTypeBtnActive]} onPress={() => setVehicleCategory('car')}>
                  <Text style={[styles.vTypeText, vehicleCategory === 'car' && styles.vTypeTextActive]}>🚗 سيارة</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.vTypeBtn, vehicleCategory === 'tuktuk_alt' && styles.vTypeBtnActive]} onPress={() => setVehicleCategory('tuktuk_alt')}>
                  <Text style={[styles.vTypeText, vehicleCategory === 'tuktuk_alt' && styles.vTypeTextActive]}>🛺 بديل توكتوك</Text>
                </TouchableOpacity>
              </View>

              {vehicleCategory === 'car' && (
                <View>
                  <Text style={styles.label}>ماركة السيارة</Text>
                  <TouchableOpacity style={styles.dropdownTrigger} onPress={() => openDropdown('carBrand', 'اختر ماركة السيارة', CAR_BRANDS)}>
                    <Text style={styles.dropdownText}>{carBrand || 'اضغط للاختيار 🔽'}</Text>
                  </TouchableOpacity>

                  <Text style={styles.label}>نوع السيارة</Text>
                  <TouchableOpacity style={styles.dropdownTrigger} onPress={() => openDropdown('carModel', 'اختر نوع السيارة', CAR_MODELS)}>
                    <Text style={styles.dropdownText}>{carModel || 'اضغط للاختيار 🔽'}</Text>
                  </TouchableOpacity>

                  <Text style={styles.label}>موديل السنة</Text>
                  <TouchableOpacity style={styles.dropdownTrigger} onPress={() => openDropdown('carYear', 'اختر سنة الموديل', YEARS)}>
                    <Text style={styles.dropdownText}>{carYear || 'اضغط للاختيار 🔽'}</Text>
                  </TouchableOpacity>

                  <Text style={styles.label}>لون السيارة</Text>
                  <TextInput style={styles.input} placeholder="مثال: فضي، أسود" value={carColor} onChangeText={setCarColor} textAlign="right" />

                  <Text style={styles.label}>رقم اللوحة</Text>
                  <TextInput style={styles.input} placeholder="مثال: أ ب ج 123" value={carPlate} onChangeText={setCarPlate} textAlign="right" />

                  <Text style={styles.sectionSubtitle}>صور رخصة القيادة</Text>
                  <View style={styles.imagesRow}>
                    {renderImageBox("الرخصة (أمام)", "drivingLicenseFront")}
                    {renderImageBox("الرخصة (خلف)", "drivingLicenseBack")}
                  </View>

                  <Text style={styles.sectionSubtitle}>صور رخصة السيارة</Text>
                  <View style={styles.imagesRow}>
                    {renderImageBox("الرخصة (أمام)", "carLicenseFront")}
                    {renderImageBox("الرخصة (خلف)", "carLicenseBack")}
                  </View>

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

              <TouchableOpacity style={styles.submitBtn} onPress={handleRegister} disabled={isLoading}>
                {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>إرسال طلب التسجيل ✅</Text>}
              </TouchableOpacity>
              
            </View>
          )}

        </ScrollView>
      </View>

      <Modal visible={isDropdownVisible} transparent={true} animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{dropdownTitle}</Text>
            <FlatList 
              data={dropdownData}
              keyExtractor={(item, index) => index.toString()}
              renderItem={({item}) => (
                <TouchableOpacity style={styles.modalItem} onPress={() => selectDropdownItem(item)}>
                  <Text style={styles.modalItemText}>{item}</Text>
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setIsDropdownVisible(false)}>
              <Text style={styles.modalCancelText}>إلغاء</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc', paddingTop: 50 },
  mainTitle: { fontSize: 24, fontWeight: 'bold', color: '#1e293b', textAlign: 'center', marginBottom: 15 },
  
  tabsContainer: { flexDirection: 'row-reverse', marginHorizontal: 15, marginBottom: 15, backgroundColor: '#e2e8f0', borderRadius: 12, padding: 4 },
  tabBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 10 },
  tabBtnActive: { backgroundColor: '#ffffff', elevation: 2 },
  tabText: { fontSize: 16, fontWeight: 'bold', color: '#64748b' },
  tabTextActive: { color: '#2563eb' },

  scrollContent: { paddingHorizontal: 15, paddingBottom: 40 },
  sectionContainer: { backgroundColor: '#ffffff', padding: 20, borderRadius: 16, elevation: 2 },
  
  avatarWrapper: { alignItems: 'center', marginBottom: 20 },
  avatarContainer: { width: 120, height: 120, borderRadius: 60, backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#cbd5e1', borderStyle: 'dashed', overflow: 'hidden' },
  avatarImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  avatarPlaceholder: { alignItems: 'center' },
  
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

  nextBtn: { backgroundColor: '#64748b', paddingVertical: 15, borderRadius: 12, alignItems: 'center', marginTop: 30 },
  nextBtnText: { color: '#ffffff', fontSize: 16, fontWeight: 'bold' },
  
  submitBtn: { backgroundColor: '#2563eb', paddingVertical: 15, borderRadius: 12, alignItems: 'center', marginTop: 30, elevation: 3 },
  submitBtnText: { color: '#ffffff', fontSize: 18, fontWeight: 'bold' },

  vehicleTypeTabs: { flexDirection: 'row-reverse', justifyContent: 'center', gap: 15, marginBottom: 20 },
  vTypeBtn: { flex: 1, paddingVertical: 15, alignItems: 'center', borderRadius: 12, backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#cbd5e1' },
  vTypeBtnActive: { backgroundColor: '#eff6ff', borderColor: '#3b82f6', borderWidth: 2 },
  vTypeText: { fontSize: 16, fontWeight: 'bold', color: '#64748b' },
  vTypeTextActive: { color: '#2563eb' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '60%' },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#1e293b', textAlign: 'center', marginBottom: 15 },
  modalItem: { paddingVertical: 15, borderBottomWidth: 1, borderColor: '#f1f5f9', alignItems: 'center' },
  modalItemText: { fontSize: 16, color: '#334155', fontWeight: 'bold' },
  modalCancelBtn: { marginTop: 15, paddingVertical: 15, backgroundColor: '#fee2e2', borderRadius: 12, alignItems: 'center' },
  modalCancelText: { color: '#ef4444', fontSize: 16, fontWeight: 'bold' },
});