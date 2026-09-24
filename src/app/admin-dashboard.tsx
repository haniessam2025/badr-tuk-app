import { useFocusEffect, useRouter } from 'expo-router';
import { addDoc, collection, deleteDoc, doc, getDocs, increment, limit, orderBy, query, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Image, KeyboardAvoidingView, Modal, Platform, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { db } from '../firebase';

export default function AdminDashboard() {
  const router = useRouter();
  
  const [activeTab, setActiveTab] = useState<'pending' | 'updates' | 'captains' | 'passengers' | 'vehicles'>('pending');
  
  const [captains, setCaptains] = useState<any[]>([]);
  const [passengers, setPassengers] = useState<any[]>([]);
  const [updateRequests, setUpdateRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false); // 👈 حالة التحديث الموفرة للباقة

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

  // 👈 دالة جلب البيانات الموفرة للباقة (مرة واحدة بدلاً من المراقبة المستمرة)
  const fetchDashboardData = async () => {
    try {
      // 1. جلب الكباتن
      const capSnap = await getDocs(query(collection(db, 'captains')));
      setCaptains(capSnap.docs.map(d => ({ id: d.id, ...d.data() })));

      // 2. جلب الركاب
      const passSnap = await getDocs(query(collection(db, 'passengers')));
      setPassengers(passSnap.docs.map(d => ({ id: d.id, ...d.data() })));

      // 3. جلب طلبات التعديل المعلقة فقط (لتوفير القراءات)
      const updSnap = await getDocs(query(collection(db, 'update_requests'), where('status', '==', 'pending')));
      const pendingUpdates = updSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
      pendingUpdates.sort((a: any, b: any) => (b.timestamp || 0) - (a.timestamp || 0));
      setUpdateRequests(pendingUpdates);

      // 4. جلب الشكاوى والمفقودات للعداد (أحدث 100 فقط لتوفير القراءات)
      const compSnap = await getDocs(query(collection(db, 'support_tickets'), orderBy('timestamp', 'desc'), limit(100)));
      let unreadCount = 0;
      compSnap.docs.forEach(doc => {
        const data = doc.data();
        // التوافق مع نظام القراءة الجديد والقديم
        if (data.isReadAdmin === false || (!('isReadAdmin' in data) && (data.status === 'pending' || data.status === 'new' || !data.reply))) {
          unreadCount++;
        }
      });
      setComplaintsCount(unreadCount);

    } catch (error) {
      console.log('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // 👈 استخدام useFocusEffect لتحديث البيانات تلقائياً عند العودة من أي شاشة أخرى (زي شاشة الشكاوى) عشان العداد يختفي
  useFocusEffect(
    useCallback(() => {
      fetchDashboardData();
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchDashboardData();
  };

  const pendingCaptains = captains.filter(c => c.status === 'pending' || c.status === 'pending_approval');
  const pendingPassengers = passengers.filter(p => p.status === 'pending');
  const totalPending = pendingCaptains.length + pendingPassengers.length;
  
  const activeCaptainsFiltered = captains.filter(c => 
    c.status !== 'pending' && c.status !== 'pending_approval' && 
    (c.name?.includes(searchCaptain) || c.phone?.includes(searchCaptain) || c.vehicle?.includes(searchCaptain))
  );

  const activePassengersFiltered = passengers.filter(p => 
    p.status !== 'pending' &&
    (p.name?.includes(searchPassenger) || p.phone?.includes(searchPassenger))
  );

  const onlyActiveCaptains = captains.filter(c => c.status !== 'pending' && c.status !== 'pending_approval' && c.status !== 'rejected');
  const carCaptains = onlyActiveCaptains.filter(c => c.vehicle?.includes('سيارة') || c.vehicleCategory === 'car');
  const scooterCaptains = onlyActiveCaptains.filter(c => c.vehicle?.includes('سكوتر') || c.vehicleCategory === 'scooter');
  
  const galaxyCaptains = onlyActiveCaptains.filter(c => 
    c.vehicle?.includes('جالاكسي') || 
    c.vehicleDetails?.type?.includes('جالاكسي') || 
    c.requestedTuktukType?.includes('جالاكسي')
  );

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
      await updateDoc(doc(db, collectionName, id), { status: 'active' }); 
      fetchDashboardData(); // تحديث محلي سريع
      Alert.alert('تم ✅', 'تم تفعيل الحساب بنجاح.'); 
    } catch (e) { Alert.alert('خطأ', 'حدثت مشكلة أثناء التفعيل.'); }
  };

  const rejectRegistration = async (id: string, type: 'captain' | 'passenger') => {
    const collectionName = type === 'captain' ? 'captains' : 'passengers';
    try { 
      await updateDoc(doc(db, collectionName, id), { status: 'rejected' }); 
      fetchDashboardData();
      Alert.alert('تم 🛑', 'تم رفض الطلب.'); 
    } catch (e) { Alert.alert('خطأ', 'حدثت مشكلة أثناء الرفض.'); }
  };

  const handleApproveUpdate = async (req: any) => {
    try {
      await updateDoc(doc(db, 'captains', req.captainId), {
        name: req.newData.name,
        vehicle: req.newData.vehicle,
        vehicleCategory: req.newData.vehicleCategory || 'tuktuk_alt',
        vehicleDetails: req.newData.vehicleDetails || null,
        avatar: req.newData.avatar,
        profileImage: req.newData.avatar
      });
      await updateDoc(doc(db, 'update_requests', req.id), { status: 'approved' });
      await addDoc(collection(db, 'notifications'), {
        userId: req.captainId,
        userType: 'captain',
        title: 'تحديث البيانات',
        message: 'تمت الموافقة على طلب تعديل بياناتك بنجاح.',
        timestamp: serverTimestamp(),
        read: false,
        sender: 'الإدارة'
      });
      fetchDashboardData();
      Alert.alert('نجاح', 'تمت الموافقة وتحديث بيانات الكابتن بنجاح.');
    } catch (e) {
      Alert.alert('خطأ', 'حدثت مشكلة أثناء محاولة الموافقة على الطلب.');
    }
  };

  const handleRejectUpdate = async (req: any) => {
    try {
      await updateDoc(doc(db, 'update_requests', req.id), { status: 'rejected' });
      await addDoc(collection(db, 'notifications'), {
        userId: req.captainId,
        userType: 'captain',
        title: 'تحديث البيانات',
        message: 'تم رفض طلب تعديل بياناتك لمخالفته الشروط. تواصل مع الدعم للمزيد من التفاصيل.',
        timestamp: serverTimestamp(),
        read: false,
        sender: 'الإدارة'
      });
      fetchDashboardData();
      Alert.alert('تم', 'تم رفض طلب التعديل.');
    } catch (e) {
      Alert.alert('خطأ', 'حدثت مشكلة أثناء الرفض.');
    }
  };
  
  const toggleBanUser = async (user: any, type: 'captain' | 'passenger') => {
    const newStatus = user.status === 'banned' ? 'active' : 'banned';
    const collectionName = type === 'captain' ? 'captains' : 'passengers';
    try { 
      await updateDoc(doc(db, collectionName, user.id), { status: newStatus }); 
      if (newStatus === 'banned') {
        await setDoc(doc(db, 'banned_phones', user.phone), { phone: user.phone, userType: type, name: user.name, bannedAt: serverTimestamp() });
      } else {
        await deleteDoc(doc(db, 'banned_phones', user.phone));
      }
      fetchDashboardData();
      Alert.alert('تم', `تم ${newStatus === 'banned' ? 'حظر الرقم نهائياً' : 'إلغاء حظر الرقم'}.`); 
      if (selectedUser?.id === user.id) setSelectedUser({ ...selectedUser, status: newStatus });
    } catch (e) { Alert.alert('خطأ', 'حدثت مشكلة أثناء محاولة الحظر.'); }
  };

  const removeTemporaryBan = async () => {
    try {
      await updateDoc(doc(db, 'captains', selectedUser.id), {
        bannedUntil: null,
        cancelStrikes: 0
      });
      Alert.alert('تم ✅', 'تم فك الحظر المؤقت وتصفير عداد المخالفات للكابتن.');
      setSelectedUser({ ...selectedUser, bannedUntil: null, cancelStrikes: 0 });
      fetchDashboardData();
    } catch (e) {
      Alert.alert('خطأ', 'حدثت مشكلة أثناء فك الحظر المؤقت.');
    }
  };

  const deleteUserAccount = async (userId: string, type: 'captain' | 'passenger') => {
    Alert.alert(
      'مسح بيانات الحساب ⚠️',
      'سيتم مسح بيانات هذا الحساب تماماً من قاعدة البيانات. هل أنت متأكد؟',
      [{ text: 'إلغاء', style: 'cancel' },
       { text: 'نعم، امسح البيانات', style: 'destructive', onPress: async () => {
            const collectionName = type === 'captain' ? 'captains' : 'passengers';
            try {
              await deleteDoc(doc(db, collectionName, userId));
              fetchDashboardData();
              Alert.alert('تم الحذف 🗑️', 'تم مسح الحساب وبياناته بنجاح.');
              if (selectedUser?.id === userId) { setProfileModalVisible(false); setSelectedUser(null); }
            } catch (error) { Alert.alert('خطأ', 'فشلت عملية الحذف.'); }
          }
       }]
    );
  };

  const openUserProfile = async (user: any, type: 'captain' | 'passenger') => {
    setSelectedUser(user); setSelectedUserType(type); setProfileModalVisible(true); setLoadingProfile(true);
    try {
        const fieldName = type === 'captain' ? 'captainId' : 'passengerId';
        const targetType = type === 'captain' ? 'passenger_rating_captain' : 'captain_rating_passenger';
        const q = query(collection(db, 'ratings'), where(fieldName, '==', user.id), where('type', '==', targetType));
      const snap = await getDocs(q);
      const fetchedRatings = snap.docs.map(d => d.data());
      fetchedRatings.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      setUserRatings(fetchedRatings);
    } catch (error) {} finally { setLoadingProfile(false); }
  };

  const executeWalletAdjustment = async () => {
    const amt = parseFloat(walletAmount);
    if (!amt || amt <= 0 || !walletReason.trim()) { Alert.alert('تنبيه', 'أدخل مبلغاً وسبباً صحيحاً.'); return; }
    setProcessingWallet(true);
    const finalAmount = transactionType === 'deduction' ? -Math.abs(amt) : Math.abs(amt);
    const collectionName = selectedUserType === 'captain' ? 'captains' : 'passengers';
    try {
      await updateDoc(doc(db, collectionName, selectedUser.id), { walletBalance: increment(finalAmount) });
      await addDoc(collection(db, 'wallet_transactions'), { 
        userId: selectedUser.id, userName: selectedUser.name, userType: selectedUserType,
        amount: finalAmount, type: transactionType, reason: walletReason.trim(), date: serverTimestamp(), performedBy: 'Admin' 
      });
      setSelectedUser({ ...selectedUser, walletBalance: (selectedUser.walletBalance || 0) + finalAmount });
      fetchDashboardData();
      setProcessingWallet(false); setWalletModalVisible(false); setWalletAmount(''); setWalletReason('');
      Alert.alert('نجاح ✅', 'تم تحديث المحفظة.');
    } catch (e) { setProcessingWallet(false); }
  };

  const handleSendProfileMessage = async () => {
    if (!profileMsgTitle.trim() || !profileMsgText.trim()) { Alert.alert('تنبيه', 'برجاء كتابة عنوان ونص الرسالة.'); return; }
    setSendingProfileMsg(true);
    try {
      await addDoc(collection(db, 'notifications'), {
        userId: selectedUser.id,
        userType: selectedUserType,
        title: profileMsgTitle.trim(),
        message: profileMsgText.trim(),
        timestamp: serverTimestamp(),
        read: false,
        sender: 'الإدارة'
      });
      Alert.alert('نجاح 📩', 'تم إرسال الإشعار فوراً للمستخدم.');
      setProfileMsgModalVisible(false);
      setProfileMsgTitle('');
      setProfileMsgText('');
    } catch (error) { Alert.alert('خطأ', 'تعذر إرسال الإشعار.'); } finally { setSendingProfileMsg(false); }
  };

  const getAverageRating = () => {
    if (userRatings.length === 0) return 5;
    const total = userRatings.reduce((sum, current) => sum + (current.rating || 0), 0);
    return Math.round(total / userRatings.length);
  };
  const averageRating = getAverageRating();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.logoutBtn} onPress={() => router.replace('/captain-login')}><Text style={styles.logoutBtnText}>خروج</Text></TouchableOpacity>
        <Text style={styles.headerTitle}>لوحة التحكم 👑</Text>
      </View>

      <TouchableOpacity style={styles.fullWidthHistoryBtn} onPress={() => router.push('/admin-rides')}>
        <Text style={styles.fullWidthHistoryBtnText}>سجل الرحلات 📊</Text>
      </TouchableOpacity>

      <View style={styles.tabsRow}>
        <TouchableOpacity style={[styles.tabBtn, activeTab === 'pending' && styles.tabBtnActive]} onPress={() => setActiveTab('pending')}>
          <Text style={[styles.tabBtnText, activeTab === 'pending' && styles.tabBtnTextActive]}>تسجيل</Text>
          {totalPending > 0 && <View style={styles.badge}><Text style={styles.badgeText}>{totalPending}</Text></View>}
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tabBtn, activeTab === 'updates' && styles.tabBtnActive]} onPress={() => setActiveTab('updates')}>
          <Text style={[styles.tabBtnText, activeTab === 'updates' && styles.tabBtnTextActive]}>تعديلات</Text>
          {updateRequests.length > 0 && <View style={styles.badge}><Text style={styles.badgeText}>{updateRequests.length}</Text></View>}
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tabBtn, activeTab === 'captains' && styles.tabBtnActive]} onPress={() => setActiveTab('captains')}><Text style={[styles.tabBtnText, activeTab === 'captains' && styles.tabBtnTextActive]}>كباتن</Text></TouchableOpacity>
        <TouchableOpacity style={[styles.tabBtn, activeTab === 'passengers' && styles.tabBtnActive]} onPress={() => setActiveTab('passengers')}><Text style={[styles.tabBtnText, activeTab === 'passengers' && styles.tabBtnTextActive]}>ركاب</Text></TouchableOpacity>
        
        <TouchableOpacity style={[styles.tabBtn, activeTab === 'vehicles' && styles.tabBtnActive]} onPress={() => { setActiveTab('vehicles'); setSelectedVehicleCategory(null); }}>
          <Text style={[styles.tabBtnText, activeTab === 'vehicles' && styles.tabBtnTextActive]}>مركبات</Text>
        </TouchableOpacity>
      </View>

      {loading ? <View style={styles.centerContainer}><ActivityIndicator size="large" color="#eab308" /></View> : 
      
      activeTab === 'pending' ? (
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
                <Text style={styles.updateRequestHeader}>طلب تعديل بيانات</Text>
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
                  <View style={styles.cardInfo}><Text style={styles.cardName}>{item.name}</Text><Text style={styles.cardDetail}>📞 {item.phone}</Text><Text style={[styles.statusText, item.status === 'banned' && { color: '#ef4444' }]}>{item.status === 'banned' ? '🚫 رقم محظور' : '🟢 نشط'}</Text></View>
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

      {/* 👈 تحديث زرار الشكاوى بالمسمى الجديد وظبط العداد */}
      <TouchableOpacity style={styles.fullWidthComplaintsBtn} onPress={() => router.push('/admin-complaints')}>
        <Text style={styles.fullWidthComplaintsBtnText}>الشكاوى والمقترحات والمفقودات 📬</Text>
        {complaintsCount > 0 && (
          <View style={styles.complaintBadge}>
            <Text style={styles.complaintBadgeText}>{complaintsCount}</Text>
          </View>
        )}
      </TouchableOpacity>

      {/* مودال الملف الشخصي */}
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
                
                {selectedUserType === 'captain' && (
                  <Text style={styles.profileBigVehicle}>
                    {selectedUser.vehicleCategory === 'car' || selectedUser.vehicle?.includes('سيارة') ? '🚗 سيارة' :
                     selectedUser.vehicleCategory === 'scooter' || selectedUser.vehicle?.includes('سكوتر') ? '🛵 سكوتر' :
                     (selectedUser.vehicle?.includes('جالاكسي') || selectedUser.vehicleDetails?.type?.includes('جالاكسي') || selectedUser.requestedTuktukType?.includes('جالاكسي')) ? '🛺 جالاكسي 7 راكب' :
                     (selectedUser.vehicle?.includes('كيوت') || selectedUser.vehicleDetails?.type?.includes('كيوت') || selectedUser.requestedTuktukType?.includes('كيوت')) ? '🛺 كيوت 3 راكب' :
                     selectedUser.vehicleCategory === 'tuktuk_alt' ? '🛺 كيوت 3 راكب' :
                     selectedUser.vehicle ? `🛺 ${selectedUser.vehicle}` : 
                     '⚠️ نوع المركبة غير مسجل بالدقة المطلوبة'}
                  </Text>
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

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a', padding: 15, paddingTop: 45 },
  header: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  headerTitle: { color: '#eab308', fontSize: 20, fontWeight: 'bold' },
  logoutBtn: { backgroundColor: '#334155', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8 },
  logoutBtnText: { color: '#f8fafc', fontSize: 13, fontWeight: 'bold' },
  
  fullWidthHistoryBtn: { backgroundColor: '#2563eb', paddingVertical: 18, borderRadius: 12, alignItems: 'center', marginBottom: 20, elevation: 3 },
  fullWidthHistoryBtnText: { color: '#ffffff', fontSize: 16, fontWeight: 'bold', letterSpacing: 0.5 },

  fullWidthComplaintsBtn: { position: 'relative', backgroundColor: '#be123c', paddingVertical: 15, borderRadius: 12, alignItems: 'center', marginTop: 15, elevation: 3 },
  fullWidthComplaintsBtnText: { color: '#ffffff', fontSize: 16, fontWeight: 'bold', letterSpacing: 0.5 },
  
  complaintBadge: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#ef4444',
    minWidth: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#0f172a',
    zIndex: 10,
    elevation: 4
  },
  complaintBadgeText: { color: '#ffffff', fontSize: 12, fontWeight: 'bold' },

  tabsRow: { flexDirection: 'row-reverse', backgroundColor: '#1e293b', borderRadius: 12, padding: 4, marginBottom: 15 },
  tabBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10, position: 'relative' },
  tabBtnActive: { backgroundColor: '#eab308' },
  tabBtnText: { color: '#94a3b8', fontSize: 11, fontWeight: 'bold' },
  tabBtnTextActive: { color: '#000000' },
  badge: { position: 'absolute', top: -5, right: 2, backgroundColor: '#ef4444', borderRadius: 10, width: 20, height: 20, justifyContent: 'center', alignItems: 'center' },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },

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