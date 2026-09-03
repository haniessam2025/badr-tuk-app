import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import { arrayUnion, collection, doc, getDoc, limit, onSnapshot, orderBy, query, updateDoc, where } from 'firebase/firestore';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Animated, Dimensions, FlatList, Image, Linking, Modal, PanResponder, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { db } from '../firebaseConfig';

const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);

const SCREEN_WIDTH = Dimensions.get('window').width;

const getSafeAvatar = (imgStr: any) => {
  if (!imgStr || typeof imgStr !== 'string' || imgStr.trim() === '') {
    return 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png';
  }
  if (imgStr.startsWith('http') || imgStr.startsWith('file:/') || imgStr.startsWith('data:image')) {
    return imgStr;
  }
  if (imgStr.length > 50) {
    return `data:image/jpeg;base64,${imgStr}`;
  }
  return 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png';
};

const SwipeableRequestItem = ({ item, onSendOffer, onEditPrice, onDismiss, hasSentOffer }: { item: any, onSendOffer: (item: any, price: string) => void, onEditPrice: (item: any) => void, onDismiss: (item: any) => void, hasSentOffer: boolean }) => {
  const translateX = useRef(new Animated.Value(0)).current;
  
  const [activePrice, setActivePrice] = useState(item.price);
  const basePrice = parseInt(item.price) || 0;

  useEffect(() => {
    setActivePrice(item.price);
  }, [item.price]);

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
          }).start(() => onDismiss(item));
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
      
      <Animated.View style={[styles.requestCard, { transform: [{ translateX }] }]} {...panResponder.panHandlers}>
        <View style={styles.passengerInfoRow}>
          <Image source={{ uri: item.avatar }} style={styles.passengerAvatar} />
          <Text style={styles.passengerName}>{item.name}</Text>
        </View>
        
        <View style={styles.routeContainer}>
          <Text style={styles.routeText}>📍 من: {item.pickupLocation}</Text>
          <Text style={styles.routeText}>🏁 إلى: {item.destinationLocation}</Text>
          <Text style={styles.routeText}>👥 عدد الركاب: {item.passengers || '1'}</Text>
        </View>
        
        {item.notes && item.notes.trim() !== '' ? (
          <View style={styles.notesContainer}>
            <Text style={styles.notesText}>📝 الملاحظات: {item.notes}</Text>
          </View>
        ) : null}
        
        <Text style={styles.priceTag}>💰 السعر: {activePrice} جنيه</Text>

        {!hasSentOffer && basePrice > 0 && (
          <View style={styles.suggestionsRow}>
            {[1.2, 1.4, 1.6].map((multiplier, index) => {
              const suggestedPrice = Math.round(basePrice * multiplier);
              const isSelected = activePrice === suggestedPrice.toString();
              const percentage = Math.round((multiplier - 1) * 100);
              
              return (
                <TouchableOpacity 
                  key={index} 
                  style={[styles.suggestionBtn, isSelected && styles.suggestionBtnActive]} 
                  onPress={() => setActivePrice(suggestedPrice.toString())}
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
        
        {hasSentOffer ? (
          <View style={styles.waitingOfferContainer}>
            <Text style={styles.waitingOfferText}>⏳ عرضك قيد الانتظار...</Text>
          </View>
        ) : (
          <View style={styles.requestActionsRow}>
            <TouchableOpacity style={styles.editPriceBtn} onPress={() => onEditPrice(item)}>
              <Text style={styles.editPriceBtnText}>✏️ تعديل السعر</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.acceptBtn} onPress={() => onSendOffer(item, activePrice)}>
              <Text style={styles.acceptBtnText}>✔️ قبول</Text>
            </TouchableOpacity>
          </View>
        )}
      </Animated.View>
    </View>
  );
};

export default function CaptainHome() {
  const router = useRouter();
  const [allRequests, setAllRequests] = useState<any[]>([]); 
  const [dismissedRequests, setDismissedRequests] = useState<Record<string, any>>({}); 
  const [sentOffers, setSentOffers] = useState<string[]>([]); 
  const [activeRide, setActiveRide] = useState<any>(null);
  
  const [isPriceModalVisible, setIsPriceModalVisible] = useState(false);
  const [selectedRideForPrice, setSelectedRideForPrice] = useState<any>(null);
  const [tempCaptainPrice, setTempCaptainPrice] = useState('');

  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [latestMessage, setLatestMessage] = useState('');

  const [isCallModalVisible, setIsCallModalVisible] = useState(false);
  const [phoneToCall, setPhoneToCall] = useState('');
  
  // إعدادات الأنيميشن
  const chatPulseAnim = useRef(new Animated.Value(0)).current; 
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const toastTranslateY = useRef(new Animated.Value(-10)).current;

  const [toastVisible, setToastVisible] = useState(false);
  const prevUnreadRef = useRef(0);
  const toastTimer = useRef<any>(null);

  const [captainProfile, setCaptainProfile] = useState({
    id: '',
    name: 'كابتن...',
    phone: '',
    vehicle: 'توكتوك',
    avatar: 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png',
  });

  useFocusEffect(
    useCallback(() => {
      loadCaptainProfileFromFirebase();
      loadDismissedRequests();
    }, [])
  );

  const loadCaptainProfileFromFirebase = async () => {
    try {
      const captainId = await AsyncStorage.getItem('currentCaptainId');
      if (captainId) {
        const localProfile = await AsyncStorage.getItem('captain_profile');
        let localAvatar = null;
        if (localProfile) {
          const parsed = JSON.parse(localProfile);
          localAvatar = parsed.avatar || parsed.profileImage;
        }

        const docRef = doc(db, 'captains', captainId);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const data = docSnap.data();
          const rawAvatar = data.profileImage || data.avatar || data.image || localAvatar;
          const finalAvatar = getSafeAvatar(rawAvatar);

          const updatedProfile = {
            id: captainId,
            name: data.name || 'كابتن',
            phone: data.phone || '',
            vehicle: data.tukTukNumber || data.vehicle || 'توكتوك',
            avatar: finalAvatar,
          };

          setCaptainProfile(updatedProfile);
          await AsyncStorage.setItem('captain_profile', JSON.stringify(updatedProfile));
        }
      } else {
        router.replace('/captain-login');
      }
    } catch (e) { console.log(e); }
  };

  const loadDismissedRequests = async () => {
    try {
      const savedDismissed = await AsyncStorage.getItem('dismissed_requests');
      if (savedDismissed) setDismissedRequests(JSON.parse(savedDismissed));
    } catch (e) { console.log(e); }
  };

  useEffect(() => {
    const q = query(collection(db, 'rides'), where('status', '==', 'pending'));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const pendingRequests: any[] = [];
      const currentTime = new Date().getTime();
      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.timestamp && (currentTime - data.timestamp < 900000)) {
          pendingRequests.push({ id: docSnap.id, ...data });
        }
      });
      pendingRequests.sort((a, b) => b.timestamp - a.timestamp);
      setAllRequests(pendingRequests);
    });
    return () => unsubscribe();
  }, []);

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
            if (prevRideDoc && prevRideDoc.status === 'canceled') {
              Alert.alert('تنبيه', 'الراكب قام بإلغاء الرحلة.');
            }
          }
          AsyncStorage.removeItem('active_ride'); 
          return null;
        });
      }
    });
    return () => unsubscribe();
  }, [captainProfile.id]);

  // مراقبة أحدث رسالة من الراكب
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

  // أنيميشن الشات والإشعار الداخلي للكابتن
  useEffect(() => {
    // 1. الإشعار الداخلي لمدة ثانيتين مع عرض أحدث رسالة
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
      }, 2000); // يختفي بعد ثانيتين
    }
    prevUnreadRef.current = unreadChatCount;

    // 2. فلاش الزرار سريع وبلون أسود غامق
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

  const chatBackgroundColor = chatPulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['#8b5cf6', '#0f172a'] 
  });

  const sendOffer = async (ride: any, offerPrice: string) => {
    try {
      const rideRef = doc(db, 'rides', ride.id);
      const safeAvatar = getSafeAvatar(captainProfile.avatar);

      const cleanOfferData = {
        captainId: String(captainProfile.id || 'unknown'),
        captainName: String(captainProfile.name || 'كابتن'),
        captainPhone: String(captainProfile.phone || 'غير مسجل'),
        captainVehicle: String(captainProfile.vehicle || 'توكتوك'),
        captainAvatar: safeAvatar, 
        price: String(offerPrice || '0')
      };

      await updateDoc(rideRef, {
        price: String(offerPrice || '0'),
        offers: arrayUnion(cleanOfferData)
      });
      
      setSentOffers(prev => [...prev, ride.id]);
      Alert.alert('تم الإرسال 🚀', `تم إرسال عرضك بقيمة ${offerPrice} جنيه بنجاح.`);
    } catch (error: any) {
      Alert.alert('خطأ', `حدثت مشكلة أثناء إرسال العرض.`);
    }
  };

  const openPriceModal = (ride: any) => {
    setSelectedRideForPrice(ride);
    setTempCaptainPrice(ride.price ? ride.price.toString() : '');
    setIsPriceModalVisible(true);
  };

  const confirmCustomPrice = () => {
    const originalPrice = parseInt(selectedRideForPrice?.price || '0');
    const newPrice = parseInt(tempCaptainPrice);

    if (!tempCaptainPrice || newPrice <= 0) {
      Alert.alert('خطأ', 'برجاء إدخال سعر صحيح.');
      return;
    }

    if (newPrice < originalPrice) {
      Alert.alert('غير مسموح 🛑', 'لا يمكنك إرسال عرض بسعر أقل من السعر الذي حدده الراكب.');
      return;
    }

    sendOffer(selectedRideForPrice, tempCaptainPrice);
    setIsPriceModalVisible(false);
  };

  const notifyArrival = async () => {
    if (!activeRide) return;
    try {
      const rideRef = doc(db, 'rides', activeRide.id);
      await updateDoc(rideRef, { status: 'captain_arrived' });
    } catch (error) { console.log(error); }
  };

  const startRide = async () => {
    if (!activeRide) return;
    try {
      const rideRef = doc(db, 'rides', activeRide.id);
      await updateDoc(rideRef, { status: 'in_progress' });
    } catch (error) { console.log(error); }
  };

  const completeRide = async () => {
    if (!activeRide) return;
    try {
      const rideRef = doc(db, 'rides', activeRide.id);
      await updateDoc(rideRef, { status: 'completed' });
      setActiveRide(null);
      await AsyncStorage.removeItem('active_ride'); 
      Alert.alert('ممتاز', 'تم إنهاء المشوار بنجاح.');
    } catch (error) { console.log(error); }
  };

  const confirmCancelRide = () => {
    Alert.alert(
      'تأكيد التراجع عن الرحلة',
      'هل أنت متأكد أنك تريد التراجع عن هذه الرحلة والعودة للبحث عن طلبات أخرى؟',
      [{ text: 'تراجع', style: 'cancel' }, { text: 'نعم، فك الارتباط', style: 'destructive', onPress: cancelRideByCaptain }]
    );
  };

  const cancelRideByCaptain = async () => {
    if (!activeRide) return;
    try {
      const rideRef = doc(db, 'rides', activeRide.id);
      await updateDoc(rideRef, { 
        status: 'pending',
        captainId: null,
        captainName: null,
        captainPhone: null,
        captainVehicle: null,
        captainAvatar: null,
        offers: [] 
      });

      handleDismissRequest(activeRide);
      setActiveRide(null);
      await AsyncStorage.removeItem('active_ride'); 
      Alert.alert('تنبيه', 'تم التراجع عن الرحلة والعودة للطلبات المتاحة.');
    } catch (error) { console.log(error); }
  };

  const handleCallClick = () => {
    if (!activeRide) return;
    const passengerPhone = activeRide.phone || activeRide.passengerPhone;
    if (!passengerPhone || passengerPhone === 'غير مسجل') {
      Alert.alert('تنبيه', 'رقم الراكب غير متوفر.');
      return;
    }
    setPhoneToCall(passengerPhone);
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
    await AsyncStorage.removeItem('currentCaptainId');
    await AsyncStorage.removeItem('captain_profile');
    await AsyncStorage.removeItem('active_ride');
    router.replace('/captain-login');
  };

  const handleDismissRequest = async (item: any) => {
    const newDismissed = {
      ...dismissedRequests,
      [item.id]: { price: item.price, pickupLocation: item.pickupLocation, destinationLocation: item.destinationLocation }
    };
    setDismissedRequests(newDismissed);
    await AsyncStorage.setItem('dismissed_requests', JSON.stringify(newDismissed));
  };

  const displayRequests = allRequests.filter(req => {
    const dismissedInfo = dismissedRequests[req.id];
    if (!dismissedInfo) return true;
    return req.price !== dismissedInfo.price || req.pickupLocation !== dismissedInfo.pickupLocation || req.destinationLocation !== dismissedInfo.destinationLocation;
  });

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

      {!activeRide ? (
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
                  hasSentOffer={sentOffers.includes(item.id)}
                />
              )}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 20 }}
            />
          )}
        </>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
          <View style={[styles.activeRideContainer, (activeRide.status === 'passenger_on_the_way' || activeRide.status === 'in_progress') && styles.activeRidePulseContainer]}>
            <Text style={styles.activeRideTitle}>
              {activeRide.status === 'accepted' ? '🛺 أنت الآن في طريقك للراكب' 
                : activeRide.status === 'passenger_on_the_way' ? '✅ الراكب في طريقه إليك (أنا نازل)!' 
                : activeRide.status === 'captain_arrived' ? '🔔 لقد وصلت للراكب، في انتظار نزوله'
                : '▶️ الرحلة جارية الآن في طريقكم للوجهة'}
            </Text>

            {/* الإشعار الداخلي بنص الرسالة بيظهر هنا مباشرة فوق صورة الراكب */}
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
              <Text style={styles.routeText}>📍 الانطلاق: {activeRide.pickupLocation}</Text>
              <Text style={styles.routeText}>🏁 الوجهة: {activeRide.destinationLocation}</Text>
              <Text style={styles.routeText}>👥 عدد الركاب: {activeRide.passengers || '1'}</Text>
              <Text style={styles.priceTagActive}>💰 أجرة الرحلة: {activeRide.price} جنيه</Text>
            </View>

            {activeRide.notes && activeRide.notes.trim() !== '' ? (
              <View style={styles.notesContainer}>
                <Text style={styles.notesText}>📝 ملاحظات الراكب: {activeRide.notes}</Text>
              </View>
            ) : null}

            <View style={styles.actionButtonsRow}>
              <TouchableOpacity style={styles.actionBtnCall} onPress={handleCallClick}>
                <Text style={styles.actionBtnText}>📞 اتصال</Text>
              </TouchableOpacity>
              <AnimatedTouchableOpacity 
                style={[styles.actionBtnChat, { backgroundColor: unreadChatCount > 0 ? chatBackgroundColor : '#8b5cf6' }]} 
                onPress={() => router.push({ pathname: '/chat', params: { senderType: 'captain', rideId: activeRide.id } })}
              >
                <Text style={styles.actionBtnText}>💬 مراسلة</Text>
                {unreadChatCount > 0 && (
                  <View style={styles.badgeContainer}>
                    <Text style={styles.badgeText}>{unreadChatCount}</Text>
                  </View>
                )}
              </AnimatedTouchableOpacity>
            </View>

            {activeRide.status === 'accepted' ? (
              <TouchableOpacity style={styles.arriveButton} onPress={notifyArrival}>
                <Text style={styles.arriveButtonText}>📍 إبلاغ بالوصول للراكب</Text>
              </TouchableOpacity>
            ) : activeRide.status === 'captain_arrived' || activeRide.status === 'passenger_on_the_way' ? (
              <TouchableOpacity style={styles.startButton} onPress={startRide}>
                <Text style={styles.startButtonText}>▶️ ابدأ المشوار</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.completeButton} onPress={completeRide}>
                <Text style={styles.completeButtonText}>✅ إنهاء المشوار</Text>
              </TouchableOpacity>
            )}

            {activeRide.status !== 'in_progress' && (
              <TouchableOpacity style={styles.cancelRideBtn} onPress={confirmCancelRide}>
                <Text style={styles.cancelRideBtnText}>❌ التراجع عن الرحلة</Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      )}

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

      <Modal visible={isPriceModalVisible} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>✏️ تقديم عرض سعر</Text>
            <Text style={styles.modalSubtitle}>أدخل السعر الجديد الذي تقترحه لهذه الرحلة:</Text>
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
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#ffffff', padding: 12, borderRadius: 16, marginBottom: 20, elevation: 2 },
  userInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  profileAvatar: { width: 45, height: 45, borderRadius: 22.5, backgroundColor: '#cbd5e1', marginLeft: 10 },
  welcomeText: { fontSize: 15, color: '#334155' },
  userName: { fontWeight: 'bold', color: '#2563eb' },
  logoutButton: { backgroundColor: '#fee2e2', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 12 },
  logoutText: { color: '#ef4444', fontWeight: 'bold', fontSize: 14 },
  
  // تنسيقات الإشعار الداخلي الجديد
  inlineToast: { backgroundColor: '#1e293b', paddingVertical: 10, paddingHorizontal: 15, borderRadius: 12, marginBottom: 10, width: '100%', flexDirection: 'row-reverse', alignItems: 'center', elevation: 3 },
  inlineToastText: { color: '#ffffff', fontSize: 14, fontWeight: 'bold', textAlign: 'right', flex: 1 },

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
  notesContainer: { backgroundColor: '#fef3c7', padding: 10, borderRadius: 8, marginBottom: 10, borderWidth: 1, borderColor: '#fcd34d' },
  notesText: { fontSize: 14, color: '#d97706', fontWeight: 'bold', textAlign: 'right' },
  priceTag: { fontSize: 16, color: '#10b981', fontWeight: 'bold', textAlign: 'center', marginBottom: 15 },
  suggestionsRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 15 },
  suggestionBtn: { flex: 1, backgroundColor: '#f8fafc', paddingVertical: 8, borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: '#cbd5e1', marginHorizontal: 4 },
  suggestionBtnActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  suggestionText: { fontSize: 15, fontWeight: 'bold', color: '#475569' },
  suggestionTextActive: { color: '#ffffff' },
  suggestionSubText: { fontSize: 11, color: '#64748b', marginTop: 2 },
  suggestionSubTextActive: { color: '#eff6ff' },
  waitingOfferContainer: { backgroundColor: '#fef3c7', padding: 12, borderRadius: 10, alignItems: 'center' },
  waitingOfferText: { color: '#d97706', fontWeight: 'bold', fontSize: 14 },
  requestActionsRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', gap: 10 },
  editPriceBtn: { flex: 1, backgroundColor: '#f59e0b', paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  editPriceBtnText: { color: '#ffffff', fontSize: 14, fontWeight: 'bold' },
  acceptBtn: { flex: 1, backgroundColor: '#2563eb', paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
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
  priceTagActive: { fontSize: 16, color: '#10b981', fontWeight: 'bold', marginTop: 4, textAlign: 'center' },
  actionButtonsRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 15 },
  actionBtnCall: { flex: 1, backgroundColor: '#10b981', paddingVertical: 12, borderRadius: 10, alignItems: 'center', marginLeft: 5 },
  actionBtnChat: { position: 'relative', flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center', marginRight: 5 },
  actionBtnText: { color: '#ffffff', fontSize: 15, fontWeight: 'bold' },
  badgeContainer: { position: 'absolute', top: -8, right: -8, backgroundColor: '#ef4444', minWidth: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center', zIndex: 10, borderWidth: 2, borderColor: '#ffffff' },
  badgeText: { color: '#ffffff', fontSize: 12, fontWeight: 'bold' },
  arriveButton: { backgroundColor: '#f59e0b', paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginBottom: 10 },
  arriveButtonText: { color: '#ffffff', fontSize: 16, fontWeight: 'bold' },
  startButton: { backgroundColor: '#8b5cf6', paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginBottom: 10 },
  startButtonText: { color: '#ffffff', fontSize: 16, fontWeight: 'bold' },
  completeButton: { backgroundColor: '#2563eb', paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginBottom: 10 },
  completeButtonText: { color: '#ffffff', fontSize: 16, fontWeight: 'bold' },
  cancelRideBtn: { backgroundColor: '#fee2e2', paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  cancelRideBtnText: { color: '#ef4444', fontSize: 16, fontWeight: 'bold' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { backgroundColor: '#ffffff', width: '100%', padding: 20, borderRadius: 20, elevation: 5 },
  callModalContent: { backgroundColor: '#ffffff', width: '85%', padding: 20, borderRadius: 20, elevation: 5, alignItems: 'center' },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#1e293b', marginBottom: 15, textAlign: 'center' },
  modalSubtitle: { fontSize: 13, color: '#64748b', marginBottom: 15, textAlign: 'right' },
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
  cancelCallBtn: { paddingVertical: 10 },
  cancelCallBtnText: { color: '#ef4444', fontWeight: 'bold', fontSize: 16 },
});