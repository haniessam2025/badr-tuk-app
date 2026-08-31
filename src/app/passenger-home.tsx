import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, usePathname, useRouter } from 'expo-router';
import { addDoc, collection, doc, getDoc, onSnapshot, updateDoc } from 'firebase/firestore';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Image, Linking, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { db } from '../firebaseConfig';

export default function PassengerHome() {
  const router = useRouter();
  const pathname = usePathname();
  
  const [pickup, setPickup] = useState('');
  const [destination, setDestination] = useState('');
  const [price, setPrice] = useState('');
  const [calculatedBasePrice, setCalculatedBasePrice] = useState(0);
  const [rideStatus, setRideStatus] = useState<'idle' | 'searching' | 'accepted' | 'arrived'>('idle');
  
  // حالة عدد الركاب والقائمة المنسدلة
  const [passengerCount, setPassengerCount] = useState(1);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const [activeRideId, setActiveRideId] = useState<string | null>(null);
  const [captainOffers, setCaptainOffers] = useState<any[]>([]);
  
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [tempPrice, setTempPrice] = useState('');

  const [passengerProfile, setPassengerProfile] = useState({
    name: 'جارٍ التحميل...',
    phone: '',
    avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
  });

  const [captainInfo, setCaptainInfo] = useState({
    name: 'كابتن',
    vehicle: 'توكتوك',
    phone: '',
    avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
  });

  useFocusEffect(
    useCallback(() => {
      loadPassengerProfile();
      checkInitialRide();
    }, [])
  );

  const loadPassengerProfile = async () => {
    try {
      const passengerId = await AsyncStorage.getItem('currentPassengerId');
      if (passengerId) {
        const docRef = doc(db, 'passengers', passengerId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setPassengerProfile({
            name: data.name || 'مستخدم جديد',
            phone: data.phone || '01000000000',
            avatar: data.avatar || data.image || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
          });
        }
      } else {
        router.replace('/passenger-login');
      }
    } catch (e) {
      console.log(e);
    }
  };

  const checkInitialRide = async () => {
    try {
      const savedRide = await AsyncStorage.getItem('active_ride');
      if (savedRide) {
        const data = JSON.parse(savedRide);
        setActiveRideId(data.id);
        setPickup(data.pickupLocation);
        setDestination(data.destinationLocation);
        setPrice(data.price);
        setPassengerCount(data.passengerCount || 1);
      }
    } catch (error) {
      console.log(error);
    }
  };

  useEffect(() => {
    let unsubscribeRide: () => void;
    let unsubscribeOffers: () => void;

    if (activeRideId) {
      const rideRef = doc(db, 'rides', activeRideId);
      unsubscribeRide = onSnapshot(rideRef, async (docSnap) => {
        if (docSnap.exists()) {
          const firebaseData = docSnap.data();
          if (firebaseData.status === 'accepted') {
            setRideStatus('accepted');
            setCaptainInfo({
              name: firebaseData.captainName || 'كابتن',
              phone: firebaseData.captainPhone || '',
              vehicle: firebaseData.captainVehicle || 'توكتوك',
              avatar: firebaseData.captainAvatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
            });
            setPrice(firebaseData.price); 
          } else if (firebaseData.status === 'captain_arrived') {
            setRideStatus('arrived');
          } else if (firebaseData.status === 'completed' || firebaseData.status === 'canceled') {
            await resetRideState();
          } else if (firebaseData.status === 'pending') {
            setRideStatus('searching');
          }
        } else {
          await resetRideState();
        }
      });

      const offersRef = collection(db, 'rides', activeRideId, 'offers');
      unsubscribeOffers = onSnapshot(offersRef, (snapshot) => {
        const offers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setCaptainOffers(offers.sort((a, b) => a.offeredPrice - b.offeredPrice));
      });
    }

    return () => {
      if (unsubscribeRide) unsubscribeRide();
      if (unsubscribeOffers) unsubscribeOffers();
    };
  }, [activeRideId]);

  const resetRideState = async () => {
    await AsyncStorage.removeItem('active_ride');
    setActiveRideId(null);
    setRideStatus('idle');
    setPickup('');
    setDestination('');
    setPrice('');
    setPassengerCount(1);
    setCaptainOffers([]);
  };

  const handleDestinationChange = (text: string) => {
    setDestination(text);
    if (pickup && text.trim().length > 0) {
      let simulatedKm = text.includes('الموقف') || text.includes('قريب') ? 3 : 5;
      let totalFair = simulatedKm < 4 ? simulatedKm * 15 : simulatedKm * 10;
      setCalculatedBasePrice(totalFair);
      setPrice(totalFair.toString());
    }
  };

  const handlePickupChange = (text: string) => {
    setPickup(text);
    if (text.trim().length > 0 && destination) {
      let simulatedKm = destination.includes('الموقف') || destination.includes('قريب') ? 3 : 5;
      let totalFair = simulatedKm < 4 ? simulatedKm * 15 : simulatedKm * 10;
      setCalculatedBasePrice(totalFair);
      setPrice(totalFair.toString());
    }
  };

  const openEditPriceModal = () => {
    if (!price) {
      Alert.alert('تنبيه', 'برجاء إدخال الانطلاق والوجهة أولاً ليتحدد السعر العادل.');
      return;
    }
    setTempPrice(price);
    setIsEditModalVisible(true);
  };

  const saveNewPrice = async () => {
    const newNum = parseInt(tempPrice) || 0;
    const minAllowedPrice = Math.floor(calculatedBasePrice * 0.80);

    if (newNum < minAllowedPrice) {
      Alert.alert('تنبيه 🛑', `عذراً، لا يمكن أن يقل السعر عن ${minAllowedPrice} جنيه.`);
      return;
    }
    
    setPrice(tempPrice);
    setIsEditModalVisible(false);

    try {
      if (activeRideId) {
        const rideRef = doc(db, 'rides', activeRideId);
        await updateDoc(rideRef, { price: tempPrice });
      }
    } catch (e) {
      console.log(e);
    }
  };

  const handleSearchCaptain = async () => {
    if (!pickup || !destination || !price) {
      Alert.alert('تنبيه', 'برجاء إدخال بيانات الرحلة كاملاً.');
      return;
    }
    
    setRideStatus('searching');
    
    try {
      const passengerId = await AsyncStorage.getItem('currentPassengerId');
      const rideData = {
        passengerId: passengerId,
        name: passengerProfile.name,
        phone: passengerProfile.phone,
        avatar: passengerProfile.avatar,
        pickupLocation: pickup,
        destinationLocation: destination,
        price: price,
        passengerCount: passengerCount,
        status: 'pending',
        timestamp: new Date().getTime()
      };

      const docRef = await addDoc(collection(db, 'rides'), rideData);
      
      const localRideData = { ...rideData, id: docRef.id };
      await AsyncStorage.setItem('active_ride', JSON.stringify(localRideData));
      
      setActiveRideId(docRef.id);
      
    } catch (error) {
      setRideStatus('idle');
      Alert.alert('خطأ', 'حدثت مشكلة أثناء إرسال الطلب.');
    }
  };

  const acceptOffer = async (offer: any) => {
    if (!activeRideId) return;
    try {
      const rideRef = doc(db, 'rides', activeRideId);
      await updateDoc(rideRef, {
        status: 'accepted',
        price: offer.offeredPrice,
        captainId: offer.captainId,
        captainName: offer.captainName,
        captainPhone: offer.captainPhone,
        captainVehicle: offer.captainVehicle,
        captainAvatar: offer.captainAvatar
      });
    } catch (error) {
      Alert.alert('خطأ', 'حدثت مشكلة أثناء قبول العرض.');
    }
  };

  const handleCancelRide = async () => {
    if (activeRideId) {
      try {
        const rideRef = doc(db, 'rides', activeRideId);
        await updateDoc(rideRef, { status: 'canceled' });
      } catch (e) {
        console.log(e);
      }
    }
    await resetRideState();
    Alert.alert('إلغاء', 'تم إلغاء الطلب بنجاح.');
  };

  const handleCallCaptain = () => {
    if (!captainInfo.phone) {
      Alert.alert('تنبيه', 'رقم الكابتن غير متوفر بعد.');
      return;
    }
    Linking.openURL(`tel:${captainInfo.phone}`);
  };

  const handleLogout = async () => {
    await AsyncStorage.removeItem('currentPassengerId');
    await AsyncStorage.removeItem('passenger_profile');
    router.replace('/passenger-login');
  };

  return (
    <View style={styles.container}>
      
      <View style={styles.header}>
        <TouchableOpacity style={styles.userInfo} onPress={() => router.push('/passenger-profile')}>
          <Image source={{ uri: passengerProfile.avatar }} style={styles.profileAvatar} />
          <Text style={styles.welcomeText}>أهلاً، <Text style={styles.userName}>{passengerProfile.name} 🛺</Text></Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutText}>خروج</Text>
        </TouchableOpacity>
      </View>

      {rideStatus === 'idle' && (
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>اطلب مشوارك الآن:</Text>

            <Text style={styles.label}>📍 موقع الانطلاق الحالي</Text>
            <View style={styles.rowInputContainer}>
              <TextInput
                style={styles.inputWithButton}
                placeholder="اكتب مكان الانطلاق"
                placeholderTextColor="#94a3b8"
                value={pickup}
                onChangeText={handlePickupChange}
              />
              <TouchableOpacity style={styles.myLocationBtn} onPress={() => handlePickupChange('Street 90')}>
                <Text style={styles.myLocationBtnText}>📍 موقعي</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>🏁 الوجهة المطلوبة</Text>
            <TextInput
              style={styles.input}
              placeholder="مثال: الشاويش، الموقف"
              placeholderTextColor="#94a3b8"
              value={destination}
              onChangeText={handleDestinationChange}
            />

            {/* القائمة المنسدلة لعدد الركاب */}
            <Text style={styles.label}>👥 عدد الركاب</Text>
            <TouchableOpacity 
              style={styles.dropdownHeader} 
              onPress={() => setIsDropdownOpen(!isDropdownOpen)}
              activeOpacity={0.8}
            >
              <Text style={styles.dropdownHeaderText}>
                {passengerCount} {passengerCount === 1 ? 'راكب' : 'ركاب'}
              </Text>
              <Text style={styles.dropdownArrow}>{isDropdownOpen ? '▲' : '▼'}</Text>
            </TouchableOpacity>

            {isDropdownOpen && (
              <View style={styles.dropdownList}>
                {[1, 2, 3, 4].map(num => (
                  <TouchableOpacity 
                    key={num} 
                    style={styles.dropdownItem} 
                    onPress={() => {
                      setPassengerCount(num);
                      setIsDropdownOpen(false);
                    }}
                  >
                    <Text style={styles.dropdownItemText}>{num} {num === 1 ? 'راكب' : 'ركاب'}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <Text style={styles.label}>💰 أجرة الرحلة المقترحة</Text>
            <View style={styles.priceDisplayContainer}>
              <Text style={styles.priceTextDisplay}>{price ? `${price} جنيه` : '---'}</Text>
              <TouchableOpacity style={styles.editPriceBtn} onPress={openEditPriceModal}>
                <Text style={styles.editPriceBtnText}>✏️ تعديل السعر</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.searchButton} onPress={handleSearchCaptain}>
              <Text style={styles.searchButtonText}>🛺 بحث عن كابتن</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}

      <Modal visible={isEditModalVisible} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>✏️ تعديل سعر الرحلة</Text>
            <Text style={styles.modalSubtitle}>يمكنك تعديل السعر (الحد الأدنى المسموح به {Math.floor(calculatedBasePrice * 0.80)} جنيه):</Text>

            <TextInput
              style={styles.modalInput}
              value={tempPrice}
              onChangeText={setTempPrice}
              keyboardType="numeric"
              placeholder="اكتب السعر الجديد"
              placeholderTextColor="#94a3b8"
            />

            <View style={styles.modalButtonsRow}>
              <TouchableOpacity style={styles.modalSaveBtn} onPress={saveNewPrice}>
                <Text style={styles.modalSaveBtnText}>حفظ</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setIsEditModalVisible(false)}>
                <Text style={styles.modalCancelBtnText}>إلغاء</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {rideStatus === 'searching' && (
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>📡 جاري البحث عن كابتن...</Text>
            
            {captainOffers.length > 0 ? (
              <View style={styles.offersContainer}>
                <Text style={styles.label}>🚀 عروض الكباتن المتاحة:</Text>
                {captainOffers.map((offer) => (
                  <View key={offer.id} style={styles.offerCard}>
                    <View style={styles.offerHeader}>
                      <Image source={{ uri: offer.captainAvatar }} style={styles.offerAvatar} />
                      <View style={styles.offerDetails}>
                        <Text style={styles.offerName}>{offer.captainName}</Text>
                        <Text style={styles.offerPrice}>💰 السعر المعروض: {offer.offeredPrice} جنيه</Text>
                      </View>
                    </View>
                    <TouchableOpacity style={styles.acceptOfferBtn} onPress={() => acceptOffer(offer)}>
                      <Text style={styles.acceptOfferBtnText}>✔️ قبول العرض</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.subText}>يرجى الانتظار قليلاً ليتم تقديم عروض من الكباتن.</Text>
            )}

            <TouchableOpacity style={styles.cancelBtnOnly} onPress={handleCancelRide}>
              <Text style={styles.cancelBtnOnlyText}>❌ إلغاء الطلب</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}

      {rideStatus === 'accepted' && (
        <View style={styles.cardActive}>
          <Text style={styles.statusAlertTitle}>🛺 الكابتن في طريقه إليك...</Text>

          <View style={styles.captainCard}>
            <Image source={{ uri: captainInfo.avatar }} style={styles.captainAvatar} />
            <View style={styles.captainDetails}>
              <Text style={styles.captainText}>👨‍✈️ الكابتن: {captainInfo.name}</Text>
              <Text style={styles.captainText}>🛺 المركبة: {captainInfo.vehicle}</Text>
            </View>
          </View>

          <View style={styles.actionButtonsRow}>
            <TouchableOpacity style={styles.actionBtnCall} onPress={handleCallCaptain}>
              <Text style={styles.actionBtnText}>📞 اتصال</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtnChat} onPress={() => router.push({ pathname: '/chat', params: { senderType: 'passenger' } })}>
              <Text style={styles.actionBtnText}>💬 مراسلة</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.tripRouteContainer}>
            <Text style={styles.routeText}>📍 الانطلاق: {pickup}</Text>
            <Text style={styles.routeText}>🏁 الوجهة: {destination}</Text>
            <Text style={styles.routeText}>👥 الركاب: {passengerCount}</Text>
            <Text style={styles.priceTag}>💰 أجرة الرحلة: {price} جنيه</Text>
          </View>

          <TouchableOpacity style={styles.cancelOrderBtn} onPress={handleCancelRide}>
            <Text style={styles.cancelOrderBtnText}>❌ إلغاء الطلب</Text>
          </TouchableOpacity>
        </View>
      )}

      {rideStatus === 'arrived' && (
        <View style={styles.cardActive}>
          <Text style={styles.statusArrivalAlert}>🔔 لقد وصل الكابتن برجاء عدم التأخير</Text>

          <View style={styles.captainCard}>
            <Image source={{ uri: captainInfo.avatar }} style={styles.captainAvatar} />
            <View style={styles.captainDetails}>
              <Text style={styles.captainText}>👨‍✈️ الكابتن: {captainInfo.name}</Text>
              <Text style={styles.captainText}>🛺 المركبة: {captainInfo.vehicle}</Text>
            </View>
          </View>

          <View style={styles.actionButtonsRow}>
            <TouchableOpacity style={styles.actionBtnCall} onPress={handleCallCaptain}>
              <Text style={styles.actionBtnText}>📞 اتصال</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtnChat} onPress={() => router.push({ pathname: '/chat', params: { senderType: 'passenger' } })}>
              <Text style={styles.actionBtnText}>💬 مراسلة</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.tripRouteContainer}>
            <Text style={styles.routeText}>📍 الانطلاق: {pickup}</Text>
            <Text style={styles.routeText}>🏁 الوجهة: {destination}</Text>
            <Text style={styles.routeText}>👥 الركاب: {passengerCount}</Text>
            <Text style={styles.priceTag}>💰 أجرة الرحلة: {price} جنيه</Text>
          </View>

          <TouchableOpacity style={styles.cancelOrderBtn} onPress={handleCancelRide}>
            <Text style={styles.cancelOrderBtnText}>❌ إنهاء المشوار</Text>
          </TouchableOpacity>
        </View>
      )}

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9', padding: 15, paddingTop: 40 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#ffffff', padding: 12, borderRadius: 16, marginBottom: 20, elevation: 2 },
  userInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  profileAvatar: { width: 45, height: 45, borderRadius: 22.5, backgroundColor: '#cbd5e1', marginLeft: 10 },
  welcomeText: { fontSize: 16, color: '#334155' },
  userName: { fontWeight: 'bold', color: '#d97706' },
  logoutButton: { backgroundColor: '#fee2e2', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 12 },
  logoutText: { color: '#ef4444', fontWeight: 'bold', fontSize: 14 },
  card: { backgroundColor: '#ffffff', borderRadius: 20, padding: 20, borderWidth: 1, borderColor: '#e2e8f0', elevation: 4, marginBottom: 20 },
  cardActive: { backgroundColor: '#ffffff', borderRadius: 20, padding: 20, borderWidth: 2, borderColor: '#d97706', elevation: 6 },
  cardTitle: { fontSize: 20, fontWeight: 'bold', color: '#1e293b', marginBottom: 15, textAlign: 'right' },
  statusAlertTitle: { fontSize: 18, fontWeight: 'bold', color: '#d97706', marginBottom: 15, textAlign: 'center' },
  statusArrivalAlert: { fontSize: 17, fontWeight: 'bold', color: '#10b981', marginBottom: 15, textAlign: 'center' },
  subText: { fontSize: 15, color: '#64748b', textAlign: 'center', marginBottom: 20 },
  label: { fontSize: 14, fontWeight: 'bold', color: '#475569', marginBottom: 6, textAlign: 'right' },
  rowInputContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  inputWithButton: { flex: 1, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 12, padding: 10, fontSize: 14, color: '#0f172a', textAlign: 'right', marginLeft: 8 },
  myLocationBtn: { backgroundColor: '#d97706', paddingVertical: 11, paddingHorizontal: 15, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  myLocationBtnText: { color: '#ffffff', fontWeight: 'bold', fontSize: 13 },
  input: { backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 12, padding: 10, fontSize: 14, marginBottom: 15, color: '#0f172a', textAlign: 'right' },
  
  // ستايل القائمة المنسدلة
  dropdownHeader: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 12, padding: 12, flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  dropdownHeaderText: { fontSize: 15, color: '#0f172a', fontWeight: 'bold' },
  dropdownArrow: { fontSize: 16, color: '#64748b' },
  dropdownList: { backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 12, marginTop: -10, marginBottom: 15, overflow: 'hidden' },
  dropdownItem: { padding: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', alignItems: 'center' },
  dropdownItemText: { fontSize: 15, color: '#334155', fontWeight: 'bold' },

  priceDisplayContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fef3c7', borderWidth: 1.5, borderColor: '#d97706', borderRadius: 12, padding: 10, marginBottom: 20, justifyContent: 'space-between' },
  priceTextDisplay: { fontSize: 18, fontWeight: 'bold', color: '#d97706', textAlign: 'right', flex: 1 },
  editPriceBtn: { backgroundColor: '#d97706', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8 },
  editPriceBtnText: { color: '#ffffff', fontWeight: 'bold', fontSize: 13 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { backgroundColor: '#ffffff', width: '100%', padding: 20, borderRadius: 20, elevation: 5 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#1e293b', marginBottom: 8, textAlign: 'right' },
  modalSubtitle: { fontSize: 13, color: '#64748b', marginBottom: 15, textAlign: 'right' },
  modalInput: { backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 12, padding: 12, fontSize: 16, fontWeight: 'bold', color: '#0f172a', textAlign: 'center', marginBottom: 20 },
  modalButtonsRow: { flexDirection: 'row', gap: 10 },
  modalSaveBtn: { flex: 1, backgroundColor: '#10b981', paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  modalSaveBtnText: { color: '#ffffff', fontWeight: 'bold', fontSize: 16 },
  modalCancelBtn: { flex: 1, backgroundColor: '#fee2e2', paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  modalCancelBtnText: { color: '#ef4444', fontWeight: 'bold', fontSize: 16 },
  searchButton: { backgroundColor: '#d97706', paddingVertical: 15, borderRadius: 14, alignItems: 'center', elevation: 3 },
  searchButtonText: { color: '#ffffff', fontSize: 18, fontWeight: 'bold' },
  captainCard: { flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: '#fef3c7', padding: 12, borderRadius: 14, marginBottom: 15 },
  captainAvatar: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#cbd5e1' },
  captainDetails: { flex: 1, marginHorizontal: 15 },
  captainText: { fontSize: 14, fontWeight: 'bold', color: '#1e293b', marginBottom: 2, textAlign: 'right' },
  tripRouteContainer: { backgroundColor: '#f8fafc', padding: 12, borderRadius: 10, marginBottom: 15, borderWidth: 1, borderColor: '#e2e8f0' },
  routeText: { fontSize: 14, color: '#334155', fontWeight: 'bold', marginBottom: 4, textAlign: 'right' },
  priceTag: { fontSize: 16, color: '#10b981', fontWeight: 'bold', marginTop: 4, textAlign: 'right' },
  
  actionButtonsRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 15 },
  actionBtnCall: { flex: 1, backgroundColor: '#2563eb', paddingVertical: 12, borderRadius: 10, alignItems: 'center', marginLeft: 5, elevation: 2 },
  actionBtnChat: { flex: 1, backgroundColor: '#8b5cf6', paddingVertical: 12, borderRadius: 10, alignItems: 'center', marginRight: 5, elevation: 2 },
  actionBtnText: { color: '#ffffff', fontSize: 15, fontWeight: 'bold' },

  cancelOrderBtn: { backgroundColor: '#dc2626', paddingVertical: 14, borderRadius: 12, alignItems: 'center', elevation: 3 },
  cancelOrderBtnText: { color: '#ffffff', fontSize: 16, fontWeight: 'bold' },
  cancelBtnOnly: { backgroundColor: '#fee2e2', paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginTop: 10 },
  cancelBtnOnlyText: { color: '#dc2626', fontSize: 16, fontWeight: 'bold' },
  
  offersContainer: { marginBottom: 15 },
  offerCard: { backgroundColor: '#f8fafc', padding: 12, borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: '#cbd5e1' },
  offerHeader: { flexDirection: 'row-reverse', alignItems: 'center', marginBottom: 10 },
  offerAvatar: { width: 45, height: 45, borderRadius: 22.5, backgroundColor: '#cbd5e1' },
  offerDetails: { flex: 1, marginRight: 10 },
  offerName: { fontSize: 15, fontWeight: 'bold', color: '#1e293b', textAlign: 'right' },
  offerPrice: { fontSize: 15, color: '#10b981', fontWeight: 'bold', textAlign: 'right', marginTop: 4 },
  acceptOfferBtn: { backgroundColor: '#2563eb', paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  acceptOfferBtnText: { color: '#ffffff', fontWeight: 'bold', fontSize: 14 },
});