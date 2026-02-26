import { useEffect, useRef } from 'react';
import { Platform, Alert, PermissionsAndroid, AppState } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Only import on native platforms
let CallDetectorManager: any = null;
if (Platform.OS === 'android' || Platform.OS === 'ios') {
  try {
    CallDetectorManager = require('react-native-call-detection').default;
  } catch (e) {
    console.log('Call detection not available');
  }
}

const EXPO_PUBLIC_BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface CallDetectionServiceProps {
  onCallDetected?: () => void;
}

export default function CallDetectionService({
  onCallDetected,
}: CallDetectionServiceProps) {
  const router = useRouter();
  const callDetectorRef = useRef<any>(null);
  const lastPhoneNumberRef = useRef<string | null>(null);

  useEffect(() => {
    if (Platform.OS === 'android') {
      requestPermissions();
    } else {
      // iOS has limited call detection capabilities
      Alert.alert(
        'Hinweis',
        'Auf iOS ist die automatische Anruferkennung eingeschränkt. Bitte öffne Notizen manuell.'
      );
    }

    return () => {
      if (callDetectorRef.current) {
        callDetectorRef.current.dispose();
      }
    };
  }, []);

  const requestPermissions = async () => {
    try {
      if (Platform.OS === 'android' && Platform.Version >= 23) {
        const permissions = [
          PermissionsAndroid.PERMISSIONS.READ_PHONE_STATE,
          PermissionsAndroid.PERMISSIONS.READ_CALL_LOG,
        ];

        const granted = await PermissionsAndroid.requestMultiple(permissions);

        const allGranted = Object.values(granted).every(
          (status) => status === PermissionsAndroid.RESULTS.GRANTED
        );

        if (allGranted) {
          startCallDetection();
        } else {
          Alert.alert(
            'Berechtigungen erforderlich',
            'Bitte erlaube den Zugriff auf Anrufstatus, um automatische Notizen zu aktivieren.'
          );
        }
      } else {
        startCallDetection();
      }
    } catch (error) {
      console.error('Fehler bei Berechtigungsanfrage:', error);
    }
  };

  const startCallDetection = () => {
    try {
      if (!CallDetectorManager) {
        console.log('CallDetectorManager not available');
        return;
      }

      callDetectorRef.current = new CallDetectorManager(
        (event: any, phoneNumber: string | null) => {
          console.log('Call Event:', event, 'Phone Number:', phoneNumber);

          if (event === 'Connected' || event === 'Incoming') {
            handleCallStarted(phoneNumber);
          } else if (event === 'Disconnected') {
            handleCallEnded();
          }
        },
        false, // Read call number from call log (requires READ_CALL_LOG permission)
        () => {
          console.log('Permissions granted for call detection');
        },
        () => {
          console.log('Permissions denied for call detection');
          Alert.alert(
            'Berechtigungen verweigert',
            'Die App benötigt Zugriff auf Anrufstatus für automatische Notizen.'
          );
        }
      );
    } catch (error) {
      console.error('Fehler beim Starten der Anruferkennung:', error);
    }
  };

  const handleCallStarted = async (phoneNumber: string | null) => {
    if (!phoneNumber) {
      phoneNumber = 'Unbekannte Nummer';
    }

    console.log('Call started with:', phoneNumber);
    lastPhoneNumberRef.current = phoneNumber;

    try {
      // Store current call in AsyncStorage
      await AsyncStorage.setItem('currentCall', phoneNumber);

      // Mark call started in backend
      await fetch(
        `${EXPO_PUBLIC_BACKEND_URL}/api/notes/${encodeURIComponent(phoneNumber)}/call-started`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      // Navigate to note detail screen
      router.push(`/note-detail/${encodeURIComponent(phoneNumber)}`);

      if (onCallDetected) {
        onCallDetected();
      }
    } catch (error) {
      console.error('Fehler beim Verarbeiten des Anrufs:', error);
    }
  };

  const handleCallEnded = async () => {
    console.log('Call ended');
    
    try {
      await AsyncStorage.removeItem('currentCall');
      
      if (onCallDetected) {
        onCallDetected();
      }
    } catch (error) {
      console.error('Fehler beim Beenden des Anrufs:', error);
    }
  };

  // This component doesn't render anything
  return null;
}
