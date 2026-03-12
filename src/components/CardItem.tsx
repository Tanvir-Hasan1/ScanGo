import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { s, vs, ms } from 'react-native-size-matters';
import * as FileSystem from 'expo-file-system';
import { Card } from '../services/db';
import { COLORS, SIZES } from '../constants/theme';

interface CardItemProps {
  card: Card;
  onPress: () => void;
}

const CardItem: React.FC<CardItemProps> = ({ card, onPress }) => {
  const imageUri = `${FileSystem.documentDirectory}${card.front_image_name}`;

  return (
    <TouchableOpacity style={styles.container} onPress={onPress}>
      <Image source={{ uri: imageUri }} style={styles.image} defaultSource={require('../assets/placeholder.png')} />
      <View style={styles.info}>
        <Text style={styles.company} numberOfLines={1}>{card.company || 'Unknown Company'}</Text>
        <Text style={styles.name} numberOfLines={1}>{card.name}</Text>
        <Text style={styles.phone} numberOfLines={1}>{card.phone}</Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: COLORS.card,
    borderRadius: SIZES.radius,
    padding: SIZES.padding,
    marginBottom: SIZES.margin,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  image: {
    width: s(80),
    height: s(50),
    borderRadius: s(4),
    backgroundColor: COLORS.light,
  },
  info: {
    flex: 1,
    marginLeft: SIZES.padding,
    justifyContent: 'center',
  },
  company: {
    fontSize: SIZES.font.md,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  name: {
    fontSize: SIZES.font.sm,
    color: COLORS.subtext,
    marginTop: vs(2),
  },
  phone: {
    fontSize: SIZES.font.xs,
    color: COLORS.primary,
    marginTop: vs(2),
  },
});

export default CardItem;
