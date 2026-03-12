import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { s, vs, ms } from 'react-native-size-matters';
import { useCards } from '../src/hooks/useCards';
import CardItem from '../src/components/CardItem';
import { COLORS, SIZES } from '../src/constants/theme';

export default function Dashboard() {
  const router = useRouter();
  const { cards, search, setSearch, loading } = useCards();

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="card-outline" size={s(64)} color={COLORS.gray} />
      <Text style={styles.emptyText}>No cards saved yet.</Text>
      <TouchableOpacity
        style={styles.emptyButton}
        onPress={() => router.push('/add-card')}
      >
        <Text style={styles.emptyButtonText}>Add Your First Card</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={s(20)} color={COLORS.gray} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search company, name, or phone..."
          value={search}
          onChangeText={setSearch}
          placeholderTextColor={COLORS.gray}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={s(20)} color={COLORS.gray} />
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <FlatList
          data={cards}
          keyExtractor={(item) => item.id!.toString()}
          renderItem={({ item }) => (
            <CardItem
              card={item}
              onPress={() => router.push(`/card/${item.id}`)}
            />
          )}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={renderEmpty}
        />
      )}

      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/add-card')}
      >
        <Ionicons name="add" size={s(32)} color={COLORS.white} />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    margin: SIZES.margin,
    paddingHorizontal: SIZES.padding,
    borderRadius: SIZES.radius,
    height: vs(45),
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  searchIcon: {
    marginRight: s(10),
  },
  searchInput: {
    flex: 1,
    fontSize: SIZES.font.md,
    color: COLORS.text,
  },
  listContent: {
    paddingHorizontal: SIZES.margin,
    paddingBottom: vs(80),
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: vs(100),
  },
  emptyText: {
    fontSize: SIZES.font.lg,
    color: COLORS.gray,
    marginTop: vs(16),
  },
  emptyButton: {
    marginTop: vs(24),
    backgroundColor: COLORS.primary,
    paddingVertical: vs(12),
    paddingHorizontal: s(24),
    borderRadius: SIZES.radius,
  },
  emptyButtonText: {
    color: COLORS.white,
    fontSize: SIZES.font.md,
    fontWeight: 'bold',
  },
  fab: {
    position: 'absolute',
    right: s(20),
    bottom: vs(20),
    width: s(56),
    height: s(56),
    borderRadius: s(28),
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
});
