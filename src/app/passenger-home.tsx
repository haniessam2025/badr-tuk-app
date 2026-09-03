import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { useFocusEffect, usePathname, useRouter } from 'expo-router';
import { addDoc, collection, doc, getDoc, getDocs, limit, onSnapshot, orderBy, query, setDoc, updateDoc, where } from 'firebase/firestore';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Image, KeyboardAvoidingView, Linking, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { db } from '../firebaseConfig';

const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);

export default function PassengerHome() {
  const router = useRouter();
  const pathname = usePathname();
  const [pickup, setPickup] = useState('');
  
  const [destinations, setDestinations] = useState<string[]>(['']);
  
  const [price, setPrice] = useState('');
  const [passengerCount, setPassengerCount] = useState('1'); 
  const [calculatedBasePrice, setCalculatedBasePrice] = useState(0);
  const [basePriceForSuggestions, setBasePriceForSuggestions] = useState(0);
  
  const [notes, setNotes] = useState('');
  
  const [rideStatus, setRideStatus] = useState<'idle' | 'searching' | 'accepted' | 'arrived' | 'passenger_on_the_way' | 'in_progress'>('idle');
  
  const [currentRideId, setCurrentRideId] = useState<string | null>(null);
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [tempPrice, setTempPrice] = useState('');
  const [offers, setOffers] = useState<any[]>([]);

  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [latestMessage, setLatestMessage] = useState(''); 
  
  const [isCallModalVisible, setIsCallModalVisible] = useState(false);
  const [phoneToCall, setPhoneToCall] = useState('');
  const [isFetchingLocation, setIsFetchingLocation] = useState(false);

  const pulseAnim = useRef(new Animated.Value(0)).current;
  const chatPulseAnim = useRef(new Animated.Value(0)).current; 
  const toastOpacity = useRef(new Animated.Value(0)).current; 
  const toastTranslateY = useRef(new Animated.Value(-10)).current; 

  const [toastVisible, setToastVisible] = useState(false);
  const prevUnreadRef = useRef(0);
  const toastTimer = useRef<any>(null);

  const DEFAULT_AVATAR = 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png';

  const [passengerProfile, setPassengerProfile] = useState({ name: 'جارٍ التحميل...', phone: '', avatar: DEFAULT_AVATAR });
  const [captainInfo, setCaptainInfo] = useState({ name: 'كابتن', vehicle: 'توكتوك', phone: '', avatar: DEFAULT_AVATAR });

  const getValidAvatar = (imgStr: any) => {
    if (!imgStr || typeof imgStr !== 'string' || imgStr.trim() === '') return DEFAULT_AVATAR;
    if (imgStr.length > 950000) return DEFAULT_AVATAR;
    if (imgStr.startsWith('http') || imgStr.startsWith('data:image') || imgStr.startsWith('file:/')) return imgStr;
    if (imgStr.length > 50) return `data:image/jpeg;base64,${imgStr}`;
    return DEFAULT_AVATAR;
  };

  useFocusEffect(useCallback(() => { loadPassengerProfile(); }, []));

  const loadPassengerProfile = async () => {
    try {
      const passengerId = await AsyncStorage.getItem('currentPassengerId');
      if (passengerId) {
        const savedProfile = await AsyncStorage.getItem('passenger_profile');
        if (savedProfile) {
          const parsed = JSON.parse(savedProfile);
          setPassengerProfile({ name: parsed.name || 'مستخدم جديد', phone: parsed.phone || '', avatar: getValidAvatar(parsed.avatar) });
        }
        const docRef = doc(db, 'passengers', passengerId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          const pName = data.name || 'مستخدم جديد';
          const freshAvatar = getValidAvatar(data.avatar || data.image);
          setPassengerProfile({ name: pName, phone: data.phone || '01000000000', avatar: freshAvatar });
          
          if (savedProfile) {
            const parsed = JSON.parse(savedProfile);
            parsed.name = pName; parsed.avatar = freshAvatar;
            await AsyncStorage.setItem('passenger_profile', JSON.stringify(parsed));
          }
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
      
      const activeRide: any = docs.find((d: any) => ['pending', 'accepted', 'captain_arrived', 'passenger_on_the_way', 'in_progress'].includes(d.status));

      if (activeRide) {
        setCurrentRideId(activeRide.id); 
        setPickup(activeRide.pickupLocation || ''); 
        if (activeRide.destinationsList && activeRide.destinationsList.length > 0) {
          setDestinations(activeRide.destinationsList);
        } else {
          setDestinations([activeRide.destinationLocation || '']);
        }
        
        setPassengerCount(activeRide.passengers || '1'); setPrice(activeRide.price || ''); setUnreadChatCount(activeRide.unreadCountPassenger || 0);
        
        if (activeRide.status === 'pending') {
          setRideStatus('searching'); setOffers(activeRide.offers || []);
        } else if (['accepted', 'captain_arrived', 'passenger_on_the_way', 'in_progress'].includes(activeRide.status)) {
          setRideStatus(
            activeRide.status === 'accepted' ? 'accepted' : 
            activeRide.status === 'captain_arrived' ? 'arrived' : 
            activeRide.status === 'passenger_on_the_way' ? 'passenger_on_the_way' : 
            'in_progress'
          );
          setCaptainInfo({
            name: activeRide.captainName || 'كابتن', phone: activeRide.captainPhone || 'غير مسجل',
            vehicle: activeRide.captainVehicle || 'توكتوك', avatar: getValidAvatar(activeRide.captainAvatar),
          });
        }
        await AsyncStorage.setItem('active_ride', JSON.stringify(activeRide));
      } else {
        setRideStatus('idle'); await AsyncStorage.removeItem('active_ride'); setCurrentRideId(null);
      }
    } catch (error) { console.log(error); }
  };

  useEffect(() => {
    if (!currentRideId) return;
    const rideRef = doc(db, 'rides', currentRideId);
    const unsubscribe = onSnapshot(rideRef, (docSnap) => {
      if (docSnap.exists()) {
        const firebaseData = docSnap.data();
        if (firebaseData.status === 'pending') { setRideStatus('searching'); setOffers(firebaseData.offers || []); }
        setUnreadChatCount(firebaseData.unreadCountPassenger || 0);

        if (['accepted', 'captain_arrived', 'passenger_on_the_way', 'in_progress'].includes(firebaseData.status)) {
          setRideStatus(
            firebaseData.status === 'accepted' ? 'accepted' : 
            firebaseData.status === 'captain_arrived' ? 'arrived' : 
            firebaseData.status === 'passenger_on_the_way' ? 'passenger_on_the_way' : 
            'in_progress'
          );
          setPrice(firebaseData.price ? String(firebaseData.price) : '');
          setCaptainInfo({
            name: firebaseData.captainName || 'كابتن', phone: firebaseData.captainPhone || 'غير مسجل',
            vehicle: firebaseData.captainVehicle || 'توكتوك', avatar: getValidAvatar(firebaseData.captainAvatar),
          });
        } else if (firebaseData.status === 'completed' || firebaseData.status === 'canceled') {
          AsyncStorage.removeItem('active_ride'); setCurrentRideId(null); setRideStatus('idle');
          setPickup(''); setDestinations(['']); setPrice(''); setPassengerCount('1'); setOffers([]); setUnreadChatCount(0); setNotes('');
        }
      }
    });
    return () => unsubscribe();
  }, [currentRideId]);

  useEffect(() => {
    if (!currentRideId) return;
    const q = query(collection(db, 'rides', currentRideId, 'messages'), orderBy('timestamp', 'desc'), limit(1));
    const unsubscribeMsgs = onSnapshot(q, (snap) => {
      if (!snap.empty) {
        const msg = snap.docs[0].data();
        if (msg.sender === 'captain') {
          setLatestMessage(msg.text);
        }
      }
    });
    return () => unsubscribeMsgs();
  }, [currentRideId]);

  useEffect(() => {
    if (rideStatus === 'arrived') {
      Animated.loop(
        Animated.sequence([ 
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: false }), 
          Animated.timing(pulseAnim, { toValue: 0, duration: 600, useNativeDriver: false }) 
        ])
      ).start();
    } else {
      pulseAnim.setValue(0);
    }
  }, [rideStatus]);

  useEffect(() => {
    if (unreadChatCount > prevUnreadRef.current) {
      setToastVisible(true);
      Animated.parallel([
        Animated.timing(toastOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(toastTranslateY, { toValue: 0, duration: 300, useNativeDriver: true })
      ]).start();

      if (toastTimer.current) clearTimeout(toastTimer.current);
      
      toastTimer.current = setTimeout(() => {
        Animated.parallel([
          Animated.timing(toastOpacity, { toValue: 0, duration: 300, useNativeDriver: true }),
          Animated.timing(toastTranslateY, { toValue: -10, duration: 300, useNativeDriver: true })
        ]).start(() => setToastVisible(false));
      }, 2000);
    }
    prevUnreadRef.current = unreadChatCount;

    if (unreadChatCount > 0) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(chatPulseAnim, { toValue: 1, duration: 400, useNativeDriver: false }),
          Animated.timing(chatPulseAnim, { toValue: 0, duration: 400, useNativeDriver: false })
        ])
      ).start();
    } else {
      chatPulseAnim.stopAnimation();
      chatPulseAnim.setValue(0);
    }
  }, [unreadChatCount]);

  const backgroundColorInterpolate = pulseAnim.interpolate({ 
    inputRange: [0, 1], 
    outputRange: ['#064e3b', '#10b981'] 
  });

  const chatBackgroundColor = chatPulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['#8b5cf6', '#0f172a'] 
  });

  const handleGetCurrentLocation = async () => {
    setIsFetchingLocation(true);
    try {
      let servicesEnabled = await Location.hasServicesEnabledAsync();
      if (!servicesEnabled) { Alert.alert('تنبيه 📍', 'الـ GPS مغلق. برجاء سحب الشاشة وتفعيله.'); setIsFetchingLocation(false); return; }
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { Alert.alert('صلاحية مفقودة 🛑', 'برجاء السماح للتطبيق بالوصول لموقعك.'); setIsFetchingLocation(false); return; }
      let location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      let geocode = await Location.reverseGeocodeAsync({ latitude: location.coords.latitude, longitude: location.coords.longitude });
      if (geocode && geocode.length > 0) {
        const place = geocode[0]; const address = [place.street, place.subregion || place.district, place.city].filter(Boolean).join('، ');
        handlePickupChange(address.trim() ? address : `موقعي الحالي (${location.coords.latitude.toFixed(4)})`);
      } else { handlePickupChange(`موقعي الحالي`); }
    } catch (error) { Alert.alert('خطأ', 'حدثت مشكلة أثناء التقاط إشارة الـ GPS.'); }
    setIsFetchingLocation(false);
  };

  const updatePriceCalculation = (pickupText: string, dests: string[]) => {
    const validDests = dests.filter(d => d.trim().length > 0);
    if (pickupText.trim().length > 0 && validDests.length > 0) {
      let base = 15 + ((validDests.length - 1) * 10);
      setCalculatedBasePrice(base);
      setBasePriceForSuggestions(base);
      setPrice(base.toString());
    } else {
      setCalculatedBasePrice(0);
      setBasePriceForSuggestions(0);
      setPrice('');
    }
  };

  const handlePickupChange = (text: string) => {
    setPickup(text);
    updatePriceCalculation(text, destinations);
  };

  const handleDestinationChange = (text: string, index: number) => {
    const newDests = [...destinations];
    newDests[index] = text;
    setDestinations(newDests);
    updatePriceCalculation(pickup, newDests);
  };

  const addDestinationField = () => {
    if (destinations.length < 3) {
      setDestinations([...destinations, '']);
    } else {
      Alert.alert('تنبيه', 'الحد الأقصى 3 وجهات في الطلب الواحد.');
    }
  };

  const removeDestinationField = (index: number) => {
    const newDests = destinations.filter((_, i) => i !== index);
    setDestinations(newDests);
    updatePriceCalculation(pickup, newDests);
  };

  const openEditPriceModal = () => {
    const validDests = destinations.filter(d => d.trim().length > 0);
    if (!pickup || validDests.length === 0) { Alert.alert('تنبيه', 'برجاء إدخال الانطلاق والوجهة أولاً.'); return; }
    setTempPrice(price); setIsEditModalVisible(true);
  };

  const saveNewPrice = async () => {
    const minAllowedPrice = Math.floor(calculatedBasePrice * 0.80);
    const savedNewPrice = parseInt(tempPrice) || 0;
    
    if (savedNewPrice < minAllowedPrice) { 
      Alert.alert('تنبيه 🛑', `لا يمكن أن يقل السعر عن ${minAllowedPrice} جنيه.`); 
      return; 
    }
    
    setPrice(tempPrice);
    setBasePriceForSuggestions(savedNewPrice);
    setIsEditModalVisible(false);
    
    try {
      const savedRide = await AsyncStorage.getItem('active_ride');
      if (savedRide) {
        const data = JSON.parse(savedRide); data.price = tempPrice;
        await AsyncStorage.setItem('active_ride', JSON.stringify(data));
        if (data.id) await updateDoc(doc(db, 'rides', data.id), { price: tempPrice });
      }
    } catch (e) {}
  };

  const handleSearchCaptain = async () => {
    const validDests = destinations.filter(d => d.trim() !== '');
    if (!pickup || validDests.length === 0 || !price) { Alert.alert('تنبيه', 'برجاء إدخال بيانات الرحلة كاملاً.'); return; }
    
    setRideStatus('searching'); setOffers([]); 
    try {
      const rideData = {
        passengerId: await AsyncStorage.getItem('currentPassengerId'), 
        name: passengerProfile.name, 
        phone: passengerProfile.phone, 
        avatar: getValidAvatar(passengerProfile.avatar),
        pickupLocation: pickup, 
        destinationsList: validDests, 
        destinationLocation: validDests.join(' ➡️ '), 
        passengers: passengerCount, 
        price: price,
        notes: notes.trim(), 
        offers: [], 
        status: 'pending', 
        timestamp: new Date().getTime(), 
        unreadCountPassenger: 0, 
        unreadCountCaptain: 0
      };
      const docRef = await addDoc(collection(db, 'rides'), rideData);
      await AsyncStorage.setItem('active_ride', JSON.stringify({ ...rideData, id: docRef.id }));
      setCurrentRideId(docRef.id); Alert.alert('نجاح 🛺', 'تم إرسال الطلب، في انتظار عروض الكباتن...');
    } catch (error) { setRideStatus('idle'); Alert.alert('خطأ', 'حدثت مشكلة أثناء إرسال الطلب.'); }
  };

  const acceptCaptainOffer = async (offer: any) => {
    try {
      let rideId = currentRideId || JSON.parse(await AsyncStorage.getItem('active_ride') || '{}').id;
      if (!rideId) { Alert.alert('خطأ', 'بيانات الرحلة مفقودة.'); return; }
      const cleanData = {
        status: 'accepted', price: String(offer?.price || price || '0'), captainId: String(offer?.captainId || 'unknown'),
        captainName: String(offer?.captainName || 'كابتن'), captainPhone: String(offer?.captainPhone || 'غير مسجل'),
        captainVehicle: String(offer?.captainVehicle || 'توكتوك'), captainAvatar: getValidAvatar(offer?.captainAvatar),
      };
      await setDoc(doc(db, 'rides', rideId), cleanData, { merge: true }); setPrice(cleanData.price);
      await AsyncStorage.setItem('active_ride', JSON.stringify({ ...JSON.parse(await AsyncStorage.getItem('active_ride') || '{}'), ...cleanData }));
    } catch (error: any) {}
  };

  const notifyPassengerOnTheWay = async () => {
    if (!currentRideId) return;
    try {
      await updateDoc(doc(db, 'rides', currentRideId), { status: 'passenger_on_the_way' });
    } catch (error) { console.log(error); }
  };

  const handleCancelRide = async () => {
    try { if (currentRideId) await updateDoc(doc(db, 'rides', currentRideId), { status: 'canceled' }); } catch (e) {}
    await AsyncStorage.removeItem('active_ride'); setCurrentRideId(null); setRideStatus('idle'); setPickup(''); setDestinations(['']); setPrice(''); setPassengerCount('1'); setOffers([]); setUnreadChatCount(0); 
    setCalculatedBasePrice(0); setBasePriceForSuggestions(0); setNotes(''); setLatestMessage('');
  };

  const handleCallClick = () => {
    if (!captainInfo.phone || captainInfo.phone === 'غير مسجل') { Alert.alert('تنبيه', 'رقم الكابتن غير متوفر.'); return; }
    setPhoneToCall(captainInfo.phone); setIsCallModalVisible(true);
  };
  const makeRegularCall = () => { setIsCallModalVisible(false); Linking.openURL(`tel:${phoneToCall}`); };
  const makeFreeCall = () => { setIsCallModalVisible(false); Alert.alert('مكالمة مجانية', 'تتطلب ربط التطبيق بخدمة اتصالات خارجية.'); };

  const handleLogout = async () => {
    await AsyncStorage.removeItem('currentPassengerId'); await AsyncStorage.removeItem('passenger_profile'); await AsyncStorage.removeItem('active_ride');
    router.replace('/passenger-login');
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <TouchableOpacity style={styles.userInfo} onPress={() => router.push('/passenger-profile')}>
          <Image source={{ uri: passengerProfile.avatar }} style={styles.profileAvatar} />
          <Text style={styles.welcomeText}>أهلاً، <Text style={styles.userName}>{passengerProfile.name} 🛺</Text></Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}><Text style={styles.logoutText}>خروج</Text></TouchableOpacity>
      </View>

      {rideStatus === 'idle' && (
        <ScrollView 
          style={styles.card} 
          contentContainerStyle={{ paddingBottom: 60 }} 
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.cardTitle}>اطلب مشوارك الآن:</Text>
          <Text style={styles.label}>📍 موقع الانطلاق الحالي</Text>
          <View style={styles.rowInputContainer}>
            <TextInput style={styles.inputWithButton} placeholder="اكتب مكان الانطلاق" placeholderTextColor="#94a3b8" value={pickup} onChangeText={handlePickupChange} />
            <TouchableOpacity style={styles.myLocationBtn} onPress={handleGetCurrentLocation} disabled={isFetchingLocation}>
              {isFetchingLocation ? <ActivityIndicator color="#ffffff" size="small" /> : <Text style={styles.myLocationBtnText}>📍 موقعي</Text>}
            </TouchableOpacity>
          </View>
          
          <Text style={styles.label}>🏁 الوجهات المطلوبة</Text>
          {destinations.map((dest, index) => (
            <View key={index} style={styles.destRow}>
              <TextInput 
                style={styles.inputDest} 
                placeholder={`الوجهة رقم ${index + 1}`} 
                placeholderTextColor="#94a3b8" 
                value={dest} 
                onChangeText={(text) => handleDestinationChange(text, index)} 
              />
              {index > 0 && (
                <TouchableOpacity style={styles.removeDestBtn} onPress={() => removeDestinationField(index)}>
                  <Text style={styles.removeDestBtnText}>❌</Text>
                </TouchableOpacity>
              )}
            </View>
          ))}

          {destinations.length < 3 && (
            <TouchableOpacity style={styles.addDestBtn} onPress={addDestinationField}>
              <Text style={styles.addDestBtnText}>➕ إضافة وجهة أخرى</Text>
            </TouchableOpacity>
          )}
          
          <Text style={styles.label}>👥 عدد الركاب</Text>
          <View style={styles.passengerCountContainer}>
            {['1', '2', '3', '4'].map(num => (
              <TouchableOpacity key={num} style={[styles.countBtn, passengerCount === num && styles.countBtnActive]} onPress={() => setPassengerCount(num)}>
                <Text style={[styles.countBtnText, passengerCount === num && styles.countBtnTextActive]}>{num}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>📝 ملاحظات للكابتن (اختياري)</Text>
          <TextInput 
            style={styles.notesInput} 
            placeholder="مثال: ممنوع التدخين، معايا أغراض..." 
            placeholderTextColor="#94a3b8" 
            value={notes} 
            onChangeText={setNotes} 
            multiline={true}
          />
          
          <Text style={styles.label}>💰 أجرة الرحلة المقترحة</Text>
          <View style={[styles.priceDisplayContainer, { marginBottom: (basePriceForSuggestions > 0 && pickup && destinations[0]) ? 10 : 20 }]}>
            <Text style={styles.priceTextDisplay}>{price ? `${price} جنيه` : '---'}</Text>
            <TouchableOpacity style={styles.editPriceBtn} onPress={openEditPriceModal}><Text style={styles.editPriceBtnText}>✏️ تعديل السعر</Text></TouchableOpacity>
          </View>

          {basePriceForSuggestions > 0 && pickup.trim() !== '' && destinations[0].trim() !== '' && (
            <View style={styles.suggestionsRow}>
              {[1.2, 1.4, 1.6].map((multiplier, index) => {
                const suggestedPrice = Math.round(basePriceForSuggestions * multiplier);
                const isSelected = price === suggestedPrice.toString();
                const percentage = Math.round((multiplier - 1) * 100);
                
                return (
                  <TouchableOpacity 
                    key={index} 
                    style={[styles.suggestionBtn, isSelected && styles.suggestionBtnActive]} 
                    onPress={() => setPrice(suggestedPrice.toString())}
                  >
                    <Text style={[styles.suggestionText, isSelected && styles.suggestionTextActive]}>
                      {suggestedPrice} ج
                    </Text>
                    <Text style={[styles.suggestionSubText, isSelected && styles.suggestionSubTextActive]}>
                      +{percentage}%
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          <TouchableOpacity style={styles.searchButton} onPress={handleSearchCaptain}><Text style={styles.searchButtonText}>🛺 إرسال الطلب للكباتن</Text></TouchableOpacity>
        </ScrollView>
      )}

      {rideStatus === 'searching' && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>📡 جاري استقبال العروض...</Text>
          {offers.length === 0 ? (<Text style={styles.subText}>يرجى الانتظار قليلاً لتلقي عروض الكباتن.</Text>) : (
            <ScrollView style={styles.offersContainer} showsVerticalScrollIndicator={false}>
              {offers.map((offer, index) => (
                <View key={index} style={styles.offerCard}>
                  <Image source={{uri: getValidAvatar(offer.captainAvatar)}} style={styles.offerAvatar} />
                  <View style={styles.offerDetails}>
                    <Text style={styles.offerName}>{offer.captainName}</Text>
                    <Text style={styles.offerVehicle}>🛺 {offer.captainVehicle}</Text>
                    <Text style={styles.offerPrice}>{offer.price} جنيه</Text>
                  </View>
                  <TouchableOpacity style={styles.acceptOfferBtn} onPress={() => acceptCaptainOffer(offer)}><Text style={styles.acceptOfferBtnText}>قبول</Text></TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          )}
          <TouchableOpacity style={styles.cancelBtnOnly} onPress={handleCancelRide}><Text style={styles.cancelBtnOnlyText}>إلغاء الطلب</Text></TouchableOpacity>
        </View>
      )}

      {(rideStatus === 'accepted' || rideStatus === 'passenger_on_the_way') && (
        <View style={styles.cardActive}>
          <Text style={styles.statusAlertTitle}>
            {rideStatus === 'accepted' ? '🛺 الكابتن في طريقه إليك...' : '✅ أنت الآن في طريقك للكابتن (أنا نازل)'}
          </Text>

          {toastVisible && latestMessage ? (
            <Animated.View style={[styles.inlineToast, { opacity: toastOpacity, transform: [{ translateY: toastTranslateY }] }]}>
              <Text style={styles.inlineToastText} numberOfLines={2}>💬 {latestMessage}</Text>
            </Animated.View>
          ) : null}

          <View style={styles.captainCard}>
            <Image source={{ uri: getValidAvatar(captainInfo.avatar) }} style={styles.captainAvatar} />
            <View style={styles.captainDetails}>
              <Text style={styles.captainText}>👨‍✈️ الكابتن: {captainInfo.name}</Text>
              <Text style={styles.captainText}>🛺 المركبة: {captainInfo.vehicle}</Text>
            </View>
          </View>
          <ScrollView style={styles.tripRouteContainer} showsVerticalScrollIndicator={false}>
            <Text style={styles.routeText}>📍 الانطلاق: {pickup}</Text>
            {destinations.map((d, i) => (
              <Text key={i} style={styles.routeText}>🏁 وجهة {i+1}: {d}</Text>
            ))}
            <Text style={styles.priceTag}>💰 السعر النهائي: {price} جنيه</Text>
          </ScrollView>
          <TouchableOpacity style={styles.callCaptainBtn} onPress={handleCallClick}><Text style={styles.callCaptainBtnText}>📞 اتصال بالكابتن</Text></TouchableOpacity>
          <AnimatedTouchableOpacity 
            style={[styles.chatButton, { backgroundColor: unreadChatCount > 0 ? chatBackgroundColor : '#8b5cf6' }]} 
            onPress={() => router.push({ pathname: '/chat', params: { senderType: 'passenger' } })}
          >
            <Text style={styles.chatButtonText}>💬 مراسلة الكابتن</Text>
            {unreadChatCount > 0 && <View style={styles.badgeContainer}><Text style={styles.badgeText}>{unreadChatCount}</Text></View>}
          </AnimatedTouchableOpacity>
          <TouchableOpacity style={styles.cancelOrderBtn} onPress={handleCancelRide}><Text style={styles.cancelOrderBtnText}>❌ إلغاء الرحلة</Text></TouchableOpacity>
        </View>
      )}

      {rideStatus === 'arrived' && (
        <Animated.View style={[styles.cardArrivalPulse, { backgroundColor: backgroundColorInterpolate }]}>
          <Text style={styles.superArrivalTitle}>🚨 الكابتن وصل! 🚨</Text>
          <Text style={styles.statusArrivalAlert}>لقد وصل الكابتن إلى نقطة الإقلال وهو في انتظارك الآن.</Text>
          
          {toastVisible && latestMessage ? (
            <Animated.View style={[styles.inlineToast, { opacity: toastOpacity, transform: [{ translateY: toastTranslateY }] }]}>
              <Text style={styles.inlineToastText} numberOfLines={2}>💬 {latestMessage}</Text>
            </Animated.View>
          ) : null}

          <View style={styles.captainCard}>
            <Image source={{ uri: getValidAvatar(captainInfo.avatar) }} style={styles.captainAvatar} />
            <View style={styles.captainDetails}>
              <Text style={styles.captainText}>👨‍✈️ الكابتن: {captainInfo.name}</Text>
              <Text style={styles.captainText}>🛺 المركبة: {captainInfo.vehicle}</Text>
            </View>
          </View>
          <ScrollView style={styles.tripRouteContainer} showsVerticalScrollIndicator={false}>
            <Text style={styles.routeText}>📍 الانطلاق: {pickup}</Text>
            {destinations.map((d, i) => (
              <Text key={i} style={styles.routeText}>🏁 وجهة {i+1}: {d}</Text>
            ))}
            <Text style={styles.priceTag}>💰 السعر النهائي: {price} جنيه</Text>
          </ScrollView>
          
          <TouchableOpacity style={styles.onTheWayBtn} onPress={notifyPassengerOnTheWay}>
            <Text style={styles.onTheWayBtnText}>🏃 أنا نازل (في طريقي إليك)</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.callCaptainBtn} onPress={handleCallClick}><Text style={styles.callCaptainBtnText}>📞 اتصال سريع بالكابتن</Text></TouchableOpacity>
          <AnimatedTouchableOpacity 
            style={[styles.chatButton, { backgroundColor: unreadChatCount > 0 ? chatBackgroundColor : '#8b5cf6' }]} 
            onPress={() => router.push({ pathname: '/chat', params: { senderType: 'passenger' } })}
          >
            <Text style={styles.chatButtonText}>💬 مراسلة الكابتن</Text>
            {unreadChatCount > 0 && <View style={styles.badgeContainer}><Text style={styles.badgeText}>{unreadChatCount}</Text></View>}
          </AnimatedTouchableOpacity>
          <TouchableOpacity style={styles.cancelOrderBtn} onPress={handleCancelRide}><Text style={styles.cancelOrderBtnText}>❌ إلغاء الرحلة</Text></TouchableOpacity>
        </Animated.View>
      )}

      {rideStatus === 'in_progress' && (
        <View style={styles.cardInProgress}>
          <Text style={styles.inProgressTitle}>🛺 الرحلة جارية الآن</Text>
          <Text style={styles.inProgressSub}>نتمنى لك طريقاً آمناً ومريحاً!</Text>
          
          {toastVisible && latestMessage ? (
            <Animated.View style={[styles.inlineToast, { opacity: toastOpacity, transform: [{ translateY: toastTranslateY }] }]}>
              <Text style={styles.inlineToastText} numberOfLines={2}>💬 {latestMessage}</Text>
            </Animated.View>
          ) : null}

          <View style={styles.captainCard}>
            <Image source={{ uri: getValidAvatar(captainInfo.avatar) }} style={styles.captainAvatar} />
            <View style={styles.captainDetails}>
              <Text style={styles.captainText}>👨‍✈️ الكابتن: {captainInfo.name}</Text>
              <Text style={styles.captainText}>🛺 المركبة: {captainInfo.vehicle}</Text>
            </View>
          </View>

          <ScrollView style={styles.tripRouteContainer} showsVerticalScrollIndicator={false}>
            <Text style={styles.routeText}>📍 الانطلاق: {pickup}</Text>
            {destinations.map((d, i) => (
              <Text key={i} style={styles.routeText}>🏁 وجهة {i+1}: {d}</Text>
            ))}
            <Text style={styles.priceTag}>💰 السعر النهائي: {price} جنيه</Text>
          </ScrollView>
          
          <TouchableOpacity style={styles.callCaptainBtn} onPress={handleCallClick}>
            <Text style={styles.callCaptainBtnText}>📞 اتصال بالكابتن</Text>
          </TouchableOpacity>
          <AnimatedTouchableOpacity 
            style={[styles.chatButton, { backgroundColor: unreadChatCount > 0 ? chatBackgroundColor : '#8b5cf6' }]} 
            onPress={() => router.push({ pathname: '/chat', params: { senderType: 'passenger' } })}
          >
            <Text style={styles.chatButtonText}>💬 مراسلة الكابتن</Text>
            {unreadChatCount > 0 && <View style={styles.badgeContainer}><Text style={styles.badgeText}>{unreadChatCount}</Text></View>}
          </AnimatedTouchableOpacity>
        </View>
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
            <TouchableOpacity style={styles.regularCallBtn} onPress={makeRegularCall}><Text style={styles.regularCallBtnText}>📱 مكالمة عادية</Text></TouchableOpacity>
            <TouchableOpacity style={styles.cancelCallBtn} onPress={() => setIsCallModalVisible(false)}><Text style={styles.cancelCallBtnText}>إلغاء</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
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
  
  inlineToast: { backgroundColor: '#1e293b', paddingVertical: 10, paddingHorizontal: 15, borderRadius: 12, marginBottom: 10, width: '100%', flexDirection: 'row-reverse', alignItems: 'center', elevation: 3 },
  inlineToastText: { color: '#ffffff', fontSize: 14, fontWeight: 'bold', textAlign: 'right', flex: 1 },

  card: { backgroundColor: '#ffffff', borderRadius: 20, padding: 20, borderWidth: 1, borderColor: '#e2e8f0', elevation: 4, flex: 1, marginBottom: 10 },
  cardTitle: { fontSize: 18, fontWeight: 'bold', color: '#1e293b', marginBottom: 15, textAlign: 'right' },
  cardActive: { flex: 1, backgroundColor: '#ffffff', borderRadius: 20, padding: 20, borderWidth: 2, borderColor: '#d97706', elevation: 6, marginBottom: 10 },
  cardArrivalPulse: { flex: 1, borderRadius: 20, padding: 20, borderWidth: 3, borderColor: '#047857', elevation: 10, shadowColor: '#000000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.5, shadowRadius: 5, marginBottom: 10 },
  cardInProgress: { flex: 1, backgroundColor: '#eff6ff', borderRadius: 20, padding: 20, borderWidth: 2, borderColor: '#3b82f6', elevation: 6, marginBottom: 10 },
  
  inProgressTitle: { fontSize: 22, fontWeight: 'bold', color: '#1d4ed8', marginBottom: 5, textAlign: 'center' },
  inProgressSub: { fontSize: 15, fontWeight: 'bold', color: '#2563eb', marginBottom: 20, textAlign: 'center' },
  superArrivalTitle: { fontSize: 22, fontWeight: 'bold', color: '#ffffff', marginBottom: 8, textAlign: 'center', textShadowColor: 'rgba(0,0,0,0.3)', textShadowOffset: {width: 1, height: 1}, textShadowRadius: 2 },
  statusArrivalAlert: { fontSize: 16, fontWeight: 'bold', color: '#f8fafc', marginBottom: 15, textAlign: 'center' },
  statusAlertTitle: { fontSize: 18, fontWeight: 'bold', color: '#d97706', marginBottom: 15, textAlign: 'center' },
  subText: { fontSize: 15, color: '#64748b', textAlign: 'center', marginBottom: 20 },
  label: { fontSize: 14, fontWeight: 'bold', color: '#475569', marginBottom: 6, textAlign: 'right' },
  
  rowInputContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  inputWithButton: { flex: 1, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 12, padding: 10, fontSize: 14, color: '#0f172a', textAlign: 'right', marginLeft: 8 },
  myLocationBtn: { backgroundColor: '#d97706', paddingVertical: 11, paddingHorizontal: 15, borderRadius: 12, justifyContent: 'center', alignItems: 'center', minWidth: 80 },
  myLocationBtnText: { color: '#ffffff', fontWeight: 'bold', fontSize: 13 },
  input: { backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 12, padding: 10, fontSize: 14, marginBottom: 15, color: '#0f172a', textAlign: 'right' },
  
  destRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  inputDest: { flex: 1, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 12, padding: 10, fontSize: 14, color: '#0f172a', textAlign: 'right' },
  removeDestBtn: { backgroundColor: '#fee2e2', padding: 12, borderRadius: 12, marginLeft: 8, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#fca5a5' },
  removeDestBtnText: { fontSize: 12 },
  addDestBtn: { backgroundColor: '#f1f5f9', paddingVertical: 10, borderRadius: 12, alignItems: 'center', marginBottom: 15, borderWidth: 1, borderColor: '#cbd5e1', borderStyle: 'dashed' },
  addDestBtnText: { color: '#3b82f6', fontWeight: 'bold', fontSize: 14 },

  passengerCountContainer: { flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 15 },
  countBtn: { flex: 1, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1', paddingVertical: 10, borderRadius: 10, marginHorizontal: 4, alignItems: 'center' },
  countBtnActive: { backgroundColor: '#d97706', borderColor: '#d97706' },
  countBtnText: { fontSize: 16, fontWeight: 'bold', color: '#64748b' },
  countBtnTextActive: { color: '#ffffff' },
  notesInput: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 12, padding: 12, fontSize: 14, marginBottom: 15, color: '#0f172a', textAlign: 'right', minHeight: 45 },
  priceDisplayContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fef3c7', borderWidth: 1.5, borderColor: '#d97706', borderRadius: 12, padding: 10, justifyContent: 'space-between' },
  priceTextDisplay: { fontSize: 18, fontWeight: 'bold', color: '#d97706', textAlign: 'right', flex: 1 },
  editPriceBtn: { backgroundColor: '#d97706', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8 },
  editPriceBtnText: { color: '#ffffff', fontWeight: 'bold', fontSize: 13 },
  suggestionsRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 20 },
  suggestionBtn: { flex: 1, backgroundColor: '#f8fafc', paddingVertical: 8, borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: '#cbd5e1', marginHorizontal: 4 },
  suggestionBtnActive: { backgroundColor: '#d97706', borderColor: '#d97706' },
  suggestionText: { fontSize: 15, fontWeight: 'bold', color: '#475569' },
  suggestionTextActive: { color: '#ffffff' },
  suggestionSubText: { fontSize: 11, color: '#64748b', marginTop: 2 },
  suggestionSubTextActive: { color: '#fef3c7' },
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
  tripRouteContainer: { maxHeight: 150, backgroundColor: '#f8fafc', padding: 12, borderRadius: 10, marginBottom: 15, borderWidth: 1, borderColor: '#e2e8f0' },
  routeText: { fontSize: 14, color: '#334155', fontWeight: 'bold', marginBottom: 4, textAlign: 'right' },
  priceTag: { fontSize: 16, color: '#10b981', fontWeight: 'bold', marginTop: 4, textAlign: 'right' },
  onTheWayBtn: { backgroundColor: '#f59e0b', paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginBottom: 10, elevation: 3 },
  onTheWayBtnText: { color: '#ffffff', fontSize: 16, fontWeight: 'bold' },
  callCaptainBtn: { backgroundColor: '#2563eb', paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginBottom: 10, elevation: 3 },
  callCaptainBtnText: { color: '#ffffff', fontSize: 16, fontWeight: 'bold' },
  chatButton: { position: 'relative', paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginBottom: 10, elevation: 3 },
  chatButtonText: { color: '#ffffff', fontSize: 16, fontWeight: 'bold' },
  badgeContainer: { position: 'absolute', top: -8, right: -8, backgroundColor: '#ef4444', minWidth: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center', zIndex: 10, borderWidth: 2, borderColor: '#ffffff' },
  badgeText: { color: '#ffffff', fontSize: 12, fontWeight: 'bold' },
  cancelOrderBtn: { backgroundColor: '#fee2e2', paddingVertical: 14, borderRadius: 12, alignItems: 'center', elevation: 1 },
  cancelOrderBtnText: { color: '#dc2626', fontSize: 16, fontWeight: 'bold' },
  cancelBtnOnly: { backgroundColor: '#fee2e2', paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  cancelBtnOnlyText: { color: '#dc2626', fontSize: 16, fontWeight: 'bold' },
});