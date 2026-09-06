import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { useFocusEffect, useRouter } from 'expo-router';
import { addDoc, arrayUnion, collection, doc, getDoc, limit, onSnapshot, orderBy, query, updateDoc, where } from 'firebase/firestore';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Animated, Dimensions, FlatList, Image, Linking, Modal, PanResponder, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
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

  useEffect(() => { setActivePrice(item.price); }, [item.price]);

  const initialMapRegion = item.pickupCoords ? {
    latitude: item.pickupCoords.latitude,
    longitude: item.pickupCoords.longitude,
    latitudeDelta: 0.02,
    longitudeDelta: 0.02,
  } : undefined;

  useEffect(() => {
    if (showMiniMap && item.pickupCoords && captainLocation && mapRef.current) {
      setTimeout(() => {
        mapRef.current?.fitToCoordinates([item.pickupCoords, captainLocation], {
          edgePadding: { top: 40, right: 40, bottom: 40, left: 40 },
          animated: false,
        });
      }, 500); 
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

  const destinationsList = Array.isArray(item.destinationsList) && item.destinationsList.length > 0 
    ? item.destinationsList 
    : [item.destinationLocation || 'غير محدد'];

  return (
    <View style={styles.swipeContainer}>
      <View style={styles.hiddenBackground}><Text style={styles.hiddenText}>إخفاء الطلب 👁️‍🗨️</Text></View>
      
      <Animated.View style={[styles.requestCard, { transform: [{ translateX }] }]} {...panResponder.panHandlers}>
        
        <View style={styles.topSplitContainer}>
          <View style={styles.passengerRightSide}>
            <Image source={{ uri: getSafeAvatar(item.avatar) }} style={styles.passengerAvatar} />
            <Text style={styles.passengerName} numberOfLines={1}>{item.name}</Text>
            
            {item.pickupCoords && captainLocation && (
              <TouchableOpacity style={styles.showMapBtnCard} onPress={() => setShowMiniMap(!showMiniMap)}>
                <Text style={styles.showMapBtnTextCard}>{showMiniMap ? 'إخفاء ⬆️' : '🗺️ خريطة'}</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.routeLeftSide}>
            <Text style={styles.routeSplitText} numberOfLines={2}>📍 من: {item.pickupLocation}</Text>
            {destinationsList.map((d: string, i: number) => (
              <Text key={i} style={styles.routeSplitText} numberOfLines={2}>🏁 إلى {i+1}: {d}</Text>
            ))}
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
        
        {item.notes && item.notes.trim() !== '' ? (
          <View style={styles.notesContainer}><Text style={styles.notesText}>📝 الملاحظات: {item.notes}</Text></View>
        ) : null}
        
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

  const [isCallModalVisible, setIsCallModalVisible] = useState(false);
  const [phoneToCall, setPhoneToCall] = useState('');
  const [isDestModalVisible, setIsDestModalVisible] = useState(false);

  const [isRatingModalVisible, setIsRatingModalVisible] = useState(false);
  const [rating, setRating] = useState(0);
  const [ratingReason, setRatingReason] = useState('');
  const [ratingSubmitted, setRatingSubmitted] = useState(false);
  const [rideToRate, setRideToRate] = useState<any>(null);
  
  const chatPulseAnim = useRef(new Animated.Value(0)).current; 
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const toastTranslateY = useRef(new Animated.Value(-10)).current;

  const [toastVisible, setToastVisible] = useState(false);
  const prevUnreadRef = useRef(0);
  const toastTimer = useRef<any>(null);

  const [captainProfile, setCaptainProfile] = useState({ id: '', name: 'كابتن...', phone: '', vehicle: 'توكتوك', avatar: 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png', walletBalance: 0 });

  const toggleOnlineStatus = async () => {
    const newState = !isOnline;
    setIsOnline(newState);
    Animated.timing(toggleAnim, { toValue: newState ? 1 : 0, duration: 250, useNativeDriver: false }).start();
    if (captainProfile.id) {
      try { await updateDoc(doc(db, 'captains', captainProfile.id), { isOnline: newState }); } catch (error) {}
    }
  };

  useFocusEffect(useCallback(() => { loadCaptainProfileFromFirebase(); loadDismissedRequests(); getCaptainLocation(); }, []));

  const getCaptainLocation = async () => {
    let { status } = await Location.requestForegroundPermissionsAsync();
    if (status === 'granted') {
      try {
        let loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setCaptainLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
      } catch (e) {}
    }
  };

  const loadCaptainProfileFromFirebase = async () => {
    try {
      const captainId = await AsyncStorage.getItem('currentCaptainId');
      if (captainId) {
        const localProfile = await AsyncStorage.getItem('captain_profile');
        let localAvatar = null;
        if (localProfile) { const parsed = JSON.parse(localProfile); localAvatar = parsed.avatar || parsed.profileImage; }

        const docRef = doc(db, 'captains', captainId);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const data = docSnap.data();
          const rawAvatar = data.profileImage || data.avatar || data.image || localAvatar;
          const finalAvatar = getSafeAvatar(rawAvatar);
          
          const updatedProfile = { 
            id: captainId, name: data.name || 'كابتن', phone: data.phone || '', 
            vehicle: data.tukTukNumber || data.vehicle || 'توكتوك', avatar: finalAvatar,
            walletBalance: data.walletBalance || 0 
          };
          
          setCaptainProfile(updatedProfile);
          if (data.isOnline !== undefined) { setIsOnline(data.isOnline); toggleAnim.setValue(data.isOnline ? 1 : 0); }
          await AsyncStorage.setItem('captain_profile', JSON.stringify(updatedProfile));
        }
      } else router.replace('/captain-login');
    } catch (e) {}
  };

  const loadDismissedRequests = async () => {
    try {
      const savedDismissed = await AsyncStorage.getItem('dismissed_requests');
      if (savedDismissed) setDismissedRequests(JSON.parse(savedDismissed));
    } catch (e) {}
  };

  useEffect(() => {
    if (!isOnline) { setAllRequests([]); return; }
    const q = query(collection(db, 'rides'), where('status', '==', 'pending'));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const pendingRequests: any[] = [];
      const currentTime = new Date().getTime();
      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.timestamp && (currentTime - data.timestamp < 900000)) pendingRequests.push({ id: docSnap.id, ...data });
      });
      pendingRequests.sort((a, b) => b.timestamp - a.timestamp);
      setAllRequests(pendingRequests);
    });
    return () => unsubscribe();
  }, [isOnline]);

  useEffect(() => {
    if (!captainProfile.id) return;
    const q = query(collection(db, 'rides'), where('captainId', '==', captainProfile.id));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      const active = docs.find(d => ['accepted', 'captain_arrived', 'passenger_on_the_way', 'in_progress'].includes(d.status));
      
      if (active) {
        setActiveRide(active);
        AsyncStorage.setItem('active_ride', JSON.stringify(active));
        setUnreadChatCount(active.unreadCountCaptain || 0);
        if (active.passengerId) {
          getDoc(doc(db, 'passengers', active.passengerId)).then((passSnap) => {
            if (passSnap.exists()) {
              const pData = passSnap.data();
              if (pData.avatar || pData.image) {
                const finalActive = { ...active, avatar: getSafeAvatar(pData.avatar || pData.image) };
                setActiveRide(finalActive);
                AsyncStorage.setItem('active_ride', JSON.stringify(finalActive)); 
              }
            }
          }).catch(e => console.log(e));
        }
      } else {
        setActiveRide((prev: any) => {
          if (prev) {
            const prevRideDoc = docs.find(d => d.id === prev.id);
            if (prevRideDoc && prevRideDoc.status === 'canceled') Alert.alert('تنبيه', 'الراكب قام بإلغاء الرحلة.');
          }
          AsyncStorage.removeItem('active_ride'); 
          return null;
        });
      }
    });
    return () => unsubscribe();
  }, [captainProfile.id]);

  useEffect(() => {
    if (!activeRide?.id) return;
    const q = query(collection(db, 'rides', activeRide.id, 'messages'), orderBy('timestamp', 'desc'), limit(1));
    const unsubscribeMsgs = onSnapshot(q, (snap) => {
      if (!snap.empty) { const msg = snap.docs[0].data(); if (msg.sender === 'passenger') setLatestMessage(msg.text); }
    });
    return () => unsubscribeMsgs();
  }, [activeRide?.id]);

  useEffect(() => {
    if (unreadChatCount > prevUnreadRef.current) {
      setToastVisible(true);
      Animated.parallel([ Animated.timing(toastOpacity, { toValue: 1, duration: 300, useNativeDriver: true }), Animated.timing(toastTranslateY, { toValue: 0, duration: 300, useNativeDriver: true }) ]).start();
      if (toastTimer.current) clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => {
        Animated.parallel([ Animated.timing(toastOpacity, { toValue: 0, duration: 300, useNativeDriver: true }), Animated.timing(toastTranslateY, { toValue: -10, duration: 300, useNativeDriver: true }) ]).start(() => setToastVisible(false));
      }, 2000); 
    }
    prevUnreadRef.current = unreadChatCount;

    if (unreadChatCount > 0) {
      Animated.loop( Animated.sequence([ Animated.timing(chatPulseAnim, { toValue: 1, duration: 400, useNativeDriver: false }), Animated.timing(chatPulseAnim, { toValue: 0, duration: 400, useNativeDriver: false }) ]) ).start();
    } else {
      chatPulseAnim.stopAnimation(); chatPulseAnim.setValue(0);
    }
  }, [unreadChatCount]);

  const chatBackgroundColor = chatPulseAnim.interpolate({ inputRange: [0, 1], outputRange: ['#8b5cf6', '#0f172a'] });

  const sendOffer = async (ride: any, offerPrice: string) => {
    try {
      const rideRef = doc(db, 'rides', ride.id);
      const safeAvatar = getSafeAvatar(captainProfile.avatar);
      const cleanOfferData = { captainId: String(captainProfile.id || 'unknown'), captainName: String(captainProfile.name || 'كابتن'), captainPhone: String(captainProfile.phone || 'غير مسجل'), captainVehicle: String(captainProfile.vehicle || 'توكتوك'), captainAvatar: safeAvatar, price: String(offerPrice || '0') };
      await updateDoc(rideRef, { price: String(offerPrice || '0'), offers: arrayUnion(cleanOfferData) });
      setSentOffers(prev => [...prev, ride.id]);
      Alert.alert('تم الإرسال 🚀', `تم إرسال عرضك بقيمة ${offerPrice} جنيه بنجاح.`);
    } catch (error: any) {}
  };

  const openPriceModal = (ride: any) => { setSelectedRideForPrice(ride); setTempCaptainPrice(ride.price ? ride.price.toString() : ''); setIsPriceModalVisible(true); };

  const confirmCustomPrice = () => {
    const originalPrice = parseInt(selectedRideForPrice?.price || '0');
    const newPrice = parseInt(tempCaptainPrice);
    if (!tempCaptainPrice || newPrice <= 0) { Alert.alert('خطأ', 'برجاء إدخال سعر صحيح.'); return; }
    if (newPrice < originalPrice) { Alert.alert('غير مسموح 🛑', 'لا يمكنك إرسال عرض أقل من سعر الراكب.'); return; }
    sendOffer(selectedRideForPrice, tempCaptainPrice); setIsPriceModalVisible(false);
  };

  const notifyArrival = async () => { if (!activeRide) return; try { await updateDoc(doc(db, 'rides', activeRide.id), { status: 'captain_arrived' }); } catch (error) {} };
  const startRide = async () => { if (!activeRide) return; try { await updateDoc(doc(db, 'rides', activeRide.id), { status: 'in_progress' }); setIsDestModalVisible(true); } catch (error) {} };
  
  const completeRide = async () => { 
    if (!activeRide) return; 
    try { 
      setRideToRate(activeRide); 
      
      const ridePrice = parseFloat(activeRide.price || '0');
      const appCommission = ridePrice * 0.0; 
      const newWalletBalance = captainProfile.walletBalance - appCommission;

      await updateDoc(doc(db, 'rides', activeRide.id), { status: 'completed' }); 
      await updateDoc(doc(db, 'captains', captainProfile.id), { walletBalance: newWalletBalance });
      
      setCaptainProfile(prev => ({ ...prev, walletBalance: newWalletBalance }));

      setActiveRide(null); 
      await AsyncStorage.removeItem('active_ride'); 
      setIsRatingModalVisible(true); 
    } catch (error) {} 
  };
  
  const submitRating = async () => {
    if (rating === 0) { Alert.alert('تنبيه', 'برجاء اختيار عدد النجوم أولاً.'); return; }
    if (rating < 5 && ratingReason.trim() === '') { Alert.alert('تنبيه', 'برجاء كتابة سبب التقييم.'); return; }
    try {
      await addDoc(collection(db, 'ratings'), { rideId: rideToRate?.id || 'unknown', captainId: captainProfile.id, captainName: captainProfile.name, passengerId: rideToRate?.passengerId || 'unknown', passengerName: rideToRate?.name || 'راكب', rating: rating, reason: rating === 5 ? 'ممتاز' : ratingReason.trim(), timestamp: new Date().getTime(), type: 'captain_rating_passenger' });
      setRatingSubmitted(true);
      setTimeout(() => { setIsRatingModalVisible(false); setRating(0); setRatingReason(''); setRatingSubmitted(false); setRideToRate(null); }, 2500);
    } catch (error) {}
  };

  const cancelRideByCaptain = async () => { if (!activeRide) return; try { await updateDoc(doc(db, 'rides', activeRide.id), { status: 'pending', captainId: null, captainName: null, captainPhone: null, captainVehicle: null, captainAvatar: null, offers: [] }); handleDismissRequest(activeRide); setActiveRide(null); await AsyncStorage.removeItem('active_ride'); Alert.alert('تنبيه', 'تم التراجع عن الرحلة.'); } catch (error) {} };
  const handleCallClick = () => { if (!activeRide) return; const passengerPhone = activeRide.phone || activeRide.passengerPhone; if (!passengerPhone || passengerPhone === 'غير مسجل') { Alert.alert('تنبيه', 'رقم الراكب غير متوفر.'); return; } setPhoneToCall(passengerPhone); setIsCallModalVisible(true); };
  const makeRegularCall = () => { setIsCallModalVisible(false); Linking.openURL(`tel:${phoneToCall}`); };
  const makeFreeCall = () => { setIsCallModalVisible(false); Alert.alert('مكالمة مجانية 🌐', 'تتطلب ربط التطبيق بخدمة اتصالات خارجية.'); };
  const handleLogout = async () => { await AsyncStorage.removeItem('currentCaptainId'); await AsyncStorage.removeItem('captain_profile'); await AsyncStorage.removeItem('active_ride'); router.replace('/captain-login'); };
  const handleDismissRequest = async (item: any) => { const newDismissed = { ...dismissedRequests, [item.id]: { price: item.price, pickupLocation: item.pickupLocation, destinationLocation: item.destinationLocation } }; setDismissedRequests(newDismissed); await AsyncStorage.setItem('dismissed_requests', JSON.stringify(newDismissed)); };
  const openMapForDestination = (dest: string) => { setIsDestModalVisible(false); const url = Platform.OS === 'ios' ? `https://maps.apple.com/?daddr=${encodeURIComponent(dest)}` : `google.navigation:q=${encodeURIComponent(dest)}`; Linking.openURL(url).catch(() => {}); };

  const displayRequests = allRequests.filter(req => {
    const dismissedInfo = dismissedRequests[req.id];
    if (!dismissedInfo) return true;
    return req.price !== dismissedInfo.price || req.pickupLocation !== dismissedInfo.pickupLocation || req.destinationLocation !== dismissedInfo.destinationLocation;
  });

  const activeDestinationsList = Array.isArray(activeRide?.destinationsList) && activeRide.destinationsList.length > 0 ? activeRide.destinationsList : [activeRide?.destinationLocation || ''];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        {/* تم فصل أزرار المحفظة والملف الشخصي لتوجيه الكابتن لصفحة المحفظة */}
        <View style={styles.userInfo}>
          <TouchableOpacity onPress={() => router.push('/captain-profile')}>
            <Image source={{ uri: captainProfile.avatar }} style={styles.profileAvatar} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.walletDisplayContainer} onPress={() => router.push('/captain-wallet')}>
            <Text style={styles.walletTitle}>المحفظة</Text>
            <Text style={[styles.walletAmount, { color: '#10b981' }]}>
              {captainProfile.walletBalance ? captainProfile.walletBalance.toFixed(2) : '0.00'} ج
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity activeOpacity={0.9} style={[styles.toggleContainer, { backgroundColor: isOnline ? '#10b981' : '#ef4444', borderColor: isOnline ? '#10b981' : '#ef4444' }]} onPress={toggleOnlineStatus}>
          <Text style={[styles.toggleText, isOnline ? { marginLeft: 26 } : { marginRight: 26 }]}>
            {isOnline ? 'متصل' : 'غير متصل'}
          </Text>
          <Animated.View style={[styles.toggleCircle, { transform: [{ translateX: toggleAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -56] }) }] }]} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}><Text style={styles.logoutText}>خروج</Text></TouchableOpacity>
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
            <FlatList
              data={displayRequests}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => <SwipeableRequestItem item={item} onSendOffer={sendOffer} onEditPrice={openPriceModal} onDismiss={handleDismissRequest} hasSentOffer={sentOffers.includes(item.id)} captainLocation={captainLocation} />}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 20 }}
            />
          )}
        </>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
          <View style={[styles.activeRideContainer, (activeRide.status === 'passenger_on_the_way' || activeRide.status === 'in_progress') && styles.activeRidePulseContainer]}>
            <Text style={styles.activeRideTitle}>
              {activeRide.status === 'accepted' ? '🛺 أنت الآن في طريقك للراكب' : activeRide.status === 'passenger_on_the_way' ? '✅ الراكب نازل الآن!' : activeRide.status === 'captain_arrived' ? '🔔 لقد وصلت للراكب' : '▶️ الرحلة جارية الآن'}
            </Text>

            {toastVisible && latestMessage ? (
              <Animated.View style={[styles.inlineToast, { opacity: toastOpacity, transform: [{ translateY: toastTranslateY }] }]}>
                <Text style={styles.inlineToastText} numberOfLines={2}>💬 {latestMessage}</Text>
              </Animated.View>
            ) : null}

            <View style={styles.passengerCard}>
              <Image source={{ uri: activeRide.avatar }} style={styles.activeAvatar} />
              <View style={styles.detailsCol}>
                <Text style={styles.detailsText}>👤 الراكب: {activeRide.name}</Text>
                <Text style={styles.phoneText}>📞 رقم الراكب: {activeRide.phone || activeRide.passengerPhone || 'غير مسجل'}</Text>
              </View>
            </View>

            <View style={styles.tripRouteContainer}>
              <Text style={styles.routeTextActive}>📍 الانطلاق: {activeRide.pickupLocation}</Text>
              {activeDestinationsList.map((d: string, i: number) => ( <Text key={i} style={styles.routeTextActive}>🏁 الوجهة {i+1}: {d}</Text> ))}
              <Text style={styles.routeTextActive}>👥 الركاب: {activeRide.passengers || '1'}</Text>
              <Text style={styles.priceTagActive}>💰 الأجرة: {activeRide.price} جنيه</Text>
            </View>

            {activeRide.notes && activeRide.notes.trim() !== '' ? (<View style={styles.notesContainer}><Text style={styles.notesText}>📝 ملاحظات الراكب: {activeRide.notes}</Text></View>) : null}

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
              <TouchableOpacity style={styles.startButton} onPress={startRide}><Text style={styles.startButtonText}>▶️ ابدأ المشوار</Text></TouchableOpacity>
            ) : (
              <>
                <TouchableOpacity style={styles.mapDropdownBtn} onPress={() => setIsDestModalVisible(true)}><Text style={styles.mapDropdownBtnText}>🗺️ اختيار الوجهة للخريطة 🔽</Text></TouchableOpacity>
                <TouchableOpacity style={styles.completeButton} onPress={completeRide}><Text style={styles.completeButtonText}>✅ إنهاء المشوار</Text></TouchableOpacity>
              </>
            )}

            {activeRide.status !== 'in_progress' && (
              <TouchableOpacity style={styles.cancelRideBtn} onPress={() => Alert.alert('تأكيد', 'التراجع عن الرحلة؟', [{text:'لا'},{text:'نعم', onPress: cancelRideByCaptain}])}><Text style={styles.cancelRideBtnText}>❌ التراجع عن الرحلة</Text></TouchableOpacity>
            )}
          </View>
        </ScrollView>
      )}

      {/* موديل التقييم والخرائط والاتصال */}
      <Modal visible={isRatingModalVisible} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.ratingModalContent}>
            {!ratingSubmitted ? (
              <>
                <Text style={styles.modalTitle}>كيف كانت الرحلة؟ 🛺</Text>
                <Text style={styles.modalSubtitle}>تقييمك يساعدنا في تحسين الخدمة</Text>
                <View style={styles.starsRow}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <TouchableOpacity key={star} onPress={() => setRating(star)}><Text style={[styles.starText, { color: star <= rating ? '#f59e0b' : '#cbd5e1' }]}>★</Text></TouchableOpacity>
                  ))}
                </View>
                {rating === 5 && <Text style={styles.thankYouFiveStars}>شكراً لك! 🤩</Text>}
                {rating > 0 && rating < 5 && <TextInput style={styles.reasonInput} placeholder="سبب التقييم؟ (إلزامي)" placeholderTextColor="#94a3b8" value={ratingReason} onChangeText={setRatingReason} multiline={true} />}
                {rating > 0 && <TouchableOpacity style={styles.submitRatingBtn} onPress={submitRating}><Text style={styles.submitRatingBtnText}>إرسال التقييم</Text></TouchableOpacity>}
              </>
            ) : (
              <View style={styles.successRatingContainer}>
                <Text style={styles.successRatingIcon}>✅</Text>
                <Text style={styles.successRatingText}>نشكرك على تقييمك</Text>
              </View>
            )}
          </View>
        </View>
      </Modal>

      <Modal visible={isDestModalVisible} transparent={true} animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.destModalContent}>
            <Text style={styles.modalTitle}>إلى أين تتجه الآن؟ 🗺️</Text>
            <ScrollView style={{ maxHeight: 250 }} showsVerticalScrollIndicator={false}>
              {activeDestinationsList?.map((dest: string, index: number) => (
                <TouchableOpacity key={index} style={styles.destOptionBtn} onPress={() => openMapForDestination(dest)}>
                  <Text style={styles.destOptionText}>🏁 وجهة {index + 1}: {dest}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.cancelCallBtn} onPress={() => setIsDestModalVisible(false)}><Text style={styles.cancelCallBtnText}>إغلاق القائمة</Text></TouchableOpacity>
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

      <Modal visible={isPriceModalVisible} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>✏️ تقديم عرض سعر</Text>
            <TextInput style={styles.modalInput} value={tempCaptainPrice} onChangeText={setTempCaptainPrice} keyboardType="numeric" placeholder="اكتب السعر الجديد" placeholderTextColor="#94a3b8" />
            <View style={styles.modalButtonsRow}>
              <TouchableOpacity style={styles.modalSaveBtn} onPress={confirmCustomPrice}><Text style={styles.modalSaveBtnText}>إرسال العرض</Text></TouchableOpacity>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setIsPriceModalVisible(false)}><Text style={styles.modalCancelBtnText}>إلغاء</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9', padding: 15, paddingTop: 40 },
  header: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#ffffff', padding: 12, borderRadius: 16, marginBottom: 20, elevation: 2 },
  userInfo: { flexDirection: 'row-reverse', alignItems: 'center' },
  profileAvatar: { width: 45, height: 45, borderRadius: 22.5, backgroundColor: '#cbd5e1' },
  walletDisplayContainer: { marginRight: 10, alignItems: 'flex-end' },
  walletTitle: { fontSize: 12, color: '#64748b', fontWeight: 'bold' },
  walletAmount: { fontSize: 14, fontWeight: 'bold' },
  
  toggleContainer: { width: 90, height: 34, borderRadius: 17, flexDirection: 'row-reverse', alignItems: 'center', paddingHorizontal: 4, justifyContent: 'center', borderWidth: 1.5, borderColor: '#e2e8f0', elevation: 2 },
  toggleText: { color: '#ffffff', fontSize: 11, fontWeight: 'bold', zIndex: 1 },
  toggleCircle: { position: 'absolute', right: 4, width: 26, height: 26, borderRadius: 13, backgroundColor: '#ffffff', elevation: 3 },
  
  logoutButton: { backgroundColor: '#fee2e2', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 12 },
  logoutText: { color: '#ef4444', fontWeight: 'bold', fontSize: 14 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#1e293b', marginBottom: 15, textAlign: 'right' },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { fontSize: 16, color: '#64748b', textAlign: 'center', fontWeight: 'bold' },
  
  swipeContainer: { position: 'relative', marginBottom: 12 },
  hiddenBackground: { ...StyleSheet.absoluteFillObject, backgroundColor: '#fee2e2', borderRadius: 16, justifyContent: 'center', alignItems: 'flex-end', paddingRight: 20 },
  hiddenText: { color: '#ef4444', fontWeight: 'bold', fontSize: 16 },
  
  requestCard: { backgroundColor: '#ffffff', padding: 12, borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', elevation: 3 },
  topSplitContainer: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  passengerRightSide: { width: 75, alignItems: 'center', borderLeftWidth: 1, borderColor: '#f1f5f9', paddingLeft: 8 },
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
  actionBtnChat: { position: 'relative', paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  actionBtnText: { color: '#ffffff', fontSize: 15, fontWeight: 'bold' },
  badgeContainer: { position: 'absolute', top: -8, right: -8, backgroundColor: '#ef4444', minWidth: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center', zIndex: 10, borderWidth: 2, borderColor: '#ffffff' },
  badgeText: { color: '#ffffff', fontSize: 12, fontWeight: 'bold' },
  arriveButton: { backgroundColor: '#f59e0b', paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginBottom: 10 },
  arriveButtonText: { color: '#ffffff', fontSize: 16, fontWeight: 'bold' },
  startButton: { backgroundColor: '#8b5cf6', paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginBottom: 10 },
  startButtonText: { color: '#ffffff', fontSize: 16, fontWeight: 'bold' },
  mapDropdownBtn: { backgroundColor: '#e0f2fe', paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginBottom: 10, borderWidth: 1, borderColor: '#0284c7' },
  mapDropdownBtnText: { color: '#0284c7', fontSize: 16, fontWeight: 'bold' },
  completeButton: { backgroundColor: '#2563eb', paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  completeButtonText: { color: '#ffffff', fontSize: 16, fontWeight: 'bold' },
  cancelRideBtn: { backgroundColor: '#fee2e2', paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginTop: 10 },
  cancelRideBtnText: { color: '#ef4444', fontSize: 16, fontWeight: 'bold' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { backgroundColor: '#ffffff', width: '100%', padding: 20, borderRadius: 20, elevation: 5 },
  callModalContent: { backgroundColor: '#ffffff', width: '85%', padding: 20, borderRadius: 20, elevation: 5, alignItems: 'center' },
  destModalContent: { backgroundColor: '#ffffff', width: '90%', padding: 20, borderRadius: 20, elevation: 5 },
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
  destOptionBtn: { backgroundColor: '#f8fafc', padding: 15, borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: '#cbd5e1' },
  destOptionText: { fontSize: 15, fontWeight: 'bold', color: '#0f172a', textAlign: 'right' },
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
  cancelCallBtn: { paddingVertical: 10, marginTop: 10 },
  cancelCallBtnText: { color: '#ef4444', fontWeight: 'bold', fontSize: 16, textAlign: 'center' },
  inlineToast: { backgroundColor: '#1e293b', paddingVertical: 10, paddingHorizontal: 15, borderRadius: 12, marginBottom: 10, width: '100%', flexDirection: 'row-reverse', alignItems: 'center', elevation: 3 },
  inlineToastText: { color: '#ffffff', fontSize: 14, fontWeight: 'bold', textAlign: 'right', flex: 1 },
});