import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Dimensions, FlatList, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { db } from '../firebaseConfig';

const { width } = Dimensions.get('window');

export default function AdminRidesHistory() {
  const [allRides, setAllRides] = useState<any[]>([]); 
  const [loading, setLoading] = useState(true);
  
  const [mainTab, setMainTab] = useState<'completed' | 'canceled'>('completed');
  const [isListModalVisible, setIsListModalVisible] = useState(false);
  const [activeFilterTitle, setActiveFilterTitle] = useState('الكل'); 

  const [filterDate, setFilterDate] = useState<string[]>([]);
  const [filterCaptain, setFilterCaptain] = useState<string[]>([]);
  const [filterPassenger, setFilterPassenger] = useState<string[]>([]);
  const [filterVehicle, setFilterVehicle] = useState<string[]>([]);

  const [isDropdownVisible, setIsDropdownVisible] = useState(false);
  const [dropdownType, setDropdownType] = useState<'date' | 'captain' | 'passenger' | 'vehicle' | null>(null);
  const [dropdownTitle, setDropdownTitle] = useState('');
  const [dropdownData, setDropdownData] = useState<string[]>([]);

  const fetchRides = useCallback(async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'rides'), orderBy('timestamp', 'desc'));
      const snapshot = await getDocs(q);
      
      let fetchedRides: any[] = [];

      snapshot.forEach((doc) => {
        const data = doc.data();
        let vType = data.requestedVehicleType;
        let tType = data.requestedTuktukType;

        if (vType === 'tuktuk_alt' && !tType) tType = 'كيوت 3 راكب';
        if (!vType) return; 

        fetchedRides.push({ id: doc.id, ...data, requestedVehicleType: vType, requestedTuktukType: tType });
      });

      setAllRides(fetchedRides);
    } catch (error) {
      console.log('Error fetching admin rides:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRides();
  }, [fetchRides]);

  const formatDateTime = (timestamp: any) => {
    if (!timestamp) return 'غير محدد';
    try {
      const date = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
      return date.toLocaleString('ar-EG', { dateStyle: 'medium', timeStyle: 'short' });
    } catch (e) { return 'تاريخ غير صالح'; }
  };
  
  const formatDateOnly = (timestamp: any) => {
    if (!timestamp) return 'غير محدد';
    try {
      const date = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
      return date.toLocaleDateString('ar-EG', { dateStyle: 'medium' });
    } catch (e) { return 'تاريخ غير صالح'; }
  };

  const getVehicleName = (ride: any) => {
    if (ride.requestedVehicleType === 'car') return 'سيارات';
    if (ride.requestedVehicleType === 'scooter') return 'سكوتر';
    if (ride.requestedVehicleType === 'tuktuk_alt') return ride.requestedTuktukType || 'بديل توكتوك';
    return 'غير محدد';
  };

  const targetRides = useMemo(() => {
    return allRides.filter(r => {
      if (mainTab === 'completed') return r.status === 'completed';
      return r.status === 'canceled' || r.status === 'cancelled_by_passenger' || r.status?.includes('cancel');
    });
  }, [allRides, mainTab]);

  const stats = useMemo(() => {
    let counts = { total: 0, totalRevenue: 0, car: 0, carRevenue: 0, cute: 0, cuteRevenue: 0, galaxy: 0, galaxyRevenue: 0, scooter: 0, scooterRevenue: 0 };
    
    targetRides.forEach(ride => {
      let ridePrice = parseFloat(ride.price) || 0;
      counts.total++; counts.totalRevenue += ridePrice;

      if (ride.requestedVehicleType === 'car') {
        counts.car++; counts.carRevenue += ridePrice;
      } else if (ride.requestedVehicleType === 'scooter') {
        counts.scooter++; counts.scooterRevenue += ridePrice;
      } else if (ride.requestedVehicleType === 'tuktuk_alt') {
        if (ride.requestedTuktukType === 'كيوت 3 راكب') {
          counts.cute++; counts.cuteRevenue += ridePrice;
        } else if (ride.requestedTuktukType === 'جالاكسي 7 راكب') {
          counts.galaxy++; counts.galaxyRevenue += ridePrice;
        }
      }
    });

    return counts;
  }, [targetRides]);

  // 👈 فلاتر ذكية مترابطة (Dynamic Cascading Lists)
  const availableDates = useMemo(() => {
    const filtered = targetRides.filter(r => {
      if (filterCaptain.length > 0 && !filterCaptain.includes(r.captainName)) return false;
      if (filterPassenger.length > 0 && !filterPassenger.includes(r.name)) return false;
      if (filterVehicle.length > 0 && !filterVehicle.includes(getVehicleName(r))) return false;
      return true;
    });
    return Array.from(new Set(filtered.filter(r => r.timestamp).map(r => formatDateOnly(r.timestamp))));
  }, [targetRides, filterCaptain, filterPassenger, filterVehicle]);

  const availableCaptains = useMemo(() => {
    const filtered = targetRides.filter(r => {
      if (filterDate.length > 0 && !filterDate.includes(formatDateOnly(r.timestamp))) return false;
      if (filterPassenger.length > 0 && !filterPassenger.includes(r.name)) return false;
      if (filterVehicle.length > 0 && !filterVehicle.includes(getVehicleName(r))) return false;
      return true;
    });
    return Array.from(new Set(filtered.filter(r => r.captainName).map(r => r.captainName)));
  }, [targetRides, filterDate, filterPassenger, filterVehicle]);

  const availablePassengers = useMemo(() => {
    const filtered = targetRides.filter(r => {
      if (filterDate.length > 0 && !filterDate.includes(formatDateOnly(r.timestamp))) return false;
      if (filterCaptain.length > 0 && !filterCaptain.includes(r.captainName)) return false;
      if (filterVehicle.length > 0 && !filterVehicle.includes(getVehicleName(r))) return false;
      return true;
    });
    return Array.from(new Set(filtered.filter(r => r.name).map(r => r.name)));
  }, [targetRides, filterDate, filterCaptain, filterVehicle]);

  const availableVehicles = useMemo(() => {
    const filtered = targetRides.filter(r => {
      if (filterDate.length > 0 && !filterDate.includes(formatDateOnly(r.timestamp))) return false;
      if (filterCaptain.length > 0 && !filterCaptain.includes(r.captainName)) return false;
      if (filterPassenger.length > 0 && !filterPassenger.includes(r.name)) return false;
      return true;
    });
    return Array.from(new Set(filtered.map(r => getVehicleName(r))));
  }, [targetRides, filterDate, filterCaptain, filterPassenger]);

  // 👈 قائمة الرحلات المفلترة النهائية اللي هتظهر في الشاشة
  const modalRides = useMemo(() => {
    return targetRides.filter(ride => {
      if (filterDate.length > 0 && !filterDate.includes(formatDateOnly(ride.timestamp))) return false;
      if (filterCaptain.length > 0 && !filterCaptain.includes(ride.captainName)) return false;
      if (filterPassenger.length > 0 && !filterPassenger.includes(ride.name)) return false;
      if (filterVehicle.length > 0 && !filterVehicle.includes(getVehicleName(ride))) return false;
      return true;
    });
  }, [targetRides, filterDate, filterCaptain, filterPassenger, filterVehicle]);


  const openListModal = (vehicleType: string) => {
    setActiveFilterTitle(vehicleType);
    if (vehicleType === 'الكل') setFilterVehicle([]);
    else setFilterVehicle([vehicleType]);
    
    setFilterDate([]);
    setFilterCaptain([]);
    setFilterPassenger([]);
    setIsListModalVisible(true);
  };

  const openCustomDropdown = (type: 'date' | 'captain' | 'passenger' | 'vehicle', title: string, data: string[]) => {
    setDropdownType(type);
    setDropdownTitle(title);
    setDropdownData(data);
    setIsDropdownVisible(true);
  };

  const handleSelectDropdown = (item: string) => {
    if (dropdownType === 'date') setFilterDate(prev => prev.includes(item) ? prev.filter(i => i !== item) : [...prev, item]);
    else if (dropdownType === 'captain') setFilterCaptain(prev => prev.includes(item) ? prev.filter(i => i !== item) : [...prev, item]);
    else if (dropdownType === 'passenger') setFilterPassenger(prev => prev.includes(item) ? prev.filter(i => i !== item) : [...prev, item]);
    else if (dropdownType === 'vehicle') setFilterVehicle(prev => prev.includes(item) ? prev.filter(i => i !== item) : [...prev, item]);
  };

  const clearFilters = () => {
    setFilterDate([]); setFilterCaptain([]); setFilterPassenger([]); setFilterVehicle([]);
    setActiveFilterTitle('الكل');
  };

  const isItemSelected = (item: string) => {
    if (dropdownType === 'date') return filterDate.includes(item);
    if (dropdownType === 'captain') return filterCaptain.includes(item);
    if (dropdownType === 'passenger') return filterPassenger.includes(item);
    if (dropdownType === 'vehicle') return filterVehicle.includes(item);
    return false;
  };

  const getChipText = (emoji: string, filterArray: string[], defaultText: string) => {
    if (filterArray.length === 0) return `${emoji} ${defaultText}`;
    if (filterArray.length === 1) return `${emoji} ${filterArray[0]}`;
    return `${emoji} ${defaultText} (${filterArray.length})`;
  };

  const renderRideCard = ({ item }: { item: any }) => {
    const dests = item.destinationsList || [item.destinationLocation];
    const isCompleted = item.status === 'completed';

    return (
      <View style={[styles.rideCard, !isCompleted && { borderColor: '#fecaca' }]}>
        <View style={styles.cardHeader}>
          <View style={[styles.badge, { backgroundColor: isCompleted ? '#d1fae5' : '#fee2e2' }]}>
            <Text style={[styles.badgeText, { color: isCompleted ? '#10b981' : '#ef4444' }]}>{isCompleted ? 'مكتملة' : 'ملغاة'}</Text>
          </View>
          <Text style={styles.dateText}>{formatDateTime(item.timestamp)}</Text>
        </View>

        <View style={styles.vehicleRow}>
          <Text style={styles.vehicleTypeLabel}>
            {item.requestedVehicleType === 'car' ? '🚗 سيارة' : 
             item.requestedVehicleType === 'scooter' ? '🛵 سكوتر' : 
             `🛺 بديل توكتوك (${item.requestedTuktukType || 'غير محدد'})`}
          </Text>
          <Text style={[styles.priceTag, !isCompleted && { color: '#64748b' }]}>{item.price ? `${item.price} جنيه` : '---'}</Text>
        </View>

        {item.requestedVehicleType === 'tuktuk_alt' && item.passengersCount && (
          <View style={styles.passengerCountBox}>
            <Text style={styles.passengerCountText}>👥 عدد الركاب الفعلي للرحلة: {item.passengersCount}</Text>
          </View>
        )}

        <View style={styles.divider} />

        <View style={styles.usersRow}>
          <View style={styles.userBox}>
            <Text style={styles.boxTitle}>الراكب 🧍‍♂️</Text>
            <Text style={styles.userName}>{item.name || 'غير متوفر'}</Text>
            <Text style={styles.userPhone}>{item.phone || '---'}</Text>
          </View>
          <View style={styles.userBox}>
            <Text style={styles.boxTitle}>الكابتن 🧑‍✈️</Text>
            <Text style={styles.userName}>{item.captainName || 'غير متوفر'}</Text>
            <Text style={styles.userPhone}>{item.captainPhone || '---'}</Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.routeContainer}>
          <Text style={styles.routeLabel}>📍 الانطلاق:</Text>
          <Text style={styles.routeValue}>{item.pickupLocation}</Text>
          <Text style={[styles.routeLabel, { marginTop: 8 }]}>🏁 الوجهات:</Text>
          {dests.map((d: string, index: number) => (
            <Text key={index} style={styles.routeValue}>- {d}</Text>
          ))}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.pageTitle}>📊 سجل إحصائيات الرحلات</Text>

      <View style={styles.mainTabsContainer}>
        <TouchableOpacity 
          style={[styles.mainTab, mainTab === 'completed' && styles.mainTabActive]} 
          onPress={() => { setMainTab('completed'); clearFilters(); }}
        >
          <Text style={[styles.mainTabText, mainTab === 'completed' && styles.mainTabTextActive]}>المكتملة ✅</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.mainTab, mainTab === 'canceled' && styles.mainTabActive]} 
          onPress={() => { setMainTab('canceled'); clearFilters(); }}
        >
          <Text style={[styles.mainTabText, mainTab === 'canceled' && styles.mainTabTextActive]}>الملغاة ❌</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={styles.loaderText}>جاري تحميل البيانات...</Text>
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            
            <TouchableOpacity style={[styles.statBox, { backgroundColor: '#1e293b' }]} onPress={() => openListModal('الكل')} activeOpacity={0.8}>
              <Text style={styles.statNumber}>{stats.total}</Text>
              <Text style={styles.statLabel}>إجمالي الرحلات ({mainTab === 'completed' ? 'المكتملة' : 'الملغاة'})</Text>
              <View style={styles.mainRevenueBadge}>
                <Text style={styles.mainRevenueText}>💰 {stats.totalRevenue.toFixed(0)} جنيه</Text>
              </View>
            </TouchableOpacity>

            <View style={styles.statsGrid}>
              <TouchableOpacity style={[styles.statSmallBox, { borderColor: '#cbd5e1' }]} onPress={() => openListModal('سيارات')} activeOpacity={0.7}>
                <Text style={[styles.statSmallNumber, { color: '#3b82f6' }]}>{stats.car}</Text>
                <Text style={styles.statSmallLabel}>سيارة 🚗</Text>
                <View style={styles.revenueBadge}><Text style={styles.revenueText}>{stats.carRevenue.toFixed(0)} ج</Text></View>
              </TouchableOpacity>
              
              <TouchableOpacity style={[styles.statSmallBox, { borderColor: '#cbd5e1' }]} onPress={() => openListModal('كيوت 3 راكب')} activeOpacity={0.7}>
                <Text style={[styles.statSmallNumber, { color: '#10b981' }]}>{stats.cute}</Text>
                <Text style={styles.statSmallLabel}>كيوت 3 🛺</Text>
                <View style={styles.revenueBadge}><Text style={styles.revenueText}>{stats.cuteRevenue.toFixed(0)} ج</Text></View>
              </TouchableOpacity>
              
              <TouchableOpacity style={[styles.statSmallBox, { borderColor: '#cbd5e1' }]} onPress={() => openListModal('جالاكسي 7 راكب')} activeOpacity={0.7}>
                <Text style={[styles.statSmallNumber, { color: '#f59e0b' }]}>{stats.galaxy}</Text>
                <Text style={styles.statSmallLabel}>جالاكسي 7 🛺</Text>
                <View style={styles.revenueBadge}><Text style={styles.revenueText}>{stats.galaxyRevenue.toFixed(0)} ج</Text></View>
              </TouchableOpacity>
              
              <TouchableOpacity style={[styles.statSmallBox, { borderColor: '#cbd5e1' }]} onPress={() => openListModal('سكوتر')} activeOpacity={0.7}>
                <Text style={[styles.statSmallNumber, { color: '#8b5cf6' }]}>{stats.scooter}</Text>
                <Text style={styles.statSmallLabel}>سكوتر 🛵</Text>
                <View style={styles.revenueBadge}><Text style={styles.revenueText}>{stats.scooterRevenue.toFixed(0)} ج</Text></View>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      )}

      {/* مودال القائمة المنسدلة للتحديد المتعدد */}
      <Modal visible={isDropdownVisible} transparent={true} animationType="fade">
        <View style={styles.dropdownOverlay}>
          <View style={styles.dropdownContent}>
            <Text style={styles.dropdownTitleText}>{dropdownTitle}</Text>
            <Text style={styles.multiSelectHint}>يمكنك اختيار أكثر من عنصر</Text>
            
            <FlatList 
              data={dropdownData}
              keyExtractor={(item, index) => index.toString()}
              renderItem={({item}) => {
                const selected = isItemSelected(item);
                return (
                  <TouchableOpacity style={[styles.dropdownItem, selected && styles.dropdownItemSelected]} onPress={() => handleSelectDropdown(item)}>
                    <Text style={[styles.dropdownItemText, selected && styles.dropdownItemTextSelected]}>{item}</Text>
                    {selected && <Text style={styles.checkMark}>✅</Text>}
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={<Text style={{textAlign: 'center', marginTop: 20, color: '#94a3b8'}}>لا توجد بيانات متاحة بناءً على الفلاتر الحالية.</Text>}
            />
            <TouchableOpacity style={styles.dropdownCloseBtn} onPress={() => setIsDropdownVisible(false)}>
              <Text style={styles.dropdownCloseBtnText}>إغلاق القائمة</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* مودال قائمة الرحلات */}
      <Modal visible={isListModalVisible} animationType="slide" onRequestClose={() => setIsListModalVisible(false)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setIsListModalVisible(false)}>
              <Text style={styles.closeBtnText}>رجوع ✖</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitleText}>سجل الرحلات ({mainTab === 'completed' ? 'المكتملة' : 'الملغاة'})</Text>
            <View style={{width: 50}} />
          </View>

          {/* شريط الفلاتر الأفقي */}
          <View style={styles.horizontalFiltersWrapper}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalFiltersScroll}>
              
              <TouchableOpacity 
                style={[styles.filterChip, filterDate.length > 0 && styles.filterChipActive]} 
                onPress={() => openCustomDropdown('date', 'اختر التاريخ', availableDates)}
                onLongPress={() => setFilterDate([])}
              >
                <Text style={[styles.filterChipText, filterDate.length > 0 && styles.filterChipTextActive]}>{getChipText('📅', filterDate, 'التاريخ')}</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.filterChip, filterCaptain.length > 0 && styles.filterChipActive]} 
                onPress={() => openCustomDropdown('captain', 'اختر الكابتن', availableCaptains)}
                onLongPress={() => setFilterCaptain([])}
              >
                <Text style={[styles.filterChipText, filterCaptain.length > 0 && styles.filterChipTextActive]}>{getChipText('🧑‍✈️', filterCaptain, 'الكابتن')}</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.filterChip, filterPassenger.length > 0 && styles.filterChipActive]} 
                onPress={() => openCustomDropdown('passenger', 'اختر الراكب', availablePassengers)}
                onLongPress={() => setFilterPassenger([])}
              >
                <Text style={[styles.filterChipText, filterPassenger.length > 0 && styles.filterChipTextActive]}>{getChipText('🧍‍♂️', filterPassenger, 'الراكب')}</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.filterChip, filterVehicle.length > 0 && styles.filterChipActive]} 
                onPress={() => openCustomDropdown('vehicle', 'اختر المركبة', availableVehicles)}
                onLongPress={() => setFilterVehicle([])}
              >
                <Text style={[styles.filterChipText, filterVehicle.length > 0 && styles.filterChipTextActive]}>{getChipText('🛺', filterVehicle, 'المركبة')}</Text>
              </TouchableOpacity>

            </ScrollView>

            {(filterDate.length > 0 || filterCaptain.length > 0 || filterPassenger.length > 0 || filterVehicle.length > 0) && (
              <View style={styles.clearFiltersRow}>
                <Text style={styles.activeFiltersCount}>إجمالي النتائج: {modalRides.length}</Text>
                <TouchableOpacity onPress={clearFilters} style={styles.clearBtnStyle}>
                  <Text style={styles.clearFilterText}>إلغاء الفلاتر ✖</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          <FlatList
            data={modalRides}
            keyExtractor={(item) => item.id}
            renderItem={renderRideCard}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <Text style={styles.emptyText}>لا توجد رحلات مطابقة للفلاتر المحددة.</Text>
            }
          />
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9', paddingTop: 50 },
  pageTitle: { fontSize: 22, fontWeight: 'bold', color: '#1e293b', textAlign: 'center', marginBottom: 15 },
  
  mainTabsContainer: { flexDirection: 'row-reverse', backgroundColor: '#e2e8f0', borderRadius: 12, marginHorizontal: 15, padding: 4, marginBottom: 20 },
  mainTab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 10 },
  mainTabActive: { backgroundColor: '#ffffff', elevation: 2 },
  mainTabText: { fontSize: 15, fontWeight: 'bold', color: '#64748b' },
  mainTabTextActive: { color: '#2563eb' },

  loaderContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loaderText: { marginTop: 10, color: '#64748b', fontSize: 16, fontWeight: 'bold' },
  
  scrollContent: { paddingHorizontal: 15, paddingBottom: 50 },
  
  statBox: { padding: 15, borderRadius: 16, alignItems: 'center', marginBottom: 15, elevation: 4, borderWidth: 2, borderColor: 'transparent' },
  statNumber: { fontSize: 36, fontWeight: 'bold', color: '#ffffff' },
  statLabel: { fontSize: 16, color: '#94a3b8', fontWeight: 'bold', marginBottom: 8 },
  mainRevenueBadge: { backgroundColor: '#064e3b', paddingHorizontal: 15, paddingVertical: 6, borderRadius: 10, borderWidth: 1, borderColor: '#34d399' },
  mainRevenueText: { fontSize: 18, color: '#34d399', fontWeight: 'bold' },
  
  statsGrid: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between' },
  statSmallBox: { width: (width - 40) / 2, backgroundColor: '#ffffff', padding: 12, borderRadius: 12, alignItems: 'center', borderWidth: 2, elevation: 2, marginBottom: 5 },
  statSmallNumber: { fontSize: 26, fontWeight: 'bold' },
  statSmallLabel: { fontSize: 14, color: '#475569', fontWeight: 'bold', marginTop: 4, marginBottom: 8 },
  revenueBadge: { backgroundColor: '#f1f5f9', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  revenueText: { color: '#334155', fontWeight: 'bold', fontSize: 13 },

  dropdownOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  dropdownContent: { width: '85%', backgroundColor: '#ffffff', borderRadius: 16, padding: 20, maxHeight: '75%' },
  dropdownTitleText: { fontSize: 18, fontWeight: 'bold', color: '#1e293b', textAlign: 'center', marginBottom: 5 },
  multiSelectHint: { fontSize: 12, color: '#64748b', textAlign: 'center', marginBottom: 15 },
  
  dropdownItem: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 15, paddingHorizontal: 10, borderBottomWidth: 1, borderColor: '#f1f5f9' },
  dropdownItemSelected: { backgroundColor: '#eff6ff', borderRadius: 8, borderColor: 'transparent' },
  dropdownItemText: { fontSize: 16, color: '#334155', textAlign: 'right', fontWeight: 'bold' },
  dropdownItemTextSelected: { color: '#2563eb' },
  checkMark: { fontSize: 16 },

  dropdownCloseBtn: { marginTop: 20, backgroundColor: '#1e293b', paddingVertical: 12, borderRadius: 10, alignItems: 'center', elevation: 2 },
  dropdownCloseBtnText: { color: '#ffffff', fontSize: 16, fontWeight: 'bold' },

  modalContainer: { flex: 1, backgroundColor: '#f1f5f9' },
  modalHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: 50, backgroundColor: '#1e293b' },
  modalTitleText: { color: '#f8fafc', fontSize: 18, fontWeight: 'bold', textAlign: 'center' },
  closeBtnText: { color: '#ef4444', fontSize: 15, fontWeight: 'bold' },

  horizontalFiltersWrapper: { backgroundColor: '#ffffff', borderBottomWidth: 1, borderColor: '#cbd5e1', paddingBottom: 10 },
  horizontalFiltersScroll: { flexDirection: 'row-reverse', paddingHorizontal: 15, paddingTop: 12, alignItems: 'center', gap: 8 },
  filterChip: { flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: '#f8fafc', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, borderWidth: 1, borderColor: '#cbd5e1', marginLeft: 8 },
  filterChipActive: { backgroundColor: '#2563eb', borderColor: '#2563eb', elevation: 2 },
  filterChipText: { fontSize: 13, fontWeight: 'bold', color: '#475569' },
  filterChipTextActive: { color: '#ffffff' },
  
  clearFiltersRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginTop: 10 },
  activeFiltersCount: { fontSize: 12, color: '#64748b', fontWeight: 'bold' },
  clearBtnStyle: { backgroundColor: '#fee2e2', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  clearFilterText: { fontSize: 12, color: '#ef4444', fontWeight: 'bold' },

  listContent: { paddingHorizontal: 15, paddingBottom: 40, paddingTop: 15 },
  emptyText: { textAlign: 'center', color: '#64748b', marginTop: 30, fontSize: 16, fontWeight: 'bold' },
  rideCard: { backgroundColor: '#ffffff', padding: 16, borderRadius: 16, marginBottom: 15, borderWidth: 1, borderColor: '#e2e8f0', elevation: 2 },
  cardHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  dateText: { color: '#64748b', fontSize: 13, fontWeight: 'bold' },
  badge: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 8 },
  badgeText: { fontSize: 12, fontWeight: 'bold' },
  vehicleRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, backgroundColor: '#f8fafc', padding: 10, borderRadius: 10 },
  vehicleTypeLabel: { fontSize: 15, fontWeight: 'bold', color: '#1e293b' },
  priceTag: { fontSize: 18, fontWeight: 'bold', color: '#10b981' },
  passengerCountBox: { backgroundColor: '#fef9c3', padding: 8, borderRadius: 8, marginBottom: 10, borderWidth: 1, borderColor: '#fde047' },
  passengerCountText: { color: '#a16207', fontSize: 13, fontWeight: 'bold', textAlign: 'right' },
  divider: { height: 1, backgroundColor: '#e2e8f0', marginVertical: 10 },
  usersRow: { flexDirection: 'row-reverse', justifyContent: 'space-between' },
  userBox: { flex: 1, paddingHorizontal: 5 },
  boxTitle: { fontSize: 12, color: '#94a3b8', fontWeight: 'bold', textAlign: 'right', marginBottom: 4 },
  userName: { fontSize: 14, fontWeight: 'bold', color: '#0f172a', textAlign: 'right', marginBottom: 2 },
  userPhone: { fontSize: 13, color: '#3b82f6', textAlign: 'right', fontWeight: 'bold' },
  routeContainer: { backgroundColor: '#f8fafc', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#f1f5f9' },
  routeLabel: { fontSize: 13, color: '#64748b', fontWeight: 'bold', textAlign: 'right', marginBottom: 4 },
  routeValue: { fontSize: 14, color: '#1e293b', fontWeight: 'bold', textAlign: 'right', lineHeight: 22 },
});