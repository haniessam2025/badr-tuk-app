import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { useFocusEffect, useRouter } from 'expo-router';
import * as ScreenCapture from 'expo-screen-capture';
import { addDoc, arrayUnion, collection, doc, getDoc, getDocs, increment, limit, onSnapshot, orderBy, query, updateDoc, where } from 'firebase/firestore';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Animated, Dimensions, FlatList, Image, Linking, Modal, PanResponder, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { db } from '../firebase';

const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);
const SCREEN_WIDTH = Dimensions.get('window').width;

const getSafeAvatar = (imgStr: any) => {
  if (!imgStr || typeof imgStr !== 'string' || imgStr.trim() === '') return 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png';
  if (imgStr.startsWith('http') || imgStr.startsWith('file:/') || imgStr.startsWith('data:image')) return imgStr;
  if (imgStr.length > 50) return `data:image/jpeg;base64,${imgStr}`;
  return 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png';
};

const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371; 
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c * 1000;
};

const SwipeableRequestItem = ({ item, onSendOffer, onEditPrice, onDismiss, hasSentOffer, captainLocation, onImagePress, onWithdrawOffer }: { item: any, onSendOffer: (item: any, price: string) => void, onEditPrice: (item: any) => void, onDismiss: (item: any) => void, hasSentOffer: boolean, captainLocation: any, onImagePress: (url: string) => void, onWithdrawOffer: (id: string) => void }) => {
  const translateX = useRef(new Animated.Value(0)).current;
  const [activePrice, setActivePrice] = useState(item.price);
  const progressAnim = useRef(new Animated.Value(100)).current; // 👈 شريط التحميل
  const basePrice = parseInt(item.price) || 0;
  const passRating = item.passengerRating || 5;

  useEffect(() => { setActivePrice(item.price); }, [item.price]);

  // 👈 منطق شريط التحميل (30 ثانية)
  useEffect(() => {
    if (hasSentOffer) {
      progressAnim.setValue(100);
      Animated.timing(progressAnim, {
        toValue: 0,
        duration: 30000, // 30 ثانية بالظبط
        useNativeDriver: false,
      }).start(({ finished }) => {
        if (finished) onWithdrawOffer(item.id);
      });
    } else {
      progressAnim.setValue(100);
      progressAnim.stopAnimation();
    }
  }, [hasSentOffer]);

  const distanceMeters = (item.pickupCoords && captainLocation)
    ? calculateDistance(captainLocation.latitude, captainLocation.longitude, item.pickupCoords.latitude, item.pickupCoords.longitude)
    : null;

  const distanceDisplay = distanceMeters !== null
    ? (distanceMeters < 1000 ? `${Math.round(distanceMeters)} متر 📍` : `${(distanceMeters / 1000).toFixed(1)} كم 📍`)
    : null;

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
      <View style={styles.hiddenBackground}><Text style={styles.hiddenText}>إخفاء الطلب</Text></View>
      <Animated.View style={[styles.requestCard, { transform: [{ translateX }] }]} {...panResponder.panHandlers}>
        <View style={styles.topSplitContainer}>
          <View style={styles.passengerRightSide}>
            <TouchableOpacity onPress={() => onImagePress(getSafeAvatar(item.avatar))}>
              <Image source={{ uri: getSafeAvatar(item.avatar) }} style={styles.passengerAvatar} />
            </TouchableOpacity>
            <Text style={styles.passengerName} numberOfLines={1}>{item.name}</Text>
            <View style={{ flexDirection: 'row-reverse', marginTop: 2, justifyContent: 'center' }}>
              {[1, 2, 3, 4, 5].map((star) => (
                <Text key={star} style={{ fontSize: 11, color: star <= Math.round(passRating) ? '#f59e0b' : '#cbd5e1' }}>★</Text>
              ))}
            </View>
            {distanceDisplay && (
              <View style={styles.distanceBadgeCard}>
                <Text style={styles.distanceBadgeTextCard}>{distanceDisplay}</Text>
              </View>
            )}
          </View>
          <View style={[styles.routeLeftSide, destinationsList.length === 1 && { justifyContent: 'space-evenly' }]}>
            {item.requestedVehicleType === 'tuktuk_alt' && item.passengersCount && (
              <View style={styles.passengerCountBadge}>
                <Text style={styles.passengerCountText}>👥 عدد الركاب: {item.passengersCount}</Text>
              </View>
            )}
            
            {/* 👈 الانطلاق: خط عملاق يتكيف مع المساحة */}
            <View style={styles.routeItemBox}>
              <Text style={[styles.routeIconText, destinationsList.length === 1 && { fontSize: 18, marginTop: 5 }]}>🟢</Text>
              <Text 
                style={[styles.routeMainText, destinationsList.length === 1 && { fontSize: 24, lineHeight: 34 }]} 
                numberOfLines={destinationsList.length > 1 ? 2 : 3}
                adjustsFontSizeToFit={true}
                minimumFontScale={0.7}
              >
                {item.pickupLocation}
              </Text>
            </View>
            
            {/* 👈 الوجهات: خط عملاق للوجهة الواحدة، ويصغر لو أكتر من وجهة */}
            {destinationsList.map((d: string, i: number) => (
              <View key={i} style={styles.routeItemBox}>
                <Text style={[styles.routeIconText, destinationsList.length === 1 && { fontSize: 18, marginTop: 5 }]}>🔴</Text>
                <Text 
                  style={[styles.routeDestText, destinationsList.length === 1 && { fontSize: 22, lineHeight: 32 }]} 
                  numberOfLines={destinationsList.length > 1 ? 1 : 3}
                  adjustsFontSizeToFit={true}
                  minimumFontScale={0.7}
                >
                  {destinationsList.length > 1 ? `وجهة ${i + 1}: ${d}` : d}
                </Text>
              </View>
            ))}
          </View>
        </View>
        
        {item.notes && item.notes.trim() !== '' ? (<View style={styles.notesContainer}><Text style={styles.notesText}>الملاحظات: {item.notes}</Text></View>) : null}
        
        {/* 👈 عرض السعر وبجانبه بادج طريقة الدفع البارز */}
        <View style={styles.priceAndPaymentRow}>
          <Text style={[styles.largePriceTag, {marginBottom: 0}]}>{activePrice} جنيه</Text>
          <View style={[styles.paymentBadgeAlert, item.paymentMethod === 'انستاباي' ? {backgroundColor: '#4f46e5', borderColor: '#3730a3'} : item.paymentMethod === 'محفظة' ? {backgroundColor: '#ea580c', borderColor: '#c2410c'} : {backgroundColor: '#10b981', borderColor: '#059669'}]}>
            <Text style={styles.paymentBadgeTextAlert}>💳 دفع: {item.paymentMethod || 'كاش'}</Text>
          </View>
        </View>

        {!hasSentOffer && basePrice > 0 && (
          <View style={styles.compactSuggestionsRow}>
            {[1.2, 1.4, 1.6].map((multiplier, index) => {
              const suggestedPrice = Math.round(basePrice * multiplier);
              const isSelected = activePrice === suggestedPrice.toString();
              return (
                <TouchableOpacity key={index} style={[styles.compactSuggestionBtn, isSelected && styles.suggestionBtnActive]} onPress={() => setActivePrice(suggestedPrice.toString())}>
                  <Text style={[styles.suggestionText, isSelected && styles.suggestionTextActive]}>{suggestedPrice}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
        {hasSentOffer ? (
          <View style={[styles.waitingOfferContainer, { padding: 10 }]}>
            <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <Text style={styles.waitingOfferText}>جاري انتظار الراكب...</Text>
              <TouchableOpacity onPress={() => onWithdrawOffer(item.id)} style={{ backgroundColor: '#ef4444', paddingVertical: 4, paddingHorizontal: 10, borderRadius: 6 }}>
                <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 12 }}>سحب العرض ✖</Text>
              </TouchableOpacity>
            </View>
            {/* 👈 شريط التحميل الرفيع للكابتن */}
            <View style={{ width: '100%', height: 4, backgroundColor: '#fde047', borderRadius: 2, overflow: 'hidden' }}>
              <Animated.View style={{ height: '100%', backgroundColor: '#d97706', width: progressAnim.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }) }} />
            </View>
          </View>
        ) : (
          <View style={styles.requestActionsRow}>
            <TouchableOpacity style={styles.editPriceBtn} onPress={() => onEditPrice(item)}>
              <Text style={styles.editPriceBtnText}>تعديل السعر</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.acceptBtn} onPress={() => onSendOffer(item, activePrice)}>
              <Text style={styles.acceptBtnText}>قبول</Text>
            </TouchableOpacity>
          </View>
        )}
      </Animated.View>
    </View>
  );
};

