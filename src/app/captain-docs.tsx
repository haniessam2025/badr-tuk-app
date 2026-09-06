import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { db } from '../firebaseConfig';

export default function CaptainDocs() {
  const router = useRouter();
  const [docs, setDocs] = useState<any>({ idFront: null, idBack: null, vehicleImage: null });
  const [loading, setLoading] = useState(true);
  const [captainId, setCaptainId] = useState('');
  const [uploadingField, setUploadingField] = useState<string | null>(null);

  useEffect(() => {
    fetchDocs();
  }, []);

  const fetchDocs = async () => {
    try {
      const id = await AsyncStorage.getItem('currentCaptainId');
      if (!id) return;
      setCaptainId(id);

      const docRef = doc(db, 'captains', id);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        setDocs({
          idFront: data.idFront || null,
          idBack: data.idBack || null,
          vehicleImage: data.vehicleImage || null
        });
      }
    } catch (error) {
      console.log('Error fetching docs:', error);
    } finally {
      setLoading(false);
    }
  };

  const pickImage = async (field: string) => {
    // طلب صلاحية الدخول للاستوديو
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('تنبيه', 'نحتاج صلاحية الدخول لمعرض الصور لاختيار المستند.');
      return;
    }

    // فتح الاستوديو
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, // السماح بقص الصورة
      quality: 0.4, // تقليل الجودة قليلاً لسرعة الرفع وتقليل المساحة
      base64: true, // مهم جداً عشان نحفظها في قاعدة البيانات مباشرة
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      uploadImage(field, `data:image/jpeg;base64,${result.assets[0].base64}`);
    }
  };

  const uploadImage = async (field: string, base64String: string) => {
    setUploadingField(field);
    try {
      const docRef = doc(db, 'captains', captainId);
      await updateDoc(docRef, {
        [field]: base64String
      });
      
      // تحديث الواجهة فوراً
      setDocs((prev: any) => ({ ...prev, [field]: base64String }));
      Alert.alert('نجاح ✅', 'تم رفع المستند بنجاح وحفظه في ملفك.');
    } catch (error) {
      Alert.alert('خطأ', 'حدثت مشكلة أثناء حفظ المستند، حاول مرة أخرى.');
    } finally {
      setUploadingField(null);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>رجوع ⬅️</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>المستندات الرسمية 📄</Text>
      </View>

      {loading ? (
        <View style={styles.centerContainer}><ActivityIndicator size="large" color="#2563eb" /></View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 30 }}>
          
          <Text style={styles.infoText}>
            الرجاء التأكد من رفع جميع المستندات المطلوبة بوضوح لضمان استمرار تفعيل حسابك.
          </Text>

          {/* بطاقة الرقم القومي (الوجه) */}
          <View style={styles.docCard}>
            <Text style={styles.docLabel}>البطاقة (الوجه الأمامي)</Text>
            {docs.idFront ? (
              <Image source={{ uri: docs.idFront }} style={styles.docImage} />
            ) : (
              <View style={styles.missingContainer}>
                <Text style={styles.missingText}>غير متوفر</Text>
                <TouchableOpacity style={styles.uploadBtn} onPress={() => pickImage('idFront')} disabled={uploadingField === 'idFront'}>
                  {uploadingField === 'idFront' ? <ActivityIndicator color="#fff" /> : <Text style={styles.uploadBtnText}>رفع الصورة 📷</Text>}
                </TouchableOpacity>
              </View>
            )}
          </View>
          
          {/* بطاقة الرقم القومي (الظهر) */}
          <View style={styles.docCard}>
            <Text style={styles.docLabel}>البطاقة (الوجه الخلفي)</Text>
            {docs.idBack ? (
              <Image source={{ uri: docs.idBack }} style={styles.docImage} />
            ) : (
              <View style={styles.missingContainer}>
                <Text style={styles.missingText}>غير متوفر</Text>
                <TouchableOpacity style={styles.uploadBtn} onPress={() => pickImage('idBack')} disabled={uploadingField === 'idBack'}>
                  {uploadingField === 'idBack' ? <ActivityIndicator color="#fff" /> : <Text style={styles.uploadBtnText}>رفع الصورة 📷</Text>}
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* صورة التوكتوك */}
          <View style={styles.docCard}>
            <Text style={styles.docLabel}>صورة التوكتوك / المركبة</Text>
            {docs.vehicleImage ? (
              <Image source={{ uri: docs.vehicleImage }} style={styles.docImage} />
            ) : (
              <View style={styles.missingContainer}>
                <Text style={styles.missingText}>غير متوفر</Text>
                <TouchableOpacity style={styles.uploadBtn} onPress={() => pickImage('vehicleImage')} disabled={uploadingField === 'vehicleImage'}>
                  {uploadingField === 'vehicleImage' ? <ActivityIndicator color="#fff" /> : <Text style={styles.uploadBtnText}>رفع الصورة 📷</Text>}
                </TouchableOpacity>
              </View>
            )}
          </View>

        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9', padding: 15, paddingTop: 45 },
  header: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#1e293b' },
  backBtn: { backgroundColor: '#e2e8f0', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8 },
  backBtnText: { color: '#334155', fontWeight: 'bold' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  infoText: { fontSize: 13, color: '#64748b', textAlign: 'right', marginBottom: 20, lineHeight: 20 },
  
  docCard: { backgroundColor: '#ffffff', padding: 15, borderRadius: 14, marginBottom: 15, borderWidth: 1, borderColor: '#e2e8f0', elevation: 2 },
  docLabel: { fontSize: 16, fontWeight: 'bold', color: '#1e293b', marginBottom: 15, textAlign: 'right', borderBottomWidth: 1, borderColor: '#f1f5f9', paddingBottom: 10 },
  docImage: { width: '100%', height: 200, borderRadius: 10, resizeMode: 'cover', borderWidth: 1, borderColor: '#cbd5e1' },
  
  missingContainer: { alignItems: 'center', backgroundColor: '#f8fafc', padding: 25, borderRadius: 12, borderWidth: 1, borderColor: '#cbd5e1', borderStyle: 'dashed' },
  missingText: { color: '#ef4444', fontSize: 16, fontWeight: 'bold', marginBottom: 15 },
  uploadBtn: { backgroundColor: '#2563eb', paddingVertical: 12, paddingHorizontal: 30, borderRadius: 10 },
  uploadBtnText: { color: '#ffffff', fontWeight: 'bold', fontSize: 15 }
});