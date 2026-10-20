import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import { useFocusEffect, usePathname, useRouter } from 'expo-router';
import { addDoc, collection, doc, getDoc, getDocs, limit, onSnapshot, orderBy, query, setDoc, updateDoc, where } from 'firebase/firestore';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Dimensions, Image, KeyboardAvoidingView, Linking, LogBox, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, Vibration, View } from 'react-native';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import MapViewDirections from 'react-native-maps-directions';
import { db } from '../firebase';
import { useApp } from './AppContext';

LogBox.ignoreLogs(['VirtualizedLists should never be nested']);

const GOOGLE_MAPS_APIKEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || "";
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
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c * 1000; 
};

// ================= كارت عرض الكابتن =================
const PassengerOfferCard = ({ offer, onAcceptOffer, onRejectOffer, isDarkMode, requestedPrice }: any) => {
  const progressAnim = useRef(new Animated.Value(100)).current;

  useEffect(() => {
    const now = new Date().getTime();
    const offerTime = offer.offerTimestamp || now;
    const elapsed = now - offerTime;
    const remaining = Math.max(30000 - elapsed, 0);

    progressAnim.setValue((remaining / 30000) * 100);
    Animated.timing(progressAnim, { toValue: 0, duration: remaining, useNativeDriver: false }).start();
  }, [offer]);

  let vIcon = '🛺';
  if (offer.captainVehicleCategory === 'car' || offer.captainVehicle?.includes('سيارة')) vIcon = '🚗';
  else if (offer.captainVehicleCategory === 'scooter' || offer.captainVehicle?.includes('سكوتر')) vIcon = '🛵';

  return (
    <View style={[styles.offerCardPro, isDarkMode && { backgroundColor: '#1e293b', borderColor: '#334155' }]}>
      <View style={[styles.offerTopRow, isDarkMode && { borderBottomColor: '#334155' }]}>
        <View style={styles.offerCaptainSide}>
          <Image source={{ uri: getSafeAvatar(offer.captainAvatar) }} style={[styles.offerAvatarPro, isDarkMode && { borderColor: '#475569' }]} />
          <View style={styles.offerInfoCol}>
            <Text style={[styles.offerNamePro, isDarkMode && { color: '#ffffff' }]} numberOfLines={1}>{offer.captainName}</Text>
            <View style={{ flexDirection: 'row-reverse', marginTop: 2 }}>
              {[1, 2, 3, 4, 5].map((star) => (
                <Text key={star} style={{ fontSize: 13, color: star <= Math.round(offer.captainRating || 5) ? '#f59e0b' : '#cbd5e1' }}>★</Text>
              ))}
            </View>
          </View>
        </View>
        <View style={[styles.offerActionSide, isDarkMode && { borderRightColor: '#334155' }, { alignItems: 'center' }]}>
          <Text style={styles.offerPricePro}>{offer.price} ج</Text>
          
          {requestedPrice && Number(offer.price) === Number(requestedPrice) && (
            <View style={{backgroundColor: '#dcfce7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, marginBottom: 6, borderWidth: 1, borderColor: '#86efac'}}>
              <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#059669' }}>السعر العادل ⚖️</Text>
            </View>
          )}

          <View style={{ flexDirection: 'row-reverse', gap: 5 }}>
            <TouchableOpacity style={styles.acceptOfferBtnPro} onPress={() => onAcceptOffer(offer)}>
              <Text style={styles.acceptOfferBtnTextPro}>قبول</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.rejectOfferBtnPro} onPress={() => onRejectOffer(offer)}>
              <Text style={styles.rejectOfferBtnTextPro}>رفض</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
      <View style={[styles.offerBottomRow, isDarkMode && { backgroundColor: '#0f172a', borderTopColor: '#334155' }]}>
        <Text style={[styles.offerFullVehicleText, isDarkMode && { color: '#93c5fd' }]} numberOfLines={2}>
          {offer.captainVehicle ? offer.captainVehicle.replace('بديل توكتوك', '').replace(/[()\-]/g, '').trim() || 'كيوت 3 راكب' : 'مركبة'} {offer.captainPlateNumber && offer.captainPlateNumber !== 'لم يسجل لوحة' ? (offer.captainVehicleCategory === 'tuktuk_alt' || offer.captainVehicle?.includes('كيوت') || offer.captainVehicle?.includes('جالاكسي') ? ` | الرقم الكودي للمركبة: (${offer.captainPlateNumber})` : ` | لوحة: ${offer.captainPlateNumber}`) : ''}
        </Text>
        <Text style={styles.offerVehicleIcon}>{vIcon}</Text>
      </View>
      
      {offer.perks && offer.perks.length > 0 && (
        <View style={[styles.offerPerksContainer, isDarkMode && { backgroundColor: '#0f172a' }]}>
          {offer.perks.map((perk: string, idx: number) => (
            <View key={idx} style={[styles.offerPerkBadge, isDarkMode && { backgroundColor: '#1e3a8a', borderColor: '#3b82f6' }]}>
              <Text style={[styles.offerPerkText, isDarkMode && { color: '#bfdbfe' }]}>{perk}</Text>
            </View>
          ))}
        </View>
      )}
      
      <View style={{ width: '100%', height: 4, backgroundColor: isDarkMode ? '#334155' : '#e2e8f0' }}>
        <Animated.View style={{ height: '100%', backgroundColor: '#3b82f6', width: progressAnim.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }) }} />
      </View>
    </View>
  );
};

