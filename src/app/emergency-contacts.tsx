import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Contacts from 'expo-contacts/legacy';
import { useRouter } from 'expo-router';
import { addDoc, collection } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { db } from '../firebase';
import { useApp } from './AppContext';

export default function EmergencyContacts() {
  const router = useRouter();
  const { isDarkMode } = useApp();
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [relation, setRelation] = useState('');
  const [loading, setLoading] = useState(false);
  
  // 👈 حالة لعرض الرقم المحفوظ الحالي
  const [savedEmergencyPhone, setSavedEmergencyPhone] = useState('');

  // 👈 استرجاع الرقم المحفوظ أول ما الصفحة تفتح
  useEffect(() => {
    const fetchSavedPhone = async () => {
      try {
        const savedPhone = await AsyncStorage.getItem('emergency_phone');
        if (savedPhone) {
          setSavedEmergencyPhone(savedPhone);
        }
      } catch (error) {
        console.log('Error fetching saved emergency phone:', error);
      }
    };
    fetchSavedPhone();
  }, []);

  const openContactsList = async () => {
    try {
      const { status } = await Contacts.requestPermissionsAsync();
      if (status === 'granted') {
        const contact = await Contacts.presentContactPickerAsync();
        
        if (contact) {
          setContactName(contact.name || '');
          if (contact.phoneNumbers && contact.phoneNumbers.length > 0) {
            // تنظيف الرقم من المسافات والشرطات
            let cleanedPhone = contact.phoneNumbers[0].number?.replace(/\s|-/g, '') || '';
            setContactPhone(cleanedPhone);
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

      // 1. حفظ في قاعدة بيانات فايربيز (للإدارة)
      await addDoc(collection(db, 'emergencyContacts'), {
        passengerId: passengerId || 'unknown',
        passengerName: passengerName,
        contactName: contactName,
        contactPhone: contactPhone,
        relation: relation || 'غير محدد',
        timestamp: new Date().getTime()
      });

      // 2. 👈 حفظ في ذاكرة الهاتف لرسالة الواتساب
      let formattedPhone = contactPhone;
      if (formattedPhone.startsWith('01')) formattedPhone = '+20' + formattedPhone.substring(1);
      else if (formattedPhone.startsWith('0')) formattedPhone = '+2' + formattedPhone;
      
      await AsyncStorage.setItem('emergency_phone', formattedPhone);
      setSavedEmergencyPhone(formattedPhone);

      Alert.alert('تم بنجاح', 'تم حفظ جهة الاتصال للطوارئ وسيتم إرسال رسالة واتساب لها عند الضغط على "أنا في خطر".');
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

  // 👈 دالة لحذف الرقم المحفوظ
  const handleDeleteSavedContact = async () => {
    Alert.alert(
      'تأكيد الحذف',
      'هل تريد مسح رقم الطوارئ الحالي؟',
      [
        { text: 'إلغاء', style: 'cancel' },
        { 
          text: 'حذف', 
          style: 'destructive', 
          onPress: async () => {
            try {
              await AsyncStorage.removeItem('emergency_phone');
              setSavedEmergencyPhone('');
              Alert.alert('تم', 'تم حذف رقم الطوارئ بنجاح.');
            } catch (error) {
              Alert.alert('خطأ', 'تعذر حذف الرقم.');
            }
          }
        }
      ]
    );
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
          قم بإضافة أرقام أشخاص مقربين ليتم مراسلتهم عبر الواتساب فوراً في حالات الطوارئ.
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
            <Text style={styles.saveBtnText}>حفظ وتعيين للطوارئ</Text>
          )}
        </TouchableOpacity>

        {/* 👈 عرض الرقم المحفوظ مع زر الحذف */}
        {savedEmergencyPhone ? (
          <View style={[styles.savedContactBox, isDarkMode && { backgroundColor: '#1e293b', borderColor: '#475569' }]}>
            <Text style={[styles.savedContactTitle, isDarkMode && { color: '#ffffff' }]}>رقم الطوارئ المسجل حالياً:</Text>
            <View style={styles.savedContactRow}>
<Text style={[styles.savedContactPhone, isDarkMode && { color: '#38bdf8' }]}>{savedEmergencyPhone}</Text>              <Ionicons name="logo-whatsapp" size={24} color="#10b981" />
            </View>
            <Text style={[styles.savedContactHint, isDarkMode && { color: '#94a3b8' }]}>سيتم إرسال رسالة استغاثة لهذا الرقم عند الحاجة.</Text>
            
            <TouchableOpacity style={styles.deleteBtn} onPress={handleDeleteSavedContact}>
              <Ionicons name="trash-outline" size={18} color="#ef4444" />
              <Text style={styles.deleteBtnText}>حذف الرقم المسجل</Text>
            </TouchableOpacity>
          </View>
        ) : null}
        
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
  saveBtnText: { color: '#ffffff', fontSize: 16, fontWeight: 'bold' },

  // 👈 تنسيقات المربع اللي بيعرض الرقم المحفوظ
  savedContactBox: { marginTop: 30, padding: 20, backgroundColor: '#eff6ff', borderRadius: 16, borderWidth: 1, borderColor: '#bfdbfe', alignItems: 'center' },
  savedContactTitle: { fontSize: 16, fontWeight: 'bold', color: '#1e3a8a', marginBottom: 10 },
  savedContactRow: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 8 },
  savedContactPhone: { fontSize: 22, fontWeight: 'bold', color: '#2563eb', letterSpacing: 1 },
  savedContactHint: { fontSize: 12, color: '#64748b', textAlign: 'center', marginBottom: 15 },
  deleteBtn: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fee2e2', paddingVertical: 8, paddingHorizontal: 15, borderRadius: 8, gap: 5 },
  deleteBtnText: { color: '#ef4444', fontWeight: 'bold', fontSize: 14 }
});