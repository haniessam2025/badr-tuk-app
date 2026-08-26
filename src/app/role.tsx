import { useRouter } from 'expo-router';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function RoleScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>اختر نوع المستخدم</Text>

      {/* زر الراكب */}
      <TouchableOpacity style={styles.button} onPress={() => router.push('/choice')}>
        <Text style={styles.buttonText}>راكب 🛺</Text>
      </TouchableOpacity>

      {/* زر الكابتن يوجهه إلى صفحة الاختيار (تسجيل جديد أو تسجيل الدخول) */}
      <TouchableOpacity style={[styles.button, styles.captainButton]} onPress={() => router.push('/captain-choice')}>
        <Text style={styles.buttonText}>كابتن 👨‍✈️</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f6f9', justifyContent: 'center', alignItems: 'center', padding: 24 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#333', marginBottom: 40 },
  button: { backgroundColor: '#d97706', width: '80%', padding: 16, borderRadius: 12, alignItems: 'center', marginBottom: 20 },
  captainButton: { backgroundColor: '#2563eb' },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
});