export default function PassengerHome() {
  const router = useRouter();
  
  const { isDarkMode, toggleTheme, isVibrationEnabled, toggleVibration } = useApp(); 
  const [localVibration, setLocalVibration] = useState(true);
  const [isRideDetailsExpanded, setIsRideDetailsExpanded] = useState(false); // 👈 للتحكم في كارت التفاصيل
  const [isMaintenanceMode, setIsMaintenanceMode] = useState(false);
  const [liveSettings, setLiveSettings] = useState<any>(null); 
  const [isSearchingDetailsExpanded, setIsSearchingDetailsExpanded] = useState(false); // 👈 ده اللي هيقفل ويفتح تفاصيل استقبال العروض
  useEffect(() => {
    const unsubSettings = onSnapshot(doc(db, 'app_settings', 'pricing'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setIsMaintenanceMode(data.maintenanceMode || false);
        setLiveSettings(data); 
      }
    });
    return () => unsubSettings();
  }, []);

  const pathname = usePathname();

  const flashAnim = useRef(new Animated.Value(0)).current;
  const hasShownAlmostArrivedRef = useRef(false);
  const [pickup, setPickup] = useState('');
  const [pickupCoords, setPickupCoords] = useState<any>(null);
  const [destinations, setDestinations] = useState<string[]>(['']);
  const [requestedVehicleType, setRequestedVehicleType] = useState<'car' | 'tuktuk_alt' | 'scooter'>('tuktuk_alt');
  const [requestedTuktukType, setRequestedTuktukType] = useState('كيوت 3 راكب');
  const [passengersCount, setPassengersCount] = useState('1');
  const pickupRef = useRef<any>(null);
  const destRefs = useRef<any>({});
  
  const [isMapPickerVisible, setIsMapPickerVisible] = useState(false);
  const [mapPickerIndex, setMapPickerIndex] = useState<number | null>(null);
  const [mapPickerCoords, setMapPickerCoords] = useState<any>(null);
  const [mapPickerAddress, setMapPickerAddress] = useState('');
  const [isGeocoding, setIsGeocoding] = useState(false);

  const [paymentMethod, setPaymentMethod] = useState('كاش');
  const [price, setPrice] = useState('');
  const [calculatedBasePrice, setCalculatedBasePrice] = useState(0);
  const [basePriceForSuggestions, setBasePriceForSuggestions] = useState(0);
  const [calculatedDistance, setCalculatedDistance] = useState('0');
  const [destinationsPrices, setDestinationsPrices] = useState<number[]>([]); 
  const [isCalculatingPrice, setIsCalculatingPrice] = useState(false);
  const debounceTimer = useRef<any>(null);

  const activeRideScrollRef = useRef<ScrollView>(null); 
  const [notes, setNotes] = useState('');
  const [rideStatus, setRideStatus] = useState<'idle' | 'searching' | 'accepted' | 'captain_arrived' | 'passenger_on_the_way' | 'waiting_for_scan' | 'in_progress'>('idle');
  const [currentRideId, setCurrentRideId] = useState<string | null>(null);
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [tempPrice, setTempPrice] = useState('');

  const [promoCodeInput, setPromoCodeInput] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<any>(null);
  const [isVerifyingPromo, setIsVerifyingPromo] = useState(false);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);

  const [isEditDestModalVisible, setIsEditDestModalVisible] = useState(false);
  const [tempDestinations, setTempDestinations] = useState<string[]>(['']);
  
  const [offers, setOffers] = useState<any[]>([]);
  const [numericSecret, setNumericSecret] = useState('');
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [latestMessage, setLatestMessage] = useState('');
  const latestMsgTimer = useRef<any>(null);

  const [waitingTimeLeft, setWaitingTimeLeft] = useState(300); 
  const [rideArrivedAt, setRideArrivedAt] = useState<number | null>(null);
  const [liveETA, setLiveETA] = useState('جاري الحساب...');
  const [captainLiveCoords, setCaptainLiveCoords] = useState<any>(null); 
  
  const [isCallModalVisible, setIsCallModalVisible] = useState(false);
  const [phoneToCall, setPhoneToCall] = useState('');
  const [isFetchingLocation, setIsFetchingLocation] = useState(false);
  const [isSendingLocation, setIsSendingLocation] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [emergencyPhone, setEmergencyPhone] = useState('');
  const [isEmergencyModalVisible, setIsEmergencyModalVisible] = useState(false);
  const [tempEmergencyPhone, setTempEmergencyPhone] = useState('');

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const sidebarAnim = useRef(new Animated.Value(SCREEN_WIDTH)).current;

  const [isRatingModalVisible, setIsRatingModalVisible] = useState(false);
  const [rating, setRating] = useState(0);
  const [ratingReason, setRatingReason] = useState('');
  const [ratingSubmitted, setRatingSubmitted] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const passengerRatingTags = ['كابتن مهذب', 'مركبة نظيفة', 'قيادة آمنة', 'موسيقى جيدة'];
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

  const [passengerProfile, setPassengerProfile] = useState({ id: '', name: 'جار التحميل...', phone: '', avatar: DEFAULT_AVATAR, averageRating: 5, ratingCount: 0, hidePhoneNumber: false });  
  const [captainInfo, setCaptainInfo] = useState({ name: '', vehicle: 'توكتوك', phone: '', avatar: DEFAULT_AVATAR, vehicleImage: '', plateNumber: '' });
  const [unreadNotifsCount, setUnreadNotifsCount] = useState(0);

  const vehicleImageAnim = useRef(new Animated.Value(1)).current;
  const prevOffersCountRef = useRef(0);
  const [actionAfterSave, setActionAfterSave] = useState(false);
  const [autoAcceptEnabled, setAutoAcceptEnabled] = useState(false);

  useEffect(() => {
    if (liveSettings && pickup && destinations.length > 0 && destinations[0].trim() !== '') {
      updatePriceCalculation(pickup, destinations, requestedVehicleType, passengersCount, pickupCoords);
    }
  }, [liveSettings]);

  useEffect(() => {
    if(captainLiveCoords && pickupCoords && rideStatus === 'accepted') {
        fetch(`https://maps.googleapis.com/maps/api/directions/json?origin=${captainLiveCoords.latitude},${captainLiveCoords.longitude}&destination=${pickupCoords.latitude},${pickupCoords.longitude}&key=${GOOGLE_MAPS_APIKEY}&language=ar`)
        .then(res => res.json())
        .then(data => { if (data.routes && data.routes.length > 0) setLiveETA(data.routes[0].legs[0].duration.text); })
        .catch(e => console.log(e));
    }
  }, [captainLiveCoords, pickupCoords, rideStatus]);

  const openMapForDestination = (index: number) => {
    setMapPickerIndex(index);
    const startCoords = pickupCoords || { latitude: 30.0444, longitude: 31.2357 };
    setMapPickerCoords(startCoords);
    setMapPickerAddress(destinations[index] || '');
    setIsMapPickerVisible(true);
  };

  useEffect(() => {
    const savePriceLocally = async () => {
      if (price && price !== '0') {
        try {
          const savedRide = await AsyncStorage.getItem('active_ride');
          if (savedRide) {
            const data = JSON.parse(savedRide);
            data.price = price;
            await AsyncStorage.setItem('active_ride', JSON.stringify(data));
          }
        } catch (e) {}
      }
    };
    savePriceLocally();
  }, [price]);

  useFocusEffect(
    useCallback(() => {
      const getLocalPrice = async () => {
        try {
          const savedRide = await AsyncStorage.getItem('active_ride');
          if (savedRide) {
            const data = JSON.parse(savedRide);
            if (data.price && (!price || price === '0')) {
              setPrice(data.price.toString());
            }
          }
        } catch (e) {}
      };
      getLocalPrice();
    }, [])
  );
  
  useEffect(() => {
    if (currentRideId && rideStatus === 'searching' && price) {
      updateDoc(doc(db, 'rides', currentRideId), { 
        price: price.toString(),
        fairPrice: calculatedBasePrice || parseInt(price), 
        timestamp: new Date().getTime() 
      }).catch((e) => console.log('Price Sync Error:', e));
    }
  }, [price, calculatedBasePrice, currentRideId, rideStatus]);

  const saveNewDestinations = async () => {
    const validDests = tempDestinations.filter(d => d.trim().length > 0);
    if (validDests.length === 0) return Alert.alert('تنبيه', 'يجب إدخال وجهة واحدة على الأقل');
    
    setIsEditDestModalVisible(false);
    setDestinations(validDests);
    
    setPrice(modalPrice);
    setCalculatedBasePrice(modalBasePrice);
    setBasePriceForSuggestions(modalBasePrice);
    
    updatePriceCalculation(pickup, validDests, requestedVehicleType, passengersCount, pickupCoords);
    
    if (currentRideId && ['searching', 'accepted', 'captain_arrived', 'in_progress'].includes(rideStatus)) {
      await updateDoc(doc(db, 'rides', currentRideId), {
        destinationsList: validDests,
        destinationLocation: validDests.join(' - '),
        price: modalPrice,
        fairPrice: modalBasePrice 
      });
      if (rideStatus !== 'searching') {
        Alert.alert('تم التحديث ✅', 'تم تحديث الوجهة والسعر بنجاح.');
      }
    }
  };

  const calculateTieredPrice = (distanceKm: number, tiers: any[]) => {
    if (!tiers || tiers.length === 0) return 0;
    const sortedTiers = [...tiers].sort((a, b) => parseFloat(a.upToKm) - parseFloat(b.upToKm));
    
    let totalFare = 0;
    let remainingDistance = distanceKm;
    let previousTierLimit = 0;

    for (let i = 0; i < sortedTiers.length; i++) {
      const currentTierLimit = parseFloat(sortedTiers[i].upToKm);
      const tierPricePerKm = parseFloat(sortedTiers[i].price);
      const distanceInThisTier = Math.min(remainingDistance, currentTierLimit - previousTierLimit);
      
      if (distanceInThisTier > 0) {
        totalFare += distanceInThisTier * tierPricePerKm;
        remainingDistance -= distanceInThisTier;
      }
      
      previousTierLimit = currentTierLimit;
      if (remainingDistance <= 0) break;
    }
    return totalFare;
  };

  const updatePriceCalculation = async (pickupText: string, dests: string[], vType: string = requestedVehicleType, passCountStr: string = passengersCount, overrideStartCoords: any = null, isTempModal = false) => {
    const validDests = dests.filter(d => d.trim().length > 0);
    if (pickupText.trim().length > 0 && validDests.length > 0) {
      if (isTempModal) setIsModalCalculating(true); else setIsCalculatingPrice(true);
      try {
        let startCoords = overrideStartCoords || pickupCoords;
        if (!startCoords && pickupText !== 'موقعي الحالي') {
          startCoords = await getCoordinatesFromText(pickupText);
        }
        if (!startCoords) startCoords = { latitude: 30.0444, longitude: 31.2357 };

        let totalDistanceKm = 0;
        let googleSuccess = false;

        let destsCoords: any[] = [];
        for (let dest of validDests) {
          const coords = await getCoordinatesFromText(dest);
          if (coords) destsCoords.push(coords);
        }

        if (destsCoords.length > 0) {
          try {
            let originStr = `${startCoords.latitude},${startCoords.longitude}`;
            let finalDest = destsCoords[destsCoords.length - 1];
            let destStr = `${finalDest.latitude},${finalDest.longitude}`;
            
            let waypointsParam = "";
            if (destsCoords.length > 1) {
                let wps = destsCoords.slice(0, destsCoords.length - 1).map((c: any) => `${c.latitude},${c.longitude}`);
                waypointsParam = `&waypoints=${wps.join('|')}`;
            }

            const response = await fetch(`https://maps.googleapis.com/maps/api/directions/json?origin=${originStr}&destination=${destStr}${waypointsParam}&key=${GOOGLE_MAPS_APIKEY}&language=ar`);
            const data = await response.json();

            if (data.status === 'OK' && data.routes && data.routes.length > 0) {
               let totalMeters = data.routes[0].legs.reduce((sum: any, leg: any) => sum + leg.distance.value, 0);
               totalDistanceKm = totalMeters / 1000;
               googleSuccess = true;
            } else {
               console.log("Directions Status: ", data.status);
            }
          } catch (e) { console.log("Google Directions API Error"); }
        }

        if (!googleSuccess) {
           let totalDirectMeters = 0;
           let currentPoint = startCoords;
           for (let dest of destsCoords) {
             let d = calculateDistance(currentPoint.latitude, currentPoint.longitude, dest.latitude, dest.longitude);
             totalDirectMeters += d;
             currentPoint = dest;
           }
           totalDistanceKm = totalDirectMeters > 0 ? (totalDirectMeters / 1000) * 1.35 : 5; 
        }

        if (!isTempModal) setCalculatedDistance(totalDistanceKm.toFixed(1));

        let appSettings: any = {
           car: { baseFare: 15, minFare: 20, tiers: [{ upToKm: 999, price: 4.4 }] },
           tuktuk: { baseFare: 10, minFare: 15, tiers: [{ upToKm: 999, price: 6.0 }] },
           scooter: { baseFare: 12, minFare: 12, tiers: [{ upToKm: 999, price: 3.5 }] }
        };
        
        if (liveSettings) {
           appSettings = { car: liveSettings.car || appSettings.car, tuktuk: liveSettings.tuktuk || appSettings.tuktuk, scooter: liveSettings.scooter || appSettings.scooter };
        }

        let calculatedPrice = 0;
        if (vType === 'car') {
          const distanceFare = calculateTieredPrice(totalDistanceKm, appSettings.car.tiers);
          const firstTierLimit = appSettings.car.tiers && appSettings.car.tiers.length > 0 ? parseFloat(appSettings.car.tiers[0].upToKm) : 999;
          if (totalDistanceKm <= firstTierLimit) calculatedPrice = Math.max(Number(appSettings.car.minFare), Number(appSettings.car.baseFare) + distanceFare);
          else calculatedPrice = Number(appSettings.car.baseFare) + distanceFare;
        } else if (vType === 'scooter') {
          const distanceFare = calculateTieredPrice(totalDistanceKm, appSettings.scooter.tiers);
          const firstTierLimit = appSettings.scooter.tiers && appSettings.scooter.tiers.length > 0 ? parseFloat(appSettings.scooter.tiers[0].upToKm) : 999;
          if (totalDistanceKm <= firstTierLimit) calculatedPrice = Math.max(Number(appSettings.scooter.minFare), Number(appSettings.scooter.baseFare) + distanceFare);
          else calculatedPrice = Number(appSettings.scooter.baseFare) + distanceFare;
        } else {
          const distanceFare = calculateTieredPrice(totalDistanceKm, appSettings.tuktuk.tiers);
          const firstTierLimit = appSettings.tuktuk.tiers && appSettings.tuktuk.tiers.length > 0 ? parseFloat(appSettings.tuktuk.tiers[0].upToKm) : 999;
          
          if (totalDistanceKm <= firstTierLimit) {
            calculatedPrice = Math.max(Number(appSettings.tuktuk.minFare), Number(appSettings.tuktuk.baseFare) + distanceFare);
          } else {
            calculatedPrice = Number(appSettings.tuktuk.baseFare) + distanceFare;
          }
        }

        let finalBase = Math.ceil(calculatedPrice);
        
        if (isTempModal) {
            setModalBasePrice(finalBase);
            setModalPrice(finalBase.toString());
            setIsModalCalculating(false);
        } else {
            setCalculatedBasePrice(finalBase);
            setBasePriceForSuggestions(finalBase);
            setPrice(finalBase.toString());
            setIsCalculatingPrice(false);
        }

      } catch(error) {
        if (isTempModal) setIsModalCalculating(false); else setIsCalculatingPrice(false);
      }
    } else {
      if (isTempModal) {
          setModalBasePrice(0); setModalPrice(''); setIsModalCalculating(false);
      } else {
          setCalculatedBasePrice(0); setBasePriceForSuggestions(0); setPrice(''); setCalculatedDistance('0'); setIsCalculatingPrice(false);
      }
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

      let location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest });
      const currentCoords = { latitude: location.coords.latitude, longitude: location.coords.longitude };
      setPickupCoords(currentCoords);

      let addressText = 'موقعي الحالي';
      
      try {
        const response = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${currentCoords.latitude},${currentCoords.longitude}&key=${GOOGLE_MAPS_APIKEY}&language=ar`);
        const data = await response.json();
        if (data.results && data.results.length > 0) {
          addressText = data.results[0].formatted_address;
        }
      } catch (e) {
        console.log("Error fetching google geocode", e);
      }

      setPickup(addressText);
      
      if (pickupRef.current) {
        pickupRef.current.setAddressText(addressText);
      }

      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      setIsCalculatingPrice(true);
      debounceTimer.current = setTimeout(() => {
        updatePriceCalculation(addressText, destinations, requestedVehicleType, passengersCount, currentCoords);
      }, 1500);

    } catch (error) {
      Alert.alert('خطأ', 'حدثت مشكلة أثناء التقاط إشارة الـ GPS');
    } finally {
      setIsFetchingLocation(false);
    }
  };

  const handlePickupChange = (text: string) => {
    setPickup(text);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => updatePriceCalculation(text, destinations, requestedVehicleType, passengersCount, null), 1500);
  };

  const handleDestinationChange = (text: string, index: number) => {
    const newDests = [...destinations];
    newDests[index] = text;
    setDestinations(newDests);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => updatePriceCalculation(pickup, newDests, requestedVehicleType, passengersCount, pickupCoords), 1500);
  };

  const addDestination = () => { if (destinations.length < 3) setDestinations([...destinations, '']); };
  const removeDestination = (index: number) => {
    const newDests = [...destinations];
    newDests.splice(index, 1);
    setDestinations(newDests);
    updatePriceCalculation(pickup, newDests, requestedVehicleType, passengersCount, pickupCoords);
  };

  const [modalBasePrice, setModalBasePrice] = useState(0);
  const [modalPrice, setModalPrice] = useState('');
  const [isModalCalculating, setIsModalCalculating] = useState(false);

  const openEditDestModal = () => { 
    setTempDestinations([...destinations]); 
    setModalBasePrice(basePriceForSuggestions || parseInt(price));
    setModalPrice(price);
    setIsEditDestModalVisible(true); 
  };
  const handleTempDestChange = (text: string, index: number) => {
    const newDests = [...tempDestinations];
    newDests[index] = text;
    setTempDestinations(newDests);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      updatePriceCalculation(pickup, newDests, requestedVehicleType, passengersCount, pickupCoords, true);
    }, 1500);
  };
  const addTempDest = () => { if (tempDestinations.length < 3) setTempDestinations([...tempDestinations, '']); };
  const removeTempDest = (index: number) => { 
    const newDests = [...tempDestinations]; 
    newDests.splice(index, 1); 
    setTempDestinations(newDests); 
    updatePriceCalculation(pickup, newDests, requestedVehicleType, passengersCount, pickupCoords, true);
  };

  const openEditPriceModal = () => {
    if (!pickup || destinations[0].trim().length === 0) return;
    setTempPrice(price);
    setIsEditModalVisible(true);
  };

  const saveNewPrice = async () => {
    setPrice(tempPrice);
    setIsEditModalVisible(false);
    if (currentRideId && ['accepted', 'captain_arrived', 'in_progress'].includes(rideStatus)) {
      await updateDoc(doc(db, 'rides', currentRideId), { price: tempPrice.toString() });
    }
  };

  const verifyPromoCode = async () => {
    if (!promoCodeInput.trim()) return;
    setIsVerifyingPromo(true);
    try {
      const settingsSnap = await getDoc(doc(db, 'app_settings', 'pricing'));
      const promo = settingsSnap.data()?.promoCodes?.find((p: any) => p.code === promoCodeInput.toUpperCase().trim());
      if (promo) { setAppliedPromo(promo); Alert.alert('تم التفعيل', 'تم خصم الأجرة'); }
    } catch (error) {} 
    finally { setIsVerifyingPromo(false); }
  };

  useEffect(() => {
    let interval: any;
    if (rideStatus === 'captain_arrived' || rideStatus === 'waiting_for_scan' || rideStatus === 'passenger_on_the_way') {
      const arrivalTime = rideArrivedAt || new Date().getTime();
      const targetTime = arrivalTime + (5 * 60 * 1000);
      const updateTimer = () => { setWaitingTimeLeft(Math.max(0, Math.floor((targetTime - new Date().getTime()) / 1000))); };
      updateTimer();
      interval = setInterval(updateTimer, 1000);
    } else setWaitingTimeLeft(300);
    return () => clearInterval(interval);
  }, [rideStatus, rideArrivedAt]);

  const formatTimer = (totalSeconds: number) => {
    const m = Math.floor(totalSeconds / 60); const s = totalSeconds % 60;
    return `0${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const openSidebar = () => { setIsSidebarOpen(true); Animated.timing(sidebarAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start(); };
  const closeSidebar = () => { Animated.timing(sidebarAnim, { toValue: SCREEN_WIDTH, duration: 300, useNativeDriver: true }).start(() => setIsSidebarOpen(false)); };

  const togglePhoneVisibility = async () => {
    const newValue = !passengerProfile.hidePhoneNumber;
    setPassengerProfile(prev => ({ ...prev, hidePhoneNumber: newValue }));
    await updateDoc(doc(db, 'passengers', passengerProfile.id), { hidePhoneNumber: newValue });
  };

  useFocusEffect(useCallback(() => { loadPassengerProfile(); }, []));

  const loadPassengerProfile = async () => {
    try {
      const passengerId = await AsyncStorage.getItem('currentPassengerId');
      if (passengerId) {
        const docRef = doc(db, 'passengers', passengerId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setPassengerProfile({ id: passengerId, name: data.name, phone: data.phone, avatar: getSafeAvatar(data.avatar), averageRating: 5, ratingCount: 0, hidePhoneNumber: data.hidePhoneNumber || false });
          checkRideStatus(passengerId, data.name);
        }
      } else router.replace('/passenger-login');
    } catch (e) {}
  };

  const checkRideStatus = async (passengerId: string, passengerName: string) => {
    try {
      const savedRideStr = await AsyncStorage.getItem('active_ride');
      if (savedRideStr) {
        const savedRide = JSON.parse(savedRideStr);
        if (savedRide.id && ['pending', 'accepted', 'captain_arrived', 'passenger_on_the_way', 'waiting_for_scan', 'in_progress'].includes(savedRide.status)) {
          setCurrentRideId(savedRide.id); 
          setPickup(savedRide.pickupLocation || '');
          if (savedRide.pickupCoords) setPickupCoords(savedRide.pickupCoords);
          if (savedRide.destinationsList && savedRide.destinationsList.length > 0) setDestinations(savedRide.destinationsList);
          else setDestinations([savedRide.destinationLocation || '']);
          setRideStatus(savedRide.status === 'pending' ? 'searching' : savedRide.status);
          setCalculatedDistance(savedRide.distance || '0');
        }
      }
      let q = query(collection(db, 'rides'), where('passengerId', '==', passengerId), limit(15));
      let docs = (await getDocs(q)).docs.map(d => ({ id: d.id, ...d.data() }));
      docs.sort((a: any, b: any) => b.timestamp - a.timestamp);
      const activeRide: any = docs.find((d: any) => ['pending', 'accepted', 'captain_arrived', 'passenger_on_the_way', 'waiting_for_scan', 'in_progress'].includes(d.status));
      if (activeRide) {
        setCurrentRideId(activeRide.id);
        setPickup(activeRide.pickupLocation || '');
        if (activeRide.pickupCoords) setPickupCoords(activeRide.pickupCoords);
        if (activeRide.numericSecret) setNumericSecret(activeRide.numericSecret);
        if (activeRide.destinationsList && activeRide.destinationsList.length > 0) setDestinations(activeRide.destinationsList);
        setPrice(activeRide.price || ''); setCalculatedDistance(activeRide.distance || '0');
        if (activeRide.status === 'pending') { setRideStatus('searching'); setOffers(activeRide.offers || []); } 
        else if (['accepted', 'captain_arrived', 'passenger_on_the_way', 'waiting_for_scan', 'in_progress'].includes(activeRide.status)) {
          setRideStatus(activeRide.status);
          if (activeRide.arrivedAt) setRideArrivedAt(activeRide.arrivedAt); 
          setCaptainInfo({ name: activeRide.captainName || '', phone: activeRide.captainPhone || 'غير مسجل', vehicle: activeRide.captainVehicle || 'مركبة', avatar: getSafeAvatar(activeRide.captainAvatar), vehicleImage: '', plateNumber: activeRide.captainPlateNumber || '' });
        }
        await AsyncStorage.setItem('active_ride', JSON.stringify(activeRide));
      } else {
        setRideStatus('idle'); await AsyncStorage.removeItem('active_ride'); setCurrentRideId(null);
      }
    } catch (error) {}
  };

  const handleSearchCaptain = async () => {
    if (isSubmitting) return;
    const validDests = destinations.filter(d => d.trim() !== '');
    if (!pickup || validDests.length === 0 || !price) return Alert.alert('تنبيه', 'برجاء إدخال بيانات الرحلة كاملاً');
    setIsSubmitting(true); setRideStatus('searching'); setOffers([]); prevOffersCountRef.current = 0; 
    let finalPickupCoords = pickupCoords || { latitude: 30.0444, longitude: 31.2357 };
    try {
      const rideData = {
        passengerId: passengerProfile.id, name: passengerProfile.name, phone: passengerProfile.phone,
        isPhoneHidden: passengerProfile.hidePhoneNumber || false, avatar: passengerProfile.avatar,
        pickupLocation: pickup, pickupCoords: finalPickupCoords, destinationsList: validDests,
        destinationLocation: validDests.join(' '), 
        price: price, 
        fairPrice: basePriceForSuggestions,
        distance: calculatedDistance, 
        numericSecret: Math.floor(1000 + Math.random() * 9000).toString(), qrSecret: Math.random().toString(36).substring(2, 10),
        notes: notes.trim(), requestedVehicleType, paymentMethod: paymentMethod, offers: [], status: 'pending', timestamp: new Date().getTime(),
      };
      const docRef = await addDoc(collection(db, 'rides'), rideData);
      await AsyncStorage.setItem('active_ride', JSON.stringify({ ...rideData, id: docRef.id }));
      setCurrentRideId(docRef.id);
      Alert.alert('نجاح', 'تم إرسال الطلب...');
    } catch (error) { setRideStatus('idle'); } finally { setIsSubmitting(false); }
  };

  const acceptCaptainOffer = async (offer: any) => {
    try {
      const cleanData: any = { status: 'accepted', price: String(offer?.price || price || '0'), captainId: String(offer?.captainId || 'unknown'), captainName: String(offer?.captainName || 'غير مسجل'), captainPhone: String(offer?.captainPhone || ''), captainVehicle: String(offer?.captainVehicle || 'مركبة'), captainAvatar: getSafeAvatar(offer?.captainAvatar) };
      await setDoc(doc(db, 'rides', currentRideId!), cleanData, { merge: true }); setPrice(cleanData.price);
    } catch (error) {}
  };

  const rejectCaptainOffer = async (offerToReject: any) => {
    setOffers(prev => prev.filter(o => o.captainId !== offerToReject.captainId));
    try {
      const rideSnap = await getDoc(doc(db, 'rides', currentRideId!));
      if (rideSnap.exists()) await updateDoc(doc(db, 'rides', currentRideId!), { offers: rideSnap.data().offers.filter((o: any) => o.captainId !== offerToReject.captainId) });
    } catch (error) {}
  };

  useEffect(() => {
    if (autoAcceptEnabled && rideStatus === 'searching' && offers.length > 0) {
      const myPrice = parseInt(price) || 0;
      offers.forEach(o => { if ((parseInt(o.price) || 0) <= myPrice) acceptCaptainOffer(o); else rejectCaptainOffer(o); });
    }
  }, [offers, autoAcceptEnabled, price]);

  const notifyPassengerOnTheWay = async () => {
    if (!currentRideId) return;
    try { await updateDoc(doc(db, 'rides', currentRideId), { status: 'passenger_on_the_way' }); } catch (error) {}
  };

  const handleCancelRide = async () => {
    if (!currentRideId) return;
    try {
      await updateDoc(doc(db, 'rides', currentRideId), { status: 'cancelled_by_passenger', canceledAt: new Date().getTime() });
      await AsyncStorage.removeItem('active_ride'); setCurrentRideId(null); setRideStatus('idle'); setOffers([]);
    } catch (error) { }
  };

  const submitRating = async () => {
    setRatingSubmitted(true); setTimeout(() => { setIsRatingModalVisible(false); setRideToRate(null); }, 2000);
  };

  const handleCallClick = () => {
    if (!captainInfo.phone || captainInfo.phone === 'غير مسجل') return Alert.alert('تنبيه', 'رقم الكابتن غير متوفر');
    setPhoneToCall(captainInfo.phone); setIsCallModalVisible(true);
  };

  const handleLogout = async () => {
    await AsyncStorage.removeItem('currentPassengerId'); await AsyncStorage.removeItem('active_ride'); router.replace('/passenger-login');
  };

  const sendLocationToWhatsApp = async (phoneToUse: string) => {
    setIsSendingLocation(true);
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { Alert.alert('تنبيه', 'نحتاج صلاحية الموقع لإرسال مسار الرحلة للطوارئ'); setIsSendingLocation(false); return; }
      const trackingLink = `https://badr-cute.web.app/?ride=${currentRideId}`;
      const message = `أنا حالياً في رحلة مع تطبيق براق .\nتتبع مساري (لايف) من هنا لأسباب الأمان :\n${trackingLink}`;
      const whatsappUrl = `https://wa.me/${phoneToUse}?text=${encodeURIComponent(message)}`;
      try { await Linking.openURL(whatsappUrl); } catch (err) { Alert.alert('تنبيه', 'تعذر فتح واتساب'); }
    } catch (error) { Alert.alert('خطأ', 'حدثت مشكلة'); } finally { setIsSendingLocation(false); }
  };

  const sendSafetyLocation = () => {
    if (!emergencyPhone) { setActionAfterSave(true); setTempEmergencyPhone(''); setIsEmergencyModalVisible(true); } 
    else { sendLocationToWhatsApp(emergencyPhone); }
  };

  const saveEmergencyPhone = async () => {
    if (tempEmergencyPhone.length < 10) return Alert.alert('تنبيه', 'أدخل رقم هاتف صحيح');
    let formattedPhone = tempEmergencyPhone;
    if (formattedPhone.startsWith('0')) formattedPhone = '+2' + formattedPhone;
    await AsyncStorage.setItem('emergency_phone', formattedPhone);
    setEmergencyPhone(formattedPhone);
    setIsEmergencyModalVisible(false);
    if (actionAfterSave) sendLocationToWhatsApp(formattedPhone);
    else Alert.alert('نجاح', 'تم تحديث رقم الطوارئ');
  };

  const getCoordinatesFromText = async (text: string) => {
    try {
      const response = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(text + ' مصر')}&key=${GOOGLE_MAPS_APIKEY}&language=ar`);
      const data = await response.json();
      if (data.results && data.results.length > 0) {
        return { latitude: data.results[0].geometry.location.lat, longitude: data.results[0].geometry.location.lng };
      }
    } catch (e) { }

    try {
      const expoResult = await Location.geocodeAsync(text + ' مصر');
      if (expoResult && expoResult.length > 0) return { latitude: expoResult[0].latitude, longitude: expoResult[0].longitude };
    } catch (e) { }

    return null;
  };

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
      if (status !== 'granted') return Alert.alert('تنبيه', 'نحتاج صلاحية الكاميرا');
    }
    setScanned(false); setIsScannerVisible(true);
  };

  const handleBarCodeScanned = async ({ data }: { data: string }) => {
    setScanned(true);
    if (!currentRideId) return; 
    try {
      const qrData = JSON.parse(data);
      if (qrData.rideId === currentRideId) {
        await updateDoc(doc(db, 'rides', currentRideId), { status: 'in_progress' });
        setIsScannerVisible(false); Alert.alert('نجاح', 'بدأت الرحلة بنجاح');
      } else { Alert.alert('خطأ', 'الكود غير مطابق'); }
    } catch (error) { Alert.alert('خطأ', 'الكود غير صالح'); }
  };

  const notifyNewOffer = () => {
    if (isVibrationEnabled) {
      try { Vibration.vibrate([0, 500, 200, 500]); } catch (error) {}
    }
  };

  useEffect(() => {
    if (!passengerProfile || !passengerProfile.id) return;
    const q = query(collection(db, 'notifications'), where('userId', '==', passengerProfile.id), where('read', '==', false));
    const unsubscribe = onSnapshot(q, (snapshot) => { setUnreadNotifsCount(snapshot.docs.length); });
    return () => unsubscribe();
  }, [passengerProfile]);

  useEffect(() => {
    let unsubscribeNotif: any;
    const listenToNotifications = async () => {
      const passengerId = await AsyncStorage.getItem('currentPassengerId');
      if (!passengerId) return;
      const q = query(collection(db, 'notifications'), where('userId', '==', passengerId), where('userType', '==', 'passenger'), where('read', '==', false));
      unsubscribeNotif = onSnapshot(q, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            const notif = change.doc.data();
            Alert.alert(notif.title || 'رسالة', notif.message, [{ text: 'حسناً', onPress: () => updateDoc(doc(db, 'notifications', change.doc.id), { read: true }) }]);
          }
        });
      });
    };
    listenToNotifications();
    return () => { if (unsubscribeNotif) unsubscribeNotif(); };
  }, []);

  useEffect(() => {
    let unsubscribe: any;
    const monitorSession = async () => {
      const userId = await AsyncStorage.getItem('currentPassengerId');
      const localSessionId = await AsyncStorage.getItem('currentSessionId');
      if (!userId) return;
      unsubscribe = onSnapshot(doc(db, 'passengers', userId), async (docSnap) => {
        if (docSnap.exists()) {
          const dbSessionId = docSnap.data().sessionId;
          if (localSessionId && dbSessionId && dbSessionId !== localSessionId) {
            Alert.alert('تنبيه ⚠', 'تم فتح الحساب من جهاز آخر', [{ text: 'حسناً', onPress: async () => { await AsyncStorage.clear(); router.replace('/passenger-login'); } }]);
          }
        }
      });
    };
    monitorSession();
    return () => { if (unsubscribe) unsubscribe(); };
  }, []);

  useEffect(() => {
    Animated.sequence([
      Animated.timing(vehicleImageAnim, { toValue: 0.5, duration: 150, useNativeDriver: true }),
      Animated.timing(vehicleImageAnim, { toValue: 1, duration: 200, useNativeDriver: true })
    ]).start();
  }, [requestedVehicleType, requestedTuktukType]);

  let headerImageSource;
  if (requestedVehicleType === 'car') headerImageSource = require('../../assets/images/car.png');
  else if (requestedVehicleType === 'scooter') headerImageSource = require('../../assets/images/scooter.png');
  else {
    if (requestedTuktukType === 'كيوت 3 راكب') headerImageSource = require('../../assets/images/cute.png');
    else headerImageSource = require('../../assets/images/galaxy.png');
  }

  useEffect(() => {
    if (latestMessage) {
      if (latestMsgTimer.current) clearTimeout(latestMsgTimer.current);
      latestMsgTimer.current = setTimeout(() => { setLatestMessage(''); }, 2000);
    }
    return () => { if (latestMsgTimer.current) clearTimeout(latestMsgTimer.current); };
  }, [latestMessage]);

  useEffect(() => {
    if (!currentRideId) return;
    const rideRef = doc(db, 'rides', currentRideId);
    const unsubscribe = onSnapshot(rideRef, (docSnap) => {
      if (docSnap.exists()) {
        const firebaseData = docSnap.data();
        if (firebaseData.status === 'pending') {
          setRideStatus('searching');
          const currentOffers = firebaseData.offers || [];
          if (currentOffers.length > prevOffersCountRef.current) notifyNewOffer();
          prevOffersCountRef.current = currentOffers.length;
          setOffers(currentOffers);
        }
        setUnreadChatCount(firebaseData.unreadCountPassenger || 0);
        if (firebaseData.numericSecret) setNumericSecret(firebaseData.numericSecret);
        if (['accepted', 'captain_arrived', 'passenger_on_the_way', 'waiting_for_scan', 'in_progress'].includes(firebaseData.status)) {
          setRideStatus(firebaseData.status);
          if (firebaseData.arrivedAt) setRideArrivedAt(firebaseData.arrivedAt); 
          setPrice(firebaseData.price ? String(firebaseData.price) : '');
          if (firebaseData.destinationsList && firebaseData.destinationsList.length > 0) setDestinations(firebaseData.destinationsList);
          setCaptainInfo({ name: firebaseData.captainName || 'كابتن', phone: firebaseData.captainPhone || 'غير مسجل', vehicle: firebaseData.captainVehicle || 'مركبة', avatar: getSafeAvatar(firebaseData.captainAvatar), vehicleImage: getSafeAvatar(firebaseData.captainVehicleImage), plateNumber: firebaseData.captainPlateNumber || '' });
          let loc = firebaseData.liveCoords || firebaseData.captainCoords || firebaseData.captainLocation;
          if (loc) setCaptainLiveCoords(loc);
        } else if (firebaseData.status === 'completed') {
          setRideToRate({ firebaseData, id: currentRideId }); setIsRatingModalVisible(true);
          AsyncStorage.removeItem('active_ride'); setCurrentRideId(null); setRideStatus('idle'); setPickup(''); setPickupCoords(null); setDestinations(['']); setPrice(''); setOffers([]); prevOffersCountRef.current = 0; setUnreadChatCount(0); setNotes(''); setLatestMessage(''); setNumericSecret(''); setPromoCodeInput(''); setAppliedPromo(null); 
        } else if (firebaseData.status === 'canceled') {
          AsyncStorage.removeItem('active_ride'); setCurrentRideId(null); setRideStatus('idle'); setPickup(''); setPickupCoords(null); setDestinations(['']); setPrice(''); setOffers([]); prevOffersCountRef.current = 0; setUnreadChatCount(0); setNotes(''); setLatestMessage(''); setNumericSecret(''); setPromoCodeInput(''); setAppliedPromo(null); 
        }
      }
    });
    return () => unsubscribe();
  }, [currentRideId]);

  useEffect(() => {
    if (!currentRideId) return;
    const q = query(collection(db, 'rides', currentRideId, 'messages'), orderBy('timestamp', 'desc'), limit(1));
    const unsubscribeMsgs = onSnapshot(q, (snap) => {
      if (!snap.empty) { const msg = snap.docs[0].data(); if (msg.sender === 'captain') setLatestMessage(msg.text); }
    });
    return () => unsubscribeMsgs();
  }, [currentRideId]);

  useEffect(() => {
    if (rideStatus === 'captain_arrived' || rideStatus === 'waiting_for_scan') {
      Animated.loop(Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: false }),
        Animated.timing(pulseAnim, { toValue: 0, duration: 600, useNativeDriver: false })
      ])).start();
    } else pulseAnim.setValue(0);
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
    } else { chatPulseAnim.stopAnimation(); chatPulseAnim.setValue(0); }
  }, [unreadChatCount]);

  useEffect(() => {
    let locationSubscription: any;
    const startLiveTracking = async () => {
      if (currentRideId && ['accepted', 'captain_arrived', 'waiting_for_scan', 'in_progress', 'passenger_on_the_way'].includes(rideStatus)) {
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          locationSubscription = await Location.watchPositionAsync(
            { accuracy: Location.Accuracy.Balanced, timeInterval: 15000, distanceInterval: 50 },
            (loc) => {
              if (currentRideId) { 
                updateDoc(doc(db, 'rides', currentRideId), { liveCoords: { latitude: loc.coords.latitude, longitude: loc.coords.longitude } })
                  .catch(e => console.log("Error updating live location:", e));
              }
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

  return (
    <KeyboardAvoidingView style={[styles.container, isDarkMode && { backgroundColor: '#0f172a' }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {toastVisible && (
        <Animated.View style={[styles.toastContainer, { opacity: toastOpacity, transform: [{ translateY: toastTranslateY }] }]}>
          <Text style={styles.toastText}>رسالة جديدة من الكابتن</Text>
        </Animated.View>
      )}
      
      <View style={[styles.header, isDarkMode && { backgroundColor: '#1e293b', borderColor: '#334155' }, { flexDirection: 'row-reverse' }]}>
        <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 10 }}>
          <TouchableOpacity style={[styles.headerMenuBtn, isDarkMode && { backgroundColor: '#334155', borderColor: '#475569' }, { position: 'relative' }]} onPress={openSidebar}>
            <Text style={[styles.headerMenuText, isDarkMode && { color: '#e2e8f0' }]}>≡</Text>
            {unreadNotifsCount > 0 && <View style={{ position: 'absolute', top: -2, right: -2, width: 12, height: 12, borderRadius: 6, backgroundColor: '#ef4444', borderWidth: 2, borderColor: isDarkMode ? '#1e293b' : '#ffffff' }} />}
          </TouchableOpacity>
          
          <TouchableOpacity style={[styles.headerMenuBtn, isDarkMode && { backgroundColor: '#334155', borderColor: '#475569' }, { position: 'relative', padding: 8 }]} onPress={() => router.push('/passenger-notifications')}>
            <Ionicons name="notifications-outline" size={24} color={isDarkMode ? "#e2e8f0" : "#64748b"} />
            {unreadNotifsCount > 0 && (
              <View style={{ position: 'absolute', top: -6, right: -6, backgroundColor: '#ef4444', borderRadius: 10, minWidth: 20, height: 20, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: isDarkMode ? '#1e293b' : '#ffffff' }}>
                <Text style={{ color: '#ffffff', fontSize: 10, fontWeight: 'bold' }}>{unreadNotifsCount > 99 ? '+99' : unreadNotifsCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.userInfoCentered} onPress={() => router.push('/passenger-profile')}>
          <Image source={{ uri: passengerProfile.avatar }} style={[styles.profileAvatar, isDarkMode && { borderColor: '#475569', borderWidth: 1 }]} />
          <View style={styles.profileTextContainer}>
            <Text style={[styles.headerPassengerName, isDarkMode && { color: '#e2e8f0' }]} numberOfLines={1}>
              {passengerProfile.name ? passengerProfile.name.split(' ')[0] : 'مستخدم'}
            </Text>
            <View style={{ flexDirection: 'row-reverse', marginTop: 2, justifyContent: 'flex-start' }}>
              {[1, 2, 3, 4, 5].map((star) => (
                <Text key={star} style={{ fontSize: 13, color: star <= Math.round(passengerProfile.averageRating) ? '#f59e0b' : '#cbd5e1' }}>★</Text>
              ))}
            </View>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.headerSettingsBtn, isDarkMode && { backgroundColor: '#334155', borderColor: '#475569' }]} onPress={() => router.push('/settings' as any)}>
          <Ionicons name="settings-sharp" size={24} color={isDarkMode ? "#e2e8f0" : "#64748b"} />
        </TouchableOpacity>
      </View>     
      
      {rideStatus === 'idle' && (
        <ScrollView style={[styles.card, isDarkMode && { backgroundColor: '#1e293b', borderColor: '#334155' }]} contentContainerStyle={{ paddingBottom: 90 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" overScrollMode="never">
          
          <View style={styles.requestHeaderRow}>
            <Text style={[styles.cardTitle, isDarkMode && { color: '#ffffff' }]}>اطلب مشوارك الآن</Text>
            <Animated.Image source={headerImageSource} style={[styles.vehicleHeaderImg, { transform: [{ scale: vehicleImageAnim }] }]} resizeMode="contain" />
          </View>

{/* 👇 تم إرجاع بلوك اختيار نوع المركبة */}
<Text style={[styles.label, isDarkMode && { color: '#cbd5e1' }]}>نوع المركبة</Text>
          <View style={styles.vehicleTypeTabs}>
            {/* 👇 الزرار الأول بقى كيوت 3 راكب */}
            <TouchableOpacity style={[styles.vTypeBtn, requestedVehicleType === 'tuktuk_alt' && styles.vTypeBtnActive]} onPress={() => setRequestedVehicleType('tuktuk_alt')}>
              <Text style={[styles.vTypeText, requestedVehicleType === 'tuktuk_alt' && styles.vTypeTextActive]}>كيوت 3 راكب</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={[styles.vTypeBtn, requestedVehicleType === 'car' && styles.vTypeBtnActive]} onPress={() => setRequestedVehicleType('car')}>
              <Text style={[styles.vTypeText, requestedVehicleType === 'car' && styles.vTypeTextActive]}>سيارة</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={[styles.vTypeBtn, requestedVehicleType === 'scooter' && styles.vTypeBtnActive]} onPress={() => setRequestedVehicleType('scooter')}>
              <Text style={[styles.vTypeText, requestedVehicleType === 'scooter' && styles.vTypeTextActive]}>سكوتر</Text>
            </TouchableOpacity>
          </View>
                    {requestedVehicleType === 'tuktuk_alt' && (
            <View style={styles.vehicleTypeTabs}>  
            </View>
          )}
          <Text style={[styles.label, isDarkMode && { color: '#cbd5e1' }]}>موقع الانطلاق الحالي</Text>          
          <View style={[styles.modernDestContainer, { backgroundColor: '#ffffff', borderColor: '#e2e8f0', marginBottom: 10, zIndex: 2000 }]}>
            <View style={styles.modernDestRight}>
              <Ionicons name="location" size={22} color="#10b981" />
              <Text style={{ color: '#1e293b', fontSize: 16, marginLeft: 5, fontWeight: 'bold' }}>من</Text>
              
              <View style={{ flex: 1, zIndex: 2000, position: 'relative', justifyContent: 'center' }}>
                <GooglePlacesAutocomplete
                  ref={pickupRef}
                  placeholder="ابحث عن مكان الانطلاق..."
                  fetchDetails={true}
                  enablePoweredByContainer={false}
                  isRowScrollable={false}
                  onPress={(data: any, details: any = null) => {
                    let text = data.description;
                    setPickup(text);
                    let coords = details?.geometry?.location ? { latitude: details.geometry.location.lat, longitude: details.geometry.location.lng } : null;
                    if (coords) setPickupCoords(coords);
                    if (debounceTimer.current) clearTimeout(debounceTimer.current);
                    debounceTimer.current = setTimeout(() => updatePriceCalculation(text, destinations, requestedVehicleType, passengersCount, coords), 1500);
                  }}
                  query={{ key: GOOGLE_MAPS_APIKEY, language: 'ar', components: 'country:eg' }}
                  textInputProps={{
                    placeholderTextColor: '#64748b',
                    value: pickup,
                    style: { color: '#000000', textAlign: 'right', flex: 1, backgroundColor: 'transparent', height: 45 }, 
                    onChangeText: (text: string) => { 
                      setPickup(text);
                      if (debounceTimer.current) clearTimeout(debounceTimer.current);
                      debounceTimer.current = setTimeout(() => updatePriceCalculation(text, destinations, requestedVehicleType, passengersCount, null), 1500);
                    },
                  }}
                  renderRow={(rowData: any) => (
                    <Text style={{ flex: 1, flexWrap: 'wrap', textAlign: 'right', writingDirection: 'rtl', color: '#000000', fontSize: 14, lineHeight: 22 }}>
                      {rowData.description}
                    </Text>
                  )}
                  styles={{
                    container: { flex: 0, width: '100%' },
                    textInputContainer: { backgroundColor: 'transparent', width: '100%', borderTopWidth: 0, borderBottomWidth: 0, flexDirection: 'row-reverse', alignItems: 'center' },
                    textInput: { color: '#000000', backgroundColor: 'transparent', fontSize: 15, textAlign: 'right', flex: 1, height: 45, paddingHorizontal: 10, paddingLeft: 35 },
                    listView: { position: 'absolute', top: 48, width: SCREEN_WIDTH - 30, right: -45, zIndex: 9999, backgroundColor: '#ffffff', borderRadius: 12, elevation: 10, borderWidth: 1, borderColor: '#e2e8f0' },
                    row: { paddingVertical: 12, paddingHorizontal: 15, flexDirection: 'row-reverse', alignItems: 'center', width: '100%', minHeight: 50, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
                  }}
                />
                
                {pickup ? (
                  <TouchableOpacity style={{ position: 'absolute', left: 5, padding: 5, zIndex: 2001 }} onPress={() => { setPickup(''); pickupRef.current?.setAddressText(''); if (debounceTimer.current) clearTimeout(debounceTimer.current); debounceTimer.current = setTimeout(() => updatePriceCalculation('', destinations, requestedVehicleType, passengersCount, null), 500); }}>
                    <Ionicons name="close-circle" size={20} color="#94a3b8" />
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
            <TouchableOpacity style={[styles.myLocationBtn, { paddingVertical: 8, paddingHorizontal: 12, marginLeft: 5 }]} onPress={handleGetCurrentLocation} disabled={isFetchingLocation}>
              {isFetchingLocation ? <ActivityIndicator color="#ffffff" size="small" /> : <Text style={styles.myLocationBtnText}>موقعي</Text>}
            </TouchableOpacity>
          </View>

          <Text style={[styles.label, isDarkMode && { color: '#cbd5e1' }]}>الوجهة المطلوبة</Text>
          {destinations.map((dest, index) => (
            <View key={index} style={[styles.modernDestContainer, { backgroundColor: '#ffffff', borderColor: '#e2e8f0', marginBottom: 10, zIndex: 1000 - index }]}>
              <View style={styles.modernDestRight}>
                <Ionicons name="search" size={22} color="#9ca3af" />
                <Text style={{ color: '#1e293b', fontSize: 16, marginLeft: 5, fontWeight: 'bold' }}>
                  {index === 0 ? 'إلى' : 'ثم'}
                </Text>
                
                <View style={{ flex: 1, zIndex: 999, position: 'relative', justifyContent: 'center' }}>
                  <GooglePlacesAutocomplete
                    ref={(el) => { destRefs.current[index] = el; }}
                    placeholder="ابحث عن وجهتك..."
                    fetchDetails={true}
                    enablePoweredByContainer={false}
                    isRowScrollable={false}
                    onPress={(data: any, details: any = null) => {
                      handleDestinationChange(data.description, index);
                    }}
                    query={{ key: GOOGLE_MAPS_APIKEY, language: 'ar', components: 'country:eg' }}
                    textInputProps={{
                      placeholderTextColor: '#64748b',
                      value: destinations[index] || '',
                      style: { color: '#000000', textAlign: 'right', flex: 1, backgroundColor: 'transparent', height: 45 },
                      onChangeText: (text: any) => {
                        handleDestinationChange(text, index);
                      }
                    }}
                    renderRow={(rowData: any) => (
                      <Text style={{ flex: 1, flexWrap: 'wrap', textAlign: 'right', writingDirection: 'rtl', color: '#000000', fontSize: 14, lineHeight: 22 }}>
                        {rowData.description}
                      </Text>
                    )}
                    styles={{
                      container: { flex: 0, width: '100%' },
                      textInputContainer: { backgroundColor: 'transparent', width: '100%', borderTopWidth: 0, borderBottomWidth: 0, flexDirection: 'row-reverse', alignItems: 'center' }, 
                      textInput: { color: '#000000', backgroundColor: 'transparent', fontSize: 15, textAlign: 'right', flex: 1, height: 45, paddingHorizontal: 10, paddingLeft: 35 },
                      listView: { position: 'absolute', top: 48, width: SCREEN_WIDTH - 30, right: -45, zIndex: 9999, backgroundColor: '#ffffff', borderRadius: 12, elevation: 10, borderWidth: 1, borderColor: '#e2e8f0' },
                      row: { paddingVertical: 12, paddingHorizontal: 15, flexDirection: 'row-reverse', alignItems: 'center', width: '100%', minHeight: 50, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
                    }}
                  />
                  
                  {destinations[index] ? (
                    <TouchableOpacity style={{ position: 'absolute', left: 5, padding: 5, zIndex: 1000 }} onPress={() => { handleDestinationChange('', index); destRefs.current[index]?.setAddressText(''); }}>
                      <Ionicons name="close-circle" size={20} color="#94a3b8" />
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>

              <View style={{ flexDirection: 'row-reverse', gap: 5 }}>
                <TouchableOpacity style={styles.modernDestMapBtn} onPress={() => openMapForDestination(index)}>
                  <Ionicons name="map" size={22} color="#60a5fa" />
                </TouchableOpacity>
                {index > 0 && (
                  <TouchableOpacity style={[styles.modernDestMapBtn, { backgroundColor: '#fee2e2' }]} onPress={() => removeDestination(index)}>
                    <Ionicons name="trash" size={22} color="#ef4444" />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ))}

          {destinations.length < 3 && (
            <TouchableOpacity 
              style={{ backgroundColor: isDarkMode ? '#334155' : '#f8fafc', paddingVertical: 12, borderRadius: 12, alignItems: 'center', marginBottom: 15, borderWidth: 1, borderColor: isDarkMode ? '#475569' : '#cbd5e1', borderStyle: 'dashed', flexDirection: 'row-reverse', justifyContent: 'center' }} 
              onPress={addDestination}
            >
              <Ionicons name="add-circle-outline" size={20} color={isDarkMode ? '#60a5fa' : '#3b82f6'} style={{ marginLeft: 5 }} />
              <Text style={{ color: isDarkMode ? '#60a5fa' : '#3b82f6', fontWeight: 'bold', fontSize: 14 }}>إضافة واجهة</Text>
            </TouchableOpacity>
          )}

          <Text style={[styles.label, isDarkMode && { color: '#cbd5e1' }]}>ملاحظات للكابتن (اختياري)</Text>
          <TextInput style={[styles.notesInput, isDarkMode && { backgroundColor: '#334155', borderColor: '#475569', color: '#ffffff' }]} placeholder="مثال معايا أغراض خفيفة ..." placeholderTextColor={isDarkMode ? '#64748b' : '#94a3b8'} value={notes} onChangeText={setNotes} multiline={true} />

          {/* 🎟️ إدخال كود الخصم */}
          <Text style={[styles.label, isDarkMode && { color: '#cbd5e1' }]}>كود الخصم (اختياري)</Text>
          <View style={{ flexDirection: 'row-reverse', alignItems: 'center', marginBottom: 15, gap: 10 }}>
            <TextInput 
              style={[styles.inputWithButton, { flex: 1 }, isDarkMode && { backgroundColor: '#334155', borderColor: '#475569', color: '#ffffff' }]} 
              placeholder="أدخل كود الخصم..." 
              placeholderTextColor={isDarkMode ? '#64748b' : '#94a3b8'} 
              value={promoCodeInput} 
              onChangeText={setPromoCodeInput} 
              editable={!appliedPromo}
            />
            <TouchableOpacity 
              style={{ backgroundColor: appliedPromo ? '#10b981' : '#3b82f6', paddingVertical: 11, paddingHorizontal: 15, borderRadius: 12, justifyContent: 'center', alignItems: 'center', minWidth: 80 }} 
              onPress={appliedPromo ? () => { setAppliedPromo(null); setPromoCodeInput(''); } : verifyPromoCode}
              disabled={isVerifyingPromo}
            >
              {isVerifyingPromo ? <ActivityIndicator color="#ffffff" size="small" /> : <Text style={{ color: '#ffffff', fontWeight: 'bold', fontSize: 13 }}>{appliedPromo ? 'إلغاء' : 'تطبيق'}</Text>}
            </TouchableOpacity>
          </View>

          {appliedPromo && (
             <View style={{ backgroundColor: '#dcfce7', padding: 10, borderRadius: 8, marginBottom: 15, borderWidth: 1, borderColor: '#86efac', alignItems: 'center' }}>
               <Text style={{ color: '#166534', fontWeight: 'bold' }}>✅ تم تطبيق خصم {appliedPromo.discountValue} جنيه سيتم خصمه من الأجرة النهائية للرحلة.</Text>
             </View>
          )}

          <Text style={[styles.label, {marginTop: 10}, isDarkMode && { color: '#cbd5e1' }]}>أجرة الرحلة المقترحة</Text>
          <View style={[styles.priceDisplayContainer, isDarkMode && { backgroundColor: '#422006', borderColor: '#d97706' }, { marginBottom: (basePriceForSuggestions > 0 && pickup && destinations[0]) ? 10 : 20 }]}>
            {isCalculatingPrice ? (
              <Text style={[styles.priceTextDisplay, {color: isDarkMode ? '#94a3b8' : '#94a3b8', fontSize: 15}]}>جاري حساب المسافة...</Text>
            ) : (
              <View style={{flex: 1, alignItems: 'flex-end'}}>
                <Text style={styles.priceTextDisplay}>{price ? `${price} جنيه` : '---'}</Text>
                {price && parseInt(passengersCount) > 1 && requestedVehicleType === 'tuktuk_alt' && (
                  <Text style={{color: '#10b981', fontSize: 12, fontWeight: 'bold', marginTop: 2}}>
                    (حوالي {Math.ceil(parseInt(price) / parseInt(passengersCount))} جنيه للفرد)
                  </Text>
                )}
              </View>
            )}
            <TouchableOpacity style={[styles.editPriceBtn, {alignSelf: 'center'}]} onPress={openEditPriceModal}>
              <Text style={styles.editPriceBtnText}>تعديل السعر</Text>
            </TouchableOpacity>
          </View>
          
          {basePriceForSuggestions > 0 && pickup.trim() !== '' && destinations[0].trim() !== '' && !isCalculatingPrice && (
            <View style={styles.suggestionsRow}>
              {[1.2, 1.4, 1.6].map((multiplier, index) => {
                const suggestedPrice = Math.round(basePriceForSuggestions * multiplier);
                const isSelected = price === suggestedPrice.toString();
                const percentage = Math.round((multiplier - 1) * 100);
                return (
                  <TouchableOpacity key={index} style={[styles.suggestionBtn, isDarkMode && { backgroundColor: '#334155', borderColor: '#475569' }, isSelected && styles.suggestionBtnActive]} onPress={() => setPrice(suggestedPrice.toString())}>
                    <Text style={[styles.suggestionText, isDarkMode && { color: '#cbd5e1' }, isSelected && styles.suggestionTextActive]}>{suggestedPrice}</Text>
                    <Text style={[styles.suggestionSubText, isDarkMode && { color: '#94a3b8' }, isSelected && styles.suggestionSubTextActive]}>+{percentage}%</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          <Text style={[styles.label, {marginTop: 5}, isDarkMode && { color: '#cbd5e1' }]}>طريقة الدفع 💳</Text>
          <View style={styles.paymentMethodsRow}>
            {['كاش', 'محفظة', 'انستاباي'].map((method) => (
              <TouchableOpacity
                key={method}
                style={[styles.paymentBtn, isDarkMode && { backgroundColor: '#334155', borderColor: '#475569' }, paymentMethod === method && styles.paymentBtnActive]}
                onPress={() => setPaymentMethod(method)}
              >
                <Text style={[styles.paymentBtnText, isDarkMode && { color: '#cbd5e1' }, paymentMethod === method && styles.paymentBtnTextActive]}>{method}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity 
            style={[styles.searchButton, isSubmitting && { opacity: 0.7 }]} 
            onPress={handleSearchCaptain} 
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#ffffff" size="small" />
            ) : (
              <Text style={styles.searchButtonText}>البحث عن كابتن</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      )}

      {rideStatus === 'searching' && (
        <View style={[styles.card, isDarkMode && { backgroundColor: '#1e293b', borderColor: '#334155' }]}>
          
          {/* هيدر استقبال العروض قابل للضغط */}
          <TouchableOpacity 
            style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}
            onPress={() => setIsSearchingDetailsExpanded(!isSearchingDetailsExpanded)}
          >
            <Text style={[styles.cardTitle, { marginBottom: 0 }, isDarkMode && { color: '#ffffff' }]}>جاري استقبال العروض ...</Text>
            <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 5 }}>
              <Text style={{ fontSize: 13, color: isDarkMode ? '#94a3b8' : '#64748b', fontWeight: 'bold' }}>تفاصيل الرحلة</Text>
              <Ionicons name={isSearchingDetailsExpanded ? "chevron-up" : "chevron-down"} size={20} color={isDarkMode ? '#94a3b8' : '#64748b'} />
            </View>
          </TouchableOpacity>
          
          {/* الجزء المخفي اللي هيتلم (تفاصيل الرحلة والقبول التلقائي) */}
          {isSearchingDetailsExpanded && (
            <View>
              <View style={{ backgroundColor: isDarkMode ? '#334155' : '#f8fafc', padding: 12, borderRadius: 12, marginBottom: 15, borderWidth: 1, borderColor: isDarkMode ? '#475569' : '#e2e8f0' }}>
                
                <View style={{ flexDirection: 'row-reverse', alignItems: 'flex-start', marginBottom: 8 }}>
                  <Text style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>🟢 الانطلاق:</Text>
                  <Text style={{ flex: 1, fontSize: 14, fontWeight: 'bold', color: isDarkMode ? '#e2e8f0' : '#1e293b', textAlign: 'right', marginRight: 5 }} numberOfLines={2}>{pickup}</Text>
                </View>
                
                <View style={{ flexDirection: 'row-reverse', alignItems: 'flex-start', marginBottom: 12 }}>
                  <Text style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>🔴 الوجهة:</Text>
                  <Text style={{ flex: 1, fontSize: 14, fontWeight: 'bold', color: isDarkMode ? '#e2e8f0' : '#1e293b', textAlign: 'right', marginRight: 5 }} numberOfLines={2}>{destinations.join(' - ')}</Text>
                </View>

                <TouchableOpacity 
                  style={{ backgroundColor: isDarkMode ? '#0f172a' : '#f1f5f9', paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: isDarkMode ? '#475569' : '#cbd5e1', marginBottom: 10, alignItems: 'center' }} 
                  onPress={openEditDestModal}
                >
                  <Text style={{ color: isDarkMode ? '#cbd5e1' : '#475569', fontWeight: 'bold', fontSize: 13 }}>تعديل الوجهة 🗺️</Text>
                </TouchableOpacity>

                <View style={{ height: 1, backgroundColor: isDarkMode ? '#475569' : '#e2e8f0', marginBottom: 10 }} />

                <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: (basePriceForSuggestions > 0 || parseInt(price) > 0) ? 10 : 0 }}>
                  <View style={{ flexDirection: 'row-reverse', alignItems: 'center' }}>
                    <Text style={{ fontSize: 13, color: '#64748b', marginLeft: 5 }}>سعرك المقترح:</Text>
                    <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#10b981' }}>{price || calculatedBasePrice || '0'} ج</Text>
                  </View>
                  <TouchableOpacity 
                    style={{ backgroundColor: '#d97706', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, elevation: 1 }}
                    onPress={openEditPriceModal}
                  >
                    <Text style={{ color: '#ffffff', fontSize: 12, fontWeight: 'bold' }}>تعديل السعر ✏️</Text>
                  </TouchableOpacity>
                </View>

                {(basePriceForSuggestions > 0 || parseInt(price) > 0) && (
                  <View style={[styles.suggestionsRow, { marginBottom: 0, marginTop: 5 }]}>
                    {[1.2, 1.4, 1.6].map((multiplier, index) => {
                      const displayBasePrice = basePriceForSuggestions > 0 ? basePriceForSuggestions : parseInt(price);
                      const suggestedPrice = Math.round(displayBasePrice * multiplier);
                      const currentPrice = price || displayBasePrice.toString();
                      const isSelected = currentPrice === suggestedPrice.toString();
                      const percentage = Math.round((multiplier - 1) * 100);
                      return (
                        <TouchableOpacity 
                          key={index} 
                          style={[styles.suggestionBtn, isDarkMode && { backgroundColor: '#0f172a', borderColor: '#475569' }, isSelected && styles.suggestionBtnActive]} 
                          onPress={async () => { 
                            const newPriceStr = suggestedPrice.toString();
                            setPrice(newPriceStr); 
                            try {
                              if (currentRideId) await updateDoc(doc(db, 'rides', currentRideId), { price: newPriceStr });
                              const savedRide = await AsyncStorage.getItem('active_ride');
                              if (savedRide) {
                                const data = JSON.parse(savedRide);
                                data.price = newPriceStr;
                                await AsyncStorage.setItem('active_ride', JSON.stringify(data));
                              }
                            } catch(e) {}
                          }}
                        >
                          <Text style={[styles.suggestionText, isDarkMode && { color: '#cbd5e1' }, isSelected && styles.suggestionTextActive]}>{suggestedPrice}</Text>
                          <Text style={[styles.suggestionSubText, isDarkMode && { color: '#94a3b8' }, isSelected && styles.suggestionSubTextActive]}>+{percentage}%</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>

              <TouchableOpacity 
                style={{ flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: autoAcceptEnabled ? '#ecfdf5' : (isDarkMode ? '#0f172a' : '#ffffff'), padding: 10, borderRadius: 10, borderWidth: 1, borderColor: autoAcceptEnabled ? '#10b981' : (isDarkMode ? '#475569' : '#cbd5e1'), marginBottom: 15 }} 
                onPress={() => setAutoAcceptEnabled(!autoAcceptEnabled)}
              >
                <Ionicons name={autoAcceptEnabled ? "checkmark-circle" : "ellipse-outline"} size={24} color={autoAcceptEnabled ? "#10b981" : "#94a3b8"} />
                <View style={{ marginRight: 10, flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: 'bold', color: autoAcceptEnabled ? '#064e3b' : (isDarkMode ? '#cbd5e1' : '#475569'), textAlign: 'right' }}>القبول التلقائي ⚡</Text>
                  <Text style={{ fontSize: 11, color: '#64748b', textAlign: 'right' }}>قبول العروض المطابقة لسعرك تلقائياً ورفض الأعلى.</Text>
                </View>
              </TouchableOpacity>
            </View>
          )}

          {offers.length === 0 ? (<Text style={styles.subText}>يرجى الانتظار قليلاً لتلقي عروض الكباتن...</Text>) : null}
          <ScrollView style={styles.offersContainer} showsVerticalScrollIndicator={false}>
            {offers.map((offer, index) => (
              <PassengerOfferCard key={index} offer={offer} onAcceptOffer={acceptCaptainOffer} onRejectOffer={rejectCaptainOffer} isDarkMode={isDarkMode} requestedPrice={price} />
            ))}
          </ScrollView>
          
          <TouchableOpacity 
            style={styles.cancelBtnOnly} 
            onPress={() => Alert.alert('إلغاء البحث', 'هل أنت متأكد من إلغاء البحث عن كابتن؟', [{ text: 'تراجع', style: 'cancel' }, { text: 'نعم، إلغاء', onPress: handleCancelRide }])}
          >
            <Text style={styles.cancelBtnOnlyText}>إلغاء البحث</Text>
          </TouchableOpacity>

        </View>
      )}
      
      {['accepted', 'passenger_on_the_way', 'captain_arrived', 'waiting_for_scan', 'in_progress'].includes(rideStatus) && (
        <Animated.View style={[styles.cardActive, isDarkMode && { backgroundColor: '#1e293b', borderColor: '#d97706' }, (rideStatus === 'captain_arrived' || rideStatus === 'waiting_for_scan') && styles.cardArrivalPulse, (rideStatus === 'captain_arrived' || rideStatus === 'waiting_for_scan') && { backgroundColor: backgroundColorInterpolate }]}>
          
          <ScrollView ref={activeRideScrollRef} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
            
            <View style={{ flexDirection: 'row-reverse', justifyContent: 'center', alignItems: 'center', marginBottom: 15, width: '100%' }}>
              
              {waitingTimeLeft === 0 && ['captain_arrived', 'waiting_for_scan', 'passenger_on_the_way'].includes(rideStatus) ? (
                <Text style={[styles.statusAlertTitle, { marginBottom: 0, textAlign: 'center', color: '#ef4444', fontSize: 18, paddingVertical: 5 }]}>
                  تنبيه: يحق للكابتن إلغاء الرحلة ⚠️
                </Text>
              ) : (
                <>
                  <View style={{ flex: 1 }}>
                    {rideStatus === 'captain_arrived' ? (
                      <>
                        <Text style={[styles.superArrivalTitle, { textAlign: 'right', marginBottom: 4 }]}>براقك وصل !</Text>
                        <Text style={[styles.statusArrivalAlert, { textAlign: 'right', marginBottom: 0, fontSize: 13 }]}>الكابتن في الخارج بانتظارك.</Text>
                      </>
                    ) : (
                      <Text style={[styles.statusAlertTitle, rideStatus === 'waiting_for_scan' && { color: '#ffffff' }, { textAlign: 'right', marginBottom: 0, fontSize: 16 }]}>
                        {rideStatus === 'accepted' ? 'الكابتن في طريقه إليك ...' : 
                         rideStatus === 'passenger_on_the_way' ? 'الكابتن في انتظارك' : 
                         rideStatus === 'waiting_for_scan' ? 'يرجى مسح كود QR للبدء' : 'الرحلة جارية الآن'}
                      </Text>
                    )}
                  </View>

                  {['captain_arrived', 'waiting_for_scan', 'passenger_on_the_way'].includes(rideStatus) && waitingTimeLeft > 0 && (
                    <View style={{ backgroundColor: '#eff6ff', paddingVertical: 6, paddingHorizontal: 15, borderRadius: 10, borderWidth: 1.5, borderColor: '#3b82f6', alignItems: 'center', elevation: 2, marginLeft: 10 }}>
                      <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#1e3a8a', marginBottom: 2 }}>
                        وقت الانتظار
                      </Text>
                      <Text style={{ fontSize: 18, fontWeight: '900', color: '#1d4ed8' }}>
                        {formatTimer(waitingTimeLeft)}
                      </Text>
                    </View>
                  )}
                </>
              )}
            </View>

            {rideStatus === 'accepted' && (
              <View style={{ 
                backgroundColor: isDarkMode ? '#1e3a8a' : '#dbeafe', 
                padding: 12, 
                borderRadius: 12, 
                marginBottom: 15, 
                flexDirection: 'row-reverse', 
                alignItems: 'center', 
                justifyContent: 'center', 
                borderWidth: 1, 
                borderColor: '#3b82f6', 
                elevation: 2 
              }}>
                <Text style={{ fontSize: 22, marginLeft: 10 }}>⏱</Text>
                <Text style={{ fontSize: 15, fontWeight: 'bold', color: isDarkMode ? '#bfdbfe' : '#1e3a8a' }}>
                  {pickupCoords && captainLiveCoords 
                    ? `الوقت المقدر للوصول: ${Math.max(1, Math.ceil((calculateDistance(captainLiveCoords.latitude, captainLiveCoords.longitude, pickupCoords.latitude, pickupCoords.longitude) / 1000) * 2.5))} دقيقة` 
                    : 'جاري الاتصال بالكابتن وحساب الوقت...'}
                </Text>
              </View>
            )}

            <TouchableOpacity 
              style={{
                backgroundColor: '#ef4444', 
                paddingVertical: 12, 
                borderRadius: 10, 
                flexDirection: 'row-reverse', 
                justifyContent: 'center', 
                alignItems: 'center', 
                gap: 10,
                marginTop: 15,
                borderWidth: 2,
                borderColor: '#b91c1c'
              }}
            >
              <Ionicons name="warning" size={24} color="#ffffff" />
              <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: 'bold' }}>أنا في خطر (SOS)</Text>
            </TouchableOpacity>

            {latestMessage ? (
              <View style={{ backgroundColor: isDarkMode ? '#334155' : '#1e293b', padding: 15, borderRadius: 12, marginBottom: 15, flexDirection: 'row-reverse', alignItems: 'center', elevation: 2 }}>
                <Text style={{ fontSize: 22, marginLeft: 10 }}>💬</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#94a3b8', fontSize: 11, textAlign: 'right', marginBottom: 2 }}>أحدث رسالة من الكابتن :</Text>
                  <Text style={{ color: '#ffffff', fontSize: 14, fontWeight: 'bold', textAlign: 'right' }} numberOfLines={2}>{latestMessage}</Text>
                </View>
              </View>
            ) : null}
            
            <View style={[styles.captainCard, isDarkMode && { backgroundColor: '#334155' }]}>
              <Image source={{ uri: getSafeAvatar(captainInfo.avatar) }} style={styles.captainAvatar} />
              <View style={styles.captainDetails}>
                <Text style={[styles.captainText, isDarkMode && { color: '#f8fafc' }]} numberOfLines={1}>الكابتن: {captainInfo.name}</Text>
                <Text style={[styles.captainText, isDarkMode && { color: '#f8fafc' }]} numberOfLines={2}>
                  المركبة: {captainInfo.vehicle ? captainInfo.vehicle.replace('بديل توكتوك', '').replace(/[()\-]/g, '').trim() || 'كيوت 3 راكب' : 'مركبة'}
                </Text>
                {captainInfo.plateNumber && captainInfo.plateNumber !== 'لم يسجل لوحة' ? (
                  <Text style={[styles.captainText, isDarkMode && { color: '#f8fafc' }]} numberOfLines={1}>
                    {captainInfo.vehicle?.includes('توكتوك') || captainInfo.vehicle?.includes('كيوت') || captainInfo.vehicle?.includes('جالاكسي') ? `الرقم الكودي للمركبة: (${captainInfo.plateNumber})` : `لوحة: ${captainInfo.plateNumber}`}
                  </Text>
                ) : null}
              </View>
            </View>

            {rideStatus === 'waiting_for_scan' && (
              <View style={[styles.authContainer, isDarkMode && { backgroundColor: '#0f172a' }]}>
                <TouchableOpacity style={styles.scanBtn} onPress={openScanner}>
                  <Text style={styles.scanBtnText}>امسح كود الكابتن لبدء الرحلة</Text>
                </TouchableOpacity>
                <Text style={styles.orText}>أو ملّي الكابتن الكود السري</Text>
                <View style={styles.numericCodeBox}>
                  <Text style={styles.numericCode}>{numericSecret ? numericSecret : '...'}</Text>
                </View>
              </View>
            )}

            {/* 🗺️ خريطة التتبع المباشر (تتحرك مع الكابتن وبترسم المسار) */}
            {pickupCoords && captainLiveCoords && (
              <View style={{ width: '100%', height: 280, borderRadius: 16, overflow: 'hidden', marginBottom: 15, borderWidth: 2, borderColor: '#3b82f6', backgroundColor: '#e2e8f0', position: 'relative' }}>
                <MapView
                  provider={PROVIDER_GOOGLE}
                  style={{ flex: 1, width: '100%', height: '100%' }}
                  customMapStyle={isDarkMode ? darkMapStyle : []} 
                  region={{
                    latitude: (pickupCoords.latitude + captainLiveCoords.latitude) / 2,
                    longitude: (pickupCoords.longitude + captainLiveCoords.longitude) / 2,
                    latitudeDelta: Math.abs(pickupCoords.latitude - captainLiveCoords.latitude) * 1.5 || 0.02,
                    longitudeDelta: Math.abs(pickupCoords.longitude - captainLiveCoords.longitude) * 1.5 || 0.02,
                  }}
                >
                  <Marker coordinate={{ latitude: Number(captainLiveCoords.latitude), longitude: Number(captainLiveCoords.longitude) }} title="الكابتن هنا">
                    <View style={{ backgroundColor: '#1e3a8a', padding: 8, borderRadius: 20, borderWidth: 3, borderColor: '#a3e635', alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 14 }}>A</Text>
                      <Text style={{ fontSize: 20 }}>{captainInfo.vehicle === 'car' ? '🚗' : captainInfo.vehicle === 'scooter' ? '🛵' : '🛺'}</Text>
                    </View>
                  </Marker>

                  <Marker coordinate={{ latitude: Number(pickupCoords.latitude), longitude: Number(pickupCoords.longitude) }} title="موقعك">
                    <View style={{ backgroundColor: '#22c55e', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, alignItems: 'center' }}>
                      <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 18 }}>B</Text>
                    </View>
                  </Marker>

                  {GOOGLE_MAPS_APIKEY !== 'AIzaSyDh901lCbt6rjxgUkFe4X9ns3CLAL4fVHg' && (
                    <MapViewDirections
                      origin={{ latitude: Number(captainLiveCoords.latitude), longitude: Number(captainLiveCoords.longitude) }}
                      destination={{ latitude: Number(pickupCoords.latitude), longitude: Number(pickupCoords.longitude) }}
                      apikey={GOOGLE_MAPS_APIKEY}
                      strokeWidth={6}
                      strokeColor="#a3e635"
                      language="ar"
                    />
                  )}
                  {GOOGLE_MAPS_APIKEY === 'AIzaSyDh901lCbt6rjxgUkFe4X9ns3CLAL4fVHg' && (
                     <Polyline 
                       coordinates={[{ latitude: Number(captainLiveCoords.latitude), longitude: Number(captainLiveCoords.longitude) }, { latitude: Number(pickupCoords.latitude), longitude: Number(pickupCoords.longitude) }]} 
                       strokeColor="#a3e635" 
                       strokeWidth={5} 
                     />
                  )}
                </MapView>

                {waitingTimeLeft > 0 && (
                  <View style={{ position: 'absolute', top: 20, right: 20, backgroundColor: '#3b82f6', paddingHorizontal: 20, paddingVertical: 15, borderRadius: 12, alignItems: 'center', elevation: 5 }}>
                    <Text style={{ color: 'white', fontSize: 20, fontWeight: '900' }}>{Math.ceil(waitingTimeLeft / 60)} دقيقة</Text>
                    <Text style={{ color: 'white', fontSize: 16, fontWeight: 'bold', marginTop: 4 }}>
                      {((calculateDistance(captainLiveCoords.latitude, captainLiveCoords.longitude, pickupCoords.latitude, pickupCoords.longitude)) / 1000).toFixed(1)} كم
                    </Text>
                  </View>
                )}
              </View>
            )}

            <View style={[styles.tripRouteContainer, isDarkMode && { backgroundColor: '#334155', borderColor: '#475569' }]}>
              <View style={styles.routeItemBox}>
                <Text style={[styles.routeIconText, destinations.length === 1 && { fontSize: 18, marginTop: 4 }]}>🟢</Text>
                <Text 
                  style={[styles.routeMainText, isDarkMode && { color: '#ffffff' }, destinations.length === 1 && { fontSize: 22, lineHeight: 32 }]} 
                  numberOfLines={destinations.length > 1 ? 2 : 3}
                  adjustsFontSizeToFit={true}
                  minimumFontScale={0.7}
                >
                  {pickup}
                </Text>
              </View>

              {destinations.map((d, i) => (
                <View key={i} style={styles.routeItemBox}>
                  <Text style={[styles.routeIconText, destinations.length === 1 && { fontSize: 18, marginTop: 4 }]}>🔴</Text>
                  <Text 
                    style={[styles.routeDestText, isDarkMode && { color: '#cbd5e1' }, destinations.length === 1 && { fontSize: 20, lineHeight: 30 }]} 
                    numberOfLines={destinations.length > 1 ? 2 : 3}
                    adjustsFontSizeToFit={true}
                    minimumFontScale={0.7}
                  >
                    {destinations.length > 1 ? `وجهة ${i + 1}: ${d}` : d}
                  </Text>
                </View>
              ))}

             <View style={[styles.divider, isDarkMode && { backgroundColor: '#475569' }]} />

              <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' }}>
                <View style={[styles.priceBox, { flex: 1, marginLeft: 10 }, isDarkMode && { backgroundColor: '#064e3b', borderColor: '#059669' }]}>
                  <Text style={[styles.priceLabel, isDarkMode && { color: '#a7f3d0' }]}>السعر النهائي للرحلة</Text>
                  <Text 
                    style={[styles.hugePriceTag, isDarkMode && { color: '#34d399' }]} 
                    numberOfLines={1} 
                    adjustsFontSizeToFit={true}
                  >
                    {price} جنيه
                  </Text>
                </View>
                
                <TouchableOpacity 
                  style={{ backgroundColor: '#3b82f6', paddingVertical: 12, paddingHorizontal: 15, borderRadius: 10, elevation: 2, alignItems: 'center' }}
                  onPress={openEditDestModal}
                >
                  <Text style={{ color: '#ffffff', fontWeight: 'bold', fontSize: 13 }}>تعديل الوجهة ✏️</Text>
                </TouchableOpacity>
              </View>
            </View>
            {rideStatus === 'captain_arrived' && (
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

            {rideStatus !== 'in_progress' && (
              <TouchableOpacity style={[styles.cancelOrderBtn, { marginBottom: 10 }]} onPress={() => Alert.alert('إلغاء الرحلة', 'هل أنت متأكد من إلغاء الرحلة؟', [{ text: 'تراجع', style: 'cancel' }, { text: 'نعم، إلغاء', onPress: handleCancelRide }])}>
                <Text style={styles.cancelOrderBtnText}>إلغاء الرحلة</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.safetyBtn} onPress={sendSafetyLocation} disabled={isSendingLocation}>
              {isSendingLocation ? (<ActivityIndicator color="#ffffff" />) : (<Text style={styles.safetyBtnText}>مشاركة مسار الرحلة (أمان)</Text>)}
            </TouchableOpacity>
          </ScrollView>
        </Animated.View>
      )}

{/* مودال تعديل الوجهة الموحد (يعمل باقتراحات جوجل والسعر اللايف) */}
      <Modal visible={isEditDestModalVisible} transparent={true} animationType="fade">
        <View style={styles.modaloverlay}>
          <View style={[styles.modalContent, isDarkMode && { backgroundColor: '#1e293b' }, { minHeight: 450 }]}>
            <Text style={[styles.modalTitle, isDarkMode && { color: '#ffffff' }]}>تعديل الوجهة 🗺️</Text>
            
            <View style={{ height: 280, width: '100%', marginTop: 10, zIndex: 9999 }}>
              <ScrollView 
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="always"
                contentContainerStyle={{ flexGrow: 1, paddingBottom: 100 }}
              >
                {tempDestinations.map((dest, index) => (
                  <View key={index} style={{ flexDirection: 'row-reverse', alignItems: 'center', marginBottom: 15, zIndex: 1000 - index }}>
                    <Text style={{ fontSize: 16, marginRight: 5, color: isDarkMode ? '#cbd5e1' : '#475569', fontWeight: 'bold' }}>
                      {index === 0 ? 'إلى:' : 'ثم:'}
                    </Text>
                    
                    <View style={{ flex: 1, marginLeft: 10, zIndex: 1000 - index }}>
                      <GooglePlacesAutocomplete
                        placeholder="ابحث عن الوجهة الجديدة..."
                        fetchDetails={true}
                        enablePoweredByContainer={false}
                        isRowScrollable={false}
                        // @ts-ignore
                        getDefaultValue={() => dest}
                        onPress={(data: any, details: any = null) => {
                          handleTempDestChange(data.description, index);
                        }}
                        query={{ key: GOOGLE_MAPS_APIKEY, language: 'ar', components: 'country:eg' }}
                        textInputProps={{
                          placeholderTextColor: isDarkMode ? '#64748b' : '#94a3b8',
                          defaultValue: dest,
                          onChangeText: (text: string) => {
                            handleTempDestChange(text, index);
                          }
                        }}
                        renderRow={(rowData: any) => (
                          <Text style={{ flex: 1, flexWrap: 'wrap', textAlign: 'right', writingDirection: 'rtl', color: isDarkMode ? '#ffffff' : '#1e293b', fontSize: 14, lineHeight: 22 }}>
                            {rowData.description}
                          </Text>
                        )}
                        styles={{
                          container: { flex: 0, width: '100%' },
                          textInputContainer: { backgroundColor: isDarkMode ? '#334155' : '#f8fafc', borderWidth: 1, borderColor: isDarkMode ? '#475569' : '#cbd5e1', borderRadius: 12, flexDirection: 'row-reverse', alignItems: 'center' },
                          textInput: { height: 45, color: isDarkMode ? '#ffffff' : '#0f172a', backgroundColor: 'transparent', fontSize: 14, textAlign: 'right', paddingHorizontal: 10 },
                          listView: { position: 'absolute', top: 48, width: '100%', zIndex: 10000, backgroundColor: isDarkMode ? '#1e293b' : '#ffffff', borderRadius: 12, elevation: 10 },
                          row: { paddingVertical: 12, paddingHorizontal: 15, flexDirection: 'row-reverse', alignItems: 'center', width: '100%', minHeight: 50 },
                          description: { color: isDarkMode ? '#ffffff' : '#0f172a' }
                        }}
                      />
                    </View>
                    
                    {index > 0 && (
                      <TouchableOpacity style={{ backgroundColor: '#fee2e2', padding: 10, borderRadius: 10, marginRight: 8 }} onPress={() => removeTempDest(index)}>
                        <Ionicons name="trash" size={20} color="#ef4444" />
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
                
                {tempDestinations.length < 3 && (
                  <TouchableOpacity style={{ backgroundColor: isDarkMode ? '#334155' : '#f8fafc', paddingVertical: 12, borderRadius: 12, alignItems: 'center', marginBottom: 10, borderWidth: 1, borderColor: isDarkMode ? '#475569' : '#cbd5e1', borderStyle: 'dashed' }} onPress={addTempDest}>
                    <Text style={{ color: isDarkMode ? '#60a5fa' : '#3b82f6', fontWeight: 'bold' }}>+ إضافة وجهة أخرى</Text>
                  </TouchableOpacity>
                )}
              </ScrollView>
            </View>

            {/* 💰 قسم حساب السعر المباشر داخل المودال */}
            <View style={{ backgroundColor: isDarkMode ? '#0f172a' : '#f8fafc', padding: 15, borderRadius: 12, marginTop: 5, borderWidth: 1, borderColor: isDarkMode ? '#334155' : '#e2e8f0', zIndex: 1 }}>
               {isModalCalculating ? (
                  <View style={{ alignItems: 'center', paddingVertical: 10 }}>
                     <ActivityIndicator color="#10b981" size="small" />
                     <Text style={{ color: '#10b981', fontSize: 12, marginTop: 5, fontWeight: 'bold' }}>جاري حساب المسافة والسعر...</Text>
                  </View>
               ) : (
                 <>
                   <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                     <Text style={{ fontSize: 14, color: isDarkMode ? '#cbd5e1' : '#475569', fontWeight: 'bold' }}>السعر المقترح (للوجهة الجديدة):</Text>
                     <Text style={{ fontSize: 20, fontWeight: '900', color: '#10b981' }}>{modalBasePrice} ج</Text>
                   </View>
                   
                   <View style={{ flexDirection: 'row-reverse', alignItems: 'center', marginBottom: 15, gap: 10 }}>
                     <Text style={{ fontSize: 14, color: isDarkMode ? '#94a3b8' : '#64748b', fontWeight: 'bold' }}>تعديل سعرك:</Text>
                     <TextInput 
                        style={{ flex: 1, backgroundColor: isDarkMode ? '#1e293b' : '#ffffff', borderWidth: 2, borderColor: '#d97706', borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12, textAlign: 'center', color: isDarkMode ? '#ffffff' : '#1e293b', fontWeight: 'bold', fontSize: 18 }}
                        keyboardType="numeric"
                        value={modalPrice}
                        onChangeText={setModalPrice}
                     />
                     <Text style={{ fontSize: 14, color: isDarkMode ? '#94a3b8' : '#64748b', fontWeight: 'bold' }}>جنيه</Text>
                   </View>

                   {modalBasePrice > 0 && (
                     <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', gap: 8 }}>
                        {[1.2, 1.4, 1.6].map((multiplier, idx) => {
                          const suggested = Math.round(modalBasePrice * multiplier);
                          const isSelected = modalPrice === suggested.toString();
                          return (
                            <TouchableOpacity 
                              key={idx} 
                              style={{ flex: 1, backgroundColor: isSelected ? '#d97706' : (isDarkMode ? '#334155' : '#ffffff'), paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: isSelected ? '#d97706' : (isDarkMode ? '#475569' : '#cbd5e1'), alignItems: 'center', elevation: isSelected ? 2 : 0 }}
                              onPress={() => setModalPrice(suggested.toString())}
                            >
                               <Text style={{ color: isSelected ? '#ffffff' : (isDarkMode ? '#cbd5e1' : '#475569'), fontWeight: 'bold', fontSize: 15 }}>{suggested}</Text>
                               <Text style={{ color: isSelected ? '#fef3c7' : '#94a3b8', fontSize: 11, marginTop: 2 }}>+{Math.round((multiplier - 1)*100)}%</Text>
                            </TouchableOpacity>
                          )
                        })}
                     </View>
                   )}
                 </>
               )}
            </View>

            <View style={[styles.modalButtonsRow, { marginTop: 15, zIndex: 1 }]}>
              <TouchableOpacity style={[styles.modalSaveBtn, isModalCalculating && { opacity: 0.5 }]} disabled={isModalCalculating} onPress={saveNewDestinations}>
                <Text style={styles.modalSaveBtnText}>حفظ وتحديث السعر ✅</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setIsEditDestModalVisible(false)}>
                <Text style={styles.modalCancelBtnText}>إلغاء ❌</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* مودال الطوارئ */}
      <Modal visible={isEmergencyModalVisible} transparent={true} animationType="fade">
        <View style={styles.modaloverlay}>
          <View style={[styles.modalContent, isDarkMode && { backgroundColor: '#1e293b' }]}>
            <Text style={[styles.modalTitle, isDarkMode && { color: '#ffffff' }]}>إعداد رقم الطوارئ</Text>
            <Text style={[styles.modalSubtitle, isDarkMode && { color: '#cbd5e1' }]}>يرجى إدخال رقم هاتف شخص تثق به يمتلك واتساب. لمشاركة مسار رحلتك معه بنقرة واحدة لاحقا.</Text>
            <TextInput style={[styles.modalInput, isDarkMode && { backgroundColor: '#334155', color: '#ffffff', borderColor: '#475569' }]} value={tempEmergencyPhone} onChangeText={setTempEmergencyPhone} keyboardType="phone-pad" placeholder="مثال: ٠١٠١٢٣٤٥٦٧٨" placeholderTextColor={isDarkMode ? '#64748b' : '#94a3b8'} />
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

      {/* مودال الماسح الضوئي */}
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

      {/* مودال التقييم */}
      <Modal visible={isRatingModalVisible} transparent={true} animationType="fade">
        <View style={styles.modaloverlay}>
          <View style={[styles.ratingModalContent, isDarkMode && { backgroundColor: '#1e293b' }]}>
            {!ratingSubmitted ? (
              <>
                <Text style={[styles.modalTitle, isDarkMode && { color: '#ffffff' }, { fontSize: 20, marginBottom: 5 }]}>كيف كانت الرحلة ؟</Text>
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
                      {passengerRatingTags.map(tag => {
                        const isSelected = selectedTags.includes(tag);
                        return (
                          <TouchableOpacity 
                            key={tag} 
                            style={[styles.tagBtn, isDarkMode && { backgroundColor: '#334155', borderColor: '#475569' }, isSelected && styles.tagBtnActive]} 
                            onPress={() => setSelectedTags(prev => isSelected ? prev.filter(t => t !== tag) : [...prev, tag])}
                          >
                            <Text style={[styles.tagText, isDarkMode && { color: '#cbd5e1' }, isSelected && styles.tagTextActive]}>{tag}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                )}
                {rating > 0 && (
                  <TextInput 
                    style={[styles.reasonInput, isDarkMode && { backgroundColor: '#334155', color: '#ffffff', borderColor: '#475569' }]} 
                    placeholder={rating === 5 ? "تعليق إضافي (اختياري)..." : "ما هو سبب تقييمك؟ (إلزامي)"} 
                    placeholderTextColor={isDarkMode ? '#64748b' : '#94a3b8'} 
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
                <Text style={[styles.successRatingText, isDarkMode && { color: '#ffffff' }]}>تم التقييم بنجاح</Text>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* 🗺️ مودال اختيار الموقع من الخريطة (يتحرك الدبوس لالتقاط العنوان) */}
      <Modal visible={isMapPickerVisible} transparent={true} animationType="slide">
        <View style={{ flex: 1, backgroundColor: isDarkMode ? '#0f172a' : '#f8fafc' }}>
          
          {/* الهيدر وزر الإغلاق */}
          <View style={{ position: 'absolute', top: 40, left: 20, right: 20, zIndex: 1, flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' }}>
            <TouchableOpacity style={{ backgroundColor: isDarkMode ? '#334155' : '#ffffff', padding: 10, borderRadius: 50, elevation: 5, borderWidth: 1, borderColor: isDarkMode ? '#475569' : '#e2e8f0' }} onPress={() => setIsMapPickerVisible(false)}>
              <Ionicons name="close" size={24} color={isDarkMode ? '#ffffff' : '#0f172a'} />
            </TouchableOpacity>
            
            <View style={{ backgroundColor: isDarkMode ? '#1e293b' : '#ffffff', padding: 12, borderRadius: 20, flex: 1, marginRight: 10, elevation: 5, borderWidth: 1, borderColor: '#3b82f6' }}>
              <Text style={{ textAlign: 'right', fontWeight: 'bold', color: isDarkMode ? '#e2e8f0' : '#0f172a', fontSize: 13 }} numberOfLines={2}>
                {isGeocoding ? '⏳ جاري قراءة اسم الشارع...' : (mapPickerAddress || '📍 حرك الخريطة لاختيار الموقع')}
              </Text>
            </View>
          </View>

          {/* الخريطة التفاعلية */}
          <MapView
            style={{ flex: 1 }}
            provider={PROVIDER_GOOGLE}
            customMapStyle={isDarkMode ? darkMapStyle : []}
            showsUserLocation={true}
            initialRegion={{
              latitude: mapPickerCoords?.latitude || 30.0444,
              longitude: mapPickerCoords?.longitude || 31.2357,
              latitudeDelta: 0.005,
              longitudeDelta: 0.005,
            }}
            onRegionChangeComplete={async (region) => {
              setMapPickerCoords({ latitude: region.latitude, longitude: region.longitude });
              setIsGeocoding(true);
              try {
                let geocode = await Location.reverseGeocodeAsync({ latitude: region.latitude, longitude: region.longitude });
                if (geocode && geocode.length > 0) {
                  const place = geocode[0];
                  const address = [place.name, place.street, place.subregion || place.district, place.city].filter(Boolean).join('، ');
                  setMapPickerAddress(address || `موقع محدد (${region.latitude.toFixed(3)}, ${region.longitude.toFixed(3)})`);
                } else {
                  setMapPickerAddress(`موقع محدد (${region.latitude.toFixed(3)}, ${region.longitude.toFixed(3)})`);
                }
              } catch (e) {
                setMapPickerAddress(`موقع محدد (${region.latitude.toFixed(3)}, ${region.longitude.toFixed(3)})`);
              } finally {
                setIsGeocoding(false);
              }
            }}
          />

          {/* الدبوس الثابت في منتصف الشاشة */}
          <View style={{ position: 'absolute', top: '50%', left: '50%', marginLeft: -24, marginTop: -48, alignItems: 'center' }}>
            <Ionicons name="location" size={48} color="#ef4444" />
            <View style={{ width: 10, height: 10, backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 5, marginTop: -5, transform: [{ scaleX: 2 }] }} />
          </View>

          {/* زر التأكيد */}
          <View style={{ position: 'absolute', bottom: 30, left: 20, right: 20 }}>
            <TouchableOpacity
              style={{ backgroundColor: isGeocoding ? '#94a3b8' : '#10b981', paddingVertical: 16, borderRadius: 14, alignItems: 'center', elevation: 5, borderWidth: 2, borderColor: '#34d399' }}
              disabled={isGeocoding}
              onPress={() => {
                if (mapPickerIndex !== null && mapPickerAddress) {
                   handleDestinationChange(mapPickerAddress, mapPickerIndex);
                }
                setIsMapPickerVisible(false);
              }}
            >
              <Text style={{ color: '#ffffff', fontSize: 18, fontWeight: 'bold' }}>
                {isGeocoding ? 'انتظر قليلاً...' : 'تأكيد الوجهة من هنا ✅'}
              </Text>
            </TouchableOpacity>
          </View>

        </View>
      </Modal>

      {/* القائمة الجانبية (تصميم مطابق لنسخة الكابتن بدون المحفظة) */}
      <Modal visible={isSidebarOpen} transparent={true} animationType="fade" onRequestClose={closeSidebar}>
        <View style={styles.sidebarOverlay}>
          <TouchableOpacity style={styles.sidebarCloseArea} onPress={closeSidebar} activeOpacity={1} />
          <Animated.View style={[styles.sidebarPanel, isDarkMode && { backgroundColor: '#0f172a' }]}>
            
            {/* الهيدر الكحلي المطابق للكابتن */}
            <View style={[styles.sidebarHeader, isDarkMode && { backgroundColor: '#1e293b' }]}>
              <View style={styles.sidebarAvatarContainer}>
                <Image source={{ uri: passengerProfile.avatar }} style={styles.sidebarAvatar} />
              </View>
              <Text style={styles.sidebarName}>{passengerProfile.name}</Text>
              <Text style={styles.sidebarPhone}>{passengerProfile.phone || '01000000000'}</Text>
            </View>

            <ScrollView style={styles.sidebarLinks} showsVerticalScrollIndicator={false}>
              
              {/* الإشعارات */}
              <TouchableOpacity style={[styles.sidebarLink, isDarkMode && { borderBottomColor: '#334155' }]} onPress={() => { closeSidebar(); router.push('/passenger-notifications'); }}>
                <Text style={[styles.sidebarLinkText, isDarkMode && { color: '#e2e8f0' }]}>الإشعارات 🔔</Text>
              </TouchableOpacity>

              {/* سجل الرحلات */}
              <TouchableOpacity style={[styles.sidebarLink, isDarkMode && { borderBottomColor: '#334155' }]} onPress={() => { closeSidebar(); router.push('/passenger-history'); }}>
                <Text style={[styles.sidebarLinkText, isDarkMode && { color: '#e2e8f0' }]}>سجل الرحلات</Text>
              </TouchableOpacity>

              {/* التقييمات */}
              <TouchableOpacity style={[styles.sidebarLink, isDarkMode && { borderBottomColor: '#334155' }]} onPress={() => { closeSidebar(); router.push('/passenger-ratings'); }}>
                <Text style={[styles.sidebarLinkText, isDarkMode && { color: '#e2e8f0' }]}>التقييمات ⭐</Text>
              </TouchableOpacity>

              {/* الدعم الفني */}
              <TouchableOpacity style={[styles.sidebarLink, isDarkMode && { borderBottomColor: '#334155' }]} onPress={() => { closeSidebar(); router.push('/support'); }}>
                <Text style={[styles.sidebarLinkText, isDarkMode && { color: '#e2e8f0' }]}>الدعم الفني</Text>
              </TouchableOpacity>

              {/* 👈 الزرار الجديد المستقل للشكاوى والمقترحات والمفقودات */}
              <TouchableOpacity 
                style={[styles.sidebarLink, isDarkMode && { borderBottomColor: '#334155' }]} 
                onPress={() => { closeSidebar(); router.push('/passenger-complaints' as any); }}
              >
                <Text style={[styles.sidebarLinkText, isDarkMode && { color: '#e2e8f0' }]}>المقترحات والشكاوى والمفقودات</Text>
              </TouchableOpacity>

              {/* زرار الدعم الفني المباشر الأخضر */}
              <TouchableOpacity style={styles.sidebarSupportBtn} onPress={() => { closeSidebar(); router.push('/support-live-chat' as any); }}>
                <Text style={styles.sidebarSupportBtnText}>💬 محادثة الدعم الفني (مباشر)</Text>
              </TouchableOpacity>

              {/* تسجيل الخروج */}
              <TouchableOpacity style={styles.sidebarLogoutBtn} onPress={handleLogout}>
                <Text style={styles.sidebarLogoutText}>تسجيل الخروج</Text>
              </TouchableOpacity>
              
            </ScrollView>
          </Animated.View>
        </View>
      </Modal>

    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  userInfoCentered: { flexDirection: 'row-reverse', alignItems: 'center', flex: 1, justifyContent: 'center' },
  profileTextContainer: { alignItems: 'center', marginRight: 10 },
  headerSettingsBtn: { padding: 8, backgroundColor: '#f8fafc', borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0' },
  container: { flex: 1, backgroundColor: '#f1f5f9', padding: 15, paddingTop: 40 },
  header: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#ffffff', padding: 12, borderRadius: 16, marginBottom: 20, elevation: 2 },
  profileAvatar: { width: 45, height: 45, borderRadius: 22.5, backgroundColor: '#cbd5e1', marginLeft: 10 },
  headerPassengerName: { fontSize: 14, fontWeight: 'bold', color: '#1e293b', marginRight: 8, textAlign: 'right' },
  toastContainer: { position: 'absolute', alignSelf: 'center', backgroundColor: '#1e293b', paddingVertical: 12, paddingHorizontal: 25, borderRadius: 30, zIndex: 9999, elevation: 10 },
  toastText: { color: '#ffffff', fontSize: 15, fontWeight: 'bold' },
  card: { backgroundColor: '#ffffff', borderRadius: 20, padding: 20, borderWidth: 1, borderColor: '#e2e8f0', elevation: 4, flex: 1, marginBottom: 10 },
  requestHeaderRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  cardTitle: { fontSize: 18, fontWeight: 'bold', color: '#1e293b', textAlign: 'right' },
  vehicleHeaderImg: { width: 75, height: 50 },
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
  passengerCountContainer: { marginBottom: 15 },
  rowInputContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  inputWithButton: { flex: 1, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 12, padding: 10, fontSize: 14, color: '#0f172a', textAlign: 'right', marginLeft: 8 },
  myLocationBtn: { backgroundColor: '#d97706', paddingVertical: 11, paddingHorizontal: 15, borderRadius: 12, justifyContent: 'center', alignItems: 'center', minWidth: 80 },
  myLocationBtnText: { color: '#ffffff', fontWeight: 'bold', fontSize: 13 },
  modernDestContainer: { flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: '#2C2C2E', borderRadius: 14, borderWidth: 1.5, borderColor: '#ffffff', paddingHorizontal: 12, paddingVertical: 8, marginBottom: 15, justifyContent: 'space-between', elevation: 3 },
  modernDestRight: { flexDirection: 'row-reverse', alignItems: 'center', flex: 1 },
  modernDestToText: { color: '#e5e7eb', fontSize: 18, fontWeight: 'bold', marginHorizontal: 8 },
  modernDestInput: { flex: 1, color: '#ffffff', fontSize: 15, textAlign: 'right', paddingVertical: 5, marginRight: 5 },
  modernDestMapBtn: { backgroundColor: '#4b5563', padding: 8, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
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
  paymentMethodsRow: { flexDirection: 'row-reverse', gap: 10, marginBottom: 20, marginTop: 5 },
  paymentBtn: { flex: 1, backgroundColor: '#f1f5f9', paddingVertical: 12, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: '#cbd5e1' },
  paymentBtnActive: { backgroundColor: '#10b981', borderColor: '#059669' },
  paymentBtnText: { fontSize: 14, fontWeight: 'bold', color: '#64748b' },
  paymentBtnTextActive: { color: '#ffffff' },
  offersContainer: { maxHeight: 300, marginBottom: 15 },
  offerCardPro: { backgroundColor: '#ffffff', borderRadius: 16, marginBottom: 15, borderWidth: 1, borderColor: '#cbd5e1', elevation: 4, overflow: 'hidden' },
  offerTopRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', padding: 15, borderBottomWidth: 1, borderBottomColor: '#f8fafc' },
  offerCaptainSide: { flexDirection: 'row-reverse', alignItems: 'center', flex: 1 },
  offerAvatarPro: { width: 50, height: 50, borderRadius: 25, marginLeft: 12, backgroundColor: '#e2e8f0', borderWidth: 1, borderColor: '#cbd5e1' },
  offerInfoCol: { flex: 1 },
  offerNamePro: { fontSize: 16, fontWeight: 'bold', color: '#1e293b', textAlign: 'right' },
  offerActionSide: { alignItems: 'flex-start', paddingRight: 15, borderRightWidth: 1, borderRightColor: '#f1f5f9' },
  offerPricePro: { fontSize: 22, fontWeight: 'bold', color: '#10b981', marginBottom: 5 },
  acceptOfferBtnPro: { backgroundColor: '#10b981', paddingVertical: 8, paddingHorizontal: 15, borderRadius: 10, elevation: 2 },
  acceptOfferBtnTextPro: { color: '#ffffff', fontWeight: 'bold', fontSize: 14 },
  rejectOfferBtnPro: { backgroundColor: '#fee2e2', paddingVertical: 8, paddingHorizontal: 15, borderRadius: 10, elevation: 1 },
  rejectOfferBtnTextPro: { color: '#ef4444', fontWeight: 'bold', fontSize: 14 },
  offerBottomRow: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#eff6ff', paddingVertical: 12, paddingHorizontal: 15, borderTopWidth: 1, borderTopColor: '#bfdbfe' },
  offerFullVehicleText: { flex: 1, fontSize: 14, color: '#1e3a8a', fontWeight: 'bold', textAlign: 'right', marginLeft: 10, lineHeight: 22 },
  offerVehicleIcon: { fontSize: 24 },
  offerPerksContainer: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 6, paddingHorizontal: 15, paddingBottom: 10, backgroundColor: '#eff6ff' },
  offerPerkBadge: { backgroundColor: '#dbeafe', paddingVertical: 4, paddingHorizontal: 8, borderRadius: 6, borderWidth: 1, borderColor: '#93c5fd' },
  offerPerkText: { color: '#1e40af', fontSize: 11, fontWeight: 'bold' },
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
  modalSubtitle: { fontSize: 13, color: '#64748b', textAlign: 'center', marginBottom: 20, lineHeight: 20 },
  modalInput: { backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 12, padding: 15, fontSize: 18, fontWeight: 'bold', color: '#0f172a', marginBottom: 20, letterSpacing: 1 },
  modalButtonsRow: { flexDirection: 'row-reverse', gap: 10 },
  modalSaveBtn: { flex: 2, backgroundColor: '#10b981', paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  modalSaveBtnText: { color: '#ffffff', fontWeight: 'bold', fontSize: 15 },
  modalCancelBtn: { flex: 1, backgroundColor: '#fee2e2', paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  modalCancelBtnText: { color: '#ef4444', fontWeight: 'bold', fontSize: 15 },
  regularCallBtn: { backgroundColor: '#f1f5f9', width: '100%', paddingVertical: 15, borderRadius: 12, alignItems: 'center', marginBottom: 10, borderWidth: 1, borderColor: '#cbd5e1' },
  regularCallBtnText: { color: '#1e293b', fontWeight: 'bold', fontSize: 16 },
  freeCallBtn: { backgroundColor: '#10b981', width: '100%', paddingVertical: 15, borderRadius: 12, alignItems: 'center', marginBottom: 15 },
  freeCallBtnText: { color: '#ffffff', fontWeight: 'bold', fontSize: 16 },
  cancelCallBtn: { paddingVertical: 10, marginTop: 10 },
  cancelCallBtnText: { color: '#ef4444', fontWeight: 'bold', fontSize: 16, textAlign: 'center' },
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
  sidebarHeader: { 
    backgroundColor: '#1f2937', // لون كحلي غامق مطابق للصورة
    padding: 20,
    paddingTop: 40,
    alignItems: 'center', 
    borderBottomWidth: 4, 
    borderColor: '#eab308' // الخط الأصفر الفاصل
  },
  sidebarAvatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    borderColor: '#eab308',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
    overflow: 'hidden'
  },
  sidebarAvatar: { 
    width: '100%',
    height: '100%',
    resizeMode: 'cover'
  },
  sidebarName: { fontSize: 18, fontWeight: 'bold', color: '#ffffff', marginBottom: 4 },
  sidebarPhone: { fontSize: 14, color: '#94a3b8' },
  sidebarLinks: { padding: 20 },
  sidebarLink: { 
    paddingVertical: 15,
    borderBottomWidth: 1, 
    borderColor: '#f1f5f9' 
  },
  sidebarLinkText: { fontSize: 16, color: '#1e293b', fontWeight: 'bold', textAlign: 'center' },
  sidebarSectionTitle: { fontSize: 14, color: '#64748b', fontWeight: 'bold', textAlign: 'center', marginTop: 20, marginBottom: 10 },
  sidebarSupportBtn: {
    backgroundColor: '#10b981', // اللون الأخضر المميز
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 15,
    elevation: 2
  },
  sidebarSupportBtnText: { color: '#ffffff', fontSize: 15, fontWeight: 'bold' },
  sidebarLogoutBtn: {
    backgroundColor: '#fee2e2', 
    paddingVertical: 14, 
    borderRadius: 8, 
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 30,
    borderWidth: 1,
    borderColor: '#fca5a5'
  },
  sidebarLogoutText: { color: '#ef4444', fontSize: 16, fontWeight: 'bold' },
  searchButton: { backgroundColor: '#d97706', paddingVertical: 15, borderRadius: 14, alignItems: 'center', elevation: 3, marginBottom: 20 },
  searchButtonText: { color: '#ffffff', fontSize: 18, fontWeight: 'bold' },
  captainCard: { flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: '#fef3c7', padding: 12, borderRadius: 14, marginBottom: 15 },
  captainAvatar: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#cbd5e1', marginLeft: 15 },
  captainDetails: { flex: 1 },
  captainText: { fontSize: 14, fontWeight: 'bold', color: '#1e293b', marginBottom: 2, textAlign: 'right' },
  authContainer: { alignItems: 'center', backgroundColor: '#1e293b', padding: 15, borderRadius: 14, marginBottom: 15, borderWidth: 1, borderColor: '#334155' },
  orText: { fontSize: 14, fontWeight: 'bold', color: '#94a3b8', marginVertical: 12 },
  numericCodeBox: { backgroundColor: '#3b82f6', paddingVertical: 12, paddingHorizontal: 30, borderRadius: 12, borderWidth: 2, borderColor: '#60a5fa', borderStyle: 'dashed', minWidth: 150, alignItems: 'center' },
  numericCode: { fontSize: 26, fontWeight: 'bold', color: '#ffffff', letterSpacing: 2 },
  scanBtn: { backgroundColor: '#10b981', paddingVertical: 15, width: '100%', borderRadius: 12, alignItems: 'center', borderWidth: 2, borderColor: '#34d399' },
  scanBtnText: { color: '#ffffff', fontSize: 16, fontWeight: 'bold' },
  tripRouteContainer: { minHeight: 180, maxHeight: 250, backgroundColor: '#f8fafc', padding: 15, borderRadius: 12, marginBottom: 15, borderWidth: 1, borderColor: '#cbd5e1', justifyContent: 'space-evenly' },
  routeItemBox: { flexDirection: 'row-reverse', alignItems: 'flex-start', marginBottom: 10 },
  routeIconText: { fontSize: 14, marginLeft: 8, marginTop: 3 },
  routeMainText: { flex: 1, fontSize: 16, color: '#0f172a', fontWeight: '900', textAlign: 'right', lineHeight: 24 },
  routeDestText: { flex: 1, fontSize: 15, color: '#334155', fontWeight: 'bold', textAlign: 'right', lineHeight: 22 },
  divider: { height: 1, backgroundColor: '#e2e8f0', marginVertical: 8 },
  priceBox: { alignItems: 'center', backgroundColor: '#ecfdf5', paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: '#a7f3d0' },
  priceLabel: { fontSize: 13, color: '#059669', fontWeight: 'bold', marginBottom: 2 },
  hugePriceTag: { fontSize: 32, color: '#10b981', fontWeight: '900', textAlign: 'center' },
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
  editEmergencyText: { color: '#475569', fontSize: 13, fontWeight: 'bold' }
});

// مصفوفة الاستايل الغامق للخريطة (Dark Mode)
const darkMapStyle = [
  { "elementType": "geometry", "stylers": [{ "color": "#212121" }] },
  { "elementType": "labels.icon", "stylers": [{ "visibility": "off" }] },
  { "elementType": "labels.text.fill", "stylers": [{ "color": "#757575" }] },
  { "elementType": "labels.text.stroke", "stylers": [{ "color": "#212121" }] },
  { "featureType": "administrative", "elementType": "geometry", "stylers": [{ "color": "#757575" }] },
  { "featureType": "road", "elementType": "geometry.fill", "stylers": [{ "color": "#2c2c2c" }] },
  { "featureType": "road", "elementType": "labels.text.fill", "stylers": [{ "color": "#8a8a8a" }] }
];