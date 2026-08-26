import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { Image, Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function CaptainHome() {
  const [rideState, setRideState] = useState<'waiting' | 'incoming' | 'accepted'>('waiting');
  
  const [passenger, setPassenger] = useState({
    name: 'Yaserahmed',
    phone: '01009524383',
    avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
    pickupLocation: 'موقع الانطلاق',
    destinationLocation: 'الوجهة المطلوبة',
    price: '0', // استقبال السعر القادم من الراكب
  });

  // فحص الطلب الوارد كل ثانية وسحب بياناته كاملة بما فيها السعر المعدل
  useEffect(() => {
    const checkRideRequest = async () => {
      try {
        const storedRide = await AsyncStorage.getItem('active_ride');
        if (storedRide && rideState === 'waiting') {
          const rideData = JSON.parse(storedRide);
          setPassenger({
            name: rideData.name || 'Yaserahmed',
            phone: rideData.phone || '01009524383',
            avatar: rideData.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
            pickupLocation: rideData.pickupLocation || 'موقع الانطلاق',
            destinationLocation: rideData.destinationLocation || 'الوجهة المطلوبة',
            price: rideData.price || '0',
          });
          setRideState('incoming');
        }
      } catch (error) {
        console.log(error);
      }
    };

    checkRideRequest();
    const interval = setInterval(checkRideRequest, 1000);
    return () => clearInterval(interval);
  }, [rideState]);

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
    Linking.openURL(`tel:${passenger.phone}`);
  };

  const handleCancel = async () => {
    await AsyncStorage.removeItem('active_ride');
    setRideState('waiting');
    alert('تم إلغاء المشوار.');
  };

  const handleArrived = () => {
    alert('تم إرسال إشعار للراكب بأنك وصلت.');
  };

  return (
    <View style={styles.container}>
      
      {rideState === 'waiting' && (
        <View style={styles.waitingContainer}>
          <Text style={styles.waitingText}>📡 في انتظار طلب مشوار من الراكب...</Text>
          <TouchableOpacity 
            style={styles.refreshBtn} 
            onPress={() => setRideState('incoming')}
          >
            <Text style={styles.refreshBtnText}>محاكاة ظهور الطلب</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* الطلب الجديد عند الكابتن: يظهر فيه تفاصيل المكان والسعر المعدل ورقم الهاتف المخفي */}
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

      {/* المشوار النشط بعد القبول: يظهر رقم الهاتف وزر الاتصال والسعر */}
      {rideState === 'accepted' && (
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

            <View style={styles.actionsContainer}>
              <TouchableOpacity style={styles.arrivedButton} onPress={handleArrived}>
                <Text style={styles.arrivedText}>لقد وصلت إلى موقع الراكب</Text>
              </TouchableOpacity>

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
  container: { flex: 1, backgroundColor: '#f8fafc' },
  waitingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  waitingText: { fontSize: 16, color: '#64748b', marginBottom: 20, fontWeight: 'bold' },
  refreshBtn: { backgroundColor: '#10b981', paddingVertical: 12, paddingHorizontal: 20, borderRadius: 12 },
  refreshBtnText: { color: '#fff', fontWeight: 'bold' },
  incomingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  incomingCard: { backgroundColor: '#ffffff', width: '100%', padding: 20, borderRadius: 20, elevation: 4, borderWidth: 1, borderColor: '#e2e8f0' },
  incomingTitle: { fontSize: 18, fontWeight: 'bold', color: '#0f172a', marginBottom: 15, textAlign: 'right' },
  passengerCardIncoming: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f1f5f9', padding: 12, borderRadius: 14, marginBottom: 12 },
  avatarIncoming: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#cbd5e1', marginLeft: 12 },
  passengerDetails: { flex: 1 },
  passengerName: { fontSize: 18, fontWeight: 'bold', color: '#0f172a', textAlign: 'right' },
  passengerPhone: { fontSize: 14, color: '#475569', marginTop: 2, textAlign: 'right' },
  hiddenPhoneText: { fontSize: 12, color: '#d97706', marginTop: 4, textAlign: 'right', fontWeight: 'bold' },
  tripDetailsBox: { backgroundColor: '#f8fafc', padding: 12, borderRadius: 12, marginBottom: 20, borderWidth: 1, borderColor: '#e2e8f0' },
  tripText: { fontSize: 14, fontWeight: 'bold', color: '#334155', marginBottom: 4, textAlign: 'right' },
  priceTag: { fontSize: 16, fontWeight: 'bold', color: '#10b981', marginTop: 6, textAlign: 'right' },
  acceptButton: { backgroundColor: '#10b981', paddingVertical: 16, borderRadius: 14, alignItems: 'center', elevation: 3 },
  acceptButtonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  activeRideContainer: { flex: 1, flexDirection: 'column' },
  mapContainer: { flex: 5.5, width: '100%' },
  mockMap: { flex: 1, backgroundColor: '#e2e8f0', justifyContent: 'center', alignItems: 'center', padding: 20 },
  mapVisualContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  dotCaptain: { backgroundColor: '#2563eb', padding: 8, borderRadius: 16, alignItems: 'center' },
  dotPassenger: { backgroundColor: '#dc2626', padding: 8, borderRadius: 16, alignItems: 'center' },
  mapLine: { width: 70, height: 4, backgroundColor: '#2563eb', marginHorizontal: 5 },
  dotText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  mapTitle: { fontSize: 18, fontWeight: 'bold', color: '#334155' },
  mapSubtitle: { fontSize: 13, color: '#64748b', marginTop: 5, textAlign: 'center' },
  mapPrice: { fontSize: 15, fontWeight: 'bold', color: '#10b981', marginTop: 8 },
  bottomCard: { flex: 4.5, backgroundColor: '#ffffff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, justifyContent: 'space-between', elevation: 10 },
  passengerCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f1f5f9', padding: 12, borderRadius: 16 },
  avatar: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#cbd5e1', marginLeft: 12 },
  callButton: { backgroundColor: '#10b981', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  callText: { color: '#ffffff', fontWeight: 'bold', fontSize: 14 },
  actionsContainer: { gap: 10 },
  arrivedButton: { backgroundColor: '#2563eb', paddingVertical: 15, borderRadius: 14, alignItems: 'center', elevation: 4 },
  arrivedText: { color: '#ffffff', fontSize: 16, fontWeight: 'bold' },
  cancelButton: { backgroundColor: '#fee2e2', paddingVertical: 13, borderRadius: 14, alignItems: 'center' },
  cancelButtonText: { color: '#ef4444', fontSize: 15, fontWeight: 'bold' },
});