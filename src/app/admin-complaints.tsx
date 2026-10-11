import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { addDoc, collection, deleteDoc, doc, getDocs, onSnapshot, query, updateDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, KeyboardAvoidingView, Linking, Modal, Platform, SafeAreaView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { db } from '../firebase';
// 💡 مكتبة السحب الرسمية الجاهزة في نظام إكسبو
import { GestureHandlerRootView, Swipeable } from 'react-native-gesture-handler';

export default function AdminComplaints() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'lost_item' | 'complaint' | 'suggestion'>('lost_item');
  
  const [tickets, setTickets] = useState<any[]>([]);
  const [usersCache, setUsersCache] = useState<{ captains: { [key: string]: any }, passengers: { [key: string]: any } }>({ captains: {}, passengers: {} });
  const [loading, setLoading] = useState(true);

  const [replyModalVisible, setReplyModalVisible] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [replyText, setReplyText] = useState('');
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const [capSnap, passSnap] = await Promise.all([
          getDocs(collection(db, 'captains')),
          getDocs(collection(db, 'passengers'))
        ]);
        const captainsMap: { [key: string]: any } = {};
        capSnap.docs.forEach(d => { captainsMap[d.id] = d.data(); });
        const passengersMap: { [key: string]: any } = {};
        passSnap.docs.forEach(d => { passengersMap[d.id] = d.data(); });
        setUsersCache({ captains: captainsMap, passengers: passengersMap });
      } catch (e) { console.log(e); }
    };
    fetchUsers();
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'support_tickets'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      let fetchedTickets = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      fetchedTickets.sort((a: any, b: any) => {
        const timeA = a.timestamp?.toMillis ? a.timestamp.toMillis() : (a.timestamp || 0);
        const timeB = b.timestamp?.toMillis ? b.timestamp.toMillis() : (b.timestamp || 0);
        return timeB - timeA;
      });
      setTickets(fetchedTickets);
      setLoading(false);
    }, (error) => {
      setLoading(false);
      Alert.alert('خطأ', 'حدثت مشكلة في جلب البيانات.');
    });
    return () => unsubscribe();
  }, []);

  const markAsRead = async (id: string) => {
    try { await updateDoc(doc(db, 'support_tickets', id), { isReadAdmin: true, status: 'read' }); } catch (e) {}
  };

  const deleteTicket = (id: string) => {
    Alert.alert('حذف السجل 🗑️', 'هل أنت متأكد من مسح هذا السجل نهائياً؟', [
      { text: 'إلغاء', style: 'cancel' },
      { text: 'نعم، امسح', style: 'destructive', onPress: async () => {
          try { await deleteDoc(doc(db, 'support_tickets', id)); } catch (e) { Alert.alert('خطأ', 'تعذر الحذف'); }
        } 
      }
    ]);
  };

  const deleteRideGroup = (rideGroup: any) => {
    Alert.alert('مسح الرحلة 🗑️', 'هل أنت متأكد من مسح جميع البلاغات المرتبطة بهذه الرحلة نهائياً؟', [
      { text: 'إلغاء', style: 'cancel' },
      { text: 'نعم، امسح', style: 'destructive', onPress: async () => {
          try {
            for (const t of rideGroup.allTickets) {
              await deleteDoc(doc(db, 'support_tickets', t.id));
            }
          } catch (e) { Alert.alert('خطأ', 'تعذر الحذف'); }
        } 
      }
    ]);
  };

  const handleClearAll = () => {
    const ticketsToDelete = tickets.filter(t => t.type === activeTab);
    if (ticketsToDelete.length === 0) return;
    let tabName = activeTab === 'lost_item' ? 'المفقودات' : activeTab === 'complaint' ? 'الشكاوى' : 'المقترحات';

    Alert.alert(`مسح جميع ${tabName} ⚠️`, `سيتم مسح جميع السجلات (${ticketsToDelete.length} سجل) في هذا القسم. هل أنت متأكد؟`, [
        { text: 'إلغاء', style: 'cancel' },
        { text: 'نعم، امسح الكل', style: 'destructive', onPress: async () => {
            setLoading(true);
            try {
              for (const t of ticketsToDelete) await deleteDoc(doc(db, 'support_tickets', t.id));
            } catch (error) {} finally { setLoading(false); }
          }
        }
      ]
    );
  };

  const markRideResolved = async (rideGroup: any) => {
    Alert.alert('تأكيد استرجاع الحقوق ✅', 'هل تم بالفعل تسليم المفقودات للراكب وإنهاء المشكلة؟', [
        { text: 'إلغاء', style: 'cancel' },
        { text: 'نعم، تم التسليم', onPress: async () => {
            try {
              for (const t of rideGroup.allTickets) {
                await updateDoc(doc(db, 'support_tickets', t.id), { status: 'resolved', isReadAdmin: true, resolvedAt: new Date().getTime() });
              }
            } catch (e) { Alert.alert('خطأ', 'تعذر تحديث الحالة.'); }
          }
        }
      ]
    );
  };

  const openReplyModal = (ticket: any) => {
    setSelectedTicket(ticket);
    setReplyText('');
    setReplyModalVisible(true);
  };

  const handleSendReply = async () => {
    if (!replyText.trim()) return;
    setIsSending(true);
    try {
      const targetUserId = selectedTicket.passengerId || selectedTicket.captainId || selectedTicket.userId || selectedTicket.senderId;
      let targetUserType = selectedTicket.userType || selectedTicket.senderType;
      if (!targetUserType) targetUserType = selectedTicket.passengerId ? 'passenger' : selectedTicket.captainId ? 'captain' : 'passenger';

      if (targetUserId) {
        let titleType = activeTab === 'complaint' ? 'شكواك' : activeTab === 'suggestion' ? 'اقتراحك' : 'مفقودات الرحلة';
        await addDoc(collection(db, 'notifications'), {
          userId: targetUserId, userType: targetUserType, title: `رد الإدارة بخصوص ${titleType} 📩`, message: replyText.trim(), read: false, timestamp: new Date().getTime()
        });
      }
      await updateDoc(doc(db, 'support_tickets', selectedTicket.id), {
        isReadAdmin: true, status: 'replied', adminReply: replyText.trim(), replyTimestamp: new Date().getTime()
      });
      Alert.alert('نجاح ✅', 'تم إرسال الرد.');
      setReplyModalVisible(false);
    } catch (error) {} finally { setIsSending(false); }
  };

  const makeCall = (phone: string) => {
    if (!phone || phone === 'غير مسجل') return;
    Linking.openURL(`tel:${phone}`);
  };

  const extractContent = (item: any) => item.message || item.text || item.complaint || item.complaintText || item.suggestion || item.details || item.content || item.itemDescription || 'محتوى غير متوفر';

  const formatDateTime = (rawTime: any) => {
    if (!rawTime) return 'تاريخ غير معروف';
    let d: Date;
    if (rawTime?.toDate) d = rawTime.toDate();
    else if (typeof rawTime === 'number') d = new Date(rawTime);
    else d = new Date(rawTime);
    return `بتاريخ ${d.toLocaleDateString('ar-EG')} الساعة ${d.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}`;
  };

  const getGroupedLostRides = () => {
    const lostTickets = tickets.filter(t => t.type === 'lost_item');
    const groups: { [key: string]: any } = {};

    lostTickets.forEach(ticket => {
      const groupKey = ticket.rideId || `standalone_${ticket.id}`;
      const fallbackPassenger = ticket.passengerId ? usersCache.passengers[ticket.passengerId] : null;
      const fallbackCaptain = ticket.captainId ? usersCache.captains[ticket.captainId] : null;

      let pName = ticket.passengerName;
      if (!pName || pName === 'غير مسجل') pName = fallbackPassenger?.name || (ticket.userType === 'passenger' ? ticket.senderName : 'غير مسجل');
      let pPhone = ticket.passengerPhone || ticket.phone || ticket.senderPhone;
      if (!pPhone || pPhone === 'غير مسجل') pPhone = fallbackPassenger?.phone || 'غير مسجل';
      let cName = ticket.captainName;
      if (!cName || cName === 'غير مسجل') cName = fallbackCaptain?.name || (ticket.userType === 'captain' ? ticket.senderName : 'غير مسجل');
      let cPhone = ticket.captainPhone || (ticket.userType === 'captain' ? (ticket.phone || ticket.senderPhone) : null);
      if (!cPhone || cPhone === 'غير مسجل') cPhone = fallbackCaptain?.phone || 'غير مسجل';
      let cVehicle = ticket.captainVehicle || ticket.vehicle;
      if (!cVehicle || cVehicle === 'مركبة') cVehicle = fallbackCaptain?.vehicle || 'مركبة';

      if (!groups[groupKey]) {
        groups[groupKey] = {
          rideId: ticket.rideId || null, timestamp: ticket.timestamp, pickupLocation: ticket.pickupLocation || null, destinationLocation: ticket.destinationLocation || null, passengerName: pName, passengerPhone: pPhone, passengerId: ticket.passengerId || null, captainName: cName, captainPhone: cPhone, captainVehicle: cVehicle, captainId: ticket.captainId || null, reports: [], allTickets: []
        };
      } else {
        const g = groups[groupKey];
        if (g.passengerName === 'غير مسجل' && pName !== 'غير مسجل') g.passengerName = pName;
        if (g.passengerPhone === 'غير مسجل' && pPhone !== 'غير مسجل') g.passengerPhone = pPhone;
        if (g.captainName === 'غير مسجل' && cName !== 'غير مسجل') g.captainName = cName;
        if (g.captainPhone === 'غير مسجل' && cPhone !== 'غير مسجل') g.captainPhone = cPhone;
        if (g.captainVehicle === 'مركبة' && cVehicle !== 'مركبة') g.captainVehicle = cVehicle;
        if (!g.pickupLocation && ticket.pickupLocation) g.pickupLocation = ticket.pickupLocation;
        if (!g.destinationLocation && ticket.destinationLocation) g.destinationLocation = ticket.destinationLocation;
      }
      groups[groupKey].reports.push(ticket);
      groups[groupKey].allTickets.push(ticket);
    });

    return Object.values(groups).sort((a: any, b: any) => {
      const timeA = a.timestamp?.toMillis ? a.timestamp.toMillis() : (a.timestamp || 0);
      const timeB = b.timestamp?.toMillis ? b.timestamp.toMillis() : (b.timestamp || 0);
      return timeB - timeA;
    });
  };

  // 💡 زرار المسح اللي بيظهر لما تسحب كارت المفقودات
  const renderLostRightActions = (item: any) => (
    <View style={styles.swipeDeleteContainerLost}>
      <TouchableOpacity style={styles.swipeDeleteBtn} onPress={() => deleteRideGroup(item)}>
        <Ionicons name="trash-bin-outline" size={28} color="#ffffff" />
        <Text style={styles.swipeDeleteText}>مسح</Text>
        <Text style={styles.swipeDeleteText}>الرحلة</Text>
      </TouchableOpacity>
    </View>
  );

  const renderLostRideCard = ({ item }: { item: any }) => {
    const hasPassengerReport = item.reports.some((r: any) => r.userType === 'passenger' || r.passengerId);
    const hasCaptainReport = item.reports.some((r: any) => r.userType === 'captain' || (!r.passengerId && r.captainId));
    const isResolved = item.reports.every((r: any) => r.status === 'resolved');
    const hasUnread = item.reports.some((r: any) => r.isReadAdmin === false);

    return (
      <Swipeable renderRightActions={() => renderLostRightActions(item)}>
        <View style={[styles.rideBox, isResolved && styles.rideBoxResolved, hasUnread && styles.rideBoxUnread]}>
          <View style={styles.rideBoxHeader}>
            <View style={{ flex: 1, alignItems: 'flex-end' }}>
              <Text style={styles.rideBoxTitle}>🚖 مفقودات بخصوص الرحلة</Text>
              <Text style={styles.rideBoxDate}>{formatDateTime(item.timestamp)}</Text>
              {item.rideId && <Text style={styles.rideBoxId}>رقم الرحلة: #{item.rideId.slice(-6)}</Text>}
            </View>
            <View style={{ alignItems: 'flex-start', gap: 4 }}>
              {isResolved ? (
                <View style={styles.resolvedBadge}><Text style={styles.resolvedBadgeText}>تم الحل ✅</Text></View>
              ) : (hasPassengerReport && hasCaptainReport) ? (
                <View style={styles.matchedBadge}><Text style={styles.matchedBadgeText}>مطابقة 🤝</Text></View>
              ) : (
                <View style={styles.pendingBadge}><Text style={styles.pendingBadgeText}>قيد المتابعة ⏳</Text></View>
              )}
              {hasUnread && <View style={styles.newBadgeMini}><Text style={styles.newBadgeMiniText}>جديد</Text></View>}
            </View>
          </View>

          {(item.pickupLocation || item.destinationLocation) && (
            <View style={styles.tripRouteContainer}>
              {item.pickupLocation && <Text style={styles.routeItemText}>🟢 الانطلاق: {item.pickupLocation}</Text>}
              {item.destinationLocation && <Text style={styles.routeItemText}>🔴 الوجهة: {item.destinationLocation}</Text>}
            </View>
          )}

          <View style={styles.partiesRow}>
            <View style={styles.partyColumn}>
              <View style={styles.partyHeaderRow}>
                <Text style={styles.partyTitle}>👤 الراكب:</Text>
                {item.passengerPhone !== 'غير مسجل' && (
                  <TouchableOpacity style={styles.callSmallBtn} onPress={() => makeCall(item.passengerPhone)}>
                    <Ionicons name="call" size={14} color="#fff" />
                    <Text style={styles.callSmallBtnText}>اتصال</Text>
                  </TouchableOpacity>
                )}
              </View>
              <Text style={styles.partyNameText} numberOfLines={1}>{item.passengerName}</Text>
              <Text style={styles.partyPhoneText}>📞 {item.passengerPhone}</Text>
            </View>
            <View style={styles.partiesDivider} />
            <View style={styles.partyColumn}>
              <View style={styles.partyHeaderRow}>
                <Text style={[styles.partyTitle, { color: '#d97706' }]}>👨‍✈️ الكابتن:</Text>
                {item.captainPhone !== 'غير مسجل' && (
                  <TouchableOpacity style={[styles.callSmallBtn, { backgroundColor: '#d97706' }]} onPress={() => makeCall(item.captainPhone)}>
                    <Ionicons name="call" size={14} color="#fff" />
                    <Text style={styles.callSmallBtnText}>اتصال</Text>
                  </TouchableOpacity>
                )}
              </View>
              <Text style={styles.partyNameText} numberOfLines={1}>{item.captainName}</Text>
              <Text style={styles.partyPhoneText}>📞 {item.captainPhone}</Text>
              <Text style={styles.partyVehicleText}>🛺 {item.captainVehicle}</Text>
            </View>
          </View>

          <View style={styles.reportsSection}>
            <Text style={styles.reportsSectionTitle}>سجل ما تم الإبلاغ عنه:</Text>
            {item.reports.map((report: any, idx: number) => {
              const isPassenger = report.userType === 'passenger' || report.passengerId;
              const finalReply = report.adminReply || report.reply;
              return (
                <View key={idx} style={[styles.reportItemCard, isPassenger ? styles.passengerReportCard : styles.captainReportCard]}>
                  <View style={styles.reportItemHeader}>
                    <Text style={styles.reportItemTime}>{formatDateTime(report.timestamp)}</Text>
                    <Text style={[styles.reportItemSenderBadge, isPassenger ? { color: '#2563eb' } : { color: '#d97706' }]}>
                      {isPassenger ? '👤 الراكب:' : '👨‍✈️ الكابتن:'}
                    </Text>
                  </View>
                  <Text style={styles.reportItemContent}>{extractContent(report)}</Text>
                  {finalReply && (
                    <View style={styles.reportReplyBox}>
                      <Text style={styles.reportReplyTitle}>رد الإدارة:</Text>
                      <Text style={styles.reportReplyText}>{finalReply}</Text>
                    </View>
                  )}
                  <View style={styles.reportActionRow}>
                    <TouchableOpacity style={styles.miniReplyBtn} onPress={() => openReplyModal(report)}>
                      <Ionicons name="chatbubble-ellipses-outline" size={15} color="#fff" />
                      <Text style={styles.miniReplyBtnText}>رد مباشر</Text>
                    </TouchableOpacity>
                    {report.isReadAdmin === false && (
                      <TouchableOpacity style={styles.miniReadBtn} onPress={() => markAsRead(report.id)}>
                        <Text style={styles.miniReadBtnText}>مقروء ✔️</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })}
          </View>

          {!isResolved ? (
            <TouchableOpacity style={styles.resolveAllBtn} onPress={() => markRideResolved(item)}>
              <Ionicons name="checkmark-done-circle" size={20} color="#ffffff" />
              <Text style={styles.resolveAllBtnText}>تم التسليم وإغلاق الملف ✅</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.resolvedFooter}>
              <Text style={styles.resolvedFooterText}>✨ تم إنهاء المشكلة وتسليم الحقوق.</Text>
            </View>
          )}
        </View>
      </Swipeable>
    );
  };

  // 💡 زرار المسح اللي بيظهر لما تسحب كارت الشكوى العادية
  const renderRightActions = (id: string) => (
    <View style={styles.swipeDeleteContainer}>
      <TouchableOpacity style={styles.swipeDeleteBtn} onPress={() => deleteTicket(id)}>
        <Ionicons name="trash-bin-outline" size={28} color="#ffffff" />
        <Text style={styles.swipeDeleteText}>مسح</Text>
      </TouchableOpacity>
    </View>
  );

  const renderItem = ({ item }: { item: any }) => {
    const isUnread = item.isReadAdmin === false;
    const finalReply = item.adminReply || item.reply;

    return (
      <Swipeable renderRightActions={() => renderRightActions(item.id)}>
        <View style={[styles.card, isUnread && styles.unreadCard]}>
          <View style={styles.cardHeader}>
            <Text style={styles.dateText}>{formatDateTime(item.timestamp)}</Text>
            <View style={{ flexDirection: 'row-reverse', gap: 5 }}>
              <View style={styles.userTypeBadge}>
                <Text style={styles.userTypeBadgeText}>
                  {item.userType === 'captain' || item.captainId ? '👨‍✈️ كابتن' : '👤 راكب'}
                </Text>
              </View>
              {isUnread && <View style={styles.newBadge}><Text style={styles.newBadgeText}>جديد</Text></View>}
              {finalReply && <View style={styles.repliedBadge}><Text style={styles.repliedBadgeText}>تم الرد ✔️</Text></View>}
            </View>
          </View>

          <Text style={styles.senderText}>الاسم: {item.senderName || item.passengerName || item.captainName || 'غير مسجل'}</Text>
          <Text style={styles.phoneText}>📞 التليفون: {item.phone || item.senderPhone || item.captainPhone || 'غير مسجل'}</Text>

          <View style={styles.contentBox}>
            <Text style={styles.cardContent}>{extractContent(item)}</Text>
          </View>

          {finalReply && (
            <View style={styles.adminReplyBox}>
              <Text style={styles.adminReplyTitle}>رد الإدارة:</Text>
              <Text style={styles.adminReplyText}>{finalReply}</Text>
            </View>
          )}

          <View style={styles.actionsRow}>
            <TouchableOpacity style={styles.replyBtn} onPress={() => openReplyModal(item)}>
              <Ionicons name="chatbubble-ellipses-outline" size={18} color="#ffffff" />
              <Text style={styles.replyBtnText}>رد على المستخدم</Text>
            </TouchableOpacity>
            {isUnread && (
              <TouchableOpacity style={styles.readBtn} onPress={() => markAsRead(item.id)}>
                <Text style={styles.readBtnText}>مقروء ✔️</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Swipeable>
    );
  };

  const filteredTickets = tickets.filter(t => t.type === activeTab);
  const groupedLostRides = getGroupedLostRides();

  return (
    // 💡 تغليف الشاشة عشان حركة السحب تشتغل بنعومة
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-forward" size={24} color="#1e293b" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>الشكاوى والمفقودات</Text>
          <TouchableOpacity onPress={handleClearAll} style={styles.clearAllBtnHeader}>
            <Ionicons name="trash-bin-outline" size={16} color="#ef4444" />
            <Text style={styles.clearAllBtnText}>مسح الكل</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.tabsContainer}>
          <TouchableOpacity style={[styles.tabBtn, activeTab === 'lost_item' && styles.tabBtnActiveLost]} onPress={() => setActiveTab('lost_item')}>
            <Text style={[styles.tabText, activeTab === 'lost_item' && styles.tabTextActive]}>المفقودات 🎒</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tabBtn, activeTab === 'complaint' && styles.tabBtnActive]} onPress={() => setActiveTab('complaint')}>
            <Text style={[styles.tabText, activeTab === 'complaint' && styles.tabTextActive]}>الشكاوى 😡</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tabBtn, activeTab === 'suggestion' && styles.tabBtnActive]} onPress={() => setActiveTab('suggestion')}>
            <Text style={[styles.tabText, activeTab === 'suggestion' && styles.tabTextActive]}>المقترحات 💡</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#d97706" />
          </View>
        ) : activeTab === 'lost_item' ? (
          groupedLostRides.length === 0 ? (
            <View style={styles.center}>
              <Ionicons name="cube-outline" size={60} color="#cbd5e1" />
              <Text style={{ fontSize: 16, color: '#64748b', marginTop: 10 }}>لا توجد بلاغات مفقودات حالياً ✨</Text>
            </View>
          ) : (
            <FlatList data={groupedLostRides} keyExtractor={(_, index) => index.toString()} renderItem={renderLostRideCard} contentContainerStyle={{ padding: 15, paddingBottom: 50 }} showsVerticalScrollIndicator={false} />
          )
        ) : (
          filteredTickets.length === 0 ? (
            <View style={styles.center}>
              <Ionicons name="folder-open-outline" size={60} color="#cbd5e1" />
              <Text style={{ fontSize: 16, color: '#64748b', marginTop: 10 }}>لا توجد سجلات في هذا القسم حالياً.</Text>
            </View>
          ) : (
            <FlatList data={filteredTickets} keyExtractor={(item) => item.id} renderItem={renderItem} contentContainerStyle={{ padding: 15, paddingBottom: 50 }} showsVerticalScrollIndicator={false} />
          )
        )}

        <Modal visible={replyModalVisible} transparent={true} animationType="slide">
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>إرسال رد مباشر</Text>
              <Text style={styles.modalSubtitle}>سيصل هذا الرد كإشعار فوري على هاتف المستخدم.</Text>
              <TextInput style={styles.replyInput} placeholder="اكتب ردك هنا..." placeholderTextColor="#94a3b8" multiline value={replyText} onChangeText={setReplyText} textAlign="right" />
              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.modalSendBtn} onPress={handleSendReply} disabled={isSending}>
                  {isSending ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalSendBtnText}>إرسال الرد 🚀</Text>}
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setReplyModalVisible(false)}>
                  <Text style={styles.modalCancelBtnText}>إلغاء</Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#ffffff', padding: 20, paddingTop: 50, borderBottomWidth: 1, borderColor: '#e2e8f0' },
  backBtn: { padding: 5 },
  headerTitle: { fontSize: 16, fontWeight: 'bold', color: '#1e293b' },
  
  clearAllBtnHeader: { flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: '#fee2e2', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, gap: 4 },
  clearAllBtnText: { color: '#ef4444', fontWeight: 'bold', fontSize: 12 },

  tabsContainer: { flexDirection: 'row-reverse', backgroundColor: '#ffffff', borderBottomWidth: 1, borderColor: '#e2e8f0', paddingHorizontal: 10, paddingVertical: 10, justifyContent: 'space-between' },
  tabBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 12, backgroundColor: '#f1f5f9', marginHorizontal: 4, borderWidth: 1, borderColor: '#cbd5e1' },
  tabBtnActive: { backgroundColor: '#fef3c7', borderColor: '#d97706' },
  tabBtnActiveLost: { backgroundColor: '#e0f2fe', borderColor: '#0284c7' },
  tabText: { fontSize: 14, fontWeight: 'bold', color: '#64748b' },
  tabTextActive: { color: '#0369a1' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // تنسيقات السحب للمسح
  swipeDeleteContainer: { width: 90, marginBottom: 15, marginLeft: 10 },
  swipeDeleteContainerLost: { width: 90, marginBottom: 20, marginLeft: 10 },
  swipeDeleteBtn: { flex: 1, backgroundColor: '#ef4444', justifyContent: 'center', alignItems: 'center', borderRadius: 14, elevation: 2 },
  swipeDeleteText: { color: '#ffffff', fontWeight: 'bold', fontSize: 12, marginTop: 4, textAlign: 'center' },

  rideBox: { backgroundColor: '#ffffff', borderRadius: 16, marginBottom: 20, borderWidth: 2, borderColor: '#e2e8f0', padding: 15, elevation: 3 },
  rideBoxUnread: { borderColor: '#38bdf8' },
  rideBoxResolved: { borderColor: '#86efac', backgroundColor: '#f0fdf4' },
  rideBoxHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'flex-start', borderBottomWidth: 1, borderColor: '#f1f5f9', paddingBottom: 10, marginBottom: 12 },
  rideBoxTitle: { fontSize: 16, fontWeight: 'bold', color: '#0f172a', textAlign: 'right' },
  rideBoxDate: { fontSize: 12, color: '#64748b', textAlign: 'right', marginTop: 2 },
  rideBoxId: { fontSize: 11, color: '#0284c7', fontWeight: 'bold', textAlign: 'right', marginTop: 2 },
  
  matchedBadge: { backgroundColor: '#f3e8ff', borderWidth: 1, borderColor: '#d8b4fe', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  matchedBadgeText: { fontSize: 11, fontWeight: 'bold', color: '#7e22ce' },
  pendingBadge: { backgroundColor: '#fef3c7', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  pendingBadgeText: { fontSize: 11, fontWeight: 'bold', color: '#b45309' },
  resolvedBadge: { backgroundColor: '#dcfce7', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  resolvedBadgeText: { fontSize: 11, fontWeight: 'bold', color: '#15803d' },
  newBadgeMini: { backgroundColor: '#ef4444', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, alignSelf: 'flex-start' },
  newBadgeMiniText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },

  tripRouteContainer: { backgroundColor: '#f8fafc', padding: 10, borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 12 },
  routeItemText: { fontSize: 13, color: '#334155', textAlign: 'right', marginBottom: 3 },

  partiesRow: { flexDirection: 'row-reverse', backgroundColor: '#f8fafc', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', padding: 12, marginBottom: 15 },
  partyColumn: { flex: 1 },
  partiesDivider: { width: 1, backgroundColor: '#cbd5e1', marginHorizontal: 10 },
  partyHeaderRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  partyTitle: { fontSize: 13, fontWeight: 'bold', color: '#2563eb' },
  callSmallBtn: { flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: '#16a34a', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, gap: 3 },
  callSmallBtnText: { color: '#fff', fontSize: 11, fontWeight: 'bold' },
  partyNameText: { fontSize: 14, fontWeight: 'bold', color: '#1e293b', textAlign: 'right', marginBottom: 2 },
  partyPhoneText: { fontSize: 12, color: '#475569', textAlign: 'right' },
  partyVehicleText: { fontSize: 11, color: '#d97706', textAlign: 'right', fontWeight: 'bold', marginTop: 2 },

  reportsSection: { marginBottom: 15 },
  reportsSectionTitle: { fontSize: 13, fontWeight: 'bold', color: '#475569', textAlign: 'right', marginBottom: 8 },
  reportItemCard: { padding: 12, borderRadius: 10, borderWidth: 1, marginBottom: 8 },
  passengerReportCard: { backgroundColor: '#eff6ff', borderColor: '#bfdbfe' },
  captainReportCard: { backgroundColor: '#fffbeb', borderColor: '#fde68a' },
  reportItemHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  reportItemSenderBadge: { fontSize: 12, fontWeight: 'bold' },
  reportItemTime: { fontSize: 11, color: '#94a3b8' },
  reportItemContent: { fontSize: 14, color: '#1e293b', textAlign: 'right', lineHeight: 22 },
  
  reportReplyBox: { backgroundColor: '#f0fdf4', padding: 8, borderRadius: 6, marginTop: 8, borderWidth: 1, borderColor: '#bbf7d0' },
  reportReplyTitle: { fontSize: 11, fontWeight: 'bold', color: '#16a34a', textAlign: 'right' },
  reportReplyText: { fontSize: 13, color: '#14532d', textAlign: 'right', marginTop: 2 },

  reportActionRow: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, paddingTop: 6, borderTopWidth: 1, borderColor: 'rgba(0,0,0,0.05)' },
  miniReplyBtn: { flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: '#0284c7', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, gap: 4 },
  miniReplyBtnText: { color: '#fff', fontSize: 11, fontWeight: 'bold' },
  miniReadBtn: { backgroundColor: '#ffffff', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: '#cbd5e1' },
  miniReadBtnText: { color: '#475569', fontSize: 11, fontWeight: 'bold' },

  resolveAllBtn: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', backgroundColor: '#16a34a', paddingVertical: 12, borderRadius: 10, gap: 6 },
  resolveAllBtnText: { color: '#ffffff', fontWeight: 'bold', fontSize: 14 },
  resolvedFooter: { backgroundColor: '#dcfce7', paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  resolvedFooterText: { color: '#15803d', fontSize: 13, fontWeight: 'bold' },

  card: { backgroundColor: '#ffffff', padding: 15, borderRadius: 14, marginBottom: 15, borderWidth: 1, borderColor: '#e2e8f0', elevation: 2 },
  unreadCard: { borderColor: '#3b82f6', borderWidth: 2, backgroundColor: '#eff6ff' },
  cardHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  dateText: { fontSize: 12, color: '#94a3b8' },
  newBadge: { backgroundColor: '#ef4444', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  newBadgeText: { fontSize: 11, fontWeight: 'bold', color: '#ffffff' },
  userTypeBadge: { backgroundColor: '#e2e8f0', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  userTypeBadgeText: { fontSize: 11, fontWeight: 'bold', color: '#334155' },
  repliedBadge: { backgroundColor: '#10b981', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  repliedBadgeText: { fontSize: 11, fontWeight: 'bold', color: '#ffffff' },
  senderText: { fontSize: 15, fontWeight: 'bold', color: '#1e293b', marginBottom: 4, textAlign: 'right' },
  phoneText: { fontSize: 13, color: '#64748b', marginBottom: 10, textAlign: 'right' },
  contentBox: { backgroundColor: '#f8fafc', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 15 },
  cardContent: { fontSize: 15, color: '#334155', textAlign: 'right', lineHeight: 24 },
  adminReplyBox: { backgroundColor: '#ecfdf5', padding: 10, borderRadius: 8, marginBottom: 15, borderWidth: 1, borderColor: '#a7f3d0' },
  adminReplyTitle: { fontSize: 12, fontWeight: 'bold', color: '#059669', marginBottom: 4, textAlign: 'right' },
  adminReplyText: { fontSize: 14, color: '#064e3b', textAlign: 'right' },
  
  actionsRow: { flexDirection: 'row-reverse', justifyContent: 'flex-start', alignItems: 'center', gap: 10 },
  replyBtn: { flexDirection: 'row-reverse', backgroundColor: '#3b82f6', paddingVertical: 10, paddingHorizontal: 15, borderRadius: 8, alignItems: 'center', gap: 5 },
  replyBtnText: { color: '#ffffff', fontWeight: 'bold', fontSize: 13 },
  readBtn: { backgroundColor: '#f1f5f9', paddingVertical: 10, paddingHorizontal: 15, borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: '#cbd5e1' },
  readBtnText: { color: '#475569', fontWeight: 'bold', fontSize: 13 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { backgroundColor: '#ffffff', width: '100%', padding: 20, borderRadius: 16, elevation: 5 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#1e293b', textAlign: 'center', marginBottom: 5 },
  modalSubtitle: { fontSize: 13, color: '#64748b', textAlign: 'center', marginBottom: 15 },
  replyInput: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, padding: 15, minHeight: 100, textAlignVertical: 'top', color: '#1e293b', fontSize: 15, marginBottom: 20 },
  modalActions: { flexDirection: 'row-reverse', gap: 10 },
  modalSendBtn: { flex: 2, backgroundColor: '#10b981', paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
  modalSendBtnText: { color: '#ffffff', fontWeight: 'bold', fontSize: 15 },
  modalCancelBtn: { flex: 1, backgroundColor: '#fee2e2', paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
  modalCancelBtnText: { color: '#ef4444', fontWeight: 'bold', fontSize: 15 },
});