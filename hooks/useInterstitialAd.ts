import { useEffect, useState, useRef } from 'react';
import { InterstitialAd, AdEventType, TestIds } from 'react-native-google-mobile-ads';
import { Platform } from 'react-native';

const adUnitId = __DEV__ ? TestIds.INTERSTITIAL : (Platform.OS === 'ios' ? 'ca-app-pub-3940256099942544/4411468910' : 'ca-app-pub-3940256099942544/1033173712');

export function useInterstitialAd() {
  const [isLoaded, setIsLoaded] = useState(false);
  const interstitialRef = useRef<InterstitialAd | null>(null);

  useEffect(() => {
    const interstitial = InterstitialAd.createForAdRequest(adUnitId, {
      requestNonPersonalizedAdsOnly: true,
    });
    interstitialRef.current = interstitial;

    let isMounted = true;

    const unsubscribeLoaded = interstitial.addAdEventListener(AdEventType.LOADED, () => {
      console.log('Interstitial Ad LOADED successfully');
      if (isMounted) setIsLoaded(true);
    });

    const unsubscribeError = interstitial.addAdEventListener(AdEventType.ERROR, (error) => {
      console.error('Interstitial Ad failed to load: ', error);
      if (isMounted) setIsLoaded(false);
    });

    const unsubscribeClosed = interstitial.addAdEventListener(AdEventType.CLOSED, () => {
       if (isMounted) setIsLoaded(false);
       // Load the next ad for future use
       interstitial.load(); 
    });

    // Initial load
    interstitial.load();

    return () => {
      isMounted = false;
      unsubscribeLoaded();
      unsubscribeClosed();
      unsubscribeError();
    };
  }, []);

  const showInterstitial = (onAdClosed?: () => void) => {
    const interstitial = interstitialRef.current;
    if (isLoaded && interstitial) {
      if (onAdClosed) {
        const unsubscribe = interstitial.addAdEventListener(AdEventType.CLOSED, () => {
          onAdClosed();
          unsubscribe();
        });
      }
      interstitial.show();
      setIsLoaded(false);
    } else {
      console.log('Interstitial ad not loaded yet');
      if (interstitial) interstitial.load();
      if (onAdClosed) onAdClosed(); // Proceed immediately if there's no ad ready
    }
  };

  return { isLoaded, showInterstitial };
}
