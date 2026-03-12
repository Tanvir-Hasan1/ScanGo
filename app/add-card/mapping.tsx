import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  Dimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { s, vs, ms } from 'react-native-size-matters';
import * as FileSystem from 'expo-file-system';
import { recognizeText, TextBlock } from '../../src/services/ocr';
import { addCard } from '../../src/services/db';
import { COLORS, SIZES } from '../../src/constants/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type FieldType = 'name' | 'company' | 'phone' | 'address';

export default function MappingUI() {
  const router = useRouter();
  const { frontImage, backImage } = useLocalSearchParams<{ frontImage: string; backImage: string }>();

  const [ocrBlocks, setOcrBlocks] = useState<TextBlock[]>([]);
  const [activeField, setActiveField] = useState<FieldType>('name');
  const [formData, setFormData] = useState({
    name: '',
    company: '',
    phone: '',
    address: '',
  });
  const [loading, setLoading] = useState(true);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const processOCR = async () => {
      setLoading(true);
      try {
        const blocks = await recognizeText(frontImage);
        setOcrBlocks(blocks);
        
        Image.getSize(frontImage, (w, h) => {
          setImageSize({ width: w, height: h });
        });
      } catch (error) {
        console.error('OCR Process Error:', error);
      } finally {
        setLoading(false);
      }
    };

    processOCR();
  }, [frontImage]);

  const handleBlockPress = (block: TextBlock) => {
    setFormData(prev => ({
      ...prev,
      [activeField]: prev[activeField as keyof typeof prev] 
        ? `${prev[activeField as keyof typeof prev]} ${block.text}`
        : block.text
    }));
  };

  const handleSave = async () => {
    if (!formData.name) {
      Alert.alert('Error', 'Name is required');
      return;
    }

    try {
      const frontFileName = `front_${Date.now()}.jpg`;
      const backFileName = backImage ? `back_${Date.now()}.jpg` : '';

      await FileSystem.copyAsync({
        from: frontImage,
        to: `${FileSystem.documentDirectory}${frontFileName}`,
      });

      if (backImage) {
        await FileSystem.copyAsync({
          from: backImage,
          to: `${FileSystem.documentDirectory}${backFileName}`,
        });
      }

      await addCard({
        ...formData,
        front_image_name: frontFileName,
        back_image_name: backFileName || undefined,
      });

      Alert.alert('Success', 'Card saved successfully', [
        { text: 'OK', onPress: () => router.push('/') }
      ]);
    } catch (error) {
      console.error('Save Error:', error);
      Alert.alert('Error', 'Failed to save card');
    }
  };

  const renderField = (field: FieldType, label: string, icon: string) => (
    <TouchableOpacity
      style={[styles.fieldRow, activeField === field && styles.activeFieldRow]}
      onPress={() => setActiveField(field)}
    >
      <Ionicons 
        name={icon as any} 
        size={s(20)} 
        color={activeField === field ? COLORS.primary : COLORS.gray} 
      />
      <View style={styles.fieldTextContainer}>
        <Text style={styles.fieldLabel}>{label}</Text>
        <TextInput
          style={styles.fieldInput}
          value={formData[field]}
          onChangeText={(text) => setFormData(prev => ({ ...prev, [field]: text }))}
          placeholder={`Tap text from image or type...`}
          placeholderTextColor={COLORS.gray}
        />
      </View>
      {formData[field].length > 0 && (
        <TouchableOpacity onPress={() => setFormData(prev => ({ ...prev, [field]: '' }))}>
          <Ionicons name="close-circle" size={s(16)} color={COLORS.gray} />
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.imageSection}>
        {loading ? (
          <View style={styles.loader}>
            <Text style={styles.loadingText}>Processing OCR...</Text>
          </View>
        ) : (
          <View style={styles.ocrContainer}>
            <Image 
              source={{ uri: frontImage }} 
              style={styles.cardImage} 
              resizeMode="contain" 
            />
            {imageSize.width > 0 && ocrBlocks.map((block, index) => {
              if (!block.frame) return null;
              
              // Map coordinates from image to screen
              const scale = SCREEN_WIDTH / imageSize.width;
              // Note: This is a simplification. ResizeMode="contain" makes it more complex.
              // For now, we'll list the blocks below if coordinate mapping is too tricky.
              return null; 
            })}
          </View>
        )}
      </View>

      <View style={styles.formSection}>
        <Text style={styles.sectionTitle}>Detected Text Blocks</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tagsContainer}>
          {ocrBlocks.map((block, index) => (
            <TouchableOpacity 
              key={index} 
              style={styles.tag}
              onPress={() => handleBlockPress(block)}
            >
              <Text style={styles.tagText}>{block.text}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <ScrollView style={styles.fieldsScroll}>
          {renderField('name', 'Full Name', 'person')}
          {renderField('company', 'Company Name', 'business')}
          {renderField('phone', 'Phone Number', 'call')}
          {renderField('address', 'Address', 'location')}
        </ScrollView>

        <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
          <Text style={styles.saveButtonText}>Save Visiting Card</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  imageSection: {
    flex: 1,
    backgroundColor: COLORS.black,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardImage: {
    width: SCREEN_WIDTH,
    height: vs(200),
  },
  loader: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: COLORS.white,
    fontSize: SIZES.font.md,
  },
  formSection: {
    flex: 1.5,
    padding: SIZES.padding,
    borderTopLeftRadius: SIZES.radius * 2,
    borderTopRightRadius: SIZES.radius * 2,
    backgroundColor: COLORS.white,
    marginTop: -vs(20),
  },
  sectionTitle: {
    fontSize: SIZES.font.sm,
    fontWeight: 'bold',
    color: COLORS.gray,
    marginBottom: vs(10),
    textTransform: 'uppercase',
  },
  tagsContainer: {
    maxHeight: vs(40),
    marginBottom: vs(20),
  },
  tag: {
    backgroundColor: COLORS.light,
    paddingHorizontal: s(12),
    paddingVertical: vs(6),
    borderRadius: s(20),
    marginRight: s(10),
    borderWidth: 1,
    borderColor: '#ddd',
  },
  tagText: {
    fontSize: SIZES.font.sm,
    color: COLORS.text,
  },
  fieldsScroll: {
    flex: 1,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SIZES.padding,
    backgroundColor: COLORS.background,
    borderRadius: SIZES.radius,
    marginBottom: vs(12),
    borderWidth: 1,
    borderColor: 'transparent',
  },
  activeFieldRow: {
    borderColor: COLORS.primary,
    backgroundColor: 'rgba(0, 122, 255, 0.05)',
  },
  fieldTextContainer: {
    flex: 1,
    marginLeft: s(12),
  },
  fieldLabel: {
    fontSize: SIZES.font.xs,
    color: COLORS.gray,
  },
  fieldInput: {
    fontSize: SIZES.font.md,
    color: COLORS.text,
    marginTop: vs(2),
    padding: 0,
  },
  saveButton: {
    backgroundColor: COLORS.primary,
    padding: SIZES.padding,
    borderRadius: SIZES.radius,
    alignItems: 'center',
    marginTop: vs(10),
  },
  saveButtonText: {
    color: COLORS.white,
    fontSize: SIZES.font.md,
    fontWeight: 'bold',
  },
  ocrContainer: {
    width: '100%',
    height: vs(200),
    justifyContent: 'center',
    alignItems: 'center',
  }
});
