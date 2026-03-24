import { useEffect, useState } from 'react';
import { InterstitialAd, AdEventType, TestIds } from 'react-native-google-mobile-ads';
import { Platform } from 'react-native';

const adUnitId = __DEV__ ? TestIds.INTERSTITIAL : (Platform.OS === 'ios' ? 'ca-app-pub-3940256099942544/4411468910' : 'ca-app-pub-3940256099942544/1033173712');

// Preload interstitial
const interstitial = InterstitialAd.createForAdRequest(adUnitId, {
  requestNonPersonalizedAdsOnly: true,
});

export function useInterstitialAd() {
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    let unsubscribeLoaded: () => void;
    let unsubscribeClosed: () => void;

    let isMounted = true;

    unsubscribeLoaded = interstitial.addAdEventListener(AdEventType.LOADED, () => {
      if (isMounted) setIsLoaded(true);
    });

    unsubscribeClosed = interstitial.addAdEventListener(AdEventType.CLOSED, () => {
       if (isMounted) setIsLoaded(false);
       // Load the next ad for future use
       interstitial.load(); 
    });

    // Initial load
    interstitial.load();

    return () => {
      isMounted = false;
      if (unsubscribeLoaded) unsubscribeLoaded();
      if (unsubscribeClosed) unsubscribeClosed();
    };
  }, []);

  const showInterstitial = () => {
    if (isLoaded) {
      interstitial.show();
      setIsLoaded(false);
    } else {
      console.log('Interstitial ad not loaded yet');
      // Attempt to load for next time
      interstitial.load();
    }
  };

  return { isLoaded, showInterstitial };
}
