import { useFocusEffect, useRouter } from 'expo-router';
import { addDoc, collection, deleteDoc, doc, getDocs, increment, limit, onSnapshot, orderBy, query, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, KeyboardAvoidingView, Modal, Platform, RefreshControl, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { db } from '../firebase';

export default function AdminDashboard() {
  const [sosCount, setSosCount] = useState(0);

  // 🚨 رادار مراقبة الاستغاثات الطارئة (SOS)
  useEffect(() => {
    const q = query(collection(db, 'sos_alerts'), where('status', '==', 'active'));
    const unsubscribe = onSnapshot(q, (snapshot: any) => {
      setSosCount(snapshot.size);
      let hasNewAlert = false;
      snapshot.docChanges().forEach((change: any) => {
        if (change.type === 'added') hasNewAlert = true;
      });
      if (hasNewAlert) {
        Alert.alert(
          "🚨 إنذار طوارئ (SOS) 🚨",
          "يوجد راكب في خطر يطلب التدخل الفوري!",
          [{ text: "تجاهل", style: "cancel" }, { text: "عرض التفاصيل", onPress: () => router.push('/admin-safety') }]
        );
      }
    });
    return () => unsubscribe();
  }, []);
  
  const [isSupportModalVisible, setIsSupportModalVisible] = useState(false);
  const [supportTickets, setSupportTickets] = useState<any[]>([]);
  const [activeSupportChat, setActiveSupportChat] = useState<any>(null);
  const [supportMessages, setSupportMessages] = useState<any[]>([]);
  const [adminReplyText, setAdminReplyText] = useState('');
  
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isCurrentlyTypingRef = useRef(false);
  
  const router = useRouter();
  
  // 💡 التبويبات (بما فيها تبويب الإعدادات)
  const [activeTab, setActiveTab] = useState<'pending' | 'updates' | 'captains' | 'passengers' | 'vehicles' | 'settings'>('pending');
  
  const [captains, setCaptains] = useState<any[]>([]);
  const [passengers, setPassengers] = useState<any[]>([]);
  const [updateRequests, setUpdateRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [searchCaptain, setSearchCaptain] = useState('');
  const [searchPassenger, setSearchPassenger] = useState('');
  const [selectedVehicleCategory, setSelectedVehicleCategory] = useState<string | null>(null);
  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [selectedUserType, setSelectedUserType] = useState<'captain' | 'passenger'>('captain');
  const [userRatings, setUserRatings] = useState<any[]>([]);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [selectedDocs, setSelectedDocs] = useState<any>(null);
  const [walletModalVisible, setWalletModalVisible] = useState(false);
  const [walletAmount, setWalletAmount] = useState('');
  const [walletReason, setWalletReason] = useState('');
  const [transactionType, setTransactionType] = useState<'deposit' | 'deduction'>('deposit');
  const [processingWallet, setProcessingWallet] = useState(false);
  const [profileMsgModalVisible, setProfileMsgModalVisible] = useState(false);
  const [profileMsgTitle, setProfileMsgTitle] = useState('');
  const [profileMsgText, setProfileMsgText] = useState('');
  const [sendingProfileMsg, setSendingProfileMsg] = useState(false);
  const [complaintsCount, setComplaintsCount] = useState(0);
  const [passwordResetCount, setPasswordResetCount] = useState(0);

  // 📢 متغيرات الإشعارات الجماعية
  const [broadcastModalVisible, setBroadcastModalVisible] = useState(false);
  const [broadcastTarget, setBroadcastTarget] = useState<'all' | 'captains' | 'passengers'>('all');
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [sendingBroadcast, setSendingBroadcast] = useState(false);

  // ⚙️ إعدادات النظام المدمجة (مع تواريخ البونص ونظام الشرائح)
  const [appSettings, setAppSettings] = useState({
    car: { baseFare: '15', minFare: '20', commission: '10', tiers: [{ upToKm: '5', price: '4.4' }, { upToKm: '999', price: '4.0' }] },
    tuktuk: { baseFare: '10', minFare: '15', commission: '5', tiers: [{ upToKm: '5', price: '6.5' }, { upToKm: '999', price: '6.0' }] },
    scooter: { baseFare: '12', minFare: '12', commission: '8', tiers: [{ upToKm: '5', price: '3.75' }, { upToKm: '999', price: '3.5' }] },
    waitingTimeMins: '5',
    maxNegativeBalance: '-50',
    maintenanceMode: false,
bonusTargetRides: '10',
    bonusAmount: '30',
    bonusDuration: 'daily', // 👈 مدة احتساب البونص (يومي/أسبوعي/شهري)
    bonusStartDate: '', // 👈 بداية مدة البونص
    bonusEndDate: '',   // 👈 نهاية مدة البونص
  });
  const [savingSettings, setSavingSettings] = useState(false);

  // جلب إعدادات التسعير
  useEffect(() => {
    const unsubSettings = onSnapshot(doc(db, 'app_settings', 'pricing'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
setAppSettings({
          car: { baseFare: data.car?.baseFare || '15', minFare: data.car?.minFare || '20', commission: data.car?.commission || '10', tiers: data.car?.tiers || [{ upToKm: '5', price: '4.4' }, { upToKm: '999', price: '4.0' }] },
          tuktuk: { baseFare: data.tuktuk?.baseFare || '10', minFare: data.tuktuk?.minFare || '15', commission: data.tuktuk?.commission || '5', tiers: data.tuktuk?.tiers || [{ upToKm: '5', price: '6.5' }, { upToKm: '999', price: '6.0' }] },
          scooter: { baseFare: data.scooter?.baseFare || '12', minFare: data.scooter?.minFare || '12', commission: data.scooter?.commission || '8', tiers: data.scooter?.tiers || [{ upToKm: '5', price: '3.75' }, { upToKm: '999', price: '3.5' }] },
          waitingTimeMins: data.waitingTimeMins || '5',
          maxNegativeBalance: data.maxNegativeBalance || '-50',
          maintenanceMode: data.maintenanceMode || false,
bonusTargetRides: data.bonusTargetRides || '10',
          bonusAmount: data.bonusAmount || '30',
          bonusDuration: data.bonusDuration || 'daily',
          bonusStartDate: data.bonusStartDate || '',
          bonusEndDate: data.bonusEndDate || '',
        });
      }
    });
    return () => unsubSettings();
  }, []);

// ⚙️ دوال التحكم في شرائح التسعير
  const addTier = (vehicle: 'car' | 'tuktuk' | 'scooter') => {
    const newTiers = [...appSettings[vehicle].tiers, { upToKm: '10', price: '0' }];
    setAppSettings({ ...appSettings, [vehicle]: { ...appSettings[vehicle], tiers: newTiers } });
  };

  const removeTier = (vehicle: 'car' | 'tuktuk' | 'scooter', index: number) => {
    const newTiers = appSettings[vehicle].tiers.filter((_, i) => i !== index);
    setAppSettings({ ...appSettings, [vehicle]: { ...appSettings[vehicle], tiers: newTiers } });
  };

  const updateTier = (vehicle: 'car' | 'tuktuk' | 'scooter', index: number, field: 'upToKm' | 'price', value: string) => {
    const newTiers = [...appSettings[vehicle].tiers];
    newTiers[index] = newTiers[index] || {}; // لتفادي الأخطاء
    newTiers[index][field as keyof typeof newTiers[0]] = value;
    setAppSettings({ ...appSettings, [vehicle]: { ...appSettings[vehicle], tiers: newTiers } });
  };

  // حفظ الإعدادات
  const saveAppSettings = async () => {
    setSavingSettings(true);
    try {
      await setDoc(doc(db, 'app_settings', 'pricing'), appSettings);
      Alert.alert('نجاح ✅', 'تم حفظ إعدادات النظام بنجاح.');
    } catch (error) { Alert.alert('خطأ', 'تعذر حفظ الإعدادات.'); } finally { setSavingSettings(false); }
  };

  const toggleMaintenanceMode = async (val: boolean) => {
    setAppSettings({ ...appSettings, maintenanceMode: val });
    try {
      await setDoc(doc(db, 'app_settings', 'pricing'), { maintenanceMode: val }, { merge: true });
    } catch (error) {
      setAppSettings({ ...appSettings, maintenanceMode: !val }); 
    }
  };

  useEffect(() => {
    const q = query(collection(db, 'support_chats'), where('status', '==', 'open'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const tickets = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      tickets.sort((a: any, b: any) => (b.lastMessageTime?.toMillis() || 0) - (a.lastMessageTime?.toMillis() || 0));      
      setSupportTickets(tickets);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!activeSupportChat) return;
    const q = query(collection(db, 'support_chats', activeSupportChat.id, 'messages'), orderBy('timestamp', 'desc'), limit(30));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setSupportMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, [activeSupportChat]);

  const openSupportChat = async (ticket: any) => {
    setActiveSupportChat(ticket);
    try { await updateDoc(doc(db, 'support_chats', ticket.id), { unreadAdminCount: 0 }); } catch (e) {}
  };
  
  const handleAdminTyping = async (text: string) => {
    setAdminReplyText(text);
    if (!activeSupportChat) return;
    if (!isCurrentlyTypingRef.current) {
      isCurrentlyTypingRef.current = true;
      try { await updateDoc(doc(db, 'support_chats', activeSupportChat.id), { adminTyping: true }); } catch (error) {}
    }
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(async () => {
      isCurrentlyTypingRef.current = false;
      try { await updateDoc(doc(db, 'support_chats', activeSupportChat.id), { adminTyping: false }); } catch (error) {}
    }, 2000);
  };

  const sendAdminReply = async () => {
    if (!adminReplyText.trim() || !activeSupportChat) return;
    const text = adminReplyText.trim();
    setAdminReplyText('');
    isCurrentlyTypingRef.current = false;
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    try {
      await addDoc(collection(db, 'support_chats', activeSupportChat.id, 'messages'), { text, sender: 'admin', timestamp: serverTimestamp() });
      await updateDoc(doc(db, 'support_chats', activeSupportChat.id), {
        lastMessage: text, lastMessageTime: serverTimestamp(), unreadUserCount: increment(1), adminTyping: false 
      });
    } catch (error) {}
  };

  const closeSupportTicket = async () => {
    if (!activeSupportChat) return;
    try { await updateDoc(doc(db, 'support_chats', activeSupportChat.id), { status: 'closed' }); setActiveSupportChat(null); } catch (error) {}
  };

  const fetchDashboardData = async () => {
    try {
      const capSnap = await getDocs(query(collection(db, 'captains')));
      setCaptains(capSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      const passSnap = await getDocs(query(collection(db, 'passengers')));
      setPassengers(passSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      const updSnap = await getDocs(query(collection(db, 'update_requests'), where('status', '==', 'pending')));
      const pendingUpdates = updSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
      pendingUpdates.sort((a: any, b: any) => (b.timestamp || 0) - (a.timestamp || 0));
      setUpdateRequests(pendingUpdates);

      const compSnap = await getDocs(query(collection(db, 'support_tickets'), orderBy('timestamp', 'desc'), limit(100)));
      let unreadCount = 0;
      compSnap.docs.forEach(doc => {
        const data = doc.data();
        if (data.type !== 'password_reset' && (data.isReadAdmin === false || (!('isReadAdmin' in data) && (data.status === 'pending' || data.status === 'new' || !data.reply)))) unreadCount++;
      });
      setComplaintsCount(unreadCount);

      const pwdSnap = await getDocs(query(collection(db, 'support_tickets'), where('type', '==', 'password_reset'), where('status', '==', 'pending')));
      setPasswordResetCount(pwdSnap.size);
    } catch (error) {} finally { setLoading(false); setRefreshing(false); }
  };

  useFocusEffect(useCallback(() => { fetchDashboardData(); }, []));

  const onRefresh = () => { setRefreshing(true); fetchDashboardData(); };

  const sendBroadcastMessage = async () => {
    if (!broadcastTitle.trim() || !broadcastMessage.trim()) { Alert.alert('تنبيه', 'يرجى إدخال عنوان ونص الإشعار.'); return; }
    setSendingBroadcast(true);
    try {
      const notificationsRef = collection(db, 'notifications');
      const timeNow = serverTimestamp();
      if (broadcastTarget === 'all' || broadcastTarget === 'passengers') {
        passengers.forEach(p => { if (p.status !== 'rejected') addDoc(notificationsRef, { userId: p.id, userType: 'passenger', title: broadcastTitle, message: broadcastMessage, timestamp: timeNow, read: false, sender: 'الإدارة' }); });
      }
      if (broadcastTarget === 'all' || broadcastTarget === 'captains') {
        captains.forEach(c => { if (c.status !== 'rejected') addDoc(notificationsRef, { userId: c.id, userType: 'captain', title: broadcastTitle, message: broadcastMessage, timestamp: timeNow, read: false, sender: 'الإدارة' }); });
      }
      Alert.alert('نجاح 🚀', 'تم إرسال الإشعار الجماعي بنجاح.');
      setBroadcastModalVisible(false); setBroadcastTitle(''); setBroadcastMessage('');
    } catch (error) { Alert.alert('خطأ', 'تعذر إرسال الإشعارات الجماعية.'); } finally { setSendingBroadcast(false); }
  };

  const pendingCaptains = captains.filter(c => c.status === 'pending' || c.status === 'pending_approval');
  const pendingPassengers = passengers.filter(p => p.status === 'pending');
  const totalPending = pendingCaptains.length + pendingPassengers.length;
  
  const activeCaptainsFiltered = captains.filter(c => c.status !== 'pending' && c.status !== 'pending_approval' && (c.name?.includes(searchCaptain) || c.phone?.includes(searchCaptain) || c.vehicle?.includes(searchCaptain)));
  const activePassengersFiltered = passengers.filter(p => p.status !== 'pending' && (p.name?.includes(searchPassenger) || p.phone?.includes(searchPassenger)));

  const onlyActiveCaptains = captains.filter(c => c.status !== 'pending' && c.status !== 'pending_approval' && c.status !== 'rejected');
  const carCaptains = onlyActiveCaptains.filter(c => c.vehicle?.includes('سيارة') || c.vehicleCategory === 'car');
  const scooterCaptains = onlyActiveCaptains.filter(c => c.vehicle?.includes('سكوتر') || c.vehicleCategory === 'scooter');
  const galaxyCaptains = onlyActiveCaptains.filter(c => c.vehicle?.includes('جالاكسي') || c.vehicleDetails?.type?.includes('جالاكسي') || c.requestedTuktukType?.includes('جالاكسي'));
  const cuteCaptains = onlyActiveCaptains.filter(c => {
    const isGalaxy = c.vehicle?.includes('جالاكسي') || c.vehicleDetails?.type?.includes('جالاكسي') || c.requestedTuktukType?.includes('جالاكسي');
    if (isGalaxy) return false; 
    return c.vehicleCategory === 'tuktuk_alt' || c.vehicle?.includes('كيوت') || c.vehicleDetails?.type?.includes('كيوت');
  });

  const getSelectedCaptainsList = () => {
    if (selectedVehicleCategory === 'سيارات') return carCaptains;
    if (selectedVehicleCategory === 'كيوت 3 راكب') return cuteCaptains;
    if (selectedVehicleCategory === 'جالاكسي 7 راكب') return galaxyCaptains;
    if (selectedVehicleCategory === 'سكوتر') return scooterCaptains;
    return [];
  };

  const approveRegistration = async (id: string, type: 'captain' | 'passenger') => {
    const collectionName = type === 'captain' ? 'captains' : 'passengers';
    try { 
      let nextNumber = null;
      let notificationMessage = "تمت الموافقة على حسابك، يمكنك الآن بدء استقبال الرحلات.";
      if (type === 'captain') {
        const currentCaptain = captains.find(c => c.id === id);
        if (currentCaptain && (currentCaptain.vehicleCategory === 'tuktuk_alt' || currentCaptain.vehicle?.includes('كيوت') || currentCaptain.vehicle?.includes('جالاكسي'))) {
          let maxNumber = 99;
          captains.forEach(c => { if ((c.vehicleSequenceNumber || 0) > maxNumber) maxNumber = c.vehicleSequenceNumber || 0; });
          nextNumber = maxNumber + 1;
          notificationMessage = `مبروووك لقد تم الموافقة على طلب تسجيلك بنجاح ورقمك الكودي هو (${nextNumber}) وسيتم التواصل معك في أقرب وقت لتسليمك شعار براق برقمك الكودي`;
        }
      }
      const updateData: any = { status: 'active' };
      if (nextNumber !== null) { updateData.vehicleSequenceNumber = nextNumber; updateData.vehicleNumber = `${nextNumber}`; }
      await updateDoc(doc(db, collectionName, id), updateData); 
      await addDoc(collection(db, 'notifications'), { userId: id, userType: type, title: 'مبروك! تمت الموافقة ✅', message: notificationMessage, read: false, timestamp: new Date().getTime() });
      fetchDashboardData(); Alert.alert('تم ✅', nextNumber ? `تم تفعيل الكابتن بنجاح ورقم مركبته (${nextNumber})` : 'تم تفعيل الحساب بنجاح.'); 
    } catch (e) { Alert.alert('خطأ', 'حدثت مشكلة أثناء التفعيل.'); }
  };

  const rejectRegistration = async (id: string, type: 'captain' | 'passenger') => {
    try { await updateDoc(doc(db, type === 'captain' ? 'captains' : 'passengers', id), { status: 'rejected' }); fetchDashboardData(); Alert.alert('تم 🛑', 'تم رفض الطلب.'); } catch (e) { Alert.alert('خطأ', 'حدثت مشكلة.'); }
  };

  const handleApproveUpdate = async (req: any) => {
    try {
      if (req.userType === 'passenger') {
        await updateDoc(doc(db, 'passengers', req.passengerId), { phone: req.newData.phone });
        await updateDoc(doc(db, 'update_requests', req.id), { status: 'approved' });
        await addDoc(collection(db, 'notifications'), { userId: req.passengerId, userType: 'passenger', title: 'تم تحديث الرقم ✅', message: 'تمت الموافقة على طلب تغيير رقم الهاتف الخاص بك بنجاح.', timestamp: serverTimestamp(), read: false, sender: 'الإدارة' });
      } else {
        await updateDoc(doc(db, 'captains', req.captainId), { name: req.newData.name, vehicle: req.newData.vehicle, vehicleCategory: req.newData.vehicleCategory || 'tuktuk_alt', vehicleDetails: req.newData.vehicleDetails || null, avatar: req.newData.avatar, profileImage: req.newData.avatar });
        await updateDoc(doc(db, 'update_requests', req.id), { status: 'approved' });
        await addDoc(collection(db, 'notifications'), { userId: req.captainId, userType: 'captain', title: 'تحديث البيانات', message: 'تمت الموافقة على طلب تعديل بياناتك بنجاح.', timestamp: serverTimestamp(), read: false, sender: 'الإدارة' });
      }
      fetchDashboardData(); Alert.alert('نجاح', 'تم تحديث البيانات بنجاح.');
    } catch (e) { Alert.alert('خطأ', 'حدثت مشكلة.'); }
  };

  const handleRejectUpdate = async (req: any) => {
    try { await updateDoc(doc(db, 'update_requests', req.id), { status: 'rejected' }); await addDoc(collection(db, 'notifications'), { userId: req.passengerId || req.captainId, userType: req.userType || 'captain', title: 'رفض التعديل ❌', message: 'تم رفض طلب التعديل الخاص بك من قبل الإدارة.', timestamp: serverTimestamp(), read: false, sender: 'الإدارة' }); fetchDashboardData(); Alert.alert('تم', 'تم رفض طلب التعديل.'); } catch (e) { Alert.alert('خطأ', 'حدثت مشكلة.'); }
  };
  
  const toggleBanUser = async (user: any, type: 'captain' | 'passenger') => {
    const newStatus = user.status === 'banned' ? 'active' : 'banned';
    try { 
      await updateDoc(doc(db, type === 'captain' ? 'captains' : 'passengers', user.id), { status: newStatus }); 
      if (newStatus === 'banned') await setDoc(doc(db, 'banned_phones', user.phone), { phone: user.phone, userType: type, name: user.name, bannedAt: serverTimestamp() });
      else await deleteDoc(doc(db, 'banned_phones', user.phone));
      fetchDashboardData(); Alert.alert('تم', `تم ${newStatus === 'banned' ? 'حظر الرقم' : 'إلغاء الحظر'}.`); 
      if (selectedUser?.id === user.id) setSelectedUser({ ...selectedUser, status: newStatus });
    } catch (e) {}
  };

  const removeTemporaryBan = async () => {
    try { await updateDoc(doc(db, 'captains', selectedUser.id), { bannedUntil: null, cancelStrikes: 0 }); Alert.alert('تم ✅', 'تم فك الحظر وتصفير المخالفات.'); setSelectedUser({ ...selectedUser, bannedUntil: null, cancelStrikes: 0 }); fetchDashboardData(); } catch (e) {}
  };

  const deleteUserAccount = async (userId: string, type: 'captain' | 'passenger') => {
    Alert.alert('مسح بيانات الحساب ⚠️', 'سيتم مسح بيانات هذا الحساب تماماً من قاعدة البيانات. هل أنت متأكد؟', [{ text: 'إلغاء', style: 'cancel' }, { text: 'نعم، امسح البيانات', style: 'destructive', onPress: async () => { try { await deleteDoc(doc(db, type === 'captain' ? 'captains' : 'passengers', userId)); fetchDashboardData(); Alert.alert('تم الحذف', 'تم مسح الحساب بنجاح.'); if (selectedUser?.id === userId) { setProfileModalVisible(false); setSelectedUser(null); } } catch (error) {} } }]);
  };

  const openUserProfile = async (user: any, type: 'captain' | 'passenger') => {
    setSelectedUser(user); setSelectedUserType(type); setProfileModalVisible(true); setLoadingProfile(true);
    try {
      const q = query(collection(db, 'ratings'), where(type === 'captain' ? 'captainId' : 'passengerId', '==', user.id), where('type', '==', type === 'captain' ? 'passenger_rating_captain' : 'captain_rating_passenger'));
      const snap = await getDocs(q);
      const fetchedRatings = snap.docs.map(d => d.data());
      fetchedRatings.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      setUserRatings(fetchedRatings);
    } catch (error) {} finally { setLoadingProfile(false); }
  };

  const executeWalletAdjustment = async () => {
    const amt = parseFloat(walletAmount);
    if (!amt || amt <= 0 || !walletReason.trim()) return;
    setProcessingWallet(true);
    const finalAmount = transactionType === 'deduction' ? -Math.abs(amt) : Math.abs(amt);
    try {
      await updateDoc(doc(db, selectedUserType === 'captain' ? 'captains' : 'passengers', selectedUser.id), { walletBalance: increment(finalAmount) });
      await addDoc(collection(db, 'wallet_transactions'), { userId: selectedUser.id, userName: selectedUser.name, userType: selectedUserType, amount: finalAmount, type: transactionType, reason: walletReason.trim(), date: serverTimestamp(), performedBy: 'Admin' });
      setSelectedUser({ ...selectedUser, walletBalance: (selectedUser.walletBalance || 0) + finalAmount });
      fetchDashboardData(); setProcessingWallet(false); setWalletModalVisible(false); setWalletAmount(''); setWalletReason(''); Alert.alert('نجاح', 'تم تحديث المحفظة.');
    } catch (e) { setProcessingWallet(false); }
  };

  const handleSendProfileMessage = async () => {
    if (!profileMsgTitle.trim() || !profileMsgText.trim()) return;
    setSendingProfileMsg(true);
    try { await addDoc(collection(db, 'notifications'), { userId: selectedUser.id, userType: selectedUserType, title: profileMsgTitle.trim(), message: profileMsgText.trim(), timestamp: serverTimestamp(), read: false, sender: 'الإدارة' }); Alert.alert('نجاح', 'تم إرسال الإشعار.'); setProfileMsgModalVisible(false); setProfileMsgTitle(''); setProfileMsgText(''); } catch (error) {} finally { setSendingProfileMsg(false); }
  };

  const getAverageRating = () => {
    if (userRatings.length === 0) return 5;
    return Math.round(userRatings.reduce((sum, current) => sum + (current.rating || 0), 0) / userRatings.length);
  };
  const averageRating = getAverageRating();
  
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.logoutBtn} onPress={() => router.replace('/captain-login')}><Text style={styles.logoutBtnText}>خروج</Text></TouchableOpacity>
        <Text style={styles.headerTitle}>لوحة التحكم 👑</Text>
      </View>

      {/* 🚀 قسم الوصول السريع (شبكة مرصوصة بدون سحب) */}
      <View style={styles.quickGrid}>
        <TouchableOpacity style={styles.quickCard} onPress={() => setActiveTab('settings')}>
          <Text style={{ fontSize: 26, marginBottom: 5 }}>⚙️</Text>
          <Text style={styles.quickCardText}>الإعدادات والتسعير</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.quickCard} onPress={() => setIsSupportModalVisible(true)}>
          <Text style={{ fontSize: 26, marginBottom: 5 }}>🎧</Text>
          <Text style={styles.quickCardText}>الدعم المباشر</Text>
          {supportTickets.reduce((sum, t) => sum + (t.unreadAdminCount || 0), 0) > 0 && (
            <View style={styles.quickBadge}><Text style={styles.quickBadgeText}>{supportTickets.reduce((sum, t) => sum + (t.unreadAdminCount || 0), 0)}</Text></View>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.quickCard} onPress={() => router.push('/admin-complaints')}>
          <Text style={{ fontSize: 26, marginBottom: 5 }}>📬</Text>
          <Text style={styles.quickCardText}>الشكاوى</Text>
          {complaintsCount > 0 && <View style={styles.quickBadge}><Text style={styles.quickBadgeText}>{complaintsCount}</Text></View>}
        </TouchableOpacity>

        <TouchableOpacity style={styles.quickCard} onPress={() => router.push('/admin-password-resets')}>
          <Text style={{ fontSize: 26, marginBottom: 5 }}>🔑</Text>
          <Text style={styles.quickCardText}>استعادة المرور</Text>
          {passwordResetCount > 0 && <View style={styles.quickBadge}><Text style={styles.quickBadgeText}>{passwordResetCount}</Text></View>}
        </TouchableOpacity>

        <TouchableOpacity style={[styles.quickCard, { backgroundColor: '#1e3a8a', borderColor: '#3b82f6' }]} onPress={() => setBroadcastModalVisible(true)}>
          <Text style={{ fontSize: 26, marginBottom: 5 }}>📢</Text>
          <Text style={styles.quickCardText}>إرسال للجميع</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.quickCard} onPress={() => router.push('/admin-rides')}>
          <Text style={{ fontSize: 26, marginBottom: 5 }}>📊</Text>
          <Text style={styles.quickCardText}>سجل الرحلات</Text>
        </TouchableOpacity>
      </View>

      {/* 📑 شريط التبويبات (ثابت) */}
      <View style={styles.tabsContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: 'row-reverse', alignItems: 'center', paddingHorizontal: 5, flexGrow: 1, justifyContent: 'space-evenly' }}>
          <TouchableOpacity style={[styles.tabBtn, activeTab === 'settings' && styles.tabBtnActive]} onPress={() => setActiveTab('settings')}>
            <Text style={[styles.tabBtnText, activeTab === 'settings' && styles.tabBtnTextActive]}>⚙️ الإعدادات</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tabBtn, activeTab === 'pending' && styles.tabBtnActive]} onPress={() => setActiveTab('pending')}>
            <Text style={[styles.tabBtnText, activeTab === 'pending' && styles.tabBtnTextActive]}>التسجيلات</Text>
            {totalPending > 0 && <View style={styles.tabBadge}><Text style={styles.tabBadgeText}>{totalPending}</Text></View>}
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tabBtn, activeTab === 'updates' && styles.tabBtnActive]} onPress={() => setActiveTab('updates')}>
            <Text style={[styles.tabBtnText, activeTab === 'updates' && styles.tabBtnTextActive]}>التعديلات</Text>
            {updateRequests.length > 0 && <View style={styles.tabBadge}><Text style={styles.tabBadgeText}>{updateRequests.length}</Text></View>}
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tabBtn, activeTab === 'captains' && styles.tabBtnActive]} onPress={() => setActiveTab('captains')}>
            <Text style={[styles.tabBtnText, activeTab === 'captains' && styles.tabBtnTextActive]}>الكباتن</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tabBtn, activeTab === 'passengers' && styles.tabBtnActive]} onPress={() => setActiveTab('passengers')}>
            <Text style={[styles.tabBtnText, activeTab === 'passengers' && styles.tabBtnTextActive]}>الركاب</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tabBtn, activeTab === 'vehicles' && styles.tabBtnActive]} onPress={() => { setActiveTab('vehicles'); setSelectedVehicleCategory(null); }}>
            <Text style={[styles.tabBtnText, activeTab === 'vehicles' && styles.tabBtnTextActive]}>المركبات</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* 📋 منطقة المحتوى */}
      <View style={{ flex: 1 }}>
        {loading ? <View style={styles.centerContainer}><ActivityIndicator size="large" color="#eab308" /></View> : 
        
        activeTab === 'settings' ? (
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 30 }}>
              
              {/* 🚨 قسم الطوارئ والصيانة */}
              <View style={[styles.settingsSection, { borderColor: appSettings.maintenanceMode ? '#ef4444' : '#334155' }]}>
                <Text style={[styles.settingsSectionTitle, appSettings.maintenanceMode && { color: '#ef4444' }]}>
                  🚨 وضع الصيانة (إغلاق التطبيق)
                </Text>
                <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ flex: 1, marginLeft: 15 }}>
                    <Text style={{ color: '#94a3b8', fontSize: 12, textAlign: 'right', lineHeight: 18 }}>
                      عند تفعيل هذا الخيار، سيتم منع جميع الكباتن والركاب من استخدام التطبيق وستظهر لهم شاشة "التطبيق تحت الصيانة". يُطبق فوراً!
                    </Text>
                  </View>
                  <Switch trackColor={{ false: '#334155', true: '#fca5a5' }} thumbColor={appSettings.maintenanceMode ? '#ef4444' : '#94a3b8'} onValueChange={toggleMaintenanceMode} value={appSettings.maintenanceMode} />
                </View>
              </View>

