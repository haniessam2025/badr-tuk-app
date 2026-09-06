import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import { doc, getDoc } from 'firebase/firestore';
import React, { useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { db } from '../firebaseConfig';

export default function CaptainProfile() {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    React.useCallback(() => {
      fetchProfile();
    }, [])
  );

  const fetchProfile = async () => {
    try {
      const captainId = await AsyncStorage.getItem('currentCaptainId');
      if (!captainId) return;
      const docRef = doc(db, 'captains', captainId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) { setProfile(docSnap.data()); }
    } catch (error) {} finally { setLoading(false); }
  };

  const getSafeAvatar = (imgStr: any) => {
    if (!imgStr || typeof imgStr !== 'string' || imgStr.trim() === '') return 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png';
    return imgStr;
  };

  if (loading) return <View style={styles.centerContainer}><ActivityIndicator size="large" color="#2563eb" /></View>;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}><Text style={styles.backBtnText}>رجوع ⬅️</Text></TouchableOpacity>
        <Text style={styles.headerTitle}>الملف الشخصي 👤</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={styles.profileHeader}>
          <Image source={{ uri: getSafeAvatar(profile?.avatar || profile?.profileImage) }} style={styles.avatar} />
          <Text style={styles.nameText}>{profile?.name || 'كابتن'}</Text>
          <Text style={styles.phoneText}>{profile?.phone}</Text>
        </View>

        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.infoValue}>{profile?.vehicle || 'بديل توكتوك'}</Text>
              <Text style={{fontSize: 12, color: '#64748b', marginTop: 2}}>{profile?.vehicleCategory === 'car' ? '(سيارة)' : '(بديل توكتوك)'}</Text>
            </View>
            <View style={{flexDirection: 'row-reverse', alignItems: 'center'}}>
              <Text style={styles.infoLabel}>المركبة:</Text>
              <TouchableOpacity style={styles.editBtn} onPress={() => router.push('/captain-edit-vehicle')}>
                <Text style={styles.editBtnText}>تعديل ✏️</Text>
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoValue}>{profile?.walletBalance?.toFixed(2) || '0.00'} ج</Text>
            <Text style={styles.infoLabel}>رصيد المحفظة:</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>المستندات الرسمية 📄</Text>
        <View style={styles.docsContainer}>
          <View style={styles.docItem}>
            <Text style={styles.docTitle}>البطاقة (وجه)</Text>
            {profile?.idFront ? <Image source={{ uri: profile.idFront }} style={styles.docThumbnail} /> : <TouchableOpacity onPress={() => router.push('/captain-docs')}><Text style={styles.uploadNowBtn}>اضغط للرفع 📷</Text></TouchableOpacity>}
          </View>
          <View style={styles.docItem}>
            <Text style={styles.docTitle}>البطاقة (ظهر)</Text>
            {profile?.idBack ? <Image source={{ uri: profile.idBack }} style={styles.docThumbnail} /> : <TouchableOpacity onPress={() => router.push('/captain-docs')}><Text style={styles.uploadNowBtn}>اضغط للرفع 📷</Text></TouchableOpacity>}
          </View>
          <View style={styles.docItem}>
            <Text style={styles.docTitle}>المركبة</Text>
            {profile?.vehicleImage ? <Image source={{ uri: profile.vehicleImage }} style={styles.docThumbnail} /> : <TouchableOpacity onPress={() => router.push('/captain-docs')}><Text style={styles.uploadNowBtn}>اضغط للرفع 📷</Text></TouchableOpacity>}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9', padding: 15, paddingTop: 45 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#1e293b' },
  backBtn: { backgroundColor: '#e2e8f0', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8 },
  backBtnText: { color: '#334155', fontWeight: 'bold' },
  profileHeader: { alignItems: 'center', marginBottom: 25, backgroundColor: '#ffffff', padding: 25, borderRadius: 20, elevation: 2 },
  avatar: { width: 100, height: 100, borderRadius: 50, borderWidth: 3, borderColor: '#2563eb', marginBottom: 15 },
  nameText: { fontSize: 22, fontWeight: 'bold', color: '#1e293b', marginBottom: 5 },
  phoneText: { fontSize: 16, color: '#64748b', fontWeight: 'bold' },
  infoCard: { backgroundColor: '#ffffff', borderRadius: 16, padding: 20, marginBottom: 25, elevation: 2 },
  infoRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10 },
  divider: { height: 1, backgroundColor: '#e2e8f0' },
  infoLabel: { fontSize: 16, color: '#64748b', fontWeight: 'bold', marginLeft: 10 },
  infoValue: { fontSize: 16, color: '#1e293b', fontWeight: 'bold' },
  editBtn: { backgroundColor: '#fef3c7', paddingVertical: 4, paddingHorizontal: 8, borderRadius: 6, borderWidth: 1, borderColor: '#fde047' },
  editBtnText: { color: '#d97706', fontSize: 12, fontWeight: 'bold' },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#1e293b', textAlign: 'right', marginBottom: 15 },
  docsContainer: { flexDirection: 'row-reverse', justifyContent: 'space-between', backgroundColor: '#ffffff', padding: 15, borderRadius: 16, elevation: 2, marginBottom: 15 },
  docItem: { flex: 1, alignItems: 'center' },
  docTitle: { fontSize: 13, fontWeight: 'bold', color: '#475569', marginBottom: 10 },
  docThumbnail: { width: 90, height: 60, borderRadius: 8, resizeMode: 'cover', borderWidth: 1, borderColor: '#cbd5e1' },
  uploadNowBtn: { color: '#ffffff', fontSize: 12, fontWeight: 'bold', backgroundColor: '#2563eb', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, marginTop: 5, textAlign: 'center' }
});