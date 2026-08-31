import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { auth, db } from '../firebaseConfig';

export default function PassengerProfile() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [avatar, setAvatar] = useState('');
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      // محاولة جلب البيانات من فايربيز أولاً (لأنها الأدق)
      const currentUser = auth.currentUser;
      let uid = currentUser?.uid;
      
      // لو لم نجد uid في auth، نجلبه من AsyncStorage
      if (!uid) {
         uid = await AsyncStorage.getItem('currentPassengerId');
      }

      if (uid) {
        const docRef = doc(db, 'passengers', uid);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const data = docSnap.data();
          setName(data.name || '');
          setPhone(data.phone || '');
          // توحيد اسم الصورة سواء كانت مسجلة باسم avatar أو image
          const imageUrl = data.avatar || data.image || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150';
          setAvatar(imageUrl);
          
          // تحديث التخزين المحلي بالبيانات الجديدة القادمة من السيرفر
          await AsyncStorage.setItem('passenger_profile', JSON.stringify({
            name: data.name,
            phone: data.phone,
            avatar: imageUrl
          }));
        }
      } else {
        // حالة احتياطية: جلب البيانات من التخزين المحلي إذا لم يكن هناك اتصال
        const saved = await AsyncStorage.getItem('passenger_profile');
        if (saved) {
          const data = JSON.parse(saved);
          setName(data.name || '');
          setPhone(data.phone || '');
          if (data.avatar) setAvatar(data.avatar);
        }
      }
    } catch (error) {
      console.log('خطأ في جلب الملف الشخصي:', error);
    } finally {
      setLoading(false);
    }
  };

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5, // تقليل الجودة لتصغير حجم النص (Base64)
      base64: true, // تفعيل ميزة Base64 المأخوذة من الكود الجديد
    });

    if (!result.canceled && result.assets && result.assets[0].base64) {
      // تحويل الصورة لنص متوافق ليتم حفظه في قاعدة البيانات مباشرة
      const base64Image = `data:image/jpeg;base64,${result.assets[0].base64}`;
      setAvatar(base64Image);
    }
  };

  const handleSave = async () => {
    if (!name || !phone) {
      Alert.alert('تنبيه', 'يجب إدخال الاسم ورقم الهاتف.');
      return;
    }

    setUpdating(true);
    try {
      const currentUser = auth.currentUser;
      let uid = currentUser?.uid;
      
      if (!uid) {
         uid = await AsyncStorage.getItem('currentPassengerId');
      }

      const profileData = { 
        name: name.trim(), 
        phone: phone.trim(), 
        avatar: avatar 
      };

      // 1. التحديث المحلي
      await AsyncStorage.setItem('passenger_profile', JSON.stringify(profileData));

      // 2. التحديث في فايربيز
      if (uid) {
        const docRef = doc(db, 'passengers', uid);
        await updateDoc(docRef, profileData);
      }

      Alert.alert('تم بنجاح 🎯', 'تم تحديث الملف الشخصي بنجاح.');
      router.back();
    } catch (error) {
      console.error(error);
      Alert.alert('خطأ 🛑', 'حدثت مشكلة أثناء حفظ البيانات.');
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f1f5f9' }}>
        <ActivityIndicator size="large" color="#d97706" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>⚙️ تعديل الملف الشخصي للراكب</Text>

      <View style={styles.avatarContainer}>
        <TouchableOpacity onPress={pickImage}>
          <Image 
            source={{ uri: avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150' }} 
            style={styles.avatar} 
          />
          <View style={styles.cameraBadge}>
            <Text style={styles.cameraBadgeText}>📷 تغيير</Text>
          </View>
        </TouchableOpacity>
      </View>

      <Text style={styles.label}>اسم الراكب:</Text>
      <TextInput 
        style={styles.input} 
        value={name} 
        onChangeText={setName} 
        placeholder="اكتب اسمك هنا" 
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

      {updating ? (
        <ActivityIndicator size="large" color="#d97706" style={{ marginTop: 20 }} />
      ) : (
        <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
          <Text style={styles.saveButtonText}>حفظ التعديلات</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9', padding: 20, paddingTop: 50 },
  title: { fontSize: 22, fontWeight: 'bold', color: '#1e293b', marginBottom: 25, textAlign: 'center' },
  avatarContainer: { alignItems: 'center', marginBottom: 25 },
  avatar: { width: 100, height: 100, borderRadius: 50, borderWidth: 3, borderColor: '#d97706' },
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
  saveButton: { backgroundColor: '#d97706', paddingVertical: 15, borderRadius: 14, alignItems: 'center', marginTop: 10, elevation: 3 },
  saveButtonText: { color: '#ffffff', fontSize: 18, fontWeight: 'bold' },
});