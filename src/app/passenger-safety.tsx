import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useApp } from './AppContext';
// 👈 استيرادات الفايربيز عشان نبعت الاستغاثة
import AsyncStorage from '@react-native-async-storage/async-storage';
import { addDoc, collection } from 'firebase/firestore';
import { db } from '../firebase';

export default function PassengerSafety() {
  const router = useRouter();
  const { isDarkMode } = useApp();

  const showSafetyInfo = (title: string, message: string) => {
    Alert.alert(title, message, [{ text: 'حسناً', style: 'default' }]);
  };

  // 📍 دالة إرسال الاستغاثة للأدمن (SOS)
  const handleSOS = async () => {
    Alert.alert(
      "تأكيد الاستغاثة ⚠️",
      "هل أنت متأكد أنك في خطر وتريد إرسال استغاثة طارئة للإدارة؟",
      [
        { text: "إلغاء", style: "cancel" },
        { 
          text: "نعم، أنقذوني", 
          style: "destructive", 
          onPress: async () => {
            try {
              const passengerId = await AsyncStorage.getItem('currentPassengerId');
              const profileStr = await AsyncStorage.getItem('passenger_profile');
              const profile = profileStr ? JSON.parse(profileStr) : { name: 'غير معروف', phone: '' };

              // رمي الاستغاثة في الفايربيز للأدمن
              await addDoc(collection(db, 'sos_alerts'), {
                passengerId: passengerId,
                passengerName: profile.name,
                passengerPhone: profile.phone,
                timestamp: new Date().getTime(),
                status: 'active', // حالة نشطة عشان تظهر للأدمن
              });

              Alert.alert("تم الإرسال", "تم إبلاغ الإدارة بنجاح، جاري تتبع مسارك والاتصال بأرقام الطوارئ الخاصة بك.");
            } catch (error) {
              Alert.alert("خطأ", "برجاء التأكد من اتصالك بالإنترنت.");
            }
          } 
        }
      ]
    );
  };

  return (
    <View style={[styles.container, isDarkMode && { backgroundColor: '#0f172a' }]}>
      {/* الهيدر */}
      <View style={[styles.header, isDarkMode && { backgroundColor: '#1e293b', borderBottomColor: '#334155' }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-forward" size={24} color={isDarkMode ? "#ffffff" : "#1e293b"} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, isDarkMode && { color: '#ffffff' }]}>السلامة</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        
        {/* زرار جهات الاتصال */}
        <TouchableOpacity 
          style={[styles.mainButton, { backgroundColor: '#4ade80' }]} 
          onPress={() => router.push('/emergency-contacts')}
        >
          <Text style={styles.mainButtonText}>جهات الاتصال في حالات الطوارئ</Text>
        </TouchableOpacity>

        <Text style={[styles.subtitle, isDarkMode && { color: '#e2e8f0' }]}>عشان سلامتك تهمنا ساعدنا نحميك</Text>

        {/* شبكة الأزرار الرباعية */}
        <View style={styles.gridContainer}>
          <TouchableOpacity 
            style={[styles.gridButton, { backgroundColor: '#bfdbfe' }]} // أزرق فاتح
            onPress={() => showSafetyInfo("التحقق من هوية الكابتن", "برجاء التحقق جيدا من هوية الكابتن والتأكد من أنه الكابتن الحقيقي ومسح الكود من موبايله لبدء الرحلة وإذا احسست بالخطر لا تخاطر بحياتك وأبلغنا فوراً بما حدث لاتخاذ اللازم معه")}
          >
            <Text style={styles.gridButtonText}>التحقق من هوية الكابتن</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.gridButton, { backgroundColor: '#ffedd5' }]} // برتقالي فاتح
            onPress={() => showSafetyInfo("مشاركة مسار الرحلة", "يمكنك الضغط على هذا الزر في كارت الرحلة لمشاركة مسارك مع أقرب شخص ليك برسالة نصية على الواتساب لمتابعة رحلتك لحظة بلحظة حتى تصل بالسلامة إلى موقع الوصول")}
          >
            <Text style={styles.gridButtonText}>مشاركة مسار الرحلة</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.gridButton, { backgroundColor: '#bbf7d0' }]} // أخضر فاتح
            onPress={() => showSafetyInfo("الاتصال بالدعم المباشر", "إذا أحسست بالخطر في أي وقت لا تتردد في الاتصال بنا فوراً لاتخاذ اللازم نحو إنقاذك")}
          >
            <Text style={styles.gridButtonText}>الاتصال بالدعم المباشر</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.gridButton, { backgroundColor: '#000000' }]} // أسود
            onPress={() => showSafetyInfo("الاتصال بالشرطة", "ستجد في كارت الرحلة زر مكتوب عليه الاتصال بالشرطة 122 يمكنك الضغط عليه في حالات الطوارئ الشديدة لطلب العون من الشرطة فوراً")}
          >
            <Text style={[styles.gridButtonText, { color: '#ffffff' }]}>الاتصال بالشرطة</Text>
          </TouchableOpacity>
        </View>

        {/* زرار الخطر السفلي 👈 اتربط בדالة الاستغاثة */}
        <TouchableOpacity 
          style={[styles.dangerButton, { backgroundColor: '#ff0000' }]} 
          onPress={handleSOS} 
        >
          <Text style={[styles.mainButtonText, { color: '#ffffff' }]}>الضغط على زر{'\n'}انا في خطر</Text>
        </TouchableOpacity>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  header: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 30, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  backBtn: { padding: 5 },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: '#000000' },
  content: { padding: 15, alignItems: 'center', paddingBottom: 10 },
  
  mainButton: { width: '90%', paddingVertical: 12, borderRadius: 12, borderWidth: 3, borderColor: '#000000', alignItems: 'center', marginBottom: 12 },
  mainButtonText: { fontSize: 16, fontWeight: 'bold', color: '#ffffff', textAlign: 'center' },
  
  subtitle: { fontSize: 16, fontWeight: 'bold', color: '#000000', marginBottom: 12, textAlign: 'center' },
  
  gridContainer: { flexDirection: 'row-reverse', flexWrap: 'wrap', justifyContent: 'space-between', width: '100%', marginBottom: 10 },
  gridButton: { width: '48%', height: 85, borderRadius: 12, borderWidth: 3, borderColor: '#000000', justifyContent: 'center', alignItems: 'center', marginBottom: 10, padding: 5 },
  gridButtonText: { fontSize: 14, fontWeight: 'bold', color: '#000000', textAlign: 'center' },
  
  dangerButton: { width: '80%', paddingVertical: 12, borderRadius: 12, borderWidth: 3, borderColor: '#000000', alignItems: 'center', marginTop: 5 },
});