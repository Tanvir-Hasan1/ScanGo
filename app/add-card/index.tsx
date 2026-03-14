/**
 * Add Card Screen
 *
 * Flow:
 *  1. Permission Gate      – request camera permission
 *  2. Front Capture        – take front photo of the business card
 *  3. Back Capture         – take back photo of the business card
 *  4. OCR Processing       – run ML Kit text recognition on the front image
 *  5. Field Mapping UI     – tap detected text blocks to assign Name / Company / Phone / Address
 *  6. Save                 – persist card (images + fields) to SQLite and navigate back
 */

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as FileSystem from 'expo-file-system/legacy';
import TextRecognition from '@react-native-ml-kit/text-recognition';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
} from 'react-native-vision-camera';
import { moderateScale, scale, verticalScale } from 'react-native-size-matters';
import { theme } from '../../theme';
import { addCard } from '../../services/dbService';

// ─── Types ────────────────────────────────────────────────────────────────────

type CardField = 'name' | 'company' | 'phone' | 'address';

type OcrBlock = {
  id: number;
  text: string;
};

type FieldMap = Record<CardField, string>;

type AppPhase =
  | 'permission'
  | 'capture-front'
  | 'capture-back'
  | 'processing'
  | 'mapping'
  | 'saving';

// ─── Constants ────────────────────────────────────────────────────────────────

