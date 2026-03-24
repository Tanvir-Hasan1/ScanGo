import React, { useState } from 'react';
import { View, Platform } from 'react-native';
import { BannerAd as GoogleBannerAd, BannerAdSize, TestIds } from 'react-native-google-mobile-ads';

// Use TestIds.BANNER for development modes
const adUnitId = __DEV__ ? TestIds.BANNER : (Platform.OS === 'ios' ? 'ca-app-pub-3940256099942544/2934735716' : 'ca-app-pub-3940256099942544/6300978111');

export default function BannerAd() {
  const [isAdLoaded, setIsAdLoaded] = useState(false);
  const [isAdFailed, setIsAdFailed] = useState(false);

  if (isAdFailed) {
    return null;
  }

  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', marginVertical: 10 }}>
      {/* BannerAd takes up size provided by BannerAdSize. */}
      <GoogleBannerAd
        unitId={adUnitId}
        size={BannerAdSize.BANNER}
        requestOptions={{
          requestNonPersonalizedAdsOnly: true,
        }}
        onAdLoaded={() => setIsAdLoaded(true)}
        onAdFailedToLoad={(error) => {
          console.error('Banner Ad failed to load: ', error);
          setIsAdFailed(true);
        }}
      />
    </View>
  );
}
