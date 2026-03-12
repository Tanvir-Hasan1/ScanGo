import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  TouchableOpacity,
  Alert,
  Linking,
  Clipboard,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { s, vs, ms } from 'react-native-size-matters';
import * as FileSystem from 'expo-file-system';
import Share from 'react-native-share';
import { getCardById, deleteCard, Card } from '../../src/services/db';
import { shareCardViaNfc, startNfcService } from '../../src/services/nfc';
import { COLORS, SIZES } from '../../src/constants/theme';

export default function CardDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [card, setCard] = useState<Card | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCard = async () => {
      try {
        const data = await getCardById(parseInt(id));
        if (data) {
          setCard(data);
        } else {
          Alert.alert('Error', 'Card not found');
          router.back();
        }
      } catch (error) {
        console.error('Error fetching card:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchCard();
    startNfcService();
  }, [id]);

  const handleCall = () => {
    if (card?.phone) {
      Linking.openURL(`tel:${card.phone}`);
    }
  };

  const handleCopy = (text: string, label: string) => {
    Clipboard.setString(text);
    Alert.alert('Copied', `${label} copied to clipboard`);
  };

  const handleShare = async () => {
    if (!card) return;
    try {
      const frontUri = `${FileSystem.documentDirectory}${card.front_image_name}`;
      const backUri = card.back_image_name ? `${FileSystem.documentDirectory}${card.back_image_name}` : null;
      
      const options = {
        title: card.company,
        message: `Contact Info:\nName: ${card.name}\nPhone: ${card.phone}\nAddress: ${card.address}`,
        urls: [frontUri, backUri].filter(Boolean) as string[],
      };
      await Share.open(options);
    } catch (error) {
      console.error('Share Error:', error);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Card',
      'Are you sure you want to delete this card?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteCard(parseInt(id));
              router.push('/');
            } catch (error) {
              Alert.alert('Error', 'Failed to delete card');
            }
          },
        },
      ]
    );
  };

  const handleNfcShare = async () => {
    if (!card) return;
    Alert.alert('NFC Share', 'Approach your phone to another NFC-enabled device to share this card.');
    const success = await shareCardViaNfc(card);
    if (success) {
      Alert.alert('Success', 'Card shared via NFC!');
    }
  };

  if (loading || !card) {
    return (
      <View style={styles.center}>
        <Text>Loading card details...</Text>
      </View>
    );
  }

  const frontUri = `${FileSystem.documentDirectory}${card.front_image_name}`;
  const backUri = card.back_image_name ? `${FileSystem.documentDirectory}${card.back_image_name}` : null;

  return (
    <ScrollView style={styles.container}>
      <View style={styles.imageSection}>
        <Image source={{ uri: frontUri }} style={styles.cardImage} resizeMode="contain" />
        {backUri && (
          <Image source={{ uri: backUri }} style={[styles.cardImage, styles.backImage]} resizeMode="contain" />
        )}
      </View>

      <View style={styles.detailsSection}>
        <View style={styles.header}>
          <View>
            <Text style={styles.company}>{card.company || 'No Company'}</Text>
            <Text style={styles.name}>{card.name}</Text>
          </View>
          <TouchableOpacity onPress={handleDelete}>
            <Ionicons name="trash-outline" size={s(24)} color={COLORS.danger} />
          </TouchableOpacity>
        </View>

        <View style={styles.divider} />

        <TouchableOpacity 
          style={styles.infoRow} 
          onPress={handleCall}
          onLongPress={() => handleCopy(card.phone, 'Phone number')}
        >
          <View style={styles.iconBox}>
            <Ionicons name="call" size={s(20)} color={COLORS.primary} />
          </View>
          <View style={styles.infoText}>
            <Text style={styles.label}>Phone</Text>
            <Text style={styles.value}>{card.phone}</Text>
          </View>
          <Ionicons name="chevron-forward" size={s(20)} color={COLORS.gray} />
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.infoRow}
          onPress={() => handleCopy(card.address, 'Address')}
        >
          <View style={styles.iconBox}>
            <Ionicons name="location" size={s(20)} color={COLORS.primary} />
          </View>
          <View style={styles.infoText}>
            <Text style={styles.label}>Address</Text>
            <Text style={styles.value}>{card.address || 'No address provided'}</Text>
          </View>
          <Ionicons name="copy-outline" size={s(20)} color={COLORS.gray} />
        </TouchableOpacity>

        <View style={styles.actionGrid}>
          <TouchableOpacity style={styles.actionBtn} onPress={handleShare}>
            <Ionicons name="share-social" size={s(24)} color={COLORS.white} />
            <Text style={styles.actionBtnText}>Share</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.actionBtn, styles.nfcBtn]} onPress={handleNfcShare}>
            <Ionicons name="wifi" size={s(24)} color={COLORS.white} />
            <Text style={styles.actionBtnText}>NFC Share</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  imageSection: {
    padding: SIZES.padding,
    backgroundColor: COLORS.dark,
    alignItems: 'center',
  },
  cardImage: {
    width: '100%',
    height: vs(180),
    borderRadius: SIZES.radius,
    backgroundColor: COLORS.gray,
  },
  backImage: {
    marginTop: vs(16),
  },
  detailsSection: {
    padding: SIZES.padding,
    backgroundColor: COLORS.white,
    borderTopLeftRadius: SIZES.radius * 2,
    borderTopRightRadius: SIZES.radius * 2,
    marginTop: -vs(20),
    minHeight: vs(400),
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: vs(20),
  },
  company: {
    fontSize: SIZES.font.title,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  name: {
    fontSize: SIZES.font.lg,
    color: COLORS.subtext,
    marginTop: vs(4),
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.light,
    marginBottom: vs(20),
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: vs(20),
    backgroundColor: COLORS.background,
    padding: SIZES.padding,
    borderRadius: SIZES.radius,
  },
  iconBox: {
    width: s(40),
    height: s(40),
    borderRadius: s(20),
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoText: {
    flex: 1,
    marginLeft: s(16),
  },
  label: {
    fontSize: SIZES.font.xs,
    color: COLORS.gray,
  },
  value: {
    fontSize: SIZES.font.md,
    color: COLORS.text,
    fontWeight: '500',
    marginTop: vs(2),
  },
  actionGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: vs(20),
  },
  actionBtn: {
    flex: 0.48,
    flexDirection: 'row',
    height: vs(50),
    backgroundColor: COLORS.primary,
    borderRadius: SIZES.radius,
    justifyContent: 'center',
    alignItems: 'center',
  },
  nfcBtn: {
    backgroundColor: COLORS.secondary,
  },
  actionBtnText: {
    color: COLORS.white,
    fontWeight: 'bold',
    marginLeft: s(8),
    fontSize: SIZES.font.md,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
