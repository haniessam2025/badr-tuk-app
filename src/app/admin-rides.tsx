import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Dimensions, FlatList, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { db } from '../firebaseConfig';

const { width } = Dimensions.get('window');

export default function AdminRidesHistory() {
  const [rides, setRides] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('الكل');

  // متغيرات للإحصائيات (بما فيها المبالغ المالية)
  const [stats, setStats] = useState({
    total: 0, totalRevenue: 0,
    car: 0, carRevenue: 0,
    cute: 0, cuteRevenue: 0,
    galaxy: 0, galaxyRevenue: 0,
    scooter: 0, scooterRevenue: 0
  });

  const fetchRides = useCallback(async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'rides'), orderBy('timestamp', 'desc'));
      const snapshot = await getDocs(q);
      
      let fetchedRides: any[] = [];
      let counts = { 
        total: 0, totalRevenue: 0, 
        car: 0, carRevenue: 0, 
        cute: 0, cuteRevenue: 0, 
        galaxy: 0, galaxyRevenue: 0, 
        scooter: 0, scooterRevenue: 0 
      };

      snapshot.forEach((doc) => {
        const data = doc.data();
        fetchedRides.push({ id: doc.id, ...data });

        // تجميع عدد الرحلات
        counts.total++;
        
        // تجميع المبالغ المالية (للرحلات المكتملة فقط)
        let ridePrice = 0;
        if (data.status === 'completed' && data.price) {
          ridePrice = parseFloat(data.price) || 0;
          counts.totalRevenue += ridePrice;
        }

        // تصنيف الأعداد والمبالغ حسب نوع المركبة
        if (data.requestedVehicleType === 'car') {
          counts.car++;
          counts.carRevenue += ridePrice;
        }
        else if (data.requestedVehicleType === 'scooter') {
          counts.scooter++;
          counts.scooterRevenue += ridePrice;
        }
        else if (data.requestedVehicleType === 'tuktuk_alt') {
          if (data.requestedTuktukType === 'كيوت 3 راكب') {
            counts.cute++;
            counts.cuteRevenue += ridePrice;
          }
          else if (data.requestedTuktukType === 'جالاكسي 7 راكب') {
            counts.galaxy++;
            counts.galaxyRevenue += ridePrice;
          }
        }
      });

      setRides(fetchedRides);
      setStats(counts);
    } catch (error) {
      console.log('Error fetching admin rides:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRides();
  }, [fetchRides]);

  // دالة فلترة الرحلات حسب الزرار المختار
  const filteredRides = rides.filter(ride => {
    if (activeFilter === 'الكل') return true;
    if (activeFilter === 'سيارات' && ride.requestedVehicleType === 'car') return true;
    if (activeFilter === 'سكوتر' && ride.requestedVehicleType === 'scooter') return true;
    if (activeFilter === 'كيوت 3 راكب' && ride.requestedVehicleType === 'tuktuk_alt' && ride.requestedTuktukType === 'كيوت 3 راكب') return true;
    if (activeFilter === 'جالاكسي 7 راكب' && ride.requestedVehicleType === 'tuktuk_alt' && ride.requestedTuktukType === 'جالاكسي 7 راكب') return true;
    return false;
  });

  // تنسيق التاريخ والوقت
  const formatDate = (timestamp: number) => {
    if (!timestamp) return 'غير محدد';
    const date = new Date(timestamp);
    return date.toLocaleString('ar-EG', { dateStyle: 'medium', timeStyle: 'short' });
  };

  // تنسيق حالة الرحلة
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed': return { text: 'مكتملة', color: '#10b981', bg: '#d1fae5' };
      case 'canceled': 
      case 'cancelled_by_passenger': return { text: 'ملغاة', color: '#ef4444', bg: '#fee2e2' };
      case 'pending': return { text: 'تبحث عن كابتن', color: '#f59e0b', bg: '#fef3c7' };
      default: return { text: 'جارية', color: '#3b82f6', bg: '#dbeafe' };
    }
  };

  const renderRideCard = ({ item }: { item: any }) => {
    const statusBadge = getStatusBadge(item.status);
    const dests = item.destinationsList || [item.destinationLocation];

    return (
      <View style={styles.rideCard}>
        <View style={styles.cardHeader}>
          <View style={[styles.badge, { backgroundColor: statusBadge.bg }]}>
            <Text style={[styles.badgeText, { color: statusBadge.color }]}>{statusBadge.text}</Text>
          </View>
          <Text style={styles.dateText}>{formatDate(item.timestamp)}</Text>
        </View>

        <View style={styles.vehicleRow}>
          <Text style={styles.vehicleTypeLabel}>
            {item.requestedVehicleType === 'car' ? '🚗 سيارة' : 
             item.requestedVehicleType === 'scooter' ? '🛵 سكوتر' : 
             `🛺 بديل توكتوك (${item.requestedTuktukType || 'غير محدد'})`}
          </Text>
          <Text style={styles.priceTag}>{item.price ? `${item.price} جنيه` : '---'}</Text>
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
            <Text style={styles.userName}>{item.captainName || 'لم يتم القبول بعد'}</Text>
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
      <Text style={styles.pageTitle}>📊 سجل وإحصائيات الرحلات</Text>

      {loading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={styles.loaderText}>جاري تحميل البيانات...</Text>
        </View>
      ) : (
        <>
          {/* كروت الإحصائيات السريعة */}
          <View style={styles.statsContainer}>
            <View style={[styles.statBox, { backgroundColor: '#1e293b' }]}>
              <Text style={styles.statNumber}>{stats.total}</Text>
              <Text style={styles.statLabel}>إجمالي الرحلات</Text>
              {/* إجمالي المبالغ */}
              <Text style={styles.statTotalRevenue}>💰 {stats.totalRevenue.toFixed(0)} جنيه</Text>
            </View>
            <View style={styles.statsGrid}>
              
              <View style={[styles.statSmallBox, { borderColor: '#3b82f6' }]}>
                <Text style={[styles.statSmallNumber, { color: '#3b82f6' }]}>{stats.car}</Text>
                <Text style={styles.statSmallLabel}>سيارة 🚗</Text>
                <View style={styles.revenueBadge}><Text style={styles.revenueText}>{stats.carRevenue.toFixed(0)} ج</Text></View>
              </View>
              
              <View style={[styles.statSmallBox, { borderColor: '#10b981' }]}>
                <Text style={[styles.statSmallNumber, { color: '#10b981' }]}>{stats.cute}</Text>
                <Text style={styles.statSmallLabel}>كيوت 3 🛺</Text>
                <View style={styles.revenueBadge}><Text style={styles.revenueText}>{stats.cuteRevenue.toFixed(0)} ج</Text></View>
              </View>
              
              <View style={[styles.statSmallBox, { borderColor: '#f59e0b' }]}>
                <Text style={[styles.statSmallNumber, { color: '#f59e0b' }]}>{stats.galaxy}</Text>
                <Text style={styles.statSmallLabel}>جالاكسي 7 🛺</Text>
                <View style={styles.revenueBadge}><Text style={styles.revenueText}>{stats.galaxyRevenue.toFixed(0)} ج</Text></View>
              </View>
              
              <View style={[styles.statSmallBox, { borderColor: '#8b5cf6' }]}>
                <Text style={[styles.statSmallNumber, { color: '#8b5cf6' }]}>{stats.scooter}</Text>
                <Text style={styles.statSmallLabel}>سكوتر 🛵</Text>
                <View style={styles.revenueBadge}><Text style={styles.revenueText}>{stats.scooterRevenue.toFixed(0)} ج</Text></View>
              </View>

            </View>
          </View>

          {/* فلاتر تصنيف الرحلات */}
          <View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersScroll}>
              {['الكل', 'سيارات', 'كيوت 3 راكب', 'جالاكسي 7 راكب', 'سكوتر'].map((filter) => (
                <TouchableOpacity 
                  key={filter} 
                  style={[styles.filterBtn, activeFilter === filter && styles.filterBtnActive]}
                  onPress={() => setActiveFilter(filter)}
                >
                  <Text style={[styles.filterBtnText, activeFilter === filter && styles.filterBtnTextActive]}>{filter}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* قائمة الرحلات */}
          <FlatList
            data={filteredRides}
            keyExtractor={(item) => item.id}
            renderItem={renderRideCard}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <Text style={styles.emptyText}>لا توجد رحلات مسجلة في هذا التصنيف حالياً.</Text>
            }
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9', paddingTop: 50 },
  pageTitle: { fontSize: 22, fontWeight: 'bold', color: '#1e293b', textAlign: 'center', marginBottom: 15 },
  loaderContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loaderText: { marginTop: 10, color: '#64748b', fontSize: 16, fontWeight: 'bold' },
  
  // Stats Styles
  statsContainer: { paddingHorizontal: 15, marginBottom: 15 },
  statBox: { padding: 15, borderRadius: 16, alignItems: 'center', marginBottom: 10, elevation: 4 },
  statNumber: { fontSize: 32, fontWeight: 'bold', color: '#ffffff' },
  statLabel: { fontSize: 16, color: '#94a3b8', fontWeight: 'bold' },
  statTotalRevenue: { fontSize: 18, color: '#10b981', fontWeight: 'bold', marginTop: 8, backgroundColor: '#0f172a', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 8 },
  
  statsGrid: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between' },
  statSmallBox: { width: (width - 40) / 2, backgroundColor: '#ffffff', padding: 12, borderRadius: 12, alignItems: 'center', borderWidth: 1, elevation: 1 },
  statSmallNumber: { fontSize: 22, fontWeight: 'bold' },
  statSmallLabel: { fontSize: 13, color: '#475569', fontWeight: 'bold', marginTop: 4, marginBottom: 6 },
  revenueBadge: { backgroundColor: '#ecfdf5', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: '#a7f3d0' },
  revenueText: { color: '#059669', fontWeight: 'bold', fontSize: 12 },

  // Filters Styles
  filtersScroll: { paddingHorizontal: 15, flexDirection: 'row-reverse', paddingBottom: 10 },
  filterBtn: { backgroundColor: '#e2e8f0', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, marginLeft: 8 },
  filterBtnActive: { backgroundColor: '#2563eb' },
  filterBtnText: { color: '#475569', fontWeight: 'bold', fontSize: 14 },
  filterBtnTextActive: { color: '#ffffff' },

  // List & Cards Styles
  listContent: { paddingHorizontal: 15, paddingBottom: 40 },
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