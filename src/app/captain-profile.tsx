import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { auth, db } from '../firebaseConfig';

export default function CaptainProfileScreen() {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [tukTukNumber, setTukTukNumber] = useState('');
  const [tukTukModel, setTukTukModel] = useState('');
  const [image, setImage] = useState('');
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const currentUser = auth.currentUser;
        if (currentUser) {
          const docRef = doc(db, 'captains', currentUser.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const data = docSnap.data();
            setName(data.name || '');
            setPhone(data.phone || '');
            setTukTukNumber(data.tukTukNumber || '');
            setTukTukModel(data.tukTukModel || '');
            setImage(data.image || '');
          }
        }
      } catch (error) {
        console.log('خطأ في جلب ملف الكابتن:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, []);

  // ضغط حجم الصورة وتقليل جودتها لتجنب أخطاء الحجم في Firestore
  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.2, // تقليل الجودة لضمان صغر حجم الـ Base64
      base64: true,
    });

    if (!result.canceled && result.assets && result.assets[0].base64) {
      const base64Image = `data:image/jpeg;base64,${result.assets[0].base64}`;
      setImage(base64Image);
    }
  };

  const handleUpdate = async () => {
    if (!name || !phone || !tukTukNumber) {
      Alert.alert('تنبيه', 'يجب إدخال الاسم، رقم الهاتف، ورقم لوحة التوكتوك.');
      return;
    }

    setUpdating(true);
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        Alert.alert('خطأ', 'لم يتم العثور على مستخدم مسجل الدخول.');
        setUpdating(false);
        return;
      }

      const docRef = doc(db, 'captains', currentUser.uid);
      await updateDoc(docRef, {
        name: name.trim(),
        phone: phone.trim(),
        tukTukNumber: tukTukNumber.trim(),
        tukTukModel: tukTukModel.trim(),
        image: image,
      });

      Alert.alert('تم بنجاح', 'تم تحديث بيانات الكابتن بنجاح.');
      router.back();
    } catch (error: any) {
      console.log('Error updating profile:', error);
      Alert.alert('خطأ', 'حدثت مشكلة أثناء التحديث: ' + (error.message || 'حجم الصورة قد يكون كبير جداً'));
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.scrollContainer}>
      <View style={styles.container}>
        <Text style={styles.title}>ملف الكابتن الشخصي 👨‍✈️</Text>

        <TouchableOpacity onPress={pickImage} style={styles.imageContainer}>
          {image ? (
            <Image source={{ uri: image }} style={styles.avatar} />
          ) : (
            <View style={styles.placeholderImage}>
              <Text style={styles.placeholderText}>اضغط لإضافة صورة 📷</Text>
            </View>
          )}
        </TouchableOpacity>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>اسم الكابتن</Text>
          <TextInput style={styles.input} value={name} onChangeText={setName} />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>رقم الهاتف</Text>
          <TextInput style={styles.input} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>رقم لوحة التوكتوك</Text>
          <TextInput style={styles.input} value={tukTukNumber} onChangeText={setTukTukNumber} />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>موديل أو لون التوكتوك</Text>
          <TextInput style={styles.input} value={tukTukModel} onChangeText={setTukTukModel} />
        </View>

        {updating ? (
          <ActivityIndicator size="large" color="#2563eb" style={{ marginTop: 20 }} />
        ) : (
          <TouchableOpacity style={styles.saveButton} onPress={handleUpdate}>
            <Text style={styles.saveButtonText}>حفظ التعديلات</Text>
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: { flexGrow: 1, backgroundColor: '#f4f6f9' },
  container: { flex: 1, backgroundColor: '#f4f6f9', padding: 24, justifyContent: 'center' },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 24, fontWeight: 'bold', color: '#2563eb', textAlign: 'center', marginBottom: 20 },
  imageContainer: { alignSelf: 'center', marginBottom: 20 },
  avatar: { width: 100, height: 100, borderRadius: 50, borderWidth: 2, borderColor: '#2563eb' },
  placeholderImage: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#e5e7eb', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#d1d5db' },
  placeholderText: { fontSize: 12, color: '#6b7280', textAlign: 'center', padding: 5 },
  inputGroup: { marginBottom: 15 },
  label: { fontSize: 14, fontWeight: '600', color: '#4b5563', marginBottom: 5, textAlign: 'right' },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 12, fontSize: 16, textAlign: 'right', color: '#333' },
  saveButton: { backgroundColor: '#2563eb', padding: 16, borderRadius: 10, alignItems: 'center', marginTop: 20 },
  saveButtonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
});