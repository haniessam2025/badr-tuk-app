import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { Alert, Image, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { db } from '../firebaseConfig';

export default function CaptainProfile() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [vehicle, setVehicle] = useState('');
  const [avatar, setAvatar] = useState('https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150');

  useEffect(() => {
    loadProfileFromFirebase();
  }, []);

  const loadProfileFromFirebase = async () => {
    try {
      const captainId = await AsyncStorage.getItem('currentCaptainId');
      if (captainId) {
        const docRef = doc(db, 'captains', captainId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setName(data.name || '');
          setPhone(data.phone || '');
          setVehicle(data.tukTukNumber || data.vehicle || '');
          if (data.profileImage) {
            setAvatar(data.profileImage);
          } else if (data.avatar) {
            setAvatar(data.avatar);
          }
        }
      }
    } catch (e) {
      console.log(e);
    }
  };

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.2, // ضغط عالي عشان نتجنب تجاوز مساحة 1 ميجا في فايربيس
      base64: true, // مهم جداً: استخراج كود الصورة بدل المسار المحلي
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const base64String = result.assets[0].base64;
      // تجهيز الكود عشان يتقري كصورة في أي موبايل تاني
      const imageUri = `data:image/jpeg;base64,${base64String}`;
      setAvatar(imageUri);
    }
  };

  const handleSave = async () => {
    try {
      const captainId = await AsyncStorage.getItem('currentCaptainId');
      if (!captainId) {
        Alert.alert('خطأ', 'لم يتم العثور على معرف الكابتن.');
        return;
      }

      const profileData = {
        name,
        phone,
        tukTukNumber: vehicle,
        profileImage: avatar,
      };

      const docRef = doc(db, 'captains', captainId);
      await updateDoc(docRef, profileData);

      const localData = { name, phone, vehicle, avatar };
      await AsyncStorage.setItem('captain_profile', JSON.stringify(localData));

      Alert.alert('تم بنجاح 🎯', 'تم تحديث الملف الشخصي للكابتن وحفظ الصورة في قاعدة البيانات.');
      router.back();
    } catch (error: any) {
      Alert.alert('خطأ في الحفظ', error?.message || 'حدثت مشكلة أثناء تحديث البيانات.');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>⚙️ تعديل الملف الشخصي للكابتن</Text>

      <View style={styles.avatarContainer}>
        <TouchableOpacity onPress={pickImage}>
          <Image source={{ uri: avatar }} style={styles.avatar} />
          <View style={styles.cameraBadge}>
            <Text style={styles.cameraBadgeText}>📷 تغيير</Text>
          </View>
        </TouchableOpacity>
      </View>

      <Text style={styles.label}>اسم الكابتن:</Text>
      <TextInput 
        style={styles.input} 
        value={name} 
        onChangeText={setName} 
        placeholder="اسم الكابتن" 
        placeholderTextColor="#94a3b8" 
      />

      <Text style={styles.label}>رقم الهاتف:</Text>
      <TextInput 
        style={styles.input} 
        value={phone} 
        onChangeText={setPhone} 
        keyboardType="phone-pad" 
        placeholder="رقم الهاتف" 
        placeholderTextColor="#94a3b8" 
      />

      <Text style={styles.label}>نوع ورقم المركبة:</Text>
      <TextInput 
        style={styles.input} 
        value={vehicle} 
        onChangeText={setVehicle} 
        placeholder="مثال: توكتوك (Ghj 124)" 
        placeholderTextColor="#94a3b8" 
      />

      <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
        <Text style={styles.saveButtonText}>حفظ التعديلات</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9', padding: 20, paddingTop: 50 },
  title: { fontSize: 22, fontWeight: 'bold', color: '#1e293b', marginBottom: 25, textAlign: 'center' },
  avatarContainer: { alignItems: 'center', marginBottom: 25 },
  avatar: { width: 100, height: 100, borderRadius: 50, borderWidth: 3, borderColor: '#10b981' },
  cameraBadge: { 
    position: 'absolute', 
    bottom: 0, 
    right: 0, 
    backgroundColor: '#1e293b', 
    paddingHorizontal: 8, 
    paddingVertical: 4, 
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ffffff'
  },
  cameraBadgeText: { color: '#ffffff', fontSize: 11, fontWeight: 'bold' },
  label: { fontSize: 14, fontWeight: 'bold', color: '#475569', marginBottom: 6, textAlign: 'right' },
  input: { backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 12, padding: 12, fontSize: 15, marginBottom: 20, textAlign: 'right', color: '#0f172a' },
  saveButton: { backgroundColor: '#10b981', paddingVertical: 15, borderRadius: 14, alignItems: 'center', marginTop: 10, elevation: 3 },
  saveButtonText: { color: '#ffffff', fontSize: 18, fontWeight: 'bold' },
});