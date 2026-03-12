import { useEffect } from 'react';
import { TouchableOpacity } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { s } from 'react-native-size-matters';
import { initDatabase } from '../src/services/db';

export default function RootLayout() {
  const router = useRouter();
  useEffect(() => {
    initDatabase();
  }, []);

  return (
    <>
      <StatusBar style="auto" />
      <Stack
        screenOptions={{
          headerStyle: {
            backgroundColor: '#1E1E1E',
          },
          headerTintColor: '#fff',
          headerTitleStyle: {
            fontWeight: 'bold',
          },
        }}
      >
        <Stack.Screen name="index" options={{ 
          title: 'ScanGo',
          headerRight: () => (
            <TouchableOpacity onPress={() => router.push('/settings')} style={{ marginRight: s(10) }}>
              <Ionicons name="settings-outline" size={s(22)} color="#fff" />
            </TouchableOpacity>
          )
        }} />
        <Stack.Screen name="add-card/index" options={{ title: 'Capture Card' }} />
        <Stack.Screen name="add-card/mapping" options={{ title: 'Map Fields' }} />
        <Stack.Screen name="card/[id]" options={{ title: 'Card Details' }} />
        <Stack.Screen name="settings" options={{ title: 'Backup & Restore' }} />
      </Stack>
    </>
  );
}
