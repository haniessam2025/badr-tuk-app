import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { addDoc, collection, doc, getDoc, serverTimestamp } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { db } from '../firebaseConfig';

export default function CaptainWallet() {
  const router = useRouter();
  const [balance, setBalance] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [captainId, setCaptainId] = useState('');
  const [captainName, setCaptainName] = useState('');

  // متغيرات المودال
  const [isDepositModalVisible, setIsDepositModalVisible] = useState(false);
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'vodafone' | 'instapay' | 'bank_card' | null>(null);
  const [processing, setProcessing] = useState(false);

  // بيانات البطاقة البنكية
  const [cardNumber, setCardNumber] = useState('');
  const [cardHolder, setCardHolder] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');
  
  // بيانات المحافظ الإلكترونية
  const [walletNumber, setWalletNumber] = useState('');
  const [instapayAddress, setInstapayAddress] = useState('');

  useEffect(() => {
    fetchWalletData();
  }, []);

  const fetchWalletData = async () => {
    try {
      const id = await AsyncStorage.getItem('currentCaptainId');
      if (!id) return;
      setCaptainId(id);

      const docRef = doc(db, 'captains', id);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        setBalance(data.walletBalance || 0);
        setCaptainName(data.name || 'كابتن');
      }
    } catch (error) {
      console.log('Error fetching wallet:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDeposit = () => {
    setIsDepositModalVisible(true);
    setAmount('');
    setPaymentMethod(null);
  };

  const handleCloseDeposit = () => {
    setIsDepositModalVisible(false);
    setAmount('');
    setPaymentMethod(null);
    setCardNumber(''); setCardHolder(''); setExpiry(''); setCvv('');
    setWalletNumber(''); setInstapayAddress('');
  };

  const submitTransaction = async () => {
    const valAmount = parseFloat(amount);
    if (!valAmount || valAmount <= 0) {
      Alert.alert('تنبيه', 'برجاء إدخال مبلغ صحيح.');
      return;
    }

    if (!paymentMethod) {
      Alert.alert('تنبيه', 'برجاء اختيار وسيلة الدفع.');
      return;
    }

    // التحقق من الحقول حسب وسيلة الدفع
    if (paymentMethod === 'vodafone' && !walletNumber) { Alert.alert('تنبيه', 'برجاء إدخال رقم المحفظة المحول منها.'); return; }
    if (paymentMethod === 'instapay' && !instapayAddress) { Alert.alert('تنبيه', 'برجاء إدخال عنوان إنستاباي المحول منه.'); return; }
    if (paymentMethod === 'bank_card' && (!cardNumber || !expiry || !cvv || !cardHolder)) { Alert.alert('تنبيه', 'برجاء إكمال بيانات البطاقة البنكية.'); return; }

    setProcessing(true);
    try {
      // إرسال طلب للإدارة ليتعاملوا معه
      let methodDetails = {};
      if (paymentMethod === 'vodafone') methodDetails = { phone: walletNumber };
      else if (paymentMethod === 'instapay') methodDetails = { address: instapayAddress };
      else if (paymentMethod === 'bank_card') methodDetails = { card: `**** **** **** ${cardNumber.slice(-4)}`, name: cardHolder };

      await addDoc(collection(db, 'wallet_requests'), {
        captainId,
        captainName,
        type: 'deposit', // شحن فقط
        amount: valAmount,
        method: paymentMethod,
        methodDetails,
        status: 'pending',
        timestamp: serverTimestamp()
      });

      Alert.alert('نجاح ✅', 'تم إرسال طلب الشحن. سيتم مراجعة الدفع وإضافة الرصيد لمحفظتك في أسرع وقت.');
      handleCloseDeposit();
    } catch (error) {
      Alert.alert('خطأ', 'حدثت مشكلة أثناء إرسال الطلب.');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}><Text style={styles.backBtnText}>رجوع ⬅️</Text></TouchableOpacity>
        <Text style={styles.headerTitle}>المحفظة 💰</Text>
      </View>

      {loading ? (
        <View style={styles.centerContainer}><ActivityIndicator size="large" color="#2563eb" /></View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
          
          <View style={styles.balanceCard}>
            <Text style={styles.balanceLabel}>الرصيد الحالي</Text>
            <Text style={[styles.balanceAmount, balance <= 0 && { color: '#ef4444' }]}>{balance.toFixed(2)} ج</Text>
            {balance <= 0 && <Text style={styles.debtAlert}>رصيدك غير كافٍ، يرجى الشحن لتتمكن من استقبال الطلبات.</Text>}
          </View>

          <View style={styles.actionsRow}>
            <TouchableOpacity style={styles.actionBtnDeposit} onPress={handleOpenDeposit}>
              <Text style={styles.actionBtnText}>شحن المحفظة 💳</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.infoBox}>
            <Text style={styles.infoTitle}>كيف تعمل المحفظة؟ ℹ️</Text>
            <Text style={styles.infoText}>• الراكب يقوم بدفع تكلفة الرحلة لك <Text style={{fontWeight: 'bold'}}>نقداً (كاش)</Text> بالكامل عند الوصول.</Text>
            <Text style={styles.infoText}>• يتم خصم <Text style={{fontWeight: 'bold'}}>عمولة التطبيق</Text> تلقائياً من رصيد هذه المحفظة بعد إكمال كل رحلة.</Text>
            <Text style={styles.infoText}>• يجب إبقاء محفظتك مشحونة برصيد إيجابي لتتمكن من الاستمرار في استقبال الطلبات الجديدة.</Text>
          </View>

        </ScrollView>
      )}

      {/* نافذة شحن المحفظة */}
      <Modal visible={isDepositModalVisible} transparent={true} animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={styles.modalScrollCenter} keyboardShouldPersistTaps="handled">
            <View style={styles.modalContent}>
              
              <Text style={styles.modalTitle}>شحن المحفظة</Text>
              
              <Text style={styles.inputLabel}>المبلغ المراد شحنه (جنيه)</Text>
              <TextInput style={styles.input} keyboardType="numeric" placeholder="مثال: 100" placeholderTextColor="#94a3b8" value={amount} onChangeText={setAmount} textAlign="right" />

              <Text style={styles.inputLabel}>اختر وسيلة الدفع:</Text>
              <View style={styles.methodsRow}>
                <TouchableOpacity style={[styles.methodBtn, paymentMethod === 'vodafone' && styles.methodBtnActive]} onPress={() => setPaymentMethod('vodafone')}>
                  <Text style={[styles.methodText, paymentMethod === 'vodafone' && styles.methodTextActive]}>كاش📱</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.methodBtn, paymentMethod === 'instapay' && styles.methodBtnActive]} onPress={() => setPaymentMethod('instapay')}>
                  <Text style={[styles.methodText, paymentMethod === 'instapay' && styles.methodTextActive]}>إنستاباي⚡</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.methodBtn, paymentMethod === 'bank_card' && styles.methodBtnActive]} onPress={() => setPaymentMethod('bank_card')}>
                  <Text style={[styles.methodText, paymentMethod === 'bank_card' && styles.methodTextActive]}>بطاقة بنكية💳</Text>
                </TouchableOpacity>
              </View>

              {/* تفاصيل المحافظ */}
              {paymentMethod === 'vodafone' && (
                <View style={styles.detailsBox}>
                  <Text style={styles.instructionText}>قم بتحويل المبلغ لرقم التطبيق، ثم أدخل رقمك الذي حولت منه:</Text>
                  <TextInput style={styles.input} keyboardType="phone-pad" placeholder="رقم الموبايل المحول منه" placeholderTextColor="#94a3b8" value={walletNumber} onChangeText={setWalletNumber} textAlign="right" />
                </View>
              )}

              {paymentMethod === 'instapay' && (
                <View style={styles.detailsBox}>
                  <Text style={styles.instructionText}>قم بالتحويل لحساب التطبيق على إنستاباي، ثم أدخل عنوانك:</Text>
                  <TextInput style={styles.input} placeholder="عنوان إنستاباي الخاص بك (IPA)" placeholderTextColor="#94a3b8" value={instapayAddress} onChangeText={setInstapayAddress} textAlign="right" />
                </View>
              )}

              {/* تفاصيل البطاقة البنكية */}
              {paymentMethod === 'bank_card' && (
                <View style={styles.detailsBox}>
                  <Text style={styles.bankCardHeader}>بيانات البطاقة (فيزا / ماستركارد)</Text>
                  <TextInput style={styles.input} placeholder="الاسم على البطاقة" placeholderTextColor="#94a3b8" value={cardHolder} onChangeText={setCardHolder} textAlign="right" />
                  <TextInput style={styles.input} keyboardType="numeric" placeholder="رقم البطاقة (16 رقم)" placeholderTextColor="#94a3b8" maxLength={16} value={cardNumber} onChangeText={setCardNumber} textAlign="right" />
                  
                  <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between' }}>
                    <TextInput style={[styles.input, { flex: 1, marginLeft: 10 }]} placeholder="تاريخ الانتهاء MM/YY" placeholderTextColor="#94a3b8" maxLength={5} value={expiry} onChangeText={setExpiry} textAlign="center" />
                    <TextInput style={[styles.input, { flex: 1 }]} keyboardType="numeric" placeholder="رمز الـ CVV" placeholderTextColor="#94a3b8" maxLength={3} value={cvv} onChangeText={setCvv} textAlign="center" secureTextEntry={true} />
                  </View>
                </View>
              )}

              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.confirmBtn} onPress={submitTransaction} disabled={processing}>
                  {processing ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.confirmBtnText}>تأكيد الشحن</Text>}
                </TouchableOpacity>
                <TouchableOpacity style={styles.cancelBtn} onPress={handleCloseDeposit}>
                  <Text style={styles.cancelBtnText}>إلغاء</Text>
                </TouchableOpacity>
              </View>

            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9', padding: 15, paddingTop: 45 },
  header: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#1e293b' },
  backBtn: { backgroundColor: '#e2e8f0', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8 },
  backBtnText: { color: '#334155', fontWeight: 'bold' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  
  balanceCard: { backgroundColor: '#1e293b', borderRadius: 20, padding: 30, alignItems: 'center', marginBottom: 20, elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 5 },
  balanceLabel: { fontSize: 16, color: '#cbd5e1', marginBottom: 10, fontWeight: 'bold' },
  balanceAmount: { fontSize: 45, fontWeight: 'bold', color: '#2563eb' },
  debtAlert: { marginTop: 10, color: '#fca5a5', fontSize: 13, backgroundColor: 'rgba(239,68,68,0.2)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, textAlign: 'center' },

  actionsRow: { marginBottom: 25 },
  actionBtnDeposit: { backgroundColor: '#2563eb', paddingVertical: 16, borderRadius: 14, alignItems: 'center', elevation: 2 },
  actionBtnText: { color: '#ffffff', fontSize: 18, fontWeight: 'bold' },

  infoBox: { backgroundColor: '#e0f2fe', padding: 20, borderRadius: 16, borderWidth: 1, borderColor: '#bae6fd' },
  infoTitle: { fontSize: 16, fontWeight: 'bold', color: '#0369a1', marginBottom: 12, textAlign: 'right' },
  infoText: { fontSize: 14, color: '#0f172a', textAlign: 'right', marginBottom: 8, lineHeight: 22 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  modalScrollCenter: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { backgroundColor: '#ffffff', width: '100%', borderRadius: 20, padding: 25, elevation: 10 },
  modalTitle: { fontSize: 22, fontWeight: 'bold', color: '#1e293b', textAlign: 'center', marginBottom: 20 },
  
  inputLabel: { fontSize: 15, fontWeight: 'bold', color: '#475569', textAlign: 'right', marginBottom: 8, marginTop: 10 },
  input: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 12, padding: 14, fontSize: 15, color: '#0f172a', marginBottom: 10 },
  
  methodsRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 15, gap: 8 },
  methodBtn: { flex: 1, backgroundColor: '#f1f5f9', paddingVertical: 12, borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: '#cbd5e1' },
  methodBtnActive: { backgroundColor: '#d97706', borderColor: '#d97706' },
  methodText: { fontSize: 13, fontWeight: 'bold', color: '#475569' },
  methodTextActive: { color: '#ffffff' },

  detailsBox: { backgroundColor: '#f1f5f9', padding: 15, borderRadius: 12, marginBottom: 15, borderWidth: 1, borderColor: '#e2e8f0' },
  instructionText: { fontSize: 13, color: '#475569', textAlign: 'right', marginBottom: 10, lineHeight: 18 },
  bankCardHeader: { fontSize: 14, fontWeight: 'bold', color: '#334155', textAlign: 'center', marginBottom: 15 },

  modalActions: { marginTop: 10, gap: 10 },
  confirmBtn: { backgroundColor: '#2563eb', paddingVertical: 15, borderRadius: 12, alignItems: 'center' },
  confirmBtnText: { color: '#ffffff', fontSize: 16, fontWeight: 'bold' },
  cancelBtn: { backgroundColor: '#fee2e2', paddingVertical: 15, borderRadius: 12, alignItems: 'center' },
  cancelBtnText: { color: '#ef4444', fontSize: 16, fontWeight: 'bold' }
});