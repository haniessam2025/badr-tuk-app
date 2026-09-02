import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { useFocusEffect, usePathname, useRouter } from 'expo-router';
import { addDoc, collection, doc, getDoc, getDocs, onSnapshot, query, setDoc, updateDoc, where } from 'firebase/firestore';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Linking, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { db } from '../firebaseConfig';

export default function PassengerHome() {
  const router = useRouter();
  const pathname = usePathname();
  const [pickup, setPickup] = useState('');
  const [destination, setDestination] = useState('');
  const [price, setPrice] = useState('');
  const [passengerCount, setPassengerCount] = useState('1'); 
  const [calculatedBasePrice, setCalculatedBasePrice] = useState(0);
  const [rideStatus, setRideStatus] = useState<'idle' | 'searching' | 'accepted' | 'arrived'>('idle');
  
  const [currentRideId, setCurrentRideId] = useState<string | null>(null);
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [tempPrice, setTempPrice] = useState('');
  const [offers, setOffers] = useState<any[]>([]);

  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [isCallModalVisible, setIsCallModalVisible] = useState(false);
  const [phoneToCall, setPhoneToCall] = useState('');
  const [isFetchingLocation, setIsFetchingLocation] = useState(false);

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

  const getValidAvatar = (imgStr: any) => {
    if (!imgStr || typeof imgStr !== 'string' || imgStr.trim() === '') {
      return 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150';
    }
    if (imgStr.length > 950000) {
      return 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150';
    }
    if (imgStr.startsWith('http') || imgStr.startsWith('data:image') || imgStr.startsWith('file:/')) {
      return imgStr;
    }
    if (imgStr.length > 50) {
      return `data:image/jpeg;base64,${imgStr}`;
    }
    return 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150';
  };

  useFocusEffect(
    useCallback(() => {
      loadPassengerProfile();
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
          const pName = data.name || 'مستخدم جديد';
          setPassengerProfile({
            name: pName,
            phone: data.phone || '01000000000',
            avatar: getValidAvatar(data.avatar || data.image),
          });
          checkRideStatus(passengerId, pName);
        }
      } else {
        router.replace('/passenger-login');
      }
    } catch (e) { console.log(e); }
  };

  const checkRideStatus = async (passengerId: string, passengerName: string) => {
    try {
      let q = query(collection(db, 'rides'), where('passengerId', '==', passengerId));
      let querySnapshot = await getDocs(q);
      
      let docs = querySnapshot.docs.map(d => ({ id: d.id, ...d.data() }));

      if (docs.length === 0 && passengerName) {
        const qName = query(collection(db, 'rides'), where('name', '==', passengerName));
        const snapName = await getDocs(qName);
        docs = snapName.docs.map(d => ({ id: d.id, ...d.data() }));
      }
      
      docs.sort((a: any, b: any) => b.timestamp - a.timestamp);
      
      const activeRide: any = docs.find((d: any) => ['pending', 'accepted', 'captain_arrived'].includes(d.status));

      if (activeRide) {
        setCurrentRideId(activeRide.id);
        setPickup(activeRide.pickupLocation || '');
        setDestination(activeRide.destinationLocation || '');
        setPassengerCount(activeRide.passengers || '1');
        setPrice(activeRide.price || '');
        setUnreadChatCount(activeRide.unreadCountPassenger || 0);
        
        if (activeRide.status === 'pending') {
          setRideStatus('searching');
          setOffers(activeRide.offers || []);
        } else if (activeRide.status === 'accepted' || activeRide.status === 'captain_arrived') {
          setRideStatus(activeRide.status === 'accepted' ? 'accepted' : 'arrived');
          
          setCaptainInfo({
            name: activeRide.captainName || 'كابتن',
            phone: activeRide.captainPhone || 'غير مسجل',
            vehicle: activeRide.captainVehicle || 'توكتوك',
            avatar: getValidAvatar(activeRide.captainAvatar),
          });
        }
        await AsyncStorage.setItem('active_ride', JSON.stringify(activeRide));
      } else {
        setRideStatus('idle');
        await AsyncStorage.removeItem('active_ride');
        setCurrentRideId(null);
      }
    } catch (error) { console.log(error); }
  };

  useEffect(() => {
    if (!currentRideId) return;

    const rideRef = doc(db, 'rides', currentRideId);
    const unsubscribe = onSnapshot(rideRef, (docSnap) => {
      if (docSnap.exists()) {
        const firebaseData = docSnap.data();
        
        // التعديل هنا: لو الكابتن رجع الطلب لـ pending، نرجع شاشة الراكب لـ searching تلقائي
        if (firebaseData.status === 'pending') {
          setRideStatus('searching');
          setOffers(firebaseData.offers || []);
        }

        setUnreadChatCount(firebaseData.unreadCountPassenger || 0);

        if (firebaseData.status === 'accepted' || firebaseData.status === 'captain_arrived') {
          setRideStatus(firebaseData.status === 'accepted' ? 'accepted' : 'arrived');
          setPrice(firebaseData.price ? String(firebaseData.price) : '');
          
          setCaptainInfo({
            name: firebaseData.captainName || 'كابتن',
            phone: firebaseData.captainPhone || 'غير مسجل',
            vehicle: firebaseData.captainVehicle || 'توكتوك',
            avatar: getValidAvatar(firebaseData.captainAvatar),
          });
        } else if (firebaseData.status === 'completed' || firebaseData.status === 'canceled') {
          AsyncStorage.removeItem('active_ride');
          setCurrentRideId(null);
          setRideStatus('idle');
          setPickup('');
          setDestination('');
          setPrice('');
          setPassengerCount('1');
          setOffers([]);
          setUnreadChatCount(0);
        }
      }
    });

    return () => unsubscribe();
  }, [currentRideId]);

  const handleGetCurrentLocation = async () => {
    setIsFetchingLocation(true);
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('تنبيه', 'برجاء تفعيل صلاحية تحديد الموقع (GPS) لنتمكن من معرفة موقعك.');
        setIsFetchingLocation(false);
        return;
      }

      let location = await Location.getCurrentPositionAsync({ 
        accuracy: Location.Accuracy.Highest 
      });

      let geocode = await Location.reverseGeocodeAsync({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude
      });

      if (geocode && geocode.length > 0) {
        const place = geocode[0];
        const addressParts = [place.street, place.subregion || place.district, place.city].filter(Boolean);
        const address = addressParts.join('، ');
        
        const finalAddress = address.trim() ? address : `موقعي الحالي (${location.coords.latitude.toFixed(4)})`;
        handlePickupChange(finalAddress);
      } else {
        handlePickupChange(`موقعي الحالي`);
      }
    } catch (error) {
      Alert.alert('خطأ', 'تأكد من تشغيل الـ GPS أو اتصال الإنترنت على هاتفك.');
    }
    setIsFetchingLocation(false);
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
      const savedRide = await AsyncStorage.getItem('active_ride');
      if (savedRide) {
        const data = JSON.parse(savedRide);
        data.price = tempPrice;
        await AsyncStorage.setItem('active_ride', JSON.stringify(data));
        if (data.id) {
          const rideRef = doc(db, 'rides', data.id);
          await updateDoc(rideRef, { price: tempPrice });
        }
      }
    } catch (e) { console.log(e); }
  };

  const handleSearchCaptain = async () => {
    if (!pickup || !destination || !price) {
      Alert.alert('تنبيه', 'برجاء إدخال بيانات الرحلة كاملاً.');
      return;
    }
    
    setRideStatus('searching');
    setOffers([]); 
    
    try {
      const passengerId = await AsyncStorage.getItem('currentPassengerId');
      const rideData = {
        passengerId: passengerId,
        name: passengerProfile.name,
        phone: passengerProfile.phone,
        avatar: getValidAvatar(passengerProfile.avatar),
        pickupLocation: pickup,
        destinationLocation: destination,
        passengers: passengerCount, 
        price: price,
        offers: [], 
        status: 'pending',
        timestamp: new Date().getTime(),
        unreadCountPassenger: 0,
        unreadCountCaptain: 0
      };

      const docRef = await addDoc(collection(db, 'rides'), rideData);
      const localRideData = { ...rideData, id: docRef.id };
      await AsyncStorage.setItem('active_ride', JSON.stringify(localRideData));
      
      setCurrentRideId(docRef.id);
      Alert.alert('نجاح 🛺', 'تم إرسال الطلب، في انتظار عروض الكباتن...');
    } catch (error) {
      setRideStatus('idle');
      Alert.alert('خطأ', 'حدثت مشكلة أثناء إرسال الطلب.');
    }
  };

  const acceptCaptainOffer = async (offer: any) => {
    try {
      let rideId = currentRideId;
      
      if (!rideId) {
        const savedRide = await AsyncStorage.getItem('active_ride');
        if (savedRide) {
          const data = JSON.parse(savedRide);
          rideId = data.id;
        }
      }

      if (!rideId) {
        Alert.alert('خطأ', 'لم نتمكن من العثور على بيانات الرحلة الحالية.');
        return;
      }

      const rideRef = doc(db, 'rides', rideId);
      
      const cleanData = {
        status: 'accepted',
        price: String(offer?.price || price || '0'),
        captainId: String(offer?.captainId || 'unknown'),
        captainName: String(offer?.captainName || 'كابتن'),
        captainPhone: String(offer?.captainPhone || 'غير مسجل'),
        captainVehicle: String(offer?.captainVehicle || 'توكتوك'),
        captainAvatar: getValidAvatar(offer?.captainAvatar),
      };

      await setDoc(rideRef, cleanData, { merge: true });
      setPrice(cleanData.price);

      const savedRide = await AsyncStorage.getItem('active_ride');
      if (savedRide) {
        const data = JSON.parse(savedRide);
        await AsyncStorage.setItem('active_ride', JSON.stringify({ ...data, ...cleanData }));
      }
    } catch (error: any) {
      Alert.alert('تفاصيل الخطأ', error?.message || 'مشكلة في الاتصال بالإنترنت.');
    }
  };

  const handleCancelRide = async () => {
    try {
      if (currentRideId) {
        const rideRef = doc(db, 'rides', currentRideId);
        await updateDoc(rideRef, { status: 'canceled' });
      }
    } catch (e) { console.log(e); }

    await AsyncStorage.removeItem('active_ride');
    setCurrentRideId(null);
    setRideStatus('idle');
    setPickup('');
    setDestination('');
    setPrice('');
    setPassengerCount('1');
    setOffers([]);
    setUnreadChatCount(0);
    setCalculatedBasePrice(0);
    Alert.alert('إلغاء', 'تم إلغاء الطلب بنجاح.');
  };

  const handleCallClick = () => {
    if (!captainInfo.phone || captainInfo.phone === 'غير مسجل') {
      Alert.alert('تنبيه', 'رقم الكابتن غير متوفر.');
      return;
    }
    setPhoneToCall(captainInfo.phone);
    setIsCallModalVisible(true);
  };

  const makeRegularCall = () => {
    setIsCallModalVisible(false);
    Linking.openURL(`tel:${phoneToCall}`);
  };

  const makeFreeCall = () => {
    setIsCallModalVisible(false);
    Alert.alert('مكالمة مجانية 🌐', 'هذه الخاصية تتطلب ربط التطبيق بخدمة اتصالات خارجية.');
  };

  const handleLogout = async () => {
    await AsyncStorage.removeItem('currentPassengerId');
    await AsyncStorage.removeItem('passenger_profile');
    await AsyncStorage.removeItem('active_ride');
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
        <ScrollView style={styles.card} showsVerticalScrollIndicator={false}>
          <Text style={styles.cardTitle}>اطلب مشوارك الآن:</Text>
          
          <Text style={styles.label}>📍 موقع الانطلاق الحالي</Text>
          <View style={styles.rowInputContainer}>
            <TextInput style={styles.inputWithButton} placeholder="اكتب مكان الانطلاق" placeholderTextColor="#94a3b8" value={pickup} onChangeText={handlePickupChange} />
            <TouchableOpacity style={styles.myLocationBtn} onPress={handleGetCurrentLocation} disabled={isFetchingLocation}>
              {isFetchingLocation ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <Text style={styles.myLocationBtnText}>📍 موقعي</Text>
              )}
            </TouchableOpacity>
          </View>
          
          <Text style={styles.label}>🏁 الوجهة المطلوبة</Text>
          <TextInput style={styles.input} placeholder="مثال: الشاويش، الموقف" placeholderTextColor="#94a3b8" value={destination} onChangeText={handleDestinationChange} />
          
          <Text style={styles.label}>👥 عدد الركاب</Text>
          <View style={styles.passengerCountContainer}>
            {['1', '2', '3', '4'].map(num => (
              <TouchableOpacity 
                key={num} 
                style={[styles.countBtn, passengerCount === num && styles.countBtnActive]}
                onPress={() => setPassengerCount(num)}
              >
                <Text style={[styles.countBtnText, passengerCount === num && styles.countBtnTextActive]}>{num}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>💰 أجرة الرحلة المقترحة</Text>
          <View style={styles.priceDisplayContainer}>
            <Text style={styles.priceTextDisplay}>{price ? `${price} جنيه` : '---'}</Text>
            <TouchableOpacity style={styles.editPriceBtn} onPress={openEditPriceModal}>
              <Text style={styles.editPriceBtnText}>✏️ تعديل السعر</Text>
            </TouchableOpacity>
          </View>
          
          <TouchableOpacity style={styles.searchButton} onPress={handleSearchCaptain}>
            <Text style={styles.searchButtonText}>🛺 إرسال الطلب للكباتن</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      <Modal visible={isEditModalVisible} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>✏️ تعديل سعر الرحلة</Text>
            <Text style={styles.modalSubtitle}>يمكنك تعديل السعر (الحد الأدنى {Math.floor(calculatedBasePrice * 0.80)} جنيه):</Text>
            <TextInput style={styles.modalInput} value={tempPrice} onChangeText={setTempPrice} keyboardType="numeric" placeholder="اكتب السعر الجديد" placeholderTextColor="#94a3b8" />
            <View style={styles.modalButtonsRow}>
              <TouchableOpacity style={styles.modalSaveBtn} onPress={saveNewPrice}><Text style={styles.modalSaveBtnText}>حفظ</Text></TouchableOpacity>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setIsEditModalVisible(false)}><Text style={styles.modalCancelBtnText}>إلغاء</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={isCallModalVisible} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.callModalContent}>
            <Text style={styles.modalTitle}>📞 اختر طريقة الاتصال</Text>
            <TouchableOpacity style={styles.regularCallBtn} onPress={makeRegularCall}>
              <Text style={styles.regularCallBtnText}>📱 مكالمة عادية (شبكة المحمول)</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.freeCallBtn} onPress={makeFreeCall}>
              <Text style={styles.freeCallBtnText}>🌐 مكالمة مجانية (داخل التطبيق)</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelCallBtn} onPress={() => setIsCallModalVisible(false)}>
              <Text style={styles.cancelCallBtnText}>إلغاء</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {rideStatus === 'searching' && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>📡 جاري استقبال العروض...</Text>
          {offers.length === 0 ? (
             <Text style={styles.subText}>يرجى الانتظار قليلاً لتلقي عروض الكباتن.</Text>
          ) : (
            <ScrollView style={styles.offersContainer} showsVerticalScrollIndicator={false}>
              {offers.map((offer, index) => (
                <View key={index} style={styles.offerCard}>
                  <Image source={{uri: getValidAvatar(offer.captainAvatar)}} style={styles.offerAvatar} />
                  <View style={styles.offerDetails}>
                    <Text style={styles.offerName}>{offer.captainName}</Text>
                    <Text style={styles.offerVehicle}>🛺 {offer.captainVehicle}</Text>
                    <Text style={styles.offerPrice}>{offer.price} جنيه</Text>
                  </View>
                  <TouchableOpacity style={styles.acceptOfferBtn} onPress={() => acceptCaptainOffer(offer)}>
                    <Text style={styles.acceptOfferBtnText}>قبول</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          )}
          <TouchableOpacity style={styles.cancelBtnOnly} onPress={handleCancelRide}>
            <Text style={styles.cancelBtnOnlyText}>إلغاء الطلب</Text>
          </TouchableOpacity>
        </View>
      )}

      {rideStatus === 'accepted' && (
        <View style={styles.cardActive}>
          <Text style={styles.statusAlertTitle}>🛺 الكابتن في طريقه إليك...</Text>
          <View style={styles.captainCard}>
            <Image source={{ uri: getValidAvatar(captainInfo.avatar) }} style={styles.captainAvatar} />
            <View style={styles.captainDetails}>
              <Text style={styles.captainText}>👨‍✈️ الكابتن: {captainInfo.name}</Text>
              <Text style={styles.captainText}>🛺 المركبة: {captainInfo.vehicle}</Text>
              <Text style={styles.phoneText}>📞 رقم الكابتن: {captainInfo.phone || 'غير مسجل'}</Text>
            </View>
          </View>
          <View style={styles.tripRouteContainer}>
            <Text style={styles.routeText}>📍 الانطلاق: {pickup}</Text>
            <Text style={styles.routeText}>🏁 الوجهة: {destination}</Text>
            <Text style={styles.routeText}>👥 عدد الركاب: {passengerCount}</Text>
            <Text style={styles.priceTag}>💰 السعر النهائي: {price} جنيه</Text>
          </View>
          <TouchableOpacity style={styles.callCaptainBtn} onPress={handleCallClick}><Text style={styles.callCaptainBtnText}>📞 اتصال بالكابتن</Text></TouchableOpacity>
          <TouchableOpacity style={styles.chatButton} onPress={() => router.push({ pathname: '/chat', params: { senderType: 'passenger' } })}>
            <Text style={styles.chatButtonText}>💬 مراسلة الكابتن</Text>
            {unreadChatCount > 0 && (
              <View style={styles.badgeContainer}>
                <Text style={styles.badgeText}>{unreadChatCount}</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancelOrderBtn} onPress={handleCancelRide}><Text style={styles.cancelOrderBtnText}>❌ إلغاء الطلب</Text></TouchableOpacity>
        </View>
      )}

      {rideStatus === 'arrived' && (
        <View style={styles.cardArrivalPulse}>
          <Text style={styles.superArrivalTitle}>🚨 تنبيه هام جداً 🚨</Text>
          <Text style={styles.statusArrivalAlert}>لقد وصل الكابتن إلى نقطة الانطلاق ومواقف في انتظارك الآن!</Text>
          
          <View style={styles.captainCard}>
            <Image source={{ uri: getValidAvatar(captainInfo.avatar) }} style={styles.captainAvatar} />
            <View style={styles.captainDetails}>
              <Text style={styles.captainText}>👨‍✈️ الكابتن: {captainInfo.name}</Text>
              <Text style={styles.captainText}>🛺 المركبة: {captainInfo.vehicle}</Text>
              <Text style={styles.phoneText}>📞 رقم الكابتن: {captainInfo.phone || 'غير مسجل'}</Text>
            </View>
          </View>

          <View style={styles.tripRouteContainer}>
            <Text style={styles.routeText}>📍 الانطلاق: {pickup}</Text>
            <Text style={styles.routeText}>🏁 الوجهة: {destination}</Text>
            <Text style={styles.routeText}>👥 عدد الركاب: {passengerCount}</Text>
            <Text style={styles.priceTag}>💰 السعر النهائي: {price} جنيه</Text>
          </View>

          <TouchableOpacity style={styles.callCaptainBtn} onPress={handleCallClick}>
            <Text style={styles.callCaptainBtnText}>📞 اتصال سريع بالكابتن</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.chatButton} onPress={() => router.push({ pathname: '/chat', params: { senderType: 'passenger' } })}>
            <Text style={styles.chatButtonText}>💬 مراسلة الكابتن</Text>
            {unreadChatCount > 0 && (
              <View style={styles.badgeContainer}>
                <Text style={styles.badgeText}>{unreadChatCount}</Text>
              </View>
            )}
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
  card: { backgroundColor: '#ffffff', borderRadius: 20, padding: 20, borderWidth: 1, borderColor: '#e2e8f0', elevation: 4 },
  cardActive: { backgroundColor: '#ffffff', borderRadius: 20, padding: 20, borderWidth: 2, borderColor: '#d97706', elevation: 6 },
  cardArrivalPulse: { 
    backgroundColor: '#ecfdf5', 
    borderRadius: 20, 
    padding: 20, 
    borderWidth: 3, 
    borderColor: '#10b981', 
    elevation: 8,
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  superArrivalTitle: { 
    fontSize: 20, 
    fontWeight: 'bold', 
    color: '#047857', 
    marginBottom: 8, 
    textAlign: 'center' 
  },
  cardTitle: { fontSize: 20, fontWeight: 'bold', color: '#1e293b', marginBottom: 15, textAlign: 'right' },
  statusAlertTitle: { fontSize: 18, fontWeight: 'bold', color: '#d97706', marginBottom: 15, textAlign: 'center' },
  statusArrivalAlert: { fontSize: 16, fontWeight: 'bold', color: '#065f46', marginBottom: 15, textAlign: 'center' },
  subText: { fontSize: 15, color: '#64748b', textAlign: 'center', marginBottom: 20 },
  label: { fontSize: 14, fontWeight: 'bold', color: '#475569', marginBottom: 6, textAlign: 'right' },
  rowInputContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  inputWithButton: { flex: 1, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 12, padding: 10, fontSize: 14, color: '#0f172a', textAlign: 'right', marginLeft: 8 },
  myLocationBtn: { backgroundColor: '#d97706', paddingVertical: 11, paddingHorizontal: 15, borderRadius: 12, justifyContent: 'center', alignItems: 'center', minWidth: 80 },
  myLocationBtnText: { color: '#ffffff', fontWeight: 'bold', fontSize: 13 },
  input: { backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 12, padding: 10, fontSize: 14, marginBottom: 15, color: '#0f172a', textAlign: 'right' },
  passengerCountContainer: { flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 15 },
  countBtn: { flex: 1, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1', paddingVertical: 10, borderRadius: 10, marginHorizontal: 4, alignItems: 'center' },
  countBtnActive: { backgroundColor: '#d97706', borderColor: '#d97706' },
  countBtnText: { fontSize: 16, fontWeight: 'bold', color: '#64748b' },
  countBtnTextActive: { color: '#ffffff' },
  priceDisplayContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fef3c7', borderWidth: 1.5, borderColor: '#d97706', borderRadius: 12, padding: 10, marginBottom: 20, justifyContent: 'space-between' },
  priceTextDisplay: { fontSize: 18, fontWeight: 'bold', color: '#d97706', textAlign: 'right', flex: 1 },
  editPriceBtn: { backgroundColor: '#d97706', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8 },
  editPriceBtnText: { color: '#ffffff', fontWeight: 'bold', fontSize: 13 },
  offersContainer: { maxHeight: 300, marginBottom: 15 },
  offerCard: { flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: '#f8fafc', padding: 12, borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: '#cbd5e1' },
  offerAvatar: { width: 55, height: 55, borderRadius: 27.5, marginLeft: 12, backgroundColor: '#e2e8f0' },
  offerDetails: { flex: 1 },
  offerName: { fontSize: 15, fontWeight: 'bold', color: '#1e293b', textAlign: 'right' },
  offerVehicle: { fontSize: 13, color: '#64748b', textAlign: 'right', marginTop: 2 },
  offerPrice: { fontSize: 16, fontWeight: 'bold', color: '#10b981', textAlign: 'right', marginTop: 4 },
  acceptOfferBtn: { backgroundColor: '#10b981', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8 },
  acceptOfferBtnText: { color: '#ffffff', fontWeight: 'bold', fontSize: 14 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { backgroundColor: '#ffffff', width: '100%', padding: 20, borderRadius: 20, elevation: 5 },
  callModalContent: { backgroundColor: '#ffffff', width: '85%', padding: 20, borderRadius: 20, elevation: 5, alignItems: 'center' },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#1e293b', marginBottom: 15, textAlign: 'center' },
  modalSubtitle: { fontSize: 13, color: '#64748b', marginBottom: 15, textAlign: 'right' },
  modalInput: { backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 12, padding: 12, fontSize: 16, fontWeight: 'bold', color: '#0f172a', textAlign: 'center', marginBottom: 20 },
  modalButtonsRow: { flexDirection: 'row-reverse', gap: 10 },
  modalSaveBtn: { flex: 1, backgroundColor: '#10b981', paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  modalSaveBtnText: { color: '#ffffff', fontWeight: 'bold', fontSize: 16 },
  modalCancelBtn: { flex: 1, backgroundColor: '#fee2e2', paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  modalCancelBtnText: { color: '#ef4444', fontWeight: 'bold', fontSize: 16 },
  regularCallBtn: { backgroundColor: '#f1f5f9', width: '100%', paddingVertical: 15, borderRadius: 12, alignItems: 'center', marginBottom: 10, borderWidth: 1, borderColor: '#cbd5e1' },
  regularCallBtnText: { color: '#1e293b', fontWeight: 'bold', fontSize: 16 },
  freeCallBtn: { backgroundColor: '#10b981', width: '100%', paddingVertical: 15, borderRadius: 12, alignItems: 'center', marginBottom: 15 },
  freeCallBtnText: { color: '#ffffff', fontWeight: 'bold', fontSize: 16 },
  cancelCallBtn: { paddingVertical: 10 },
  cancelCallBtnText: { color: '#ef4444', fontWeight: 'bold', fontSize: 16 },
  searchButton: { backgroundColor: '#d97706', paddingVertical: 15, borderRadius: 14, alignItems: 'center', elevation: 3, marginBottom: 20 },
  searchButtonText: { color: '#ffffff', fontSize: 18, fontWeight: 'bold' },
  captainCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fef3c7', padding: 12, borderRadius: 14, marginBottom: 15 },
  captainAvatar: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#cbd5e1' },
  captainDetails: { flex: 1, marginHorizontal: 15 },
  captainText: { fontSize: 14, fontWeight: 'bold', color: '#1e293b', marginBottom: 2, textAlign: 'right' },
  phoneText: { fontSize: 14, fontWeight: 'bold', color: '#2563eb', marginBottom: 2, textAlign: 'right', marginTop: 3 },
  tripRouteContainer: { backgroundColor: '#f8fafc', padding: 12, borderRadius: 10, marginBottom: 15, borderWidth: 1, borderColor: '#e2e8f0' },
  routeText: { fontSize: 14, color: '#334155', fontWeight: 'bold', marginBottom: 4, textAlign: 'right' },
  priceTag: { fontSize: 16, color: '#10b981', fontWeight: 'bold', marginTop: 4, textAlign: 'right' },
  callCaptainBtn: { backgroundColor: '#2563eb', paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginBottom: 10, elevation: 3 },
  callCaptainBtnText: { color: '#ffffff', fontSize: 16, fontWeight: 'bold' },
  chatButton: { position: 'relative', backgroundColor: '#8b5cf6', paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginBottom: 10, elevation: 3 },
  chatButtonText: { color: '#ffffff', fontSize: 16, fontWeight: 'bold' },
  badgeContainer: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#ef4444',
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  badgeText: { color: '#ffffff', fontSize: 12, fontWeight: 'bold' },
  cancelOrderBtn: { backgroundColor: '#dc2626', paddingVertical: 14, borderRadius: 12, alignItems: 'center', elevation: 3 },
  cancelOrderBtnText: { color: '#ffffff', fontSize: 16, fontWeight: 'bold' },
  cancelBtnOnly: { backgroundColor: '#fee2e2', paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  cancelBtnOnlyText: { color: '#dc2626', fontSize: 16, fontWeight: 'bold' },
});