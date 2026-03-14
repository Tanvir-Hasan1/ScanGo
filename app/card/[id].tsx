import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import NfcManager, { Ndef, NfcTech } from 'react-native-nfc-manager';
import { theme } from '../../theme';
import { getCardById, deleteCard } from '../../services/dbService';

// Initialize NFC Manager
NfcManager.start();

type CardData = {
  id: string;
  name: string;
  company: string;
  phone: string;
  address: string;
  front_image: string;
  back_image: string;
  timestamp: string;
};

export default function CardDetailsScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  
  const [card, setCard] = useState<CardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isNfcWriting, setIsNfcWriting] = useState(false);

  // Load card data
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

  // ─── Actions ───

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

  const handleCopy = useCallback(async (text: string, label: string) => {
    if (!text) return;
    await Clipboard.setStringAsync(text);
    Alert.alert('Copied', `${label} copied to clipboard!`, [{ text: 'OK' }]);
  }, []);

  const handleDelete = useCallback(() => {
    Alert.alert('Delete Card', 'Are you sure you want to delete this card?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (!card?.id) return;
          try {
            await deleteCard(card.id);
            router.back();
          } catch (err) {
            Alert.alert('Error', 'Could not delete card.');
          }
        },
      },
    ]);
  }, [card, router]);

  // ─── NFC Share (vCard) ───

  const generateVCardStr = useMemo(() => {
    if (!card) return '';
    return [
      'BEGIN:VCARD',
      'VERSION:3.0',
      `FN:${card.name}`,
      `ORG:${card.company}`,
      `TEL;TYPE=WORK,VOICE:${card.phone}`,
      `ADR;TYPE=WORK:;;${card.address};;;;`,
      'END:VCARD',
    ].join('\n');
  }, [card]);

  const handleNfcShare = useCallback(async () => {
    if (!card) return;
    
    // Check if NFC is supported/enabled
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
      // Wait for an NFC tag
      await NfcManager.requestTechnology(NfcTech.Ndef);
      
      const vcardStr = generateVCardStr;
      const bytes = Ndef.encodeMessage([
        Ndef.record(
          Ndef.TNF_MIME_MEDIA,
          'text/vcard',
          [],
          Ndef.text.encodePayload(vcardStr) // convert string to bytes
        ),
      ]);

      if (bytes) {
        await NfcManager.ndefHandler.writeNdefMessage(bytes);
        Alert.alert('Success', 'Contact shared via NFC!');
      }
    } catch (ex) {
      console.warn('NFC write error:', ex);
      // user cancel or error (often triggers if tag is removed too quickly)
    } finally {
      // Release NFC
      NfcManager.cancelTechnologyRequest();
      setIsNfcWriting(false);
    }
  }, [card, generateVCardStr]);

  // ─── Render ───

  if (loading || !card) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        {/* Images */}
        <View style={styles.imageRow}>
          <View style={styles.imageWrapper}>
            <Text style={styles.imageLabel}>Front</Text>
            {card.front_image ? (
              <Image source={{ uri: card.front_image }} style={styles.cardImage} />
            ) : (
              <View style={styles.cardImagePlaceholder}><Text>No Front</Text></View>
            )}
          </View>
          <View style={styles.imageWrapper}>
            <Text style={styles.imageLabel}>Back</Text>
            {card.back_image ? (
              <Image source={{ uri: card.back_image }} style={styles.cardImage} />
            ) : (
              <View style={styles.cardImagePlaceholder}><Text>No Back</Text></View>
            )}
          </View>
        </View>

        {/* Info Fields */}
        <View style={styles.infoCard}>
          <FieldRow 
            icon="👤" label="Name" value={card.name} 
            onCopy={() => handleCopy(card.name, 'Name')} 
          />
          <View style={styles.divider} />
          <FieldRow 
            icon="🏢" label="Company" value={card.company} 
            onCopy={() => handleCopy(card.company, 'Company')} 
          />
          <View style={styles.divider} />
          
          <View style={styles.fieldRowWrap}>
            <View style={{ flex: 1 }}>
              <FieldRow 
                icon="📞" label="Phone" value={card.phone} 
                onCopy={() => handleCopy(card.phone, 'Phone')} 
              />
            </View>
            <TouchableOpacity style={styles.callBtn} onPress={handleCall}>
              <Text style={styles.callBtnText}>📞 Call</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.divider} />
          <FieldRow 
            icon="📍" label="Address" value={card.address} 
            onCopy={() => handleCopy(card.address, 'Address')} 
          />
        </View>

        {/* Action Buttons */}
        <View style={styles.actionContainer}>
          <TouchableOpacity 
            style={[styles.nfcBtn, isNfcWriting && styles.nfcBtnActive]} 
            onPress={handleNfcShare}
          >
            <Text style={styles.nfcBtnText}>
              {isNfcWriting ? '📡 Ready to Share... Hold near tag!' : '📡 Share via NFC (vCard)'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
            <Text style={styles.deleteBtnText}>🗑 Delete Card</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Sub-Components ──────────────────────────────────────────────────────────

function FieldRow({ icon, label, value, onCopy }: { icon: string; label: string; value: string; onCopy: () => void }) {
  return (
    <View style={styles.fieldRow}>
      <Text style={styles.fieldIcon}>{icon}</Text>
      <View style={styles.fieldTexts}>
        <Text style={styles.fieldLabel}>{label}</Text>
        <Text style={[styles.fieldValue, !value && styles.fieldEmpty]}>
          {value || 'Not provided'}
        </Text>
      </View>
      {!!value && (
        <TouchableOpacity style={styles.copyBtn} onPress={onCopy}>
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
    padding: theme.spacing.m,
    paddingBottom: 40,
  },
  
  // Images
  imageRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: theme.spacing.xl,
  },
  imageWrapper: {
    flex: 1,
    alignItems: 'center',
  },
  imageLabel: {
    fontSize: theme.fontSize.small,
    fontWeight: '600',
    color: theme.colors.placeholder,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  cardImage: {
    width: '100%',
    aspectRatio: 1.75, // standard card approx
    borderRadius: theme.borderRadius.m,
    backgroundColor: '#eee',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  cardImagePlaceholder: {
    width: '100%',
    aspectRatio: 1.75,
    borderRadius: theme.borderRadius.m,
    backgroundColor: '#fafafa',
    borderWidth: 1,
    borderColor: theme.colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Info Card
  infoCard: {
    backgroundColor: '#fff',
    borderRadius: theme.borderRadius.m,
    padding: theme.spacing.m,
    borderWidth: 1,
    borderColor: theme.colors.border,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 2,
    marginBottom: theme.spacing.xl,
  },
  fieldRowWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  fieldIcon: {
    fontSize: 22,
    width: 36,
    textAlign: 'center',
  },
  fieldTexts: {
    flex: 1,
    marginLeft: 8,
  },
  fieldLabel: {
    fontSize: 11,
    color: theme.colors.placeholder,
    textTransform: 'uppercase',
    fontWeight: '700',
    marginBottom: 2,
  },
  fieldValue: {
    fontSize: theme.fontSize.medium,
    color: theme.colors.text,
    fontWeight: '500',
  },
  fieldEmpty: {
    color: '#ccc',
    fontStyle: 'italic',
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginVertical: 4,
  },

  // Buttons
  copyBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#f0f4ff',
    borderRadius: theme.borderRadius.m,
  },
  copyBtnText: {
    fontSize: 12,
    color: theme.colors.primary,
    fontWeight: '600',
  },
  callBtn: {
    backgroundColor: '#eafaf1',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: theme.borderRadius.m,
    marginLeft: 12,
  },
  callBtnText: {
    fontSize: 14,
    color: '#27ae60',
    fontWeight: '700',
  },

  actionContainer: {
    gap: 16,
  },
  nfcBtn: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 16,
    borderRadius: theme.borderRadius.l,
    alignItems: 'center',
    shadowColor: theme.colors.primary,
    shadowOpacity: 0.2,
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
    fontSize: theme.fontSize.medium,
    fontWeight: '700',
  },
  deleteBtn: {
    backgroundColor: 'transparent',
    paddingVertical: 16,
    borderRadius: theme.borderRadius.l,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#e74c3c',
  },
  deleteBtnText: {
    color: '#e74c3c',
    fontSize: theme.fontSize.medium,
    fontWeight: '700',
  },
});
