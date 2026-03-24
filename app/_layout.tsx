import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import 'react-native-reanimated';
import mobileAds from 'react-native-google-mobile-ads';

SplashScreen.preventAutoHideAsync();

export {
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

export default function RootLayout() {
  useEffect(() => {
    mobileAds()
      .initialize()
      .then(adapterStatuses => {
        // Initialization complete!
      });
      
    SplashScreen.hideAsync();
  }, []);

  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
    </Stack>
  );
}
