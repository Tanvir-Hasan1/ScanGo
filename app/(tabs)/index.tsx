import React, { useState, useCallback, useRef } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import * as FileSystem from 'expo-file-system/legacy';
import { moderateScale, scale, verticalScale } from 'react-native-size-matters';
import { theme } from '../../theme';
import { initDB, searchCards } from '../../services/dbService';

// ─── Types ────────────────────────────────────────────────────────────────────

type Card = {
  id: string;
  name: string;
  company: string;
  phone: string;
  address: string;
  front_image: string;
  back_image: string;
  timestamp: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function resolveImageUri(filename: string): string | null {
  if (!filename) return null;
  // If it's already an absolute path (legacy data), use as-is
  if (filename.startsWith('file://') || filename.startsWith('/')) return filename;
  return (FileSystem.documentDirectory ?? '') + filename;
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <View style={styles.emptyWrap}>
      <Text style={styles.emptyIcon}>🗂️</Text>
      <Text style={styles.emptyTitle}>No Cards Yet</Text>
      <Text style={styles.emptySubtitle}>
        Scan your first business card{'\n'}to get started.
      </Text>
      <TouchableOpacity style={styles.emptyBtn} onPress={onAdd} activeOpacity={0.85}>
        <Text style={styles.emptyBtnText}>+ Scan a Card</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Card Item ────────────────────────────────────────────────────────────────

function CardItem({ item, onPress }: { item: Card; onPress: () => void }) {
  const imageUri = resolveImageUri(item.front_image);
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.82}>
      {/* Thumbnail */}
      <View style={styles.thumbWrap}>
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={styles.thumb} resizeMode="cover" />
        ) : (
          <View style={[styles.thumb, styles.thumbPlaceholder]}>
            <Text style={styles.thumbPlaceholderIcon}>💼</Text>
          </View>
        )}
      </View>

      {/* Info */}
      <View style={styles.cardInfo}>
        <Text style={styles.cardName} numberOfLines={1}>
          {item.name || 'Unknown Name'}
        </Text>
        <Text style={styles.cardCompany} numberOfLines={1}>
          {item.company || '—'}
        </Text>
        {!!item.phone && (
          <Text style={styles.cardPhone} numberOfLines={1}>
            📞 {item.phone}
          </Text>
        )}
      </View>

      {/* Chevron */}
      <Text style={styles.chevron}>›</Text>
    </TouchableOpacity>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const router = useRouter();
  const [cards, setCards] = useState<Card[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadCards = useCallback(async (q = '') => {
    try {
      setLoading(true);
      await initDB();
      const data = await searchCards(q);
      setCards(data as Card[]);
    } catch (err) {
      console.error('Error loading cards:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Reload when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadCards(query);
    }, [loadCards, query])
  );

  const handleSearch = (text: string) => {
    setQuery(text);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => loadCards(text), 300);
  };

  const handleAddCard = () => router.push('/add-card');
  const handleCardPress = (id: string) => router.push(`/card/${id}`);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>ScanGo</Text>
          <Text style={styles.headerSubtitle}>
            {cards.length} {cards.length === 1 ? 'card' : 'cards'} saved
          </Text>
        </View>
      </View>

      {/* ── Search Bar ── */}
      <View style={styles.searchWrap}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name, company or phone…"
          placeholderTextColor={theme.colors.placeholder}
          value={query}
          onChangeText={handleSearch}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => { setQuery(''); loadCards(''); }}>
            <Text style={styles.clearBtn}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ── List ── */}
      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : (
        <FlatList
          data={cards}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <CardItem item={item} onPress={() => handleCardPress(item.id)} />
          )}
          contentContainerStyle={[
            styles.listContent,
            cards.length === 0 && styles.listContentEmpty,
          ]}
          ListEmptyComponent={<EmptyState onAdd={handleAddCard} />}
          showsVerticalScrollIndicator={false}
          keyboardDismissMode="on-drag"
        />
      )}

      {/* ── FAB ── */}
      {!loading && cards.length > 0 && (
        <TouchableOpacity style={styles.fab} onPress={handleAddCard} activeOpacity={0.85}>
          <Text style={styles.fabIcon}>+</Text>
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const THUMB_SIZE = scale(60);
const FAB_SIZE = scale(58);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: moderateScale(20),
    paddingTop: verticalScale(12),
    paddingBottom: verticalScale(8),
    backgroundColor: theme.colors.primary,
  },
  headerTitle: {
    fontSize: moderateScale(26),
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    fontSize: moderateScale(12),
    color: 'rgba(255,255,255,0.75)',
    marginTop: verticalScale(2),
    fontWeight: '500',
  },

  // Search
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f2f5fa',
    marginHorizontal: moderateScale(16),
    marginVertical: verticalScale(12),
    borderRadius: moderateScale(12),
    paddingHorizontal: moderateScale(12),
    paddingVertical: verticalScale(8),
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  searchIcon: {
    fontSize: moderateScale(16),
    marginRight: moderateScale(8),
  },
  searchInput: {
    flex: 1,
    fontSize: moderateScale(14),
    color: theme.colors.text,
    paddingVertical: 0,
  },
  clearBtn: {
    fontSize: moderateScale(14),
    color: theme.colors.placeholder,
    paddingHorizontal: moderateScale(4),
  },

  // List
  listContent: {
    paddingHorizontal: moderateScale(16),
    paddingBottom: verticalScale(100),
  },
  listContentEmpty: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  loadingWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Card Item
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: moderateScale(14),
    marginBottom: verticalScale(10),
    padding: moderateScale(12),
    shadowColor: '#000',
    shadowOpacity: 0.07,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  thumbWrap: {
    marginRight: moderateScale(12),
  },
  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE * 0.63, // ~business card aspect
    borderRadius: moderateScale(6),
    backgroundColor: '#e8eaf6',
  },
  thumbPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  thumbPlaceholderIcon: {
    fontSize: moderateScale(22),
  },
  cardInfo: {
    flex: 1,
    gap: verticalScale(3),
  },
  cardName: {
    fontSize: moderateScale(15),
    fontWeight: '700',
    color: theme.colors.text,
  },
  cardCompany: {
    fontSize: moderateScale(13),
    color: theme.colors.placeholder,
    fontWeight: '500',
  },
  cardPhone: {
    fontSize: moderateScale(12),
    color: theme.colors.placeholder,
  },
  chevron: {
    fontSize: moderateScale(22),
    color: theme.colors.border,
    marginLeft: moderateScale(8),
  },

  // Empty State
  emptyWrap: {
    alignItems: 'center',
    paddingHorizontal: moderateScale(32),
    gap: verticalScale(10),
  },
  emptyIcon: {
    fontSize: moderateScale(72),
    marginBottom: verticalScale(8),
  },
  emptyTitle: {
    fontSize: moderateScale(22),
    fontWeight: '800',
    color: theme.colors.text,
  },
  emptySubtitle: {
    fontSize: moderateScale(14),
    color: theme.colors.placeholder,
    textAlign: 'center',
    lineHeight: moderateScale(22),
  },
  emptyBtn: {
    marginTop: verticalScale(16),
    backgroundColor: theme.colors.primary,
    paddingVertical: verticalScale(14),
    paddingHorizontal: moderateScale(32),
    borderRadius: moderateScale(12),
    shadowColor: theme.colors.primary,
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 4,
  },
  emptyBtnText: {
    color: '#fff',
    fontSize: moderateScale(15),
    fontWeight: '700',
  },

  // FAB
  fab: {
    position: 'absolute',
    bottom: verticalScale(24),
    right: scale(20),
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: theme.colors.primary,
    shadowOpacity: 0.4,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 12,
    elevation: 8,
  },
  fabIcon: {
    fontSize: moderateScale(30),
    color: '#fff',
    lineHeight: moderateScale(34),
    fontWeight: '300',
  },
});
