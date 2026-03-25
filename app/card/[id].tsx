import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Modal,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import * as FileSystem from 'expo-file-system/legacy';
import NfcManager, { Ndef, NfcTech } from 'react-native-nfc-manager';
import { moderateScale, scale, verticalScale } from 'react-native-size-matters';
import { theme } from '../../theme';
import { getCardById, deleteCard, updateCard } from '../../services/dbService';
import { useInterstitialAd } from '../../hooks/useInterstitialAd';
import { useRewardedAd } from '../../hooks/useRewardedAd';
import BannerAd from '../../components/BannerAd';

// Initialize NFC Manager once
NfcManager.start();

// ─── Types ────────────────────────────────────────────────────────────────────

type CardData = {
  id: string;
  name: string;
  company: string;
  phone: string;
  address: string;
  email: string;
  website: string;
  front_image: string;
  back_image: string;
  timestamp: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Resolve a stored image value to a full displayable URI.
 * DB may contain:
 *  - a plain filename  → DocumentDirectory + filename
 *  - a legacy full path starting with file:// or /  → return as-is
 */
function resolveImageUri(value: string): string | null {
  if (!value) return null;
  if (value.startsWith('file://') || value.startsWith('/')) return value;
  return (FileSystem.documentDirectory ?? '') + value;
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function CardDetailsScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();

  const [card, setCard] = useState<CardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isNfcWriting, setIsNfcWriting] = useState(false);

  // Edit State
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [draft, setDraft] = useState<Partial<CardData>>({});

  // Image Viewer State
  const [viewerImage, setViewerImage] = useState<string | null>(null);

  const { showInterstitial } = useInterstitialAd();
  const { showRewarded } = useRewardedAd();

  useEffect(() => {
    const loadCard = async () => {
      if (!id || typeof id !== 'string') return;
      try {
        const data = await getCardById(id);
        if (data) {
          setCard(data as CardData);
        } else {
          Alert.alert('Error', 'Card not found.');
          router.back();
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    loadCard();
  }, [id, router]);

  // ─── Derived image URIs ───

  const frontUri = useMemo(() => resolveImageUri(card?.front_image ?? ''), [card]);
  const backUri = useMemo(() => resolveImageUri(card?.back_image ?? ''), [card]);

  // ─── Actions ───

  const handleEditToggle = useCallback(() => {
    if (isEditing) {
      // Revert edits
      setDraft({});
      setIsEditing(false);
    } else {
      // Start editing
      showInterstitial(() => {
        if (card) {
          setDraft({
            name: card.name,
            company: card.company,
            phone: card.phone,
            address: card.address,
            email: card.email,
            website: card.website,
          });
        }
        setIsEditing(true);
      });
    }
  }, [isEditing, card, showInterstitial]);

  const handleSaveEdits = useCallback(async () => {
    if (!card?.id) return;
    setIsSaving(true);
    
    showRewarded(
      () => {}, // onEarned
      async () => { // onClosed
        try {
          await updateCard(card.id, {
            name: draft.name,
            company: draft.company,
            phone: draft.phone,
            address: draft.address,
            email: draft.email,
            website: draft.website,
          });
          // Update local state
          setCard({ ...card, ...draft } as CardData);
          setIsEditing(false);
        } catch (err) {
          console.error(err);
          Alert.alert('Error', 'Could not save changes.');
        } finally {
          setIsSaving(false);
        }
      }
    );
  }, [card, draft, showRewarded]);

  const handleCall = useCallback(() => {
    if (!card?.phone) {
      Alert.alert('No Phone Number', 'This card does not have a phone number.');
      return;
    }
    const url = `tel:${card.phone.replace(/[^0-9+]/g, '')}`;
    Linking.canOpenURL(url).then(supported => {
      if (supported) Linking.openURL(url);
      else Alert.alert('Error', 'Unable to open dialer.');
    });
  }, [card]);

  const handleMapOpen = useCallback(async () => {
    if (!card?.address) {
      Alert.alert('No Address', 'This card does not have an address.');
      return;
    }
    const query = encodeURIComponent(card.address);
    // iOS: Open Apple Maps search. 
    // Android: Open Google Maps Search (geo:0,0?q= query).
    const mapUrl = Platform.select({
      ios: `http://maps.apple.com/?q=${query}`,
      android: `geo:0,0?q=${query}`,
      default: `https://www.google.com/maps/search/?api=1&query=${query}`
    });
    
    try {
      if (Platform.OS === 'web') {
        window.open(mapUrl, '_blank');
        return;
      }
      // openURL will reject if unable to open. Skip canOpenURL as it can fail spuriously without intent declarations.
      if (mapUrl) {
        await Linking.openURL(mapUrl);
      }
    } catch {
      // Fallback to web browser Google Maps on native devices if specific apps are not found
      const fallbackUrl = `https://www.google.com/maps/search/?api=1&query=${query}`;
      try {
        await Linking.openURL(fallbackUrl);
      } catch {
        Alert.alert('Error', 'Unable to open maps.');
      }
    }
  }, [card]);

  const handleCopy = useCallback(async (text: string, label: string) => {
    if (!text) return;
    await Clipboard.setStringAsync(text);
    Alert.alert('Copied', `${label} copied to clipboard!`, [{ text: 'OK' }]);
  }, []);

  // Share via React Native's built-in Share
  const handleShare = useCallback(async () => {
    if (!card) return;
    showInterstitial(async () => {
      const lines: string[] = ['📇 Business Card'];
      if (card.name) lines.push(`👤 ${card.name}`);
      if (card.company) lines.push(`🏢 ${card.company}`);
      if (card.phone) lines.push(`📞 ${card.phone}`);
      if (card.address) lines.push(`📍 ${card.address}`);
      if (card.email) lines.push(`✉️ ${card.email}`);
      if (card.website) lines.push(`🌐 ${card.website}`);

      try {
        await Share.share({
          message: lines.join('\n'),
          title: card.name || 'Business Card',
        });
      } catch (err: any) {
        console.warn('Share error:', err);
      }
    });
  }, [card, showInterstitial]);

  const handleDelete = useCallback(() => {
    Alert.alert('Delete Card', 'Are you sure you want to delete this card?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          if (!card?.id) return;
          showRewarded(
            () => {}, // onEarned
            async () => { // onClosed
              try {
                // Delete image files from DocumentDirectory
                const filesToDelete = [card.front_image, card.back_image].filter(Boolean);
                for (const filename of filesToDelete) {
                  const uri = resolveImageUri(filename);
                  if (uri) {
                    await FileSystem.deleteAsync(uri, { idempotent: true });
                  }
                }
                await deleteCard(card.id);
                router.back();
              } catch (err) {
                Alert.alert('Error', 'Could not delete card.');
              }
            }
          );
        },
      },
    ]);
  }, [card, router, showRewarded]);

  // ─── NFC Share (vCard 3.0) ───

  const vCardString = useMemo(() => {
    if (!card) return '';
    const lines = [
      'BEGIN:VCARD',
      'VERSION:3.0',
      `FN:${card.name || ''}`,
      `ORG:${card.company || ''}`,
      `TEL;TYPE=WORK,VOICE:${card.phone || ''}`,
      `ADR;TYPE=WORK:;;${card.address || ''};;;;`,
    ];
    if (card.email) lines.push(`EMAIL;TYPE=WORK:${card.email}`);
    if (card.website) lines.push(`URL:${card.website}`);
    lines.push('END:VCARD');
    return lines.join('\r\n');
  }, [card]);

  const handleNfcShare = useCallback(async () => {
    if (!card) return;

    showInterstitial(async () => {
      const isSupported = await NfcManager.isSupported();
      if (!isSupported) {
        Alert.alert('NFC Not Supported', 'Your device does not support NFC.');
        return;
      }
      const isEnabled = await NfcManager.isEnabled();
      if (!isEnabled) {
        Alert.alert('NFC Disabled', 'Please enable NFC in your device settings.');
        return;
      }

      try {
        setIsNfcWriting(true);
        Alert.alert('NFC Ready', 'Hold your phone near another NFC device to share the contact.', [
          { text: 'Cancel', onPress: () => { NfcManager.cancelTechnologyRequest(); setIsNfcWriting(false); } },
        ]);

        await NfcManager.requestTechnology(NfcTech.Ndef);

        const vcardBytes = Array.from(
          new TextEncoder().encode(vCardString)
        ) as number[];

        const record = Ndef.record(
          Ndef.TNF_MIME_MEDIA,
          'text/vcard',       
          [],
          vcardBytes,
        );

        const bytes = Ndef.encodeMessage([record]);

        if (bytes) {
          await NfcManager.ndefHandler.writeNdefMessage(bytes);
          Alert.alert('Success', 'Contact shared via NFC!');
        }
      } catch (ex: any) {
        if (ex?.message !== 'cancelled') {
          console.warn('NFC write error:', ex);
        }
      } finally {
        NfcManager.cancelTechnologyRequest();
        setIsNfcWriting(false);
      }
    });
  }, [card, vCardString, showInterstitial]);

  // ─── Render ───

  if (loading || !card) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Stack.Screen
        options={{
          title: isEditing ? 'Edit Card' : (card.name || 'Card Details'),
          headerTitleAlign: 'center',
          headerStyle: { backgroundColor: theme.colors.primary },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: '700' },
          headerRight: () => (
            <TouchableOpacity 
              onPress={isEditing ? handleSaveEdits : handleEditToggle}
              disabled={isSaving}
              style={{ marginRight: moderateScale(10) }}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={{ color: '#fff', fontSize: moderateScale(15), fontWeight: '700' }}>
                  {isEditing ? 'Save' : 'Edit'}
                </Text>
              )}
            </TouchableOpacity>
          ),
          headerLeft: () => isEditing ? (
            <TouchableOpacity onPress={handleEditToggle} style={{ marginLeft: moderateScale(10) }}>
              <Text style={{ color: '#fff', fontSize: moderateScale(15) }}>Cancel</Text>
            </TouchableOpacity>
          ) : undefined,
        }}
      />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* Images */}
        <View style={styles.imageRow}>
          <TouchableOpacity 
            style={styles.imageWrapper} 
            activeOpacity={0.8}
            onPress={() => frontUri && setViewerImage(frontUri)}
            disabled={!frontUri}
          >
            <Text style={styles.imageLabel}>Front</Text>
            {frontUri ? (
              <Image source={{ uri: frontUri }} style={styles.cardImage} resizeMode="cover" />
            ) : (
              <View style={[styles.cardImage, styles.cardImagePlaceholder]}>
                <Text style={styles.placeholderText}>No Front Photo</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.imageWrapper}
            activeOpacity={0.8}
            onPress={() => backUri && setViewerImage(backUri)}
            disabled={!backUri}
          >
            <Text style={styles.imageLabel}>Back</Text>
            {backUri ? (
              <Image source={{ uri: backUri }} style={styles.cardImage} resizeMode="cover" />
            ) : (
              <View style={[styles.cardImage, styles.cardImagePlaceholder]}>
                <Text style={styles.placeholderText}>No Back Photo</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Info Card */}
        <View style={styles.infoCard}>
          <FieldRow
            icon="👤" label="Name" 
            value={isEditing ? (draft.name ?? '') : card.name}
            isEditing={isEditing}
            onChangeText={(t) => setDraft(prev => ({ ...prev, name: t }))}
            onCopy={() => handleCopy(card.name, 'Name')}
          />
          <View style={styles.divider} />
          <FieldRow
            icon="🏢" label="Company" 
            value={isEditing ? (draft.company ?? '') : card.company}
            isEditing={isEditing}
            onChangeText={(t) => setDraft(prev => ({ ...prev, company: t }))}
            onCopy={() => handleCopy(card.company, 'Company')}
          />
          <View style={styles.divider} />

          {/* Phone + Call Button */}
          <View style={styles.fieldRowWithAction}>
            <View style={{ flex: 1 }}>
              <FieldRow
                icon="📞" label="Phone" 
                value={isEditing ? (draft.phone ?? '') : card.phone}
                isEditing={isEditing}
                onChangeText={(t) => setDraft(prev => ({ ...prev, phone: t }))}
                keyboardType="phone-pad"
                onCopy={() => handleCopy(card.phone, 'Phone')}
              />
            </View>
            {!isEditing && !!card.phone && (
              <TouchableOpacity style={styles.callBtn} onPress={handleCall}>
                <Text style={styles.callBtnText}>📞 Call</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.divider} />
          
          {/* Address + Map Button */}
          <View style={styles.fieldRowWithAction}>
            <View style={{ flex: 1 }}>
              <FieldRow
                icon="📍" label="Address" 
                value={isEditing ? (draft.address ?? '') : card.address}
                isEditing={isEditing}
                onChangeText={(t) => setDraft(prev => ({ ...prev, address: t }))}
                onCopy={() => handleCopy(card.address, 'Address')}
              />
            </View>
            {!isEditing && !!card.address && (
              <TouchableOpacity style={styles.mapBtn} onPress={handleMapOpen}>
                <Text style={styles.mapBtnText}>🗺️ Map</Text>
              </TouchableOpacity>
            )}
          </View>

          {(isEditing || !!card.email) && (
            <>
              <View style={styles.divider} />
              <FieldRow
                icon="✉️" label="Email" 
                value={isEditing ? (draft.email ?? '') : card.email}
                isEditing={isEditing}
                onChangeText={(t) => setDraft(prev => ({ ...prev, email: t }))}
                keyboardType="email-address"
                onCopy={() => handleCopy(card.email, 'Email')}
              />
            </>
          )}

          {(isEditing || !!card.website) && (
            <>
              <View style={styles.divider} />
              <FieldRow
                icon="🌐" label="Website" 
                value={isEditing ? (draft.website ?? '') : card.website}
                isEditing={isEditing}
                onChangeText={(t) => setDraft(prev => ({ ...prev, website: t }))}
                keyboardType="url"
                autoCapitalize="none"
                onCopy={() => handleCopy(card.website, 'Website')}
              />
            </>
          )}

          {/* Timestamp */}
          {!!card.timestamp && (
            <>
              <View style={styles.divider} />
              <View style={styles.timestampRow}>
                <Text style={styles.timestampLabel}>Saved</Text>
                <Text style={styles.timestampValue}>{card.timestamp}</Text>
              </View>
            </>
          )}
        </View>

        {/* Action Buttons - Hidden during edit */}
        {!isEditing && (
          <View style={styles.actionContainer}>
            {/* Share */}
            <TouchableOpacity style={styles.shareBtn} onPress={handleShare} activeOpacity={0.85}>
              <Text style={styles.shareBtnText}>📤 Share Contact</Text>
            </TouchableOpacity>

            {/* NFC */}
            <TouchableOpacity
              style={[styles.nfcBtn, isNfcWriting && styles.nfcBtnActive]}
              onPress={handleNfcShare}
              activeOpacity={0.85}
            >
              <Text style={styles.nfcBtnText}>
                {isNfcWriting ? '📡 Hold near NFC tag…' : '📡 Share via NFC (vCard)'}
              </Text>
            </TouchableOpacity>

            {/* Delete */}
            <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete} activeOpacity={0.85}>
              <Text style={styles.deleteBtnText}>🗑 Delete Card</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Image Viewer Modal */}
      <Modal visible={!!viewerImage} transparent={true} animationType="fade">
        <View style={styles.viewerContainer}>
          <SafeAreaView style={{ flex: 1 }}>
            <TouchableOpacity 
              style={styles.viewerCloseBtn} 
              onPress={() => setViewerImage(null)}
            >
              <Text style={styles.viewerCloseText}>✕ Close</Text>
            </TouchableOpacity>
            
            <TouchableWithoutFeedback onPress={() => setViewerImage(null)}>
              <View style={styles.viewerContent}>
                {!!viewerImage && (
                  <Image 
                    source={{ uri: viewerImage }} 
                    style={styles.viewerImage} 
                    resizeMode="contain" 
                  />
                )}
              </View>
            </TouchableWithoutFeedback>
          </SafeAreaView>
        </View>
      </Modal>

      {/* Persistent Banner Ad at the bottom */}
      <View style={{ alignItems: 'center', backgroundColor: theme.colors.background }}>
        <BannerAd />
      </View>
    </SafeAreaView>
  );
}

// ─── Sub-Components ──────────────────────────────────────────────────────────

function FieldRow({
  icon, label, value, onCopy, isEditing, onChangeText, keyboardType = 'default', autoCapitalize = 'words'
}: {
  icon: string;
  label: string;
  value: string;
  onCopy: () => void;
  isEditing?: boolean;
  onChangeText?: (t: string) => void;
  keyboardType?: 'default' | 'email-address' | 'phone-pad' | 'url';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
}) {
  return (
    <View style={styles.fieldRow}>
      <Text style={styles.fieldIcon}>{icon}</Text>
      <View style={styles.fieldTexts}>
        <Text style={styles.fieldLabel}>{label}</Text>
        {isEditing ? (
          <TextInput
            style={styles.fieldInput}
            value={value}
            onChangeText={onChangeText}
            placeholder={`Enter ${label.toLowerCase()}...`}
            placeholderTextColor="#ccc"
            keyboardType={keyboardType}
            autoCapitalize={autoCapitalize as any}
          />
        ) : (
          <Text style={[styles.fieldValue, !value && styles.fieldEmpty]}>
            {value || 'Not provided'}
          </Text>
        )}
      </View>
      {!isEditing && !!value && (
        <TouchableOpacity style={styles.copyBtn} onPress={onCopy} activeOpacity={0.75}>
          <Text style={styles.copyBtnText}>Copy</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    padding: moderateScale(16),
    paddingBottom: verticalScale(40),
  },

  // Images
  imageRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: moderateScale(12),
    marginBottom: verticalScale(16),
  },
  imageWrapper: {
    flex: 1,
    alignItems: 'center',
    gap: verticalScale(6),
  },
  imageLabel: {
    fontSize: moderateScale(11),
    fontWeight: '700',
    color: theme.colors.placeholder,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  cardImage: {
    width: '100%',
    aspectRatio: 1.75,
    borderRadius: theme.borderRadius.m,
    backgroundColor: '#eee',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  cardImagePlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f8f8',
  },
  placeholderText: {
    fontSize: moderateScale(11),
    color: theme.colors.placeholder,
  },

  // Info Card
  infoCard: {
    backgroundColor: '#fff',
    borderRadius: moderateScale(14),
    padding: moderateScale(14),
    borderWidth: 1,
    borderColor: theme.colors.border,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 2,
    marginBottom: verticalScale(16),
  },
  fieldRowWithAction: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: verticalScale(8),
  },
  fieldIcon: {
    fontSize: moderateScale(20),
    width: scale(32),
    textAlign: 'center',
  },
  fieldTexts: {
    flex: 1,
    marginLeft: moderateScale(10),
  },
  fieldLabel: {
    fontSize: moderateScale(10),
    color: theme.colors.placeholder,
    textTransform: 'uppercase',
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: verticalScale(2),
  },
  fieldValue: {
    fontSize: moderateScale(15),
    color: theme.colors.text,
    fontWeight: '500',
  },
  fieldEmpty: {
    color: '#ccc',
    fontStyle: 'italic',
    fontSize: moderateScale(13),
  },
  fieldInput: {
    fontSize: moderateScale(15),
    color: theme.colors.text,
    fontWeight: '500',
    padding: 0,
    margin: 0,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.primary,
    paddingVertical: verticalScale(2),
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginVertical: verticalScale(2),
  },
  timestampRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: verticalScale(8),
    paddingHorizontal: moderateScale(4),
  },
  timestampLabel: {
    fontSize: moderateScale(11),
    color: theme.colors.placeholder,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  timestampValue: {
    fontSize: moderateScale(12),
    color: theme.colors.placeholder,
  },

  // Buttons
  copyBtn: {
    paddingHorizontal: moderateScale(10),
    paddingVertical: verticalScale(5),
    backgroundColor: '#f0f4ff',
    borderRadius: theme.borderRadius.m,
    marginLeft: moderateScale(6),
  },
  copyBtnText: {
    fontSize: moderateScale(11),
    color: theme.colors.primary,
    fontWeight: '700',
  },
  callBtn: {
    backgroundColor: '#eafaf1',
    paddingHorizontal: moderateScale(14),
    paddingVertical: verticalScale(10),
    borderRadius: theme.borderRadius.m,
    marginLeft: moderateScale(8),
  },
  callBtnText: {
    fontSize: moderateScale(13),
    color: '#27ae60',
    fontWeight: '700',
  },
  mapBtn: {
    backgroundColor: '#eaf4fc',
    paddingHorizontal: moderateScale(14),
    paddingVertical: verticalScale(10),
    borderRadius: theme.borderRadius.m,
    marginLeft: moderateScale(8),
  },
  mapBtnText: {
    fontSize: moderateScale(13),
    color: '#3498db',
    fontWeight: '700',
  },

  actionContainer: {
    gap: verticalScale(12),
  },
  shareBtn: {
    backgroundColor: '#5856d6',
    paddingVertical: verticalScale(15),
    borderRadius: moderateScale(14),
    alignItems: 'center',
    shadowColor: '#5856d6',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 4,
  },
  shareBtnText: {
    color: '#fff',
    fontSize: moderateScale(15),
    fontWeight: '700',
  },
  nfcBtn: {
    backgroundColor: theme.colors.primary,
    paddingVertical: verticalScale(15),
    borderRadius: moderateScale(14),
    alignItems: 'center',
    shadowColor: theme.colors.primary,
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 4,
  },
  nfcBtnActive: {
    backgroundColor: '#e67e22',
    shadowColor: '#e67e22',
  },
  nfcBtnText: {
    color: '#fff',
    fontSize: moderateScale(15),
    fontWeight: '700',
  },
  deleteBtn: {
    backgroundColor: 'transparent',
    paddingVertical: verticalScale(15),
    borderRadius: moderateScale(14),
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#e74c3c',
  },
  deleteBtnText: {
    color: '#e74c3c',
    fontSize: moderateScale(15),
    fontWeight: '700',
  },

  // Image Viewer
  viewerContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
  },
  viewerCloseBtn: {
    alignSelf: 'flex-end',
    padding: moderateScale(16),
  },
  viewerCloseText: {
    color: '#fff',
    fontSize: moderateScale(16),
    fontWeight: '700',
  },
  viewerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewerImage: {
    width: '100%',
    height: '80%',
  },
});
