import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Animated, Dimensions, StyleSheet, Text, View } from 'react-native';

const { width } = Dimensions.get('window');

export default function WelcomeScreen() {
  const router = useRouter();
  const slideAnim = useRef(new Animated.Value(width)).current;

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 1200,
      useNativeDriver: true,
    }).start();

    const timer = setTimeout(() => {
      router.replace('/role');
    }, 3200);

    return () => clearTimeout(timer);
  }, [slideAnim]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>أهلاً بيكم في بدر كيوت</Text>
      <Animated.View style={[styles.tukTukContainer, { transform: [{ translateX: slideAnim }] }]}>
        <Text style={styles.tukTukEmoji}>🛺</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fef08a', justifyContent: 'center', alignItems: 'center', padding: 24, overflow: 'hidden' },
  title: { fontSize: 28, fontWeight: 'bold', color: '#d97706', textAlign: 'center', marginBottom: 50 },
  tukTukContainer: { alignItems: 'center', justifyContent: 'center' },
  tukTukEmoji: { fontSize: 90 },
});