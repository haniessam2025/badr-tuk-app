import { useRouter } from 'expo-router';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function VoiceCall() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Text style={styles.text}>مكالمات الصوت والفيديو غير مفعلة حالياً في نسخة Expo Go.</Text>
      <TouchableOpacity style={styles.btn} onPress={() => router.back()}>
        <Text style={styles.btnText}>العودة للخلف</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: '#f1f5f9' },
  text: { fontSize: 16, color: '#ef4444', textAlign: 'center', marginBottom: 20, fontWeight: 'bold' },
  btn: { backgroundColor: '#3b82f6', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8 },
  btnText: { color: '#ffffff', fontWeight: 'bold', fontSize: 16 }
});