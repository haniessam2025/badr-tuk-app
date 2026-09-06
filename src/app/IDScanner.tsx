import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const { width } = Dimensions.get('window');
const ID_FRAME_WIDTH = width * 0.9; 
const ID_FRAME_HEIGHT = ID_FRAME_WIDTH * 0.63; 

export default function IDScanner() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [scannedImage, setScannedImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [cardSide, setCardSide] = useState<'front' | 'back'>('front');
  const [expiryStatus, setExpiryStatus] = useState<{ date: string, isValid: boolean, message: string } | null>(null);
  
  const cameraRef = useRef<any>(null);

  if (!permission) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#d97706" /></View>;
  }

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.text}>نحتاج صلاحية الكاميرا لتصوير البطاقة.</Text>
        <TouchableOpacity style={styles.btn} onPress={requestPermission}>
          <Text style={styles.btnText}>منح الصلاحية</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const takePicture = async () => {
    if (cameraRef.current) {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.7, base64: true });
      setScannedImage(photo.uri);

      if (cardSide === 'back') {
        processOCR(photo.base64);
      } else {
        Alert.alert('ممتاز', 'تم التقاط الوجه الأمامي بنجاح، يرجى قلب البطاقة وتصوير الظهر الآن.', [
          { text: 'حسناً', onPress: () => { setScannedImage(null); setCardSide('back'); } }
        ]);
      }
    }
  };

  const processOCR = async (base64Image: string) => {
    setIsProcessing(true);
    try {
      setTimeout(() => {
        const fakeExtractedDate = "2029/05/20"; 
        validateDate(fakeExtractedDate);
        setIsProcessing(false);
      }, 2000);
    } catch (error) {
      Alert.alert('خطأ', 'فشل في قراءة بيانات البطاقة.');
      setIsProcessing(false);
    }
  };

  const validateDate = (dateString: string) => {
    const expiryDate = new Date(dateString);
    const today = new Date();
    
    if (expiryDate > today) {
      setExpiryStatus({ date: dateString, isValid: true, message: 'البطاقة سارية' });
    } else {
      setExpiryStatus({ date: dateString, isValid: false, message: 'البطاقة منتهية - غير صالحة' });
    }
  };

  const retake = () => {
    setScannedImage(null);
    setExpiryStatus(null);
  };

  return (
    <View style={styles.container}>
      {!scannedImage ? (
        <View style={styles.cameraContainer}>
          {/* الكاميرا في الخلفية */}
          <CameraView style={StyleSheet.absoluteFillObject} facing="back" ref={cameraRef} />
          
          {/* الماسك اللي بيغطي الشاشة (مع zIndex و elevation لإجباره يظهر فوق الكاميرا) */}
          <View style={styles.overlayWrapper}>
            
            {/* الجزء المظلم العلوي */}
            <View style={styles.darkOverlay} />
            
            {/* الصف اللي في النص (يحتوي على الفتحة الشفافة) */}
            <View style={{ flexDirection: 'row', height: ID_FRAME_HEIGHT }}>
              <View style={styles.darkOverlay} />
              
              <View style={styles.transparentFrame}>
                {/* زوايا التحديد البيضاء */}
                <View style={[styles.corner, styles.topLeft]} />
                <View style={[styles.corner, styles.topRight]} />
                <View style={[styles.corner, styles.bottomLeft]} />
                <View style={[styles.corner, styles.bottomRight]} />
              </View>
              
              <View style={styles.darkOverlay} />
            </View>

            {/* الجزء المظلم السفلي (يحتوي على الزراير) */}
            <View style={[styles.darkOverlay, styles.bottomControls]}>
              <Text style={styles.instructionText}>
                {cardSide === 'front' ? 'الوجه الأمامي للبطاقة' : 'الوجه الخلفي للبطاقة'}
              </Text>
              <Text style={styles.subInstruction}>
                اجعل البطاقة داخل الإطار الشفاف تماماً
              </Text>
              
              <TouchableOpacity style={styles.captureBtn} onPress={takePicture}>
                <View style={styles.captureBtnInner} />
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.cancelBtn} onPress={() => router.back()}>
                <Text style={styles.cancelBtnText}>إلغاء التصوير</Text>
              </TouchableOpacity>
            </View>

          </View>
        </View>
      ) : (
        <View style={styles.previewContainer}>
          <Image source={{ uri: scannedImage }} style={styles.previewImage} />
          
          {isProcessing ? (
            <View style={styles.statusBox}>
              <ActivityIndicator size="large" color="#2563eb" />
              <Text style={styles.statusText}>جاري قراءة البيانات والتحقق من التاريخ...</Text>
            </View>
          ) : expiryStatus ? (
            <View style={[styles.statusBox, expiryStatus.isValid ? styles.validBox : styles.invalidBox]}>
              <Text style={styles.dateText}>تاريخ الانتهاء المقروء: {expiryStatus.date}</Text>
              <Text style={[styles.statusBadge, expiryStatus.isValid ? styles.validText : styles.invalidText]}>
                {expiryStatus.isValid ? `✅ (${expiryStatus.message})` : `❌ (${expiryStatus.message})`}
              </Text>
            </View>
          ) : null}

          <View style={styles.actionsRow}>
            <TouchableOpacity style={styles.retakeBtn} onPress={retake}>
              <Text style={styles.retakeBtnText}>إعادة التصوير</Text>
            </TouchableOpacity>
            {!isProcessing && expiryStatus?.isValid && (
              <TouchableOpacity style={styles.confirmBtn} onPress={() => { Alert.alert('تم', 'تم اعتماد البطاقة بنجاح'); router.back(); }}>
                <Text style={styles.confirmBtnText}>تأكيد واعتماد</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  cameraContainer: { flex: 1, position: 'relative' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  text: { fontSize: 16, textAlign: 'center', marginBottom: 20, color: '#1e293b' },
  btn: { backgroundColor: '#d97706', padding: 12, borderRadius: 8 },
  btnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  
  /* الحاوية اللي بتجبر الطبقة السوداء تظهر فوق الكاميرا */
  overlayWrapper: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 999, // مهم جداً للأندرويد والـ iOS
    elevation: 999, // مهم جداً للأندرويد
  },

  /* التظليل اللي هيغطي كل حاجة */
  darkOverlay: { 
    flex: 1, 
    backgroundColor: 'rgba(0,0,0,0.85)'
  },
  
  /* الفتحة الشفافة */
  transparentFrame: {
    width: ID_FRAME_WIDTH, 
    backgroundColor: 'transparent',
    position: 'relative'
  },
  
  /* أركان التحديد البيضاء */
  corner: { position: 'absolute', width: 30, height: 30, borderColor: '#fff' },
  topLeft: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4 },
  topRight: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4 },
  bottomLeft: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4 },
  bottomRight: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4 },

  /* التحكم السفلي */
  bottomControls: { 
    alignItems: 'center', 
    justifyContent: 'center',
    paddingTop: 20,
    paddingBottom: 40 
  },
  instructionText: { fontSize: 24, fontWeight: 'bold', color: '#fff', marginBottom: 5 },
  subInstruction: { fontSize: 14, color: '#cbd5e1', marginBottom: 30 },
  
  captureBtn: { width: 76, height: 76, borderRadius: 38, backgroundColor: 'rgba(255,255,255,0.4)', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  captureBtnInner: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#fff' },
  cancelBtn: { padding: 10, marginTop: 10 },
  cancelBtnText: { color: '#fca5a5', fontSize: 18, fontWeight: 'bold' },

  previewContainer: { flex: 1, backgroundColor: '#1e293b', justifyContent: 'center', alignItems: 'center', padding: 20 },
  previewImage: { width: ID_FRAME_WIDTH, height: ID_FRAME_HEIGHT, borderRadius: 12, resizeMode: 'cover', marginBottom: 20, borderWidth: 2, borderColor: '#475569' },
  
  statusBox: { width: '100%', padding: 20, borderRadius: 16, backgroundColor: '#ffffff', alignItems: 'center', marginBottom: 30, elevation: 5 },
  validBox: { borderWidth: 2, borderColor: '#10b981' },
  invalidBox: { borderWidth: 2, borderColor: '#ef4444' },
  statusText: { fontSize: 16, color: '#334155', marginTop: 15, fontWeight: 'bold' },
  dateText: { fontSize: 18, fontWeight: 'bold', color: '#1e293b', marginBottom: 10 },
  statusBadge: { fontSize: 18, fontWeight: 'bold' },
  validText: { color: '#10b981' },
  invalidText: { color: '#ef4444' },

  actionsRow: { flexDirection: 'row-reverse', width: '100%', justifyContent: 'space-between', gap: 15 },
  retakeBtn: { flex: 1, backgroundColor: '#64748b', paddingVertical: 15, borderRadius: 12, alignItems: 'center' },
  retakeBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  confirmBtn: { flex: 1, backgroundColor: '#2563eb', paddingVertical: 15, borderRadius: 12, alignItems: 'center' },
  confirmBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' }
});