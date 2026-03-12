import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Alert } from 'react-native';
import { Camera, useCameraDevice, useCameraPermission } from 'react-native-vision-camera';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { s, vs, ms } from 'react-native-size-matters';
import * as FileSystem from 'expo-file-system';
import { COLORS, SIZES } from '../../src/constants/theme';

export default function AddCard() {
  const router = useRouter();
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('back');
  const camera = useRef<Camera>(null);

  const [frontImage, setFrontImage] = useState<string | null>(null);
  const [backImage, setBackImage] = useState<string | null>(null);
  const [isCapturingBack, setIsCapturingBack] = useState(false);

  useEffect(() => {
    if (!hasPermission) {
      requestPermission();
    }
  }, [hasPermission]);

  const takePhoto = async () => {
    if (!camera.current) return;

    try {
      const photo = await camera.current.takePhoto({
        flash: 'off',
      });

      const fileName = `temp_${Date.now()}.jpg`;
      const filePath = `${FileSystem.cacheDirectory}${fileName}`;
      await FileSystem.moveAsync({
        from: `file://${photo.path}`,
        to: filePath,
      });

      if (!isCapturingBack) {
        setFrontImage(filePath);
        setIsCapturingBack(true);
      } else {
        setBackImage(filePath);
      }
    } catch (error) {
      console.error('Failed to take photo:', error);
      Alert.alert('Error', 'Failed to take photo');
    }
  };

  const handleNext = () => {
    if (!frontImage) {
      Alert.alert('Error', 'Front image is required');
      return;
    }

    router.push({
      pathname: '/add-card/mapping',
      params: { 
        frontImage, 
        backImage: backImage || '' 
      }
    });
  };

  if (!hasPermission) {
    return (
      <View style={styles.center}>
        <Text>Camera permission is required</Text>
        <TouchableOpacity style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!device) {
    return (
      <View style={styles.center}>
        <Text>No camera device found</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.cameraContainer}>
        {!frontImage || (frontImage && isCapturingBack && !backImage) ? (
          <Camera
            ref={camera}
            style={StyleSheet.absoluteFill}
            device={device}
            isActive={true}
            photo={true}
          />
        ) : (
          <View style={styles.previewContainer}>
             <Image source={{ uri: isCapturingBack ? backImage! : frontImage! }} style={styles.preview} />
          </View>
        )}
        
        <View style={styles.overlay}>
          <View style={styles.guideContainer}>
             <View style={styles.guideFrame} />
             <Text style={styles.guideText}>
               {isCapturingBack ? 'Capture Back Side (Optional)' : 'Capture Front Side'}
             </Text>
          </View>
        </View>
      </View>

      <View style={styles.controls}>
        <View style={styles.thumbnails}>
          <View style={styles.thumbnailBox}>
            {frontImage && <Image source={{ uri: frontImage }} style={styles.thumbnail} />}
            <Text style={styles.thumbnailLabel}>Front</Text>
          </View>
          <View style={styles.thumbnailBox}>
            {backImage && <Image source={{ uri: backImage }} style={styles.thumbnail} />}
            <Text style={styles.thumbnailLabel}>Back</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.captureButton} onPress={takePhoto}>
          <View style={styles.captureInner} />
        </TouchableOpacity>

        <View style={styles.actionButtons}>
          <TouchableOpacity 
            style={styles.actionButton} 
            onPress={() => router.back()}
          >
            <Ionicons name="close" size={s(24)} color={COLORS.white} />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.actionButton, styles.nextButton]} 
            onPress={handleNext}
          >
            <Text style={styles.nextText}>Next</Text>
            <Ionicons name="arrow-forward" size={s(20)} color={COLORS.white} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.black,
  },
  cameraContainer: {
    flex: 3,
    overflow: 'hidden',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  guideContainer: {
    alignItems: 'center',
  },
  guideFrame: {
    width: s(300),
    height: s(180),
    borderWidth: 2,
    borderColor: COLORS.white,
    borderRadius: s(10),
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  guideText: {
    color: COLORS.white,
    marginTop: vs(20),
    fontSize: SIZES.font.md,
    fontWeight: 'bold',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 10,
  },
  controls: {
    flex: 1,
    backgroundColor: COLORS.dark,
    padding: SIZES.padding,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  thumbnails: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-around',
    marginBottom: vs(10),
  },
  thumbnailBox: {
    alignItems: 'center',
  },
  thumbnail: {
    width: s(60),
    height: s(40),
    borderRadius: s(4),
    backgroundColor: COLORS.gray,
  },
  thumbnailLabel: {
    color: COLORS.gray,
    fontSize: SIZES.font.xs,
    marginTop: vs(4),
  },
  captureButton: {
    width: s(70),
    height: s(70),
    borderRadius: s(35),
    borderWidth: 4,
    borderColor: COLORS.white,
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureInner: {
    width: s(54),
    height: s(54),
    borderRadius: s(27),
    backgroundColor: COLORS.white,
  },
  actionButtons: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  actionButton: {
    width: s(44),
    height: s(44),
    borderRadius: s(22),
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  nextButton: {
    flexDirection: 'row',
    width: 'auto',
    paddingHorizontal: s(16),
    backgroundColor: COLORS.primary,
  },
  nextText: {
    color: COLORS.white,
    fontWeight: 'bold',
    marginRight: s(5),
  },
  previewContainer: {
    ...StyleSheet.absoluteFillObject,
  },
  preview: {
    flex: 1,
    resizeMode: 'cover',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  button: {
    marginTop: vs(20),
    backgroundColor: COLORS.primary,
    padding: SIZES.padding,
    borderRadius: SIZES.radius,
  },
  buttonText: {
    color: COLORS.white,
    fontWeight: 'bold',
  },
});
