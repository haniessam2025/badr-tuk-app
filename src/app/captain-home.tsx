import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import { collection, deleteDoc, doc, getDoc, onSnapshot, query, setDoc, updateDoc, where } from 'firebase/firestore';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Animated, Dimensions, FlatList, Image, Linking, Modal, PanResponder, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { db } from '../firebaseConfig';

const SCREEN_WIDTH = Dimensions.get('window').width;

const SwipeableRequestItem = ({ item, onSendOffer, onEditPrice, onDismiss }: { item: any, onSendOffer: (item: any, price: string) => void, onEditPrice: (item: any) => void, onDismiss: (id: string) => void }) => {
  const translateX = useRef(new Animated.Value(0)).current;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 20 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy);
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dx < 0) {
          translateX.setValue(gestureState.dx);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx < -SCREEN_WIDTH * 0.25) {
          Animated.timing(translateX, {
            toValue: -SCREEN_WIDTH,
            duration: 250,
            useNativeDriver: true,
          }).start(() => onDismiss(item.id));
        } else {
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      }
    })
  ).current;

  return (
    <View style={styles.swipeContainer}>
      <View style={styles.hiddenBackground}>
        <Text style={styles.hiddenText}>إخفاء الطلب 👁️‍🗨️</Text>
      </View>
      
      <Animated.View
        style={[styles.requestCard, { transform: [{ translateX }] }]}
        {...panResponder.panHandlers}
      >
        <View style={styles.passengerInfoRow}>
          <Image source={{ uri: item.avatar }} style={styles.passengerAvatar} />
          <Text style={styles.passengerName}>{item.name}</Text>
        </View>
        
        <View style={styles.routeContainer}>
          <Text style={styles.routeText}>📍 من: {item.pickupLocation}</Text>
          <Text style={styles.routeText}>🏁 إلى: {item.destinationLocation}</Text>
          <Text style={styles.routeText}>👥 عدد الركاب: {item.passengerCount || 1}</Text>
        </View>
        
        <Text style={styles.priceTag}>💰 السعر المطلوب: {item.price} جنيه</Text>
        
        <View style={styles.requestActionsRow}>
          <TouchableOpacity style={styles.editPriceBtn} onPress={() => onEditPrice(item)}>
            <Text style={styles.editPriceBtnText}>✏️ تقديم عرض سعر</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.acceptBtn} onPress={() => onSendOffer(item, item.price)}>
            <Text style={styles.acceptBtnText}>✔️ موافقة بنفس السعر</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
};

