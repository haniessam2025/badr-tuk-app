import AsyncStorage from '@react-native-async-storage/async-storage';
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
        setName(data.name);
        setPhone(data.phone);
        setVehicle(data.vehicle);
        setAvatar(data.avatar);
      }
    } catch (e) {
      console.log(e);
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
        <Image source={{ uri: avatar }} style={styles.avatar} />
      </View>

      <Text style={styles.label}>اسم الكابتن:</Text>
      <TextInput style={styles.input} value={name} onChangeText={setName} />

      <Text style={styles.label}>رقم الهاتف:</Text>
      <TextInput style={styles.input} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />

      <Text style={styles.label}>نوع ورقم المركبة:</Text>
      <TextInput style={styles.input} value={vehicle} onChangeText={setVehicle} />

      <Text style={styles.label}>رابط الصورة الشخصية (URL):</Text>
      <TextInput style={styles.input} value={avatar} onChangeText={setAvatar} />

      <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
        <Text style={styles.saveButtonText}>حفظ التعديلات</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9', padding: 20, paddingTop: 50 },
  title: { fontSize: 22, fontWeight: 'bold', color: '#1e293b', marginBottom: 25, textAlign: 'center' },
  avatarContainer: { alignItems: 'center', marginBottom: 20 },
  avatar: { width: 90, height: 90, borderRadius: 45, borderWidth: 2, borderColor: '#10b981' },
  label: { fontSize: 14, fontWeight: 'bold', color: '#475569', marginBottom: 6, textAlign: 'right' },
  input: { backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 12, padding: 12, fontSize: 15, marginBottom: 15, textAlign: 'right', color: '#0f172a' },
  saveButton: { backgroundColor: '#10b981', paddingVertical: 15, borderRadius: 14, alignItems: 'center', marginTop: 10, elevation: 3 },
  saveButtonText: { color: '#ffffff', fontSize: 18, fontWeight: 'bold' },
});