import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { collection, getDocs, limit, orderBy, query, startAfter } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { db } from '../firebase'; // تأكد من مسار قاعدة البيانات

// نوع البيانات الممكنة
type TabType = 'ratings' | 'complaints' | 'suggestions' | 'lost_items';

export default function AdminFeedback() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>('ratings');
  
  const [data, setData] = useState<any[]>([]);
  const [lastVisible, setLastVisible] = useState<any>(null); // عشان الـ Pagination
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  // تحميل البيانات بناءً على التبويب النشط
  const fetchData = async (isLoadMore = false) => {
    if (isLoadMore && !hasMore) return;
    
    if (isLoadMore) {
      setLoadingMore(true);
    } else {
      setLoading(true);
      setData([]);
    }

    try {
      let q;
      const collectionName = activeTab; // أسماء الكولكشنز في فايربيز

      if (isLoadMore && lastVisible) {
        // لو بنحمل المزيد، نبدأ من بعد آخر عنصر
        q = query(collection(db, collectionName), orderBy('timestamp', 'desc'), startAfter(lastVisible), limit(20));
      } else {
        // لو أول مرة، نجيب أحدث 20 بس
        q = query(collection(db, collectionName), orderBy('timestamp', 'desc'), limit(20));
      }

      const querySnapshot = await getDocs(q);
      
      const items = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // تحديث المؤشر لآخر عنصر للتحميل القادم
      const lastDoc = querySnapshot.docs[querySnapshot.docs.length - 1];
      setLastVisible(lastDoc);

      if (querySnapshot.docs.length < 20) {
        setHasMore(false); // مفيش بيانات تاني
      } else {
        setHasMore(true);
      }

      if (isLoadMore) {
        setData(prev => [...prev, ...items]);
      } else {
        setData(items);
      }

    } catch (error) {
      console.log("Error fetching data: ", error);
      Alert.alert('خطأ', 'حدثت مشكلة أثناء جلب البيانات.');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  // يتنفذ كل ما الأدمن يغير التبويب
  useEffect(() => {
    fetchData();
  }, [activeTab]);

  // تصميم شكل الكارت لكل نوع بيانات
  const renderItem = ({ item }: { item: any }) => {
    const date = item.timestamp ? new Date(item.timestamp).toLocaleString('ar-EG') : 'تاريخ غير معروف';

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.dateText}>{date}</Text>
          {activeTab === 'ratings' && (
            <View style={styles.ratingBadge}>
              <Text style={styles.ratingText}>⭐ {item.rating}</Text>
            </View>
          )}
        </View>

        <Text style={styles.senderText}>👤 المُرسل: {item.senderName || item.passengerName || item.captainName || 'غير مسجل'}</Text>
        
        {activeTab === 'ratings' ? (
          <>
            <Text style={styles.cardContent}>السبب: {item.reason || 'بدون تعليق'}</Text>
            <Text style={styles.cardSubContent}>نوع التقييم: {item.type === 'passenger_rating_captain' ? 'راكب يقييم كابتن' : 'كابتن يقييم راكب'}</Text>
          </>
        ) : activeTab === 'lost_items' ? (
          <>
            <Text style={styles.cardContent}>المفقودات: {item.itemName}</Text>
            <Text style={styles.cardSubContent}>التفاصيل: {item.details}</Text>
            <Text style={styles.cardSubContent}>رقم الرحلة: {item.rideId}</Text>
          </>
        ) : (
          <>
            <Text style={styles.cardContent}>النص: {item.message || item.text || item.complaint}</Text>
          </>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#1e293b" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>سجل الآراء والشكاوى</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* شريط التبويبات */}
      <View style={styles.tabsContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingHorizontal: 15, paddingVertical: 10 }}>
          {[
            { id: 'ratings', label: 'التقييمات ⭐' },
            { id: 'complaints', label: 'الشكاوى 😡' },
            { id: 'suggestions', label: 'الاقتراحات 💡' },
            { id: 'lost_items', label: 'المفقودات 🎒' }
          ].map(tab => (
            <TouchableOpacity
              key={tab.id}
              style={[styles.tabBtn, activeTab === tab.id && styles.tabBtnActive]}
              onPress={() => setActiveTab(tab.id as TabType)}
            >
              <Text style={[styles.tabText, activeTab === tab.id && styles.tabTextActive]}>{tab.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* قائمة البيانات */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#d97706" />
          <Text style={{ marginTop: 10, color: '#64748b' }}>جاري التحميل...</Text>
        </View>
      ) : data.length === 0 ? (
        <View style={styles.center}>
          <Text style={{ fontSize: 16, color: '#64748b' }}>لا توجد سجلات في هذا القسم حالياً.</Text>
        </View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 15, paddingBottom: 50 }}
          showsVerticalScrollIndicator={false}
          // التحميل التلقائي عند الوصول للنهاية
          onEndReached={() => {
            if (hasMore && !loadingMore) {
              fetchData(true);
            }
          }}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            loadingMore ? (
              <ActivityIndicator size="small" color="#d97706" style={{ marginVertical: 20 }} />
            ) : !hasMore ? (
              <Text style={styles.noMoreText}>لا يوجد المزيد من السجلات</Text>
            ) : null
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#ffffff', padding: 15, borderBottomWidth: 1, borderColor: '#e2e8f0', elevation: 2 },
  backBtn: { padding: 5 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#1e293b' },
  tabsContainer: { backgroundColor: '#ffffff', borderBottomWidth: 1, borderColor: '#e2e8f0' },
  tabBtn: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#cbd5e1' },
  tabBtnActive: { backgroundColor: '#fef3c7', borderColor: '#d97706' },
  tabText: { fontSize: 14, fontWeight: 'bold', color: '#64748b' },
  tabTextActive: { color: '#d97706' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card: { backgroundColor: '#ffffff', padding: 15, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: '#e2e8f0', elevation: 2 },
  cardHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  dateText: { fontSize: 12, color: '#94a3b8' },
  ratingBadge: { backgroundColor: '#fef3c7', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  ratingText: { fontSize: 13, fontWeight: 'bold', color: '#d97706' },
  senderText: { fontSize: 14, fontWeight: 'bold', color: '#1e293b', marginBottom: 6, textAlign: 'right' },
  cardContent: { fontSize: 15, color: '#334155', textAlign: 'right', marginBottom: 4, lineHeight: 22 },
  cardSubContent: { fontSize: 13, color: '#64748b', textAlign: 'right' },
  noMoreText: { textAlign: 'center', color: '#94a3b8', padding: 15, fontSize: 13 }
});