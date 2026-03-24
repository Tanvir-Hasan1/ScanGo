import { useEffect, useState } from 'react';
import { RewardedAd, RewardedAdEventType, TestIds, AdEventType } from 'react-native-google-mobile-ads';
import { Platform } from 'react-native';

const adUnitId = __DEV__ ? TestIds.REWARDED : (Platform.OS === 'ios' ? 'ca-app-pub-3940256099942544/1712467313' : 'ca-app-pub-3940256099942544/5224354917');

// Preload rewarded ad
const rewarded = RewardedAd.createForAdRequest(adUnitId, {
  requestNonPersonalizedAdsOnly: true,
});

export function useRewardedAd() {
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    let isMounted = true;
    
    const unsubscribeLoaded = rewarded.addAdEventListener(RewardedAdEventType.LOADED, () => {
      if (isMounted) setIsLoaded(true);
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
    };
  }, []);

  const showRewarded = (onRewardEarned?: (reward: any) => void) => {
    if (isLoaded) {
      // Create a one-off listener for the reward interaction
      const unsubscribeEarned = rewarded.addAdEventListener(
        RewardedAdEventType.EARNED_REWARD,
        reward => {
           if (onRewardEarned) onRewardEarned(reward);
           unsubscribeEarned(); // clean up after awarding
        }
      );
      
      rewarded.show();
      setIsLoaded(false);
    } else {
        console.log('Rewarded ad is not loaded yet');
        rewarded.load();
    }
  };

  return { isLoaded, showRewarded };
}
