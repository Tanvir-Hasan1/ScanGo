import { useEffect, useState, useRef } from 'react';
import { RewardedAd, RewardedAdEventType, TestIds, AdEventType } from 'react-native-google-mobile-ads';
import { Platform } from 'react-native';

const adUnitId = __DEV__ ? TestIds.REWARDED : (Platform.OS === 'ios' ? 'ca-app-pub-3940256099942544/1712467313' : 'ca-app-pub-3940256099942544/5224354917');

export function useRewardedAd() {
  const [isLoaded, setIsLoaded] = useState(false);
  const rewardedRef = useRef<RewardedAd | null>(null);

  useEffect(() => {
    const rewarded = RewardedAd.createForAdRequest(adUnitId, {
      requestNonPersonalizedAdsOnly: true,
    });
    rewardedRef.current = rewarded;

    let isMounted = true;
    
    const unsubscribeLoaded = rewarded.addAdEventListener(RewardedAdEventType.LOADED, () => {
      console.log('Rewarded Ad LOADED successfully');
      if (isMounted) setIsLoaded(true);
    });

    const unsubscribeError = rewarded.addAdEventListener(AdEventType.ERROR, (error) => {
      console.error('Rewarded Ad failed to load: ', error);
      if (isMounted) setIsLoaded(false);
    });

    const unsubscribeClosed = rewarded.addAdEventListener(AdEventType.CLOSED, () => {
        if (isMounted) setIsLoaded(false);
        // Preload next reward ad
        rewarded.load();
    });

    // Start loading the rewarded ad straight away
    rewarded.load();

    return () => {
      isMounted = false;
      unsubscribeLoaded();
      unsubscribeClosed();
      unsubscribeError();
    };
  }, []);

  const showRewarded = (onRewardEarned?: (reward: any) => void, onAdClosed?: () => void) => {
    const rewarded = rewardedRef.current;
    if (isLoaded && rewarded) {
      if (onRewardEarned) {
        const unsubscribeEarned = rewarded.addAdEventListener(
          RewardedAdEventType.EARNED_REWARD,
          reward => {
             onRewardEarned(reward);
             unsubscribeEarned(); // clean up after awarding
          }
        );
      }
      
      if (onAdClosed) {
        const unsubscribeAdClosed = rewarded.addAdEventListener(AdEventType.CLOSED, () => {
          onAdClosed();
          unsubscribeAdClosed();
        });
      }
      
      rewarded.show();
      setIsLoaded(false);
    } else {
        console.log('Rewarded ad is not loaded yet');
        if (rewarded) rewarded.load();
        if (onAdClosed) onAdClosed();
    }
  };

  return { isLoaded, showRewarded };
}
