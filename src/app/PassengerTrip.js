import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Linking, Platform, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function PassengerTrip() {
  const router = useRouter();
  const [loadingLocation, setLoadingLocation] = useState(false);

  // دالة الطوارئ والأمان لإرسال اللوكيشن على واتساب
  const sendSafetyLocation = async () => {
    setLoadingLocation(true);
    
    // رقم الطوارئ (الرقم اللي الراكب مسجله أو رقم ثابت للتجربة)
    // يجب أن يبدأ بكود الدولة بدون أصفار (مثال لمصر: 201000000000)
    const trustedPhoneNumber = '201009524383';

    try {
      // 1. طلب صلاحية الموقع
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('تنبيه', 'صلاحية الموقع مطلوبة لإرسال رسالة الأمان.');
        setLoadingLocation(false);
        return;
      }

      // 2. سحب اللوكيشن الحالي بدقة عالية
      let currentLocation = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const { latitude, longitude } = currentLocation.coords;

      // 3. تجهيز رسالة الواتساب بالرابط
      const mapLink = `https://www.google.com/maps/?q=${latitude},${longitude}`;
      const message = `أنا حالياً في رحلة مع تطبيق بَرّاق ⚡.\nأشارك معك موقعي الحالي لأسباب الأمان:\n${mapLink}`;
      
      const whatsappUrl = `whatsapp://send?phone=${trustedPhoneNumber}&text=${encodeURIComponent(message)}`;

      // 4. فتح الواتساب
      const canOpen = await Linking.canOpenURL(whatsappUrl);
      if (canOpen) {
        await Linking.openURL(whatsappUrl);
      } else {
        Alert.alert('تنبيه', 'تطبيق واتساب غير مثبت على هاتفك.');
      }
    } catch (error) {
      console.error(error);
      Alert.alert('خطأ', 'حدثت مشكلة أثناء تحديد الموقع.');
    } finally {
      setLoadingLocation(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerText}>رحلة نشطة ⚡</Text>
      </View>

      {/* مساحة الخريطة (تقدر تحط هنا مكون MapView بتاع Google Maps) */}
      <View style={styles.mapContainer}>
        <Text style={styles.mapText}>🗺️ مسار الرحلة الحي يظهر هنا</Text>
      </View>

      <View style={styles.tripDetails}>
        <Text style={styles.driverInfo}>الكابتن: ياسر محمد (🛺 بديل توكتوك)</Text>
        <Text style={styles.statusText}>الرحلة جارية الآن... في الطريق للوجهة</Text>

        {/* زر الأمان للراكب */}
        <TouchableOpacity style={styles.safetyBtn} onPress={sendSafetyLocation} disabled={loadingLocation}>
          {loadingLocation ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.safetyBtnText}>مشاركة مسار الرحلة (أمان 🛡️)</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.endBtn} onPress={() => router.back()}>
          <Text style={styles.endBtnText}>إنهاء الرحلة مؤقتاً</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    backgroundColor: '#ffffff',
    padding: 20,
    paddingTop: Platform.OS === 'android' ? 40 : 20,
    alignItems: 'center',
    elevation: 3,
  },
  headerText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  mapContainer: {
    flex: 1,
    backgroundColor: '#e2e8f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapText: {
    fontSize: 16,
    color: '#64748b',
    fontWeight: 'bold',
  },
  tripDetails: {
    backgroundColor: '#ffffff',
    padding: 20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
  },
  driverInfo: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#334155',
    textAlign: 'right',
    marginBottom: 5,
  },
  statusText: {
    fontSize: 14,
    color: '#10b981',
    textAlign: 'right',
    marginBottom: 20,
    fontWeight: 'bold',
  },
  safetyBtn: {
    backgroundColor: '#ef4444', 
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 10,
    elevation: 2,
  },
  safetyBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  endBtn: {
    backgroundColor: '#f1f5f9',
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
  },
  endBtnText: {
    color: '#64748b',
    fontSize: 16,
    fontWeight: 'bold',
  },
});