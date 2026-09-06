import { useRouter } from 'expo-router';
import { addDoc, collection, deleteDoc, doc, getDocs, increment, onSnapshot, query, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { db } from '../firebaseConfig';

export default function AdminDashboard() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'pending' | 'captains' | 'passengers' | 'support'>('pending');
  
  const [captains, setCaptains] = useState<any[]>([]);
  const [passengers, setPassengers] = useState<any[]>([]);
  const [complaints, setComplaints] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchCaptain, setSearchCaptain] = useState('');
  const [searchPassenger, setSearchPassenger] = useState('');

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

  // حالات الرسائل المباشرة من داخل البروفايل
  const [profileMsgModalVisible, setProfileMsgModalVisible] = useState(false);
  const [profileMsgTitle, setProfileMsgTitle] = useState('');
  const [profileMsgText, setProfileMsgText] = useState('');
  const [sendingProfileMsg, setSendingProfileMsg] = useState(false);

  const [msgPhone, setMsgPhone] = useState('');
  const [msgUserType, setMsgUserType] = useState<'captain' | 'passenger'>('captain');
  const [msgTitle, setMsgTitle] = useState('');
  const [msgText, setMsgText] = useState('');
  const [sendingMsg, setSendingMsg] = useState(false);
  
  const [replyModalVisible, setReplyModalVisible] = useState(false);
  const [selectedComplaint, setSelectedComplaint] = useState<any>(null);
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);

  useEffect(() => {
    const unsubCaptains = onSnapshot(collection(db, 'captains'), (snapshot) => {
      setCaptains(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });

    const unsubPassengers = onSnapshot(collection(db, 'passengers'), (snapshot) => {
      setPassengers(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const unsubComplaints = onSnapshot(collection(db, 'complaints'), (snapshot) => {
      const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      setComplaints(list);
    });

    return () => { unsubCaptains(); unsubPassengers(); unsubComplaints(); };
  }, []);

  const pendingCaptains = captains.filter(c => c.status === 'pending_approval');
  
  const activeCaptainsFiltered = captains.filter(c => 
    c.status !== 'pending_approval' && 
    (c.name?.includes(searchCaptain) || c.phone?.includes(searchCaptain) || c.vehicle?.includes(searchCaptain))
  );

  const passengersFiltered = passengers.filter(p => 
    p.name?.includes(searchPassenger) || p.phone?.includes(searchPassenger)
  );

  const approveCaptain = async (id: string) => {
    try { await updateDoc(doc(db, 'captains', id), { status: 'active' }); Alert.alert('تم ✅', 'تم تفعيل الحساب.'); } catch (e) {}
  };
  const rejectCaptain = async (id: string) => {
    try { await updateDoc(doc(db, 'captains', id), { status: 'rejected' }); Alert.alert('تم 🛑', 'تم الرفض.'); } catch (e) {}
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
      Alert.alert('تم', `تم ${newStatus === 'banned' ? 'حظر الرقم نهائياً' : 'إلغاء حظر الرقم'}.`); 
      if (selectedUser?.id === user.id) setSelectedUser({ ...selectedUser, status: newStatus });
    } catch (e) { Alert.alert('خطأ', 'حدثت مشكلة أثناء محاولة الحظر.'); }
  };

  const deleteUserAccount = async (userId: string, type: 'captain' | 'passenger') => {
    Alert.alert(
      'مسح بيانات الحساب ⚠️',
      'سيتم مسح بيانات هذا الحساب تماماً من قاعدة البيانات. سيكون بإمكان صاحب الرقم التسجيل مرة أخرى كحساب جديد. هل أنت متأكد؟',
      [{ text: 'إلغاء', style: 'cancel' },
       { text: 'نعم، امسح البيانات', style: 'destructive', onPress: async () => {
            const collectionName = type === 'captain' ? 'captains' : 'passengers';
            try {
              await deleteDoc(doc(db, collectionName, userId));
              Alert.alert('تم الحذف 🗑️', 'تم مسح الحساب وبياناته بنجاح.');
              if (selectedUser?.id === userId) { setProfileModalVisible(false); setSelectedUser(null); }
            } catch (error) { Alert.alert('خطأ', 'فشلت عملية الحذف، تأكد من اتصالك بالإنترنت.'); }
          }
       }]
    );
  };

  const openUserProfile = async (user: any, type: 'captain' | 'passenger') => {
    setSelectedUser(user); setSelectedUserType(type); setProfileModalVisible(true); setLoadingProfile(true);
    try {
      const fieldName = type === 'captain' ? 'captainId' : 'passengerId';
      const q = query(collection(db, 'ratings'), where(fieldName, '==', user.id));
      const snap = await getDocs(q);
      setUserRatings(snap.docs.map(d => d.data()));
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

  const handleSendMessage = async () => {
    if (!msgPhone.trim() || !msgTitle.trim() || !msgText.trim()) { Alert.alert('تنبيه', 'برجاء استكمال البيانات.'); return; }
    setSendingMsg(true);
    try {
      const collectionName = msgUserType === 'captain' ? 'captains' : 'passengers';
      const q = query(collection(db, collectionName), where('phone', '==', msgPhone.trim()));
      const querySnapshot = await getDocs(q);
      if (querySnapshot.empty) { Alert.alert('خطأ', 'لم يتم العثور على هذا الرقم.'); setSendingMsg(false); return; }
      
      const targetUser = querySnapshot.docs[0];
      await addDoc(collection(db, 'notifications'), { userId: targetUser.id, userType: msgUserType, title: msgTitle.trim(), message: msgText.trim(), timestamp: serverTimestamp(), read: false, sender: 'الإدارة' });
      Alert.alert('نجاح 📩', 'تم الإرسال.'); setMsgPhone(''); setMsgTitle(''); setMsgText('');
    } catch (e) { Alert.alert('خطأ', 'تعذر الإرسال.'); } finally { setSendingMsg(false); }
  };

  const handleReplyComplaint = async () => {
    if (!replyText.trim()) { Alert.alert('تنبيه', 'لا يمكن إرسال رد فارغ.'); return; }
    setSendingReply(true);
    try {
      await updateDoc(doc(db, 'complaints', selectedComplaint.id), { status: 'replied', adminReply: replyText.trim(), replyTimestamp: serverTimestamp() });
      await addDoc(collection(db, 'notifications'), { userId: selectedComplaint.senderId, userType: selectedComplaint.senderType, title: 'رد الإدارة', message: replyText.trim(), timestamp: serverTimestamp(), read: false, sender: 'الإدارة' });
      Alert.alert('نجاح', 'تم إرسال الرد.'); setReplyModalVisible(false); setReplyText(''); setSelectedComplaint(null);
    } catch (e) {} finally { setSendingReply(false); }
  };

  // حساب متوسط التقييمات للملف الشخصي
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

      <View style={styles.tabsRow}>
        <TouchableOpacity style={[styles.tabBtn, activeTab === 'pending' && styles.tabBtnActive]} onPress={() => setActiveTab('pending')}>
          <Text style={[styles.tabBtnText, activeTab === 'pending' && styles.tabBtnTextActive]}>طلبات</Text>
          {pendingCaptains.length > 0 && <View style={styles.badge}><Text style={styles.badgeText}>{pendingCaptains.length}</Text></View>}
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tabBtn, activeTab === 'captains' && styles.tabBtnActive]} onPress={() => setActiveTab('captains')}><Text style={[styles.tabBtnText, activeTab === 'captains' && styles.tabBtnTextActive]}>كباتن</Text></TouchableOpacity>
        <TouchableOpacity style={[styles.tabBtn, activeTab === 'passengers' && styles.tabBtnActive]} onPress={() => setActiveTab('passengers')}><Text style={[styles.tabBtnText, activeTab === 'passengers' && styles.tabBtnTextActive]}>ركاب</Text></TouchableOpacity>
        <TouchableOpacity style={[styles.tabBtn, activeTab === 'support' && styles.tabBtnActive]} onPress={() => setActiveTab('support')}><Text style={[styles.tabBtnText, activeTab === 'support' && styles.tabBtnTextActive]}>تواصل</Text></TouchableOpacity>
      </View>

      {loading ? <View style={styles.centerContainer}><ActivityIndicator size="large" color="#eab308" /></View> : 
      
      activeTab === 'pending' ? (
        <ScrollView showsVerticalScrollIndicator={false}>
          {pendingCaptains.length === 0 ? <View style={styles.emptyState}><Text style={styles.emptyText}>لا توجد طلبات معلقة ✨</Text></View> : (
            pendingCaptains.map(item => (
              <View key={item.id} style={styles.userCard}>
                <View style={styles.cardHeader}>
                  <Image source={{ uri: item.avatar || 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png' }} style={styles.avatarImg} />
                  <View style={styles.cardInfo}>
                    <Text style={styles.cardName}>{item.name}</Text>
                    <Text style={styles.cardDetail}>📞 {item.phone}</Text>
                    <Text style={styles.cardDetail}>🛺 {item.vehicle}</Text>
                  </View>
                </View>
                <TouchableOpacity style={styles.inspectDocsBtn} onPress={() => setSelectedDocs(item)}><Text style={styles.inspectDocsBtnText}>🔍 معاينة المستندات</Text></TouchableOpacity>
                <View style={styles.actionRow}>
                  <TouchableOpacity style={styles.rejectBtn} onPress={() => rejectCaptain(item.id)}><Text style={styles.rejectBtnText}>رفض ❌</Text></TouchableOpacity>
                  <TouchableOpacity style={styles.approveBtn} onPress={() => approveCaptain(item.id)}><Text style={styles.approveBtnText}>موافقة وتفعيل ✔️</Text></TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      ) : activeTab === 'captains' ? (
        <View style={{ flex: 1 }}>
          <TextInput style={styles.searchInput} placeholder="بحث عن كابتن (اسم، رقم، توكتوك)..." placeholderTextColor="#64748b" value={searchCaptain} onChangeText={setSearchCaptain} textAlign="right" />
          <ScrollView showsVerticalScrollIndicator={false}>
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
          <ScrollView showsVerticalScrollIndicator={false}>
            {passengersFiltered.map(item => (
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
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={styles.messagingContainer}>
            <Text style={styles.sectionTitle}>إرسال رسالة مباشرة 📩</Text>
            <View style={styles.typeSelectorRow}>
              <TouchableOpacity style={[styles.typeOption, msgUserType === 'captain' && styles.typeOptionSelected]} onPress={() => setMsgUserType('captain')}><Text style={[styles.typeOptionText, msgUserType === 'captain' && { color: '#000' }]}>👨‍✈️ كابتن</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.typeOption, msgUserType === 'passenger' && styles.typeOptionSelected]} onPress={() => setMsgUserType('passenger')}><Text style={[styles.typeOptionText, msgUserType === 'passenger' && { color: '#000' }]}>👤 راكب</Text></TouchableOpacity>
            </View>
            <TextInput style={styles.supportInput} placeholder="رقم الهاتف..." placeholderTextColor="#64748b" keyboardType="phone-pad" value={msgPhone} onChangeText={setMsgPhone} textAlign="right" />
            <TextInput style={styles.supportInput} placeholder="عنوان الرسالة..." placeholderTextColor="#64748b" value={msgTitle} onChangeText={setMsgTitle} textAlign="right" />
            <TextInput style={[styles.supportInput, { minHeight: 80, textAlignVertical: 'top' }]} placeholder="النص..." placeholderTextColor="#64748b" multiline value={msgText} onChangeText={setMsgText} textAlign="right" />
            <TouchableOpacity style={styles.sendMsgBtn} onPress={handleSendMessage} disabled={sendingMsg}>{sendingMsg ? <ActivityIndicator color="#000" /> : <Text style={styles.sendMsgBtnText}>إرسال</Text>}</TouchableOpacity>
          </View>
          
          <Text style={styles.sectionTitle}>الشكاوى والمقترحات 📬</Text>
          {complaints.length === 0 ? <Text style={styles.emptyTextSupport}>لا توجد شكاوى.</Text> : complaints.map(comp => (
            <View key={comp.id} style={[styles.complaintCard, comp.status === 'replied' && styles.complaintCardReplied]}>
              <View style={styles.complaintHeader}><Text style={styles.complaintTypeBadge}>{comp.senderType === 'captain' ? '👨‍✈️ كابتن' : '👤 راكب'}</Text><Text style={styles.complaintSenderName}>{comp.senderName}</Text></View>
              <Text style={styles.complaintText}>"{comp.text}"</Text>
              {comp.status === 'replied' ? (<View style={styles.adminReplyBox}><Text style={styles.adminReplyTitle}>ردك:</Text><Text style={styles.adminReplyText}>{comp.adminReply}</Text></View>) : (<TouchableOpacity style={styles.replyBtn} onPress={() => { setSelectedComplaint(comp); setReplyModalVisible(true); }}><Text style={styles.replyBtnText}>رد ✍️</Text></TouchableOpacity>)}
            </View>
          ))}
        </ScrollView>
      )}

      {/* مودال الملف الشخصي الشامل (Profile View) */}
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
                
                {/* --- نظام النجوم بناءً على التقييمات --- */}
                <View style={styles.profileAvgRatingRow}>
                  <Text style={styles.profileAvgStars}>
                    {'⭐'.repeat(averageRating)}{'☆'.repeat(5 - averageRating)}
                  </Text>
                  <Text style={styles.profileRatingCount}>({userRatings.length})</Text>
                </View>

                <Text style={styles.profileBigName}>{selectedUser.name}</Text>
                <Text style={styles.profileBigPhone}>📞 {selectedUser.phone}</Text>
                {selectedUserType === 'captain' && <Text style={styles.profileBigVehicle}>🛺 {selectedUser.vehicle}</Text>}
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
                {loadingProfile ? <ActivityIndicator color="#eab308" /> : userRatings.length === 0 ? <Text style={styles.emptyTextSupport}>لم يتلقَ أي تقييمات بعد.</Text> : (
                  userRatings.map((rating, idx) => (
                    <View key={idx} style={styles.ratingItem}>
                      <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between' }}><Text style={styles.starsText}>{'⭐'.repeat(rating.rating)}</Text><Text style={styles.ratingUserText}>من: {rating.senderName || (selectedUserType === 'captain' ? 'راكب' : 'كابتن')}</Text></View>
                      <Text style={styles.ratingReasonText}>"{rating.reason}"</Text>
                    </View>
                  ))
                )}
              </View>

              <View style={styles.dangerZoneContainer}>
                <Text style={styles.dangerZoneNote}>خيارات الإدارة والتحكم:</Text>
                <TouchableOpacity style={[styles.banBtnBig, selectedUser.status === 'banned' && { backgroundColor: '#10b981' }]} onPress={() => toggleBanUser(selectedUser, selectedUserType)}><Text style={styles.banBtnBigText}>{selectedUser.status === 'banned' ? 'إلغاء الحظر (السماح بالتسجيل)' : 'حظر الرقم نهائياً (القائمة السوداء) 🚫'}</Text></TouchableOpacity>
                <TouchableOpacity style={styles.deleteBtnBig} onPress={() => deleteUserAccount(selectedUser.id, selectedUserType)}><Text style={styles.deleteBtnBigText}>مسح بيانات الحساب 🗑️</Text></TouchableOpacity>
              </View>
            </ScrollView>
          )}
        </View>
      </Modal>

      {/* --- نافذة إرسال الرسالة المباشرة من البروفايل --- */}
      <Modal visible={profileMsgModalVisible} transparent={true} animationType="fade">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.overlayCentered}>
          <View style={styles.walletModalContent}>
            <Text style={styles.modalTitleText}>مراسلة: {selectedUser?.name}</Text>
            
            <TextInput style={styles.inputModal} placeholder="عنوان الرسالة (تنبيه، مكافأة...)" placeholderTextColor="#64748b" value={profileMsgTitle} onChangeText={setProfileMsgTitle} textAlign="right" />
            <TextInput style={[styles.inputModal, { minHeight: 80, textAlignVertical: 'top' }]} placeholder="اكتب نص الرسالة هنا..." placeholderTextColor="#64748b" multiline value={profileMsgText} onChangeText={setProfileMsgText} textAlign="right" />
            
            <View style={styles.actionRowModal}>
              <TouchableOpacity style={styles.confirmModalBtn} onPress={handleSendProfileMessage} disabled={sendingProfileMsg}>
                {sendingProfileMsg ? <ActivityIndicator color="#000" /> : <Text style={styles.confirmModalBtnText}>إرسال الإشعار فوراً</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancelModalBtn} onPress={() => setProfileMsgModalVisible(false)}>
                <Text style={styles.cancelModalBtnText}>إلغاء</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* باقي النوافذ المنبثقة */}
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
              <TouchableOpacity style={styles.confirmModalBtn} onPress={executeWalletAdjustment} disabled={processingWallet}>{processingWallet ? <ActivityIndicator color="#000" /> : <Text style={styles.confirmModalBtnText}>تأكيد</Text>}</TouchableOpacity>
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
              <Text style={styles.imgLabel}>الوجه</Text><Image source={{ uri: selectedDocs?.idFront }} style={styles.docImage} />
              <Text style={styles.imgLabel}>الظهر</Text><Image source={{ uri: selectedDocs?.idBack }} style={styles.docImage} />
              <Text style={styles.imgLabel}>التوكتوك</Text><Image source={{ uri: selectedDocs?.vehicleImage }} style={styles.docImage} />
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={replyModalVisible} transparent={true} animationType="fade">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.overlayCentered}>
          <View style={styles.walletModalContent}>
            <Text style={styles.modalTitleText}>رد على الشكوى</Text>
            <TextInput style={[styles.inputModal, { minHeight: 80, textAlignVertical: 'top' }]} placeholder="اكتب ردك..." placeholderTextColor="#64748b" multiline value={replyText} onChangeText={setReplyText} textAlign="right" />
            <View style={styles.actionRowModal}>
              <TouchableOpacity style={styles.confirmModalBtn} onPress={handleReplyComplaint} disabled={sendingReply}>{sendingReply ? <ActivityIndicator color="#000" /> : <Text style={styles.confirmModalBtnText}>إرسال</Text>}</TouchableOpacity>
              <TouchableOpacity style={styles.cancelModalBtn} onPress={() => setReplyModalVisible(false)}><Text style={styles.cancelModalBtnText}>إلغاء</Text></TouchableOpacity>
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
  tabsRow: { flexDirection: 'row-reverse', backgroundColor: '#1e293b', borderRadius: 12, padding: 4, marginBottom: 15 },
  tabBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10, position: 'relative' },
  tabBtnActive: { backgroundColor: '#eab308' },
  tabBtnText: { color: '#94a3b8', fontSize: 12, fontWeight: 'bold' },
  tabBtnTextActive: { color: '#000000' },
  badge: { position: 'absolute', top: -5, right: 5, backgroundColor: '#ef4444', borderRadius: 10, width: 20, height: 20, justifyContent: 'center', alignItems: 'center' },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },

  searchInput: { backgroundColor: '#1e293b', color: '#fff', borderRadius: 10, padding: 12, fontSize: 14, marginBottom: 15, borderWidth: 1, borderColor: '#334155' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyState: { alignItems: 'center', marginTop: 80 },
  emptyText: { color: '#64748b', fontSize: 16 },

  userCard: { backgroundColor: '#1e293b', borderRadius: 14, padding: 15, marginBottom: 12, borderWidth: 1, borderColor: '#334155' },
  cardHeader: { flexDirection: 'row-reverse', alignItems: 'center' },
  avatarImg: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#334155' },
  avatarImgMini: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#334155', marginLeft: 10 },
  cardInfo: { flex: 1, marginRight: 12, alignItems: 'flex-end' },
  cardName: { color: '#f8fafc', fontSize: 16, fontWeight: 'bold', marginBottom: 2 },
  cardDetail: { color: '#94a3b8', fontSize: 13, marginBottom: 1 },
  statusText: { color: '#10b981', fontSize: 12, fontWeight: 'bold', marginTop: 2 },
  balanceBadge: { backgroundColor: '#0f172a', padding: 8, borderRadius: 10, alignItems: 'center', minWidth: 70 },
  balanceLabelText: { color: '#64748b', fontSize: 11, fontWeight: 'bold' },
  balanceNum: { fontSize: 15, fontWeight: 'bold' },

  actionRow: { flexDirection: 'row-reverse', gap: 10, marginTop: 12 },
  approveBtn: { flex: 2, backgroundColor: '#10b981', paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  approveBtnText: { color: '#ffffff', fontWeight: 'bold' },
  rejectBtn: { flex: 1, backgroundColor: '#ef4444', paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  rejectBtnText: { color: '#ffffff', fontWeight: 'bold' },
  inspectDocsBtn: { backgroundColor: '#334155', paddingVertical: 8, borderRadius: 8, alignItems: 'center', marginTop: 12 },
  inspectDocsBtnText: { color: '#38bdf8', fontSize: 13, fontWeight: 'bold' },

  /* Profile Modal Styles */
  fullScreenModal: { flex: 1, backgroundColor: '#0f172a' },
  profileModalHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: 50, backgroundColor: '#1e293b', borderBottomWidth: 1, borderColor: '#334155' },
  profileHeaderBox: { alignItems: 'center', marginBottom: 20, backgroundColor: '#1e293b', padding: 20, borderRadius: 16, borderWidth: 1, borderColor: '#334155' },
  profileBigAvatar: { width: 90, height: 90, borderRadius: 45, borderWidth: 3, borderColor: '#eab308', marginBottom: 10 },
  
  // تنسيقات نجوم التقييم
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
  banBtnBig: { backgroundColor: '#ea580c', padding: 15, borderRadius: 12, alignItems: 'center' },
  banBtnBigText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  deleteBtnBig: { backgroundColor: '#991b1b', padding: 15, borderRadius: 12, alignItems: 'center' },
  deleteBtnBigText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },

  /* Support Styles */
  sectionTitle: { color: '#eab308', fontSize: 18, fontWeight: 'bold', textAlign: 'right', marginBottom: 15, marginTop: 10 },
  messagingContainer: { backgroundColor: '#1e293b', padding: 15, borderRadius: 14, marginBottom: 20, borderWidth: 1, borderColor: '#334155' },
  supportInput: { backgroundColor: '#0f172a', color: '#fff', borderRadius: 10, padding: 12, fontSize: 14, marginBottom: 12, borderWidth: 1, borderColor: '#334155' },
  sendMsgBtn: { backgroundColor: '#2563eb', paddingVertical: 14, borderRadius: 10, alignItems: 'center', marginTop: 5 },
  sendMsgBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  emptyTextSupport: { color: '#64748b', textAlign: 'center', marginTop: 10 },
  complaintCard: { backgroundColor: '#1e293b', padding: 15, borderRadius: 14, marginBottom: 12, borderWidth: 1, borderColor: '#ef4444' },
  complaintCardReplied: { borderColor: '#10b981' },
  complaintHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  complaintTypeBadge: { color: '#94a3b8', fontSize: 11, fontWeight: 'bold', backgroundColor: '#0f172a', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6 },
  complaintSenderName: { color: '#f8fafc', fontSize: 14, fontWeight: 'bold' },
  complaintText: { color: '#cbd5e1', fontSize: 13, textAlign: 'right', marginBottom: 15, lineHeight: 20 },
  replyBtn: { backgroundColor: '#334155', paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  replyBtnText: { color: '#38bdf8', fontWeight: 'bold' },
  adminReplyBox: { backgroundColor: '#0f172a', padding: 10, borderRadius: 8, borderRightWidth: 3, borderColor: '#10b981' },
  adminReplyTitle: { color: '#10b981', fontSize: 12, fontWeight: 'bold', textAlign: 'right', marginBottom: 4 },
  adminReplyText: { color: '#f8fafc', fontSize: 13, textAlign: 'right' },

  /* General Modals */
  overlayCentered: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center', padding: 15 },
  walletModalContent: { backgroundColor: '#1e293b', width: '90%', borderRadius: 16, padding: 20 },
  docsModalContent: { backgroundColor: '#1e293b', width: '100%', maxHeight: '85%', borderRadius: 16, padding: 15 },
  modalTitleText: { color: '#f8fafc', fontSize: 16, fontWeight: 'bold', textAlign: 'center', marginBottom: 15 },
  closeBtnText: { color: '#ef4444', fontSize: 14, fontWeight: 'bold', marginBottom: 15 },
  imgLabel: { color: '#eab308', fontSize: 13, fontWeight: 'bold', textAlign: 'right', marginTop: 10, marginBottom: 5 },
  docImage: { width: '100%', height: 180, borderRadius: 10, backgroundColor: '#0f172a', marginBottom: 10, resizeMode: 'contain' },
  
  typeSelectorRow: { flexDirection: 'row-reverse', gap: 10, marginBottom: 15 },
  typeOption: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8, borderWidth: 1, borderColor: '#334155' },
  typeOptionSelected: { backgroundColor: '#eab308', borderColor: '#eab308' },
  typeOptionText: { color: '#94a3b8', fontWeight: 'bold' },
  typeOptionDeposit: { backgroundColor: '#10b981', borderColor: '#10b981' },
  typeOptionDeduction: { backgroundColor: '#ef4444', borderColor: '#ef4444' },
  inputModal: { backgroundColor: '#0f172a', color: '#fff', borderRadius: 8, padding: 12, fontSize: 14, marginBottom: 12, borderWidth: 1, borderColor: '#334155' },
  actionRowModal: { flexDirection: 'row-reverse', gap: 10, marginTop: 10 },
  confirmModalBtn: { flex: 2, backgroundColor: '#eab308', paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  confirmModalBtnText: { color: '#000', fontWeight: 'bold' },
  cancelModalBtn: { flex: 1, backgroundColor: '#334155', paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  cancelModalBtnText: { color: '#fff', fontWeight: 'bold' }
});