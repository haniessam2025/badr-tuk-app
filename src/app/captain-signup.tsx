import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { addDoc, collection, getDocs, query, serverTimestamp, where } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { db, storage } from '../firebase';

const YEARS = Array.from({ length: 28 }, (_, i) => (2000 + i).toString()).reverse();
const CAR_COLORS = ['أبيض', 'أسود', 'فضي', 'رمادي', 'أحمر', 'أزرق', 'كحلي', 'ذهبي / شامبين', 'أخضر', 'نبيتي', 'أخرى'];

const carData: Record<string, string[]> = {
  "تويوتا (Toyota)": ["كورولا", "ياريس", "بيلتا", "كامري", "فورتشنر", "أخرى"],
  "هيونداي (Hyundai)": ["فيرنا", "إلنترا (AD/HD/MD)", "توسان", "أكسنت", "ماتريكس", "i10", "كريتا", "أخرى"],
  "شيفروليه (Chevrolet)": ["أوبترا", "أفيو", "لانوس", "دبابة", "كروز", "كابتيفا", "إكوينوكس", "أخرى"],
  "بي واي دي (BYD)": ["F3", "L3", "S5", "F0", "أخرى"],
  "نيسان (Nissan)": ["صني", "سنترا", "قشقاي", "جوك", "باترول", "أخرى"],
  "كيا (Kia)": ["سيراتو", "سبورتاج", "بيكانتو", "ريو", "كارنز", "سول", "أخرى"],
  "شيري (Chery)": ["أريزو 5", "تيجو 3", "تيجو 7", "تيجو 8", "إنفي", "أخرى"],
  "إم جي (MG)": ["MG 5", "MG 6", "MG ZS", "MG RX5", "MG HS", "أخرى"],
  "رينو (Renault)": ["لوجان", "ميجان", "سانديرو", "ستيب واي", "داستر", "كادجار", "أخرى"],
  "لادا (Lada)": ["جرانتا", "سمارا", "2107", "أخرى"],
  "سوزوكي (Suzuki)": ["ديزاير", "سويفت", "ألتو", "ماروتي", "إرتيجا", "أخرى"],
  "فيات (Fiat)": ["تيبو", "بونتو", "شاهين", "128", "أخرى"],
  "سكودا (Skoda)": ["أوكتافيا", "سوبيرب", "كودياك", "كاروك", "أخرى"],
  "بيجو (Peugeot)": ["301", "508", "2008", "3008", "أخرى"],
  "أوبل (Opel)": ["أسترا", "كورسا", "جراند لاند", "أخرى"],
  "ميتسوبيشي (Mitsubishi)": ["لانسر (بوما/شارك)", "إكليبس", "إكسباندر", "أخرى"],
  "فولكس فاجن (Volkswagen)": ["باسات", "جولف", "تيجوان", "أخرى"],
  "ماركة أخرى (غير مسجلة)": ["أخرى"]
};

const DUMMY_IMAGE_URL = 'https://via.placeholder.com/400x250.png?text=Pending+Upload';

