import { useRouter } from 'expo-router';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function CaptainChoiceScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>حساب الكابتن 👨‍✈️</Text>
      
      <TouchableOpacity style={styles.button} onPress={() => router.push('/captain-signup')}>
        <Text style={styles.buttonText}>تسجيل جديد</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.button, styles.loginButton]} onPress={() => router.push('/captain-login')}>
        <Text style={styles.buttonText}>تسجيل الدخول</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f6f9', justifyContent: 'center', alignItems: 'center', padding: 24 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#2563eb', marginBottom: 40 },
  button: { backgroundColor: '#16a34a', width: '80%', padding: 16, borderRadius: 12, alignItems: 'center', marginBottom: 20 },
  loginButton: { backgroundColor: '#2563eb' },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
});