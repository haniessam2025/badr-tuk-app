import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { db } from '../firebaseConfig';

export default function CaptainWallet() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [captainId, setCaptainId] = useState('');
  const [balance, setBalance] = useState(0);

  const [isPaymentModalVisible, setPaymentModalVisible] = useState(false);
  const [rechargeAmount, setRechargeAmount] = useState('');
  const [selectedMethod, setSelectedMethod] = useState(''); 
  const [paymentDetails, setPaymentDetails] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    loadWalletData();
  }, []);

  const loadWalletData = async () => {
    try {
      const id = await AsyncStorage.getItem('currentCaptainId');
      if (id) {
        setCaptainId(id);
        const docRef = doc(db, 'captains', id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setBalance(docSnap.data().walletBalance || 0);
        }
      }
    } catch (error) {
      console.log('Error loading wallet:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRechargeClick = () => {
    setRechargeAmount('');
    setSelectedMethod('');
    setPaymentDetails('');
    setPaymentModalVisible(true);
  };

  const processPayment = async () => {
    const amount = parseFloat(rechargeAmount);
    if (!amount || amount <= 0) {
      Alert.alert('تنبيه', 'برجاء إدخال مبلغ صحيح للشحن.');
      return;
    }
    if (!selectedMethod) {
      Alert.alert('تنبيه', 'برجاء اختيار طريقة الدفع.');
      return;
    }
    if (!paymentDetails.trim()) {
      Alert.alert('تنبيه', 'برجاء إدخال بيانات الدفع المطلوبة.');
      return;
    }

    setIsProcessing(true);

    // محاكاة الاتصال ببوابة الدفع (API Call Mock)
    setTimeout(async () => {
      try {
        const newBalance = balance + amount;
        
        // 1. تحديث في Firebase
        await updateDoc(doc(db, 'captains', captainId), {
          walletBalance: newBalance
        });

        // 2. تحديث التخزين المحلي
        const localProfile = await AsyncStorage.getItem('captain_profile');
        if (localProfile) {
          const parsed = JSON.parse(localProfile);
          parsed.walletBalance = newBalance;
          await AsyncStorage.setItem('captain_profile', JSON.stringify(parsed));
        }

        // 3. تحديث الشاشة الحالية
        setBalance(newBalance);
        setIsProcessing(false);
        setPaymentModalVisible(false);

        Alert.alert('نجاح ✅', `تم شحن محفظتك بمبلغ ${amount} جنيه بنجاح.`);
      } catch (error) {
        setIsProcessing(false);
        Alert.alert('خطأ', 'حدثت مشكلة أثناء الشحن، حاول مرة أخرى.');
      }
    }, 2000); 
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#eab308" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>◀ رجوع</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>المحفظة</Text>
        <View style={{ width: 60 }} />
      </View>

      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>الرصيد الحالي</Text>
        <Text style={styles.balanceAmount}>{balance.toFixed(2)} <Text style={styles.currency}>EGP</Text></Text>
      </View>

      <TouchableOpacity style={styles.rechargeBtnBig} onPress={handleRechargeClick}>
        <Text style={styles.rechargeBtnBigText}>➕ شحن الرصيد</Text>
      </TouchableOpacity>

      <Text style={styles.infoText}>
        شحن محفظتك يضمن استمرار حسابك قيد التشغيل وقدرتك على استقبال طلبات جديدة بدون توقف.
      </Text>

      <Modal visible={isPaymentModalVisible} transparent={true} animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
          <View style={styles.paymentModalContent}>
            
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>إيداع في المحفظة</Text>
              <TouchableOpacity onPress={() => setPaymentModalVisible(false)}>
                <Text style={styles.closeModalText}>إغلاق ❌</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
              
              <Text style={styles.sectionLabel}>المبلغ المراد شحنه (جنيه)</Text>
              <TextInput
                style={styles.amountInput}
                placeholder="0.00"
                placeholderTextColor="#94a3b8"
                keyboardType="numeric"
                value={rechargeAmount}
                onChangeText={setRechargeAmount}
                textAlign="center"
              />

              <View style={styles.quickAmounts}>
                {[50, 100, 200, 500].map(val => (
                  <TouchableOpacity key={val} style={styles.quickBtn} onPress={() => setRechargeAmount(val.toString())}>
                    <Text style={styles.quickBtnText}>+{val}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.sectionLabel}>اختر طريقة الدفع</Text>
              
              <TouchableOpacity 
                style={[styles.methodCard, selectedMethod === 'vodafone' && styles.methodCardActive]} 
                onPress={() => { setSelectedMethod('vodafone'); setPaymentDetails(''); }}
              >
                <Text style={styles.methodIcon}>🔴</Text>
                <Text style={styles.methodName}>فودافون كاش / محافظ إلكترونية</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.methodCard, selectedMethod === 'instapay' && styles.methodCardActive]} 
                onPress={() => { setSelectedMethod('instapay'); setPaymentDetails(''); }}
              >
                <Text style={styles.methodIcon}>⚡</Text>
                <Text style={styles.methodName}>إنستاباي (InstaPay)</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.methodCard, selectedMethod === 'card' && styles.methodCardActive]} 
                onPress={() => { setSelectedMethod('card'); setPaymentDetails(''); }}
              >
                <Text style={styles.methodIcon}>💳</Text>
                <Text style={styles.methodName}>بطاقة بنكية (فيزا / ميزة)</Text>
              </TouchableOpacity>

              {selectedMethod === 'vodafone' && (
                <View style={styles.detailsContainer}>
                  <Text style={styles.detailsLabel}>رقم المحفظة (المرسل منه)</Text>
                  <TextInput style={styles.detailsInput} placeholder="010xxxxxxx" keyboardType="phone-pad" value={paymentDetails} onChangeText={setPaymentDetails} textAlign="right" />
                </View>
              )}

              {selectedMethod === 'instapay' && (
                <View style={styles.detailsContainer}>
                  <Text style={styles.detailsLabel}>عنوان الدفع اللحظي (IPA) أو رقم الهاتف</Text>
                  <TextInput style={styles.detailsInput} placeholder="name@instapay" value={paymentDetails} onChangeText={setPaymentDetails} textAlign="right" autoCapitalize="none" />
                </View>
              )}

              {selectedMethod === 'card' && (
                <View style={styles.detailsContainer}>
                  <Text style={styles.detailsLabel}>رقم البطاقة المكون من 16 رقم</Text>
                  <TextInput style={styles.detailsInput} placeholder="XXXX XXXX XXXX XXXX" keyboardType="number-pad" value={paymentDetails} onChangeText={setPaymentDetails} textAlign="right" maxLength={16} />
                </View>
              )}

              <TouchableOpacity 
                style={[styles.confirmBtn, (!rechargeAmount || !selectedMethod) && { backgroundColor: '#cbd5e1' }]} 
                onPress={processPayment}
                disabled={isProcessing || !rechargeAmount || !selectedMethod}
              >
                {isProcessing ? (
                  <ActivityIndicator color="#000" />
                ) : (
                  <Text style={styles.confirmBtnText}>
                    تأكيد الدفع ({rechargeAmount || '0'} ج)
                  </Text>
                )}
              </TouchableOpacity>

              <Text style={styles.secureText}>🔒 مدفوعاتك مشفرة ومؤمنة بالكامل</Text>
            
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc', padding: 15, paddingTop: 40 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  
  header: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30 },
  backBtn: { padding: 10, backgroundColor: '#ffffff', borderRadius: 10, elevation: 1 },
  backBtnText: { color: '#334155', fontWeight: 'bold' },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#1e293b' },
  
  balanceCard: { backgroundColor: '#1e293b', borderRadius: 20, padding: 30, alignItems: 'center', marginBottom: 30, elevation: 5, shadowColor: '#eab308', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 5 },
  balanceLabel: { color: '#cbd5e1', fontSize: 16, marginBottom: 10, fontWeight: 'bold' },
  balanceAmount: { color: '#eab308', fontSize: 45, fontWeight: 'bold' },
  currency: { fontSize: 20, color: '#fef08a' },
  
  rechargeBtnBig: { backgroundColor: '#eab308', paddingVertical: 18, borderRadius: 15, alignItems: 'center', elevation: 3 },
  rechargeBtnBigText: { color: '#000000', fontSize: 18, fontWeight: 'bold' },
  
  infoText: { textAlign: 'center', color: '#64748b', marginTop: 20, fontSize: 14, lineHeight: 22, paddingHorizontal: 10 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  paymentModalContent: { backgroundColor: '#ffffff', borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 25, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#1e293b' },
  closeModalText: { fontSize: 15, color: '#ef4444', fontWeight: 'bold' },
  
  sectionLabel: { fontSize: 15, fontWeight: 'bold', color: '#334155', marginBottom: 10, textAlign: 'right', marginTop: 15 },
  amountInput: { backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 15, padding: 15, fontSize: 28, fontWeight: 'bold', color: '#0f172a' },
  
  quickAmounts: { flexDirection: 'row-reverse', justifyContent: 'space-between', marginTop: 10, marginBottom: 10 },
  quickBtn: { flex: 1, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', paddingVertical: 10, marginHorizontal: 4, borderRadius: 10, alignItems: 'center' },
  quickBtnText: { fontSize: 16, fontWeight: 'bold', color: '#2563eb' },
  
  methodCard: { flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', padding: 16, borderRadius: 15, marginBottom: 10 },
  methodCardActive: { borderColor: '#eab308', backgroundColor: '#fefce8', borderWidth: 2 },
  methodIcon: { fontSize: 24, marginLeft: 15 },
  methodName: { fontSize: 16, fontWeight: 'bold', color: '#1e293b' },
  
  detailsContainer: { backgroundColor: '#f1f5f9', padding: 15, borderRadius: 12, marginTop: 5, marginBottom: 10, borderWidth: 1, borderColor: '#cbd5e1' },
  detailsLabel: { fontSize: 13, color: '#64748b', marginBottom: 8, textAlign: 'right', fontWeight: 'bold' },
  detailsInput: { backgroundColor: '#ffffff', borderRadius: 8, padding: 10, fontSize: 15, color: '#0f172a', borderWidth: 1, borderColor: '#e2e8f0' },
  
  confirmBtn: { backgroundColor: '#eab308', paddingVertical: 16, borderRadius: 15, alignItems: 'center', marginTop: 20 },
  confirmBtnText: { color: '#000000', fontSize: 18, fontWeight: 'bold' },
  
  secureText: { textAlign: 'center', color: '#10b981', marginTop: 15, fontSize: 13, fontWeight: 'bold' }
});