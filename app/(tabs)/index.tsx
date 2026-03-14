import React, { useState, useCallback } from 'react';
import { StyleSheet, Text, View, FlatList, TouchableOpacity } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { theme } from '../../theme';
import { initDB, getAllCards, deleteCard, addCard } from '../../services/dbService';

export default function HomeScreen() {
  const [cards, setCards] = useState<any[]>([]);

  useFocusEffect(
    useCallback(() => {
      loadCards();
    }, [])
  );

  const loadCards = async () => {
    try {
      await initDB();
      const data = await getAllCards();
      setCards(data);
    } catch (error) {
      console.error('Error loading cards:', error);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteCard(id);
      loadCards();
    } catch (error) {
      console.error('Error deleting card:', error);
    }
  };

  // Temporary function to add dummy data
  const handleAddDummy = async () => {
    try {
      await addCard({
        name: 'John Doe',
        company: 'Example Corp',
        phone: '123-456-7890',
        address: '123 Main St',
        front_image: 'front.jpg',
        back_image: 'back.jpg'
      });
      loadCards();
    } catch (error) {
      console.error('Error adding dummy card:', error);
    }
  };

  const renderItem = ({ item }: { item: any }) => (
    <View style={styles.cardItem}>
      <View style={styles.cardInfo}>
        <Text style={styles.cardName}>{item.name || 'Unknown Name'}</Text>
        <Text style={styles.cardCompany}>{item.company || 'Unknown Company'}</Text>
      </View>
      <TouchableOpacity style={styles.deleteButton} onPress={() => handleDelete(item.id)}>
        <Text style={styles.deleteText}>Delete</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Home Screen</Text>
      <View style={styles.separator} />

      <TouchableOpacity style={styles.dummyButton} onPress={handleAddDummy}>
        <Text style={styles.dummyButtonText}>+ Add Dummy Card</Text>
      </TouchableOpacity>
      
      {cards.length === 0 ? (
        <Text style={styles.subtitle}>List of cards will appear here.</Text>
      ) : (
        <FlatList
          data={cards}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          style={{ width: '100%' }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    paddingTop: theme.spacing.xl * 2,
    backgroundColor: theme.colors.background,
  },
  title: {
    fontSize: theme.fontSize.xlarge,
    fontWeight: 'bold',
    color: theme.colors.primary,
  },
  subtitle: {
    fontSize: theme.fontSize.medium,
    color: theme.colors.text,
    marginTop: theme.spacing.m,
  },
  separator: {
    marginVertical: theme.spacing.m,
    height: 1,
    width: '80%',
    backgroundColor: theme.colors.border,
  },
  dummyButton: {
    backgroundColor: theme.colors.primary,
    padding: theme.spacing.s,
    borderRadius: theme.borderRadius.s,
    marginBottom: theme.spacing.m,
  },
  dummyButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  list: {
    paddingHorizontal: theme.spacing.m,
    paddingBottom: theme.spacing.xl,
  },
  cardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing.m,
    backgroundColor: '#fff',
    borderRadius: theme.borderRadius.m,
    marginBottom: theme.spacing.s,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  cardInfo: {
    flex: 1,
  },
  cardName: {
    fontSize: theme.fontSize.large,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: theme.spacing.s / 2,
  },
  cardCompany: {
    fontSize: theme.fontSize.medium,
    color: theme.colors.placeholder,
  },
  deleteButton: {
    padding: theme.spacing.s,
    backgroundColor: '#FF3B30',
    borderRadius: theme.borderRadius.s,
  },
  deleteText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: theme.fontSize.small,
  },
});
