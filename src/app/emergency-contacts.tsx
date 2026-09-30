import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { addDoc, collection } from 'firebase/firestore';
import { useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { db } from '../firebase';
import { useApp } from './AppContext';
// 👈 رجعنا للاستيراد الأساسي لأننا هنستخدم الدالة الحديثة
import * as Contacts from 'expo-contacts/legacy';

export default function EmergencyContacts() {
  const router = useRouter();
  const { isDarkMode } = useApp();
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [relation, setRelation] = useState('');
  const [loading, setLoading] = useState(false);

  // 📍 دالة فتح دليل الهاتف الأساسي للموبايل
  const openContactsList = async () => {
    try {
      const { status } = await Contacts.requestPermissionsAsync();
      if (status === 'granted') {
        // السطر ده هو اللي بيفتح دليل الهاتف بتاع الأندرويد/الآيفون
        const contact = await Contacts.presentContactPickerAsync();
        
        // لو الراكب اختار رقم (معملش إلغاء)
        if (contact) {
          setContactName(contact.name || '');
          // نتأكد إن الاسم اللي اختاره متسجل ليه رقم تليفون
          if (contact.phoneNumbers && contact.phoneNumbers.length > 0) {
            setContactPhone(contact.phoneNumbers[0].number || '');
          } else {
            Alert.alert('تنبيه', 'جهة الاتصال هذه لا تحتوي على رقم هاتف.');
          }
        }
      } else {
        Alert.alert('تنبيه', 'يجب السماح للتطبيق بالوصول لجهات الاتصال لتفعيل هذه الميزة.');
      }
    } catch (error) {
      console.log('Error picking contact: ', error);
    }
  };

  const handleSaveContact = async () => {
    if (!contactName.trim() || !contactPhone.trim()) {
      Alert.alert('تنبيه', 'برجاء إدخال اسم ورقم جهة الاتصال.');
      return;
    }

    setLoading(true);
    try {
      const passengerId = await AsyncStorage.getItem('currentPassengerId');
      const passengerProfileStr = await AsyncStorage.getItem('passenger_profile');
      let passengerName = 'راكب غير معروف';
      
      if (passengerProfileStr) {
        const profile = JSON.parse(passengerProfileStr);
        passengerName = profile.name;
      }

      await addDoc(collection(db, 'emergencyContacts'), {
        passengerId: passengerId || 'unknown',
        passengerName: passengerName,
        contactName: contactName,
        contactPhone: contactPhone,
        relation: relation || 'غير محدد',
        timestamp: new Date().getTime()
      });

      Alert.alert('تم بنجاح', 'تم حفظ جهة الاتصال للطوارئ.');
      setContactName('');
      setContactPhone('');
      setRelation('');
    } catch (error) {
      console.log('Error saving contact:', error);
      Alert.alert('خطأ', 'حدثت مشكلة أثناء الحفظ، حاول مرة أخرى.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, isDarkMode && { backgroundColor: '#0f172a' }]}>
      <View style={[styles.header, isDarkMode && { backgroundColor: '#1e293b', borderBottomColor: '#334155' }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-forward" size={24} color={isDarkMode ? "#ffffff" : "#1e293b"} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, isDarkMode && { color: '#ffffff' }]}>جهات اتصال الطوارئ</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.content}>
        <Text style={[styles.infoText, isDarkMode && { color: '#cbd5e1' }]}>
          قم بإضافة أرقام أشخاص مقربين ليتم التواصل معهم من قبل الإدارة في حالات الطوارئ الشديدة.
        </Text>

        <View style={styles.inputRow}>
          <TextInput
            style={[styles.inputFlex, isDarkMode && styles.inputDark]}
            placeholder="اسم جهة الاتصال (مثال: أخي، والدي)"
            placeholderTextColor={isDarkMode ? '#64748b' : '#94a3b8'}
            value={contactName}
            onChangeText={setContactName}
          />
          
          <TouchableOpacity style={[styles.contactPickBtn, isDarkMode && { backgroundColor: '#1e293b', borderColor: '#475569' }]} onPress={openContactsList}>
            <Ionicons name="people" size={26} color="#3b82f6" />
          </TouchableOpacity>
        </View>

        <TextInput
          style={[styles.input, isDarkMode && styles.inputDark]}
          placeholder="رقم الهاتف"
          placeholderTextColor={isDarkMode ? '#64748b' : '#94a3b8'}
          keyboardType="phone-pad"
          value={contactPhone}
          onChangeText={setContactPhone}
        />

        <TextInput
          style={[styles.input, isDarkMode && styles.inputDark]}
          placeholder="صلة القرابة (اختياري)"
          placeholderTextColor={isDarkMode ? '#64748b' : '#94a3b8'}
          value={relation}
          onChangeText={setRelation}
        />

        <TouchableOpacity 
          style={styles.saveBtn} 
          onPress={handleSaveContact}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.saveBtnText}>حفظ وإضافة</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#ffffff', paddingHorizontal: 20, paddingTop: 50, paddingBottom: 15, borderBottomWidth: 1, borderBottomColor: '#e2e8f0', elevation: 2 },
  backBtn: { padding: 5 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#1e293b' },
  content: { padding: 20 },
  infoText: { fontSize: 14, color: '#475569', textAlign: 'center', marginBottom: 20, lineHeight: 22 },
  
  input: { backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 12, padding: 15, fontSize: 16, marginBottom: 15, textAlign: 'right', color: '#1e293b' },
  inputRow: { flexDirection: 'row-reverse', alignItems: 'center', marginBottom: 15, gap: 10 },
  inputFlex: { flex: 1, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 12, padding: 15, fontSize: 16, textAlign: 'right', color: '#1e293b' },
  
  contactPickBtn: { backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#cbd5e1', width: 60, height: 55, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  
  inputDark: { backgroundColor: '#1e293b', borderColor: '#475569', color: '#ffffff' },
  saveBtn: { backgroundColor: '#10b981', paddingVertical: 15, borderRadius: 12, alignItems: 'center', marginTop: 10 },
  saveBtnText: { color: '#ffffff', fontSize: 16, fontWeight: 'bold' }
});