const FIELDS: { key: CardField; label: string; icon: string }[] = [
  { key: 'name', label: 'Name', icon: '👤' },
  { key: 'company', label: 'Company', icon: '🏢' },
  { key: 'phone', label: 'Phone', icon: '📞' },
  { key: 'address', label: 'Address', icon: '📍' },
];

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function AddCardScreen() {
  const router = useRouter();
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('back');
  const cameraRef = useRef<Camera | null>(null);

  const [phase, setPhase] = useState<AppPhase>('permission');
  const [frontUri, setFrontUri] = useState<string | null>(null);
  const [backUri, setBackUri] = useState<string | null>(null);
  const [ocrBlocks, setOcrBlocks] = useState<OcrBlock[]>([]);
  const [activeField, setActiveField] = useState<CardField | null>('name');
  const [fieldMap, setFieldMap] = useState<FieldMap>({
    name: '',
    company: '',
    phone: '',
    address: '',
  });
  const [assignedIds, setAssignedIds] = useState<Set<number>>(new Set());

  // On mount, check / request permission
  useEffect(() => {
    if (hasPermission) {
      setPhase('capture-front');
    } else {
      setPhase('permission');
    }
  }, [hasPermission]);

  // ─── Handlers ──────────────────────────────────────────────────────────────

  const handleRequestPermission = useCallback(async () => {
    const granted = await requestPermission();
    if (granted) setPhase('capture-front');
    else Alert.alert('Permission Denied', 'Camera access is required to scan business cards.');
  }, [requestPermission]);

  const saveImageToDocuments = useCallback(async (tempUri: string, name: string) => {
    const destPath = `${FileSystem.documentDirectory}${name}`;
    await FileSystem.copyAsync({ from: tempUri, to: destPath });
    return destPath;
  }, []);

  const handleCapture = useCallback(
    async (side: 'front' | 'back') => {
      if (!cameraRef.current) return;
      try {
        const photo = await cameraRef.current.takePhoto({ flash: 'auto' });
        const filename = `card_${side}_${Date.now()}.jpg`;
        const savedUri = await saveImageToDocuments(`file://${photo.path}`, filename);

        if (side === 'front') {
          setFrontUri(savedUri);
          setPhase('capture-back');
        } else {
          setBackUri(savedUri);
          // Move straight to OCR
          setPhase('processing');
          runOcr(savedUri, frontUri!);
        }
      } catch (err) {
        console.error('Capture error:', err);
        Alert.alert('Capture Failed', 'Could not capture photo. Please try again.');
      }
    },
    [cameraRef, frontUri, saveImageToDocuments],
  );

  const runOcr = useCallback(async (backSaved: string, frontSaved: string) => {
    try {
      const result = await TextRecognition.recognize(frontSaved);
      const blocks: OcrBlock[] = result.blocks
        .map((block, idx) => ({ id: idx, text: block.text.trim() }))
        .filter((b) => b.text.length > 0);
      setOcrBlocks(blocks);
    } catch (err) {
      console.warn('OCR error:', err);
      setOcrBlocks([]);
    } finally {
      setPhase('mapping');
    }
  }, []);

  const handleChipPress = useCallback(
    (block: OcrBlock) => {
      if (!activeField) return;
      setFieldMap((prev) => ({ ...prev, [activeField!]: block.text }));
      setAssignedIds((prev) => new Set(prev).add(block.id));

      // Auto-advance to next empty field
      const fieldOrder: CardField[] = ['name', 'company', 'phone', 'address'];
      const currentIdx = fieldOrder.indexOf(activeField);
      const nextEmpty = fieldOrder.slice(currentIdx + 1).find(
        (f) => !fieldMap[f] && f !== activeField,
      );
      setActiveField(nextEmpty ?? null);
    },
    [activeField, fieldMap],
  );

  const handleSave = useCallback(async () => {
    if (!frontUri) {
      Alert.alert('Missing Photo', 'A front photo is required.');
      return;
    }
    setPhase('saving');
    try {
      await addCard({
        name: fieldMap.name,
        company: fieldMap.company,
        phone: fieldMap.phone,
        address: fieldMap.address,
        front_image: frontUri,
        back_image: backUri ?? '',
      });
      router.back();
    } catch (err) {
      console.error('Save error:', err);
      Alert.alert('Save Failed', 'Could not save the card. Please try again.');
      setPhase('mapping');
    }
  }, [fieldMap, frontUri, backUri, router]);

  // ─── Render helpers ────────────────────────────────────────────────────────

  if (phase === 'permission') {
    return <PermissionGate onRequest={handleRequestPermission} />;
  }

  if (phase === 'capture-front' || phase === 'capture-back') {
    if (!device) {
      return (
        <View style={styles.centeredFlex}>
          <Text style={styles.errorText}>No camera device found.</Text>
        </View>
      );
    }
    return (
      <CaptureView
        device={device}
        cameraRef={cameraRef}
        side={phase === 'capture-front' ? 'front' : 'back'}
        thumbnail={phase === 'capture-back' ? frontUri : null}
        onCapture={() => handleCapture(phase === 'capture-front' ? 'front' : 'back')}
        onRetake={() => {
          if (phase === 'capture-back') {
            setFrontUri(null);
            setPhase('capture-front');
          }
        }}
      />
    );
  }

  if (phase === 'processing' || phase === 'saving') {
    return (
      <View style={styles.centeredFlex}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>
          {phase === 'processing' ? 'Reading card text…' : 'Saving card…'}
        </Text>
      </View>
    );
  }

  // phase === 'mapping'
  return (
    <MappingView
      ocrBlocks={ocrBlocks}
      fieldMap={fieldMap}
      assignedIds={assignedIds}
      activeField={activeField}
      frontUri={frontUri}
      backUri={backUri}
      onFieldSelect={setActiveField}
      onChipPress={handleChipPress}
      onSave={handleSave}
      onRetake={() => {
        setFrontUri(null);
        setBackUri(null);
        setOcrBlocks([]);
        setAssignedIds(new Set());
        setFieldMap({ name: '', company: '', phone: '', address: '' });
        setActiveField('name');
        setPhase('capture-front');
      }}
    />
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

// --- Permission Gate ---
function PermissionGate({ onRequest }: { onRequest: () => void }) {
  return (
    <SafeAreaView style={styles.permissionContainer}>
      <View style={styles.permissionCard}>
        <Text style={styles.permissionIcon}>📷</Text>
        <Text style={styles.permissionTitle}>Camera Access Required</Text>
        <Text style={styles.permissionBody}>
          ScanGo uses your camera to scan business cards and extract contact
          information — completely offline.
        </Text>
        <TouchableOpacity style={styles.primaryBtn} onPress={onRequest} activeOpacity={0.85}>
          <Text style={styles.primaryBtnText}>Grant Camera Permission</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// --- Capture View ---
interface CaptureViewProps {
  device: ReturnType<typeof useCameraDevice>;
  cameraRef: React.RefObject<Camera | null>;
  side: 'front' | 'back';
  thumbnail: string | null;
  onCapture: () => void;
  onRetake: () => void;
}

function CaptureView({
  device,
  cameraRef,
  side,
  thumbnail,
  onCapture,
  onRetake,
}: CaptureViewProps) {
  const label = side === 'front' ? 'Front of Card' : 'Back of Card';
  const step = side === 'front' ? '1 / 2' : '2 / 2';

  return (
    <View style={styles.cameraContainer}>
      <Camera
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        device={device!}
        isActive
        photo
      />

      {/* Top Overlay */}
      <SafeAreaView style={styles.cameraTopOverlay}>
        <View style={styles.cameraHeader}>
          <View style={styles.stepBadge}>
            <Text style={styles.stepBadgeText}>{step}</Text>
          </View>
          <Text style={styles.cameraLabel}>{label}</Text>
        </View>
        <Text style={styles.cameraHint}>
          Position the card within the frame and tap the button below.
        </Text>
      </SafeAreaView>

      {/* Card frame guide */}
      <View style={styles.cardFrame} pointerEvents="none" />

      {/* Bottom Overlay */}
      <SafeAreaView style={styles.cameraBottomOverlay}>
        {thumbnail && side === 'back' && (
          <View style={styles.thumbnailRow}>
            <Image source={{ uri: thumbnail }} style={styles.thumbnail} />
            <TouchableOpacity style={styles.retakeBtn} onPress={onRetake}>
              <Text style={styles.retakeBtnText}>↩ Retake Front</Text>
            </TouchableOpacity>
          </View>
        )}
        <TouchableOpacity style={styles.captureBtn} onPress={onCapture} activeOpacity={0.8}>
          <View style={styles.captureBtnInner} />
        </TouchableOpacity>
      </SafeAreaView>
    </View>
  );
}

// --- Mapping View ---
interface MappingViewProps {
  ocrBlocks: OcrBlock[];
  fieldMap: FieldMap;
  assignedIds: Set<number>;
  activeField: CardField | null;
  frontUri: string | null;
  backUri: string | null;
  onFieldSelect: (f: CardField) => void;
  onChipPress: (b: OcrBlock) => void;
  onSave: () => void;
  onRetake: () => void;
}

function MappingView({
  ocrBlocks,
  fieldMap,
  assignedIds,
  activeField,
  frontUri,
  backUri,
  onFieldSelect,
  onChipPress,
  onSave,
  onRetake,
}: MappingViewProps) {
  const hasAnyField = Object.values(fieldMap).some((v) => v.length > 0);

  return (
    <SafeAreaView style={styles.mappingContainer}>
      {/* Header */}
      <View style={styles.mappingHeader}>
        <Text style={styles.mappingTitle}>Map Card Fields</Text>
        <Text style={styles.mappingSubtitle}>
          Tap a field, then tap the detected text to assign it.
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.mappingScroll} showsVerticalScrollIndicator={false}>

        {/* Photo Previews */}
        <View style={styles.previewRow}>
          {frontUri && (
            <View style={styles.previewItem}>
              <Image source={{ uri: frontUri }} style={styles.previewImage} />
              <Text style={styles.previewLabel}>Front</Text>
            </View>
          )}
          {backUri && (
            <View style={styles.previewItem}>
              <Image source={{ uri: backUri }} style={styles.previewImage} />
              <Text style={styles.previewLabel}>Back</Text>
            </View>
          )}
        </View>

        {/* Field Buttons */}
        <Text style={styles.sectionLabel}>Select a field to assign:</Text>
        <View style={styles.fieldGrid}>
          {FIELDS.map(({ key, label, icon }) => {
            const isActive = activeField === key;
            const hasValue = fieldMap[key].length > 0;
            return (
              <TouchableOpacity
                key={key}
                style={[
                  styles.fieldChip,
                  isActive && styles.fieldChipActive,
                  hasValue && !isActive && styles.fieldChipFilled,
                ]}
                onPress={() => onFieldSelect(key)}
                activeOpacity={0.8}
              >
                <Text style={styles.fieldChipIcon}>{icon}</Text>
                <View style={styles.fieldChipTextContainer}>
                  <Text
                    style={[
                      styles.fieldChipLabel,
                      isActive && styles.fieldChipLabelActive,
                    ]}
                  >
                    {label}
                  </Text>
                  {hasValue && (
                    <Text
                      style={styles.fieldChipValue}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                    >
                      {fieldMap[key]}
                    </Text>
                  )}
                </View>
                {isActive && <Text style={styles.fieldChipCaret}>›</Text>}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* OCR Text Blocks */}
        <Text style={styles.sectionLabel}>
          {ocrBlocks.length > 0
            ? `Detected text (${ocrBlocks.length} blocks) — tap to assign:`
            : 'No text detected. Use the fields above to type manually.'}
        </Text>
        {ocrBlocks.length > 0 && (
          <View style={styles.chipsWrap}>
            {ocrBlocks.map((block) => {
              const isAssigned = assignedIds.has(block.id);
              return (
                <TouchableOpacity
                  key={block.id}
                  style={[styles.ocrChip, isAssigned && styles.ocrChipAssigned]}
                  onPress={() => onChipPress(block)}
                  activeOpacity={0.75}
                >
                  <Text
                    style={[
                      styles.ocrChipText,
                      isAssigned && styles.ocrChipTextAssigned,
                    ]}
                  >
                    {block.text}
                  </Text>
                  {isAssigned && <Text style={styles.ocrChipCheck}>✓</Text>}
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={onRetake}
            activeOpacity={0.8}
          >
            <Text style={styles.secondaryBtnText}>↩ Retake</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.primaryBtn, styles.saveBtn, !hasAnyField && styles.btnDisabled]}
            onPress={hasAnyField ? onSave : undefined}
            activeOpacity={hasAnyField ? 0.85 : 1}
          >
            <Text style={styles.primaryBtnText}>💾 Save Card</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const CARD_FRAME_W = scale(300);
const CARD_FRAME_H = verticalScale(185); // standard business card ~1.75 aspect

const styles = StyleSheet.create({
  // ── Shared ──
  centeredFlex: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    gap: moderateScale(12),
  },
  loadingText: {
    fontSize: theme.fontSize.medium,
    color: theme.colors.text,
  },
  errorText: {
    fontSize: theme.fontSize.medium,
    color: '#c0392b',
  },

  // ── Permission Gate ──
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    padding: moderateScale(24),
  },
  permissionCard: {
    backgroundColor: '#f4f8ff',
    borderRadius: theme.borderRadius.l,
    padding: moderateScale(28),
    alignItems: 'center',
    maxWidth: scale(340),
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 4,
  },
  permissionIcon: { fontSize: moderateScale(56), marginBottom: verticalScale(12) },
  permissionTitle: {
    fontSize: theme.fontSize.xlarge,
    fontWeight: '700',
    color: theme.colors.primary,
    marginBottom: verticalScale(8),
    textAlign: 'center',
  },
  permissionBody: {
    fontSize: theme.fontSize.medium,
    color: theme.colors.text,
    textAlign: 'center',
    lineHeight: moderateScale(22),
    marginBottom: verticalScale(24),
  },

  // ── Buttons ──
  primaryBtn: {
    backgroundColor: theme.colors.primary,
    paddingVertical: verticalScale(14),
    paddingHorizontal: moderateScale(28),
    borderRadius: theme.borderRadius.m,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: scale(180),
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: theme.fontSize.medium,
    fontWeight: '700',
  },
  secondaryBtn: {
    backgroundColor: '#eaf0fb',
    paddingVertical: verticalScale(14),
    paddingHorizontal: moderateScale(20),
    borderRadius: theme.borderRadius.m,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: scale(110),
  },
  secondaryBtnText: {
    color: theme.colors.primary,
    fontSize: theme.fontSize.medium,
    fontWeight: '600',
  },
  saveBtn: {
    flex: 1,
    marginLeft: moderateScale(12),
    minWidth: 0,
  },
  btnDisabled: {
    backgroundColor: theme.colors.border,
  },

  // ── Camera ──
  cameraContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  cameraTopOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: moderateScale(20),
    paddingTop: verticalScale(8),
    paddingBottom: verticalScale(12),
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  cameraHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: moderateScale(10),
    marginBottom: verticalScale(6),
  },
  stepBadge: {
    backgroundColor: theme.colors.primary,
    borderRadius: moderateScale(20),
    paddingHorizontal: moderateScale(10),
    paddingVertical: verticalScale(3),
  },
  stepBadgeText: { color: '#fff', fontSize: theme.fontSize.small, fontWeight: '700' },
  cameraLabel: {
    color: '#fff',
    fontSize: theme.fontSize.large,
    fontWeight: '700',
  },
  cameraHint: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: theme.fontSize.small,
  },

  // Card Frame guide overlay
  cardFrame: {
    position: 'absolute',
    width: CARD_FRAME_W,
    height: CARD_FRAME_H,
    alignSelf: 'center',
    top: '35%',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.75)',
    borderRadius: moderateScale(10),
    borderStyle: 'dashed',
  },

  cameraBottomOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: verticalScale(24),
    paddingTop: verticalScale(12),
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  thumbnailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: moderateScale(12),
    marginBottom: verticalScale(12),
  },
  thumbnail: {
    width: scale(60),
    height: verticalScale(40),
    borderRadius: theme.borderRadius.s,
    borderWidth: 2,
    borderColor: theme.colors.primary,
  },
  retakeBtn: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: moderateScale(14),
    paddingVertical: verticalScale(7),
    borderRadius: theme.borderRadius.m,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  retakeBtnText: { color: '#fff', fontSize: theme.fontSize.small, fontWeight: '600' },

  captureBtn: {
    width: scale(72),
    height: scale(72),
    borderRadius: scale(36),
    borderWidth: 4,
    borderColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  captureBtnInner: {
    width: scale(54),
    height: scale(54),
    borderRadius: scale(27),
    backgroundColor: '#fff',
  },

  // ── Mapping ──
  mappingContainer: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  mappingHeader: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: moderateScale(20),
    paddingTop: verticalScale(18),
    paddingBottom: verticalScale(14),
  },
  mappingTitle: {
    color: '#fff',
    fontSize: theme.fontSize.xlarge,
    fontWeight: '800',
  },
  mappingSubtitle: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: theme.fontSize.small,
    marginTop: verticalScale(4),
  },
  mappingScroll: {
    padding: moderateScale(16),
    paddingBottom: verticalScale(40),
  },

  // Photo previews
  previewRow: {
    flexDirection: 'row',
    gap: moderateScale(12),
    marginBottom: verticalScale(16),
  },
  previewItem: { flex: 1, alignItems: 'center', gap: verticalScale(4) },
  previewImage: {
    width: '100%',
    height: verticalScale(100),
    borderRadius: theme.borderRadius.m,
    backgroundColor: theme.colors.border,
  },
  previewLabel: {
    fontSize: theme.fontSize.small,
    color: theme.colors.placeholder,
    fontWeight: '600',
  },

  sectionLabel: {
    fontSize: theme.fontSize.small,
    color: theme.colors.placeholder,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: verticalScale(8),
    marginTop: verticalScale(4),
  },

  // Field chips
  fieldGrid: {
    gap: verticalScale(8),
    marginBottom: verticalScale(20),
  },
  fieldChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f4f8ff',
    borderRadius: theme.borderRadius.m,
    paddingVertical: verticalScale(12),
    paddingHorizontal: moderateScale(14),
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    gap: moderateScale(12),
  },
  fieldChipActive: {
    borderColor: theme.colors.primary,
    backgroundColor: '#eaf0ff',
    shadowColor: theme.colors.primary,
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 3,
  },
  fieldChipFilled: {
    borderColor: '#34c759',
    backgroundColor: '#f0fff4',
  },
  fieldChipIcon: { fontSize: moderateScale(22) },
  fieldChipTextContainer: { flex: 1 },
  fieldChipLabel: {
    fontSize: theme.fontSize.medium,
    fontWeight: '600',
    color: theme.colors.text,
  },
  fieldChipLabelActive: { color: theme.colors.primary },
  fieldChipValue: {
    fontSize: theme.fontSize.small,
    color: '#34c759',
    fontWeight: '500',
    marginTop: verticalScale(2),
  },
  fieldChipCaret: {
    fontSize: moderateScale(18),
    color: theme.colors.primary,
    fontWeight: '700',
  },

  // OCR chips
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: moderateScale(8),
    marginBottom: verticalScale(24),
  },
  ocrChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: moderateScale(4),
    backgroundColor: '#fff',
    borderRadius: moderateScale(20),
    paddingVertical: verticalScale(8),
    paddingHorizontal: moderateScale(14),
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 3,
    elevation: 1,
    maxWidth: scale(280),
  },
  ocrChipAssigned: {
    backgroundColor: '#e8f5e9',
    borderColor: '#34c759',
  },
  ocrChipText: {
    fontSize: theme.fontSize.small,
    color: theme.colors.text,
    flexShrink: 1,
  },
  ocrChipTextAssigned: {
    color: '#27ae60',
    fontWeight: '600',
  },
  ocrChipCheck: {
    fontSize: moderateScale(12),
    color: '#27ae60',
    fontWeight: '700',
  },

  // Action row
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: verticalScale(4),
  },
});