export default function CaptainRegister() {
  const router = useRouter();
  const scrollViewRef = useRef<any>(null);
  
  const [activeTab, setActiveTab] = useState<'basic' | 'vehicle'>('basic');
  const [vehicleCategory, setVehicleCategory] = useState<'car' | 'tuktuk_alt' | 'scooter'>('car');

  const [name, setName] = useState('');
  const [nationalId, setNationalId] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [carBrand, setCarBrand] = useState('');
  const [carModel, setCarModel] = useState('');
  const [customCarBrand, setCustomCarBrand] = useState('');
  const [customCarModel, setCustomCarModel] = useState('');
  const [carYear, setCarYear] = useState('');
  const [carColor, setCarColor] = useState('');
  const [customCarColor, setCustomCarColor] = useState('');
  
  const [plateLetter1, setPlateLetter1] = useState('');
  const [plateLetter2, setPlateLetter2] = useState('');
  const [plateLetter3, setPlateLetter3] = useState('');
  const [plateNumbers, setPlateNumbers] = useState('');
  
  const refL1 = useRef<TextInput>(null);
  const refL2 = useRef<TextInput>(null);
  const refL3 = useRef<TextInput>(null);
  const refNum = useRef<TextInput>(null);

  const [tuktukNumber, setTuktukNumber] = useState('');
  const [tuktukAltType, setTuktukAltType] = useState('');
  const [scooterModel, setScooterModel] = useState('');

  const [errors, setErrors] = useState({
    name: '', nationalId: '', phone: '', password: '', confirmPassword: '', customCarColor: '', plateNumbers: '', scooterModel: ''
  });

  const [images, setImages] = useState<any>({
    profile: null, idFront: null, idBack: null, carLicenseFront: null, carLicenseBack: null, 
    drivingLicenseFront: null, drivingLicenseBack: null, carFrontImage: null, tuktukImage: null, scooterImage: null, 
  });

  const [isLoading, setIsLoading] = useState(false);
  const [isDropdownVisible, setIsDropdownVisible] = useState(false);
  const [dropdownData, setDropdownData] = useState<string[]>([]);
  const [dropdownTarget, setDropdownTarget] = useState<'carBrand' | 'carModel' | 'carYear' | 'carColor' | null>(null);
  const [dropdownTitle, setDropdownTitle] = useState('');

  const uploadImageToStorage = async (uri: string, imageName: string) => {
    if (!uri) return DUMMY_IMAGE_URL; 
    
    // 👈 الحل السحري: لو الصورة اتحولت لنص Base64، هنحفظها مباشرة في الداتا بيز (وهنتخطى مساحة التخزين المعطلة)
    if (uri.startsWith('data:image')) {
      return uri;
    }

    try {
      const blob: Blob = await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.onload = function() { resolve(xhr.response); };
        xhr.onerror = function(e) { reject(new TypeError("فشل في تجهيز الصورة للرفع")); };
        xhr.responseType = "blob";
        xhr.open("GET", uri, true);
        xhr.send(null);
      });
      
      const storageRef = ref(storage, `captains_documents/${phone}/${imageName}`);
      const metadata = { contentType: 'image/jpeg' };
      
      await uploadBytes(storageRef, blob, metadata);
      // @ts-ignore
      if (blob.close) { blob.close(); }
      
      return await getDownloadURL(storageRef);
    } catch (error: any) {
      console.log('Firebase storage blocked upload, using fallback URL.', error.message);
      return DUMMY_IMAGE_URL;
    }
  };

  const validateName = () => {
    if (name.trim().length === 0) {
      setErrors(prev => ({ ...prev, name: 'برجاء إدخال الاسم' })); return false;
    }
    setErrors(prev => ({ ...prev, name: '' })); return true;
  };

  const validateNationalId = () => {
    if (nationalId.trim().length !== 14 || isNaN(Number(nationalId))) {
      setErrors(prev => ({ ...prev, nationalId: 'الرقم القومي يجب أن يتكون من 14 رقماً' })); return false;
    }
    setErrors(prev => ({ ...prev, nationalId: '' })); return true;
  };

  const validatePhone = () => {
    const phoneRegex = /^01[0125][0-9]{8}$/;
    if (!phoneRegex.test(phone)) {
      setErrors(prev => ({ ...prev, phone: 'بيانات خاطئة، رقم هاتف مصري غير صالح' })); return false;
    }
    setErrors(prev => ({ ...prev, phone: '' })); return true;
  };

  const validatePassword = () => {
    if (password.trim() === '') {
      setErrors(prev => ({ ...prev, password: 'برجاء إدخال كلمة المرور' })); return false;
    }
    setErrors(prev => ({ ...prev, password: '' }));
    if (confirmPassword) validateConfirmPassword();
    return true;
  };

  const validateConfirmPassword = () => {
    if (confirmPassword !== password || confirmPassword === '') {
      setErrors(prev => ({ ...prev, confirmPassword: 'كلمتا المرور غير متطابقتين' })); return false;
    }
    setErrors(prev => ({ ...prev, confirmPassword: '' })); return true;
  };

  const validateCustomColor = () => {
    if (carColor === 'أخرى' && customCarColor.trim() === '') {
      setErrors(prev => ({ ...prev, customCarColor: 'برجاء إدخال اللون' })); return false;
    }
    setErrors(prev => ({ ...prev, customCarColor: '' })); return true;
  };

  const validatePlateNumbers = () => {
    if (plateNumbers.trim() === '' || isNaN(Number(plateNumbers))) {
      setErrors(prev => ({ ...prev, plateNumbers: 'يجب إدخال أرقام صحيحة للوحة' })); return false;
    }
    setErrors(prev => ({ ...prev, plateNumbers: '' })); return true;
  };

  const validateScooterModel = () => {
    if (vehicleCategory === 'scooter' && scooterModel.trim() === '') {
      setErrors(prev => ({ ...prev, scooterModel: 'برجاء إدخال موديل السكوتر' })); return false;
    }
    setErrors(prev => ({ ...prev, scooterModel: '' })); return true;
  };

  const switchTab = (tab: 'basic' | 'vehicle') => {
    if (tab === 'vehicle') {
      if (!validateName() || !validateNationalId() || !validatePhone() || !validatePassword() || !validateConfirmPassword()) {
        Alert.alert('تنبيه', 'برجاء تصحيح الأخطاء في البيانات الأساسية أولاً.');
        return;
      }
    }
    setActiveTab(tab);
    scrollViewRef.current?.scrollToPosition(0, 0, true);
  };

  const openDropdown = (target: 'carBrand' | 'carModel' | 'carYear' | 'carColor', title: string, data: string[]) => {
    setDropdownTarget(target); setDropdownTitle(title); setDropdownData(data); setIsDropdownVisible(true);
  };

  const selectDropdownItem = (item: string) => {
    if (dropdownTarget === 'carBrand') {
      setCarBrand(item); setCarModel(''); setCustomCarBrand(''); setCustomCarModel('');
    }
    if (dropdownTarget === 'carModel') {
      setCarModel(item); setCustomCarModel('');
    }
    if (dropdownTarget === 'carYear') setCarYear(item);
    if (dropdownTarget === 'carColor') {
      setCarColor(item);
      if (item !== 'أخرى') setErrors(prev => ({ ...prev, customCarColor: '' }));
    }
    setIsDropdownVisible(false);
  };

  const pickImage = (field: string) => {
    Alert.alert('إرفاق صورة', 'اختر طريقة إرفاق الصورة', [
        { text: 'الكاميرا 📷', onPress: () => openCamera(field) },
        { text: 'المعرض 🖼️', onPress: () => openGallery(field) },
        { text: 'إلغاء', style: 'cancel' },
    ], { cancelable: true });
  };

  // 👈 تحويل الصورة لنص Base64 عشان تتسجل في الداتا بيز مباشرة
  const openCamera = async (field: string) => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') { Alert.alert('تنبيه', 'نحتاج صلاحية الكاميرا.'); return; }
    let result = await ImagePicker.launchCameraAsync({ 
      mediaTypes: ImagePicker.MediaTypeOptions.Images, 
      allowsEditing: true, 
      quality: 0.1, // تقليل الجودة لضمان سرعة الرفع
      base64: true  // 👈 أهم أمر
    });
    if (!result.canceled && result.assets && result.assets[0].base64) {
      const base64Img = `data:image/jpeg;base64,${result.assets[0].base64}`;
      setImages((prev: any) => ({ ...prev, [field]: base64Img }));
    }
  };

  const openGallery = async (field: string) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('تنبيه', 'نحتاج صلاحية المعرض.'); return; }
    let result = await ImagePicker.launchImageLibraryAsync({ 
      mediaTypes: ImagePicker.MediaTypeOptions.Images, 
      allowsEditing: true, 
      quality: 0.1, 
      base64: true // 👈 أهم أمر
    });
    if (!result.canceled && result.assets && result.assets[0].base64) {
      const base64Img = `data:image/jpeg;base64,${result.assets[0].base64}`;
      setImages((prev: any) => ({ ...prev, [field]: base64Img }));
    }
  };

  const renderImageBox = (title: string, field: string, isAvatar = false) => (
    <View style={isAvatar ? styles.avatarContainer : styles.imageBoxContainer}>
      {images[field] ? (
        <View style={{ width: '100%', height: '100%', position: 'relative' }}>
          <Image source={{ uri: images[field] }} style={isAvatar ? styles.avatarImage : styles.boxImage} />
          <TouchableOpacity 
            style={[styles.removeImageBtn, isAvatar && { top: 12, right: 12 }]} 
            onPress={() => setImages((prev: any) => ({ ...prev, [field]: null }))}
          >
            <Text style={styles.removeImageText}>❌</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity style={{ width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' }} onPress={() => pickImage(field)}>
          <View style={isAvatar ? styles.avatarPlaceholder : styles.boxPlaceholder}>
            <Text style={styles.boxIcon}>{isAvatar ? '👤' : '📷'}</Text>
            <Text style={styles.boxText}>{title}</Text>
          </View>
        </TouchableOpacity>
      )}
    </View>
  );

  const handleRegister = async () => {
    let missingFields = []; 

    if (!validateName()) missingFields.push('الاسم الرباعي');
    if (!validateNationalId()) missingFields.push('الرقم القومي (14 رقم)');
    if (!validatePhone()) missingFields.push('رقم الهاتف الصحيح');
    if (!validatePassword()) missingFields.push('كلمة المرور');
    if (!validateConfirmPassword()) missingFields.push('تأكيد كلمة المرور');
    if (!images.profile) missingFields.push('صورتك الشخصية (سيلفي)');

    let finalBrand = carBrand === 'ماركة أخرى (غير مسجلة)' ? customCarBrand : carBrand;
    let finalModel = carModel === 'أخرى' ? customCarModel : carModel;
    let finalColor = carColor === 'أخرى' ? customCarColor : carColor;
    let finalPlate = `${plateLetter1} ${plateLetter2} ${plateLetter3} - ${plateNumbers}`;

    if (vehicleCategory === 'car') {
      if (!carBrand) missingFields.push('ماركة السيارة');
      if (carBrand === 'ماركة أخرى (غير مسجلة)' && !customCarBrand.trim()) missingFields.push('كتابة اسم الماركة يدوياً');
      if (!carModel) missingFields.push('نوع السيارة');
      if (carModel === 'أخرى' && !customCarModel.trim()) missingFields.push('كتابة نوع السيارة يدوياً');
      if (!carYear) missingFields.push('موديل السنة');
      if (!carColor) missingFields.push('لون السيارة');
      if (carColor === 'أخرى' && !validateCustomColor()) missingFields.push('كتابة اللون اليدوي');
      if (!plateLetter1 || !plateLetter2 || !plateLetter3) missingFields.push('حروف لوحة السيارة');
      if (!validatePlateNumbers()) missingFields.push('أرقام لوحة السيارة');
    } else if (vehicleCategory === 'scooter') {
      if (!validateScooterModel()) missingFields.push('موديل السكوتر');
    } else if (vehicleCategory === 'tuktuk_alt') {
      if (!tuktukAltType) missingFields.push('تحديد نوع بديل التوكتوك');
    }

    if (missingFields.length > 0) {
      Alert.alert('بيانات ناقصة ⚠️', 'برجاء إكمال البيانات التالية:\n\n- ' + missingFields.join('\n- '));
      return;
    }

    setIsLoading(true);
    try {
      const vehicleName = vehicleCategory === 'car' ? 'سيارة' : vehicleCategory === 'scooter' ? 'سكوتر' : 'بديل توكتوك';

      const phoneQ = query(collection(db, 'captains'), where('phone', '==', phone), where('vehicleCategory', '==', vehicleCategory));
      if (!(await getDocs(phoneQ)).empty) { 
        Alert.alert('تنبيه', `هذا الرقم مسجل بالفعل ككابتن على (${vehicleName}). يمكنك التسجيل بمركبة أخرى.`); 
        setIsLoading(false); return; 
      }

      const idQ = query(collection(db, 'captains'), where('nationalId', '==', nationalId), where('vehicleCategory', '==', vehicleCategory));
      if (!(await getDocs(idQ)).empty) { 
        Alert.alert('تنبيه', `الرقم القومي مسجل بالفعل لحساب كابتن على (${vehicleName}). يمكنك التسجيل بمركبة أخرى.`); 
        setIsLoading(false); return; 
      }

      const avatarUrl = await uploadImageToStorage(images.profile, 'profile_image.jpg');
      const idFrontUrl = await uploadImageToStorage(images.idFront, 'id_front.jpg');
      const idBackUrl = await uploadImageToStorage(images.idBack, 'id_back.jpg');

      const captainData: any = {
        name, nationalId, phone, password, 
        avatar: avatarUrl, 
        profileImage: avatarUrl, // 👈 ضفناها مخصوص عشان لوحة التحكم
        image: avatarUrl,        // 👈 ضفناها احتياطي عشان لوحة التحكم
        idFront: idFrontUrl, 
        idBack: idBackUrl,
        vehicleCategory, walletBalance: 0, isOnline: false, 
        status: 'pending', 
        timestamp: serverTimestamp()
      };

      if (vehicleCategory === 'car') {
        const carFrontUrl = await uploadImageToStorage(images.carFrontImage, 'car_front.jpg');
        const dlFrontUrl = await uploadImageToStorage(images.drivingLicenseFront, 'driving_license_front.jpg');
        const dlBackUrl = await uploadImageToStorage(images.drivingLicenseBack, 'driving_license_back.jpg');
        const clFrontUrl = await uploadImageToStorage(images.carLicenseFront, 'car_license_front.jpg');
        const clBackUrl = await uploadImageToStorage(images.carLicenseBack, 'car_license_back.jpg');

        Object.assign(captainData, {
          carBrand: finalBrand, carModel: finalModel, carYear, carColor: finalColor, carPlate: finalPlate,
          vehicleImage: carFrontUrl,
          drivingLicenseFront: dlFrontUrl, drivingLicenseBack: dlBackUrl,
          carLicenseFront: clFrontUrl, carLicenseBack: clBackUrl,
          vehicle: `${finalBrand} ${finalModel}`
        });
      } else if (vehicleCategory === 'scooter') {
        const scooterImgUrl = await uploadImageToStorage(images.scooterImage, 'scooter_image.jpg');
        Object.assign(captainData, { tuktukNumber, vehicleImage: scooterImgUrl, vehicle: `سكوتر ${scooterModel}` });
      } else {
        const tuktukImgUrl = await uploadImageToStorage(images.tuktukImage, 'tuktuk_image.jpg');
        Object.assign(captainData, { tuktukNumber, vehicleImage: tuktukImgUrl, vehicle: `بديل توكتوك (${tuktukAltType})`, tuktukAltType });
      }

      await addDoc(collection(db, 'captains'), captainData);
      
      Alert.alert('تم التسجيل بنجاح 🎉', 'تم إرسال بياناتك للإدارة. حسابك الآن (قيد المراجعة). سيتم تفعيله خلال 24 ساعة كحد أقصى.', [
        { text: 'حسناً', onPress: () => router.replace('/captain-login') }
      ]);
      
    } catch (error: any) { 
      Alert.alert('حدث خطأ 🛑', `تفاصيل الخطأ:\n${error.message}`); 
    } finally { 
      setIsLoading(false); 
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.container}>
        <Text style={styles.mainTitle}>تسجيل كابتن بَرّاق ⚡</Text>

        <View style={styles.tabsContainer}>
          <TouchableOpacity style={[styles.tabBtn, activeTab === 'basic' && styles.tabBtnActive]} onPress={() => switchTab('basic')}><Text style={[styles.tabText, activeTab === 'basic' && styles.tabTextActive]}>البيانات الأساسية</Text></TouchableOpacity>
          <TouchableOpacity style={[styles.tabBtn, activeTab === 'vehicle' && styles.tabBtnActive]} onPress={() => switchTab('vehicle')}><Text style={[styles.tabText, activeTab === 'vehicle' && styles.tabTextActive]}>بيانات المركبة</Text></TouchableOpacity>
        </View>

        <KeyboardAwareScrollView 
          ref={scrollViewRef} 
          style={{ flex: 1, width: '100%' }} 
          showsVerticalScrollIndicator={false} 
          contentContainerStyle={[styles.scrollContent, { flexGrow: 1 }]} 
          keyboardShouldPersistTaps="handled" 
          enableOnAndroid={true}
          extraScrollHeight={50}
          keyboardDismissMode="on-drag"
          overScrollMode="never"
        >
          
          {activeTab === 'basic' && (
            <View style={styles.sectionContainer}>
              <View style={styles.avatarWrapper}>{renderImageBox("إضافة صورتك", "profile", true)}</View>
              
              <Text style={styles.label}>الاسم</Text>
              <TextInput style={[styles.input, errors.name ? styles.inputError : null]} placeholder="ادخل اسمك" value={name} onChangeText={setName} onBlur={validateName} textAlign="right" />
              {errors.name ? <Text style={styles.errorText}>{errors.name}</Text> : null}

              <Text style={styles.label}>الرقم القومي</Text>
              <TextInput style={[styles.input, errors.nationalId ? styles.inputError : null]} placeholder="أدخل الرقم القومي (14 رقم)" value={nationalId} onChangeText={setNationalId} onBlur={validateNationalId} keyboardType="numeric" textAlign="right" maxLength={14} />
              {errors.nationalId ? <Text style={styles.errorText}>{errors.nationalId}</Text> : null}

              <Text style={styles.label}>رقم الهاتف</Text>
              <TextInput style={[styles.input, errors.phone ? styles.inputError : null]} placeholder="مثال: 01012345678" value={phone} onChangeText={setPhone} onBlur={validatePhone} keyboardType="phone-pad" textAlign="right" maxLength={11} />
              {errors.phone ? <Text style={styles.errorText}>{errors.phone}</Text> : null}

              <Text style={styles.label}>كلمة المرور</Text>
              <TextInput style={[styles.input, errors.password ? styles.inputError : null]} placeholder="اكتب كلمة مرور" value={password} onChangeText={setPassword} onBlur={validatePassword} secureTextEntry textAlign="right" />
              {errors.password ? <Text style={styles.errorText}>{errors.password}</Text> : null}

              <Text style={styles.label}>تأكيد كلمة المرور</Text>
              <TextInput style={[styles.input, errors.confirmPassword ? styles.inputError : null]} placeholder="أعد كتابة كلمة المرور" value={confirmPassword} onChangeText={setConfirmPassword} onBlur={validateConfirmPassword} secureTextEntry textAlign="right" />
              {errors.confirmPassword ? <Text style={styles.errorText}>{errors.confirmPassword}</Text> : null}

              <Text style={styles.sectionSubtitle}>صور البطاقة الشخصية (اختياري مؤقتاً)</Text>
              <View style={styles.imagesRow}>{renderImageBox("البطاقة (أمام)", "idFront")}{renderImageBox("البطاقة (خلف)", "idBack")}</View>
              <TouchableOpacity style={styles.nextBtn} onPress={() => switchTab('vehicle')}><Text style={styles.nextBtnText}>التالي: بيانات المركبة ⬅️</Text></TouchableOpacity>
            </View>
          )}

          {activeTab === 'vehicle' && (
            <View style={styles.sectionContainer}>
              <View style={styles.vehicleTypeTabs}>
                <TouchableOpacity style={[styles.vTypeBtn, vehicleCategory === 'car' && styles.vTypeBtnActive]} onPress={() => setVehicleCategory('car')}><Text style={styles.vTypeEmoji}>🚗</Text><Text style={[styles.vTypeText, vehicleCategory === 'car' && styles.vTypeTextActive]}>سيارة</Text></TouchableOpacity>
                <TouchableOpacity style={[styles.vTypeBtn, vehicleCategory === 'tuktuk_alt' && styles.vTypeBtnActive]} onPress={() => setVehicleCategory('tuktuk_alt')}><Text style={styles.vTypeEmoji}>🛺</Text><Text style={[styles.vTypeText, vehicleCategory === 'tuktuk_alt' && styles.vTypeTextActive]}>بديل توكتوك</Text></TouchableOpacity>
                <TouchableOpacity style={[styles.vTypeBtn, vehicleCategory === 'scooter' && styles.vTypeBtnActive]} onPress={() => setVehicleCategory('scooter')}><Text style={styles.vTypeEmoji}>🛵</Text><Text style={[styles.vTypeText, vehicleCategory === 'scooter' && styles.vTypeTextActive]}>سكوتر</Text></TouchableOpacity>
              </View>

              {vehicleCategory === 'car' && (
                <View>
                  <Text style={styles.label}>ماركة السيارة</Text>
                  <TouchableOpacity style={styles.dropdownTrigger} onPress={() => openDropdown('carBrand', 'اختر ماركة السيارة', Object.keys(carData))}><Text style={styles.dropdownText}>{carBrand || 'اضغط للاختيار 🔽'}</Text></TouchableOpacity>
                  {carBrand === 'ماركة أخرى (غير مسجلة)' && (
                    <TextInput style={[styles.input, { marginTop: 10 }]} placeholder="اكتب اسم الماركة يدوياً..." value={customCarBrand} onChangeText={setCustomCarBrand} textAlign="right" />
                  )}

                  <Text style={styles.label}>نوع السيارة</Text>
                  <TouchableOpacity 
                    style={[styles.dropdownTrigger, !carBrand && { opacity: 0.6 }]} 
                    onPress={() => {
                      if(!carBrand) { Alert.alert('تنبيه', 'برجاء اختيار الماركة أولاً'); return; }
                      openDropdown('carModel', 'اختر نوع السيارة', carData[carBrand] || [])
                    }}
                  >
                    <Text style={styles.dropdownText}>{carModel || 'اضغط للاختيار 🔽'}</Text>
                  </TouchableOpacity>
                  {carModel === 'أخرى' && (
                    <TextInput style={[styles.input, { marginTop: 10 }]} placeholder="اكتب نوع السيارة يدوياً..." value={customCarModel} onChangeText={setCustomCarModel} textAlign="right" />
                  )}

                  <Text style={styles.label}>موديل السنة</Text>
                  <TouchableOpacity style={styles.dropdownTrigger} onPress={() => openDropdown('carYear', 'اختر سنة الموديل', YEARS)}><Text style={styles.dropdownText}>{carYear || 'اضغط للاختيار 🔽'}</Text></TouchableOpacity>
                  
                  <Text style={styles.label}>لون السيارة</Text>
                  <TouchableOpacity style={styles.dropdownTrigger} onPress={() => openDropdown('carColor', 'اختر لون السيارة', CAR_COLORS)}><Text style={styles.dropdownText}>{carColor || 'اضغط للاختيار 🔽'}</Text></TouchableOpacity>
                  {carColor === 'أخرى' && (
                    <View>
                        <TextInput style={[styles.input, { marginTop: 10 }, errors.customCarColor ? styles.inputError : null]} placeholder="اكتب اللون يدوياً..." value={customCarColor} onChangeText={setCustomCarColor} onBlur={validateCustomColor} textAlign="right" />
                        {errors.customCarColor ? <Text style={styles.errorText}>{errors.customCarColor}</Text> : null}
                    </View>
                  )}

                  <Text style={styles.label}>رقم اللوحة</Text>
                  <View style={styles.plateRow}>
                    <TextInput ref={refL1} style={styles.plateLetterInput} maxLength={1} placeholder="حرف" value={plateLetter1} onChangeText={(t) => { setPlateLetter1(t); if(t) refL2.current?.focus(); }} textAlign="center" />
                    <TextInput ref={refL2} style={styles.plateLetterInput} maxLength={1} placeholder="حرف" value={plateLetter2} onChangeText={(t) => { setPlateLetter2(t); if(t) refL3.current?.focus(); }} textAlign="center" />
                    <TextInput ref={refL3} style={styles.plateLetterInput} maxLength={1} placeholder="حرف" value={plateLetter3} onChangeText={(t) => { setPlateLetter3(t); if(t) refL3.current?.focus(); }} textAlign="center" />
                    <TextInput ref={refNum} style={[styles.plateNumInput, errors.plateNumbers ? styles.inputError : null]} maxLength={5} keyboardType="numeric" placeholder="أرقام (٥ حد أقصى)" value={plateNumbers} onChangeText={setPlateNumbers} onBlur={validatePlateNumbers} textAlign="center" />
                  </View>
                  {errors.plateNumbers ? <Text style={[styles.errorText, {textAlign: 'center'}]}>{errors.plateNumbers}</Text> : null}

                  <Text style={styles.sectionSubtitle}>صور رخصة القيادة (اختياري)</Text>
                  <View style={styles.imagesRow}>{renderImageBox("الرخصة (أمام)", "drivingLicenseFront")}{renderImageBox("الرخصة (خلف)", "drivingLicenseBack")}</View>
                  <Text style={styles.sectionSubtitle}>صور رخصة السيارة (اختياري)</Text>
                  <View style={styles.imagesRow}>{renderImageBox("الرخصة (أمام)", "carLicenseFront")}{renderImageBox("الرخصة (خلف)", "carLicenseBack")}</View>
                  <Text style={styles.sectionSubtitle}>صورة السيارة الأمامية (اختياري)</Text>
                  {renderImageBox("صورة للسيارة شاملة اللوحة", "carFrontImage")}
                </View>
              )}

              {vehicleCategory === 'tuktuk_alt' && (
                <View>
                  <Text style={styles.label}>نوع بديل التوكتوك</Text>
                  <View style={{ flexDirection: 'row-reverse', gap: 10, marginTop: 5, marginBottom: 10 }}>
                    <TouchableOpacity style={[styles.vTypeBtn, tuktukAltType === 'كيوت 3 راكب' && styles.vTypeBtnActive]} onPress={() => setTuktukAltType('كيوت 3 راكب')}>
                      <Text style={[styles.vTypeText, tuktukAltType === 'كيوت 3 راكب' && styles.vTypeTextActive]}>كيوت 3 راكب</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.vTypeBtn, tuktukAltType === 'جالاكسي 7 راكب' && styles.vTypeBtnActive]} onPress={() => setTuktukAltType('جالاكسي 7 راكب')}>
                      <Text style={[styles.vTypeText, tuktukAltType === 'جالاكسي 7 راكب' && styles.vTypeTextActive]}>جالاكسي 7 راكب</Text>
                    </TouchableOpacity>
                  </View>

                  <Text style={styles.label}>رقم المركبة (إن وجد)</Text>
                  <TextInput style={styles.input} placeholder="أدخل الرقم أو اتركها فارغة" value={tuktukNumber} onChangeText={setTuktukNumber} textAlign="right" />
                  <Text style={styles.sectionSubtitle}>صورة المركبة (اختياري مؤقتاً)</Text>
                  {renderImageBox("إرفاق صورة للمركبة", "tuktukImage")}
                </View>
              )}

              {vehicleCategory === 'scooter' && (
                <View>
                  <Text style={styles.label}>موديل السكوتر</Text>
                  <TextInput style={[styles.input, errors.scooterModel ? styles.inputError : null]} placeholder="مثال: كيمكو، SYM" value={scooterModel} onChangeText={setScooterModel} onBlur={validateScooterModel} textAlign="right" />
                  {errors.scooterModel ? <Text style={styles.errorText}>{errors.scooterModel}</Text> : null}

                  <Text style={styles.label}>رقم اللوحة</Text>
                  <TextInput style={styles.input} placeholder="أدخل رقم اللوحة" value={tuktukNumber} onChangeText={setTuktukNumber} textAlign="right" />
                  <Text style={styles.sectionSubtitle}>صورة السكوتر (اختياري مؤقتاً)</Text>
                  {renderImageBox("إرفاق صورة للسكوتر", "scooterImage")}
                </View>
              )}

              <TouchableOpacity style={styles.submitBtn} onPress={handleRegister} disabled={isLoading}>
                {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>إرسال طلب التسجيل ✅</Text>}
              </TouchableOpacity>
            </View>
          )}

        </KeyboardAwareScrollView>
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
    </View>
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
  inputError: { borderColor: '#ef4444', borderWidth: 1.5, backgroundColor: '#fef2f2' },
  errorText: { color: '#ef4444', fontSize: 12, fontWeight: 'bold', textAlign: 'right', marginTop: 4, marginLeft: 5 },
  plateRow: { flexDirection: 'row-reverse', gap: 8, marginTop: 5 },
  plateLetterInput: { flex: 1, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, padding: 12, fontSize: 16, fontWeight: 'bold', color: '#0f172a' },
  plateNumInput: { flex: 3, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, padding: 12, fontSize: 16, fontWeight: 'bold', color: '#0f172a' },
  dropdownTrigger: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, padding: 14, alignItems: 'flex-end' },
  dropdownText: { fontSize: 15, color: '#0f172a', fontWeight: 'bold' },
  sectionSubtitle: { fontSize: 16, fontWeight: 'bold', color: '#1e293b', textAlign: 'center', marginTop: 25, marginBottom: 15, borderTopWidth: 1, borderColor: '#f1f5f9', paddingTop: 15 },
  imagesRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', gap: 10 },
  imageBoxContainer: { flex: 1, height: 120, backgroundColor: '#f8fafc', borderRadius: 12, borderWidth: 1, borderColor: '#cbd5e1', borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  boxImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  boxPlaceholder: { alignItems: 'center' },
  boxIcon: { fontSize: 24, marginBottom: 5 },
  boxText: { fontSize: 12, color: '#64748b', fontWeight: 'bold', textAlign: 'center', paddingHorizontal: 5 },
  removeImageBtn: { position: 'absolute', top: 5, right: 5, backgroundColor: '#ffffff', width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#ef4444', elevation: 3, zIndex: 10 },
  removeImageText: { fontSize: 10 },
  nextBtn: { backgroundColor: '#64748b', paddingVertical: 15, borderRadius: 12, alignItems: 'center', marginTop: 30 },
  nextBtnText: { color: '#ffffff', fontSize: 16, fontWeight: 'bold' },
  submitBtn: { backgroundColor: '#2563eb', paddingVertical: 15, borderRadius: 12, alignItems: 'center', marginTop: 30, elevation: 3 },
  submitBtnText: { color: '#ffffff', fontSize: 18, fontWeight: 'bold' },
  vehicleTypeTabs: { flexDirection: 'row-reverse', justifyContent: 'center', gap: 10, marginBottom: 20 },
  vTypeBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#cbd5e1' },
  vTypeBtnActive: { backgroundColor: '#eff6ff', borderColor: '#3b82f6', borderWidth: 2 },
  vTypeEmoji: { fontSize: 28, marginBottom: 5 },
  vTypeText: { fontSize: 13, fontWeight: 'bold', color: '#64748b', textAlign: 'center' },
  vTypeTextActive: { color: '#2563eb' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '60%' },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#1e293b', textAlign: 'center', marginBottom: 15 },
  modalItem: { paddingVertical: 15, borderBottomWidth: 1, borderColor: '#f1f5f9', alignItems: 'center' },
  modalItemText: { fontSize: 16, color: '#334155', fontWeight: 'bold' },
  modalCancelBtn: { marginTop: 15, paddingVertical: 15, backgroundColor: '#fee2e2', borderRadius: 12, alignItems: 'center' },
  modalCancelText: { color: '#ef4444', fontSize: 16, fontWeight: 'bold' },
});