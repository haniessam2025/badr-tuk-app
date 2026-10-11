import { useRouter } from 'expo-router';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { db } from '../firebase';

export default function AdminSettings() {
  const router = useRouter();
  
  const [appSettings, setAppSettings] = useState({
    car: { baseFare: '15', perKm: '4.4', minFare: '20' },
    tuktuk: { baseFare: '10', perKm: '6.5', minFare: '15' },
    scooter: { baseFare: '12', perKm: '3.75', minFare: '12' },
    appCommission: '10',
    waitingTimeMins: '5',
    maxNegativeBalance: '-50', // 👈 حد المديونية
    maintenanceMode: false, // 👈 وضع الصيانة
  });
  
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    const unsubSettings = onSnapshot(doc(db, 'app_settings', 'pricing'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setAppSettings({
          car: { baseFare: data.car?.baseFare || '15', perKm: data.car?.perKm || '4.4', minFare: data.car?.minFare || '20' },
          tuktuk: { baseFare: data.tuktuk?.baseFare || '10', perKm: data.tuktuk?.perKm || '6.5', minFare: data.tuktuk?.minFare || '15' },
          scooter: { baseFare: data.scooter?.baseFare || '12', perKm: data.scooter?.perKm || '3.75', minFare: data.scooter?.minFare || '12' },
          appCommission: data.appCommission || '10',
          waitingTimeMins: data.waitingTimeMins || '5',
          maxNegativeBalance: data.maxNegativeBalance || '-50',
          maintenanceMode: data.maintenanceMode || false,
        });
      }
      setLoading(false);
    }, (error) => {
      console.log('Error fetching settings:', error);
      setLoading(false);
    });

    return () => unsubSettings();
  }, []);

  const saveAppSettings = async () => {
    setSavingSettings(true);
    try {
      await setDoc(doc(db, 'app_settings', 'pricing'), appSettings);
      Alert.alert('نجاح ✅', 'تم حفظ إعدادات النظام بنجاح وسيتم تطبيقها فوراً على كل المستخدمين.');
    } catch (error) {
      Alert.alert('خطأ', 'تعذر حفظ الإعدادات. تأكد من اتصالك بالإنترنت.');
    } finally {
      setSavingSettings(false);
    }
  };

  // 🚨 دالة التحديث الفوري لوضع الصيانة (بدون انتظار زرار الحفظ)
  const toggleMaintenanceMode = async (val: boolean) => {
    setAppSettings({ ...appSettings, maintenanceMode: val });
    try {
      await setDoc(doc(db, 'app_settings', 'pricing'), { maintenanceMode: val }, { merge: true });
    } catch (error) {
      Alert.alert('خطأ', 'تأكد من اتصالك بالإنترنت');
      setAppSettings({ ...appSettings, maintenanceMode: !val }); 
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#eab308" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>رجوع ✖</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>إعدادات النظام ⚙️</Text>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 30 }}>
          
          {/* 🚨 قسم الطوارئ والصيانة */}
          <View style={[styles.settingsSection, { borderColor: appSettings.maintenanceMode ? '#ef4444' : '#334155' }]}>
            <Text style={[styles.settingsSectionTitle, appSettings.maintenanceMode && { color: '#ef4444' }]}>
              🚨 وضع الصيانة (إغلاق التطبيق)
            </Text>
            <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flex: 1, marginLeft: 15 }}>
                <Text style={{ color: '#94a3b8', fontSize: 12, textAlign: 'right', lineHeight: 18 }}>
                  عند تفعيل هذا الخيار، سيتم منع جميع الكباتن والركاب من استخدام التطبيق وستظهر لهم شاشة "التطبيق تحت الصيانة". يُطبق فوراً!
                </Text>
              </View>
              <Switch
                trackColor={{ false: '#334155', true: '#fca5a5' }}
                thumbColor={appSettings.maintenanceMode ? '#ef4444' : '#94a3b8'}
                onValueChange={toggleMaintenanceMode}
                value={appSettings.maintenanceMode}
              />
            </View>
          </View>

          {/* قسم السيارات */}
          <View style={styles.settingsSection}>
            <Text style={styles.settingsSectionTitle}>🚗 السيارات</Text>
            <View style={styles.settingsInputRow}>
              <View style={styles.settingsInputGroup}>
                <Text style={styles.settingsLabel}>الحد الأدنى (ج)</Text>
                <TextInput style={styles.settingsInput} keyboardType="numeric" value={appSettings.car.minFare} onChangeText={t => setAppSettings({...appSettings, car: {...appSettings.car, minFare: t}})} textAlign="center" />
              </View>
              <View style={styles.settingsInputGroup}>
                <Text style={styles.settingsLabel}>سعر الكيلو (ج)</Text>
                <TextInput style={styles.settingsInput} keyboardType="numeric" value={appSettings.car.perKm} onChangeText={t => setAppSettings({...appSettings, car: {...appSettings.car, perKm: t}})} textAlign="center" />
              </View>
              <View style={styles.settingsInputGroup}>
                <Text style={styles.settingsLabel}>فتح العداد (ج)</Text>
                <TextInput style={styles.settingsInput} keyboardType="numeric" value={appSettings.car.baseFare} onChangeText={t => setAppSettings({...appSettings, car: {...appSettings.car, baseFare: t}})} textAlign="center" />
              </View>
            </View>
          </View>

          {/* قسم التوكتوك */}
          <View style={styles.settingsSection}>
            <Text style={styles.settingsSectionTitle}>🛺 بديل التوكتوك</Text>
            <View style={styles.settingsInputRow}>
              <View style={styles.settingsInputGroup}>
                <Text style={styles.settingsLabel}>الحد الأدنى (ج)</Text>
                <TextInput style={styles.settingsInput} keyboardType="numeric" value={appSettings.tuktuk.minFare} onChangeText={t => setAppSettings({...appSettings, tuktuk: {...appSettings.tuktuk, minFare: t}})} textAlign="center" />
              </View>
              <View style={styles.settingsInputGroup}>
                <Text style={styles.settingsLabel}>سعر الكيلو (ج)</Text>
                <TextInput style={styles.settingsInput} keyboardType="numeric" value={appSettings.tuktuk.perKm} onChangeText={t => setAppSettings({...appSettings, tuktuk: {...appSettings.tuktuk, perKm: t}})} textAlign="center" />
              </View>
              <View style={styles.settingsInputGroup}>
                <Text style={styles.settingsLabel}>الأساسي (ج)</Text>
                <TextInput style={styles.settingsInput} keyboardType="numeric" value={appSettings.tuktuk.baseFare} onChangeText={t => setAppSettings({...appSettings, tuktuk: {...appSettings.tuktuk, baseFare: t}})} textAlign="center" />
              </View>
            </View>
          </View>

          {/* قسم السكوتر */}
          <View style={styles.settingsSection}>
            <Text style={styles.settingsSectionTitle}>🛵 السكوتر</Text>
            <View style={styles.settingsInputRow}>
              <View style={styles.settingsInputGroup}>
                <Text style={styles.settingsLabel}>الحد الأدنى (ج)</Text>
                <TextInput style={styles.settingsInput} keyboardType="numeric" value={appSettings.scooter.minFare} onChangeText={t => setAppSettings({...appSettings, scooter: {...appSettings.scooter, minFare: t}})} textAlign="center" />
              </View>
              <View style={styles.settingsInputGroup}>
                <Text style={styles.settingsLabel}>سعر الكيلو (ج)</Text>
                <TextInput style={styles.settingsInput} keyboardType="numeric" value={appSettings.scooter.perKm} onChangeText={t => setAppSettings({...appSettings, scooter: {...appSettings.scooter, perKm: t}})} textAlign="center" />
              </View>
              <View style={styles.settingsInputGroup}>
                <Text style={styles.settingsLabel}>الأساسي (ج)</Text>
                <TextInput style={styles.settingsInput} keyboardType="numeric" value={appSettings.scooter.baseFare} onChangeText={t => setAppSettings({...appSettings, scooter: {...appSettings.scooter, baseFare: t}})} textAlign="center" />
              </View>
            </View>
          </View>

          {/* ⚙️ إعدادات عامة وحد المديونية */}
          <View style={styles.settingsSection}>
            <Text style={styles.settingsSectionTitle}>⚙️ ضوابط النظام</Text>
            <View style={styles.settingsInputRow}>
              <View style={styles.settingsInputGroup}>
                <Text style={styles.settingsLabel}>حد مديونية الكابتن (ج)</Text>
                <TextInput style={[styles.settingsInput, { color: '#ef4444' }]} keyboardType="numeric" value={appSettings.maxNegativeBalance} onChangeText={t => setAppSettings({...appSettings, maxNegativeBalance: t})} textAlign="center" placeholder="-50" />
              </View>
              <View style={styles.settingsInputGroup}>
                <Text style={styles.settingsLabel}>عمولة التطبيق (%)</Text>
                <TextInput style={styles.settingsInput} keyboardType="numeric" value={appSettings.appCommission} onChangeText={t => setAppSettings({...appSettings, appCommission: t})} textAlign="center" />
              </View>
              <View style={styles.settingsInputGroup}>
                <Text style={styles.settingsLabel}>الانتظار (دقائق)</Text>
                <TextInput style={styles.settingsInput} keyboardType="numeric" value={appSettings.waitingTimeMins} onChangeText={t => setAppSettings({...appSettings, waitingTimeMins: t})} textAlign="center" />
              </View>
            </View>
          </View>

          <TouchableOpacity style={styles.saveSettingsBtn} onPress={saveAppSettings} disabled={savingSettings}>
            {savingSettings ? <ActivityIndicator color="#000" /> : <Text style={styles.saveSettingsBtnText}>حفظ وتطبيق الإعدادات 💾</Text>}
          </TouchableOpacity>
          
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a', padding: 15, paddingTop: 45 },
  header: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  headerTitle: { color: '#eab308', fontSize: 22, fontWeight: 'bold' },
  backBtn: { backgroundColor: '#334155', paddingVertical: 8, paddingHorizontal: 15, borderRadius: 8 },
  backBtnText: { color: '#ef4444', fontSize: 14, fontWeight: 'bold' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f172a' },
  
  settingsSection: { backgroundColor: '#1e293b', borderRadius: 16, padding: 20, marginBottom: 15, borderWidth: 1, borderColor: '#334155', elevation: 2 },
  settingsSectionTitle: { color: '#f8fafc', fontSize: 18, fontWeight: 'bold', textAlign: 'right', marginBottom: 15 },
  settingsInputRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', gap: 10 },
  settingsInputGroup: { flex: 1 },
  settingsLabel: { color: '#94a3b8', fontSize: 12, textAlign: 'center', marginBottom: 8 },
  settingsInput: { backgroundColor: '#0f172a', color: '#fff', borderRadius: 10, padding: 12, fontSize: 16, borderWidth: 1, borderColor: '#475569', fontWeight: 'bold' },
  saveSettingsBtn: { backgroundColor: '#10b981', paddingVertical: 16, borderRadius: 12, alignItems: 'center', marginTop: 10, marginBottom: 30, elevation: 4 },
  saveSettingsBtnText: { color: '#ffffff', fontSize: 18, fontWeight: 'bold' }
});