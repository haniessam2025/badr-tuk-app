import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Animated, Dimensions, StyleSheet, Text, View } from 'react-native';

const { width } = Dimensions.get('window');

export default function WelcomeScreen() {
  const router = useRouter();
  
  // قيم الأنيميشن
  const meteorX = useRef(new Animated.Value(width + 100)).current; // حركة نيزك السرعة من اليمين
  const fadeAnim = useRef(new Animated.Value(0)).current; // ظهور الشعار
  const scaleAnim = useRef(new Animated.Value(0.5)).current; // تكبير الشعار
  const flashOpacity = useRef(new Animated.Value(0)).current; // ومضة البرق
  const floatAnim = useRef(new Animated.Value(0)).current; // حركة الطفو

  useEffect(() => {
    // 1. نيزك السرعة يقطع الشاشة من اليمين للشمال بسرعة فائقة
    Animated.timing(meteorX, {
      toValue: -width - 150,
      duration: 600,
      useNativeDriver: true,
    }).start();

    // 2. ظهور الشعار بعد انطلاق النيزك بلحظة
    setTimeout(() => {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 1, friction: 5, tension: 40, useNativeDriver: true })
      ]).start(() => {
        
        // 3. تأثير ومضة البرق (بتنور وتطفي بسرعة مرتين)
        Animated.sequence([
          Animated.timing(flashOpacity, { toValue: 1, duration: 60, useNativeDriver: true }),
          Animated.timing(flashOpacity, { toValue: 0, duration: 60, useNativeDriver: true }),
          Animated.timing(flashOpacity, { toValue: 1, duration: 60, useNativeDriver: true }),
          Animated.timing(flashOpacity, { toValue: 0, duration: 150, useNativeDriver: true }),
        ]).start(() => {
          
          // 4. استمرار حركة الطفو (البُراق جاهز للانطلاق)
          Animated.loop(
            Animated.sequence([
              Animated.timing(floatAnim, { toValue: -12, duration: 800, useNativeDriver: true }),
              Animated.timing(floatAnim, { toValue: 0, duration: 800, useNativeDriver: true })
            ])
          ).start();
        });
      });
    }, 200);

    // 5. الانتقال لشاشة الاختيار
    const timer = setTimeout(() => {
      router.replace('/role');
    }, 3000);

    return () => clearTimeout(timer);
  }, [meteorX, fadeAnim, scaleAnim, flashOpacity, floatAnim]);

  // دمج التكبير مع الطفو
  const pulseScale = floatAnim.interpolate({
    inputRange: [-12, 0],
    outputRange: [1.03, 1]
  });

  return (
    <View style={styles.container}>
      {/* إيموجي السرعة اللي بيخطف الشاشة */}
      <Animated.View style={[styles.meteorContainer, { transform: [{ translateX: meteorX }] }]}>
        <Text style={styles.meteorEmoji}>☄️💨</Text>
      </Animated.View>

      {/* الشعار المركزي */}
      <Animated.View style={[
        styles.logoContainer,
        {
          opacity: fadeAnim,
          transform: [
            { scale: scaleAnim },
            { translateY: floatAnim },
            { scale: pulseScale }
          ]
        }
      ]}>
        
        <Text style={styles.lightningIcon}>⚡</Text>
        
        <View style={styles.textWrapper}>
          {/* الكلمة الأساسية */}
          <Text style={styles.title}>بُراق</Text>
          
          {/* الكلمة المضيئة (ومضة البرق اللي بتضرب فوق الكلمة الأساسية) */}
          <Animated.Text style={[styles.titleFlash, { opacity: flashOpacity }]}>
            بُراق
          </Animated.Text>
        </View>

        <Text style={styles.subtitle}>أسرع من البرق</Text>

      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#0f172a', 
    justifyContent: 'center', 
    alignItems: 'center', 
    padding: 24,
    overflow: 'hidden',
  },
  meteorContainer: {
    position: 'absolute',
    top: '40%',
    zIndex: 0,
  },
  meteorEmoji: {
    fontSize: 80,
  },
  logoContainer: { 
    alignItems: 'center', 
    justifyContent: 'center',
    zIndex: 1,
  },
  lightningIcon: {
    fontSize: 70,
    marginBottom: 5,
    textShadowColor: 'rgba(251, 191, 36, 0.8)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 20,
  },
  textWrapper: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { 
    fontSize: 65, 
    fontWeight: '900', 
    color: '#ffffff', 
    textAlign: 'center', 
    marginBottom: 5,
    letterSpacing: 1,
  },
  titleFlash: {
    position: 'absolute',
    fontSize: 65, 
    fontWeight: '900', 
    color: '#fef08a', // أصفر ساطع جداً
    textAlign: 'center', 
    marginBottom: 5,
    letterSpacing: 1,
    textShadowColor: '#fef08a',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 30, // توهج عالي جداً وقت البرق
  },
  subtitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fbbf24', 
    letterSpacing: 1,
    marginTop: 5,
  }
});