const EmptySearchingState = ({ hasConfirmedDestination }: { hasConfirmedDestination: boolean }) => {
  const lightningAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(lightningAnim, { toValue: 1.5, duration: 800, useNativeDriver: true }),
      Animated.timing(lightningAnim, { toValue: 1, duration: 800, useNativeDriver: true })
    ])).start();
  }, []);
  return (
    <View style={styles.emptyState}>
      <Animated.View style={{ transform: [{ scale: lightningAnim }], marginBottom: 20 }}>
        <Text style={{ fontSize: 75 }}>⚡</Text>
      </Animated.View>
      <Text style={styles.emptyText}>
        {hasConfirmedDestination ? 'جاري البحث عن مشاوير نحو وجهتك...' : 'جاري البحث عن مشاوير...'}
      </Text>
      <Text style={{ fontSize: 13, color: '#94a3b8', marginTop: 8 }}>الطلبات هتظهر هنا تلقائياً بمجرد توفرها</Text>
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
  const [offerPerks, setOfferPerks] = useState<string[]>([]);
  const availablePerks = ['سيارة مكيفة ❄️', 'بلوتوث 🎵', 'شاحن USB 🔋', 'كابتن غير مدخن 🚭'];
  const [enteredNumericCode, setEnteredNumericCode] = useState('');
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [latestMessage, setLatestMessage] = useState('');
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const toastTranslateY = useRef(new Animated.Value(-10)).current;
  const [toastVisible, setToastVisible] = useState(false);
  const prevMsgIdRef = useRef<string | null>(null);
  const toastTimer = useRef<any>(null);
  const latestMsgTimer = useRef<any>(null);
  const isEndingRide = useRef(false); // 👈 مفتاح أمان لمنع رسالة الإلغاء الوهمية
  const chatPulseAnim = useRef(new Animated.Value(0)).current;
  const [adminMessage, setAdminMessage] = useState<any>(null);
  const [isAdminMsgVisible, setIsAdminMsgVisible] = useState(false);
  const [isCallModalVisible, setIsCallModalVisible] = useState(false);
  const [phoneToCall, setPhoneToCall] = useState('');
  const [isRatingModalVisible, setIsRatingModalVisible] = useState(false);
  const [rating, setRating] = useState(0);
  const [ratingReason, setRatingReason] = useState('');
  const [ratingSubmitted, setRatingSubmitted] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const captainRatingTags = ['راكب محترم', 'دفع سريع', 'موقع دقيق', 'شخص مهذب'];
  const [rideToRate, setRideToRate] = useState<any>(null);
  
  const [enlargedAvatar, setEnlargedAvatar] = useState<string | null>(null);

  // دالة فتح الصورة ومنع السكرين شوت
  const handleImagePress = async (url: string) => {
    setEnlargedAvatar(url);
    try {
      if (ScreenCapture && ScreenCapture.preventScreenCaptureAsync) {
        await ScreenCapture.preventScreenCaptureAsync();
      }
    } catch (error) {
      console.log("Screen capture prevent error:", error);
    }
  };

  // دالة إغلاق الصورة والسماح بالسكرين شوت مرة تانية
  const closeEnlargedImage = async () => {
    setEnlargedAvatar(null);
    try {
      if (ScreenCapture && ScreenCapture.allowScreenCaptureAsync) {
        await ScreenCapture.allowScreenCaptureAsync();
      }
    } catch (error) {
      console.log("Screen capture allow error:", error);
    }
  };

  useEffect(() => {
    if (enlargedAvatar) {
      if (ScreenCapture && ScreenCapture.preventScreenCaptureAsync) {
        ScreenCapture.preventScreenCaptureAsync().catch(() => {});
      }
    } else {
      if (ScreenCapture && ScreenCapture.allowScreenCaptureAsync) {
        ScreenCapture.allowScreenCaptureAsync().catch(() => {});
      }
    }
    
    return () => {
      if (ScreenCapture && ScreenCapture.allowScreenCaptureAsync) {
        ScreenCapture.allowScreenCaptureAsync().catch(() => {});
      }
    };
  }, [enlargedAvatar]);

  const [captainProfile, setCaptainProfile] = useState({ id: '', name: '...', phone: '', vehicle: 'توكتوك', vehicleCategory: 'tuktuk_alt', tuktukAltType: '', avatar: 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png', walletBalance: 0, averageRating: 5, ratingCount: 0 });
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const sidebarAnim = useRef(new Animated.Value(SCREEN_WIDTH)).current;

  const [isTuktukTypeModalVisible, setIsTuktukTypeModalVisible] = useState(false);
  const [selectedTuktukType, setSelectedTuktukType] = useState('كيوت 3 راكب');

  const [isDestinationFilterActive, setIsDestinationFilterActive] = useState(false);
  const [destinationFilterText, setDestinationFilterText] = useState('');
  const [confirmedDestinationFilter, setConfirmedDestinationFilter] = useState(''); 
  const [placesSuggestions, setPlacesSuggestions] = useState<any[]>([]);
  
  const GOOGLE_API_KEY = 'ضع_مفتاح_جوجل_هنا';

  const fetchPlaceSuggestions = async (text: string) => {
    setDestinationFilterText(text);
    if (text.length > 2) {
      try {
        const response = await fetch(`https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${text}&key=${GOOGLE_API_KEY}&language=ar&components=country:eg`);
        const data = await response.json();
        if (data.predictions) {
          setPlacesSuggestions(data.predictions);
        }
      } catch (error) {
        console.log('Error fetching places:', error);
      }
    } else {
      setPlacesSuggestions([]);
    }
  };

  const handleSelectPlace = (placeName: string) => {
    setDestinationFilterText(placeName);
    setPlacesSuggestions([]);
  };

  const generateAndShowQR = async () => {
    if (!activeRide) return;
    const uniqueSecret = Math.random().toString(36).substring(2, 12);
    const numeric = Math.floor(1000000 + Math.random() * 9000000).toString();
    try { await updateDoc(doc(db, 'rides', activeRide.id), { status: 'waiting_for_scan', qrSecret: uniqueSecret, numericSecret: numeric }); } catch (e) { Alert.alert("خطأ", "تأكد من اتصالك بالإنترنت"); }
  };

  const cancelQRScan = async () => {
    if (!activeRide) return;
    try { await updateDoc(doc(db, 'rides', activeRide.id), { status: 'captain_arrived', qrSecret: null, numericSecret: null }); setEnteredNumericCode(''); } catch (e) {}
  };

  const verifyNumericCode = async () => {
    if (!enteredNumericCode || enteredNumericCode.trim() === '') return;
    if (activeRide && activeRide.numericSecret === enteredNumericCode.trim()) {
      await updateDoc(doc(db, 'rides', activeRide.id), { status: 'in_progress' });
      setEnteredNumericCode('');
    } else {
      Alert.alert('خطأ', 'الكود غير صحيح، تأكد من الرقم مع الراكب');
    }
  };

  const openSidebar = () => { setIsSidebarOpen(true); Animated.timing(sidebarAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start(); };
  const closeSidebar = () => { Animated.timing(sidebarAnim, { toValue: SCREEN_WIDTH, duration: 300, useNativeDriver: true }).start(() => setIsSidebarOpen(false)); };

  const toggleOnlineStatus = async () => {
    if (!isOnline && captainProfile.vehicleCategory === 'tuktuk_alt' && !captainProfile.tuktukAltType) {
      setIsTuktukTypeModalVisible(true);
      return;
    }

    if (!isOnline && captainProfile.id) {
      try {
        const capSnap = await getDoc(doc(db, 'captains', captainProfile.id));
        if (capSnap.exists()) {
          const capData = capSnap.data();
          if (capData.bannedUntil && capData.bannedUntil > Date.now()) {
            const hoursLeft = Math.ceil((capData.bannedUntil - Date.now()) / (1000 * 60 * 60));
            Alert.alert('حساب موقوف 🚫', `عذراً، حسابك موقوف مؤقتاً لكثرة إلغاء الرحلات بعد قبولها. يرجى المحاولة بعد ${hoursLeft} ساعة.`);
            return;
          }
        }
      } catch(e) {}
    }

    const newState = !isOnline;
    setIsOnline(newState);
    Animated.timing(toggleAnim, { toValue: newState ? 100 : 0, duration: 250, useNativeDriver: false }).start();
    if (captainProfile.id) { try { await updateDoc(doc(db, 'captains', captainProfile.id), { isOnline: newState }); } catch (error) {} }
  };

  useFocusEffect(useCallback(() => { loadCaptainProfileFromFirebase(); loadDismissedRequests(); getInitialCaptainLocation(); }, []));

  const getInitialCaptainLocation = async () => {
    let { status } = await Location.requestForegroundPermissionsAsync();
    if (status === 'granted') { 
      try { 
        let loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }); 
        setCaptainLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude }); 
      } catch (e) {} 
    }
  };

  useEffect(() => {
    let locationSubscription: any;
    const startLiveTracking = async () => {
      if (isOnline) {
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          locationSubscription = await Location.watchPositionAsync(
            { accuracy: Location.Accuracy.High, timeInterval: 3000, distanceInterval: 5 },
            (loc) => {
              setCaptainLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
            }
          );
        }
      }
    };
    startLiveTracking();
    return () => { if (locationSubscription) locationSubscription.remove(); };
  }, [isOnline]);

  const loadCaptainProfileFromFirebase = async () => {
    try {
      let captainId = await AsyncStorage.getItem('currentCaptainId');
      
      // 👈 لو ملقاش الـ ID مباشر، هيدور عليه جوه بيانات البروفايل المتسجلة
      if (!captainId) {
        const profileStr = await AsyncStorage.getItem('captain_profile');
        if (profileStr) {
          const profile = JSON.parse(profileStr);
          captainId = profile.id || profile.uid;
        }
      }

      if (captainId) {
        // 👈 حفظ الـ ID لو كان مفقود عشان الدخول الجاي
        await AsyncStorage.setItem('currentCaptainId', captainId);

        // تم نقل جلب التقييمات خارج الـ onSnapshot لتتم مرة واحدة فقط وتوفير القراءات
        const ratingQ = query(collection(db, 'ratings'), where('captainId', '==', captainId), where('type', '==', 'passenger_rating_captain'));
        const ratingSnap = await getDocs(ratingQ);
        let sum = 0;
        ratingSnap.docs.forEach(r => sum += (r.data().rating || 5));
        const rCount = ratingSnap.docs.length;
        const avgRate = rCount > 0 ? (sum / rCount).toFixed(1) : 5;

        const docRef = doc(db, 'captains', captainId);
        onSnapshot(docRef, async (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            
            const finalAvatar = getSafeAvatar(data.profileImage || data.avatar || data.image);
            
            const updatedProfile = { 
              id: captainId, 
              name: data.name || '', 
              phone: data.phone || '', 
              vehicle: data.vehicle || data.vehicleDetails?.type || 'مركبة', 
              vehicleCategory: data.vehicleCategory || 'tuktuk_alt', 
              tuktukAltType: data.tuktukAltType || '', 
              avatar: finalAvatar, 
              walletBalance: data.walletBalance || 0, 
              averageRating: Number(avgRate), 
              ratingCount: rCount,
              vehicleImage: data.vehicleImage || data.vehicleDetails?.image || data.carImage || data.tuktukImage || '',
              plateNumber: data.plateNumber || data.vehicleDetails?.plateNumber || data.carPlate || data.carNumber || data.vehicleNumber || data.tukTukNumber || ''
            };
            
            setCaptainProfile(updatedProfile);
            await AsyncStorage.setItem('captain_profile', JSON.stringify(updatedProfile));
            
            if (updatedProfile.vehicleCategory === 'tuktuk_alt' && !updatedProfile.tuktukAltType) {
               setIsTuktukTypeModalVisible(true);
            }

            if (data.isOnline !== undefined) { 
              setIsOnline(data.isOnline); 
              toggleAnim.setValue(data.isOnline ? 100 : 0); 
            }
          }
        });
      } else router.replace('/captain-login');
    } catch (e) {}
  };

  const saveNewTuktukType = async () => {
    try {
      await updateDoc(doc(db, 'captains', captainProfile.id), {
        tuktukAltType: selectedTuktukType,
        vehicle: `بديل توكتوك (${selectedTuktukType})`
      });
      setCaptainProfile(prev => ({ ...prev, tuktukAltType: selectedTuktukType }));
      setIsTuktukTypeModalVisible(false);
      Alert.alert("تم التحديث بنجاح 🎉", "يمكنك الآن بدء استقبال الطلبات المناسبة لمركبتك.");
    } catch (error) {
      Alert.alert("خطأ", "حدثت مشكلة أثناء الحفظ، الرجاء المحاولة مرة أخرى.");
    }
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

  useEffect(() => {
    if (!isOnline) { setAllRequests([]); return; }
    // 👈 تحديد القراءة لأحدث 30 طلب معلق فقط بدلاً من قراءة الكوليكشن بالكامل
    const q = query(collection(db, 'rides'), where('status', '==', 'pending'), limit(30));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const pendingRequests: any[] = [];
      const currentTime = new Date().getTime();
      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const rideVehicleType = data.requestedVehicleType || 'tuktuk_alt';
        
        if (rideVehicleType === captainProfile.vehicleCategory) {
          if (rideVehicleType === 'tuktuk_alt') {
            if (data.requestedTuktukType && data.requestedTuktukType !== captainProfile.tuktukAltType) {
               return; 
            }
          }

          if (data.timestamp && (currentTime - data.timestamp < 900000)) {
            if (isDestinationFilterActive && confirmedDestinationFilter.trim() !== '') {
              const destText = (data.destinationLocation || '').toLowerCase();
              const filterStr = confirmedDestinationFilter.toLowerCase().trim();
              if (!destText.includes(filterStr)) {
                return;
              }
            }
            pendingRequests.push({ id: docSnap.id, ...data });
          }
        }
      });
      pendingRequests.sort((a, b) => b.timestamp - a.timestamp);
      setAllRequests(pendingRequests);
    });
    return () => unsubscribe();
  }, [isOnline, captainProfile.vehicleCategory, captainProfile.tuktukAltType, isDestinationFilterActive, confirmedDestinationFilter]);

  useEffect(() => {
    if (!captainProfile.id) return;
    // 👈 تقييد القراءة للحالات النشطة فقط بدلاً من جميع رحلات الكابتن السابقة (توفير عملاق للقراءات)
    const q = query(
      collection(db, 'rides'), 
      where('captainId', '==', captainProfile.id),
      where('status', 'in', ['accepted', 'captain_arrived', 'passenger_on_the_way', 'waiting_for_scan', 'in_progress'])
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
        const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as any));
        if (docs.length > 0) {
          setActiveRide(docs[0]); 
          setUnreadChatCount(docs[0].unreadCountCaptain || 0);
        } else {
          setActiveRide((prev: any) => { 
            if (prev && !isEndingRide.current) {
              Alert.alert("تنبيه", "الرحلة الحالية غير موجودة أو قام الراكب بإلغائها."); 
            }
            isEndingRide.current = false; // 👈 إرجاع المفتاح لوضعه الطبيعي
            return null; 
          });
        }
      });
  }, [captainProfile.id]);

  useEffect(() => {
    if (!activeRide?.id) return;
    const q = query(collection(db, 'rides', activeRide.id, 'messages'), orderBy('timestamp', 'desc'), limit(1));
    const unsubscribeMsgs = onSnapshot(q, (snap) => {
      if (!snap.empty) {
        const doc = snap.docs[0];
        const msg = doc.data();
        const msgId = doc.id;
        if (msg.sender === 'passenger') {
          setLatestMessage(msg.text);
          if (prevMsgIdRef.current && prevMsgIdRef.current !== msgId) {
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
            }, 3000);
          }
          prevMsgIdRef.current = msgId;
        }
      }
    });
    return () => unsubscribeMsgs();
  }, [activeRide?.id]);

  useEffect(() => {
    if (latestMessage) {
      if (latestMsgTimer.current) clearTimeout(latestMsgTimer.current);
      latestMsgTimer.current = setTimeout(() => { setLatestMessage(''); }, 2000);
    }
    return () => { if (latestMsgTimer.current) clearTimeout(latestMsgTimer.current); };
  }, [latestMessage]);

  useEffect(() => {
    if (unreadChatCount > 0) {
      Animated.loop(Animated.sequence([
        Animated.timing(chatPulseAnim, { toValue: 1, duration: 400, useNativeDriver: false }),
        Animated.timing(chatPulseAnim, { toValue: 0, duration: 400, useNativeDriver: false })
      ])).start();
    } else {
      chatPulseAnim.stopAnimation(); chatPulseAnim.setValue(0);
    }
  }, [unreadChatCount]);

  const chatBackgroundColor = chatPulseAnim.interpolate({ inputRange: [0, 1], outputRange: ['#8b5cf6', '#000000'] });

  // 👈 إضافة selectedPerks للإرسال
  const sendOffer = async (ride: any, offerPrice: string, selectedPerks: string[] = []) => {
    try {
      const safeAvatar = getSafeAvatar(captainProfile.avatar);
      const cleanOfferData = { captainId: String(captainProfile.id), captainName: String(captainProfile.name), captainPhone: String(captainProfile.phone), captainVehicle: String(captainProfile.vehicle), captainAvatar: safeAvatar, price: String(offerPrice), captainRating: captainProfile.averageRating, captainRatingCount: captainProfile.ratingCount, offerTimestamp: new Date().getTime(), perks: selectedPerks }; 
      await updateDoc(doc(db, 'rides', ride.id), { price: String(offerPrice), offers: arrayUnion(cleanOfferData) });
      setSentOffers(prev => [...prev, ride.id]);
    } catch (error) {}
  };

  const withdrawOffer = async (rideId: string) => {
    try {
      const rideRef = doc(db, 'rides', rideId);
      const rideSnap = await getDoc(rideRef);
      if (rideSnap.exists()) {
        const currentOffers = rideSnap.data().offers || [];
        const updatedOffers = currentOffers.filter((o: any) => o.captainId !== String(captainProfile.id));
        await updateDoc(rideRef, { offers: updatedOffers });
        setSentOffers(prev => prev.filter(id => id !== rideId));
      }
    } catch (error) { console.log("Error withdrawing offer:", error); }
  };

  useEffect(() => {
    if (activeRide && sentOffers.length > 0) {
      sentOffers.forEach(id => {
        if (id !== activeRide.id) withdrawOffer(id);
      });
      setSentOffers([]);
    }
  }, [activeRide]);

  // 👈 تصفير المميزات عند فتح المودال
  const openPriceModal = (ride: any) => { setSelectedRideForPrice(ride); setTempCaptainPrice(ride.price ? ride.price.toString() : ''); setOfferPerks([]); setIsPriceModalVisible(true); };

  // 👈 تمرير المميزات عند التأكيد
  const confirmCustomPrice = () => {
    const originalPrice = parseInt(selectedRideForPrice?.price || '0');
    const newPrice = parseInt(tempCaptainPrice);
    if (!tempCaptainPrice || newPrice <= 0) return;
    if (newPrice < originalPrice) { Alert.alert('تنبيه', 'لا يمكنك إرسال عرض أقل من سعر الراكب'); return; }
    sendOffer(selectedRideForPrice, tempCaptainPrice, offerPerks); 
    setIsPriceModalVisible(false);
  };
  const notifyArrival = async () => { if (activeRide) await updateDoc(doc(db, 'rides', activeRide.id), { status: 'captain_arrived' }); };

  const completeRide = () => {
    if (!activeRide) return;
    
    const finalPrice = activeRide.price || '0';
    
    Alert.alert(
      "تفاصيل الحساب وإنهاء الرحلة 💵",
      `تم الوصول للوجهة بنجاح!\n\n💰 أجرة المشوار: ${finalPrice} جنيه\n🎁 عمولة تطبيق براق: 0%\n✅ صافي ربحك: ${finalPrice} جنيه (خالصين ليك!)\n\nهل تأكدت من تحصيل الكاش بالكامل من الراكب؟`,
      [
        { text: 'تراجع', style: 'cancel' },
        { text: 'نعم، استلمت الكاش وأنهيت الرحلة', onPress: async () => { 
            isEndingRide.current = true; // 👈 تفعيل مفتاح الأمان هنا
            const currentRide = activeRide;
            setRideToRate(currentRide); 
            setActiveRide(null); 
            setIsRatingModalVisible(true); 
            await updateDoc(doc(db, 'rides', currentRide.id), { status: 'completed' }); 
          } 
        }
      ]
    );
  };
  const openGoogleMaps = (locationName: string) => { const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(locationName)}`; Linking.openURL(url); };

  const submitRating = async () => {
    if (rating === 0) return;
    try {
      await addDoc(collection(db, 'ratings'), {
        rideId: rideToRate?.id,
        captainId: captainProfile.id,
        passengerId: rideToRate?.passengerId,
        senderName: captainProfile.name || 'كابتن',
        rating: rating,
        reason: [...selectedTags, ratingReason.trim()].filter(Boolean).join(' - ') || (rating === 5 ? 'ممتاز' : 'تقييم منخفض'),
        timestamp: new Date().getTime(),
        type: 'captain_rating_passenger'
      });
      if (rideToRate?.id) {
        const finalReason = [...selectedTags, ratingReason.trim()].filter(Boolean).join(' - ') || (rating === 5 ? 'ممتاز' : 'تقييم منخفض');
        await updateDoc(doc(db, 'rides', rideToRate.id), { captainRating: rating, captainRatingReason: finalReason });
      }
      setRatingSubmitted(true);
      setTimeout(() => { setIsRatingModalVisible(false); setRating(0); setRatingReason(''); setSelectedTags([]); setRatingSubmitted(false); setRideToRate(null); }, 2000);
    } catch (error) { console.log(error); }
  };

  const cancelRideByCaptain = async () => {
    if (!activeRide) return;
    try {
      const captainRef = doc(db, 'captains', captainProfile.id);
      const capSnap = await getDoc(captainRef);
      if (capSnap.exists()) {
        const capData = capSnap.data();
        const currentStrikes = capData.cancelStrikes || 0;
        if (currentStrikes >= 2) {
          const banTime = Date.now() + (24 * 60 * 60 * 1000);
          await updateDoc(captainRef, { 
            cancelStrikes: 0, 
            bannedUntil: banTime,
            isOnline: false
          });
          setIsOnline(false);
          Animated.timing(toggleAnim, { toValue: 0, duration: 250, useNativeDriver: false }).start();
          Alert.alert('حظر مؤقت 🚫', 'تم إيقاف حسابك من استقبال الطلبات لمدة 24 ساعة بسبب تكرار إلغاء الرحلات بعد قبولها.');
        } else {
          await updateDoc(captainRef, { cancelStrikes: increment(1) });
          Alert.alert('تنبيه ⚠️', `تم تسجيل مخالفة إلغاء. لديك ${currentStrikes + 1} من أصل 3 مخالفات قبل إيقاف حسابك مؤقتاً.`);
        }
      }
      isEndingRide.current = true; // 👈 تفعيل مفتاح الأمان لمنع رسالة الإلغاء الوهمية
      const currentRide = activeRide;
      setActiveRide(null); 
      await updateDoc(doc(db, 'rides', currentRide.id), { status: 'pending', captainId: null, offers: [] }); 
      handleDismissRequest(currentRide); 
    } catch(e) {
      Alert.alert("خطأ", "حدثت مشكلة أثناء الإلغاء");
    }
  };
  const handleCallClick = () => { if (activeRide) { setPhoneToCall(activeRide.phone || activeRide.passengerPhone); setIsCallModalVisible(true); } };
  const makeRegularCall = () => { setIsCallModalVisible(false); Linking.openURL(`tel:${phoneToCall}`); };
  const makeFreeCall = () => { setIsCallModalVisible(false); Alert.alert("مكالمة مجانية", "تتطلب ربط التطبيق بخدمة اتصالات خارجية"); };
  const handleLogout = async () => { await AsyncStorage.removeItem('currentCaptainId'); router.replace('/captain-login'); };

  const handleDismissRequest = async (item: any) => {
    const newDismissed = { ...dismissedRequests, [item.id]: { price: item.price, pickupLocation: item.pickupLocation, destinationLocation: item.destinationLocation } };
    setDismissedRequests(newDismissed);
    await AsyncStorage.setItem('dismissed_requests', JSON.stringify(newDismissed));
  };

  const openChatScreen = async () => {
    if (activeRide) {
      setUnreadChatCount(0);
      await updateDoc(doc(db, 'rides', activeRide.id), { unreadCountCaptain: 0 });
      router.push({ pathname: '/chat', params: { senderType: 'captain', rideId: activeRide.id } });
    }
  };

  const displayRequests = allRequests.filter(req => {
    const dismissedInfo = dismissedRequests[req.id];
    if (!dismissedInfo) return true;
    return req.price !== dismissedInfo.price || req.pickupLocation !== dismissedInfo.pickupLocation || req.destinationLocation !== dismissedInfo.destinationLocation;
  }).sort((a, b) => {
    // 👈 ترتيب المشاوير حسب الأقرب لموقع الكابتن الحالي
    if (captainLocation && a.pickupCoords && b.pickupCoords) {
      const distA = calculateDistance(captainLocation.latitude, captainLocation.longitude, a.pickupCoords.latitude, a.pickupCoords.longitude);
      const distB = calculateDistance(captainLocation.latitude, captainLocation.longitude, b.pickupCoords.latitude, b.pickupCoords.longitude);
      return distA - distB; // الأقرب يظهر في الأعلى
    }
    // لو الموقع غير متاح لسبب ما، يتم الترتيب حسب الأحدث كبديل احتياطي
    return b.timestamp - a.timestamp;
  });

  return (
    <View style={styles.container}>
      {toastVisible && (
        <Animated.View style={[styles.toastContainer, { opacity: toastOpacity, transform: [{ translateY: toastTranslateY }] }]}>
          <Text style={styles.toastText}>رسالة جديدة من الراكب</Text>
        </Animated.View>
      )}
      <View style={styles.header}>
        <View style={styles.userInfo}>
          <TouchableOpacity style={styles.profileClickable} onPress={() => router.push('/captain-profile')}>
            <Image source={{ uri: captainProfile.avatar }} style={styles.profileAvatar} />
            <View>
              <Text style={styles.headerCaptainName} numberOfLines={1}>{captainProfile.name ? captainProfile.name.split(' ')[0] : 'كابتن'}</Text>
              <View style={{ flexDirection: 'row-reverse', marginTop: 2, marginRight: 6 }}>
                {[1, 2, 3, 4, 5].map((star) => (<Text key={star} style={{ color: star <= Math.round(captainProfile.averageRating) ? '#f59e0b' : '#cbd5e1', fontSize: 13 }}>★</Text>))}
              </View>
            </View>
          </TouchableOpacity>
          <TouchableOpacity style={styles.walletDisplayContainer} onPress={() => router.push('/captain-wallet')}>
            <Text style={styles.walletTitle}>المحفظة</Text>
            <Text style={[styles.walletAmount, { color: '#10b981' }]}>{captainProfile.walletBalance ? captainProfile.walletBalance.toFixed(2) : '0.00'}</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity activeOpacity={0.9} style={[styles.toggleContainer, { backgroundColor: isOnline ? '#10b981' : '#ef4444', borderColor: isOnline ? '#10b981' : '#ef4444' }]} onPress={toggleOnlineStatus}>
          <Text style={[styles.toggleText, isOnline ? { marginLeft: 26 } : { marginRight: 26 }]}>{isOnline ? 'متصل' : 'غير متصل'}</Text>
          <Animated.View style={[styles.toggleCircle, { transform: [{ translateX: toggleAnim.interpolate({ inputRange: [0, 100], outputRange: [0, -56] }) }] }]} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.headerMenuBtn} onPress={openSidebar}>
          <Text style={styles.headerMenuText}>≡</Text>
        </TouchableOpacity>
      </View>
      
      {!activeRide ? (
        <>
          {isOnline && (
            <View style={styles.destinationFilterContainer}>
              <View style={styles.filterHeaderRow}>
                <Text style={styles.filterTitle}>مشوار في سكتي 📍</Text>
                <TouchableOpacity onPress={() => {
                  const nextState = !isDestinationFilterActive;
                  setIsDestinationFilterActive(nextState);
                  if (!nextState) {
                    setConfirmedDestinationFilter('');
                    setDestinationFilterText('');
                  }
                }} style={[styles.filterToggle, isDestinationFilterActive ? styles.filterToggleActive : { backgroundColor: '#e2e8f0' }]}>
                  <Text style={[styles.filterToggleText, isDestinationFilterActive && styles.filterToggleTextActive]}>
                    {isDestinationFilterActive ? 'مُفعل' : 'غير مُفعل'}
                  </Text>
                </TouchableOpacity>
              </View>

              {isDestinationFilterActive && (
                 <View style={{marginTop: 10}}>
                   <TextInput 
                      style={[
                        styles.filterInput, 
                        (confirmedDestinationFilter && destinationFilterText === confirmedDestinationFilter) ? styles.filterInputConfirmed : {}
                      ]}
                      placeholder="أدخل الوجهة (مثال: الحي المتميز)..."
                      placeholderTextColor="#94a3b8"
                      value={destinationFilterText}
                      onChangeText={setDestinationFilterText}
                      textAlign="right"
                   />
                   <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }} >
                     {['الحي المتميز', 'دار مصر', 'سكن مصر', 'الإسكان الاجتماعي', 'الحي الأول', 'الحي الثاني', 'الحي الثالث', 'الجامعة الروسية', 'جامعة بدر', 'المنطقة الصناعية'].map((area, idx) => (
                       <TouchableOpacity 
                         key={idx} 
                         style={[styles.areaChip, destinationFilterText === area && styles.areaChipActive]}
                         onPress={() => setDestinationFilterText(area)}
                       >
                         <Text style={[styles.areaChipText, destinationFilterText === area && styles.areaChipTextActive]}>{area}</Text>
                       </TouchableOpacity>
                     ))}
                   </ScrollView>

                   {destinationFilterText.trim() !== '' && destinationFilterText !== confirmedDestinationFilter && (
                     <TouchableOpacity 
                       style={{backgroundColor: '#2563eb', padding: 12, borderRadius: 10, alignItems: 'center', marginTop: 10}}
                       onPress={() => {
                         setConfirmedDestinationFilter(destinationFilterText);
                         Alert.alert("تم التأكيد بنجاح", `تطبيقك الآن مبرمج لاستقبال المشاوير المتجهة إلى: ${destinationFilterText} فقط.`);
                       }}
                     >
                       <Text style={{color: '#ffffff', fontWeight: 'bold', fontSize: 15}}>تأكيد الوجهة للبحث</Text>
                     </TouchableOpacity>
                   )}
                 </View>
              )}
            </View>
          )}
          <Text style={styles.sectionTitle}>الطلبات المتاحة حالياً</Text>
          {!isOnline ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>أنت الآن غير متصل</Text>
              <Text style={{ fontSize: 13, color: '#94a3b8', marginTop: 5 }}>فعل زر الاتصال بالأعلى لاستقبال الطلبات</Text>
            </View>
          ) : displayRequests.length === 0 ? (
            <EmptySearchingState hasConfirmedDestination={isDestinationFilterActive && confirmedDestinationFilter !== ''} />
          ) : (
            <FlatList data={displayRequests} keyExtractor={(item) => item.id} renderItem={({ item }) => <SwipeableRequestItem item={item} onSendOffer={sendOffer} onEditPrice={openPriceModal} onDismiss={handleDismissRequest} hasSentOffer={sentOffers.includes(item.id)} captainLocation={captainLocation} onImagePress={handleImagePress} onWithdrawOffer={withdrawOffer} />} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }} />
          )}
        </>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
          <View style={[styles.activeRideContainer, (activeRide.status === 'passenger_on_the_way' || activeRide.status === 'in_progress') && styles.activeRidePulseContainer]}>
            {latestMessage ? (
              <View style={{ backgroundColor: '#1e293b', padding: 15, borderRadius: 12, marginBottom: 15, flexDirection: 'row-reverse', alignItems: 'center' }}>
                <Text style={{ fontSize: 22, marginLeft: 10 }}>💬</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#94a3b8', fontSize: 11, textAlign: 'right', marginBottom: 2 }}>أحدث رسالة من الراكب :</Text>
                  <Text style={{ color: '#ffffff', fontSize: 14, fontWeight: 'bold', textAlign: 'right' }} numberOfLines={2}>{latestMessage}</Text>
                </View>
              </View>
            ) : null}
            <Text style={styles.activeRideTitle}>
              {activeRide.status === 'accepted' ? 'أنت الآن في طريقك للراكب' : activeRide.status === 'passenger_on_the_way' ? 'الراكب نازل الآن' : activeRide.status === 'captain_arrived' ? 'لقد وصلت للراكب' : activeRide.status === 'waiting_for_scan' ? 'بانتظار مسح الـ QR' : 'الرحلة جارية الآن'}
            </Text>
            <View style={styles.passengerCard}>
              <Image source={{ uri: activeRide.avatar || 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png' }} style={styles.activeAvatar} />
              <View style={styles.detailsCol}>
                <Text style={styles.detailsText}>الراكب: {activeRide.name}</Text>
                <View style={{ flexDirection: 'row-reverse', justifyContent: 'flex-start', marginBottom: 4 }}>
                  {[1, 2, 3, 4, 5].map((star) => (<Text key={star} style={{ color: star <= Math.round(activeRide.passengerRating || 5) ? '#f59e0b' : '#cbd5e1', fontSize: 14 }}>★</Text>))}
                </View>
              </View>
            </View>
            {activeRide.status !== 'in_progress' ? (
              <View style={styles.navigationContainer}>
                <Text style={styles.navigationHeader}>نقطة التقابل (مكان الراكب):</Text>
                <TouchableOpacity style={styles.navButton} onPress={() => {
                  if (activeRide.pickupCoords && activeRide.pickupCoords.latitude) {
                    Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${activeRide.pickupCoords.latitude},${activeRide.pickupCoords.longitude}`);
                  } else {
                    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(activeRide.pickupLocation)}`);
                  }
                }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.navButtonTitle}>اضغط لفتح خريطة جوجل</Text>
                    <Text style={styles.navButtonText} numberOfLines={2}>{activeRide.pickupLocation}</Text>
                  </View>
                  <Text style={[styles.navIcon, {backgroundColor: '#3b82f6'}]}>📍 تتبع</Text>
                </TouchableOpacity>
                <Text style={[styles.priceTagActive, {marginTop: 10}]}>الأجرة المتفق عليها: {activeRide.price} جنيه</Text>
              </View>
            ) : (
              <View style={styles.navigationContainer}>
                <Text style={styles.navigationHeader}>مسار الرحلة (اضغط للتتبع):</Text>
                {activeRide.destinationsList && activeRide.destinationsList.map((d: string, i: number) => (
                  <TouchableOpacity key={i} style={styles.navButton} onPress={() => openGoogleMaps(d)}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.navButtonTitle}>الوجهة {i + 1}</Text>
                      <Text style={styles.navButtonText}>{d}</Text>
                    </View>
                    <Text style={styles.navIcon}>📍</Text>
                  </TouchableOpacity>
                ))}
                <Text style={styles.priceTagActive}>الأجرة المستحقة لك: {activeRide.price} جنيه</Text>
              </View>
            )}
            <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 15 }}>
              <TouchableOpacity style={[styles.actionBtnCall, { flex: 1, marginLeft: 5 }]} onPress={handleCallClick}>
                <Text style={styles.actionBtnText}>اتصال</Text>
              </TouchableOpacity>
              <AnimatedTouchableOpacity style={[styles.actionBtnChat, { flex: 1, marginRight: 5, backgroundColor: unreadChatCount > 0 ? chatBackgroundColor : '#8b5cf6' }]} onPress={openChatScreen}>
                <Text style={styles.actionBtnText}>مراسلة</Text>
                {unreadChatCount > 0 && <View style={styles.badgeContainer}><Text style={styles.badgeText}>{unreadChatCount}</Text></View>}
              </AnimatedTouchableOpacity>
            </View>
            {activeRide.status === 'accepted' ? (
              <TouchableOpacity style={styles.arriveButton} onPress={notifyArrival}>
                <Text style={styles.arriveButtonText}>إبلاغ بالوصول</Text>
              </TouchableOpacity>
            ) : activeRide.status === 'captain_arrived' || activeRide.status === 'passenger_on_the_way' ? (
              <TouchableOpacity style={styles.startButton} onPress={generateAndShowQR}>
                <Text style={styles.startButtonText}>تأكيد بدء الرحلة (QR) أو الكود</Text>
              </TouchableOpacity>
            ) : activeRide.status === 'in_progress' ? (
              <TouchableOpacity style={styles.completeButton} onPress={completeRide}>
                <Text style={styles.completeButtonText}>إنهاء المشوار واستلام الكاش</Text>
              </TouchableOpacity>
            ) : null}
            {activeRide.status !== 'in_progress' && (
              <TouchableOpacity style={styles.cancelRideBtn} onPress={() => Alert.alert("التراجع عن الرحلة", "هل أنت متأكد؟ (قد يعرضك لحظر مؤقت إذا تكرر)", [{ text: 'لا', style: 'cancel' }, { text: 'نعم', onPress: cancelRideByCaptain }])}>
                <Text style={styles.cancelRideBtnText}>التراجع عن الرحلة</Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      )}

      <Modal visible={isTuktukTypeModalVisible} transparent={true} animationType="fade">
        <View style={styles.modalOverlayAdmin}>
          <View style={styles.adminMsgModalContent}>
            <Text style={{ fontSize: 45, marginBottom: 10 }}>🛺</Text>
            <Text style={[styles.adminMsgTitle, { color: '#2563eb' }]}>تحديث هام لمركبتك!</Text>
            <Text style={styles.adminMsgText}>
              لضمان وصول الطلبات الصحيحة إليك، يرجى تحديد سعة مركبتك بدقة حتى تتمكن من استقبال الطلبات.
            </Text>
            
            <View style={{ flexDirection: 'row-reverse', gap: 10, width: '100%', marginBottom: 25 }}>
              <TouchableOpacity 
                style={[styles.vTypeBtn, selectedTuktukType === 'كيوت 3 راكب' && styles.vTypeBtnActive]} 
                onPress={() => setSelectedTuktukType('كيوت 3 راكب')}
              >
                <Text style={[styles.vTypeText, selectedTuktukType === 'كيوت 3 راكب' && styles.vTypeTextActive]}>كيوت 3 راكب</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.vTypeBtn, selectedTuktukType === 'جالاكسي 7 راكب' && styles.vTypeBtnActive]} 
                onPress={() => setSelectedTuktukType('جالاكسي 7 راكب')}
              >
                <Text style={[styles.vTypeText, selectedTuktukType === 'جالاكسي 7 راكب' && styles.vTypeTextActive]}>جالاكسي 7 راكب</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={[styles.adminMsgCloseBtn, { backgroundColor: '#2563eb' }]} onPress={saveNewTuktukType}>
              <Text style={[styles.adminMsgCloseText, { color: '#ffffff' }]}>حفظ ومتابعة</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={activeRide?.status === 'waiting_for_scan'} transparent={true} animationType="slide">
        <View style={styles.modalOverlayQR}>
          <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }} keyboardShouldPersistTaps="handled">
            <View style={styles.qrModalContent}>
              <Text style={styles.qrTitle}>أمان الرحلة</Text>
              <Text style={styles.qrSubtitle}>اطلب من الراكب مسح الكود، أو أدخل الرقم السري الموجود بتطبيقه</Text>
              <View style={styles.qrBox}>
                {activeRide && activeRide.qrSecret && (<QRCode value={JSON.stringify({ rideId: activeRide.id, token: activeRide.qrSecret })} size={150} />)}
              </View>
              <Text style={styles.orTextDivider}>--- أو ---</Text>
              <View style={styles.inputCodeContainer}>
                <TextInput style={styles.numericInput} placeholder="أدخل الكود السري" placeholderTextColor="#94a3b8" keyboardType="numeric" maxLength={7} value={enteredNumericCode} onChangeText={setEnteredNumericCode} textAlign="center" />
                <TouchableOpacity style={styles.verifyCodeBtn} onPress={verifyNumericCode}>
                  <Text style={styles.verifyCodeBtnText}>تأكيد الكود وبدء الرحلة</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity style={styles.qrCancelBtn} onPress={cancelQRScan}>
                <Text style={styles.qrCancelBtnText}>إلغاء والعودة</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
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
              <TouchableOpacity style={styles.sidebarLink} onPress={() => { closeSidebar(); router.push('/captain-wallet'); }}><Text style={styles.sidebarLinkText}>المحفظة</Text></TouchableOpacity>
              <TouchableOpacity style={styles.sidebarLink} onPress={() => { closeSidebar(); router.push('/captain-history'); }}><Text style={styles.sidebarLinkText}>سجل الرحلات</Text></TouchableOpacity>
              <TouchableOpacity style={styles.sidebarLink} onPress={() => { closeSidebar(); router.push('/captain-ratings'); }}><Text style={styles.sidebarLinkText}>التقييمات</Text></TouchableOpacity>
              <TouchableOpacity style={styles.sidebarLink} onPress={() => { closeSidebar(); router.push('/captain-docs'); }}><Text style={styles.sidebarLinkText}>المستندات الرسمية</Text></TouchableOpacity>
              <TouchableOpacity style={styles.sidebarLink} onPress={() => { closeSidebar(); Alert.alert("تنبيه", "سيتم تفعيل الإعدادات قريباً"); }}><Text style={styles.sidebarLinkText}>الإعدادات</Text></TouchableOpacity>
              <TouchableOpacity style={styles.sidebarLink} onPress={() => { closeSidebar(); router.push('/support'); }}><Text style={styles.sidebarLinkText}>الدعم الفني</Text></TouchableOpacity>
              <TouchableOpacity style={styles.sidebarLink} onPress={() => { closeSidebar(); router.push('/captain-complaints'); }}><Text style={styles.sidebarLinkText}>المقترحات والشكاوى</Text></TouchableOpacity>
            </ScrollView>
            <TouchableOpacity style={styles.sidebarLogoutBtn} onPress={handleLogout}><Text style={styles.sidebarLogoutText}>تسجيل الخروج</Text></TouchableOpacity>
          </Animated.View>
        </View>
      </Modal>

      <Modal visible={isAdminMsgVisible} transparent={true} animationType="fade">
        <View style={styles.modalOverlayAdmin}>
          <View style={styles.adminMsgModalContent}>
            <Text style={styles.adminMsgIcon}>🔔</Text>
            <Text style={styles.adminMsgAlertText}>من الإدارة</Text>
            <Text style={styles.adminMsgTitle}>{adminMessage?.title}</Text>
            <Text style={styles.adminMsgText}>{adminMessage?.message}</Text>
            <TouchableOpacity style={styles.adminMsgCloseBtn} onPress={markAdminMessageAsRead}>
              <Text style={styles.adminMsgCloseText}>حسناً، قرأتها</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={isPriceModalVisible} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>تقديم عرض سعر</Text>
            <TextInput style={styles.modalInput} value={tempCaptainPrice} onChangeText={setTempCaptainPrice} keyboardType="numeric" placeholder="اكتب السعر هنا" placeholderTextColor="#94a3b8" />
            
            {/* 👈 زراير المميزات التنافسية */}
            <Text style={{ textAlign: 'right', fontWeight: 'bold', color: '#475569', marginBottom: 8, fontSize: 13 }}>أضف مميزات لرحلتك لجذب الراكب (اختياري):</Text>
            <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
              {availablePerks.map(perk => {
                const isSelected = offerPerks.includes(perk);
                return (
                  <TouchableOpacity 
                    key={perk} 
                    style={[styles.perkBtn, isSelected && styles.perkBtnActive]} 
                    onPress={() => setOfferPerks(prev => isSelected ? prev.filter(p => p !== perk) : [...prev, perk])}
                  >
                    <Text style={[styles.perkText, isSelected && styles.perkTextActive]}>{perk}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

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
      <Modal visible={isCallModalVisible} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.callModalContent}>
            <Text style={styles.modalTitle}>اختر طريقة الاتصال</Text>
            <TouchableOpacity style={styles.regularCallBtn} onPress={makeRegularCall}>
              <Text style={styles.regularCallBtnText}>مكالمة عادية (شبكة المحمول)</Text>
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

      <Modal visible={isRatingModalVisible} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.ratingModalContent}>
            {!ratingSubmitted ? (
              <>
                <Text style={[styles.modalTitle, { fontSize: 20, marginBottom: 5 }]}>كيف كانت الرحلة ؟</Text>
                <Text style={{ textAlign: 'center', color: '#64748b', fontSize: 13, marginBottom: 15 }}>تقييمك للراكب يساعدنا في تحسين الخدمة</Text>
                <View style={styles.starsRow}>
                  {[1, 2, 3, 4, 5].map((s) => (
                    <TouchableOpacity key={s} onPress={() => setRating(s)}>
                      <Text style={[styles.starText, { color: s <= rating ? '#f59e0b' : '#cbd5e1' }]}>★</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {rating === 5 && (
                  <View style={{ marginBottom: 15 }}>
                    <Text style={{ color: '#10b981', fontSize: 16, fontWeight: 'bold', textAlign: 'center', marginBottom: 10 }}>شكراً لك! اختر مميزات الراكب:</Text>
                    <View style={styles.tagsContainer}>
                      {captainRatingTags.map(tag => {
                        const isSelected = selectedTags.includes(tag);
                        return (
                          <TouchableOpacity 
                            key={tag} 
                            style={[styles.tagBtn, isSelected && styles.tagBtnActive]} 
                            onPress={() => setSelectedTags(prev => isSelected ? prev.filter(t => t !== tag) : [...prev, tag])}
                          >
                            <Text style={[styles.tagText, isSelected && styles.tagTextActive]}>{tag}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                )}
                {rating > 0 && (
                  <TextInput 
                    style={styles.reasonInput} 
                    placeholder={rating === 5 ? "تعليق إضافي (اختياري)..." : "ما هو سبب تقييمك؟ (إلزامي)"} 
                    placeholderTextColor="#94a3b8" 
                    value={ratingReason} 
                    onChangeText={setRatingReason} 
                    multiline={true} 
                  />
                )}
                <TouchableOpacity style={styles.submitRatingBtn} onPress={submitRating}>
                  <Text style={styles.submitRatingBtnText}>إرسال التقييم</Text>
                </TouchableOpacity>
              </>
            ) : (
              <View style={styles.successRatingContainer}>
                <Text style={styles.successRatingIcon}>✅</Text>
                <Text style={styles.successRatingText}>تم التقييم بنجاح</Text>
              </View>
            )}
          </View>
        </View>
      </Modal>

      <Modal visible={!!enlargedAvatar} transparent={true} animationType="fade">
        <View style={styles.avatarModalOverlay}>
          <TouchableOpacity style={styles.avatarModalCloseArea} onPress={() => setEnlargedAvatar(null)} />
          <View style={styles.avatarModalContent}>
            <Image source={{ uri: enlargedAvatar || '' }} style={styles.enlargedAvatarImg} resizeMode="cover" />
            <TouchableOpacity style={styles.closeEnlargedBtn} onPress={() => setEnlargedAvatar(null)}>
              <Text style={styles.closeEnlargedBtnText}>إغلاق ✖</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  avatarModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center' },
  avatarModalCloseArea: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 },
  avatarModalContent: { backgroundColor: '#1e293b', borderRadius: 20, padding: 20, alignItems: 'center', elevation: 10, borderWidth: 2, borderColor: '#3b82f6' },
  enlargedAvatarImg: { width: 250, height: 250, borderRadius: 125, marginBottom: 20, borderWidth: 3, borderColor: '#eab308', backgroundColor: '#cbd5e1' },
  closeEnlargedBtn: { backgroundColor: '#ef4444', paddingVertical: 12, paddingHorizontal: 40, borderRadius: 12 },
  closeEnlargedBtnText: { color: '#ffffff', fontWeight: 'bold', fontSize: 16 },

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
  
  destinationFilterContainer: { backgroundColor: '#ffffff', padding: 15, borderRadius: 12, marginBottom: 15, borderWidth: 1, borderColor: '#cbd5e1', elevation: 1, zIndex: 10 },
  filterHeaderRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' },
  filterTitle: { fontSize: 15, fontWeight: 'bold', color: '#0f172a' },
  filterToggle: { backgroundColor: '#e2e8f0', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20 },
  filterToggleActive: { backgroundColor: '#10b981' },
  filterToggleText: { color: '#64748b', fontSize: 12, fontWeight: 'bold' },
  filterToggleTextActive: { color: '#ffffff' },
  filterInput: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, padding: 10, fontSize: 14, marginTop: 10, color: '#0f172a', textAlign: 'right' },
  filterInputConfirmed: { backgroundColor: '#dcfce7', borderColor: '#86efac', color: '#166534', fontWeight: 'bold' },
  areaChip: { backgroundColor: '#f1f5f9', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 16, marginRight: 8, borderWidth: 1, borderColor: '#e2e8f0' },
  areaChipActive: { backgroundColor: '#2563eb', borderColor: '#1d4ed8' },
  areaChipText: { fontSize: 13, color: '#475569', fontWeight: 'bold' },
  areaChipTextActive: { color: '#ffffff' },
  suggestionsBox: { backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, marginTop: 5, maxHeight: 150, elevation: 3 },
  suggestionItem: { padding: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  suggestionItemText: { fontSize: 14, color: '#334155', textAlign: 'right' },

  vTypeBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#cbd5e1' },
  vTypeBtnActive: { backgroundColor: '#eff6ff', borderColor: '#3b82f6', borderWidth: 2 },
  vTypeText: { fontSize: 14, fontWeight: 'bold', color: '#64748b', textAlign: 'center' },
  vTypeTextActive: { color: '#2563eb' },

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
  hiddenBackground: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: '#fee2e2', borderRadius: 16, justifyContent: 'center', alignItems: 'flex-end', paddingRight: 20 },  
  hiddenText: { color: '#ef4444', fontWeight: 'bold', fontSize: 16 },
  requestCard: { backgroundColor: '#ffffff', padding: 12, borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', elevation: 3 },
  topSplitContainer: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  passengerRightSide: { width: 85, alignItems: 'center', borderLeftWidth: 1, borderColor: '#f1f5f9', paddingLeft: 8 },
  passengerAvatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#cbd5e1', marginBottom: 4 },
  passengerName: { fontSize: 13, fontWeight: 'bold', color: '#0f172a', textAlign: 'center' },
  distanceBadgeCard: { backgroundColor: '#f0fdf4', paddingVertical: 6, paddingHorizontal: 8, borderRadius: 8, borderWidth: 1, borderColor: '#bbf7d0', marginTop: 6, width: '100%', alignItems: 'center' },
  distanceBadgeTextCard: { color: '#166534', fontSize: 11, fontWeight: 'bold', textAlign: 'center' },
  
  routeLeftSide: { flex: 1, paddingRight: 10, justifyContent: 'center', paddingTop: 5 },
  routeItemBox: { flexDirection: 'row-reverse', alignItems: 'flex-start', marginBottom: 10 },
  routeIconText: { fontSize: 14, marginLeft: 8, marginTop: 3 },
  routeMainText: { flex: 1, fontSize: 16, color: '#0f172a', fontWeight: '900', textAlign: 'right', lineHeight: 24 },
  routeDestText: { flex: 1, fontSize: 15, color: '#334155', fontWeight: 'bold', textAlign: 'right', lineHeight: 22 },
  
  passengerCountBadge: { backgroundColor: '#fef9c3', paddingVertical: 4, paddingHorizontal: 8, borderRadius: 8, marginBottom: 8, alignSelf: 'flex-end', borderWidth: 1, borderColor: '#fde047' },
  passengerCountText: { color: '#a16207', fontSize: 12, fontWeight: 'bold' },

  notesContainer: { backgroundColor: '#fef3c7', padding: 8, borderRadius: 8, marginBottom: 8, borderWidth: 1, borderColor: '#fcd34d' },
  notesText: { fontSize: 13, color: '#d97706', fontWeight: 'bold', textAlign: 'right' },
  priceAndPaymentRow: { flexDirection: 'row-reverse', justifyContent: 'center', alignItems: 'center', gap: 15, marginBottom: 10, marginTop: 5 },
  largePriceTag: { fontSize: 24, color: '#10b981', fontWeight: 'bold', textAlign: 'center' },
  paymentBadgeAlert: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, borderWidth: 2, elevation: 3, shadowColor: '#000', shadowOffset: {width: 0, height: 2}, shadowOpacity: 0.2 },
  paymentBadgeTextAlert: { color: '#ffffff', fontSize: 14, fontWeight: 'bold', textShadowColor: 'rgba(0,0,0,0.3)', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 2 },
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
  tagsContainer: { flexDirection: 'row-reverse', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 5 },
  tagBtn: { backgroundColor: '#f1f5f9', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20, borderWidth: 1, borderColor: '#cbd5e1' },
  tagBtnActive: { backgroundColor: '#10b981', borderColor: '#059669' },
  tagText: { color: '#475569', fontSize: 13, fontWeight: 'bold' },
  tagTextActive: { color: '#ffffff' },
  submitRatingBtn: { backgroundColor: '#2563eb', width: '100%', paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginTop: 5 },
  submitRatingBtnText: { color: '#ffffff', fontSize: 16, fontWeight: 'bold' },
  successRatingContainer: { alignItems: 'center', paddingVertical: 20 },
  successRatingIcon: { fontSize: 50, marginBottom: 15 },
  successRatingText: { fontSize: 18, fontWeight: 'bold', color: '#1e293b', textAlign: 'center', lineHeight: 28 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#1e293b', marginBottom: 10, textAlign: 'center' },
  modalInput: { backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 12, padding: 12, fontSize: 16, fontWeight: 'bold', color: '#0f172a', textAlign: 'center', marginBottom: 15 },
  perkBtn: { backgroundColor: '#f8fafc', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: '#cbd5e1' },
  perkBtnActive: { backgroundColor: '#dbeafe', borderColor: '#3b82f6' },
  perkText: { color: '#475569', fontSize: 12, fontWeight: 'bold' },
  perkTextActive: { color: '#1d4ed8' },
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
  modalOverlayQR: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)' },
  qrModalContent: { backgroundColor: '#ffffff', width: '90%', alignSelf: 'center', padding: 25, borderRadius: 24, alignItems: 'center', elevation: 10 },
  qrTitle: { fontSize: 22, fontWeight: 'bold', color: '#1e293b', marginBottom: 8 },
  qrSubtitle: { fontSize: 13, color: '#64748b', textAlign: 'center', marginBottom: 20, lineHeight: 22 },
  qrBox: { padding: 10, backgroundColor: '#f8fafc', borderRadius: 16, borderWidth: 2, borderColor: '#e2e8f0' },
  orTextDivider: { color: '#64748b', fontWeight: 'bold', marginVertical: 15 },
  inputCodeContainer: { width: '100%', alignItems: 'center' },
  numericInput: { width: '100%', backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 12, padding: 12, fontSize: 18, fontWeight: 'bold', letterSpacing: 2, color: '#0f172a', marginBottom: 10 },
  verifyCodeBtn: { backgroundColor: '#10b981', width: '100%', paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  verifyCodeBtnText: { color: '#ffffff', fontWeight: 'bold', fontSize: 16 },
  qrWaitingText: { marginTop: 10, color: '#475569', fontSize: 14, fontWeight: 'bold' },
  qrCancelBtn: { marginTop: 20, paddingVertical: 10, paddingHorizontal: 25, backgroundColor: '#fee2e2', borderRadius: 10 },
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
  sidebarPanel: { width: '75%', backgroundColor: '#ffffff', height: '100%', elevation: 15, shadowColor: '#000', shadowOffset: { width: 3, height: 0 }, shadowOpacity: 0.3, shadowRadius: 5 },
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