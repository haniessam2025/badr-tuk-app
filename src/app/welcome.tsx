import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Animated, Dimensions, StyleSheet, Text, View } from 'react-native';

const { width } = Dimensions.get('window');

export default function WelcomeScreen() {
  const router = useRouter();
  
  // بنخلي نقطة البداية من عرض الشاشة بالكامل (يمين الشاشة تماماً) وتتجه للصفر (المنتصف)
  const slideAnim = useRef(new Animated.Value(width)).current;

  useEffect(() => {
    // تشغيل الأنيميشن بحركة سلسة وسريعة
    Animated.timing(slideAnim, {
      toValue: 0, // نقطة الوقوف في المنتصف
      duration: 1200, // سرعة حركة التوكتوك
      useNativeDriver: true,
    }).start();

    // بعد وقوف التوكتوك في النص بثانيتين، يحول تلقائياً للشاشة التالية (اختيار راكب أو كابتن / role)
    const timer = setTimeout(() => {
      router.replace('/role'); 
    }, 3200);

    return () => clearTimeout(timer);
  }, [slideAnim]);

  return (
    <View style={styles.container}>
      {/* جملة الترحيب */}
      <Text style={styles.title}>أهلاً بيكم في بدر كيوت</Text>

      {/* التوكتوك المتحرك من اليمين للنص */}
      <Animated.View style={[styles.tukTukContainer, { transform: [{ translateX: slideAnim }] }]}>
        <Text style={styles.tukTukEmoji}>🛺</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fef08a', // الخلفية الصفراء الترحيبية
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    overflow: 'hidden', // لمنع خروج الأيقونة بشكل مزعج برا حدود الشاشة
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#d97706',
    textAlign: 'center',
    marginBottom: 50,
  },
  tukTukContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  tukTukEmoji: {
    fontSize: 90, // حجم أيقونة التوكتوك
  },
});