import AsyncStorage from '@react-native-async-storage/async-storage';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import { useFocusEffect, usePathname, useRouter } from 'expo-router';
import { addDoc, collection, doc, getDoc, getDocs, increment, limit, onSnapshot, orderBy, query, setDoc, updateDoc, where } from 'firebase/firestore';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Dimensions, Image, KeyboardAvoidingView, Linking, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { db } from '../firebaseConfig';

const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);

const sendPushNotification = async (expoPushToken: string, passengerName: string, pickupLocation: string) => {
  const message = {
    to: expoPushToken,
    sound: 'default',
    title: 'مشوار جديد متاح! 🛺',
    body: `طلب جديد من ${passengerName} للانطلاق من: ${pickupLocation}`,
    data: { route: '/captain-home' },
  };
  try {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });
  } catch (error) {
    console.log("Error sending push notification:", error);
  }
};

export default function PassengerHome() {
  const router = useRouter();
  const pathname = usePathname();
  const [pickup, setPickup] = useState('');
  const [pickupCoords, setPickupCoords] = useState<{ latitude: number, longitude: number } | null>(null);
  const [destinations, setDestinations] = useState<string[]>(['']);
  const [requestedVehicleType, setRequestedVehicleType] = useState<'car' | 'tuktuk_alt' | 'scooter'>('tuktuk_alt');
  const [price, setPrice] = useState('');
  const [calculatedBasePrice, setCalculatedBasePrice] = useState(0);
  const [basePriceForSuggestions, setBasePriceForSuggestions] = useState(0);
  const [isSurgeActive, setIsSurgeActive] = useState(false);
  const [notes, setNotes] = useState('');
  const [rideStatus, setRideStatus] = useState<'idle' | 'searching' | 'accepted' | 'captain_arrived' | 'passenger_on_the_way' | 'waiting_for_scan' | 'in_progress'>('idle');
  const [currentRideId, setCurrentRideId] = useState<string | null>(null);
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [tempPrice, setTempPrice] = useState('');
  const [offers, setOffers] = useState<any[]>([]);
  const [numericSecret, setNumericSecret] = useState('');
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [latestMessage, setLatestMessage] = useState('');
  const latestMsgTimer = useRef<any>(null);

  useEffect(() => {
    if (latestMessage) {
      if (latestMsgTimer.current) clearTimeout(latestMsgTimer.current);
      latestMsgTimer.current = setTimeout(() => { setLatestMessage(''); }, 2000);
    }
    return () => { if (latestMsgTimer.current) clearTimeout(latestMsgTimer.current); };
  }, [latestMessage]);

  const [isCallModalVisible, setIsCallModalVisible] = useState(false);
  const [phoneToCall, setPhoneToCall] = useState('');
  const [isFetchingLocation, setIsFetchingLocation] = useState(false);
  const [isSendingLocation, setIsSendingLocation] = useState(false);
  const [emergencyPhone, setEmergencyPhone] = useState('');
  const [isEmergencyModalVisible, setIsEmergencyModalVisible] = useState(false);
  const [tempEmergencyPhone, setTempEmergencyPhone] = useState('');

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const sidebarAnim = useRef(new Animated.Value(Dimensions.get('window').width)).current;

  const openSidebar = () => {
    setIsSidebarOpen(true);
    Animated.timing(sidebarAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start();
  };

  const closeSidebar = () => {
    Animated.timing(sidebarAnim, { toValue: Dimensions.get('window').width, duration: 300, useNativeDriver: true }).start(() => setIsSidebarOpen(false));
  };

  const [isRatingModalVisible, setIsRatingModalVisible] = useState(false);
  const [rating, setRating] = useState(0);
  const [ratingReason, setRatingReason] = useState('');
  const [ratingSubmitted, setRatingSubmitted] = useState(false);
  const [rideToRate, setRideToRate] = useState<any>(null);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [isScannerVisible, setIsScannerVisible] = useState(false);
  const [scanned, setScanned] = useState(false);
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const chatPulseAnim = useRef(new Animated.Value(0)).current;
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const toastTranslateY = useRef(new Animated.Value(-10)).current;
  const [toastVisible, setToastVisible] = useState(false);
  const prevUnreadRef = useRef(0);
  const toastTimer = useRef<any>(null);
  const DEFAULT_AVATAR = 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png';

  const [passengerProfile, setPassengerProfile] = useState({ id: '', name: 'جار التحميل...', phone: '', avatar: DEFAULT_AVATAR, averageRating: 5, ratingCount: 0 });
  const [captainInfo, setCaptainInfo] = useState({ name: '', vehicle: 'توكتوك', phone: '', avatar: DEFAULT_AVATAR });

  const getValidAvatar = (imgStr: any) => {
    if (!imgStr || typeof imgStr !== 'string' || imgStr.trim() === '') return DEFAULT_AVATAR;
    if (imgStr.length > 950000) return DEFAULT_AVATAR;
    if (imgStr.startsWith('http') || imgStr.startsWith('data:image') || imgStr.startsWith('file:/')) return imgStr;
    if (imgStr.length > 50) return `data:image/jpeg;base64,${imgStr}`;
    return DEFAULT_AVATAR;
  };

  useFocusEffect(useCallback(() => { loadPassengerProfile(); loadEmergencyPhone(); }, []));

  const loadEmergencyPhone = async () => {
    try {
      const savedPhone = await AsyncStorage.getItem('emergency_phone');
      if (savedPhone) setEmergencyPhone(savedPhone);
    } catch (e) {}
  };

  const loadPassengerProfile = async () => {
    try {
      const passengerId = await AsyncStorage.getItem('currentPassengerId');
      if (passengerId) {
        const ratingQ = query(collection(db, 'ratings'), where('passengerId', '==', passengerId), where('type', '==', 'captain_rating_passenger'));
        let sum = 0;
        const ratingSnap = await getDocs(ratingQ);
        ratingSnap.docs.forEach(r => sum += (r.data().rating || 5));
        const rCount = ratingSnap.docs.length;
        const avgRate = rCount > 0 ? (sum / rCount).toFixed(1) : '5';
        const savedProfile = await AsyncStorage.getItem('passenger_profile');
        let pName = 'مستخدم جديد';
        let freshAvatar = DEFAULT_AVATAR;
        if (savedProfile) {
          const parsed = JSON.parse(savedProfile);
          pName = parsed.name || 'مستخدم جديد';
          setPassengerProfile({ id: passengerId, name: pName, phone: parsed.phone || '', avatar: getValidAvatar(parsed.avatar), averageRating: Number(avgRate), ratingCount: rCount });
        }
        const docRef = doc(db, 'passengers', passengerId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          pName = data.name || 'مستخدم جديد';
          freshAvatar = getValidAvatar(data.avatar || data.image);
          setPassengerProfile({ id: passengerId, name: pName, phone: data.phone || '01000000000', avatar: freshAvatar, averageRating: Number(avgRate), ratingCount: rCount });
          if (savedProfile) {
            const parsed = JSON.parse(savedProfile);
            parsed.name = pName;
            parsed.avatar = freshAvatar;
            await AsyncStorage.setItem('passenger_profile', JSON.stringify(parsed));
          }
          checkRideStatus(passengerId, pName);
        }
      } else {
        router.replace('/passenger-login');
      }
    } catch (e) {}
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
      const activeRide: any = docs.find((d: any) => ['pending', 'accepted', 'captain_arrived', 'passenger_on_the_way', 'waiting_for_scan', 'in_progress'].includes(d.status));
      if (activeRide) {
        setCurrentRideId(activeRide.id);
        setPickup(activeRide.pickupLocation || '');
        if (activeRide.pickupCoords) setPickupCoords(activeRide.pickupCoords);
        if (activeRide.numericSecret) setNumericSecret(activeRide.numericSecret);
        if (activeRide.destinationsList && activeRide.destinationsList.length > 0) {
          setDestinations(activeRide.destinationsList);
        } else {
          setDestinations([activeRide.destinationLocation || '']);
        }
        setPrice(activeRide.price || '');
        setUnreadChatCount(activeRide.unreadCountPassenger || 0);
        if (activeRide.status === 'pending') {
          setRideStatus('searching');
          setOffers(activeRide.offers || []);
        } else if (['accepted', 'captain_arrived', 'passenger_on_the_way', 'waiting_for_scan', 'in_progress'].includes(activeRide.status)) {
          setRideStatus(activeRide.status);
          setCaptainInfo({
            name: activeRide.captainName || '',
            phone: activeRide.captainPhone || 'غير مسجل',
            vehicle: activeRide.captainVehicle || 'مركبة',
            avatar: getValidAvatar(activeRide.captainAvatar)
          });
        }
        await AsyncStorage.setItem('active_ride', JSON.stringify(activeRide));
      } else {
        setRideStatus('idle');
        await AsyncStorage.removeItem('active_ride');
        setCurrentRideId(null);
        setNumericSecret('');
      }
    } catch (error) {}
  };

  useEffect(() => {
    if (!currentRideId) return;
    const rideRef = doc(db, 'rides', currentRideId);
    const unsubscribe = onSnapshot(rideRef, (docSnap) => {
      if (docSnap.exists()) {
        const firebaseData = docSnap.data();
        if (firebaseData.status === 'pending') {
          setRideStatus('searching');
          setOffers(firebaseData.offers || []);
        }
        setUnreadChatCount(firebaseData.unreadCountPassenger || 0);
        if (firebaseData.numericSecret) setNumericSecret(firebaseData.numericSecret);
        if (['accepted', 'captain_arrived', 'passenger_on_the_way', 'waiting_for_scan', 'in_progress'].includes(firebaseData.status)) {
          setRideStatus(firebaseData.status);
          setPrice(firebaseData.price ? String(firebaseData.price) : '');
          setCaptainInfo({
            name: firebaseData.captainName || 'كابتن',
            phone: firebaseData.captainPhone || 'غير مسجل',
            vehicle: firebaseData.captainVehicle || 'مركبة',
            avatar: getValidAvatar(firebaseData.captainAvatar)
          });
        } else if (firebaseData.status === 'completed') {
          setRideToRate({ firebaseData, id: currentRideId });
          setIsRatingModalVisible(true);
          AsyncStorage.removeItem('active_ride'); setCurrentRideId(null);
          setRideStatus('idle');
          setPickup(''); setPickupCoords(null); setDestinations(['']);
          setPrice(''); setOffers([]);
          setUnreadChatCount(0); setNotes(''); setLatestMessage('');
          setNumericSecret('');
        } else if (firebaseData.status === 'canceled') {
          AsyncStorage.removeItem('active_ride'); setCurrentRideId(null);
          setRideStatus('idle');
          setPickup(''); setPickupCoords(null); setDestinations(['']);
          setPrice(''); setOffers([]);
          setUnreadChatCount(0); setNotes(''); setLatestMessage('');
          setNumericSecret('');
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
        if (msg.sender === 'captain') setLatestMessage(msg.text);
      }
    });
    return () => unsubscribeMsgs();
  }, [currentRideId]);

  useEffect(() => {
    if (rideStatus === 'captain_arrived' || rideStatus === 'waiting_for_scan') {
      Animated.loop(Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: false }),
        Animated.timing(pulseAnim, { toValue: 0, duration: 600, useNativeDriver: false })
      ])).start();
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
      Animated.loop(Animated.sequence([
        Animated.timing(chatPulseAnim, { toValue: 1, duration: 400, useNativeDriver: false }),
        Animated.timing(chatPulseAnim, { toValue: 0, duration: 400, useNativeDriver: false })
      ])).start();
    } else {
      chatPulseAnim.stopAnimation();
      chatPulseAnim.setValue(0);
    }
  }, [unreadChatCount]);

  useEffect(() => {
    let locationSubscription: any;
    const startLiveTracking = async () => {
      if (currentRideId && ['accepted', 'captain_arrived', 'waiting_for_scan', 'in_progress', 'passenger_on_the_way'].includes(rideStatus)) {
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          locationSubscription = await Location.watchPositionAsync(
            { accuracy: Location.Accuracy.Balanced, timeInterval: 5000, distanceInterval: 10 },
            (loc) => {
              updateDoc(doc(db, 'rides', currentRideId), { liveCoords: { latitude: loc.coords.latitude, longitude: loc.coords.longitude } })
                .catch(e => console.log("Error updating live location:", e));
            }
          );
        }
      }
    };
    startLiveTracking();
    return () => { if (locationSubscription) locationSubscription.remove(); };
  }, [currentRideId, rideStatus]);

  const backgroundColorInterpolate = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: ['#064e3b', '#10b981'] });
  const chatBackgroundColor = chatPulseAnim.interpolate({ inputRange: [0, 1], outputRange: ['#8b5cf6', '#000000'] });

  const openChatScreen = async () => {
    if (currentRideId) {
      setUnreadChatCount(0);
      await updateDoc(doc(db, 'rides', currentRideId), { unreadCountPassenger: 0 });
      router.push({ pathname: '/chat', params: { senderType: 'passenger', rideId: currentRideId } });
    }
  };

  const openScanner = async () => {
    if (!cameraPermission?.granted) {
      const { status } = await requestCameraPermission();
      if (status !== 'granted') { Alert.alert('تنبيه', 'نحتاج صلاحية الكاميرا لمسح الكود لتأكيد بدء الرحلة'); return; }
    }
    setScanned(false);
    setIsScannerVisible(true);
  };

  const handleBarCodeScanned = async ({ data }: { data: string }) => {
    setScanned(true);
    try {
      const qrData = JSON.parse(data);
      if (qrData.rideId === currentRideId) {
        const rideDoc = await getDoc(doc(db, 'rides', currentRideId));
        if (rideDoc.exists() && rideDoc.data().qrSecret === qrData.token) {
          await updateDoc(doc(db, 'rides', currentRideId), { status: 'in_progress' });
          setIsScannerVisible(false); Alert.alert('نجاح', 'تم تأكيد الكود بنجاح والرحلة بدأت الآن رحلة سعيدة');
        } else {
          Alert.alert('خطأ', 'الكود غير مطابق لهذه الرحلة', [{ text: 'إعادة المحاولة', onPress: () => setScanned(false) }]);
        }
      } else {
        Alert.alert('خطأ', 'هذا الكود لا يخص هذه الرحلة', [{ text: 'إعادة المحاولة', onPress: () => setScanned(false) }]);
      }
    } catch (error) {
      Alert.alert('خطأ', 'الكود الممسوح غير صالح', [{ text: 'حسناً', onPress: () => setScanned(false) }]);
    }
  };

  const handleGetCurrentLocation = async () => {
    setIsFetchingLocation(true);
    try {
      let servicesEnabled = await Location.hasServicesEnabledAsync();
      if (!servicesEnabled) {
        Alert.alert('تنبيه', 'الـ GPS مغلق برجاء سحب الشاشة وتفعيله');
        setIsFetchingLocation(false);
        return;
      }
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('صلاحية مفقودة', 'برجاء السماح للتطبيق بالوصول لموقعك');
        setIsFetchingLocation(false);
        return;
      }
      let location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setPickupCoords({ latitude: location.coords.latitude, longitude: location.coords.longitude });
      let geocode = await Location.reverseGeocodeAsync({ latitude: location.coords.latitude, longitude: location.coords.longitude });
      if (geocode && geocode.length > 0) {
        const place = geocode[0];
        const address = [place.street, place.subregion || place.district, place.city].filter(Boolean).join(', ');
        handlePickupChange(address.trim() ? address : `موقعي الحالي (${location.coords.latitude.toFixed(4)})`);
      } else {
        handlePickupChange('موقعي الحالي');
      }
    } catch (error) {
      Alert.alert('خطأ', 'حدثت مشكلة أثناء التقاط إشارة الـ GPS');
    } finally {
      setIsFetchingLocation(false);
    }
  };

  const updatePriceCalculation = (pickupText: string, dests: string[], vType: string = requestedVehicleType) => {
    const validDests = dests.filter(d => d.trim().length > 0);
    if (pickupText.trim().length > 0 && validDests.length > 0) {
      let base = 0;
      if (vType === 'car') base = 25 + ((validDests.length - 1) * 15);
      else if (vType === 'scooter') base = 10 + ((validDests.length - 1) * 5);
      else base = 15 + ((validDests.length - 1) * 10);

      // --- تطبيق تسعير الذروة (Surge Pricing) ديناميكياً بناءً على الوقت ---
      const currentHour = new Date().getHours();
      const isMorningRush = currentHour >= 7 && currentHour <= 9;
      const isAfternoonRush = currentHour >= 14 && currentHour <= 17;

      if (isMorningRush || isAfternoonRush) {
        base = Math.ceil(base * 1.15); // زيادة 15% في أوقات الذروة
        setIsSurgeActive(true);
      } else {
        setIsSurgeActive(false);
      }
      
      setCalculatedBasePrice(base); setBasePriceForSuggestions(base);
      setPrice(base.toString());
    } else {
      setCalculatedBasePrice(0); setBasePriceForSuggestions(0); setPrice('');
      setIsSurgeActive(false);
    }
  };

  const handlePickupChange = (text: string) => {
    setPickup(text);
    setPickupCoords(null);
    updatePriceCalculation(text, destinations);
  };

  const handleDestinationChange = (text: string, index: number) => {
    const newDests = [...destinations];
    newDests[index] = text;
    setDestinations(newDests);
    updatePriceCalculation(pickup, newDests);
  };

  const addDestinationField = () => {
    if (destinations.length < 3) setDestinations([...destinations, '']);
    else Alert.alert('تنبيه', 'الحد الأقصى 3 وجهات في الطلب الواحد');
  };

  const removeDestinationField = (index: number) => {
    const newDests = destinations.filter((_, i) => i !== index);
    setDestinations(newDests);
    updatePriceCalculation(pickup, newDests);
  };

  const openEditPriceModal = () => {
    const validDests = destinations.filter(d => d.trim().length > 0);
    if (!pickup || validDests.length === 0) {
      Alert.alert('تنبيه', 'برجاء إدخال الانطلاق والوجهة أولاً');
      return;
    }
    setTempPrice(price);
    setIsEditModalVisible(true);
  };

  const saveNewPrice = async () => {
    const minAllowedPrice = Math.floor(calculatedBasePrice * 0.80);
    const savedNewPrice = parseInt(tempPrice) || 0;
    if (savedNewPrice < minAllowedPrice) {
      Alert.alert('تنبيه', `لا يمكن أن يقل السعر عن ${minAllowedPrice}`);
      return;
    }
    setPrice(tempPrice);
    setBasePriceForSuggestions(savedNewPrice);
    setIsEditModalVisible(false);
    try {
      const savedRide = await AsyncStorage.getItem('active_ride');
      if (savedRide) {
        const data = JSON.parse(savedRide);
        data.price = tempPrice;
        await AsyncStorage.setItem('active_ride', JSON.stringify(data));
        if (data.id) await updateDoc(doc(db, 'rides', data.id), { price: tempPrice });
      }
    } catch (e) {}
  };

  const handleSearchCaptain = async () => {
    // --- فحص الحظر المؤقت للراكب قبل بدء أي بحث ---
    try {
      const passengerIdStr = passengerProfile.id || await AsyncStorage.getItem('currentPassengerId');
      if (passengerIdStr) {
        const passSnap = await getDoc(doc(db, 'passengers', passengerIdStr));
        if (passSnap.exists()) {
          const passData = passSnap.data();
          if (passData.bannedUntil && passData.bannedUntil > Date.now()) {
            const hoursLeft = Math.ceil((passData.bannedUntil - Date.now()) / (1000 * 60 * 60));
            Alert.alert(
              'حساب موقوف 🚫', 
              `عذراً، تم إيقاف حسابك مؤقتاً لكثرة إلغاء الرحلات بعد تحرك الكابتن. يرجى المحاولة بعد ${hoursLeft} ساعة.`
            );
            return; 
          }
        }
      }
    } catch (error) {
      console.log('Error checking ban status:', error);
    }
    // --- نهاية فحص الحظر ---

    const validDests = destinations.filter(d => d.trim() !== '');
    if (!pickup || validDests.length === 0 || !price) {
      Alert.alert('تنبيه', 'برجاء إدخال بيانات الرحلة كاملاً');
      return;
    }
    setRideStatus('searching');
    setOffers([]);
    let finalPickupCoords = pickupCoords;
    if (!finalPickupCoords) {
      try {
        const geocoded = await Location.geocodeAsync(pickup);
        if (geocoded.length > 0) finalPickupCoords = { latitude: geocoded[0].latitude, longitude: geocoded[0].longitude };
      } catch (error) {}
    }
    try {
      const rideData = {
        passengerId: passengerProfile.id || await AsyncStorage.getItem('currentPassengerId'),
        name: passengerProfile.name,
        phone: passengerProfile.phone,
        avatar: getValidAvatar(passengerProfile.avatar),
        passengerRating: passengerProfile.averageRating,
        passengerRatingCount: passengerProfile.ratingCount,
        pickupLocation: pickup,
        pickupCoords: finalPickupCoords,
        destinationsList: validDests,
        destinationLocation: validDests.join(' '),
        price: price,
        notes: notes.trim(),
        requestedVehicleType,
        offers: [],
        status: 'pending',
        timestamp: new Date().getTime(),
        unreadCountPassenger: 0,
        unreadCountCaptain: 0
      };
      const docRef = await addDoc(collection(db, 'rides'), rideData);
      await AsyncStorage.setItem('active_ride', JSON.stringify({ ...rideData, id: docRef.id }));
      setCurrentRideId(docRef.id);
      Alert.alert('نجاح', 'تم إرسال الطلب، في انتظار عروض الكباتن...');

      try {
        const captainsQuery = query(collection(db, 'captains'));
        const captainsSnapshot = await getDocs(captainsQuery);
        captainsSnapshot.forEach((docSnap) => {
          const captainData = docSnap.data();
          if (captainData.pushToken) {
            sendPushNotification(captainData.pushToken, passengerProfile.name || 'راكب جديد', pickup);
          }
        });
      } catch (notifyError) {
        console.log("فشل في إرسال الإشعارات:", notifyError);
      }
    } catch (error) {
      setRideStatus('idle');
      Alert.alert('خطأ', 'حدثت مشكلة أثناء إرسال الطلب');
    }
  };

  const acceptCaptainOffer = async (offer: any) => {
    try {
      let rideId = currentRideId || JSON.parse(await AsyncStorage.getItem('active_ride') || '{}').id;
      if (!rideId) { 
        Alert.alert('خطأ', 'بيانات الرحلة مفقودة'); 
        return; 
      }

      const cleanData = { 
        status: 'accepted', 
        price: String(offer?.price || price || '0'), 
        captainId: String(offer?.captainId || 'unknown'),
        captainName: String(offer?.captainName || 'غير مسجل'),
        captainPhone: String(offer?.captainPhone || ''),
        captainVehicle: String(offer?.captainVehicle || 'مركبة'),
        captainAvatar: getValidAvatar(offer?.captainAvatar)
      };

      await setDoc(doc(db, 'rides', rideId), cleanData, { merge: true }); 
      setPrice(cleanData.price);
      
      const savedRideStr = await AsyncStorage.getItem('active_ride');
      const savedRide = savedRideStr ? JSON.parse(savedRideStr) : {};
      await AsyncStorage.setItem('active_ride', JSON.stringify({ ...savedRide, ...cleanData }));
    } catch (error) {
      console.log(error);
    }
  };

  const notifyPassengerOnTheWay = async () => {
    if (!currentRideId) return;
    try { await updateDoc(doc(db, 'rides', currentRideId), { status: 'passenger_on_the_way' }); } catch (error) {}
  };

  const handleCancelRide = async () => {
    if (!currentRideId) return;

    try {
      // التحقق مما إذا كان الإلغاء تم بعد قبول الكابتن للرحلة وتطبيق المخالفة
      if (rideStatus === 'accepted' || rideStatus === 'captain_arrived') {
        const passengerIdStr = passengerProfile.id || await AsyncStorage.getItem('currentPassengerId');
        if (passengerIdStr) {
          const passengerRef = doc(db, 'passengers', passengerIdStr);
          const passSnap = await getDoc(passengerRef);
          
          if (passSnap.exists()) {
            const passData = passSnap.data();
            const currentStrikes = passData.cancelStrikes || 0;
            
            if (currentStrikes >= 2) {
              const banTime = Date.now() + (24 * 60 * 60 * 1000);
              await updateDoc(passengerRef, {
                cancelStrikes: 0,
                bannedUntil: banTime
              });
              Alert.alert('حظر مؤقت 🚫', 'تم إيقاف حسابك من طلب الرحلات لمدة 24 ساعة بسبب تكرار إلغاء الرحلات بعد تحرك الكابتن.');
            } else {
              await updateDoc(passengerRef, {
                cancelStrikes: increment(1)
              });
              Alert.alert('تنبيه ⚠️', `تم تسجيل مخالفة إلغاء. لديك ${currentStrikes + 1} من أصل 3 مخالفات قبل إيقاف حسابك مؤقتاً.`);
            }
          }
        }
      }

      await updateDoc(doc(db, 'rides', currentRideId), {
        status: 'cancelled_by_passenger',
        canceledAt: new Date().getTime()
      });
      
      await AsyncStorage.removeItem('active_ride');
      setCurrentRideId(null);
      setRideStatus('idle');
      setOffers([]);

    } catch (error) {
      Alert.alert('خطأ', 'حدثت مشكلة أثناء إلغاء الرحلة');
    }
  };

  const submitRating = async () => {
    if (rating === 0) return;
    try {
      const targetCaptainId = rideToRate?.captainId || rideToRate?.firebaseData?.captainId || '';

      await addDoc(collection(db, 'ratings'), {
        rideId: rideToRate?.id,
        captainId: targetCaptainId,
        passengerId: passengerProfile.id,
        senderName: passengerProfile.name || 'راكب',
        rating: rating,
        reason: ratingReason || 'ممتاز',
        timestamp: new Date().getTime(),
        type: 'passenger_rating_captain'
      });

      if (rideToRate?.id) {
        await updateDoc(doc(db, 'rides', rideToRate.id), {
          passengerRating: rating,
          passengerRatingReason: ratingReason || 'ممتاز'
        });
      }
      setRatingSubmitted(true);
      setTimeout(() => {
        setIsRatingModalVisible(false);
        setRating(0);
        setRatingReason('');
        setRatingSubmitted(false);
        setRideToRate(null);
      }, 2000);
    } catch (error) { console.log(error); }
  };

  const handleCallClick = () => {
    if (!captainInfo.phone || captainInfo.phone === 'غير مسجل') {
      Alert.alert('تنبيه', 'رقم الكابتن غير متوفر');
      return;
    }
    setPhoneToCall(captainInfo.phone);
    setIsCallModalVisible(true);
  };

  const makeRegularCall = () => { setIsCallModalVisible(false); Linking.openURL(`tel:${phoneToCall}`); };
  const makeFreeCall = () => { setIsCallModalVisible(false); Alert.alert('مكالمة مجانية', 'تتطلب ربط التطبيق بخدمة اتصالات خارجية'); };

  const handleLogout = async () => {
    await AsyncStorage.removeItem('currentPassengerId');
    await AsyncStorage.removeItem('passenger_profile');
    await AsyncStorage.removeItem('active_ride');
    router.replace('/passenger-login');
  };

  const [actionAfterSave, setActionAfterSave] = useState(false);
  const openEmergencyEdit = () => { setActionAfterSave(false); setTempEmergencyPhone(emergencyPhone); setIsEmergencyModalVisible(true); };

  const saveEmergencyPhone = async () => {
    if (tempEmergencyPhone.length < 10) { Alert.alert('تنبيه', 'أدخل رقم هاتف صحيح (مثال: ٠١٠١٢٣٤٥٦٧٨)'); return; }
    let formattedPhone = tempEmergencyPhone;
    if (formattedPhone.startsWith('0')) formattedPhone = '+2' + formattedPhone;
    await AsyncStorage.setItem('emergency_phone', formattedPhone);
    setEmergencyPhone(formattedPhone);
    setIsEmergencyModalVisible(false);
    if (actionAfterSave) sendLocationToWhatsApp(formattedPhone);
    else Alert.alert('نجاح', 'تم تحديث رقم الطوارئ الخاص بك بنجاح');
  };

  const sendSafetyLocation = () => {
    if (!emergencyPhone) { setActionAfterSave(true); setTempEmergencyPhone(''); setIsEmergencyModalVisible(true); } 
    else { sendLocationToWhatsApp(emergencyPhone); }
  };

  const sendLocationToWhatsApp = async (phoneToUse: string) => {
    setIsSendingLocation(true);
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { Alert.alert('تنبيه', 'نحتاج صلاحية الموقع لإرسال مسار الرحلة للطوارئ'); setIsSendingLocation(false); return; }
      const trackingLink = `https://badr-cute.web.app/?ride=${currentRideId}`;
      const message = `أنا حالياً في رحلة مع تطبيق براق .\nتتبع مساري (لايف) من هنا لأسباب الأمان :\n${trackingLink}`;
      const whatsappUrl = `https://wa.me/${phoneToUse}?text=${encodeURIComponent(message)}`;
      try { await Linking.openURL(whatsappUrl); } catch (err) { Alert.alert('تنبيه', 'تعذر فتح واتساب قد يكون التطبيق غير مثبت'); }
    } catch (error) {
      Alert.alert('خطأ', 'حدثت مشكلة أثناء محاولة تحديد وإرسال الموقع');
    } finally {
      setIsSendingLocation(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {toastVisible && (
        <Animated.View style={[styles.toastContainer, { opacity: toastOpacity, transform: [{ translateY: toastTranslateY }] }]}>
          <Text style={styles.toastText}>رسالة جديدة من الكابتن</Text>
        </Animated.View>
      )}
      <View style={styles.header}>
        <TouchableOpacity style={styles.userInfo} onPress={() => router.push('/passenger-profile')}>
          <Image source={{ uri: passengerProfile.avatar }} style={styles.profileAvatar} />
          <View>
            <Text style={styles.headerPassengerName} numberOfLines={1}>{passengerProfile.name ? passengerProfile.name.split(' ')[0] : 'مستخدم'}</Text>
            <View style={{ flexDirection: 'row-reverse', marginTop: 2, marginRight: 8 }}>
              {[1, 2, 3, 4, 5].map((star) => (
                <Text key={star} style={{ fontSize: 14, color: star <= Math.round(passengerProfile.averageRating) ? '#f59e0b' : '#cbd5e1' }}>★</Text>
              ))}
            </View>
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={styles.headerMenuBtn} onPress={openSidebar}>
          <Text style={styles.headerMenuText}>≡</Text>
        </TouchableOpacity>
      </View>
      {rideStatus === 'idle' && (
        <ScrollView style={styles.card} contentContainerStyle={{ paddingBottom: 60 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <Text style={styles.cardTitle}>اطلب مشوارك الآن</Text>
          <Text style={styles.label}>اختر نوع براقك</Text>
          <View style={styles.vehicleTypeTabs}>
            <TouchableOpacity style={[styles.vTypeBtn, requestedVehicleType === 'car' && styles.vTypeBtnActive]} onPress={() => { setRequestedVehicleType('car'); updatePriceCalculation(pickup, destinations, 'car'); }}>
              <Text style={[styles.vTypeText, requestedVehicleType === 'car' && styles.vTypeTextActive]}>سيارة</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.vTypeBtn, requestedVehicleType === 'tuktuk_alt' && styles.vTypeBtnActive]} onPress={() => { setRequestedVehicleType('tuktuk_alt'); updatePriceCalculation(pickup, destinations, 'tuktuk_alt'); }}>
              <Text style={[styles.vTypeText, requestedVehicleType === 'tuktuk_alt' && styles.vTypeTextActive]}>بديل توكتوك</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.vTypeBtn, requestedVehicleType === 'scooter' && styles.vTypeBtnActive]} onPress={() => { setRequestedVehicleType('scooter'); updatePriceCalculation(pickup, destinations, 'scooter'); }}>
              <Text style={[styles.vTypeText, requestedVehicleType === 'scooter' && styles.vTypeTextActive]}>سكوتر</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.label}>موقع الانطلاق الحالي</Text>
          <View style={styles.rowInputContainer}>
            <TextInput style={styles.inputWithButton} placeholder="اكتب مكان الانطلاق" placeholderTextColor="#94a3b8" value={pickup} onChangeText={handlePickupChange} />
            <TouchableOpacity style={styles.myLocationBtn} onPress={handleGetCurrentLocation} disabled={isFetchingLocation}>
              {isFetchingLocation ? <ActivityIndicator color="#ffffff" size="small" /> : <Text style={styles.myLocationBtnText}>موقعي</Text>}
            </TouchableOpacity>
          </View>
          <Text style={styles.label}>الوجهات المطلوبة</Text>
          {destinations.map((dest, index) => (
            <View key={index} style={styles.destRow}>
              <TextInput style={styles.inputDest} placeholder={`الوجهة رقم ${index + 1}`} placeholderTextColor="#94a3b8" value={dest} onChangeText={(text) => handleDestinationChange(text, index)} />
              {index > 0 && (
                <TouchableOpacity style={styles.removeDestBtn} onPress={() => removeDestinationField(index)}>
                  <Text style={styles.removeDestBtnText}>X</Text>
                </TouchableOpacity>
              )}
            </View>
          ))}
          {destinations.length < 3 && (
            <TouchableOpacity style={styles.addDestBtn} onPress={addDestinationField}>
              <Text style={styles.addDestBtnText}>+ إضافة وجهة أخرى</Text>
            </TouchableOpacity>
          )}
          <Text style={styles.label}>ملاحظات للكابتن (اختياري)</Text>
          <TextInput style={styles.notesInput} placeholder="مثال معايا أغراض خفيفة ..." placeholderTextColor="#94a3b8" value={notes} onChangeText={setNotes} multiline={true} />
          
          <View style={{flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center'}}>
            <Text style={styles.label}>أجرة الرحلة المقترحة</Text>
            {isSurgeActive && <Text style={{color: '#ef4444', fontSize: 12, fontWeight: 'bold', marginBottom: 6}}>🔥 وقت الذروة</Text>}
          </View>

          <View style={[styles.priceDisplayContainer, { marginBottom: (basePriceForSuggestions > 0 && pickup && destinations[0]) ? 10 : 20, borderColor: isSurgeActive ? '#ef4444' : '#d97706' }]}>
            <Text style={[styles.priceTextDisplay, isSurgeActive && {color: '#ef4444'}]}>{price ? `${price} جنيه` : '---'}</Text>
            <TouchableOpacity style={[styles.editPriceBtn, isSurgeActive && {backgroundColor: '#ef4444'}]} onPress={openEditPriceModal}>
              <Text style={styles.editPriceBtnText}>تعديل السعر</Text>
            </TouchableOpacity>
          </View>
          {basePriceForSuggestions > 0 && pickup.trim() !== '' && destinations[0].trim() !== '' && (
            <View style={styles.suggestionsRow}>
              {[1.2, 1.4, 1.6].map((multiplier, index) => {
                const suggestedPrice = Math.round(basePriceForSuggestions * multiplier);
                const isSelected = price === suggestedPrice.toString();
                const percentage = Math.round((multiplier - 1) * 100);
                return (
                  <TouchableOpacity key={index} style={[styles.suggestionBtn, isSelected && styles.suggestionBtnActive, isSelected && isSurgeActive && {backgroundColor: '#ef4444', borderColor: '#ef4444'}]} onPress={() => setPrice(suggestedPrice.toString())}>
                    <Text style={[styles.suggestionText, isSelected && styles.suggestionTextActive]}>{suggestedPrice}</Text>
                    <Text style={[styles.suggestionSubText, isSelected && styles.suggestionSubTextActive]}>+{percentage}%</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
          <TouchableOpacity style={styles.searchButton} onPress={handleSearchCaptain}>
            <Text style={styles.searchButtonText}>البحث عن كابتن</Text>
          </TouchableOpacity>
        </ScrollView>
      )}
      {rideStatus === 'searching' && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>جاري استقبال العروض ...</Text>
          {offers.length === 0 ? (<Text style={styles.subText}>يرجى الانتظار قليلاً لتلقي عروض الكباتن...</Text>) : null}
          <ScrollView style={styles.offersContainer} showsVerticalScrollIndicator={false}>
            {offers.map((offer, index) => (
              <View key={index} style={styles.offerCard}>
                <Image source={{ uri: getValidAvatar(offer.captainAvatar) }} style={styles.offerAvatar} />
                <View style={styles.offerDetails}>
                  <Text style={styles.offerName}>{offer.captainName}</Text>
                  <View style={{ flexDirection: 'row-reverse', marginTop: 2 }}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Text key={star} style={{ fontSize: 13, color: star <= Math.round(offer.captainRating || 5) ? '#f59e0b' : '#cbd5e1' }}>★</Text>
                    ))}
                  </View>
                  <Text style={styles.offerVehicle}>{offer.captainVehicle}</Text>
                  <Text style={styles.offerPrice}>{offer.price} جنيه</Text>
                </View>
                <TouchableOpacity style={styles.acceptOfferBtn} onPress={() => acceptCaptainOffer(offer)}>
                  <Text style={styles.acceptOfferBtnText}>قبول</Text>
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
          <TouchableOpacity style={styles.cancelBtnOnly} onPress={() => Alert.alert('إلغاء الطلب', 'هل أنت متأكد من إلغاء البحث؟', [{ text: 'تراجع', style: 'cancel' }, { text: 'نعم، إلغاء', onPress: handleCancelRide }])}>
            <Text style={styles.cancelBtnOnlyText}>إلغاء الطلب</Text>
          </TouchableOpacity>
        </View>
      )}
      {(rideStatus === 'accepted' || rideStatus === 'passenger_on_the_way' || rideStatus === 'captain_arrived' || rideStatus === 'waiting_for_scan' || rideStatus === 'in_progress') && (
        <Animated.View style={[styles.cardActive, (rideStatus === 'captain_arrived' || rideStatus === 'waiting_for_scan') && styles.cardArrivalPulse, (rideStatus === 'captain_arrived' || rideStatus === 'waiting_for_scan') && { backgroundColor: backgroundColorInterpolate }]}>
          {rideStatus === 'captain_arrived' ? (
            <>
              <Text style={styles.superArrivalTitle}>براقك وصل !</Text>
              <Text style={styles.statusArrivalAlert}>لقد وصل الكابتن إلى نقطة الإقلال وهو في انتظارك الآن .</Text>
            </>
          ) : (
            <Text style={[styles.statusAlertTitle, rideStatus === 'waiting_for_scan' && { color: '#ffffff' }]}>
              {rideStatus === 'accepted' ? 'الكابتن في طريقه إليك ...' : rideStatus === 'passenger_on_the_way' ? 'أنت الآن في طريقك للكابتن .' : rideStatus === 'waiting_for_scan' ? 'بانتظار إدخال أو مسح الكود' : 'الرحلة جارية الآن'}
            </Text>
          )}
          {latestMessage ? (
            <View style={{ backgroundColor: '#1e293b', padding: 15, borderRadius: 12, marginBottom: 15, flexDirection: 'row-reverse', alignItems: 'center', elevation: 2 }}>
              <Text style={{ fontSize: 22, marginLeft: 10 }}>💬</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#94a3b8', fontSize: 11, textAlign: 'right', marginBottom: 2 }}>أحدث رسالة من الكابتن :</Text>
                <Text style={{ color: '#ffffff', fontSize: 14, fontWeight: 'bold', textAlign: 'right' }} numberOfLines={2}>{latestMessage}</Text>
              </View>
            </View>
          ) : null}
          <View style={styles.captainCard}>
            <Image source={{ uri: getValidAvatar(captainInfo.avatar) }} style={styles.captainAvatar} />
            <View style={styles.captainDetails}>
              <Text style={styles.captainText}>الكابتن: {captainInfo.name}</Text>
              <Text style={styles.captainText}>المركبة: {captainInfo.vehicle}</Text>
            </View>
          </View>
          {rideStatus === 'waiting_for_scan' && (
            <View style={styles.authContainer}>
              <TouchableOpacity style={styles.scanBtn} onPress={openScanner}>
                <Text style={styles.scanBtnText}>امسح كود الكابتن لبدء الرحلة</Text>
              </TouchableOpacity>
              <Text style={styles.orText}>أو ملّي الكابتن الكود السري</Text>
              <View style={styles.numericCodeBox}>
                <Text style={styles.numericCode}>{numericSecret ? numericSecret : '...'}</Text>
              </View>
            </View>
          )}
          <ScrollView style={styles.tripRouteContainer} showsVerticalScrollIndicator={false}>
            <Text style={styles.routeText}>الانطلاق: {pickup}</Text>
            {destinations.map((d, i) => (<Text key={i} style={styles.routeText}>وجهة {i + 1}: {d}</Text>))}
            <Text style={styles.priceTag}>السعر النهائي : {price} جنيه</Text>
          </ScrollView>
          {(rideStatus === 'accepted' || rideStatus === 'captain_arrived') && (
            <TouchableOpacity style={styles.onTheWayBtn} onPress={notifyPassengerOnTheWay}>
              <Text style={styles.onTheWayBtnText}>أنا نازل في طريقي إليك</Text>
            </TouchableOpacity>
          )}
          <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 10 }}>
            <TouchableOpacity style={[styles.callCaptainBtn, { flex: 1, marginLeft: 5 }]} onPress={handleCallClick}>
              <Text style={styles.callCaptainBtnText}>اتصال</Text>
            </TouchableOpacity>
            <AnimatedTouchableOpacity style={[styles.chatButton, { flex: 1, marginRight: 5, backgroundColor: chatBackgroundColor }]} onPress={openChatScreen}>
              <Text style={styles.chatButtonText}>مراسلة</Text>
              {unreadChatCount > 0 && (
                <View style={styles.badgeContainer}>
                  <Text style={styles.badgeText}>{unreadChatCount}</Text>
                </View>
              )}
            </AnimatedTouchableOpacity>
          </View>
          <TouchableOpacity style={styles.safetyBtn} onPress={sendSafetyLocation} disabled={isSendingLocation}>
            {isSendingLocation ? (<ActivityIndicator color="#ffffff" />) : (<Text style={styles.safetyBtnText}>مشاركة مسار الرحلة (أمان)</Text>)}
          </TouchableOpacity>

          {rideStatus !== 'in_progress' && (
            <TouchableOpacity style={styles.cancelOrderBtn} onPress={() => Alert.alert('إلغاء الرحلة', 'هل أنت متأكد من إلغاء الرحلة؟', [{ text: 'تراجع', style: 'cancel' }, { text: 'نعم، إلغاء', onPress: handleCancelRide }])}>
              <Text style={styles.cancelOrderBtnText}>إلغاء الرحلة</Text>
            </TouchableOpacity>
          )}
        </Animated.View>
      )}
      <Modal visible={isEmergencyModalVisible} transparent={true} animationType="fade">
        <View style={styles.modaloverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>إعداد رقم الطوارئ</Text>
            <Text style={styles.modalSubtitle}>يرجى إدخال رقم هاتف شخص تثق به يمتلك واتساب. لمشاركة مسار رحلتك معه بنقرة واحدة لاحقا.</Text>
            <TextInput style={styles.modalInput} value={tempEmergencyPhone} onChangeText={setTempEmergencyPhone} keyboardType="phone-pad" placeholder="مثال: ٠١٠١٢٣٤٥٦٧٨" placeholderTextColor="#94a3b8" />
            <View style={styles.modalButtonsRow}>
              <TouchableOpacity style={styles.modalSaveBtn} onPress={saveEmergencyPhone}>
                <Text style={styles.modalSaveBtnText}>{actionAfterSave ? 'حفظ الرقم الجديد وإرسال الآن' : 'حفظ'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setIsEmergencyModalVisible(false)}>
                <Text style={styles.modalCancelBtnText}>إلغاء</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      <Modal visible={isScannerVisible} transparent={true} animationType="slide">
        <View style={styles.modalOverlayQR}>
          <Text style={styles.qrHeader}>وجه الكاميرا نحو كود الكابتن</Text>
          <View style={styles.qrScannerBox}>
            <CameraView style={{ flex: 1 }} facing="back" barcodeScannerSettings={{ barcodeTypes: ["qr"] }} onBarcodeScanned={scanned ? undefined : handleBarCodeScanned} />
          </View>
          <TouchableOpacity style={styles.cancelScanBtn} onPress={() => setIsScannerVisible(false)}>
            <Text style={styles.cancelScanBtnText}>إلغاء</Text>
          </TouchableOpacity>
        </View>
      </Modal>
      <Modal visible={isRatingModalVisible} transparent={true} animationType="fade">
        <View style={styles.modaloverlay}>
          <View style={styles.ratingModalContent}>
            {!ratingSubmitted ? (
              <>
                <Text style={styles.modalTitle}>كيف كانت الرحلة؟</Text>
                <Text style={styles.modalSubtitle}>تقييمك للكابتن يساعدنا في تحسين الخدمة</Text>
                <View style={styles.starsRow}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <TouchableOpacity key={star} onPress={() => setRating(star)}>
                      <Text style={[styles.starText, { color: star <= rating ? '#f59e0b' : '#cbd5e1' }]}>★</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {rating === 5 && <Text style={styles.thankYouFiveStars}>شكراً لك</Text>}
                {rating > 0 && rating < 5 && (<TextInput style={styles.reasonInput} placeholder="ما هو سبب تقييمك؟ (إلزامي)" placeholderTextColor="#94a3b8" value={ratingReason} onChangeText={setRatingReason} multiline={true} />)}
                {rating > 0 && (
                  <TouchableOpacity style={styles.submitRatingBtn} onPress={submitRating}>
                    <Text style={styles.submitRatingBtnText}>إرسال التقييم</Text>
                  </TouchableOpacity>
                )}
              </>
            ) : (
              <View style={styles.successRatingContainer}>
                <Text style={styles.successRatingIcon}>✅</Text>
                <Text style={styles.successRatingText}>نشكرك على تقييمك لمساعدتنا في تطوير الخدمة</Text>
              </View>
            )}
          </View>
        </View>
      </Modal>
      <Modal visible={isEditModalVisible} transparent={true} animationType="fade">
        <View style={styles.modaloverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>تعديل سعر الرحلة</Text>
            <Text style={styles.modalSubtitle}>الحد الأدنى {Math.floor(calculatedBasePrice * 0.80)} جنيه</Text>
            <TextInput style={styles.modalInput} value={tempPrice} onChangeText={setTempPrice} keyboardType="numeric" placeholder="اكتب السعر الجديد" placeholderTextColor="#94a3b8" />
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
      <Modal visible={isCallModalVisible} transparent={true} animationType="fade">
        <View style={styles.modaloverlay}>
          <View style={styles.callModalContent}>
            <Text style={styles.modalTitle}>اختر طريقة الاتصال</Text>
            <TouchableOpacity style={styles.regularCallBtn} onPress={makeRegularCall}>
              <Text style={styles.regularCallBtnText}>مكالمة عادية شبكة المحمول</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.freeCallBtn} onPress={makeFreeCall}>
              <Text style={styles.freeCallBtnText}>مكالمة مجانية داخل التطبيق</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelCallBtn} onPress={() => setIsCallModalVisible(false)}>
              <Text style={styles.cancelCallBtnText}>إلغاء</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      <Modal visible={isSidebarOpen} transparent={true} animationType="none" onRequestClose={closeSidebar}>
        <View style={styles.sidebarOverlay}>
          <TouchableOpacity style={styles.sidebarCloseArea} onPress={closeSidebar} activeOpacity={1} />
          <Animated.View style={[styles.sidebarPanel, { transform: [{ translateX: sidebarAnim }] }]}>
            <View style={styles.sidebarHeader}>
              <Image source={{ uri: passengerProfile.avatar }} style={styles.sidebarAvatar} />
              <Text style={styles.sidebarName}>{passengerProfile.name}</Text>
              <Text style={styles.sidebarPhone}>{passengerProfile.phone}</Text>
            </View>
            <ScrollView style={styles.sidebarLinks}>
              <TouchableOpacity style={styles.sidebarLink} onPress={() => { closeSidebar(); router.push('/passenger-history'); }}>
                <Text style={styles.sidebarLinkText}>سجل الرحلات</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.sidebarLink} onPress={() => { closeSidebar(); router.push('/passenger-ratings'); }}>
                <Text style={styles.sidebarLinkText}>تقييماتي</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.sidebarLink} onPress={() => { closeSidebar(); openEmergencyEdit(); }}>
                <Text style={styles.sidebarLinkText}>رقم الطوارئ والأمان</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.sidebarLink} onPress={() => { closeSidebar(); router.push('/support'); }}>
                <Text style={styles.sidebarLinkText}>الدعم الفني</Text>
              </TouchableOpacity>
            </ScrollView>
            <TouchableOpacity style={styles.sidebarLogoutBtn} onPress={handleLogout}>
              <Text style={styles.sidebarLogoutText}>تسجيل الخروج</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9', padding: 15, paddingTop: 40 },
  header: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#ffffff', padding: 12, borderRadius: 16, marginBottom: 20, elevation: 2 },
  userInfo: { flexDirection: 'row-reverse', alignItems: 'center', flex: 1 },
  profileAvatar: { width: 45, height: 45, borderRadius: 22.5, backgroundColor: '#cbd5e1', marginLeft: 10 },
  headerPassengerName: { fontSize: 14, fontWeight: 'bold', color: '#1e293b', marginRight: 8, textAlign: 'right' },
  logoutButton: { backgroundColor: '#fee2e2', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 12 },
  logoutText: { color: '#ef4444', fontWeight: 'bold', fontSize: 14 },
  toastContainer: { position: 'absolute', alignSelf: 'center', backgroundColor: '#1e293b', paddingVertical: 12, paddingHorizontal: 25, borderRadius: 30, zIndex: 9999, elevation: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 5 },
  toastText: { color: '#ffffff', fontSize: 15, fontWeight: 'bold' },
  inlineToast: { backgroundColor: '#1e293b', paddingVertical: 10, paddingHorizontal: 15, borderRadius: 12, marginBottom: 10, width: '100%', flexDirection: 'row-reverse', alignItems: 'center', elevation: 3 },
  inlineToastText: { color: '#ffffff', fontSize: 14, fontWeight: 'bold', textAlign: 'right', flex: 1 },
  card: { backgroundColor: '#ffffff', borderRadius: 20, padding: 20, borderWidth: 1, borderColor: '#e2e8f0', elevation: 4, flex: 1, marginBottom: 10 },
  cardTitle: { fontSize: 18, fontWeight: 'bold', color: '#1e293b', marginBottom: 15, textAlign: 'right' },
  cardActive: { flex: 1, backgroundColor: '#ffffff', borderRadius: 20, padding: 20, borderWidth: 2, borderColor: '#d97706', elevation: 6, marginBottom: 10 },
  cardArrivalPulse: { flex: 1, borderRadius: 20, padding: 20, borderWidth: 3, borderColor: '#047857', elevation: 10, shadowColor: '#000000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.5, shadowRadius: 5, marginBottom: 10 },
  superArrivalTitle: { fontSize: 22, fontWeight: 'bold', color: '#ffffff', marginBottom: 8, textAlign: 'center', textShadowColor: 'rgba(0,0,0,0.3)', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 2 },
  statusArrivalAlert: { fontSize: 16, fontWeight: 'bold', color: '#f8fafc', marginBottom: 15, textAlign: 'center' },
  statusAlertTitle: { fontSize: 18, fontWeight: 'bold', color: '#d97706', marginBottom: 15, textAlign: 'center' },
  subText: { fontSize: 15, color: '#64748b', textAlign: 'center', marginBottom: 20 },
  label: { fontSize: 14, fontWeight: 'bold', color: '#475569', marginBottom: 6, textAlign: 'right' },
  vehicleTypeTabs: { flexDirection: 'row-reverse', justifyContent: 'center', gap: 10, marginBottom: 20 },
  vTypeBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 12, backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#cbd5e1' },
  vTypeBtnActive: { backgroundColor: '#eff6ff', borderColor: '#3b82f6', borderWidth: 2 },
  vTypeText: { fontSize: 14, fontWeight: 'bold', color: '#64748b' },
  vTypeTextActive: { color: '#2563eb' },
  rowInputContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  inputWithButton: { flex: 1, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 12, padding: 10, fontSize: 14, color: '#0f172a', textAlign: 'right', marginLeft: 8 },
  myLocationBtn: { backgroundColor: '#d97706', paddingVertical: 11, paddingHorizontal: 15, borderRadius: 12, justifyContent: 'center', alignItems: 'center', minWidth: 80 },
  myLocationBtnText: { color: '#ffffff', fontWeight: 'bold', fontSize: 13 },
  destRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  inputDest: { flex: 1, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 12, padding: 10, fontSize: 14, color: '#0f172a', textAlign: 'right' },
  removeDestBtn: { backgroundColor: '#fee2e2', padding: 12, borderRadius: 12, marginLeft: 8, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#fca5a5' },
  removeDestBtnText: { fontSize: 12 },
  addDestBtn: { backgroundColor: '#f1f5f9', paddingVertical: 10, borderRadius: 12, alignItems: 'center', marginBottom: 15, borderWidth: 1, borderColor: '#cbd5e1', borderStyle: 'dashed' },
  addDestBtnText: { color: '#3b82f6', fontWeight: 'bold', fontSize: 14 },
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
  offerDetails: { flex: 1, alignItems: 'flex-end' },
  offerName: { fontSize: 15, fontWeight: 'bold', color: '#1e293b', textAlign: 'right' },
  offerVehicle: { fontSize: 13, color: '#64748b', textAlign: 'right', marginTop: 2 },
  offerPrice: { fontSize: 16, fontWeight: 'bold', color: '#10b981', textAlign: 'right', marginTop: 4 },
  acceptOfferBtn: { backgroundColor: '#10b981', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8 },
  acceptOfferBtnText: { color: '#ffffff', fontWeight: 'bold', fontSize: 14 },
  cancelBtnOnly: { backgroundColor: '#fee2e2', paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  cancelBtnOnlyText: { color: '#dc2626', fontWeight: 'bold', fontSize: 15 },
  modaloverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { backgroundColor: '#ffffff', width: '100%', padding: 20, borderRadius: 20, elevation: 5 },
  callModalContent: { backgroundColor: '#ffffff', width: '85%', padding: 20, borderRadius: 20, elevation: 5, alignItems: 'center' },
  ratingModalContent: { backgroundColor: '#ffffff', width: '95%', padding: 25, borderRadius: 24, elevation: 5, alignItems: 'center' },
  starsRow: { flexDirection: 'row-reverse', justifyContent: 'center', marginVertical: 15, gap: 10 },
  starText: { fontSize: 45 },
  thankYouFiveStars: { fontSize: 16, fontWeight: 'bold', color: '#10b981', textAlign: 'center', marginBottom: 15 },
  reasonInput: { width: '100%', backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 12, padding: 12, fontSize: 14, marginBottom: 15, color: '#0f172a', textAlign: 'right', minHeight: 80 },
  submitRatingBtn: { backgroundColor: '#2563eb', width: '100%', paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginTop: 5 },
  submitRatingBtnText: { color: '#ffffff', fontSize: 16, fontWeight: 'bold' },
  successRatingContainer: { alignItems: 'center', paddingVertical: 20 },
  successRatingIcon: { fontSize: 50, marginBottom: 15 },
  successRatingText: { fontSize: 18, fontWeight: 'bold', color: '#1e293b', textAlign: 'center', lineHeight: 28 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#1e293b', marginBottom: 10, textAlign: 'center' },
  modalSubtitle: { fontSize: 13, color: '#64748b', marginBottom: 15, textAlign: 'center' },
  modalInput: { backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 12, padding: 12, fontSize: 16, fontWeight: 'bold', color: '#0f172a', textAlign: 'center', marginBottom: 20 },
  modalButtonsRow: { flexDirection: 'row-reverse', gap: 10 },
  modalSaveBtn: { flex: 2, backgroundColor: '#2563eb', paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  modalSaveBtnText: { color: '#ffffff', fontWeight: 'bold', fontSize: 15 },
  modalCancelBtn: { flex: 1, backgroundColor: '#fee2e2', paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  modalCancelBtnText: { color: '#ef4444', fontWeight: 'bold', fontSize: 15 },
  regularCallBtn: { backgroundColor: '#f1f5f9', width: '100%', paddingVertical: 15, borderRadius: 12, alignItems: 'center', marginBottom: 10, borderWidth: 1, borderColor: '#cbd5e1' },
  regularCallBtnText: { color: '#1e293b', fontWeight: 'bold', fontSize: 16 },
  freeCallBtn: { backgroundColor: '#10b981', width: '100%', paddingVertical: 15, borderRadius: 12, alignItems: 'center', marginBottom: 15 },
  freeCallBtnText: { color: '#ffffff', fontWeight: 'bold', fontSize: 16 },
  cancelCallBtn: { paddingVertical: 10, marginTop: 10 },
  cancelCallBtnText: { color: '#ef4444', fontWeight: 'bold', fontSize: 16, textAlign: 'center' },
  searchButton: { backgroundColor: '#d97706', paddingVertical: 15, borderRadius: 14, alignItems: 'center', elevation: 3, marginBottom: 20 },
  searchButtonText: { color: '#ffffff', fontSize: 18, fontWeight: 'bold' },
  captainCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fef3c7', padding: 12, borderRadius: 14, marginBottom: 15 },
  captainAvatar: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#cbd5e1' },
  captainDetails: { flex: 1, marginHorizontal: 15 },
  captainText: { fontSize: 14, fontWeight: 'bold', color: '#1e293b', marginBottom: 2, textAlign: 'right' },
  authContainer: { alignItems: 'center', backgroundColor: '#1e293b', padding: 15, borderRadius: 14, marginBottom: 15, borderWidth: 1, borderColor: '#334155' },
  orText: { fontSize: 14, fontWeight: 'bold', color: '#94a3b8', marginVertical: 12 },
  numericCodeBox: { backgroundColor: '#3b82f6', paddingVertical: 12, paddingHorizontal: 30, borderRadius: 12, borderWidth: 2, borderColor: '#60a5fa', borderStyle: 'dashed', minWidth: 150, alignItems: 'center' },
  numericCode: { fontSize: 26, fontWeight: 'bold', color: '#ffffff', letterSpacing: 2 },
  scanBtn: { backgroundColor: '#10b981', paddingVertical: 15, width: '100%', borderRadius: 12, alignItems: 'center', borderWidth: 2, borderColor: '#34d399' },
  scanBtnText: { color: '#ffffff', fontSize: 16, fontWeight: 'bold' },
  tripRouteContainer: { maxHeight: 150, backgroundColor: '#f8fafc', padding: 12, borderRadius: 10, marginBottom: 15, borderWidth: 1, borderColor: '#e2e8f0' },
  routeText: { fontSize: 14, color: '#334155', fontWeight: 'bold', marginBottom: 4, textAlign: 'right' },
  priceTag: { fontSize: 16, color: '#10b981', fontWeight: 'bold', marginTop: 4, textAlign: 'right' },
  onTheWayBtn: { backgroundColor: '#f59e0b', paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginBottom: 10, elevation: 3 },
  onTheWayBtnText: { color: '#ffffff', fontSize: 16, fontWeight: 'bold' },
  callCaptainBtn: { backgroundColor: '#2563eb', paddingVertical: 14, borderRadius: 12, alignItems: 'center', elevation: 3 },
  callCaptainBtnText: { color: '#ffffff', fontSize: 16, fontWeight: 'bold' },
  chatButton: { position: 'relative', paddingVertical: 14, borderRadius: 12, alignItems: 'center', elevation: 3 },
  chatButtonText: { color: '#ffffff', fontSize: 16, fontWeight: 'bold' },
  badgeContainer: { position: 'absolute', top: -8, right: -8, backgroundColor: '#ef4444', minWidth: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center', zIndex: 10, borderWidth: 2, borderColor: '#ffffff' },
  badgeText: { color: '#ffffff', fontSize: 12, fontWeight: 'bold' },
  safetyBtn: { backgroundColor: '#ef4444', paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginBottom: 10, elevation: 3, borderWidth: 1, borderColor: '#dc2626' },
  safetyBtnText: { color: '#ffffff', fontSize: 16, fontWeight: 'bold' },
  cancelOrderBtn: { backgroundColor: '#fee2e2', paddingVertical: 14, borderRadius: 12, alignItems: 'center', elevation: 1 },
  cancelOrderBtnText: { color: '#dc2626', fontSize: 16, fontWeight: 'bold' },
  editEmergencyBtn: { backgroundColor: '#e2e8f0', paddingVertical: 10, borderRadius: 10, alignItems: 'center', marginBottom: 15 },
  editEmergencyText: { color: '#475569', fontSize: 13, fontWeight: 'bold' },
  modalOverlayQR: { flex: 1, backgroundColor: '#000000', justifyContent: 'center', alignItems: 'center', padding: 20 },
  qrHeader: { color: '#ffffff', fontSize: 20, fontWeight: 'bold', marginBottom: 30 },
  qrScannerBox: { width: 300, height: 300, borderRadius: 20, overflow: 'hidden', borderWidth: 3, borderColor: '#10b981', elevation: 10 },
  cancelScanBtn: { marginTop: 40, paddingVertical: 12, paddingHorizontal: 30, backgroundColor: '#ef4444', borderRadius: 10 },
  cancelScanBtnText: { color: '#ffffff', fontWeight: 'bold', fontSize: 16 },
  headerMenuBtn: { padding: 8, backgroundColor: '#f8fafc', borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0', marginLeft: 10 },
  headerMenuText: { fontSize: 20, color: '#1e293b' },
  sidebarOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', flexDirection: 'row-reverse' },
  sidebarCloseArea: { flex: 1 },
  sidebarPanel: { width: '75%', backgroundColor: '#ffffff', height: '100%', elevation: 15 },
  sidebarHeader: { backgroundColor: '#1e293b', padding: 20, paddingTop: 50, alignItems: 'center', borderBottomWidth: 3, borderColor: '#3b82f6' },
  sidebarAvatar: { width: 80, height: 80, borderRadius: 40, borderWidth: 2, borderColor: '#3b82f6', marginBottom: 10 },
  sidebarName: { fontSize: 18, fontWeight: 'bold', color: '#ffffff' },
  sidebarPhone: { fontSize: 14, color: '#94a3b8', marginTop: 5 },
  sidebarLinks: { padding: 20 },
  sidebarLink: { paddingVertical: 18, borderBottomWidth: 1, borderColor: '#f1f5f9' },
  sidebarLinkText: { fontSize: 16, color: '#334155', fontWeight: 'bold', textAlign: 'right' },
  sidebarLogoutBtn: { backgroundColor: '#fee2e2', padding: 15, margin: 20, borderRadius: 12, alignItems: 'center' },
  sidebarLogoutText: { color: '#ef4444', fontSize: 16, fontWeight: 'bold' }
});