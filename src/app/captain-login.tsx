import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { collection, doc, getDocs, query, updateDoc, where } from 'firebase/firestore';
import { useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { db } from '../firebaseConfig';

export default function CaptainLoginScreen() {
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async () => {
    if (!name.trim() || !password.trim()) {
      Alert.alert('خطأ', 'يرجى إدخال اسم المستخدم وكلمة المرور.');
      return;
    }

    setLoading(true);
    try {
      const inputValue = name.trim();
      
      // البحث باسم المستخدم فقط
      const q = query(collection(db, 'captains'), where('name', '==', inputValue));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        setLoading(false);
        Alert.alert('خطأ', 'اسم المستخدم غير مسجل في النظام. (تأكد من الحروف الكبيرة والصغيرة، مثال: Haniessam).');
        return;
      }

      let captainId = '';
      let captainDocData: any = null;
      let found = false;
      let dbSavedPassword = '';

      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        dbSavedPassword = data.password ? String(data.password).trim() : 'غير مسجل';

        if (dbSavedPassword === password.trim() || !data.password) {
          captainDocData = data;
          captainId = docSnap.id;
          found = true;
        }
      });

      if (!found) {
        setLoading(false);
        Alert.alert('خطأ', `كلمة المرور غير صحيحة.\n\n(للتوضيح: الباسورد المسجل لهذا الحساب هو: ${dbSavedPassword})`);
        return;
      }

      if (!captainDocData.password) {
        try {
          await updateDoc(doc(db, 'captains', captainId), { password: password.trim() });
        } catch (e) { console.log("خطأ في تحديث الباسورد", e); }
      }

      await AsyncStorage.multiRemove([
        'currentCaptainId',
        'captain_profile',
        'active_ride',
        'currentPassengerId' 
      ]);

      await AsyncStorage.setItem('currentCaptainId', captainId);

      // سحب الصورة الصحيحة من فايربيس
      const safeAvatar = captainDocData.profileImage || captainDocData.avatar || captainDocData.image || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150';

      const newCaptainProfile = {
        id: captainId,
        name: captainDocData.name || inputValue,
        phone: captainDocData.phone || '01000000000',
        vehicle: captainDocData.tukTukNumber || captainDocData.vehicle || 'توكتوك',
        avatar: safeAvatar,
      };

      await AsyncStorage.setItem('captain_profile', JSON.stringify(newCaptainProfile));

      setLoading(false);
      router.replace('/captain-home'); 

    } catch (error) {
      setLoading(false);
      Alert.alert('خطأ', 'حدثت مشكلة أثناء تسجيل الدخول. تأكد من اتصالك بالإنترنت.');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>تسجيل دخول الكابتن 👨‍✈️</Text>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>اسم المستخدم</Text>
        <TextInput 
          style={styles.input} 
          placeholder="اكتب اسم المستخدم الخاص بك" 
          placeholderTextColor="#9ca3af"
          value={name} 
          onChangeText={setName} 
          autoCapitalize="none"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>كلمة المرور</Text>
        <TextInput 
          style={styles.input} 
          placeholder="كلمة المرور" 
          placeholderTextColor="#9ca3af"
          secureTextEntry 
          value={password} 
          onChangeText={setPassword} 
        />
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#2563eb" style={{ marginTop: 20 }} />
      ) : (
        <TouchableOpacity style={styles.button} onPress={handleLogin}>
          <Text style={styles.buttonText}>تسجيل الدخول</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f6f9', padding: 24, justifyContent: 'center' },
  title: { fontSize: 26, fontWeight: 'bold', color: '#2563eb', textAlign: 'center', marginBottom: 30 },
  inputGroup: { marginBottom: 15 },
  label: { fontSize: 14, fontWeight: '600', color: '#4b5563', marginBottom: 5, textAlign: 'right' },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 12, fontSize: 16, textAlign: 'right', color: '#333' },
  button: { backgroundColor: '#2563eb', padding: 16, borderRadius: 10, alignItems: 'center', marginTop: 10 },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
});