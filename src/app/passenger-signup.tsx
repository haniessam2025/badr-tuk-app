import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { addDoc, collection, getDocs, query, serverTimestamp, where } from 'firebase/firestore';
import { useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { db } from '../firebase';

export default function PassengerSignupScreen() {
  const [image, setImage] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [nationalId, setNationalId] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({ name: '', nationalId: '', phone: '' }); 
  const [isTermsAccepted, setIsTermsAccepted] = useState(false); 
  const [isPolicyModalVisible, setIsPolicyModalVisible] = useState(false);
  const router = useRouter();

  // دوال الفحص الفوري للراكب
  const validateName = async () => {
    if (!name.trim()) { setErrors(prev => ({...prev, name: 'برجاء إدخال الاسم'})); return false; }
    const q = query(collection(db, 'passengers'), where('name', '==', name.trim()));
    if (!(await getDocs(q)).empty) { setErrors(prev => ({...prev, name: '❌ هذا الاسم مسجل بالفعل'})); return false; }
    setErrors(prev => ({...prev, name: ''})); return true;
  };

  const validateNationalId = async () => {
    if (nationalId.trim().length !== 14) { setErrors(prev => ({...prev, nationalId: 'يجب أن يكون 14 رقماً'})); return false; }
    const q = query(collection(db, 'passengers'), where('nationalId', '==', nationalId.trim()));
    if (!(await getDocs(q)).empty) { setErrors(prev => ({...prev, nationalId: '❌ الرقم القومي مسجل لحساب آخر'})); return false; }
    setErrors(prev => ({...prev, nationalId: ''})); return true;
  };

  const validatePhone = async () => {
    if (!/^01[0125][0-9]{8}$/.test(phone.trim())) { setErrors(prev => ({...prev, phone: 'أدخل رقم مصري صحيح'})); return false; }
    const q = query(collection(db, 'passengers'), where('phone', '==', phone.trim()));
    if (!(await getDocs(q)).empty) { setErrors(prev => ({...prev, phone: '❌ رقم الموبايل مسجل بالفعل'})); return false; }
    setErrors(prev => ({...prev, phone: ''})); return true;
  };

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.3, 
      base64: true,
    });

    if (!result.canceled && result.assets && result.assets[0].base64) {
      const base64Image = `data:image/jpeg;base64,${result.assets[0].base64}`;
      setImage(base64Image);
    }
  };

  const handleSignup = async () => {
    const isNameValid = await validateName();
    const isIdValid = await validateNationalId();
    const isPhoneValid = await validatePhone();

    if (!isNameValid || !isIdValid || !isPhoneValid || !password.trim() || !confirmPassword.trim()) {
      Alert.alert('خطأ', 'يرجى إدخال جميع البيانات المطلوبة بشكل صحيح أولاً.');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('خطأ', 'كلمة السر غير متطابقة.');
      return;
    }

    setLoading(true);
    try {
      // إضافة بيانات الراكب مع حالة قيد المراجعة
      const newPassenger = {
        name: name.trim(),
        nationalId: nationalId.trim(),
        phone: phone.trim(),
        password: password.trim(),
        avatar: image || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
        status: 'pending',
        timestamp: serverTimestamp()
      };

      await addDoc(collection(db, 'passengers'), newPassenger);

      setLoading(false);
      
      // إظهار رسالة النجاح وتوجيه المستخدم لتسجيل الدخول
      Alert.alert(
        'نجاح', 
        'تم التسجيل بنجاح ستتم الموافقة بعد المراجعة خلال 24 ساعة على الأكثر', 
        [{ text: 'حسناً', onPress: () => router.replace('/passenger-login') }]
      );
      
    } catch (error) {
      setLoading(false);
      Alert.alert('خطأ', 'حدثت مشكلة أثناء إنشاء الحساب. حاول مرة أخرى.');
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
      <Text style={styles.title}>تسجيل راكب جديد 🛺</Text>

      <View style={styles.avatarContainer}>
        <TouchableOpacity onPress={pickImage}>
          {image ? (
            <Image source={{ uri: image }} style={styles.avatar} />
          ) : (
            <View style={styles.placeholderAvatar}>
              <Text style={styles.placeholderText}>📷 صورة اختيارية</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>اسم المستخدم</Text>
        <TextInput 
          style={[styles.input, errors.name ? { borderColor: '#ef4444', borderWidth: 1.5 } : null]} 
          placeholder="اكتب اسمك هنا" 
          placeholderTextColor="#9ca3af"
          value={name} 
          onChangeText={setName} 
          onBlur={validateName}
        />
        {errors.name ? <Text style={{color: '#ef4444', fontSize: 12, textAlign: 'right', marginTop: 4, fontWeight: 'bold'}}>{errors.name}</Text> : null}
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>الرقم القومي</Text>
        <TextInput 
          style={[styles.input, errors.nationalId ? { borderColor: '#ef4444', borderWidth: 1.5 } : null]} 
          placeholder="الرقم القومي (14 رقم)" 
          placeholderTextColor="#9ca3af"
          keyboardType="numeric"
          value={nationalId} 
          onChangeText={setNationalId} 
          onBlur={validateNationalId}
          maxLength={14}
        />
        {errors.nationalId ? <Text style={{color: '#ef4444', fontSize: 12, textAlign: 'right', marginTop: 4, fontWeight: 'bold'}}>{errors.nationalId}</Text> : null}
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>رقم الموبايل</Text>
        <TextInput 
          style={[styles.input, errors.phone ? { borderColor: '#ef4444', borderWidth: 1.5 } : null]} 
          placeholder="رقم مصري (مثال: 01012345678)" 
          placeholderTextColor="#9ca3af"
          keyboardType="phone-pad"
          value={phone} 
          onChangeText={setPhone} 
          onBlur={validatePhone}
          maxLength={11}
        />
        {errors.phone ? <Text style={{color: '#ef4444', fontSize: 12, textAlign: 'right', marginTop: 4, fontWeight: 'bold'}}>{errors.phone}</Text> : null}
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>كلمة السر</Text>
        <TextInput 
          style={styles.input} 
          placeholder="اختر كلمة مرور قوية" 
          placeholderTextColor="#9ca3af"
          secureTextEntry 
          value={password} 
          onChangeText={setPassword} 
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>تأكيد كلمة السر</Text>
        <TextInput 
          style={styles.input} 
          placeholder="أعد كتابة كلمة المرور" 
          placeholderTextColor="#9ca3af"
          secureTextEntry 
          value={confirmPassword} 
          onChangeText={setConfirmPassword} 
        />
      </View>

      {/* مربع الموافقة الإجباري وسياسة الخصوصية */}
      <View 
        style={{ 
          flexDirection: 'row-reverse', 
          alignItems: 'center', 
          marginBottom: 20, 
          marginTop: 10,
          backgroundColor: '#f8fafc', 
          padding: 10, 
          borderRadius: 12,
          borderWidth: 1,
          borderColor: isTermsAccepted ? '#10b981' : '#cbd5e1'
        }} 
      >
        <TouchableOpacity onPress={() => setIsTermsAccepted(!isTermsAccepted)} style={{ padding: 5 }}>
          <Ionicons 
            name={isTermsAccepted ? 'checkbox' : 'square-outline'} 
            size={26} 
            color={isTermsAccepted ? '#10b981' : '#94a3b8'} 
          />
        </TouchableOpacity>
        
        <Text style={{ flex: 1, textAlign: 'right', marginRight: 10, fontSize: 13, color: '#334155', lineHeight: 20 }}>
          أقر بأنني قرأت <Text onPress={() => setIsPolicyModalVisible(true)} style={{color: '#2563eb', fontWeight: 'bold', textDecorationLine: 'underline'}}>سياسة الخصوصية وإخلاء المسؤولية</Text> وأوافق عليها بالكامل، وأتحمل المسؤولية الشخصية.
        </Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#d97706" style={{ marginTop: 10 }} />
      ) : (
        /* زرار التسجيل محمي بشرط الموافقة */
        <TouchableOpacity 
          style={[
            styles.button, 
            !isTermsAccepted && { backgroundColor: '#94a3b8', opacity: 0.7 } 
          ]} 
          onPress={handleSignup}
          disabled={!isTermsAccepted}
        >
          <Text style={styles.buttonText}>تسجيل</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity onPress={() => router.push('/passenger-login')} style={styles.linkButton}>
        <Text style={styles.linkText}>لديك حساب بالفعل؟ تسجيل الدخول</Text>
      </TouchableOpacity>

      {/* نافذة سياسة الخصوصية */}
      <Modal animationType="fade" transparent={true} visible={isPolicyModalVisible}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <View style={{ backgroundColor: '#fff', width: '100%', maxHeight: '80%', padding: 20, borderRadius: 16, elevation: 5 }}>
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#1e293b', textAlign: 'center', marginBottom: 15 }}>سياسة الخصوصية وشروط الاستخدام</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={{ fontSize: 14, color: '#334155', textAlign: 'right', lineHeight: 24, marginBottom: 10 }}>
                <Text style={{ fontWeight: 'bold' }}>1. طبيعة الخدمة:</Text> التطبيق هو منصة إلكترونية (وسيط تقني) تهدف إلى تسهيل الربط بين الركاب والكباتن. التطبيق لا يمتلك أي مركبات ولا يقوم بتوظيف الكباتن.{"\n\n"}
                <Text style={{ fontWeight: 'bold' }}>2. إخلاء المسؤولية التام:</Text>{"\n"}
                • إدارة التطبيق ومالكه غير مسؤولين تماماً عن أي حوادث مرورية، أو إصابات جسدية، أو أضرار مادية تحدث أثناء الرحلة.{"\n"}
                • التطبيق يخلي مسؤوليته القانونية عن أي نزاع، أو تعدي، أو فقدان للمتعلقات الشخصية يحدث بين الراكب والكابتن.{"\n"}
                • يتحمل كل من الراكب والكابتن المسؤولية الشخصية والقانونية الكاملة عن أفعالهم.{"\n\n"}
                <Text style={{ fontWeight: 'bold' }}>3. أمان البيانات:</Text> نقوم بجمع بيانات الموقع الجغرافي ورقم الهاتف والاسم لغرض تشغيل الخدمة، ونلتزم بعدم مشاركتها مع أطراف خارجية.{"\n\n"}
                <Text style={{ fontWeight: 'bold' }}>4. القبول بالشروط:</Text> استخدامك للتطبيق يعني موافقتك الصريحة والنهائية على جميع ما ورد في هذه الوثيقة، وتنازلك عن أي حق في مقاضاة مالك التطبيق لأي سبب يتعلق بالرحلات.
              </Text>
            </ScrollView>
            <TouchableOpacity onPress={() => setIsPolicyModalVisible(false)} style={{ backgroundColor: '#2563eb', paddingVertical: 12, borderRadius: 10, alignItems: 'center', marginTop: 15 }}>
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: 'bold' }}>إغلاق الشروط</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: { flexGrow: 1, backgroundColor: '#f4f6f9', padding: 24, justifyContent: 'center' },
  title: { fontSize: 26, fontWeight: 'bold', color: '#d97706', textAlign: 'center', marginBottom: 20 },
  avatarContainer: { alignItems: 'center', marginBottom: 25 },
  avatar: { width: 110, height: 110, borderRadius: 55, borderWidth: 3, borderColor: '#d97706' },
  placeholderAvatar: { width: 110, height: 110, borderRadius: 55, backgroundColor: '#e2e8f0', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#cbd5e1', borderStyle: 'dashed' },
  placeholderText: { color: '#64748b', fontSize: 13, fontWeight: 'bold' },
  inputGroup: { marginBottom: 15 },
  label: { fontSize: 14, fontWeight: '600', color: '#4b5563', marginBottom: 5, textAlign: 'right' },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 12, fontSize: 16, textAlign: 'right', color: '#333' },
  button: { backgroundColor: '#10b981', padding: 16, borderRadius: 10, alignItems: 'center', marginTop: 5 },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  linkButton: { marginTop: 20, marginBottom: 40, alignItems: 'center' },
  linkText: { color: '#d97706', fontSize: 16, textDecorationLine: 'underline', fontWeight: 'bold' },
});