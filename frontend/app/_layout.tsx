import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import * as Font from 'expo-font';
import { Ionicons } from '@expo/vector-icons';
import { Platform, View, ActivityIndicator, StyleSheet } from 'react-native';

export default function RootLayout() {
  const [fontsLoaded, setFontsLoaded] = useState(false);

  useEffect(() => {
    loadFonts();
  }, []);

  async function loadFonts() {
    try {
      // Lade Ionicons Font
      if (Platform.OS === 'web') {
        // Auf Web: Ignoriere Fehler, verwende Fallback
        await Font.loadAsync({
          ...Ionicons.font,
        }).catch((error) => {
          console.warn('Font loading failed on web, using fallback:', error);
          // Nicht kritisch - Web kann mit Fallback-Icons arbeiten
        });
      } else {
        // Auf Mobile: Warte auf Font-Loading
        await Font.loadAsync({
          ...Ionicons.font,
        });
      }
    } catch (error) {
      console.error('Error loading fonts:', error);
    } finally {
      setFontsLoaded(true);
    }
  }

  if (!fontsLoaded) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4CAF50" />
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    />
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#121212',
  },
});