export default function CaptainHome() {
  const router = useRouter();
  const [allRequests, setAllRequests] = useState<any[]>([]); 
  const [dismissedRequests, setDismissedRequests] = useState<string[]>([]); 
  const [activeRide, setActiveRide] = useState<any>(null);
  
  const [pendingOffer, setPendingOffer] = useState<any>(null);
  
  const [isPriceModalVisible, setIsPriceModalVisible] = useState(false);
  const [selectedRideForPrice, setSelectedRideForPrice] = useState<any>(null);
  const [tempCaptainPrice, setTempCaptainPrice] = useState('');

  const [captainProfile, setCaptainProfile] = useState({
    id: '',
    name: 'كابتن...',
    phone: '',
    vehicle: 'توكتوك',
    avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
  });

  useFocusEffect(
    useCallback(() => {
      loadCaptainProfile();
      checkPendingOffer();
    }, [])
  );

  const loadCaptainProfile = async () => {
    try {
      const captainId = await AsyncStorage.getItem('currentCaptainId');
      if (captainId) {
        const docRef = doc(db, 'captains', captainId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setCaptainProfile({
            id: captainId,
            name: data.name || 'كابتن',
            phone: data.phone || '',
            vehicle: data.vehicle || 'توكتوك',
            avatar: data.avatar || data.image || data.photo || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
          });
        }
      } else {
        router.replace('/captain-login');
      }
    } catch (e) {
      console.log(e);
    }
  };

  const checkPendingOffer = async () => {
    const savedOffer = await AsyncStorage.getItem('pending_offer');
    if (savedOffer) {
      setPendingOffer(JSON.parse(savedOffer));
    }
  };

  useEffect(() => {
    const q = query(collection(db, 'rides'), where('status', '==', 'pending'));
    
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const pendingRequests: any[] = [];
      querySnapshot.forEach((docSnap) => {
        pendingRequests.push({ id: docSnap.id, ...docSnap.data() });
      });
      
      pendingRequests.sort((a, b) => b.timestamp - a.timestamp);
      setAllRequests(pendingRequests);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!captainProfile.id) return;
    
    const activeRideQuery = query(
      collection(db, 'rides'),
      where('captainId', '==', captainProfile.id),
      where('status', 'in', ['accepted', 'captain_arrived'])
    );

    const unsubscribe = onSnapshot(activeRideQuery, async (snapshot) => {
      if (!snapshot.empty) {
        const currentActive = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
        setActiveRide(currentActive);
        
        setPendingOffer(null);
        await AsyncStorage.removeItem('pending_offer');
      } else {
        setActiveRide(null);
      }
    });

    return () => unsubscribe();
  }, [captainProfile.id]);

  useEffect(() => {
    if (!pendingOffer || !captainProfile.id) return;

    const rideRef = doc(db, 'rides', pendingOffer.rideId);
    const unsubscribe = onSnapshot(rideRef, async (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        
        if (data.status === 'accepted' && data.captainId !== captainProfile.id) {
          Alert.alert('عذراً', 'لقد قام الراكب بقبول عرض من كابتن آخر لهذه الرحلة.');
          setPendingOffer(null);
          await AsyncStorage.removeItem('pending_offer');
        }
        
        if (data.status === 'canceled') {
          Alert.alert('تنبيه', 'قام الراكب بإلغاء الطلب.');
          setPendingOffer(null);
          await AsyncStorage.removeItem('pending_offer');
        }
      } else {
        setPendingOffer(null);
        await AsyncStorage.removeItem('pending_offer');
      }
    });

    return () => unsubscribe();
  }, [pendingOffer, captainProfile.id]);

  const sendOffer = async (ride: any, offerPrice: string) => {
    if (!captainProfile.id) return;
    try {
      const offerRef = doc(db, 'rides', ride.id, 'offers', captainProfile.id);
      await setDoc(offerRef, {
        captainId: captainProfile.id,
        captainName: captainProfile.name,
        captainPhone: captainProfile.phone,
        captainVehicle: captainProfile.vehicle,
        captainAvatar: captainProfile.avatar,
        offeredPrice: offerPrice,
        timestamp: new Date().getTime(),
      });
      
      const offerData = {
        rideId: ride.id,
        passengerName: ride.name,
        pickupLocation: ride.pickupLocation,
        destinationLocation: ride.destinationLocation,
        passengerCount: ride.passengerCount || 1,
        offeredPrice: offerPrice
      };
      
      setPendingOffer(offerData);
      await AsyncStorage.setItem('pending_offer', JSON.stringify(offerData));
      
      setIsPriceModalVisible(false);
      
    } catch (error) {
      Alert.alert('خطأ', 'حدثت مشكلة أثناء إرسال العرض.');
    }
  };

  const cancelPendingOffer = async () => {
    if (!pendingOffer || !captainProfile.id) return;
    try {
      const offerRef = doc(db, 'rides', pendingOffer.rideId, 'offers', captainProfile.id);
      await deleteDoc(offerRef);
      
      setPendingOffer(null);
      await AsyncStorage.removeItem('pending_offer');
      Alert.alert('تم', 'تم التراجع عن العرض بنجاح.');
    } catch (error) {
      Alert.alert('خطأ', 'حدثت مشكلة أثناء إلغاء العرض.');
    }
  };

  const openPriceModal = (ride: any) => {
    setSelectedRideForPrice(ride);
    setTempCaptainPrice(ride.price.toString());
    setIsPriceModalVisible(true);
  };

  const confirmCustomPrice = () => {
    if (!tempCaptainPrice || parseInt(tempCaptainPrice) <= 0) {
      Alert.alert('خطأ', 'برجاء إدخال سعر صحيح.');
      return;
    }
    sendOffer(selectedRideForPrice, tempCaptainPrice);
  };

  const notifyArrival = async () => {
    if (!activeRide) return;
    try {
      const rideRef = doc(db, 'rides', activeRide.id);
      await updateDoc(rideRef, { status: 'captain_arrived' });
    } catch (error) {
      console.log(error);
    }
  };

  const completeRide = async () => {
    if (!activeRide) return;
    try {
      const rideRef = doc(db, 'rides', activeRide.id);
      await updateDoc(rideRef, { status: 'completed' });
      setActiveRide(null);
      Alert.alert('ممتاز', 'تم إنهاء الرحلة بنجاح.');
    } catch (error) {
      console.log(error);
    }
  };

  const handleCallPassenger = (phone: string) => {
    if (!phone) {
      Alert.alert('تنبيه', 'رقم الراكب غير متوفر.');
      return;
    }
    Linking.openURL(`tel:${phone}`);
  };

  const handleLogout = async () => {
    await AsyncStorage.removeItem('currentCaptainId');
    await AsyncStorage.removeItem('pending_offer'); 
    router.replace('/captain-login');
  };

  const handleDismissRequest = (id: string) => {
    setDismissedRequests((prev) => [...prev, id]);
  };

  const displayRequests = allRequests.filter(req => !dismissedRequests.includes(req.id));

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.userInfo} onPress={() => router.push('/captain-profile')}>
          <Image source={{ uri: captainProfile.avatar }} style={styles.profileAvatar} />
          <Text style={styles.welcomeText}>أهلاً كابتن، <Text style={styles.userName}>{captainProfile.name} 👨‍✈️</Text></Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutText}>خروج</Text>
        </TouchableOpacity>
      </View>

      {activeRide ? (
        <View style={styles.activeRideContainer}>
          <Text style={styles.activeRideTitle}>
            {activeRide.status === 'accepted' ? '🛺 أنت الآن في طريقك للراكب' : '🔔 لقد وصلت للراكب'}
          </Text>

          <View style={styles.passengerCard}>
            <Image source={{ uri: activeRide.avatar }} style={styles.activeAvatar} />
            <View style={styles.detailsCol}>
              <Text style={styles.detailsText}>👤 الراكب: {activeRide.name}</Text>
            </View>
          </View>

          {/* تم رفع أزرار الاتصال والمراسلة لتكون هنا */}
          <View style={styles.actionButtonsRow}>
            <TouchableOpacity style={styles.actionBtnCall} onPress={() => handleCallPassenger(activeRide.phone)}>
              <Text style={styles.actionBtnText}>📞 اتصال</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.actionBtnChat} onPress={() => router.push({ pathname: '/chat', params: { senderType: 'captain' } })}>
              <Text style={styles.actionBtnText}>💬 مراسلة</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.tripRouteContainer}>
            <Text style={styles.routeText}>📍 الانطلاق: {activeRide.pickupLocation}</Text>
            <Text style={styles.routeText}>🏁 الوجهة: {activeRide.destinationLocation}</Text>
            <Text style={styles.routeText}>👥 الركاب: {activeRide.passengerCount || 1}</Text>
            <Text style={styles.priceTagActive}>💰 أجرة الرحلة: {activeRide.price} جنيه</Text>
          </View>

          {activeRide.status === 'accepted' ? (
            <TouchableOpacity style={styles.arriveButton} onPress={notifyArrival}>
              <Text style={styles.arriveButtonText}>📍 إبلاغ بالوصول للراكب</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.completeButton} onPress={completeRide}>
              <Text style={styles.completeButtonText}>✅ إنهاء المشوار</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : 
      
      pendingOffer ? (
        <View style={styles.pendingOfferContainer}>
          <Text style={styles.pendingTitle}>⏳ جاري مراجعة عرضك لدى الراكب...</Text>
          <Text style={styles.pendingSubtitle}>لا يمكنك قبول طلبات أخرى حتى يرد الراكب أو تقوم بالتراجع.</Text>
          
          <View style={styles.tripRouteContainer}>
            <Text style={styles.routeText}>👤 الراكب: {pendingOffer.passengerName}</Text>
            <Text style={styles.routeText}>📍 من: {pendingOffer.pickupLocation}</Text>
            <Text style={styles.routeText}>🏁 إلى: {pendingOffer.destinationLocation}</Text>
            <Text style={styles.routeText}>👥 عدد الركاب: {pendingOffer.passengerCount}</Text>
            <Text style={styles.pendingPriceTag}>💰 السعر الذي عرضته: {pendingOffer.offeredPrice} جنيه</Text>
          </View>

          <TouchableOpacity style={styles.cancelOfferBtn} onPress={cancelPendingOffer}>
            <Text style={styles.cancelOfferBtnText}>❌ تراجع عن الطلب</Text>
          </TouchableOpacity>
        </View>
      ) : 
      
      (
        <>
          <Text style={styles.sectionTitle}>الطلبات المتاحة حالياً 📡</Text>
          {displayRequests.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>لا توجد طلبات في الوقت الحالي، خليك جاهز!</Text>
            </View>
          ) : (
            <FlatList
              data={displayRequests}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <SwipeableRequestItem 
                  item={item} 
                  onSendOffer={sendOffer} 
                  onEditPrice={openPriceModal}
                  onDismiss={handleDismissRequest} 
                />
              )}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 20 }}
            />
          )}
        </>
      )}

      <Modal visible={isPriceModalVisible} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>✏️ تقديم عرض سعر</Text>
            <Text style={styles.modalSubtitle}>أدخل السعر المناسب لك لإتمام هذه الرحلة:</Text>

            <TextInput
              style={styles.modalInput}
              value={tempCaptainPrice}
              onChangeText={setTempCaptainPrice}
              keyboardType="numeric"
              placeholder="اكتب السعر الجديد"
              placeholderTextColor="#94a3b8"
            />

            <View style={styles.modalButtonsRow}>
              <TouchableOpacity style={styles.modalSaveBtn} onPress={confirmCustomPrice}>
                <Text style={styles.modalSaveBtnText}>إرسال العرض</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setIsPriceModalVisible(false)}>
                <Text style={styles.modalCancelBtnText}>إلغاء</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9', padding: 15, paddingTop: 40 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#ffffff', padding: 12, borderRadius: 16, marginBottom: 20, elevation: 2 },
  userInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  profileAvatar: { width: 45, height: 45, borderRadius: 22.5, backgroundColor: '#cbd5e1', marginLeft: 10 },
  welcomeText: { fontSize: 15, color: '#334155' },
  userName: { fontWeight: 'bold', color: '#2563eb' },
  logoutButton: { backgroundColor: '#fee2e2', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 12 },
  logoutText: { color: '#ef4444', fontWeight: 'bold', fontSize: 14 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#1e293b', marginBottom: 15, textAlign: 'right' },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { fontSize: 16, color: '#64748b', textAlign: 'center' },
  
  swipeContainer: { position: 'relative', marginBottom: 15 },
  hiddenBackground: { ...StyleSheet.absoluteFillObject, backgroundColor: '#fee2e2', borderRadius: 16, justifyContent: 'center', alignItems: 'flex-end', paddingRight: 20 },
  hiddenText: { color: '#ef4444', fontWeight: 'bold', fontSize: 16 },
  
  requestCard: { backgroundColor: '#ffffff', padding: 15, borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', elevation: 3 },
  passengerInfoRow: { flexDirection: 'row-reverse', alignItems: 'center', marginBottom: 10 },
  passengerAvatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#cbd5e1', marginLeft: 10 },
  passengerName: { fontSize: 16, fontWeight: 'bold', color: '#0f172a' },
  routeContainer: { backgroundColor: '#f8fafc', padding: 10, borderRadius: 8, marginBottom: 10, borderWidth: 1, borderColor: '#f1f5f9' },
  routeText: { fontSize: 14, color: '#334155', fontWeight: 'bold', marginBottom: 4, textAlign: 'right' },
  priceTag: { fontSize: 16, color: '#10b981', fontWeight: 'bold', textAlign: 'center', marginBottom: 15 },
  
  requestActionsRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', gap: 10 },
  editPriceBtn: { flex: 1, backgroundColor: '#f59e0b', paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  editPriceBtnText: { color: '#ffffff', fontSize: 14, fontWeight: 'bold' },
  acceptBtn: { flex: 1, backgroundColor: '#2563eb', paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  acceptBtnText: { color: '#ffffff', fontSize: 14, fontWeight: 'bold' },

  activeRideContainer: { backgroundColor: '#ffffff', padding: 20, borderRadius: 20, borderWidth: 2, borderColor: '#2563eb', elevation: 6 },
  activeRideTitle: { fontSize: 18, fontWeight: 'bold', color: '#2563eb', textAlign: 'center', marginBottom: 20 },
  passengerCard: { flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: '#eff6ff', padding: 12, borderRadius: 14, marginBottom: 15 },
  activeAvatar: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#cbd5e1', marginLeft: 15 },
  detailsCol: { flex: 1 },
  detailsText: { fontSize: 14, fontWeight: 'bold', color: '#1e293b', marginBottom: 4, textAlign: 'right' },
  tripRouteContainer: { backgroundColor: '#f8fafc', padding: 12, borderRadius: 10, marginBottom: 15, borderWidth: 1, borderColor: '#e2e8f0' },
  priceTagActive: { fontSize: 16, color: '#10b981', fontWeight: 'bold', marginTop: 4, textAlign: 'center' },
  
  actionButtonsRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 15 },
  actionBtnCall: { flex: 1, backgroundColor: '#10b981', paddingVertical: 12, borderRadius: 10, alignItems: 'center', marginLeft: 5 },
  actionBtnChat: { flex: 1, backgroundColor: '#8b5cf6', paddingVertical: 12, borderRadius: 10, alignItems: 'center', marginRight: 5 },
  actionBtnText: { color: '#ffffff', fontSize: 15, fontWeight: 'bold' },
  
  arriveButton: { backgroundColor: '#f59e0b', paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  arriveButtonText: { color: '#ffffff', fontSize: 16, fontWeight: 'bold' },
  completeButton: { backgroundColor: '#dc2626', paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  completeButtonText: { color: '#ffffff', fontSize: 16, fontWeight: 'bold' },

  pendingOfferContainer: { backgroundColor: '#ffffff', padding: 20, borderRadius: 20, borderWidth: 2, borderColor: '#f59e0b', elevation: 6 },
  pendingTitle: { fontSize: 18, fontWeight: 'bold', color: '#d97706', textAlign: 'center', marginBottom: 10 },
  pendingSubtitle: { fontSize: 14, color: '#64748b', textAlign: 'center', marginBottom: 20 },
  pendingPriceTag: { fontSize: 16, color: '#d97706', fontWeight: 'bold', marginTop: 8, textAlign: 'center' },
  cancelOfferBtn: { backgroundColor: '#fee2e2', paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginTop: 10 },
  cancelOfferBtnText: { color: '#dc2626', fontSize: 16, fontWeight: 'bold' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { backgroundColor: '#ffffff', width: '100%', padding: 20, borderRadius: 20, elevation: 5 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#1e293b', marginBottom: 8, textAlign: 'right' },
  modalSubtitle: { fontSize: 13, color: '#64748b', marginBottom: 15, textAlign: 'right' },
  modalInput: { backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 12, padding: 12, fontSize: 16, fontWeight: 'bold', color: '#0f172a', textAlign: 'center', marginBottom: 20 },
  modalButtonsRow: { flexDirection: 'row-reverse', gap: 10 },
  modalSaveBtn: { flex: 2, backgroundColor: '#2563eb', paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  modalSaveBtnText: { color: '#ffffff', fontWeight: 'bold', fontSize: 15 },
  modalCancelBtn: { flex: 1, backgroundColor: '#fee2e2', paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  modalCancelBtnText: { color: '#ef4444', fontWeight: 'bold', fontSize: 15 },
});