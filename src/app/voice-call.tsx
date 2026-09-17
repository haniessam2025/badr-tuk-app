import { ONE_ON_ONE_VOICE_CALL_CONFIG, ZegoUIKitPrebuiltCall } from '@zegocloud/zego-uikit-prebuilt-call-rn';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

export default function VoiceCallScreen() {
  const router = useRouter();
  const { rideId, userName, userId } = useLocalSearchParams(); 

  return (
    <View style={styles.container}>
      <ZegoUIKitPrebuiltCall
        appID={1296564307} // الـ AppID بتاعك
        appSign={"fbe5336728d7f294053cb80727112de97"} // الـ AppSign بتاعك (تأكد إنه كامل)
        userID={String(userId || 'user_' + Math.random())} 
        userName={String(userName || 'مستخدم')} 
        callID={String(rideId || 'default_call')} // رقم الرحلة هو مفتاح الغرفة المشتركة
        
        config={{
          ...ONE_ON_ONE_VOICE_CALL_CONFIG,
          onCallEnd: (callID, reason, duration) => {
            router.back(); // لما المكالمة تخلص يرجع للشات أو الصفحة الرئيسية
          },
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 }
});