{/* قسم السيارات */}
              <View style={styles.settingsSection}>
                <Text style={styles.settingsSectionTitle}>🚗 السيارات</Text>
                <View style={styles.settingsInputRow}>
                  <View style={styles.settingsInputGroup}>
                    <Text style={styles.settingsLabel}>الأدنى (ج)</Text>
                    <TextInput style={styles.settingsInput} keyboardType="numeric" value={appSettings.car.minFare} onChangeText={t => setAppSettings({...appSettings, car: {...appSettings.car, minFare: t}})} textAlign="center" />
                  </View>
                  <View style={styles.settingsInputGroup}>
                    <Text style={styles.settingsLabel}>الأساسي (ج)</Text>
                    <TextInput style={styles.settingsInput} keyboardType="numeric" value={appSettings.car.baseFare} onChangeText={t => setAppSettings({...appSettings, car: {...appSettings.car, baseFare: t}})} textAlign="center" />
                  </View>
                  <View style={styles.settingsInputGroup}>
                    <Text style={styles.settingsLabel}>العمولة (%)</Text>
                    <TextInput style={[styles.settingsInput, { color: '#eab308' }]} keyboardType="numeric" value={appSettings.car.commission} onChangeText={t => setAppSettings({...appSettings, car: {...appSettings.car, commission: t}})} textAlign="center" />
                  </View>
                </View>
                {/* 👈 نظام شرائح السيارات */}
                <View style={styles.tiersContainer}>
                  <Text style={styles.tiersTitle}>📊 تسعيرة الكيلو بالشرائح:</Text>
                  {appSettings.car.tiers.map((tier, idx) => (
                    <View key={idx} style={styles.tierRow}>
                      <Text style={styles.tierLabel}>إلى</Text>
                      <TextInput style={styles.tierInput} keyboardType="numeric" value={tier.upToKm} onChangeText={t => updateTier('car', idx, 'upToKm', t)} textAlign="center" placeholder="كم" />
                      <Text style={styles.tierLabel}>كم، بسعر</Text>
                      <TextInput style={styles.tierInput} keyboardType="numeric" value={tier.price} onChangeText={t => updateTier('car', idx, 'price', t)} textAlign="center" placeholder="ج" />
                      <Text style={styles.tierLabel}>ج</Text>
                      <TouchableOpacity onPress={() => removeTier('car', idx)} style={styles.removeTierBtn}><Text style={{color: '#fff'}}>✖</Text></TouchableOpacity>
                    </View>
                  ))}
                  <TouchableOpacity style={styles.addTierBtn} onPress={() => addTier('car')}><Text style={styles.addTierBtnText}>➕ إضافة شريحة</Text></TouchableOpacity>
                  <Text style={styles.tierHint}>* اكتب 999 في خانة المسافة للشريحة الأخيرة (المفتوحة)</Text>
                </View>
              </View>

              {/* قسم التوكتوك */}
              <View style={styles.settingsSection}>
                <Text style={styles.settingsSectionTitle}>🛺 بديل التوكتوك</Text>
                <View style={styles.settingsInputRow}>
                  <View style={styles.settingsInputGroup}>
                    <Text style={styles.settingsLabel}>الأدنى (ج)</Text>
                    <TextInput style={styles.settingsInput} keyboardType="numeric" value={appSettings.tuktuk.minFare} onChangeText={t => setAppSettings({...appSettings, tuktuk: {...appSettings.tuktuk, minFare: t}})} textAlign="center" />
                  </View>
                  <View style={styles.settingsInputGroup}>
                    <Text style={styles.settingsLabel}>الأساسي (ج)</Text>
                    <TextInput style={styles.settingsInput} keyboardType="numeric" value={appSettings.tuktuk.baseFare} onChangeText={t => setAppSettings({...appSettings, tuktuk: {...appSettings.tuktuk, baseFare: t}})} textAlign="center" />
                  </View>
                  <View style={styles.settingsInputGroup}>
                    <Text style={styles.settingsLabel}>العمولة (%)</Text>
                    <TextInput style={[styles.settingsInput, { color: '#eab308' }]} keyboardType="numeric" value={appSettings.tuktuk.commission} onChangeText={t => setAppSettings({...appSettings, tuktuk: {...appSettings.tuktuk, commission: t}})} textAlign="center" />
                  </View>
                </View>
                {/* 👈 نظام شرائح التوكتوك */}
                <View style={styles.tiersContainer}>
                  <Text style={styles.tiersTitle}>📊 تسعيرة الكيلو بالشرائح:</Text>
                  {appSettings.tuktuk.tiers.map((tier, idx) => (
                    <View key={idx} style={styles.tierRow}>
                      <Text style={styles.tierLabel}>إلى</Text>
                      <TextInput style={styles.tierInput} keyboardType="numeric" value={tier.upToKm} onChangeText={t => updateTier('tuktuk', idx, 'upToKm', t)} textAlign="center" placeholder="كم" />
                      <Text style={styles.tierLabel}>كم، بسعر</Text>
                      <TextInput style={styles.tierInput} keyboardType="numeric" value={tier.price} onChangeText={t => updateTier('tuktuk', idx, 'price', t)} textAlign="center" placeholder="ج" />
                      <Text style={styles.tierLabel}>ج</Text>
                      <TouchableOpacity onPress={() => removeTier('tuktuk', idx)} style={styles.removeTierBtn}><Text style={{color: '#fff'}}>✖</Text></TouchableOpacity>
                    </View>
                  ))}
                  <TouchableOpacity style={styles.addTierBtn} onPress={() => addTier('tuktuk')}><Text style={styles.addTierBtnText}>➕ إضافة شريحة</Text></TouchableOpacity>
                  <Text style={styles.tierHint}>* اكتب 999 في خانة المسافة للشريحة الأخيرة (المفتوحة)</Text>
                </View>
              </View>

              {/* قسم السكوتر */}
              <View style={styles.settingsSection}>
                <Text style={styles.settingsSectionTitle}>🛵 السكوتر</Text>
                <View style={styles.settingsInputRow}>
                  <View style={styles.settingsInputGroup}>
                    <Text style={styles.settingsLabel}>الأدنى (ج)</Text>
                    <TextInput style={styles.settingsInput} keyboardType="numeric" value={appSettings.scooter.minFare} onChangeText={t => setAppSettings({...appSettings, scooter: {...appSettings.scooter, minFare: t}})} textAlign="center" />
                  </View>
                  <View style={styles.settingsInputGroup}>
                    <Text style={styles.settingsLabel}>الأساسي (ج)</Text>
                    <TextInput style={styles.settingsInput} keyboardType="numeric" value={appSettings.scooter.baseFare} onChangeText={t => setAppSettings({...appSettings, scooter: {...appSettings.scooter, baseFare: t}})} textAlign="center" />
                  </View>
                  <View style={styles.settingsInputGroup}>
                    <Text style={styles.settingsLabel}>العمولة (%)</Text>
                    <TextInput style={[styles.settingsInput, { color: '#eab308' }]} keyboardType="numeric" value={appSettings.scooter.commission} onChangeText={t => setAppSettings({...appSettings, scooter: {...appSettings.scooter, commission: t}})} textAlign="center" />
                  </View>
                </View>
                {/* 👈 نظام شرائح السكوتر */}
                <View style={styles.tiersContainer}>
                  <Text style={styles.tiersTitle}>📊 تسعيرة الكيلو بالشرائح:</Text>
                  {appSettings.scooter.tiers.map((tier, idx) => (
                    <View key={idx} style={styles.tierRow}>
                      <Text style={styles.tierLabel}>إلى</Text>
                      <TextInput style={styles.tierInput} keyboardType="numeric" value={tier.upToKm} onChangeText={t => updateTier('scooter', idx, 'upToKm', t)} textAlign="center" placeholder="كم" />
                      <Text style={styles.tierLabel}>كم، بسعر</Text>
                      <TextInput style={styles.tierInput} keyboardType="numeric" value={tier.price} onChangeText={t => updateTier('scooter', idx, 'price', t)} textAlign="center" placeholder="ج" />
                      <Text style={styles.tierLabel}>ج</Text>
                      <TouchableOpacity onPress={() => removeTier('scooter', idx)} style={styles.removeTierBtn}><Text style={{color: '#fff'}}>✖</Text></TouchableOpacity>
                    </View>
                  ))}
                  <TouchableOpacity style={styles.addTierBtn} onPress={() => addTier('scooter')}><Text style={styles.addTierBtnText}>➕ إضافة شريحة</Text></TouchableOpacity>
                  <Text style={styles.tierHint}>* اكتب 999 في خانة المسافة للشريحة الأخيرة (المفتوحة)</Text>
                </View>
              </View>

              {/* 🎁 قسم المكافآت والبونص التلقائي */}
              <View style={[styles.settingsSection, { borderColor: '#38bdf8' }]}>
                <Text style={[styles.settingsSectionTitle, { color: '#38bdf8' }]}>🎁 نظام المكافآت التلقائي للكباتن</Text>
                
                {/* 👈 أزرار اختيار مدة البونص */}
                <Text style={styles.settingsLabel}>فترة احتساب الرحلات:</Text>
                <View style={[styles.typeSelectorRow, { marginBottom: 15 }]}>
                  <TouchableOpacity style={[styles.typeOption, appSettings.bonusDuration === 'monthly' && { backgroundColor: '#38bdf8', borderColor: '#38bdf8' }]} onPress={() => setAppSettings({...appSettings, bonusDuration: 'monthly'})}>
                    <Text style={[styles.typeOptionText, appSettings.bonusDuration === 'monthly' && { color: '#fff' }]}>شهري</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.typeOption, appSettings.bonusDuration === 'weekly' && { backgroundColor: '#38bdf8', borderColor: '#38bdf8' }]} onPress={() => setAppSettings({...appSettings, bonusDuration: 'weekly'})}>
                    <Text style={[styles.typeOptionText, appSettings.bonusDuration === 'weekly' && { color: '#fff' }]}>أسبوعي</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.typeOption, appSettings.bonusDuration === 'daily' && { backgroundColor: '#38bdf8', borderColor: '#38bdf8' }]} onPress={() => setAppSettings({...appSettings, bonusDuration: 'daily'})}>
                    <Text style={[styles.typeOptionText, appSettings.bonusDuration === 'daily' && { color: '#fff' }]}>يومي</Text>
                  </TouchableOpacity>
                </View>

                {/* 👈 خانات الأرقام والمبلغ */}
                <View style={styles.settingsInputRow}>

                  <View style={styles.settingsInputGroup}>
                    <Text style={styles.settingsLabel}>مبلغ المكافأة (ج)</Text>
                    <TextInput style={[styles.settingsInput, { color: '#10b981' }]} keyboardType="numeric" value={appSettings.bonusAmount} onChangeText={t => setAppSettings({...appSettings, bonusAmount: t})} textAlign="center" placeholder="مثال: 300" />
                  </View>
                </View>

                {/* 👈 خانات التواريخ المخصصة */}
                <View style={[styles.settingsInputRow, { marginTop: 15 }]}>
                  <View style={styles.settingsInputGroup}>
                    <Text style={styles.settingsLabel}>ينتهي في (اختياري)</Text>
                    <TextInput style={[styles.settingsInput, { fontSize: 13 }]} value={appSettings.bonusEndDate} onChangeText={t => setAppSettings({...appSettings, bonusEndDate: t})} textAlign="center" placeholder="مثال: 2026-11-07" placeholderTextColor="#64748b" />
                  </View>
                  <View style={styles.settingsInputGroup}>
                    <Text style={styles.settingsLabel}>يبدأ من (اختياري)</Text>
                    <TextInput style={[styles.settingsInput, { fontSize: 13 }]} value={appSettings.bonusStartDate} onChangeText={t => setAppSettings({...appSettings, bonusStartDate: t})} textAlign="center" placeholder="مثال: 2026-11-01" placeholderTextColor="#64748b" />
                  </View>
                </View>
              </View>

              {/* ⚙️ إعدادات عامة وحد المديونية */}
              <View style={styles.settingsSection}>
                <Text style={styles.settingsSectionTitle}>⚙️ ضوابط النظام</Text>
                <View style={styles.settingsInputRow}>
                  <View style={styles.settingsInputGroup}>
                    <Text style={styles.settingsLabel}>حد المديونية (ج)</Text>
                    <TextInput style={[styles.settingsInput, { color: '#ef4444' }]} keyboardType="numeric" value={appSettings.maxNegativeBalance} onChangeText={t => setAppSettings({...appSettings, maxNegativeBalance: t})} textAlign="center" placeholder="-50" />
                  </View>
                 
                  <View style={styles.settingsInputGroup}>
                    <Text style={styles.settingsLabel}>الانتظار (دقائق)</Text>
                    <TextInput style={styles.settingsInput} keyboardType="numeric" value={appSettings.waitingTimeMins} onChangeText={t => setAppSettings({...appSettings, waitingTimeMins: t})} textAlign="center" />
                  </View>
                </View>
              </View>

              <TouchableOpacity style={styles.saveSettingsBtn} onPress={saveAppSettings} disabled={savingSettings}>
                {savingSettings ? <ActivityIndicator color="#000" /> : <Text style={styles.saveSettingsBtnText}>حفظ وتطبيق الإعدادات 💾</Text>}
              </TouchableOpacity>
              
            </ScrollView>
          </KeyboardAvoidingView>
        ) : activeTab === 'pending' ? (
          <ScrollView showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#eab308" />}>
            {totalPending === 0 ? <View style={styles.emptyState}><Text style={styles.emptyText}>لا توجد طلبات معلقة ✨</Text></View> : (
              <>
                {pendingCaptains.map(item => (
                  <View key={item.id} style={styles.userCard}>
                    <View style={styles.cardHeader}>
                      <Image source={{ uri: item.avatar || 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png' }} style={styles.avatarImg} />
                      <View style={styles.cardInfo}>
                        <Text style={styles.userTypeBadgeCard}>👨‍✈️ طلب كابتن جديد</Text>
                        <Text style={styles.cardName}>{item.name}</Text>
                        <Text style={styles.cardDetail}>📞 {item.phone}</Text>
                        <Text style={styles.cardDetail}>🛺 {item.vehicle}</Text>
                      </View>
                    </View>
                    <TouchableOpacity style={styles.inspectDocsBtn} onPress={() => setSelectedDocs(item)}><Text style={styles.inspectDocsBtnText}>🔍 معاينة المستندات</Text></TouchableOpacity>
                    <View style={styles.actionRow}>
                      <TouchableOpacity style={styles.rejectBtn} onPress={() => rejectRegistration(item.id, 'captain')}><Text style={styles.rejectBtnText}>رفض ❌</Text></TouchableOpacity>
                      <TouchableOpacity style={styles.approveBtn} onPress={() => approveRegistration(item.id, 'captain')}><Text style={styles.approveBtnText}>موافقة وتفعيل ✔️</Text></TouchableOpacity>
                    </View>
                  </View>
                ))}

                {pendingPassengers.map(item => (
                  <View key={item.id} style={styles.userCard}>
                    <View style={styles.cardHeader}>
                      <Image source={{ uri: item.avatar || 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png' }} style={styles.avatarImg} />
                      <View style={styles.cardInfo}>
                        <Text style={[styles.userTypeBadgeCard, {color: '#38bdf8'}]}>👤 طلب راكب جديد</Text>
                        <Text style={styles.cardName}>{item.name}</Text>
                        <Text style={styles.cardDetail}>📞 {item.phone}</Text>
                        <Text style={styles.cardDetail}>🪪 {item.nationalId || 'لم يحدد'}</Text>
                      </View>
                    </View>
                    <View style={styles.actionRow}>
                      <TouchableOpacity style={styles.rejectBtn} onPress={() => rejectRegistration(item.id, 'passenger')}><Text style={styles.rejectBtnText}>رفض ❌</Text></TouchableOpacity>
                      <TouchableOpacity style={styles.approveBtn} onPress={() => approveRegistration(item.id, 'passenger')}><Text style={styles.approveBtnText}>موافقة وتفعيل ✔️</Text></TouchableOpacity>
                    </View>
                  </View>
                ))}
              </>
            )}
          </ScrollView>
        ) : activeTab === 'updates' ? (
          <ScrollView showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#eab308" />}>
            {updateRequests.length === 0 ? <View style={styles.emptyState}><Text style={styles.emptyText}>لا توجد طلبات تعديل ✨</Text></View> : (
              updateRequests.map(req => (
                <View key={req.id} style={styles.userCard}>
                  
                  {req.userType === 'passenger' ? (
                    <>
                      <Text style={[styles.updateRequestHeader, {color: '#38bdf8'}]}>طلب تعديل هاتف (راكب 👤)</Text>
                      <Text style={styles.updateRequestPhone}>الاسم: {req.passengerName}</Text>
                      <View style={styles.updateComparisonBox}>
                        <View style={styles.updateCol}>
                          <Text style={styles.updateColTitleNew}>الرقم الجديد</Text>
                          <Text style={[styles.updateText, {fontSize: 18, fontWeight: 'bold', color: '#10b981'}]}>{req.newData.phone}</Text>
                        </View>
                        <View style={styles.updateDivider} />
                        <View style={styles.updateCol}>
                          <Text style={styles.updateColTitleOld}>الرقم القديم</Text>
                          <Text style={[styles.updateText, {fontSize: 16}]}>{req.oldData.phone}</Text>
                        </View>
                      </View>
                    </>
                  ) : (
                    <>
                      <Text style={styles.updateRequestHeader}>طلب تعديل بيانات (كابتن 🛺)</Text>
                      <Text style={styles.updateRequestPhone}>رقم الكابتن: {req.captainPhone}</Text>
                      <View style={styles.updateComparisonBox}>
                        <View style={styles.updateCol}>
                          <Text style={styles.updateColTitleNew}>البيانات الجديدة</Text>
                          <Image source={{ uri: req.newData.avatar || 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png' }} style={styles.updateAvatar} />
                          <Text style={styles.updateText}>{req.newData.name}</Text>
                          <Text style={styles.updateText}>{req.newData.vehicle}</Text>
                        </View>
                        <View style={styles.updateDivider} />
                        <View style={styles.updateCol}>
                          <Text style={styles.updateColTitleOld}>البيانات القديمة</Text>
                          <Image source={{ uri: req.oldData.avatar || 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png' }} style={styles.updateAvatar} />
                          <Text style={styles.updateText}>{req.oldData.name}</Text>
                          <Text style={styles.updateText}>{req.oldData.vehicle}</Text>
                        </View>
                      </View>
                      {req.newData.vehicleCategory && req.newData.vehicleCategory !== 'car' && (
                         <TouchableOpacity style={styles.inspectDocsBtn} onPress={() => setSelectedDocs({ vehicleImage: req.newData.vehicleDetails?.image })}>
                           <Text style={styles.inspectDocsBtnText}>🔍 معاينة صورة المركبة الجديدة</Text>
                         </TouchableOpacity>
                      )}
                    </>
                  )}

                  <View style={styles.actionRow}>
                    <TouchableOpacity style={styles.rejectBtn} onPress={() => handleRejectUpdate(req)}><Text style={styles.rejectBtnText}>رفض ❌</Text></TouchableOpacity>
                    <TouchableOpacity style={styles.approveBtn} onPress={() => handleApproveUpdate(req)}><Text style={styles.approveBtnText}>موافقة وتحديث ✔️</Text></TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </ScrollView>
        ) : activeTab === 'captains' ? (
          <View style={{ flex: 1 }}>
            <TextInput style={styles.searchInput} placeholder="بحث عن كابتن (اسم، رقم، توكتوك)..." placeholderTextColor="#64748b" value={searchCaptain} onChangeText={setSearchCaptain} textAlign="right" />
            <ScrollView showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#eab308" />}>
              {activeCaptainsFiltered.map(item => (
                <TouchableOpacity key={item.id} style={styles.userCard} onPress={() => openUserProfile(item, 'captain')}>
                  <View style={styles.cardHeader}>
                    <View style={styles.balanceBadge}><Text style={styles.balanceLabelText}>الرصيد</Text><Text style={[styles.balanceNum, { color: (item.walletBalance || 0) < 0 ? '#ef4444' : '#10b981' }]}>{item.walletBalance ? item.walletBalance.toFixed(2) : '0'} ج</Text></View>
                    <View style={styles.cardInfo}>
                      <Text style={styles.cardName}>{item.name}</Text>
                      <Text style={styles.cardDetail}>📞 {item.phone}</Text>
                      <Text style={styles.cardDetail}>
                        {item.vehicleCategory === 'car' || item.vehicle?.includes('سيارة') ? '🚗 سيارة' : item.vehicleCategory === 'scooter' || item.vehicle?.includes('سكوتر') ? '🛵 سكوتر' : `🛺 ${item.vehicle || 'بديل توكتوك'}`}
                        {item.vehicleSequenceNumber ? ` | (رقم بُرَاق: ${item.vehicleSequenceNumber})` : ''}
                      </Text>
                      <Text style={[styles.statusText, item.status === 'banned' && { color: '#ef4444' }]}>{item.status === 'banned' ? '🚫 رقم محظور' : '🟢 نشط'}</Text>
                    </View>
                    <Image source={{ uri: item.avatar || 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png' }} style={styles.avatarImgMini} />
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        ) : activeTab === 'passengers' ? (
          <View style={{ flex: 1 }}>
            <TextInput style={styles.searchInput} placeholder="بحث عن راكب (اسم أو رقم)..." placeholderTextColor="#64748b" value={searchPassenger} onChangeText={setSearchPassenger} textAlign="right" />
            <ScrollView showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#eab308" />}>
              {activePassengersFiltered.map(item => (
                <TouchableOpacity key={item.id} style={styles.userCard} onPress={() => openUserProfile(item, 'passenger')}>
                  <View style={styles.cardHeader}>
                    <View style={styles.balanceBadge}><Text style={styles.balanceLabelText}>المحفظة</Text><Text style={[styles.balanceNum, { color: '#10b981' }]}>{item.walletBalance ? item.walletBalance.toFixed(2) : '0'} ج</Text></View>
                    <View style={styles.cardInfo}><Text style={styles.cardName}>{item.name}</Text><Text style={styles.cardDetail}>📞 {item.phone}</Text><Text style={[styles.statusText, item.status === 'banned' && { color: '#ef4444' }]}>{item.status === 'banned' ? '🚫 رقم محظور' : '🟢 نشط'}</Text></View>
                    <Image source={{ uri: item.avatar || 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png' }} style={styles.avatarImgMini} />
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        ) : (
          <View style={{ flex: 1 }}>
            {!selectedVehicleCategory ? (
              <ScrollView showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#eab308" />}>
                <Text style={styles.vehiclesSectionTitle}>أسطول الكباتن حسب المركبة 🚖</Text>
                <Text style={styles.vehiclesSectionHint}>اختر تصنيف لعرض الكباتن التابعين له</Text>

                <View style={styles.vehiclesGrid}>
                  <TouchableOpacity style={[styles.vehicleCatBox, { borderColor: '#3b82f6' }]} onPress={() => setSelectedVehicleCategory('سيارات')}>
                    <Text style={styles.vehicleCatIcon}>🚗</Text>
                    <Text style={styles.vehicleCatTitle}>سيارات</Text>
                    <View style={styles.vehicleCatBadge}><Text style={[styles.vehicleCatCount, { color: '#3b82f6' }]}>{carCaptains.length} كابتن</Text></View>
                  </TouchableOpacity>

                  <TouchableOpacity style={[styles.vehicleCatBox, { borderColor: '#10b981' }]} onPress={() => setSelectedVehicleCategory('كيوت 3 راكب')}>
                    <Text style={styles.vehicleCatIcon}>🛺</Text>
                    <Text style={styles.vehicleCatTitle}>كيوت 3 راكب</Text>
                    <View style={styles.vehicleCatBadge}><Text style={[styles.vehicleCatCount, { color: '#10b981' }]}>{cuteCaptains.length} كابتن</Text></View>
                  </TouchableOpacity>

                  <TouchableOpacity style={[styles.vehicleCatBox, { borderColor: '#f59e0b' }]} onPress={() => setSelectedVehicleCategory('جالاكسي 7 راكب')}>
                    <Text style={styles.vehicleCatIcon}>🛺</Text>
                    <Text style={styles.vehicleCatTitle}>جالاكسي 7 راكب</Text>
                    <View style={styles.vehicleCatBadge}><Text style={[styles.vehicleCatCount, { color: '#f59e0b' }]}>{galaxyCaptains.length} كابتن</Text></View>
                  </TouchableOpacity>

                  <TouchableOpacity style={[styles.vehicleCatBox, { borderColor: '#8b5cf6' }]} onPress={() => setSelectedVehicleCategory('سكوتر')}>
                    <Text style={styles.vehicleCatIcon}>🛵</Text>
                    <Text style={styles.vehicleCatTitle}>سكوتر</Text>
                    <View style={styles.vehicleCatBadge}><Text style={[styles.vehicleCatCount, { color: '#8b5cf6' }]}>{scooterCaptains.length} كابتن</Text></View>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            ) : (
              <View style={{ flex: 1 }}>
                <View style={styles.vehicleListHeader}>
                  <TouchableOpacity onPress={() => setSelectedVehicleCategory(null)} style={styles.backBtnCategory}>
                    <Text style={styles.backBtnCategoryText}>رجوع ✖</Text>
                  </TouchableOpacity>
                  <View>
                     <Text style={styles.vehicleListTitle}>كباتن ({selectedVehicleCategory})</Text>
                     <Text style={styles.vehicleListSub}>العدد الإجمالي: {getSelectedCaptainsList().length}</Text>
                  </View>
                </View>

                <ScrollView showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#eab308" />}>
                  {getSelectedCaptainsList().length === 0 ? (
                    <Text style={styles.emptyText}>لا يوجد كباتن مسجلين بهذه المركبة حالياً.</Text>
                  ) : (
                    getSelectedCaptainsList().map((cap, idx) => (
                      <View key={idx} style={styles.capListCard}>
                        <TouchableOpacity style={styles.capListProfileBtn} onPress={() => openUserProfile(cap, 'captain')}>
                          <Text style={styles.capListProfileBtnText}>عرض الملف 👤</Text>
                        </TouchableOpacity>
                        <View style={styles.capListInfo}>
                          <Text style={styles.capListName}>{cap.name}</Text>
                          <Text style={styles.capListPhone}>📞 {cap.phone}</Text>
                        </View>
                      </View>
                    ))
                  )}
                </ScrollView>
              </View>
            )}
          </View>
        )}
      </View>

      {/* 🚀 المودالز والشاشات المنبثقة 🚀 */}
      
      {/* 1. الدعم الفني */}
      <Modal visible={isSupportModalVisible} animationType="slide" onRequestClose={() => setIsSupportModalVisible(false)}>
        <View style={{ flex: 1, backgroundColor: '#0f172a' }}>
          
          <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', padding: 20, backgroundColor: '#1e293b', paddingTop: 50, borderBottomWidth: 1, borderColor: '#334155' }}>
            <Text style={{ color: '#eab308', fontSize: 18, fontWeight: 'bold' }}>
              {activeSupportChat ? `محادثة: ${activeSupportChat.userName}` : 'صندوق الدعم الفني'}
            </Text>
            <TouchableOpacity onPress={() => activeSupportChat ? setActiveSupportChat(null) : setIsSupportModalVisible(false)} style={{ backgroundColor: '#334155', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 }}>
              <Text style={{ color: '#ef4444', fontWeight: 'bold' }}>{activeSupportChat ? 'رجوع' : 'إغلاق ✖'}</Text>
            </TouchableOpacity>
          </View>

          {!activeSupportChat ? (
            <FlatList
              data={supportTickets}
              keyExtractor={item => item.id}
              contentContainerStyle={{ padding: 15 }}
              ListEmptyComponent={<Text style={{ textAlign: 'center', marginTop: 50, color: '#94a3b8', fontSize: 16 }}>لا توجد محادثات مفتوحة حالياً ✅</Text>}
              renderItem={({ item }) => (
                <TouchableOpacity onPress={() => openSupportChat(item)} style={{ backgroundColor: '#1e293b', padding: 15, borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: '#334155', flexDirection: 'row-reverse', alignItems: 'center' }}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between' }}>
                      <Text style={{ fontWeight: 'bold', fontSize: 16, color: '#f8fafc' }}>{item.userName} ({item.userType === 'captain' ? 'كابتن' : 'راكب'})</Text>
                      {(item.unreadAdminCount || 0) > 0 && (
                        <View style={{ backgroundColor: '#ef4444', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2, justifyContent: 'center' }}>
                          <Text style={{ color: '#fff', fontSize: 11, fontWeight: 'bold' }}>جديد</Text>
                        </View>
                      )}
                    </View>
                    <Text style={{ color: '#94a3b8', marginTop: 4, textAlign: 'right' }} numberOfLines={1}>{item.lastMessage}</Text>
                  </View>
                </TouchableOpacity>
              )}
            />
          ) : (
            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
              <TouchableOpacity onPress={closeSupportTicket} style={{ backgroundColor: '#fee2e2', padding: 12, alignItems: 'center', margin: 10, borderRadius: 10 }}>
                <Text style={{ color: '#ef4444', fontWeight: 'bold', fontSize: 15 }}>إنهاء المحادثة وإغلاق التذكرة 🔒</Text>
              </TouchableOpacity>
              
              <FlatList
                inverted
                data={supportMessages}
                keyExtractor={item => item.id}
                contentContainerStyle={{ padding: 15 }}
                renderItem={({ item }) => (
                  <View style={{ alignSelf: item.sender === 'admin' ? 'flex-end' : 'flex-start', backgroundColor: item.sender === 'admin' ? '#3b82f6' : '#334155', padding: 12, borderRadius: 12, marginBottom: 10, maxWidth: '80%' }}>
                    <Text style={{ color: '#fff', fontSize: 15 }}>{item.text}</Text>
                  </View>
                )}
              />

              <View style={{ flexDirection: 'row-reverse', padding: 10, backgroundColor: '#1e293b', borderTopWidth: 1, borderColor: '#334155' }}>
                <TextInput
                  style={{ flex: 1, backgroundColor: '#0f172a', color: '#fff', borderRadius: 20, paddingHorizontal: 15, minHeight: 45, textAlign: 'right', borderWidth: 1, borderColor: '#334155' }}
                  placeholder="اكتب ردك..."
                  placeholderTextColor="#64748b"
                  value={adminReplyText}
                  onChangeText={handleAdminTyping}
                  multiline
                />
                <TouchableOpacity onPress={sendAdminReply} style={{ backgroundColor: '#10b981', width: 45, height: 45, borderRadius: 22.5, justifyContent: 'center', alignItems: 'center', marginRight: 10 }}>
                  <Text style={{ color: '#fff', transform: [{ rotateY: '180deg' }], fontSize: 18 }}>➤</Text>
                </TouchableOpacity>
              </View>
            </KeyboardAvoidingView>
          )}
        </View>
      </Modal>

      {/* 2. الملف الشخصي */}
      <Modal visible={profileModalVisible} transparent={true} animationType="slide">
        <View style={styles.fullScreenModal}>
          <View style={styles.profileModalHeader}>
            <TouchableOpacity onPress={() => setProfileModalVisible(false)}><Text style={styles.closeBtnText}>إغلاق ✖</Text></TouchableOpacity>
            <Text style={styles.modalTitleText}>ملف {selectedUserType === 'captain' ? 'الكابتن' : 'الراكب'}</Text>
            <View style={{width: 50}} />
          </View>

          {selectedUser && (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20 }}>
              <View style={styles.profileHeaderBox}>
                <Image source={{ uri: selectedUser.avatar || 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png' }} style={styles.profileBigAvatar} />
                <View style={styles.profileAvgRatingRow}>
                  <Text style={styles.profileAvgStars}>{'⭐'.repeat(averageRating)}{'☆'.repeat(5 - averageRating)}</Text>
                  <Text style={styles.profileRatingCount}>({userRatings.length})</Text>
                </View>
              <Text style={styles.profileBigName}>{selectedUser.name}</Text>
                <Text style={styles.profileBigPhone}>📞 {selectedUser.phone}</Text>
                <Text style={styles.profileBigPhone}>🪪 الرقم القومي: {selectedUser.nationalId || 'غير مسجل'}</Text>
                
                {selectedUserType === 'captain' && (
                  <>
                    <Text style={styles.profileBigVehicle}>
                      {selectedUser.vehicleCategory === 'car' || selectedUser.vehicle?.includes('سيارة') ? '🚗 سيارة' :
                       selectedUser.vehicleCategory === 'scooter' || selectedUser.vehicle?.includes('سكوتر') ? '🛵 سكوتر' :
                       (selectedUser.vehicle?.includes('جالاكسي') || selectedUser.vehicleDetails?.type?.includes('جالاكسي') || selectedUser.requestedTuktukType?.includes('جالاكسي')) ? '🛺 جالاكسي 7 راكب' :
                       (selectedUser.vehicle?.includes('كيوت') || selectedUser.vehicleDetails?.type?.includes('كيوت') || selectedUser.requestedTuktukType?.includes('كيوت')) ? '🛺 كيوت 3 راكب' :
                       selectedUser.vehicleCategory === 'tuktuk_alt' ? '🛺 كيوت 3 راكب' :
                       selectedUser.vehicle ? `🛺 ${selectedUser.vehicle}` : 
                       '⚠️ نوع المركبة غير مسجل بالدقة المطلوبة'}
                    </Text>
                    {selectedUser.vehicleSequenceNumber && (
                      <View style={{ backgroundColor: '#eff6ff', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, marginBottom: 12, borderWidth: 1, borderColor: '#bfdbfe' }}>
                        <Text style={{ color: '#1d4ed8', fontWeight: 'bold', fontSize: 14 }}>رقم بُرَاق الكودي: {selectedUser.vehicleSequenceNumber}</Text>
                      </View>
                    )}
                  </>
                )}

                <Text style={[styles.profileStatusBadge, selectedUser.status === 'banned' && { backgroundColor: '#ef4444' }]}>{selectedUser.status === 'banned' ? 'محظور من التسجيل 🚫' : 'حساب نشط 🟢'}</Text>
              </View>
                  
              <TouchableOpacity style={styles.sendDirectMsgBtnProfile} onPress={() => setProfileMsgModalVisible(true)}>
                <Text style={styles.sendDirectMsgBtnText}>إرسال رسالة مباشرة لهذا المستخدم 📩</Text>
              </TouchableOpacity>

              <View style={styles.walletAdminBox}>
                <Text style={styles.walletAdminLabel}>رصيد المحفظة</Text>
                <Text style={[styles.walletAdminAmount, (selectedUser.walletBalance || 0) < 0 && { color: '#ef4444' }]}>{selectedUser.walletBalance ? selectedUser.walletBalance.toFixed(2) : '0'} ج</Text>
                <TouchableOpacity style={styles.adjustWalletBtnProfile} onPress={() => setWalletModalVisible(true)}><Text style={styles.adjustWalletBtnText}>تعديل الرصيد 💰</Text></TouchableOpacity>
              </View>

              {selectedUserType === 'captain' && (
                <View style={styles.docsSection}>
                  <Text style={styles.sectionTitleProfile}>المستندات الرسمية</Text>
                  <TouchableOpacity style={styles.inspectDocsBtnProfile} onPress={() => setSelectedDocs(selectedUser)}><Text style={styles.inspectDocsBtnText}>عرض صور البطاقة والتوكتوك 🪪</Text></TouchableOpacity>
                </View>
              )}

              <View style={styles.ratingsSection}>
                <Text style={styles.sectionTitleProfile}>سجل التقييمات ({userRatings.length})</Text>
                {loadingProfile ? <ActivityIndicator color="#eab308" /> : userRatings.length === 0 ? <Text style={styles.emptyText}>لم يتلقَ أي تقييمات بعد.</Text> : (
                  userRatings.map((rating, idx) => {
                    let finalSenderName = rating.senderName;
                    if (!finalSenderName) {
                      if (selectedUserType === 'captain') {
                        const pass = passengers.find(p => p.id === rating.passengerId);
                        finalSenderName = pass ? pass.name : 'راكب (حساب محذوف)';
                      } else {
                        const cap = captains.find(c => c.id === rating.captainId);
                        finalSenderName = cap ? cap.name : 'كابتن (حساب محذوف)';
                      }
                    }
                    return (
                      <View key={idx} style={styles.ratingItem}>
                        <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between' }}>
                          <Text style={styles.starsText}>{'⭐'.repeat(rating.rating)}</Text>
                          <Text style={styles.ratingUserText}>من: {finalSenderName}</Text>
                        </View>
                        <Text style={styles.ratingReasonText}>"{rating.reason}"</Text>
                      </View>
                    );
                  })
                )}
              </View>

              <View style={styles.dangerZoneContainer}>
                <Text style={styles.dangerZoneNote}>خيارات الإدارة والتحكم:</Text>
                
                {selectedUserType === 'captain' && (
                  <TouchableOpacity style={styles.tempBanBtn} onPress={removeTemporaryBan}>
                    <Text style={styles.tempBanBtnText}>فك الحظر المؤقت وتصفير المخالفات 🔓</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity style={[styles.banBtnBig, selectedUser.status === 'banned' && { backgroundColor: '#10b981' }]} onPress={() => toggleBanUser(selectedUser, selectedUserType)}><Text style={styles.banBtnBigText}>{selectedUser.status === 'banned' ? 'إلغاء الحظر (السماح بالتسجيل)' : 'حظر الرقم نهائياً (القائمة السوداء) 🚫'}</Text></TouchableOpacity>
                <TouchableOpacity style={styles.deleteBtnBig} onPress={() => deleteUserAccount(selectedUser.id, selectedUserType)}><Text style={styles.deleteBtnBigText}>مسح بيانات الحساب 🗑️</Text></TouchableOpacity>
              </View>
            </ScrollView>
          )}
        </View>
      </Modal>

      {/* 3. رسالة لملف شخصي */}
      <Modal visible={profileMsgModalVisible} transparent={true} animationType="fade">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.overlayCentered}>
          <View style={styles.walletModalContent}>
            <Text style={styles.modalTitleText}>مراسلة: {selectedUser?.name}</Text>
            <TextInput style={styles.inputModal} placeholder="عنوان الرسالة (تنبيه، مكافأة...)" placeholderTextColor="#64748b" value={profileMsgTitle} onChangeText={setProfileMsgTitle} textAlign="right" />
            <TextInput style={[styles.inputModal, { minHeight: 80, textAlignVertical: 'top' }]} placeholder="اكتب نص الرسالة هنا..." placeholderTextColor="#64748b" multiline value={profileMsgText} onChangeText={setProfileMsgText} textAlign="right" />
            <View style={styles.actionRowModal}>
              <TouchableOpacity style={styles.confirmModalBtn} onPress={handleSendProfileMessage} disabled={sendingProfileMsg}><Text style={styles.confirmModalBtnText}>إرسال الإشعار فوراً</Text></TouchableOpacity>
              <TouchableOpacity style={styles.cancelModalBtn} onPress={() => setProfileMsgModalVisible(false)}><Text style={styles.cancelModalBtnText}>إلغاء</Text></TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* 4. تعديل المحفظة */}
      <Modal visible={walletModalVisible} transparent={true} animationType="fade">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.overlayCentered}>
          <View style={styles.walletModalContent}>
            <Text style={styles.modalTitleText}>تعديل الرصيد</Text>
            <View style={styles.typeSelectorRow}>
              <TouchableOpacity style={[styles.typeOption, transactionType === 'deposit' && styles.typeOptionDeposit]} onPress={() => setTransactionType('deposit')}><Text style={[styles.typeOptionText, transactionType === 'deposit' && { color: '#fff' }]}>➕ إضافة</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.typeOption, transactionType === 'deduction' && styles.typeOptionDeduction]} onPress={() => setTransactionType('deduction')}><Text style={[styles.typeOptionText, transactionType === 'deduction' && { color: '#fff' }]}>➖ خصم</Text></TouchableOpacity>
            </View>
            <TextInput style={styles.inputModal} placeholder="المبلغ" placeholderTextColor="#64748b" keyboardType="numeric" value={walletAmount} onChangeText={setWalletAmount} textAlign="right" />
            <TextInput style={styles.inputModal} placeholder="السبب..." placeholderTextColor="#64748b" value={walletReason} onChangeText={setWalletReason} textAlign="right" />
            <View style={styles.actionRowModal}>
              <TouchableOpacity style={styles.confirmModalBtn} onPress={executeWalletAdjustment} disabled={processingWallet}><Text style={styles.confirmModalBtnText}>تأكيد</Text></TouchableOpacity>
              <TouchableOpacity style={styles.cancelModalBtn} onPress={() => setWalletModalVisible(false)}><Text style={styles.cancelModalBtnText}>إلغاء</Text></TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* 5. عرض المستندات */}
      <Modal visible={!!selectedDocs} transparent={true} animationType="fade">
        <View style={styles.overlayCentered}>
          <View style={styles.docsModalContent}>
            <TouchableOpacity onPress={() => setSelectedDocs(null)} style={{alignSelf: 'flex-start'}}><Text style={styles.closeBtnText}>إغلاق ✖</Text></TouchableOpacity>
            <ScrollView showsVerticalScrollIndicator={false}>
              {selectedDocs?.idFront && <Image source={{ uri: selectedDocs.idFront }} style={styles.docImage} />}
              {selectedDocs?.idBack && <Image source={{ uri: selectedDocs.idBack }} style={styles.docImage} />}
              {selectedDocs?.vehicleImage && <Image source={{ uri: selectedDocs.vehicleImage }} style={styles.docImage} />}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* 6. 📢 الإشعارات الجماعية للجميع */}
      <Modal visible={broadcastModalVisible} transparent={true} animationType="fade">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.overlayCentered}>
          <View style={styles.walletModalContent}>
            <Text style={[styles.modalTitleText, { color: '#38bdf8', fontSize: 18 }]}>📢 رسالة جماعية (للكل)</Text>
            
            <View style={styles.typeSelectorRow}>
              <TouchableOpacity style={[styles.typeOption, broadcastTarget === 'all' && { backgroundColor: '#3b82f6', borderColor: '#3b82f6' }]} onPress={() => setBroadcastTarget('all')}>
                <Text style={[styles.typeOptionText, broadcastTarget === 'all' && { color: '#fff' }]}>للجميع</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.typeOption, broadcastTarget === 'captains' && { backgroundColor: '#3b82f6', borderColor: '#3b82f6' }]} onPress={() => setBroadcastTarget('captains')}>
                <Text style={[styles.typeOptionText, broadcastTarget === 'captains' && { color: '#fff' }]}>للكباتن فقط</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.typeOption, broadcastTarget === 'passengers' && { backgroundColor: '#3b82f6', borderColor: '#3b82f6' }]} onPress={() => setBroadcastTarget('passengers')}>
                <Text style={[styles.typeOptionText, broadcastTarget === 'passengers' && { color: '#fff' }]}>للركاب فقط</Text>
              </TouchableOpacity>
            </View>

            <TextInput style={styles.inputModal} placeholder="عنوان الإشعار (مثال: بونص جديد 🎁)" placeholderTextColor="#64748b" value={broadcastTitle} onChangeText={setBroadcastTitle} textAlign="right" />
            <TextInput style={[styles.inputModal, { minHeight: 100, textAlignVertical: 'top' }]} placeholder="اكتب التفاصيل اللي هتوصل لكل الناس..." placeholderTextColor="#64748b" multiline value={broadcastMessage} onChangeText={setBroadcastMessage} textAlign="right" />
            
            <View style={styles.actionRowModal}>
              <TouchableOpacity style={[styles.confirmModalBtn, { backgroundColor: '#2563eb' }]} onPress={sendBroadcastMessage} disabled={sendingBroadcast}>
                {sendingBroadcast ? <ActivityIndicator color="#fff" /> : <Text style={[styles.confirmModalBtnText, { color: '#fff' }]}>إرسال الآن 🚀</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancelModalBtn} onPress={() => setBroadcastModalVisible(false)}><Text style={styles.cancelModalBtnText}>إلغاء</Text></TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a', padding: 15, paddingTop: 45 },
  header: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  headerTitle: { color: '#eab308', fontSize: 20, fontWeight: 'bold' },
  logoutBtn: { backgroundColor: '#334155', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8 },
  logoutBtnText: { color: '#f8fafc', fontSize: 13, fontWeight: 'bold' },
  
  // 🚀 تنسيقات شبكة الوصول السريع (مرصوصة بدون سحب)
  quickGrid: { flexDirection: 'row-reverse', flexWrap: 'wrap', justifyContent: 'center', gap: 10, marginBottom: 15 },
  quickCard: { width: '31%', height: 95, backgroundColor: '#1e293b', borderRadius: 14, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#334155', position: 'relative' },
  quickCardText: { color: '#cbd5e1', fontSize: 12, fontWeight: 'bold', textAlign: 'center' },
  quickBadge: { position: 'absolute', top: -6, right: -6, backgroundColor: '#ef4444', minWidth: 22, height: 22, borderRadius: 11, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#0f172a', zIndex: 5 },
  quickBadgeText: { color: '#ffffff', fontSize: 10, fontWeight: 'bold' },

  // 📑 تنسيقات التبويبات (Tabs)
  tabsContainer: { backgroundColor: '#1e293b', borderRadius: 12, height: 55, marginBottom: 15, borderWidth: 1, borderColor: '#334155', justifyContent: 'center' },
  tabBtn: { height: 40, paddingHorizontal: 16, justifyContent: 'center', alignItems: 'center', borderRadius: 8, marginHorizontal: 4, backgroundColor: 'transparent' },
  tabBtnActive: { backgroundColor: '#eab308' },
  tabBtnText: { color: '#94a3b8', fontSize: 13, fontWeight: 'bold' },
  tabBtnTextActive: { color: '#000000' },
  tabBadge: { position: 'absolute', top: -6, right: -6, backgroundColor: '#ef4444', borderRadius: 10, minWidth: 20, height: 20, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#1e293b' },
  tabBadgeText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },

  // ⚙️ تنسيقات الإعدادات
  settingsSection: { backgroundColor: '#1e293b', borderRadius: 16, padding: 15, marginBottom: 15, borderWidth: 1, borderColor: '#334155' },
  settingsSectionTitle: { color: '#f8fafc', fontSize: 16, fontWeight: 'bold', textAlign: 'right', marginBottom: 15 },
  settingsInputRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', gap: 10 },
  settingsInputGroup: { flex: 1 },
  settingsLabel: { color: '#94a3b8', fontSize: 11, textAlign: 'center', marginBottom: 5 },
  settingsInput: { backgroundColor: '#0f172a', color: '#fff', borderRadius: 8, padding: 10, fontSize: 15, borderWidth: 1, borderColor: '#475569', fontWeight: 'bold' },
  saveSettingsBtn: { backgroundColor: '#10b981', paddingVertical: 15, borderRadius: 12, alignItems: 'center', marginTop: 10, marginBottom: 30, elevation: 3 },
saveSettingsBtnText: { color: '#ffffff', fontSize: 16, fontWeight: 'bold' },

  // 📊 تنسيقات الشرائح
  tiersContainer: { marginTop: 15, padding: 12, backgroundColor: '#0f172a', borderRadius: 10, borderWidth: 1, borderColor: '#334155' },
  tiersTitle: { color: '#94a3b8', fontSize: 13, fontWeight: 'bold', marginBottom: 10, textAlign: 'right' },
  tierRow: { flexDirection: 'row-reverse', alignItems: 'center', marginBottom: 8, gap: 5 },
  tierLabel: { color: '#cbd5e1', fontSize: 12 },
  tierInput: { flex: 1, backgroundColor: '#1e293b', color: '#fff', borderRadius: 6, padding: 6, fontSize: 13, borderWidth: 1, borderColor: '#475569', textAlign: 'center' },
  removeTierBtn: { backgroundColor: '#ef4444', width: 26, height: 26, borderRadius: 13, justifyContent: 'center', alignItems: 'center', marginRight: 5 },
  addTierBtn: { backgroundColor: '#334155', padding: 8, borderRadius: 8, alignItems: 'center', marginTop: 10, alignSelf: 'flex-start' },
  addTierBtnText: { color: '#38bdf8', fontSize: 12, fontWeight: 'bold' },
  tierHint: { color: '#64748b', fontSize: 10, marginTop: 10, textAlign: 'right' },

  searchInput: { backgroundColor: '#1e293b', color: '#fff', borderRadius: 10, padding: 12, fontSize: 14, marginBottom: 15, borderWidth: 1, borderColor: '#334155' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyState: { alignItems: 'center', marginTop: 80 },
  emptyText: { color: '#64748b', fontSize: 16, textAlign: 'center', marginTop: 20 },

  userCard: { backgroundColor: '#1e293b', borderRadius: 14, padding: 15, marginBottom: 12, borderWidth: 1, borderColor: '#334155' },
  cardHeader: { flexDirection: 'row-reverse', alignItems: 'center' },
  avatarImg: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#334155' },
  avatarImgMini: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#334155', marginLeft: 10 },
  cardInfo: { flex: 1, marginRight: 12, alignItems: 'flex-end' },
  userTypeBadgeCard: { color: '#eab308', fontSize: 12, fontWeight: 'bold', marginBottom: 4 },
  cardName: { color: '#f8fafc', fontSize: 16, fontWeight: 'bold', marginBottom: 2 },
  cardDetail: { color: '#94a3b8', fontSize: 13, marginBottom: 1 },
  statusText: { color: '#10b981', fontSize: 12, fontWeight: 'bold', marginTop: 2 },
  balanceBadge: { backgroundColor: '#0f172a', padding: 8, borderRadius: 10, alignItems: 'center', minWidth: 70 },
  balanceLabelText: { color: '#64748b', fontSize: 11, fontWeight: 'bold' },
  balanceNum: { fontSize: 15, fontWeight: 'bold' },

  updateRequestHeader: { color: '#eab308', fontWeight: 'bold', marginBottom: 5, textAlign: 'right', fontSize: 16 },
  updateRequestPhone: { color: '#94a3b8', textAlign: 'right', marginBottom: 15, fontSize: 13 },
  updateComparisonBox: { flexDirection: 'row-reverse', backgroundColor: '#0f172a', borderRadius: 10, padding: 12, marginBottom: 15 },
  updateCol: { flex: 1, alignItems: 'center' },
  updateDivider: { width: 1, backgroundColor: '#334155', marginHorizontal: 10 },
  updateColTitleNew: { color: '#10b981', fontWeight: 'bold', fontSize: 13, marginBottom: 10 },
  updateColTitleOld: { color: '#ef4444', fontWeight: 'bold', fontSize: 13, marginBottom: 10 },
  updateAvatar: { width: 50, height: 50, borderRadius: 25, marginBottom: 8, backgroundColor: '#334155' },
  updateText: { color: '#cbd5e1', fontSize: 12, textAlign: 'center', marginBottom: 4 },

  actionRow: { flexDirection: 'row-reverse', gap: 10, marginTop: 12 },
  approveBtn: { flex: 2, backgroundColor: '#10b981', paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  approveBtnText: { color: '#ffffff', fontWeight: 'bold' },
  rejectBtn: { flex: 1, backgroundColor: '#ef4444', paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  rejectBtnText: { color: '#ffffff', fontWeight: 'bold' },
  inspectDocsBtn: { backgroundColor: '#334155', paddingVertical: 8, borderRadius: 8, alignItems: 'center', marginTop: 12 },
  inspectDocsBtnText: { color: '#38bdf8', fontSize: 13, fontWeight: 'bold' },

  vehiclesSectionTitle: { color: '#f8fafc', fontSize: 18, fontWeight: 'bold', textAlign: 'right', marginBottom: 5 },
  vehiclesSectionHint: { color: '#94a3b8', fontSize: 13, textAlign: 'right', marginBottom: 20 },
  vehiclesGrid: { flexDirection: 'row-reverse', flexWrap: 'wrap', justifyContent: 'space-between' },
  vehicleCatBox: { width: '48%', backgroundColor: '#1e293b', padding: 20, borderRadius: 16, borderWidth: 1, alignItems: 'center', marginBottom: 15, elevation: 2 },
  vehicleCatIcon: { fontSize: 36, marginBottom: 10 },
  vehicleCatTitle: { color: '#f8fafc', fontSize: 15, fontWeight: 'bold', marginBottom: 10 },
  vehicleCatBadge: { backgroundColor: '#0f172a', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  vehicleCatCount: { fontSize: 14, fontWeight: 'bold' },

  vehicleListHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#1e293b', padding: 15, borderRadius: 12, marginBottom: 15, borderWidth: 1, borderColor: '#334155' },
  vehicleListTitle: { color: '#eab308', fontSize: 16, fontWeight: 'bold', textAlign: 'right' },
  vehicleListSub: { color: '#94a3b8', fontSize: 12, textAlign: 'right', marginTop: 2 },
  backBtnCategory: { backgroundColor: '#334155', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  backBtnCategoryText: { color: '#ef4444', fontSize: 13, fontWeight: 'bold' },

  capListCard: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#1e293b', padding: 15, borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: '#334155' },
  capListInfo: { flex: 1, alignItems: 'flex-end', marginRight: 15 },
  capListName: { color: '#f8fafc', fontSize: 15, fontWeight: 'bold', marginBottom: 4 },
  capListPhone: { color: '#38bdf8', fontSize: 13, fontWeight: 'bold' },
  capListProfileBtn: { backgroundColor: '#2563eb', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  capListProfileBtnText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },

  fullScreenModal: { flex: 1, backgroundColor: '#0f172a' },
  profileModalHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: 50, backgroundColor: '#1e293b', borderBottomWidth: 1, borderColor: '#334155' },
  profileHeaderBox: { alignItems: 'center', marginBottom: 20, backgroundColor: '#1e293b', padding: 20, borderRadius: 16, borderWidth: 1, borderColor: '#334155' },
  profileBigAvatar: { width: 90, height: 90, borderRadius: 45, borderWidth: 3, borderColor: '#eab308', marginBottom: 10 },
  
  profileAvgRatingRow: { flexDirection: 'row-reverse', alignItems: 'center', marginBottom: 15 },
  profileAvgStars: { fontSize: 18, color: '#f59e0b', letterSpacing: 2 },
  profileRatingCount: { fontSize: 13, color: '#94a3b8', marginRight: 5, fontWeight: 'bold' },

  profileBigName: { color: '#fff', fontSize: 22, fontWeight: 'bold', marginBottom: 5 },
  profileBigPhone: { color: '#94a3b8', fontSize: 16, marginBottom: 5 },
  profileBigVehicle: { color: '#38bdf8', fontSize: 15, marginBottom: 10 },
  profileStatusBadge: { backgroundColor: '#10b981', color: '#fff', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, fontSize: 12, fontWeight: 'bold', overflow: 'hidden' },

  sendDirectMsgBtnProfile: { backgroundColor: '#2563eb', paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginBottom: 20, elevation: 3 },
  sendDirectMsgBtnText: { color: '#ffffff', fontSize: 15, fontWeight: 'bold' },

  walletAdminBox: { backgroundColor: '#1e293b', padding: 20, borderRadius: 16, alignItems: 'center', marginBottom: 20, borderWidth: 1, borderColor: '#334155' },
  walletAdminLabel: { color: '#94a3b8', fontSize: 14, fontWeight: 'bold', marginBottom: 5 },
  walletAdminAmount: { color: '#10b981', fontSize: 32, fontWeight: 'bold', marginBottom: 15 },
  adjustWalletBtnProfile: { backgroundColor: '#eab308', width: '100%', padding: 12, borderRadius: 10, alignItems: 'center' },
  adjustWalletBtnText: { color: '#000', fontWeight: 'bold', fontSize: 15 },

  docsSection: { backgroundColor: '#1e293b', padding: 20, borderRadius: 16, marginBottom: 20, borderWidth: 1, borderColor: '#334155' },
  sectionTitleProfile: { color: '#eab308', fontSize: 16, fontWeight: 'bold', textAlign: 'right', marginBottom: 15 },
  inspectDocsBtnProfile: { backgroundColor: '#334155', padding: 12, borderRadius: 10, alignItems: 'center' },

  ratingsSection: { backgroundColor: '#1e293b', padding: 20, borderRadius: 16, marginBottom: 20, borderWidth: 1, borderColor: '#334155' },
  ratingItem: { backgroundColor: '#0f172a', padding: 12, borderRadius: 10, marginBottom: 10 },
  starsText: { fontSize: 14 },
  ratingUserText: { color: '#94a3b8', fontSize: 12 },
  ratingReasonText: { color: '#f8fafc', fontSize: 14, textAlign: 'right', marginTop: 8, fontStyle: 'italic' },

  dangerZoneContainer: { gap: 12, marginBottom: 40 },
  dangerZoneNote: { color: '#94a3b8', fontSize: 13, textAlign: 'right', marginBottom: 5 },
  tempBanBtn: { backgroundColor: '#2563eb', padding: 15, borderRadius: 12, alignItems: 'center', marginBottom: 10 },
  tempBanBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  banBtnBig: { backgroundColor: '#ea580c', padding: 15, borderRadius: 12, alignItems: 'center' },
  banBtnBigText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  deleteBtnBig: { backgroundColor: '#991b1b', padding: 15, borderRadius: 12, alignItems: 'center' },
  deleteBtnBigText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },

  overlayCentered: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center', padding: 15 },
  walletModalContent: { backgroundColor: '#1e293b', width: '90%', borderRadius: 16, padding: 20 },
  docsModalContent: { backgroundColor: '#1e293b', width: '100%', maxHeight: '85%', borderRadius: 16, padding: 15 },
  modalTitleText: { color: '#f8fafc', fontSize: 16, fontWeight: 'bold', textAlign: 'center', marginBottom: 15 },
  closeBtnText: { color: '#ef4444', fontSize: 14, fontWeight: 'bold', marginBottom: 15 },
  docImage: { width: '100%', height: 180, borderRadius: 10, backgroundColor: '#0f172a', marginBottom: 10, resizeMode: 'contain' },
  
  typeSelectorRow: { flexDirection: 'row-reverse', gap: 10, marginBottom: 15 },
  typeOption: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8, borderWidth: 1, borderColor: '#334155' },
  typeOptionDeposit: { backgroundColor: '#10b981', borderColor: '#10b981' },
  typeOptionDeduction: { backgroundColor: '#ef4444', borderColor: '#ef4444' },
  typeOptionText: { color: '#94a3b8', fontWeight: 'bold' },
  inputModal: { backgroundColor: '#0f172a', color: '#fff', borderRadius: 8, padding: 12, fontSize: 14, marginBottom: 12, borderWidth: 1, borderColor: '#334155' },
  actionRowModal: { flexDirection: 'row-reverse', gap: 10, marginTop: 10 },
  confirmModalBtn: { flex: 2, backgroundColor: '#eab308', paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  confirmModalBtnText: { color: '#000', fontWeight: 'bold' },
  cancelModalBtn: { flex: 1, backgroundColor: '#334155', paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  cancelModalBtnText: { color: '#fff', fontWeight: 'bold' }
}); 