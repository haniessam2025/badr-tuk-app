import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { addDoc, collection, deleteDoc, doc, getDoc, updateDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { db } from '../firebase';
import { useApp } from './AppContext';

export default function Settings() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  
  const [userId, setUserId] = useState<string | null>(null);
  const [userType, setUserType] = useState<'passengers' | 'captains' | null>(null);
  const [loginRoute, setLoginRoute] = useState<any>('/');

  // سحب الإعدادات من العقل المركزي
  const { isDarkMode, isVibrationEnabled, toggleTheme, toggleVibration } = useApp();

  const [isPasswordModalVisible, setIsPasswordModalVisible] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  useEffect(() => {
    const identifyUser = async () => {
      try {
        const passengerId = await AsyncStorage.getItem('currentPassengerId');
        if (passengerId) {
          setUserId(passengerId); setUserType('passengers'); setLoginRoute('/passenger-login');
        } else {
          const captainId = await AsyncStorage.getItem('currentCaptainId');
          if (captainId) {
            setUserId(captainId); setUserType('captains'); setLoginRoute('/captain-login');
          } else {
            router.back(); return;
          }
        }
      } catch (error) {
        console.log("Error identifying user:", error);
      } finally {
        setIsLoading(false);
      }
    };
    identifyUser();
  }, []);

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmNewPassword) { Alert.alert('⚠️', 'برجاء ملء جميع الحقول.'); return; }
    if (newPassword !== confirmNewPassword) { Alert.alert('❌', 'كلمة السر الجديدة غير متطابقة.'); return; }
    if (newPassword.length < 6) { Alert.alert('⚠️', 'يجب أن تتكون كلمة السر من 6 أحرف أو أرقام على الأقل.'); return; }

    setIsUpdatingPassword(true);
    try {
      if (!userId || !userType) return;
      const userDocRef = doc(db, userType, userId);
      const userDoc = await getDoc(userDocRef);
      
      if (userDoc.exists() && userDoc.data().password !== currentPassword) {
        Alert.alert('❌', 'كلمة السر الحالية غير صحيحة.');
        setIsUpdatingPassword(false); return;
      }
      
      await updateDoc(userDocRef, { password: newPassword });
      
      Alert.alert('✅', 'تم تغيير كلمة السر بنجاح. سيتم تسجيل خروجك الآن.', [{ text: 'حسناً', onPress: async () => { await AsyncStorage.clear(); router.replace(loginRoute); } }]);
    } catch (error) { 
      Alert.alert('خطأ', 'حدثت مشكلة أثناء التحديث.'); 
    } finally { 
      setIsUpdatingPassword(false); 
    }
  };

  const confirmDeleteAccount = () => {
    Alert.alert(
      'تحذير أمني خطير 🚨',
      'هل أنت متأكد من رغبتك في حذف حسابك نهائياً؟ سيتم مسح جميع بياناتك ولن تتمكن من استرجاعها.',
      [{ text: 'إلغاء', style: 'cancel' }, { text: 'حذف الحساب نهائياً', style: 'destructive', onPress: executeAccountDeletion }]
    );
  };

  const executeAccountDeletion = async () => {
    setIsLoading(true);
    try {
      if (!userId || !userType) return;
      const userDocRef = doc(db, userType, userId);
      const userDoc = await getDoc(userDocRef);
      const userName = userDoc.exists() ? userDoc.data().name : 'غير معروف';
      const userPhone = userDoc.exists() ? userDoc.data().phone : 'غير معروف';

      await addDoc(collection(db, 'notifications'), {
        title: 'حذف حساب 🚨',
        message: `قام ${userType === 'captains' ? 'الكابتن' : 'الراكب'} (${userName} - ${userPhone}) بحذف حسابه نهائياً.`,
        type: 'account_deleted', userId: userId, userType: userType, timestamp: new Date().getTime(), read: false
      });

      await deleteDoc(userDocRef);
      await AsyncStorage.clear();
      Alert.alert('✅', 'تم حذف حسابك بنجاح.');
      router.replace(loginRoute);
    } catch (error) {
      setIsLoading(false); Alert.alert('خطأ', 'حدث خطأ في الاتصال.');
    }
  };

  if (isLoading) return ( <View style={[styles.loadingContainer, isDarkMode && { backgroundColor: '#0f172a' }]}><ActivityIndicator size="large" color="#3b82f6" /></View> );

  return (
    <View style={[styles.container, isDarkMode && { backgroundColor: '#0f172a' }]}>
      <View style={[styles.header, isDarkMode && { backgroundColor: '#1e293b', borderColor: '#334155' }]}>
        <TouchableOpacity style={[styles.backBtn, isDarkMode && { backgroundColor: '#334155', borderColor: '#475569' }]} onPress={() => router.back()}>
          <Text style={[styles.backBtnText, isDarkMode && { color: '#e2e8f0' }]}>➔ رجوع</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, isDarkMode && { color: '#ffffff' }]}>الإعدادات</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionTitle}>تفضيلات التطبيق</Text>
        <View style={[styles.sectionCard, isDarkMode && { backgroundColor: '#1e293b', borderColor: '#334155' }]}>
          <View style={styles.settingRow}>
            <View style={styles.settingTextCol}>
              <Text style={[styles.settingTitle, isDarkMode && { color: '#ffffff' }]}>المظهر الداكن (Dark Mode)</Text>
              <Text style={styles.settingSubtitle}>تفعيل الوضع الليلي لإراحة العين</Text>
            </View>
            <Switch trackColor={{ false: '#cbd5e1', true: '#3b82f6' }} thumbColor={isDarkMode ? '#60a5fa' : '#f8fafc'} onValueChange={toggleTheme} value={isDarkMode} />
          </View>
          <View style={[styles.divider, isDarkMode && { backgroundColor: '#334155' }]} />
          
          <View style={styles.settingRow}>
            <View style={styles.settingTextCol}>
              <Text style={[styles.settingTitle, isDarkMode && { color: '#ffffff' }]}>الاهتزاز (Vibration)</Text>
              <Text style={styles.settingSubtitle}>تفعيل الهزاز عند وصول إشعار</Text>
            </View>
            <Switch trackColor={{ false: '#cbd5e1', true: '#3b82f6' }} thumbColor={isVibrationEnabled ? '#60a5fa' : '#f8fafc'} onValueChange={toggleVibration} value={isVibrationEnabled} />
          </View>
        </View>

        <Text style={styles.sectionTitle}>إعدادات الحساب والأمان</Text>
        <View style={[styles.sectionCard, isDarkMode && { backgroundColor: '#1e293b', borderColor: '#334155' }]}>
          <TouchableOpacity style={styles.actionBtn} onPress={() => setIsPasswordModalVisible(true)}>
            <Text style={styles.actionBtnIcon}>🔒</Text>
            <Text style={styles.actionBtnText}>تغيير كلمة المرور</Text>
          </TouchableOpacity>
          <View style={[styles.divider, isDarkMode && { backgroundColor: '#334155' }]} />
          <TouchableOpacity style={styles.deleteBtn} onPress={confirmDeleteAccount}>
            <Text style={styles.deleteBtnIcon}>🗑️</Text>
            <Text style={styles.deleteBtnText}>حذف الحساب نهائياً</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <Modal visible={isPasswordModalVisible} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
          <View style={[styles.modalContent, isDarkMode && { backgroundColor: '#1e293b' }]}>
            <Text style={[styles.modalTitle, isDarkMode && { color: '#ffffff' }]}>تغيير كلمة السر</Text>
            <Text style={styles.modalSubtitle}>سيتم تسجيل خروجك فور التغيير</Text>
            <TextInput style={[styles.modalInput, isDarkMode && { backgroundColor: '#334155', color: '#fff', borderColor: '#475569' }]} placeholder="كلمة السر الحالية" placeholderTextColor={isDarkMode ? '#94a3b8' : '#64748b'} secureTextEntry value={currentPassword} onChangeText={setCurrentPassword} />
            <TextInput style={[styles.modalInput, isDarkMode && { backgroundColor: '#334155', color: '#fff', borderColor: '#475569' }]} placeholder="كلمة السر الجديدة" placeholderTextColor={isDarkMode ? '#94a3b8' : '#64748b'} secureTextEntry value={newPassword} onChangeText={setNewPassword} />
            <TextInput style={[styles.modalInput, isDarkMode && { backgroundColor: '#334155', color: '#fff', borderColor: '#475569' }]} placeholder="تأكيد كلمة السر الجديدة" placeholderTextColor={isDarkMode ? '#94a3b8' : '#64748b'} secureTextEntry value={confirmNewPassword} onChangeText={setConfirmNewPassword} />
            <View style={styles.modalButtonsRow}>
              <TouchableOpacity style={styles.modalSaveBtn} onPress={handleChangePassword} disabled={isUpdatingPassword}>
                {isUpdatingPassword ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalSaveBtnText}>تأكيد وتغيير</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => {setIsPasswordModalVisible(false); setCurrentPassword(''); setNewPassword(''); setConfirmNewPassword('');}}>
                <Text style={styles.modalCancelBtnText}>إلغاء</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8fafc' },
  header: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#ffffff', padding: 15, paddingTop: 50, borderBottomWidth: 1, borderColor: '#e2e8f0', elevation: 2 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#1e293b' },
  backBtn: { paddingVertical: 8, paddingHorizontal: 12, backgroundColor: '#f1f5f9', borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0' },
  backBtnText: { color: '#475569', fontWeight: 'bold', fontSize: 14 },
  scrollContent: { padding: 20 },
  sectionTitle: { fontSize: 15, fontWeight: 'bold', color: '#64748b', marginBottom: 10, marginTop: 10, textAlign: 'right' },
  sectionCard: { backgroundColor: '#ffffff', borderRadius: 16, padding: 15, borderWidth: 1, borderColor: '#e2e8f0', elevation: 2, marginBottom: 20 },
  settingRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', paddingVertical: 10 },
  settingTextCol: { flex: 1, justifyContent: 'center', alignItems: 'flex-start' },
  settingTitle: { fontSize: 16, fontWeight: 'bold', color: '#1e293b', marginBottom: 4 },
  settingSubtitle: { fontSize: 12, color: '#94a3b8' },
  divider: { height: 1, backgroundColor: '#f1f5f9', marginVertical: 5 },
  actionBtn: { flexDirection: 'row-reverse', alignItems: 'center', paddingVertical: 12 },
  actionBtnIcon: { fontSize: 20, marginLeft: 15 },
  actionBtnText: { fontSize: 16, fontWeight: 'bold', color: '#3b82f6' },
  deleteBtn: { flexDirection: 'row-reverse', alignItems: 'center', paddingVertical: 12, marginTop: 5 },
  deleteBtnIcon: { fontSize: 20, marginLeft: 15 },
  deleteBtnText: { fontSize: 16, fontWeight: 'bold', color: '#ef4444' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { backgroundColor: '#ffffff', width: '100%', padding: 25, borderRadius: 20, elevation: 5 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#1e293b', marginBottom: 5, textAlign: 'center' },
  modalSubtitle: { fontSize: 13, color: '#ef4444', textAlign: 'center', marginBottom: 20, fontWeight: 'bold' },
  modalInput: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 12, padding: 14, marginBottom: 15, fontSize: 15, fontWeight: 'bold', color: '#0f172a', textAlign: 'right' },
  modalButtonsRow: { flexDirection: 'row-reverse', gap: 10, marginTop: 10 },
  modalSaveBtn: { flex: 2, backgroundColor: '#3b82f6', paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  modalSaveBtnText: { color: '#ffffff', fontWeight: 'bold', fontSize: 16 },
  modalCancelBtn: { flex: 1, backgroundColor: '#fee2e2', paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  modalCancelBtnText: { color: '#ef4444', fontWeight: 'bold', fontSize: 16 }
});