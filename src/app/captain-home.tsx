import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { useFocusEffect, useRouter } from 'expo-router';
import { addDoc, arrayUnion, collection, doc, getDoc, getDocs, limit, onSnapshot, orderBy, query, updateDoc, where } from 'firebase/firestore';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Dimensions, FlatList, Image, Linking, Modal, PanResponder, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import QRCode from 'react-native-qrcode-svg';
import { db } from '../firebaseConfig';

const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);
const SCREEN_WIDTH = Dimensions.get('window').width;

const getSafeAvatar = (imgStr: any) => {
  if (!imgStr || typeof imgStr !== 'string' || imgStr.trim() === '') return 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png';
  if (imgStr.startsWith('http') || imgStr.startsWith('file:/') || imgStr.startsWith('data:image')) return imgStr;
  if (imgStr.length > 50) return `data:image/jpeg;base64,${imgStr}`;
  return 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png';
};

const SwipeableRequestItem = ({ item, onSendOffer, onEditPrice, onDismiss, hasSentOffer, captainLocation }: { item: any, onSendOffer: (item: any, price: string) => void, onEditPrice: (item: any) => void, onDismiss: (item: any) => void, hasSentOffer: boolean, captainLocation: any }) => {
  const translateX = useRef(new Animated.Value(0)).current;
  const [activePrice, setActivePrice] = useState(item.price);
  const [showMiniMap, setShowMiniMap] = useState(false);
  const basePrice = parseInt(item.price) || 0;
  const mapRef = useRef<MapView>(null);
  const passRating = item.passengerRating || 5;

  useEffect(() => { setActivePrice(item.price); }, [item.price]);

  const initialMapRegion = item.pickupCoords ? { latitude: item.pickupCoords.latitude, longitude: item.pickupCoords.longitude, latitudeDelta: 0.02, longitudeDelta: 0.02 } : undefined;

  useEffect(() => {
    if (showMiniMap && item.pickupCoords && captainLocation && mapRef.current) {
      setTimeout(() => { mapRef.current?.fitToCoordinates([item.pickupCoords, captainLocation], { edgePadding: { top: 40, right: 40, bottom: 40, left: 40 }, animated: false }); }, 500); 
    }
  }, [showMiniMap, item.pickupCoords, captainLocation]);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dx) > 20 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy),
      onPanResponderMove: (_, gestureState) => { if (gestureState.dx < 0) translateX.setValue(gestureState.dx); },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx < -SCREEN_WIDTH * 0.25) Animated.timing(translateX, { toValue: -SCREEN_WIDTH, duration: 250, useNativeDriver: true }).start(() => onDismiss(item));
        else Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
      }
    })
  ).current;

  const destinationsList = Array.isArray(item.destinationsList) && item.destinationsList.length > 0 ? item.destinationsList : [item.destinationLocation || 'غير محدد'];

  return (
    <View style={styles.swipeContainer}>
      <View style={styles.hiddenBackground}><Text style={styles.hiddenText}>إخفاء الطلب 👁️‍🗨️</Text></View>
      <Animated.View style={[styles.requestCard, { transform: [{ translateX }] }]} {...panResponder.panHandlers}>
        <View style={styles.topSplitContainer}>
          <View style={styles.passengerRightSide}>
            <Image source={{ uri: getSafeAvatar(item.avatar) }} style={styles.passengerAvatar} />
            <Text style={styles.passengerName} numberOfLines={1}>{item.name}</Text>
            <View style={{ flexDirection: 'row-reverse', marginTop: 2, justifyContent: 'center' }}>
              {[1, 2, 3, 4, 5].map((star) => (
                <Text key={star} style={{ fontSize: 11, color: star <= Math.round(passRating) ? '#f59e0b' : '#cbd5e1' }}>★</Text>
              ))}
            </View>
            {item.pickupCoords && captainLocation && (
              <TouchableOpacity style={styles.showMapBtnCard} onPress={() => setShowMiniMap(!showMiniMap)}><Text style={styles.showMapBtnTextCard}>{showMiniMap ? 'إخفاء ⬆️' : '🗺️ خريطة'}</Text></TouchableOpacity>
            )}
          </View>
          <View style={styles.routeLeftSide}>
            <Text style={styles.routeSplitText} numberOfLines={2}>📍 من: {item.pickupLocation}</Text>
            {destinationsList.map((d: string, i: number) => (<Text key={i} style={styles.routeSplitText} numberOfLines={2}>🏁 إلى {i+1}: {d}</Text>))}
            <Text style={styles.routeSplitText}>👥 ركاب: {item.passengers || '1'}</Text>
          </View>
        </View>

        {showMiniMap && item.pickupCoords && (
          <View style={styles.miniMapWrapper} pointerEvents="none">
            <MapView ref={mapRef} style={styles.miniMap} liteMode={Platform.OS === 'android'} scrollEnabled={false} zoomEnabled={false} pitchEnabled={false} rotateEnabled={false} initialRegion={initialMapRegion}>
              {captainLocation && <Marker coordinate={captainLocation} pinColor="blue" title="موقعك" />}
              <Marker coordinate={item.pickupCoords} pinColor="red" title="موقع الراكب" />
            </MapView>
          </View>
        )}
        
        {item.notes && item.notes.trim() !== '' ? (<View style={styles.notesContainer}><Text style={styles.notesText}>📝 الملاحظات: {item.notes}</Text></View>) : null}
        <Text style={styles.largePriceTag}>💰 {activePrice} جنيه</Text>

        {!hasSentOffer && basePrice > 0 && (
          <View style={styles.compactSuggestionsRow}>
            {[1.2, 1.4, 1.6].map((multiplier, index) => {
              const suggestedPrice = Math.round(basePrice * multiplier);
              const isSelected = activePrice === suggestedPrice.toString();
              return (
                <TouchableOpacity key={index} style={[styles.compactSuggestionBtn, isSelected && styles.suggestionBtnActive]} onPress={() => setActivePrice(suggestedPrice.toString())}>
                  <Text style={[styles.suggestionText, isSelected && styles.suggestionTextActive]}>{suggestedPrice} ج</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
        
        {hasSentOffer ? (
          <View style={styles.waitingOfferContainer}><Text style={styles.waitingOfferText}>⏳ عرضك قيد الانتظار...</Text></View>
        ) : (
          <View style={styles.requestActionsRow}>
            <TouchableOpacity style={styles.editPriceBtn} onPress={() => onEditPrice(item)}><Text style={styles.editPriceBtnText}>✏️ تعديل السعر</Text></TouchableOpacity>
            <TouchableOpacity style={styles.acceptBtn} onPress={() => onSendOffer(item, activePrice)}><Text style={styles.acceptBtnText}>✔️ قبول</Text></TouchableOpacity>
          </View>
        )}
      </Animated.View>
    </View>
  );
};

export default function CaptainHome() {
  const router = useRouter();
  const [isOnline, setIsOnline] = useState(false);
  const toggleAnim = useRef(new Animated.Value(0)).current; 

  const [allRequests, setAllRequests] = useState<any[]>([]); 
  const [dismissedRequests, setDismissedRequests] = useState<Record<string, any>>({}); 
  const [sentOffers, setSentOffers] = useState<string[]>([]); 
  const [activeRide, setActiveRide] = useState<any>(null);
  const [captainLocation, setCaptainLocation] = useState<any>(null); 
  
  const [isPriceModalVisible, setIsPriceModalVisible] = useState(false);
  const [selectedRideForPrice, setSelectedRideForPrice] = useState<any>(null);
  const [tempCaptainPrice, setTempCaptainPrice] = useState('');

  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [latestMessage, setLatestMessage] = useState(''); 
  const toastOpacity = useRef(new Animated.Value(0)).current; 
  const toastTranslateY = useRef(new Animated.Value(-10)).current; 
  const [toastVisible, setToastVisible] = useState(false);
  const prevUnreadRef = useRef(0);
  const toastTimer = useRef<any>(null);
  const chatPulseAnim = useRef(new Animated.Value(0)).current;

  const [adminMessage, setAdminMessage] = useState<any>(null);
  const [isAdminMsgVisible, setIsAdminMsgVisible] = useState(false);

  const [isCallModalVisible, setIsCallModalVisible] = useState(false);
  const [phoneToCall, setPhoneToCall] = useState('');

  const [isRatingModalVisible, setIsRatingModalVisible] = useState(false);
  const [rating, setRating] = useState(0);
  const [ratingReason, setRatingReason] = useState('');
  const [ratingSubmitted, setRatingSubmitted] = useState(false);
  const [rideToRate, setRideToRate] = useState<any>(null);

  // تحديث البروفايل ليشمل تصنيف المركبة
  const [captainProfile, setCaptainProfile] = useState({ id: '', name: 'كابتن...', phone: '', vehicle: 'توكتوك', vehicleCategory: 'tuktuk_alt', avatar: 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png', walletBalance: 0, averageRating: 5, ratingCount: 0 });

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const sidebarAnim = useRef(new Animated.Value(SCREEN_WIDTH)).current;

  const generateAndShowQR = async () => {
    if (!activeRide) return;
    const uniqueSecret = Math.random().toString(36).substring(2, 12);
    try {
      await updateDoc(doc(db, 'rides', activeRide.id), { 
        status: 'waiting_for_scan',
        qrSecret: uniqueSecret
      });
    } catch (e) { Alert.alert("خطأ", "تأكد من اتصالك بالإنترنت."); }
  };

  const cancelQRScan = async () => {
    if (!activeRide) return;
    try {
      await updateDoc(doc(db, 'rides', activeRide.id), { status: 'captain_arrived', qrSecret: null });
    } catch (e) {}
  };

  const openSidebar = () => { setIsSidebarOpen(true); Animated.timing(sidebarAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start(); };
  const closeSidebar = () => { Animated.timing(sidebarAnim, { toValue: SCREEN_WIDTH, duration: 300, useNativeDriver: true }).start(() => setIsSidebarOpen(false)); };

  const toggleOnlineStatus = async () => {
    const newState = !isOnline;
    setIsOnline(newState);
    Animated.timing(toggleAnim, { toValue: newState ? 1 : 0, duration: 250, useNativeDriver: false }).start();
    if (captainProfile.id) { try { await updateDoc(doc(db, 'captains', captainProfile.id), { isOnline: newState }); } catch (error) {} }
  };

  useFocusEffect(useCallback(() => { loadCaptainProfileFromFirebase(); loadDismissedRequests(); getCaptainLocation(); }, []));

  const getCaptainLocation = async () => {
    let { status } = await Location.requestForegroundPermissionsAsync();
    if (status === 'granted') { try { let loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }); setCaptainLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude }); } catch (e) {} }
  };

  const loadCaptainProfileFromFirebase = async () => {
    try {
      const captainId = await AsyncStorage.getItem('currentCaptainId');
      if (captainId) {
        const docRef = doc(db, 'captains', captainId);
        const docSnap = await getDoc(docRef);
        const ratingQ = query(collection(db, 'ratings'), where('captainId', '==', captainId));
        const ratingSnap = await getDocs(ratingQ);
        let sum = 0;
        ratingSnap.docs.forEach(r => sum += (r.data().rating || 5));
        const rCount = ratingSnap.docs.length;
        const avgRate = rCount > 0 ? (sum / rCount).toFixed(1) : 5;

        if (docSnap.exists()) {
          const data = docSnap.data();
          const finalAvatar = getSafeAvatar(data.profileImage || data.avatar || data.image);
          // دمج التصنيف في بيانات الكابتن
          setCaptainProfile({ id: captainId, name: data.name || 'كابتن', phone: data.phone || '', vehicle: data.tukTukNumber || data.vehicle || 'توكتوك', vehicleCategory: data.vehicleCategory || 'tuktuk_alt', avatar: finalAvatar, walletBalance: data.walletBalance || 0, averageRating: Number(avgRate), ratingCount: rCount });
          if (data.isOnline !== undefined) { setIsOnline(data.isOnline); toggleAnim.setValue(data.isOnline ? 1 : 0); }
        }
      } else router.replace('/captain-login');
    } catch (e) {}
  };

  const loadDismissedRequests = async () => {
    try { const savedDismissed = await AsyncStorage.getItem('dismissed_requests'); if (savedDismissed) setDismissedRequests(JSON.parse(savedDismissed)); } catch (e) {}
  };

  useEffect(() => {
    if (!captainProfile.id) return;
    const q = query(collection(db, 'notifications'), where('userId', '==', captainProfile.id), where('read', '==', false));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) { setAdminMessage({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() }); setIsAdminMsgVisible(true); }
    });
    return () => unsubscribe();
  }, [captainProfile.id]);

  const markAdminMessageAsRead = async () => {
    if (adminMessage && adminMessage.id) {
      try { await updateDoc(doc(db, 'notifications', adminMessage.id), { read: true }); setIsAdminMsgVisible(false); setAdminMessage(null); } catch (error) {}
    }
  };

  // فلترة الطلبات لتظهر للكابتن المناسب حسب نوع مركبته
  useEffect(() => {
    if (!isOnline) { setAllRequests([]); return; }
    const q = query(collection(db, 'rides'), where('status', '==', 'pending'));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const pendingRequests: any[] = [];
      const currentTime = new Date().getTime();
      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        
        // جلب نوع المركبة المطلوب (بديل التوكتوك هو الافتراضي لو مفيش)
        const rideVehicleType = data.requestedVehicleType || 'tuktuk_alt';
        
        // التحقق إن الطلب مطابق لنوع مركبة الكابتن
        if (rideVehicleType === captainProfile.vehicleCategory) {
          if (data.timestamp && (currentTime - data.timestamp < 900000)) {
            pendingRequests.push({ id: docSnap.id, ...data });
          }
        }
      });
      pendingRequests.sort((a, b) => b.timestamp - a.timestamp);
      setAllRequests(pendingRequests);
    });
    return () => unsubscribe();
  }, [isOnline, captainProfile.vehicleCategory]);

  useEffect(() => {
    if (!captainProfile.id) return;
    const q = query(collection(db, 'rides'), where('captainId', '==', captainProfile.id));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      const active = docs.find(d => ['accepted', 'captain_arrived', 'passenger_on_the_way', 'waiting_for_scan', 'in_progress'].includes(d.status));
      if (active) {
        setActiveRide(active); setUnreadChatCount(active.unreadCountCaptain || 0);
      } else {
        setActiveRide((prev: any) => { if (prev && docs.find(d => d.id === prev.id && d.status === 'canceled')) Alert.alert('تنبيه', 'الراكب قام بإلغاء الرحلة.'); return null; });
      }
    });
    return () => unsubscribe();
  }, [captainProfile.id]);

  useEffect(() => {
    if (!activeRide?.id) return;
    const q = query(collection(db, 'rides', activeRide.id, 'messages'), orderBy('timestamp', 'desc'), limit(1));
    const unsubscribeMsgs = onSnapshot(q, (snap) => {
      if (!snap.empty) {
        const msg = snap.docs[0].data();
        if (msg.sender === 'passenger') {
          setLatestMessage(msg.text);
        }
      }
    });
    return () => unsubscribeMsgs();
  }, [activeRide?.id]);

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

  const chatBackgroundColor = chatPulseAnim.interpolate({ inputRange: [0, 1], outputRange: ['#8b5cf6', '#0f172a'] });

  const sendOffer = async (ride: any, offerPrice: string) => {
    try {
      const safeAvatar = getSafeAvatar(captainProfile.avatar);
      const cleanOfferData = { 
        captainId: String(captainProfile.id), captainName: String(captainProfile.name), 
        captainPhone: String(captainProfile.phone), captainVehicle: String(captainProfile.vehicle), 
        captainAvatar: safeAvatar, price: String(offerPrice), captainRating: captainProfile.averageRating, captainRatingCount: captainProfile.ratingCount
      };
      await updateDoc(doc(db, 'rides', ride.id), { price: String(offerPrice), offers: arrayUnion(cleanOfferData) });
      setSentOffers(prev => [...prev, ride.id]);
    } catch (error) {}
  };

  const openPriceModal = (ride: any) => { setSelectedRideForPrice(ride); setTempCaptainPrice(ride.price ? ride.price.toString() : ''); setIsPriceModalVisible(true); };
  const confirmCustomPrice = () => {
    const originalPrice = parseInt(selectedRideForPrice?.price || '0');
    const newPrice = parseInt(tempCaptainPrice);
    if (!tempCaptainPrice || newPrice <= 0) return;
    if (newPrice < originalPrice) { Alert.alert('غير مسموح 🛑', 'لا يمكنك إرسال عرض أقل من سعر الراكب.'); return; }
    sendOffer(selectedRideForPrice, tempCaptainPrice); setIsPriceModalVisible(false);
  };

  const notifyArrival = async () => { if (activeRide) await updateDoc(doc(db, 'rides', activeRide.id), { status: 'captain_arrived' }); };
  const completeRide = async () => { if (!activeRide) return; setRideToRate(activeRide); await updateDoc(doc(db, 'rides', activeRide.id), { status: 'completed' }); setActiveRide(null); setIsRatingModalVisible(true); };
  
  const openGoogleMaps = (locationName: string) => {
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(locationName)}`;
    Linking.openURL(url);
  };

  const submitRating = async () => {
    if (rating === 0) return;
    try {
      await addDoc(collection(db, 'ratings'), { rideId: rideToRate?.id, captainId: captainProfile.id, passengerId: rideToRate?.passengerId, rating: rating, reason: ratingReason || 'ممتاز', timestamp: new Date().getTime(), type: 'captain_rating_passenger' });
      setRatingSubmitted(true);
      setTimeout(() => { setIsRatingModalVisible(false); setRating(0); setRatingReason(''); setRatingSubmitted(false); setRideToRate(null); }, 2000);
    } catch (error) {}
  };

  const cancelRideByCaptain = async () => { if (activeRide) { await updateDoc(doc(db, 'rides', activeRide.id), { status: 'pending', captainId: null, offers: [] }); handleDismissRequest(activeRide); setActiveRide(null); } };
  
  const handleCallClick = () => { if (activeRide) { setPhoneToCall(activeRide.phone || activeRide.passengerPhone); setIsCallModalVisible(true); } };
  const makeRegularCall = () => { setIsCallModalVisible(false); Linking.openURL(`tel:${phoneToCall}`); };
  const makeFreeCall = () => { setIsCallModalVisible(false); Alert.alert('مكالمة مجانية', 'تتطلب ربط التطبيق بخدمة اتصالات خارجية.'); };

  const handleLogout = async () => { await AsyncStorage.removeItem('currentCaptainId'); router.replace('/captain-login'); };
  const handleDismissRequest = async (item: any) => { const newDismissed = { ...dismissedRequests, [item.id]: { price: item.price, pickupLocation: item.pickupLocation, destinationLocation: item.destinationLocation } }; setDismissedRequests(newDismissed); await AsyncStorage.setItem('dismissed_requests', JSON.stringify(newDismissed)); };
  
  const displayRequests = allRequests.filter(req => {
    const dismissedInfo = dismissedRequests[req.id];
    if (!dismissedInfo) return true;
    return req.price !== dismissedInfo.price || req.pickupLocation !== dismissedInfo.pickupLocation || req.destinationLocation !== dismissedInfo.destinationLocation;
  });

  return (
    <View style={styles.container}>
      {toastVisible && (
        <Animated.View style={[styles.toastContainer, { opacity: toastOpacity, transform: [{ translateY: toastTranslateY }] }]}>
          <Text style={styles.toastText}>💬 رسالة جديدة من الراكب</Text>
        </Animated.View>
      )}

      <View style={styles.header}>
        <View style={styles.userInfo}>
          <TouchableOpacity style={styles.profileClickable} onPress={() => router.push('/captain-profile')}>
            <Image source={{ uri: captainProfile.avatar }} style={styles.profileAvatar} />
            <View>
              <Text style={styles.headerCaptainName} numberOfLines={1}>{captainProfile.name ? captainProfile.name.split(' ')[0] : 'كابتن'}</Text>
              <View style={{ flexDirection: 'row-reverse', marginTop: 2, marginRight: 6 }}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <Text key={star} style={{ fontSize: 13, color: star <= Math.round(captainProfile.averageRating) ? '#f59e0b' : '#cbd5e1' }}>★</Text>
                ))}
              </View>
            </View>
          </TouchableOpacity>
          <TouchableOpacity style={styles.walletDisplayContainer} onPress={() => router.push('/captain-wallet')}>
            <Text style={styles.walletTitle}>المحفظة</Text>
            <Text style={[styles.walletAmount, { color: '#10b981' }]}>{captainProfile.walletBalance ? captainProfile.walletBalance.toFixed(2) : '0.00'} ج</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity activeOpacity={0.9} style={[styles.toggleContainer, { backgroundColor: isOnline ? '#10b981' : '#ef4444', borderColor: isOnline ? '#10b981' : '#ef4444' }]} onPress={toggleOnlineStatus}>
          <Text style={[styles.toggleText, isOnline ? { marginLeft: 26 } : { marginRight: 26 }]}>{isOnline ? 'متصل' : 'غير متصل'}</Text>
          <Animated.View style={[styles.toggleCircle, { transform: [{ translateX: toggleAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -56] }) }] }]} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.headerMenuBtn} onPress={openSidebar}><Text style={styles.headerMenuText}>☰</Text></TouchableOpacity>
      </View>

      {!activeRide ? (
        <>
          <Text style={styles.sectionTitle}>الطلبات المتاحة حالياً 📡</Text>
          {!isOnline ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>أنت الآن غير متصل 📴</Text>
              <Text style={{fontSize: 13, color: '#94a3b8', marginTop: 5}}>فعل زر الاتصال بالأعلى لاستقبال الطلبات</Text>
            </View>
          ) : displayRequests.length === 0 ? (
            <View style={styles.emptyState}><Text style={styles.emptyText}>لا توجد طلبات في الوقت الحالي، خليك جاهز!</Text></View>
          ) : (
            <FlatList data={displayRequests} keyExtractor={(item) => item.id} renderItem={({ item }) => <SwipeableRequestItem item={item} onSendOffer={sendOffer} onEditPrice={openPriceModal} onDismiss={handleDismissRequest} hasSentOffer={sentOffers.includes(item.id)} captainLocation={captainLocation} />} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }} />
          )}
        </>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
          <View style={[styles.activeRideContainer, (activeRide.status === 'passenger_on_the_way' || activeRide.status === 'in_progress') && styles.activeRidePulseContainer]}>
            
            <Text style={styles.activeRideTitle}>
              {activeRide.status === 'accepted' ? '🛺 أنت الآن في طريقك للراكب' : 
               activeRide.status === 'passenger_on_the_way' ? '✅ الراكب نازل الآن!' : 
               activeRide.status === 'captain_arrived' ? '🔔 لقد وصلت للراكب' : 
               activeRide.status === 'waiting_for_scan' ? '📱 بانتظار مسح الـ QR' :
               '▶️ الرحلة جارية الآن'}
            </Text>

            {toastVisible && latestMessage ? (
              <Animated.View style={[styles.inlineToast, { opacity: toastOpacity, transform: [{ translateY: toastTranslateY }] }]}>
                <Text style={styles.inlineToastText} numberOfLines={2}>💬 {latestMessage}</Text>
              </Animated.View>
            ) : null}

            <View style={styles.passengerCard}>
              <Image source={{ uri: activeRide.avatar || 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png' }} style={styles.activeAvatar} />
              <View style={styles.detailsCol}>
                <Text style={styles.detailsText}>👤 الراكب: {activeRide.name}</Text>
                <View style={{ flexDirection: 'row-reverse', justifyContent: 'flex-start', marginBottom: 4 }}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Text key={star} style={{ fontSize: 14, color: star <= Math.round(activeRide.passengerRating || 5) ? '#f59e0b' : '#cbd5e1' }}>★</Text>
                  ))}
                </View>
                <Text style={styles.phoneText}>📞 {activeRide.phone || activeRide.passengerPhone || 'غير مسجل'}</Text>
              </View>
            </View>

            {activeRide.status !== 'in_progress' ? (
              <View style={styles.tripRouteContainer}>
                <Text style={styles.routeTextActive}>📍 الانطلاق: {activeRide.pickupLocation}</Text>
                <Text style={styles.priceTagActive}>💰 الأجرة: {activeRide.price} جنيه</Text>
              </View>
            ) : (
              <View style={styles.navigationContainer}>
                <Text style={styles.navigationHeader}>🗺️ مسار الرحلة (اضغط للتتبع):</Text>
                {activeRide.destinationsList && activeRide.destinationsList.map((d:string, i:number) => (
                  <TouchableOpacity key={i} style={styles.navButton} onPress={() => openGoogleMaps(d)}>
                    <View style={{flex: 1}}>
                      <Text style={styles.navButtonTitle}>الوجهة {i+1}:</Text>
                      <Text style={styles.navButtonText}>{d}</Text>
                    </View>
                    <Text style={styles.navIcon}>🧭 تتبع</Text>
                  </TouchableOpacity>
                ))}
                <Text style={styles.priceTagActive}>💰 الأجرة المستحقة لك: {activeRide.price} جنيه</Text>
              </View>
            )}

            <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 15 }}>
              <TouchableOpacity style={[styles.actionBtnCall, { flex: 1, marginLeft: 5 }]} onPress={handleCallClick}><Text style={styles.actionBtnText}>📞 اتصال</Text></TouchableOpacity>
              <AnimatedTouchableOpacity style={[styles.actionBtnChat, { flex: 1, marginRight: 5, backgroundColor: unreadChatCount > 0 ? chatBackgroundColor : '#8b5cf6' }]} onPress={() => router.push({ pathname: '/chat', params: { senderType: 'captain', rideId: activeRide.id } })}>
                <Text style={styles.actionBtnText}>💬 مراسلة</Text>
                {unreadChatCount > 0 && <View style={styles.badgeContainer}><Text style={styles.badgeText}>{unreadChatCount}</Text></View>}
              </AnimatedTouchableOpacity>
            </View>

            {activeRide.status === 'accepted' ? (
              <TouchableOpacity style={styles.arriveButton} onPress={notifyArrival}><Text style={styles.arriveButtonText}>📍 إبلاغ بالوصول</Text></TouchableOpacity>
            ) : activeRide.status === 'captain_arrived' || activeRide.status === 'passenger_on_the_way' ? (
              <TouchableOpacity style={styles.startButton} onPress={generateAndShowQR}>
                <Text style={styles.startButtonText}>▶️ ابدأ الرحلة (تأكيد QR)</Text>
              </TouchableOpacity>
            ) : activeRide.status === 'in_progress' ? (
              <TouchableOpacity style={styles.completeButton} onPress={completeRide}><Text style={styles.completeButtonText}>✅ إنهاء المشوار واستلام الكاش</Text></TouchableOpacity>
            ) : null}

            {(activeRide.status !== 'in_progress' && activeRide.status !== 'waiting_for_scan') && (
               <TouchableOpacity style={styles.cancelRideBtn} onPress={() => Alert.alert('تأكيد', 'التراجع عن الرحلة؟', [{text:'لا'},{text:'نعم', onPress: cancelRideByCaptain}])}>
                 <Text style={styles.cancelRideBtnText}>❌ التراجع عن الرحلة</Text>
               </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      )}

      <Modal visible={activeRide?.status === 'waiting_for_scan'} transparent={true} animationType="slide">
        <View style={styles.modalOverlayQR}>
          <View style={styles.qrModalContent}>
            <Text style={styles.qrTitle}>أمان الرحلة 🔒</Text>
            <Text style={styles.qrSubtitle}>اطلب من الراكب مسح هذا الكود من تطبيقه لتبدأ الرحلة بشكل آمن.</Text>
            <View style={styles.qrBox}>
              {activeRide && activeRide.qrSecret && (
                <QRCode value={JSON.stringify({ rideId: activeRide.id, token: activeRide.qrSecret })} size={200} />
              )}
            </View>
            <ActivityIndicator size="small" color="#2563eb" style={{marginTop: 15}} />
            <Text style={styles.qrWaitingText}>في انتظار مسح الكود...</Text>
            <TouchableOpacity style={styles.qrCancelBtn} onPress={cancelQRScan}><Text style={styles.qrCancelBtnText}>إلغاء والعودة</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={isSidebarOpen} transparent={true} animationType="none" onRequestClose={closeSidebar}>
        <View style={styles.sidebarOverlay}>
          <TouchableOpacity style={styles.sidebarCloseArea} onPress={closeSidebar} activeOpacity={1} />
          <Animated.View style={[styles.sidebarPanel, { transform: [{ translateX: sidebarAnim }] }]}>
            <View style={styles.sidebarHeader}>
              <Image source={{ uri: captainProfile.avatar }} style={styles.sidebarAvatar} />
              <Text style={styles.sidebarName}>{captainProfile.name}</Text>
              <Text style={styles.sidebarPhone}>{captainProfile.phone}</Text>
            </View>
            <ScrollView style={styles.sidebarLinks}>
              <TouchableOpacity style={styles.sidebarLink} onPress={() => { closeSidebar(); router.push('/captain-wallet'); }}><Text style={styles.sidebarLinkText}>💰 الأرباح والمحفظة</Text></TouchableOpacity>
              <TouchableOpacity style={styles.sidebarLink} onPress={() => { closeSidebar(); router.push('/captain-history'); }}><Text style={styles.sidebarLinkText}>📜 سجل الرحلات</Text></TouchableOpacity>
              <TouchableOpacity style={styles.sidebarLink} onPress={() => { closeSidebar(); router.push('/captain-docs'); }}><Text style={styles.sidebarLinkText}>📄 المستندات الرسمية</Text></TouchableOpacity>
              <TouchableOpacity style={styles.sidebarLink} onPress={() => { closeSidebar(); Alert.alert('قريباً', 'سيتم تفعيل الإعدادات.'); }}><Text style={styles.sidebarLinkText}>⚙️ الإعدادات</Text></TouchableOpacity>
              <TouchableOpacity style={styles.sidebarLink} onPress={() => { closeSidebar(); router.push('/support'); }}><Text style={styles.sidebarLinkText}>🎧 الدعم الفني</Text></TouchableOpacity>
            </ScrollView>
            <TouchableOpacity style={styles.sidebarLogoutBtn} onPress={handleLogout}><Text style={styles.sidebarLogoutText}>🚪 تسجيل الخروج</Text></TouchableOpacity>
          </Animated.View>
        </View>
      </Modal>

      <Modal visible={isAdminMsgVisible} transparent={true} animationType="fade">
        <View style={styles.modalOverlayAdmin}><View style={styles.adminMsgModalContent}><Text style={styles.adminMsgIcon}>📩</Text><Text style={styles.adminMsgAlertText}>رسالة من الإدارة</Text><Text style={styles.adminMsgTitle}>{adminMessage?.title}</Text><Text style={styles.adminMsgText}>{adminMessage?.message}</Text><TouchableOpacity style={styles.adminMsgCloseBtn} onPress={markAdminMessageAsRead}><Text style={styles.adminMsgCloseText}>حسناً، قرأتها</Text></TouchableOpacity></View></View>
      </Modal>
      <Modal visible={isPriceModalVisible} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}><View style={styles.modalContent}><Text style={styles.modalTitle}>✏️ تقديم عرض سعر</Text><TextInput style={styles.modalInput} value={tempCaptainPrice} onChangeText={setTempCaptainPrice} keyboardType="numeric" /><View style={styles.modalButtonsRow}><TouchableOpacity style={styles.modalSaveBtn} onPress={confirmCustomPrice}><Text style={styles.modalSaveBtnText}>إرسال العرض</Text></TouchableOpacity><TouchableOpacity style={styles.modalCancelBtn} onPress={() => setIsPriceModalVisible(false)}><Text style={styles.modalCancelBtnText}>إلغاء</Text></TouchableOpacity></View></View></View>
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
      
      <Modal visible={isRatingModalVisible} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}><View style={styles.ratingModalContent}>
          {!ratingSubmitted ? (<><Text style={styles.modalTitle}>تقييم الراكب</Text><View style={styles.starsRow}>{[1,2,3,4,5].map(s => (<TouchableOpacity key={s} onPress={() => setRating(s)}><Text style={[styles.starText, {color: s <= rating ? '#f59e0b' : '#cbd5e1'}]}>★</Text></TouchableOpacity>))}</View><TextInput style={styles.reasonInput} placeholder="سبب التقييم؟" value={ratingReason} onChangeText={setRatingReason} /><TouchableOpacity style={styles.submitRatingBtn} onPress={submitRating}><Text style={styles.submitRatingBtnText}>إرسال</Text></TouchableOpacity></>) : (<View style={styles.successRatingContainer}><Text style={styles.successRatingIcon}>✅</Text><Text style={styles.successRatingText}>تم التقييم بنجاح</Text></View>)}
        </View></View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9', padding: 15, paddingTop: 40 },
  header: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#ffffff', padding: 12, borderRadius: 16, marginBottom: 20, elevation: 2 },
  userInfo: { flexDirection: 'row-reverse', alignItems: 'center' },
  profileClickable: { flexDirection: 'row-reverse', alignItems: 'center' },
  profileAvatar: { width: 45, height: 45, borderRadius: 22.5, backgroundColor: '#cbd5e1' },
  headerCaptainName: { fontSize: 13, fontWeight: 'bold', color: '#1e293b', marginRight: 6, maxWidth: 70, textAlign: 'right' },
  walletDisplayContainer: { marginRight: 15, alignItems: 'flex-end', borderRightWidth: 1, borderColor: '#e2e8f0', paddingRight: 10 },
  walletTitle: { fontSize: 12, color: '#64748b', fontWeight: 'bold' },
  walletAmount: { fontSize: 14, fontWeight: 'bold' },
  toggleContainer: { width: 90, height: 34, borderRadius: 17, flexDirection: 'row-reverse', alignItems: 'center', paddingHorizontal: 4, justifyContent: 'center', borderWidth: 1.5, borderColor: '#e2e8f0' },
  toggleText: { color: '#ffffff', fontSize: 11, fontWeight: 'bold', zIndex: 1 },
  toggleCircle: { position: 'absolute', right: 4, width: 26, height: 26, borderRadius: 13, backgroundColor: '#ffffff', elevation: 3 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#1e293b', marginBottom: 15, textAlign: 'right' },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { fontSize: 16, color: '#64748b', textAlign: 'center', fontWeight: 'bold' },
  
  toastContainer: { position: 'absolute', top: 50, alignSelf: 'center', backgroundColor: '#1e293b', paddingVertical: 12, paddingHorizontal: 25, borderRadius: 30, zIndex: 9999, elevation: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 5 },
  toastText: { color: '#ffffff', fontSize: 15, fontWeight: 'bold' },
  inlineToast: { backgroundColor: '#1e293b', paddingVertical: 10, paddingHorizontal: 15, borderRadius: 12, marginBottom: 10, width: '100%', flexDirection: 'row-reverse', alignItems: 'center', elevation: 3 },
  inlineToastText: { color: '#ffffff', fontSize: 14, fontWeight: 'bold', textAlign: 'right', flex: 1 },
  badgeContainer: { position: 'absolute', top: -8, right: -8, backgroundColor: '#ef4444', minWidth: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center', zIndex: 10, borderWidth: 2, borderColor: '#ffffff' },
  badgeText: { color: '#ffffff', fontSize: 12, fontWeight: 'bold' },

  swipeContainer: { position: 'relative', marginBottom: 12 },
  hiddenBackground: { ...StyleSheet.absoluteFillObject, backgroundColor: '#fee2e2', borderRadius: 16, justifyContent: 'center', alignItems: 'flex-end', paddingRight: 20 },
  hiddenText: { color: '#ef4444', fontWeight: 'bold', fontSize: 16 },
  requestCard: { backgroundColor: '#ffffff', padding: 12, borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', elevation: 3 },
  topSplitContainer: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  passengerRightSide: { width: 85, alignItems: 'center', borderLeftWidth: 1, borderColor: '#f1f5f9', paddingLeft: 8 },
  passengerAvatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#cbd5e1', marginBottom: 4 },
  passengerName: { fontSize: 13, fontWeight: 'bold', color: '#0f172a', textAlign: 'center' },
  showMapBtnCard: { backgroundColor: '#e0f2fe', paddingVertical: 4, paddingHorizontal: 6, borderRadius: 6, borderWidth: 1, borderColor: '#bae6fd', marginTop: 4 },
  showMapBtnTextCard: { color: '#0369a1', fontSize: 10, fontWeight: 'bold' },
  routeLeftSide: { flex: 1, paddingRight: 10, justifyContent: 'center' },
  routeSplitText: { fontSize: 15, color: '#1e293b', fontWeight: 'bold', marginBottom: 2, textAlign: 'right' },
  miniMapWrapper: { height: 120, width: '100%', borderRadius: 12, overflow: 'hidden', marginBottom: 10, borderWidth: 1, borderColor: '#e2e8f0' },
  miniMap: { ...StyleSheet.absoluteFillObject },
  notesContainer: { backgroundColor: '#fef3c7', padding: 8, borderRadius: 8, marginBottom: 8, borderWidth: 1, borderColor: '#fcd34d' },
  notesText: { fontSize: 13, color: '#d97706', fontWeight: 'bold', textAlign: 'right' },
  largePriceTag: { fontSize: 22, color: '#10b981', fontWeight: 'bold', textAlign: 'center', marginBottom: 10 },
  compactSuggestionsRow: { flexDirection: 'row-reverse', justifyContent: 'center', gap: 8, marginBottom: 12 },
  compactSuggestionBtn: { backgroundColor: '#fef08a', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: '#fde047', minWidth: 60 },
  suggestionBtnActive: { backgroundColor: '#eab308', borderColor: '#ca8a04' },
  suggestionText: { fontSize: 15, fontWeight: 'bold', color: '#1e293b' },
  suggestionTextActive: { color: '#ffffff' },
  waitingOfferContainer: { backgroundColor: '#fef3c7', padding: 10, borderRadius: 8, alignItems: 'center' },
  waitingOfferText: { color: '#d97706', fontWeight: 'bold', fontSize: 14 },
  requestActionsRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', gap: 10 },
  editPriceBtn: { flex: 1, backgroundColor: '#f59e0b', paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  editPriceBtnText: { color: '#ffffff', fontSize: 14, fontWeight: 'bold' },
  acceptBtn: { flex: 1, backgroundColor: '#2563eb', paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  acceptBtnText: { color: '#ffffff', fontSize: 14, fontWeight: 'bold' },
  scrollContainer: { flexGrow: 1, paddingBottom: 20 },
  activeRideContainer: { backgroundColor: '#ffffff', padding: 20, borderRadius: 20, borderWidth: 2, borderColor: '#2563eb', elevation: 6 },
  activeRidePulseContainer: { backgroundColor: '#ecfdf5', borderColor: '#059669' },
  activeRideTitle: { fontSize: 18, fontWeight: 'bold', color: '#2563eb', textAlign: 'center', marginBottom: 20 },
  passengerCard: { flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: '#eff6ff', padding: 12, borderRadius: 14, marginBottom: 15 },
  activeAvatar: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#cbd5e1', marginLeft: 15 },
  detailsCol: { flex: 1 },
  detailsText: { fontSize: 14, fontWeight: 'bold', color: '#1e293b', marginBottom: 4, textAlign: 'right' },
  phoneText: { fontSize: 14, fontWeight: 'bold', color: '#2563eb', marginBottom: 2, textAlign: 'right', marginTop: 3 },
  tripRouteContainer: { backgroundColor: '#f8fafc', padding: 12, borderRadius: 10, marginBottom: 15, borderWidth: 1, borderColor: '#e2e8f0' },
  routeTextActive: { fontSize: 14, color: '#334155', fontWeight: 'bold', marginBottom: 4, textAlign: 'right' },
  priceTagActive: { fontSize: 16, color: '#10b981', fontWeight: 'bold', marginTop: 4, textAlign: 'center' },
  
  actionBtnCall: { backgroundColor: '#10b981', paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  actionBtnChat: { backgroundColor: '#8b5cf6', paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  actionBtnText: { color: '#ffffff', fontSize: 15, fontWeight: 'bold' },
  
  arriveButton: { backgroundColor: '#f59e0b', paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginBottom: 10 },
  arriveButtonText: { color: '#ffffff', fontSize: 16, fontWeight: 'bold' },
  startButton: { backgroundColor: '#8b5cf6', paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginBottom: 10 },
  startButtonText: { color: '#ffffff', fontSize: 16, fontWeight: 'bold' },
  completeButton: { backgroundColor: '#2563eb', paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  completeButtonText: { color: '#ffffff', fontSize: 16, fontWeight: 'bold' },
  cancelRideBtn: { backgroundColor: '#fee2e2', paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginTop: 10 },
  cancelRideBtnText: { color: '#ef4444', fontSize: 16, fontWeight: 'bold' },
  
  navigationContainer: { backgroundColor: '#f0fdf4', padding: 15, borderRadius: 12, marginBottom: 15, borderWidth: 1, borderColor: '#bbf7d0' },
  navigationHeader: { fontSize: 15, fontWeight: 'bold', color: '#166534', marginBottom: 10, textAlign: 'right' },
  navButton: { flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: '#ffffff', padding: 12, borderRadius: 10, marginBottom: 8, borderWidth: 1, borderColor: '#86efac', elevation: 1 },
  navButtonTitle: { fontSize: 12, color: '#166534', fontWeight: 'bold', textAlign: 'right' },
  navButtonText: { fontSize: 15, color: '#1e293b', fontWeight: 'bold', textAlign: 'right', marginTop: 2 },
  navIcon: { fontSize: 14, fontWeight: 'bold', color: '#ffffff', backgroundColor: '#22c55e', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, overflow: 'hidden' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { backgroundColor: '#ffffff', width: '100%', padding: 20, borderRadius: 20, elevation: 5 },
  callModalContent: { backgroundColor: '#ffffff', width: '85%', padding: 20, borderRadius: 20, elevation: 5, alignItems: 'center' },
  
  ratingModalContent: { backgroundColor: '#ffffff', width: '95%', padding: 25, borderRadius: 24, elevation: 5, alignItems: 'center' },
  starsRow: { flexDirection: 'row-reverse', justifyContent: 'center', marginVertical: 15, gap: 10 },
  starText: { fontSize: 45 },
  reasonInput: { width: '100%', backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 12, padding: 12, fontSize: 14, marginBottom: 15, color: '#0f172a', textAlign: 'right', minHeight: 80 },
  submitRatingBtn: { backgroundColor: '#2563eb', width: '100%', paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginTop: 5 },
  submitRatingBtnText: { color: '#ffffff', fontSize: 16, fontWeight: 'bold' },
  successRatingContainer: { alignItems: 'center', paddingVertical: 20 },
  successRatingIcon: { fontSize: 50, marginBottom: 15 },
  successRatingText: { fontSize: 18, fontWeight: 'bold', color: '#1e293b', textAlign: 'center', lineHeight: 28 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#1e293b', marginBottom: 10, textAlign: 'center' },
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
  
  modalOverlayQR: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  qrModalContent: { backgroundColor: '#ffffff', width: '90%', padding: 30, borderRadius: 24, alignItems: 'center', elevation: 10 },
  qrTitle: { fontSize: 22, fontWeight: 'bold', color: '#1e293b', marginBottom: 10 },
  qrSubtitle: { fontSize: 14, color: '#64748b', textAlign: 'center', marginBottom: 25, lineHeight: 22 },
  qrBox: { padding: 15, backgroundColor: '#f8fafc', borderRadius: 16, borderWidth: 2, borderColor: '#e2e8f0' },
  qrWaitingText: { marginTop: 10, color: '#475569', fontSize: 14, fontWeight: 'bold' },
  qrCancelBtn: { marginTop: 25, paddingVertical: 12, paddingHorizontal: 25, backgroundColor: '#fee2e2', borderRadius: 10 },
  qrCancelBtnText: { color: '#ef4444', fontWeight: 'bold', fontSize: 15 },
  modalOverlayAdmin: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  adminMsgModalContent: { backgroundColor: '#ffffff', width: '100%', padding: 25, borderRadius: 20, alignItems: 'center', elevation: 10, borderWidth: 2, borderColor: '#eab308' },
  adminMsgIcon: { fontSize: 50, marginBottom: 10 },
  adminMsgAlertText: { color: '#ef4444', fontSize: 14, fontWeight: 'bold', marginBottom: 5 },
  adminMsgTitle: { color: '#1e293b', fontSize: 20, fontWeight: 'bold', textAlign: 'center', marginBottom: 15 },
  adminMsgText: { color: '#334155', fontSize: 16, textAlign: 'center', lineHeight: 24, marginBottom: 25 },
  adminMsgCloseBtn: { backgroundColor: '#eab308', width: '100%', paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  adminMsgCloseText: { color: '#000000', fontSize: 16, fontWeight: 'bold' },
  headerMenuBtn: { padding: 8, backgroundColor: '#f8fafc', borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0', marginLeft: 10 },
  headerMenuText: { fontSize: 20, color: '#1e293b' },
  sidebarOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', flexDirection: 'row' },
  sidebarCloseArea: { flex: 1 },
  sidebarPanel: { width: '75%', backgroundColor: '#ffffff', height: '100%', elevation: 15, shadowColor: '#000', shadowOffset: { width: -3, height: 0 }, shadowOpacity: 0.3, shadowRadius: 5 },
  sidebarHeader: { backgroundColor: '#1e293b', padding: 20, paddingTop: 50, alignItems: 'center', borderBottomWidth: 3, borderColor: '#eab308' },
  sidebarAvatar: { width: 80, height: 80, borderRadius: 40, borderWidth: 2, borderColor: '#eab308', marginBottom: 10 },
  sidebarName: { fontSize: 18, fontWeight: 'bold', color: '#ffffff' },
  sidebarPhone: { fontSize: 14, color: '#94a3b8', marginTop: 5 },
  sidebarLinks: { padding: 20 },
  sidebarLink: { paddingVertical: 18, borderBottomWidth: 1, borderColor: '#f1f5f9' },
  sidebarLinkText: { fontSize: 16, color: '#334155', fontWeight: 'bold', textAlign: 'right' },
  sidebarLogoutBtn: { backgroundColor: '#fee2e2', padding: 15, margin: 20, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: '#fca5a5' },
  sidebarLogoutText: { color: '#ef4444', fontSize: 16, fontWeight: 'bold' }
});