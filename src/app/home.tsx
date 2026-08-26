import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { signOut } from 'firebase/auth';
import { addDoc, collection, doc, getDoc, onSnapshot, query, updateDoc, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Linking, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { auth, db } from '../firebaseConfig';

export default function PassengerHomeScreen() {
  const [pickup, setPickup] = useState('');
  const [dropoff, setDropoff] = useState('');
  const [activeRide, setActiveRide] = useState<any | null>(null);
  const [passengerName, setPassengerName] = useState('راكب');
  const [passengerPhone, setPassengerPhone] = useState('');
  const [passengerImage, setPassengerImage] = useState('');
  const [passengerId, setPassengerId] = useState('');
  const [loading, setLoading] = useState(true);
  const [locating, setLocating] = useState(false);

  const router = useRouter();

  useEffect(() => {
    let unsubscribeActive: any = null;

    const fetchPassengerData = async () => {
      try {
        let currentPassengerId = auth.currentUser?.uid;
        if (!currentPassengerId) {
          currentPassengerId = await AsyncStorage.getItem('currentPassengerId');
        }

        if (!currentPassengerId) {
          router.replace('/login');
          return;
        }

        setPassengerId(currentPassengerId);

        const docSnap = await getDoc(doc(db, 'passengers', currentPassengerId));
        if (docSnap.exists()) {
          const data = docSnap.data();
          setPassengerName(data.name || 'راكب');
          setPassengerPhone(data.phone || '');
          setPassengerImage(data.image || '');
        }

        const qActive = query(
          collection(db, 'rides'), 
          where('passengerId', '==', currentPassengerId)
        );

        unsubscribeActive = onSnapshot(qActive, (snapshot) => {
          let foundActive = false;
          snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            // متابعة كل الحالات النشطة لحد ما الرحلة تخلص
            if (['pending', 'accepted', 'arrived', 'passenger_ready', 'in_progress'].includes(data.status)) {
              setActiveRide({ id: docSnap.id, ...data });
              foundActive = true;
            }
          });
          if (!foundActive) {
            setActiveRide(null);
          }
          setLoading(false);
        });

      } catch (e) {
        console.log(e);
        setLoading(false);
      }
    };

    fetchPassengerData();

    return () => {
      if (unsubscribeActive) unsubscribeActive();
    };
  }, []);

  const handleGetCurrentLocation = async () => {
    try {
      setLocating(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('تنبيه', 'يرجى السماح للتطبيق بالوصول للموقع.');
        setLocating(false);
        return;
      }

      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const geocode = await Location.reverseGeocodeAsync({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      });

      if (geocode && geocode.length > 0) {
        const place = geocode[0];
        const formatted = [place.street, place.district, place.city].filter(Boolean).join('، ');
        setPickup(formatted || `موقعي الحالي (${loc.coords.latitude.toFixed(4)}, ${loc.coords.longitude.toFixed(4)})`);
      } else {
        setPickup(`موقعي الحالي (${loc.coords.latitude.toFixed(4)}, ${loc.coords.longitude.toFixed(4)})`);
      }
    } catch (error) {
      Alert.alert('خطأ', 'تعذر تحديد موقعك الحالي.');
    } finally {
      setLocating(false);
    }
  };

  const handleRequestRide = async () => {
    if (!pickup || !dropoff) {
      Alert.alert('خطأ', 'يرجى إدخال مكان الانطلاق والوجهة.');
      return;
    }

    try {
      const activePid = passengerId || auth.currentUser?.uid || (await AsyncStorage.getItem('currentPassengerId')) || 'guest';

      await addDoc(collection(db, 'rides'), {
        passengerId: activePid,
        passengerName: passengerName,
        passengerPhone: passengerPhone,
        passengerImage: passengerImage,
        pickup: pickup,
        dropoff: dropoff,
        status: 'pending',
        createdAt: new Date(),
      });

      Alert.alert('تم بنجاح 🛺', 'تم إرسال طلبك للكابتن، بانتظار القبول...');
      setPickup('');
      setDropoff('');
    } catch (error) {
      Alert.alert('خطأ', 'تعذر إرسال الطلب.');
    }
  };

  const handleCancelRide = async (rideId: string) => {
    try {
      await updateDoc(doc(db, 'rides', rideId), {
        status: 'cancelled',
      });
      setActiveRide(null);
      Alert.alert('تم الإلغاء', 'تم إلغاء الرحلة بنجاح.');
    } catch (error) {
      Alert.alert('خطأ', 'تعذر إلغاء الرحلة.');
    }
  };

  const handleCall = (phone: string) => {
    if (phone) Linking.openURL(`tel:${phone}`);
  };

  const handleLogout = async () => {
    await AsyncStorage.removeItem('currentPassengerId');
    try {
      await signOut(auth);
    } catch (e) {}
    router.replace('/role');
  };

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#d97706" />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {passengerImage ? (
            <Image source={{ uri: passengerImage }} style={styles.headerAvatar} />
          ) : (
            <View style={styles.headerAvatarPlaceholder}>
              <Text style={{ fontSize: 14 }}>👤</Text>
            </View>
          )}
          <Text style={styles.title}>أهلاً، {passengerName} 🛺</Text>
        </View>

        <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
          <Text style={styles.logoutBtnText}>خروج</Text>
        </TouchableOpacity>
      </View>

      {activeRide ? (
        <View style={styles.activeCard}>
          <Text style={styles.activeCardTitle}>
            {activeRide.status === 'pending' && '⏳ جاري البحث عن كابتن...'}
            {activeRide.status === 'accepted' && '🚨 تم قبول المشوار، الكابتن في طريقه إليك!'}
            {activeRide.status === 'arrived' && '📍 وصل الكابتن إلى موقعك!'}
            {activeRide.status === 'passenger_ready' && '📢 تم إبلاغ الكابتن: أنت في طريقك إليه!'}
            {activeRide.status === 'in_progress' && '🚀 تم بدء المشوار، بالتوفيق!'}
          </Text>

          {activeRide.captainName && (
            <View style={styles.captainInfoBox}>
              {activeRide.captainImage ? (
                <Image source={{ uri: activeRide.captainImage }} style={styles.captainAvatar} />
              ) : (
                <View style={styles.captainAvatarPlaceholder}>
                  <Text style={{ fontSize: 20 }}>🧑‍✈️</Text>
                </View>
              )}
              <View style={{ flex: 1, marginRight: 10 }}>
                <Text style={styles.cardText}>🧑‍✈️ الكابتن: {activeRide.captainName}</Text>
                <Text style={styles.cardText}>🛺 التوكتوك: {activeRide.tukTukModel || 'توكتوك'} ({activeRide.tukTukNumber || 'غير محدد'})</Text>
                <Text style={styles.cardText}>📞 الهاتف: {activeRide.captainPhone || 'غير متوفر'}</Text>
              </View>
            </View>
          )}

          <Text style={styles.cardText}>📍 الانطلاق: {activeRide.pickup}</Text>
          <Text style={styles.cardText}>🏁 الوجهة: {activeRide.dropoff}</Text>

          {activeRide.captainPhone ? (
            <TouchableOpacity style={styles.callButton} onPress={() => handleCall(activeRide.captainPhone)}>
              <Text style={styles.callButtonText}>📞 اتصال بالكابتن</Text>
            </TouchableOpacity>
          ) : null}

          {/* زر في طريقي إليك لا يظهر إلا عندما يصل الكابتن ويضغط "لقد وصلت" (حالة arrived) */}
          {activeRide.status === 'arrived' && (
            <TouchableOpacity 
              style={styles.readyButton} 
              onPress={async () => {
                try {
                  await updateDoc(doc(db, 'rides', activeRide.id), {
                    status: 'passenger_ready',
                  });
                  Alert.alert('تنبيه 🚗', 'تم إرسال رسالة للكابتن بأنك في طريقك إليه.');
                } catch (e) {
                  Alert.alert('خطأ', 'تعذر إرسال التنبيه.');
                }
              }}
            >
              <Text style={styles.readyButtonText}>🚗 في طريقي إليك</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.cancelButton} onPress={() => handleCancelRide(activeRide.id)}>
            <Text style={styles.cancelButtonText}>❌ إلغاء الطلب</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.formCard}>
          <Text style={styles.subTitle}>اطلب مشوارك الآن:</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>موقع الانطلاق الحالي 📍</Text>
            <View style={styles.pickupRow}>
              <TextInput 
                style={styles.pickupInput} 
                placeholder="اكتب مكان الانطلاق أو اضغط موقعي" 
                placeholderTextColor="#9ca3af"
                value={pickup} 
                onChangeText={setPickup} 
              />
              <TouchableOpacity 
                style={styles.locationBtn} 
                onPress={handleGetCurrentLocation}
                disabled={locating}
              >
                {locating ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.locationBtnText}>📍 موقعي</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>الوجهة المطلوبة 🏁</Text>
            <TextInput 
              style={styles.input} 
              placeholder="مثال: الموقف، المحطة، السوق" 
              placeholderTextColor="#9ca3af"
              value={dropoff} 
              onChangeText={setDropoff} 
            />
          </View>

          <TouchableOpacity style={styles.requestButton} onPress={handleRequestRide}>
            <Text style={styles.requestButtonText}>بحث عن كابتن 🛺</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: '#f4f6f9', padding: 20, paddingTop: 50 },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, borderBottomWidth: 1, borderBottomColor: '#ddd', paddingBottom: 10 },
  title: { fontSize: 18, fontWeight: 'bold', color: '#d97706' },
  headerAvatar: { width: 36, height: 36, borderRadius: 18, marginLeft: 8 },
  headerAvatarPlaceholder: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#fed7aa', justifyContent: 'center', alignItems: 'center', marginLeft: 8 },
  logoutBtn: { backgroundColor: '#fee2e2', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8 },
  logoutBtnText: { color: '#dc2626', fontWeight: 'bold', fontSize: 13 },
  formCard: { backgroundColor: '#fff', padding: 20, borderRadius: 12, borderWidth: 1, borderColor: '#ddd' },
  subTitle: { fontSize: 18, fontWeight: '600', color: '#333', marginBottom: 15, textAlign: 'right' },
  inputGroup: { marginBottom: 15 },
  label: { fontSize: 14, fontWeight: '600', color: '#4b5563', marginBottom: 5, textAlign: 'right' },
  pickupRow: { flexDirection: 'row', alignItems: 'center' },
  pickupInput: { flex: 1, backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 12, fontSize: 16, textAlign: 'right', color: '#333' },
  locationBtn: { backgroundColor: '#d97706', paddingVertical: 12, paddingHorizontal: 15, borderRadius: 8, marginRight: 8, justifyContent: 'center', alignItems: 'center' },
  locationBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  input: { backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 12, fontSize: 16, textAlign: 'right', color: '#333' },
  requestButton: { backgroundColor: '#d97706', padding: 15, borderRadius: 10, alignItems: 'center', marginTop: 10 },
  requestButtonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  activeCard: { backgroundColor: '#fffbeb', padding: 20, borderRadius: 12, borderWidth: 2, borderColor: '#d97706' },
  activeCardTitle: { fontSize: 16, fontWeight: 'bold', color: '#d97706', marginBottom: 15, textAlign: 'center' },
  captainInfoBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fef3c7', padding: 10, borderRadius: 8, marginBottom: 15 },
  captainAvatar: { width: 50, height: 50, borderRadius: 25, borderWidth: 1, borderColor: '#d97706' },
  captainAvatarPlaceholder: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#fde68a', justifyContent: 'center', alignItems: 'center' },
  cardText: { fontSize: 14, color: '#333', marginBottom: 4, textAlign: 'right' },
  callButton: { backgroundColor: '#2563eb', padding: 12, borderRadius: 8, alignItems: 'center', marginTop: 10 },
  callButtonText: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
  readyButton: { backgroundColor: '#16a34a', padding: 12, borderRadius: 8, alignItems: 'center', marginTop: 10 },
  readyButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  cancelButton: { backgroundColor: '#dc2626', padding: 12, borderRadius: 8, alignItems: 'center', marginTop: 10 },
  cancelButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});