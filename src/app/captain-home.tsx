import AsyncStorage from '@react-native-async-storage/async-storage';
import { usePathname, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Image, Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function CaptainHome() {
  const router = useRouter();
  const pathname = usePathname();
  const [rideState, setRideState] = useState<'waiting' | 'incoming' | 'accepted' | 'arrived'>('waiting');
  
  const [captainProfile, setCaptainProfile] = useState({
    name: 'Haniessam',
    phone: '01030369008',
    vehicle: 'توكتوك (Ghj 124)',
    avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
  });

  const [passenger, setPassenger] = useState({
    name: 'Yaserahmed',
    phone: '01009524383',
    avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
    pickupLocation: 'موقع الانطلاق',
    destinationLocation: 'الوجهة المطلوبة',
    price: '0',
  });

  useEffect(() => {
    loadCaptainProfile();
    checkPersistentRideState();

    const interval = setInterval(() => {
      checkPersistentRideState();
    }, 1500);

    return () => clearInterval(interval);
  }, [pathname]);

  const loadCaptainProfile = async () => {
    try {
      const saved = await AsyncStorage.getItem('captain_profile');
      if (saved) {
        setCaptainProfile(JSON.parse(saved));
      }
    } catch (e) {
      console.log(e);
    }
  };

  const checkPersistentRideState = async () => {
    try {
      const storedRide = await AsyncStorage.getItem('active_ride');
      if (storedRide) {
        const rideData = JSON.parse(storedRide);
        setPassenger({
          name: rideData.name || 'Yaserahmed',
          phone: rideData.phone || '01009524383',
          avatar: rideData.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
          pickupLocation: rideData.pickupLocation || 'موقع الانطلاق',
          destinationLocation: rideData.destinationLocation || 'الوجهة المطلوبة',
          price: rideData.price || '0',
        });

        if (rideData.status === 'accepted') {
          setRideState('accepted');
        } else if (rideData.status === 'captain_arrived') {
          setRideState('arrived');
        } else if (rideData.status === 'pending' && rideState === 'waiting') {
          setRideState('incoming');
        }
      } else {
        setRideState('waiting');
      }
    } catch (error) {
      console.log(error);
    }
  };

  const handleAcceptRide = async () => {
    try {
      const storedRide = await AsyncStorage.getItem('active_ride');
      if (storedRide) {
        const rideData = JSON.parse(storedRide);
        rideData.status = 'accepted';
        await AsyncStorage.setItem('active_ride', JSON.stringify(rideData));
      }
    } catch (error) {
      console.log(error);
    }

    setRideState('accepted');
  };

  const handleCall = () => {
    if (!passenger.phone) {
      Alert.alert('تنبيه', 'رقم الراكب غير متوفر.');
      return;
    }
    Linking.openURL(`tel:${passenger.phone}`);
  };

  const handleCancel = async () => {
    await AsyncStorage.removeItem('active_ride');
    setRideState('waiting');
    Alert.alert('إلغاء', 'تم إلغاء المشوار.');
  };

  const handleArrived = async () => {
    try {
      const storedRide = await AsyncStorage.getItem('active_ride');
      if (storedRide) {
        const rideData = JSON.parse(storedRide);
        rideData.status = 'captain_arrived';
        await AsyncStorage.setItem('active_ride', JSON.stringify(rideData));
      }
    } catch (error) {
      console.log(error);
    }
    setRideState('arrived');
    Alert.alert('نجاح 🛺', 'لقد وصلت إلى موقع الإركاب، وتم إرسال الإشعار للراكب.');
  };

  const handleFinishRide = async () => {
    await AsyncStorage.removeItem('active_ride');
    setRideState('waiting');
    Alert.alert('تم بنجاح 🎯', 'تم إنهاء الرحلة بنجاح وإغلاق الطلب.');
  };

  return (
    <View style={styles.container}>
      
      <View style={styles.header}>
        <TouchableOpacity style={styles.userInfo} onPress={() => router.push('/captain-profile')}>
          <Image source={{ uri: captainProfile.avatar }} style={styles.profileAvatar} />
          <Text style={styles.welcomeText}>أهلاً بك، <Text style={styles.userName}>{captainProfile.name} 👨‍✈️</Text></Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.logoutButton} onPress={() => Alert.alert('خروج', 'تم تسجيل الخروج')}>
          <Text style={styles.logoutText}>خروج</Text>
        </TouchableOpacity>
      </View>

      {rideState === 'waiting' && (
        <View style={styles.waitingContainer}>
          <Text style={styles.waitingText}>📡 في انتظار طلب مشوار من الراكب...</Text>
        </View>
      )}

      {rideState === 'incoming' && (
        <View style={styles.incomingContainer}>
          <View style={styles.incomingCard}>
            <Text style={styles.incomingTitle}>طلب جديد قادم إليك:</Text>
            
            <View style={styles.passengerCardIncoming}>
              <Image source={{ uri: passenger.avatar }} style={styles.avatarIncoming} />
              <View style={styles.passengerDetails}>
                <Text style={styles.passengerName}>{passenger.name}</Text>
                <Text style={styles.hiddenPhoneText}>🔒 رقم الهاتف مخفي لحين قبول المشوار</Text>
              </View>
            </View>

            <View style={styles.tripDetailsBox}>
              <Text style={styles.tripText}>📍 الانطلاق: {passenger.pickupLocation}</Text>
              <Text style={styles.tripText}>🏁 الوجهة: {passenger.destinationLocation}</Text>
              <Text style={styles.priceTag}>💰 أجرة الرحلة: {passenger.price} جنيه</Text>
            </View>

            <TouchableOpacity style={styles.acceptButton} onPress={handleAcceptRide}>
              <Text style={styles.acceptButtonText}>قبول المشوار</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* الشاشة النشطة للكابتن */}
      {(rideState === 'accepted' || rideState === 'arrived') && (
        <View style={styles.activeRideContainer}>
          <View style={styles.mapContainer}>
            <View style={styles.mockMap}>
              <View style={styles.mapVisualContainer}>
                <View style={styles.dotCaptain}><Text style={styles.dotText}>الكابتن</Text></View>
                <View style={styles.mapLine} />
                <View style={styles.dotPassenger}><Text style={styles.dotText}>الراكب</Text></View>
              </View>
              <Text style={styles.mapTitle}>خريطة التتبع المباشر</Text>
              <Text style={styles.mapSubtitle}>من: {passenger.pickupLocation} إلى: {passenger.destinationLocation}</Text>
              <Text style={styles.mapPrice}>💰 أجرة الرحلة: {passenger.price} جنيه</Text>
            </View>
          </View>

          <View style={styles.bottomCard}>
            <View style={styles.passengerCard}>
              <Image source={{ uri: passenger.avatar }} style={styles.avatar} />
              <View style={styles.passengerDetails}>
                <Text style={styles.passengerName}>{passenger.name}</Text>
                <Text style={styles.passengerPhone}>📞 {passenger.phone}</Text>
              </View>
              <TouchableOpacity style={styles.callButton} onPress={handleCall}>
                <Text style={styles.callText}>اتصال</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity 
              style={styles.chatButton} 
              onPress={() => router.push({ pathname: '/chat', params: { senderType: 'captain' } })}
            >
              <Text style={styles.chatButtonText}>💬 مراسلة الراكب</Text>
            </TouchableOpacity>

            <View style={styles.actionsContainer}>
              {rideState === 'accepted' ? (
                <TouchableOpacity style={styles.arrivedButton} onPress={handleArrived}>
                  <Text style={styles.arrivedText}>📍 لقد وصلت إلى موقع الإركاب</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={styles.finishButton} onPress={handleFinishRide}>
                  <Text style={styles.finishButtonText}>✔ تم إنهاء المشوار بنجاح</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
                <Text style={styles.cancelText}>إلغاء المشوار</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc', padding: 15, paddingTop: 40 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#ffffff', padding: 12, borderRadius: 16, marginBottom: 15, elevation: 2 },
  userInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  profileAvatar: { width: 45, height: 45, borderRadius: 22.5, backgroundColor: '#cbd5e1', marginLeft: 10 },
  welcomeText: { fontSize: 15, color: '#334155' },
  userName: { fontWeight: 'bold', color: '#10b981' },
  logoutButton: { backgroundColor: '#fee2e2', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 12 },
  logoutText: { color: '#ef4444', fontWeight: 'bold', fontSize: 14 },
  
  waitingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  waitingText: { fontSize: 16, color: '#64748b', marginBottom: 20, fontWeight: 'bold' },
  incomingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 10 },
  incomingCard: { backgroundColor: '#ffffff', width: '100%', padding: 20, borderRadius: 20, elevation: 4, borderWidth: 1, borderColor: '#e2e8f0' },
  incomingTitle: { fontSize: 18, fontWeight: 'bold', color: '#0f172a', marginBottom: 15, textAlign: 'right' },
  passengerCardIncoming: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f1f5f9', padding: 12, borderRadius: 14, marginBottom: 12 },
  avatarIncoming: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#cbd5e1', marginLeft: 12 },
  passengerDetails: { flex: 1 },
  passengerName: { fontSize: 18, fontWeight: 'bold', color: '#0f172a', textAlign: 'right' },
  hiddenPhoneText: { fontSize: 12, color: '#d97706', marginTop: 4, textAlign: 'right', fontWeight: 'bold' },
  tripDetailsBox: { backgroundColor: '#f8fafc', padding: 12, borderRadius: 12, marginBottom: 20, borderWidth: 1, borderColor: '#e2e8f0' },
  tripText: { fontSize: 14, fontWeight: 'bold', color: '#334155', marginBottom: 4, textAlign: 'right' },
  priceTag: { fontSize: 16, fontWeight: 'bold', color: '#10b981', marginTop: 6, textAlign: 'right' },
  acceptButton: { backgroundColor: '#10b981', paddingVertical: 16, borderRadius: 14, alignItems: 'center', elevation: 3 },
  acceptButtonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  activeRideContainer: { flex: 1, flexDirection: 'column' },
  mapContainer: { flex: 5, width: '100%' },
  mockMap: { flex: 1, backgroundColor: '#e2e8f0', justifyContent: 'center', alignItems: 'center', padding: 15, borderRadius: 16, marginBottom: 10 },
  mapVisualContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  dotCaptain: { backgroundColor: '#2563eb', padding: 8, borderRadius: 16, alignItems: 'center' },
  dotPassenger: { backgroundColor: '#dc2626', padding: 8, borderRadius: 16, alignItems: 'center' },
  mapLine: { width: 70, height: 4, backgroundColor: '#2563eb', marginHorizontal: 5 },
  dotText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  mapTitle: { fontSize: 16, fontWeight: 'bold', color: '#334155' },
  mapSubtitle: { fontSize: 12, color: '#64748b', marginTop: 3, textAlign: 'center' },
  mapPrice: { fontSize: 14, fontWeight: 'bold', color: '#10b981', marginTop: 5 },
  bottomCard: { flex: 5, backgroundColor: '#ffffff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 15, justifyContent: 'space-between', elevation: 10 },
  passengerCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f1f5f9', padding: 10, borderRadius: 16 },
  avatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#cbd5e1', marginLeft: 12 },
  passengerPhone: { fontSize: 13, color: '#475569', marginTop: 2, textAlign: 'right' },
  callButton: { backgroundColor: '#10b981', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  callText: { color: '#ffffff', fontWeight: 'bold', fontSize: 13 },
  chatButton: { backgroundColor: '#8b5cf6', paddingVertical: 12, borderRadius: 12, alignItems: 'center', elevation: 2 },
  chatButtonText: { color: '#ffffff', fontSize: 15, fontWeight: 'bold' },
  actionsContainer: { gap: 8 },
  arrivedButton: { backgroundColor: '#2563eb', paddingVertical: 13, borderRadius: 12, alignItems: 'center', elevation: 3 },
  arrivedText: { color: '#ffffff', fontSize: 15, fontWeight: 'bold' },
  finishButton: { backgroundColor: '#10b981', paddingVertical: 13, borderRadius: 12, alignItems: 'center', elevation: 3 },
  finishButtonText: { color: '#ffffff', fontSize: 15, fontWeight: 'bold' },
  cancelButton: { backgroundColor: '#fee2e2', paddingVertical: 11, borderRadius: 12, alignItems: 'center' },
  cancelButtonText: { color: '#ef4444', fontSize: 14, fontWeight: 'bold' },
});