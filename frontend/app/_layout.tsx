import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import * as Font from 'expo-font';
import { Ionicons } from '@expo/vector-icons';
import { Platform, View, ActivityIndicator } from 'react-native';

export default function RootLayout() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        if (Platform.OS === 'web') {
          // Web: Fehler/Timeouts einfach ignorieren
          Font.loadAsync(Ionicons.font).catch(() => {
            console.warn('Font loading failed on web, using fallback');
          });
        } else {
          // Mobile: sauber warten
          await Font.loadAsync(Ionicons.font);
        }
      } finally {
        setReady(true);
      }
    }
    load();
  }, []);

  if (!ready) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#121212' }}>
        <ActivityIndicator size="large" color="#4CAF50" />
      </View>
    );
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
