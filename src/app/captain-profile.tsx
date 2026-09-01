import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Image, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

export default function CaptainProfile() {
  const router = useRouter();
  const [name, setName] = useState('Haniessam');
  const [phone, setPhone] = useState('01030369008');
  const [vehicle, setVehicle] = useState('توكتوك (Ghj 124)');
  const [avatar, setAvatar] = useState('https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150');

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const saved = await AsyncStorage.getItem('captain_profile');
      if (saved) {
        const data = JSON.parse(saved);
        setName(data.name || 'Haniessam');
        setPhone(data.phone || '01030369008');
        setVehicle(data.vehicle || 'توكتوك (Ghj 124)');
        if (data.avatar) setAvatar(data.avatar);
      }
    } catch (e) {
      console.log(e);
    }
  };

  // اختيار صورة من ألبوم الموبايل للكابتن
  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      setAvatar(result.assets[0].uri);
    }
  };

  const handleSave = async () => {
    const profileData = { name, phone, vehicle, avatar };
    await AsyncStorage.setItem('captain_profile', JSON.stringify(profileData));
    Alert.alert('تم بنجاح 🎯', 'تم تحديث الملف الشخصي للكابتن.');
    router.back();
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