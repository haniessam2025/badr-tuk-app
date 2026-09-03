import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { db } from '../firebaseConfig';

export default function PassengerProfile() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [newAvatarUrl, setNewAvatarUrl] = useState('');

  const [profile, setProfile] = useState({
    id: '',
    name: '',
    phone: '',
    avatar: 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png',
  });

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const passengerId = await AsyncStorage.getItem('currentPassengerId');
      if (!passengerId) {
        router.replace('/passenger-login');
        return;
      }

      // تحميل مبدئي من الذاكرة
      const savedProfile = await AsyncStorage.getItem('passenger_profile');
      if (savedProfile) {
        setProfile(JSON.parse(savedProfile));
      }

      // تحديث من فايربيس
      const docRef = doc(db, 'passengers', passengerId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        const updatedProfile = {
          id: passengerId,
          name: data.name || profile.name,
          phone: data.phone || profile.phone,
          avatar: data.avatar || profile.avatar,
        };
        setProfile(updatedProfile);
        await AsyncStorage.setItem('passenger_profile', JSON.stringify(updatedProfile));
      }
    } catch (error) {
      console.log(error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateAvatar = async () => {
    if (!newAvatarUrl.trim()) {
      Alert.alert('تنبيه', 'برجاء إدخال رابط الصورة.');
      return;
    }

    setSaving(true);
    try {
      const docRef = doc(db, 'passengers', profile.id);
      await updateDoc(docRef, { avatar: newAvatarUrl.trim() });

      const updatedProfile = { ...profile, avatar: newAvatarUrl.trim() };
      setProfile(updatedProfile);
      await AsyncStorage.setItem('passenger_profile', JSON.stringify(updatedProfile));

      setIsModalVisible(false);
      setNewAvatarUrl('');
      Alert.alert('نجاح', 'تم تحديث الصورة الشخصية بنجاح.');
    } catch (error) {
      Alert.alert('خطأ', 'حدثت مشكلة أثناء تحديث الصورة.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#d97706" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>⬅ رجوع</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>الملف الشخصي</Text>
      </View>

      <View style={styles.avatarContainer}>
        <Image source={{ uri: profile.avatar }} style={styles.avatar} />
        <TouchableOpacity style={styles.editAvatarBtn} onPress={() => setIsModalVisible(true)}>
          <Text style={styles.editAvatarText}>📷 تغيير الصورة</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.formContainer}>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>الاسم (غير قابل للتعديل)</Text>
          <TextInput
            style={styles.disabledInput}
            value={profile.name}
            editable={false}
            selectTextOnFocus={false}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>رقم الهاتف (غير قابل للتعديل)</Text>
          <TextInput
            style={styles.disabledInput}
            value={profile.phone}
            editable={false}
            selectTextOnFocus={false}
          />
        </View>
      </View>

      <Modal visible={isModalVisible} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>تحديث الصورة الشخصية</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="ضع رابط الصورة الجديدة هنا"
              value={newAvatarUrl}
              onChangeText={setNewAvatarUrl}
              textAlign="right"
            />
            <View style={styles.modalButtonsRow}>
              <TouchableOpacity style={styles.modalSaveBtn} onPress={handleUpdateAvatar} disabled={saving}>
                {saving ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.modalSaveBtnText}>حفظ الصورة</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setIsModalVisible(false)} disabled={saving}>
                <Text style={styles.modalCancelBtnText}>إلغاء</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffffff', padding: 15, paddingTop: 45, elevation: 2 },
  backBtn: { padding: 8, backgroundColor: '#f1f5f9', borderRadius: 8 },
  backBtnText: { fontWeight: 'bold', color: '#334155' },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#1e293b', flex: 1, textAlign: 'center', marginRight: 40 },
  avatarContainer: { alignItems: 'center', marginTop: 30, marginBottom: 20 },
  avatar: { width: 120, height: 120, borderRadius: 60, backgroundColor: '#cbd5e1', borderWidth: 3, borderColor: '#d97706' },
  editAvatarBtn: { marginTop: 10, backgroundColor: '#fef3c7', paddingVertical: 6, paddingHorizontal: 15, borderRadius: 20, borderWidth: 1, borderColor: '#d97706' },
  editAvatarText: { color: '#d97706', fontWeight: 'bold', fontSize: 14 },
  formContainer: { padding: 20 },
  inputGroup: { marginBottom: 20 },
  label: { fontSize: 14, fontWeight: 'bold', color: '#64748b', marginBottom: 8, textAlign: 'right' },
  disabledInput: { backgroundColor: '#e2e8f0', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 12, padding: 15, fontSize: 16, color: '#475569', textAlign: 'right' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { backgroundColor: '#ffffff', width: '100%', padding: 20, borderRadius: 20 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#1e293b', marginBottom: 15, textAlign: 'center' },
  modalInput: { backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 12, padding: 12, fontSize: 14, marginBottom: 20 },
  modalButtonsRow: { flexDirection: 'row-reverse', gap: 10 },
  modalSaveBtn: { flex: 1, backgroundColor: '#d97706', paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  modalSaveBtnText: { color: '#ffffff', fontWeight: 'bold', fontSize: 16 },
  modalCancelBtn: { flex: 1, backgroundColor: '#fee2e2', paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  modalCancelBtnText: { color: '#ef4444', fontWeight: 'bold', fontSize: 16 },
});