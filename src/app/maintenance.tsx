import { router } from 'expo-router';
import { useEffect } from 'react';
import { BackHandler, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function MaintenanceScreen() {
  
  // 🛡️ الكود ده بيقفل زرار "الرجوع" في الأندرويد عشان اليوزر ميهربش من الصيانة
  useEffect(() => {
    const backAction = () => {
      return true; // تعطيل الرجوع
    };
    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => backHandler.remove();
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* أيقونة الصيانة */}
        <Text style={styles.icon}>🛠️</Text>
        
        {/* العناوين */}
        <Text style={styles.title}>عذراً، التطبيق تحت الصيانة</Text>
        <Text style={styles.subtitle}>
          نحن نقوم ببعض التحديثات الهامة لتحسين تجربتك. سنعود للعمل في أقرب وقت ممكن. شكراً لتفهمك!
        </Text>

        {/* زرار تحديث عشان لو أنت فتحت التطبيق من اللوحة اليوزر يقدر يرجع للرئيسية */}
        <TouchableOpacity 
          style={styles.button} 
          activeOpacity={0.8}
          onPress={() => router.replace('/')}
        >
          <Text style={styles.buttonText}>إعادة المحاولة</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// 🎨 تنسيقات الشاشة عشان تطلع شيك واحترافية
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    padding: 30,
    alignItems: 'center',
    backgroundColor: 'white',
    margin: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  icon: {
    fontSize: 70,
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 30,
  },
  button: {
    backgroundColor: '#3b82f6',
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  }
});