import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { signOut } from 'firebase/auth';
import { collection, doc, getDoc, onSnapshot, query, updateDoc, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { auth, db } from '../firebaseConfig';

export default function CaptainHomeScreen() {
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [activeRide, setActiveRide] = useState<any | null>(null);
  const [captainImage, setCaptainImage] = useState('');
  const [captainId, setCaptainId] = useState<string>('');
  const [loading, setLoading] = useState(true);

  const router = useRouter();

  useEffect(() => {
    const initializeCaptain = async () => {
      try {
        let currentId = auth.currentUser?.uid;
        if (!currentId) {
          currentId = await AsyncStorage.getItem('currentCaptainId');
        }

        if (!currentId) {
          router.replace('/captain-login');
          return;
        }

        setCaptainId(currentId);

        const docSnap = await getDoc(doc(db, 'captains', currentId));
        if (docSnap.exists()) {
          setCaptainImage(docSnap.data().image || '');
        }

        const qPending = query(collection(db, 'rides'), where('status', '==', 'pending'));
        const unsubscribePending = onSnapshot(qPending, (snapshot) => {
          const ridesList: any[] = [];
          snapshot.forEach((docSnap) => {
            ridesList.push({ id: docSnap.id, ...docSnap.data() });
          });
          setPendingRequests(ridesList);
        });

        const qActive = query(
          collection(db, 'rides'), 
          where('captainId', '==', currentId)
        );
        const unsubscribeActive = onSnapshot(qActive, (snapshot) => {
          let foundActive = false;
          snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            if (['accepted', 'arrived', 'passenger_ready', 'in_progress'].includes(data.status)) {
              setActiveRide({ id: docSnap.id, ...data });
              foundActive = true;
            } else if (data.status === 'cancelled') {
              setActiveRide(null);
            }
          });

          if (!foundActive) {
            setActiveRide(null);
          }
          setLoading(false);
        });

        return () => {
          unsubscribePending();
          unsubscribeActive();
        };

      } catch (e) {
        console.log(e);
        setLoading(false);
        router.replace('/captain-login');
      }
    };

    initializeCaptain();
  }, []);

  const handleAcceptRide = async (rideId: string) => {
    try {
      if (!captainId) return;

      const captainDocRef = doc(db, 'captains', captainId);
      const captainDocSnap = await getDoc(captainDocRef);
      
      let captainName = 'كابتن';
      let captainPhone = '';
      let captainImg = '';
      let tukTukNumber = 'غير محدد';
      let tukTukModel = 'توكتوك';

      if (captainDocSnap.exists()) {
        const data = captainDocSnap.data();
        captainName = data.name || 'كابتن';
        captainPhone = data.phone || '';
        captainImg = data.image || '';
        tukTukNumber = data.tukTukNumber || 'غير محدد';
        tukTukModel = data.tukTukModel || 'توكتوك';
      }

      await updateDoc(doc(db, 'rides', rideId), {
        status: 'accepted',
        captainId: captainId,
        captainName: captainName,
        captainPhone: captainPhone,
        captainImage: captainImg,
        tukTukNumber: tukTukNumber,
        tukTukModel: tukTukModel,
      });

      Alert.alert('تم قبول المشوار! 🛺', 'توجه إلى موقع الراكب.');
    } catch (error) {
      Alert.alert('خطأ', 'تعذر قبول المشوار.');
    }
  };

  // الكابتن يضغط "لقد وصلت"
  const handleArrived = async (rideId: string) => {
    try {
      await updateDoc(doc(db, 'rides', rideId), {
        status: 'arrived',
      });
      Alert.alert('تم بنجاح', 'تم إبلاغ الراكب بوصولك إلى موقعه.');
    } catch (error) {
      Alert.alert('خطأ', 'حدث خطأ.');
    }
  };

  // الكابتن يضغط "ابدأ الرحلة"
  const handleStartRide = async (rideId: string) => {
    try {
      await updateDoc(doc(db, 'rides', rideId), {
        status: 'in_progress',
      });
      Alert.alert('بدء الرحلة 🚀', 'تم بدء الرحلة بنجاح.');
    } catch (error) {
      Alert.alert('خطأ', 'حدث خطأ.');
    }
  };

  const handleCompleteRide = async (rideId: string) => {
    try {
      await updateDoc(doc(db, 'rides', rideId), {
        status: 'completed',
      });
      setActiveRide(null);
      Alert.alert('تم بنجاح', 'تم إنهاء الرحلة بنجاح.');
    } catch (error) {
      Alert.alert('خطأ', 'تعذر إنهاء الرحلة.');
    }
  };

  const handleCancelRide = (rideId: string) => {
    Alert.alert(
      'إلغاء الرحلة',
      'هل تود إلغاء الرحلة؟',
      [
        { text: 'واصل الرحلة', style: 'cancel' },
        {
          text: 'نعم',
          style: 'destructive',
          onPress: async () => {
            try {
              await updateDoc(doc(db, 'rides', rideId), {
                status: 'cancelled',
                captainId: null,
              });
              setActiveRide(null);
              Alert.alert('تم الإلغاء', 'تم إلغاء الرحلة بنجاح.');
            } catch (error) {
              Alert.alert('خطأ', 'تعذر إلغاء الرحلة.');
            }
          },
        },
      ],
      { cancelable: true }
    );
  };

  const handleCall = (phone: string) => {
    if (phone) Linking.openURL(`tel:${phone}`);
  };

  const handleLogout = async () => {
    await AsyncStorage.removeItem('currentCaptainId');
    try {
      await signOut(auth);
    } catch (e) {}
    router.replace('/role');
  };

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>قائمة الرحلات 🛺</Text>

        <TouchableOpacity onPress={() => router.push('/captain-profile')} style={styles.profileBtn}>
          {captainImage ? (
            <Image source={{ uri: captainImage }} style={styles.headerAvatar} />
          ) : (
            <View style={styles.headerAvatarPlaceholder}>
              <Text style={{ fontSize: 12 }}>👤</Text>
            </View>
          )}
          <Text style={styles.profileBtnText}>الملف الشخصي</Text>
        </TouchableOpacity>
      </View>

      {activeRide ? (
        <View style={styles.activeRideContainer}>
          <View style={styles.bannerAlert}>
            <Text style={styles.activeTitle}>
              {activeRide.status === 'accepted' && '🚨 في طريقك إلى موقع الراكب'}
              {activeRide.status === 'arrived' && '📍 وصلت إلى موقع الراكب (بانتظار خروجه)'}
              {activeRide.status === 'passenger_ready' && '📢 تنبيه هام: الراكب في طريقه إليك الآن!'}
              {activeRide.status === 'in_progress' && '🚀 المشوار ساري إلى الوجهة...'}
            </Text>
          </View>

          <View style={styles.activeCard}>
            {activeRide.passengerImage ? (
              <Image source={{ uri: activeRide.passengerImage }} style={styles.passengerAvatar} />
            ) : (
              <View style={styles.passengerAvatarPlaceholder}>
                <Text style={{ fontSize: 24 }}>👤</Text>
              </View>
            )}

            <Text style={styles.cardText}>👤 الراكب: {activeRide.passengerName}</Text>
            <Text style={styles.cardText}>📞 الهاتف: {activeRide.passengerPhone || 'غير متوفر'}</Text>
            <Text style={styles.cardText}>📍 الانطلاق: {activeRide.pickup}</Text>
            <Text style={styles.cardText}>🏁 الوجهة: {activeRide.dropoff}</Text>

            {activeRide.passengerPhone ? (
              <TouchableOpacity style={styles.callButton} onPress={() => handleCall(activeRide.passengerPhone)}>
                <Text style={styles.callButtonText}>📞 اتصال بالراكب</Text>
              </TouchableOpacity>
            ) : null}

            {/* 1. زر "لقد وصلت" يظهر لما الكابتن يقبل المشوار */}
            {activeRide.status === 'accepted' && (
              <TouchableOpacity style={styles.arrivedButton} onPress={() => handleArrived(activeRide.id)}>
                <Text style={styles.arrivedButtonText}>📍 لقد وصلت إلى موقع الراكب</Text>
              </TouchableOpacity>
            )}

            {/* 2. زر "ابدأ الرحلة" يظهر بعد ما الراكب يدوس في طريقي إليك أو بعد الوصول */}
            {(activeRide.status === 'arrived' || activeRide.status === 'passenger_ready') && (
              <TouchableOpacity style={styles.startButton} onPress={() => handleStartRide(activeRide.id)}>
                <Text style={styles.startButtonText}>🚀 ابدأ المشوار</Text>
              </TouchableOpacity>
            )}

            {/* 3. زر "إنهاء المشوار" أثناء سريان الرحلة */}
            {activeRide.status === 'in_progress' && (
              <TouchableOpacity style={styles.completeButton} onPress={() => handleCompleteRide(activeRide.id)}>
                <Text style={styles.completeButtonText}>🏁 إنهاء المشوار</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.cancelButton} onPress={() => handleCancelRide(activeRide.id)}>
              <Text style={styles.cancelButtonText}>❌ إلغاء المشوار</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          <Text style={styles.subTitle}>الطلبات المتاحة حالياً:</Text>
          {pendingRequests.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>لا توجد طلبات مشاوير متاحة حالياً...</Text>
            </View>
          ) : (
            <FlatList
              data={pendingRequests}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <View style={styles.card}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                    {item.passengerImage ? (
                      <Image source={{ uri: item.passengerImage }} style={styles.smallAvatar} />
                    ) : (
                      <View style={styles.smallAvatarPlaceholder}>
                        <Text style={{ fontSize: 12 }}>👤</Text>
                      </View>
                    )}
                    <Text style={[styles.cardText, { fontWeight: 'bold', marginBottom: 0, marginRight: 8 }]}>
                      {item.passengerName}
                    </Text>
                  </View>

                  <Text style={styles.cardText}>📍 الانطلاق: {item.pickup}</Text>
                  <Text style={styles.cardText}>🏁 الوجهة: {item.dropoff}</Text>

                  <TouchableOpacity style={styles.acceptButton} onPress={() => handleAcceptRide(item.id)}>
                    <Text style={styles.acceptButtonText}>قبول المشوار</Text>
                  </TouchableOpacity>
                </View>
              )}
            />
          )}
        </View>
      )}

      <TouchableOpacity onPress={handleLogout} style={styles.logoutFooter}>
        <Text style={styles.logoutText}>تسجيل الخروج</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f6f9', padding: 20, paddingTop: 50 },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, borderBottomWidth: 1, borderBottomColor: '#ddd', paddingBottom: 10 },
  title: { fontSize: 20, fontWeight: 'bold', color: '#2563eb' },
  profileBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#e0f2fe', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20 },
  headerAvatar: { width: 28, height: 28, borderRadius: 14, marginLeft: 6 },
  headerAvatarPlaceholder: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#bae6fd', justifyContent: 'center', alignItems: 'center', marginLeft: 6 },
  profileBtnText: { color: '#2563eb', fontWeight: 'bold', fontSize: 13 },
  subTitle: { fontSize: 18, fontWeight: '600', color: '#333', marginBottom: 15, textAlign: 'right' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { color: '#666', fontSize: 16 },
  card: { backgroundColor: '#fff', padding: 16, borderRadius: 10, marginBottom: 15, borderWidth: 1, borderColor: '#ddd' },
  cardText: { fontSize: 16, color: '#333', marginBottom: 8, textAlign: 'right' },
  acceptButton: { backgroundColor: '#16a34a', padding: 12, borderRadius: 8, alignItems: 'center', marginTop: 10 },
  acceptButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  activeRideContainer: { flex: 1 },
  bannerAlert: { backgroundColor: '#fef3c7', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#f59e0b', marginBottom: 15 },
  activeTitle: { fontSize: 16, fontWeight: 'bold', color: '#b45309', textAlign: 'center' },
  activeCard: { backgroundColor: '#fff', padding: 20, borderRadius: 12, borderWidth: 1, borderColor: '#ddd', alignItems: 'center' },
  passengerAvatar: { width: 80, height: 80, borderRadius: 40, borderWidth: 2, borderColor: '#d97706', marginBottom: 15 },
  passengerAvatarPlaceholder: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#fef3c7', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#d97706', marginBottom: 15 },
  smallAvatar: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: '#ccc' },
  smallAvatarPlaceholder: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#e5e7eb', justifyContent: 'center', alignItems: 'center' },
  callButton: { backgroundColor: '#2563eb', padding: 12, borderRadius: 8, alignItems: 'center', marginTop: 10, width: '100%' },
  callButtonText: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
  arrivedButton: { backgroundColor: '#d97706', padding: 12, borderRadius: 8, alignItems: 'center', marginTop: 12, width: '100%' },
  arrivedButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  startButton: { backgroundColor: '#16a34a', padding: 12, borderRadius: 8, alignItems: 'center', marginTop: 12, width: '100%' },
  startButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  completeButton: { backgroundColor: '#dc2626', padding: 14, borderRadius: 8, alignItems: 'center', marginTop: 12, width: '100%' },
  completeButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  cancelButton: { backgroundColor: '#374151', padding: 12, borderRadius: 8, alignItems: 'center', marginTop: 12, width: '100%' },
  cancelButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  logoutFooter: { alignSelf: 'center', padding: 10, marginTop: 10 },
  logoutText: { color: '#ef4444', fontSize: 16, fontWeight: 'bold' },
});