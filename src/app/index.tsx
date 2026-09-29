import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Animated, Dimensions, Image, StyleSheet, Text, View } from 'react-native';

const { width } = Dimensions.get('window');

export default function WelcomeScreen() {
  const router = useRouter();
  
  // قيم الأنيميشن
  const meteorX = useRef(new Animated.Value(width + 100)).current; // حركة نيزك السرعة من اليمين
  const fadeAnim = useRef(new Animated.Value(0)).current; // ظهور الشعار الكبير
  const scaleAnim = useRef(new Animated.Value(0.4)).current; // تكبير الشعار
  const flashOpacity = useRef(new Animated.Value(0)).current; // ومضة البرق فوق اللوجو
  
  // قيم أنيميشن منفصلة لجملة "أسرع من البرق" عشان تظهر بعدها
  const subtitleFade = useRef(new Animated.Value(0)).current;
  const subtitleSlide = useRef(new Animated.Value(20)).current;

  const floatAnim = useRef(new Animated.Value(0)).current; // حركة الطفو المستمرة

  useEffect(() => {
    // 1. نيزك السرعة يقطع الشاشة من اليمين للشمال بسرعة فائقة
    Animated.timing(meteorX, {
      toValue: -width - 150,
      duration: 600,
      useNativeDriver: true,
    }).start();

    // 2. ظهور الشعار الكبير وضبط الومضة بعد انطلاق النيزك
    setTimeout(() => {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 1, friction: 5, tension: 40, useNativeDriver: true })
      ]).start(() => {
        
        // 3. تأثير ومضة البرق (⚡ تنور وتطفي مرتين)
        Animated.sequence([
          Animated.timing(flashOpacity, { toValue: 1, duration: 80, useNativeDriver: true }),
          Animated.timing(flashOpacity, { toValue: 0, duration: 80, useNativeDriver: true }),
          Animated.timing(flashOpacity, { toValue: 1, duration: 80, useNativeDriver: true }),
          Animated.timing(flashOpacity, { toValue: 0, duration: 180, useNativeDriver: true }),
        ]).start(() => {
          
          // 4. ظهور جملة "أسرع من البرق" بانسياقية بعد اللوجو والومضة
          Animated.parallel([
            Animated.timing(subtitleFade, { toValue: 1, duration: 500, useNativeDriver: true }),
            Animated.timing(subtitleSlide, { toValue: 0, duration: 500, useNativeDriver: true }),
          ]).start(() => {
            
            // 5. استمرار حركة الطفو (البُراق جاهز للانطلاق)
            Animated.loop(
              Animated.sequence([
                Animated.timing(floatAnim, { toValue: -10, duration: 800, useNativeDriver: true }),
                Animated.timing(floatAnim, { toValue: 0, duration: 800, useNativeDriver: true })
              ])
            ).start();

          });
        });
      });
    }, 200);

    // 6. الانتقال لشاشة الاختيار بعد انتهاء العرض (3 ثوانٍ)
    const timer = setTimeout(() => {
      router.replace('/role');
    }, 3200);

    return () => clearTimeout(timer);
  }, [meteorX, fadeAnim, scaleAnim, flashOpacity, subtitleFade, subtitleSlide, floatAnim]);

  // دمج التكبير مع الطفو
  const pulseScale = floatAnim.interpolate({
    inputRange: [-10, 0],
    outputRange: [1.02, 1]
  });

  return (
    <View style={styles.container}>
      {/* إيموجي السرعة اللي بيخطف الشاشة */}
      <Animated.View style={[styles.meteorContainer, { transform: [{ translateX: meteorX }] }]}>
        <Text style={styles.meteorEmoji}>☄️💨</Text>
      </Animated.View>

      {/* الشعار المركزي الضخم */}
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
        
        <View style={styles.imageWrapper}>
          {/* صورة اللوجو بحجم كبير جداً يملأ الشاشة */}
          <Image 
            source={require('../../assets/images/splash.png')} 
            style={styles.logoImage} 
            resizeMode="contain"
          />
          
          {/* أيقونة البرق (⚡) الوامضة فوق اللوجو */}
          <Animated.View style={[styles.flashLightningContainer, { opacity: flashOpacity }]}>
            <Text style={styles.flashLightningIcon}>⚡</Text>
          </Animated.View>
        </View>

        {/* جملة أسرع من البرق (تظهر بتأثير انزلاق وتلاشي بعد اللوجو) */}
        <Animated.Text style={[
          styles.subtitle, 
          { 
            opacity: subtitleFade, 
            transform: [{ translateY: subtitleSlide }] 
          }
        ]}>
          أسرع من البرق
        </Animated.Text>

      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#ffffff', // خلفية بيضاء ناصعة
    justifyContent: 'center', 
    alignItems: 'center', 
    padding: 20,
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
    width: '100%',
  },
  imageWrapper: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    width: width * 0.90, // حجم ضخم يملأ عرض الشاشة تقريباً
    height: width * 0.90, // أبعاد مربعة متناسقة
    marginBottom: 5,
  },
  logoImage: {
    width: '100%',
    height: '100%',
  },
  flashLightningContainer: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
    top: '28%', 
  },
  flashLightningIcon: {
    fontSize: 90, // حجم أكبر وأوضح لرمز البرق الوامض
    textShadowColor: 'rgba(234, 179, 8, 0.9)', // توهج أصفر ساطع
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 30,
  },
  subtitle: {
    fontSize: 26, // خط أكبر وأوضح
    fontWeight: '900',
    color: '#0f172a', // لون داكن قوي يناسب الخلفية البيضاء
    letterSpacing: 2,
    marginTop: 10,
    textAlign: 'center',
  }
});