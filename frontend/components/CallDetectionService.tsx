import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Platform, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { markCallStarted } from '../utils/database';
import { PermissionsAndroid } from 'react-native';

interface CallDetectionServiceProps {
  onCallDetected?: (phoneNumber: string) => void;
}

const CallDetectionService: React.FC<CallDetectionServiceProps> = ({ onCallDetected }) => {
  const navigation = useNavigation();
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const callDetectionRef = useRef<any>(null);

  useEffect(() => {
    if (Platform.OS !== 'android') return;

    const checkAndStart = async () => {
      await checkPermissions();
    };
    checkAndStart();

    // Cleanup-Funktion für Memory Leak Prevention
    return () => {
      cleanupCallDetection();
    };
  }, []);

  const cleanupCallDetection = useCallback(() => {
    if (callDetectionRef.current) {
      try {
        // Stoppe die Call Detection
        if (typeof callDetectionRef.current.dispose === 'function') {
          callDetectionRef.current.dispose();
        }
        callDetectionRef.current = null;
      } catch (error) {
        console.error('Fehler beim Stoppen der Call Detection:', error);
      }
    }
  }, []);

  const checkPermissions = useCallback(async () => {
    try {
      if (Platform.OS === 'android') {
        // Berechtigungen anfordern
        const permissions = [
          PermissionsAndroid.PERMISSIONS.READ_PHONE_STATE,
          PermissionsAndroid.PERMISSIONS.READ_CALL_LOG,
          PermissionsAndroid.PERMISSIONS.PROCESS_OUTGOING_CALLS,
        ];

        const granted = await PermissionsAndroid.requestMultiple(permissions);

        const allGranted = Object.values(granted).every(
          status => status === PermissionsAndroid.RESULTS.GRANTED
        );

        if (allGranted) {
          setHasPermission(true);
          startCallDetection();
        } else {
          setHasPermission(false);
          Alert.alert(
            'Berechtigungen erforderlich',
            'Bitte erlaube den Zugriff auf Anrufstatus, um automatische Notizen zu aktivieren.'
          );
        }
      } else {
        // Auf iOS nicht verfügbar
        setHasPermission(false);
      }
    } catch (error) {
      console.error('Fehler bei der Berechtigungsanfrage:', error);
      setHasPermission(false);
    }
  }, []);

  const startCallDetection = useCallback(() => {
    if (Platform.OS !== 'android' || !hasPermission) return;

    try {
      // Cleanup vorheriger Instanz
      cleanupCallDetection();

      // Import dynamisch, um Fehler auf iOS zu vermeiden
      const CallDetection = require('react-native-call-detection');
      
      callDetectionRef.current = new CallDetection((event: any, phoneNumber: string | null) => {
        if (event === 'Connected' || event === 'Incoming' || event === 'Outgoing') {
          handleCallStart(phoneNumber);
        }
        // Andere Events können ignoriert werden
      }, false, () => {
        console.log('Call Detection: Berechtigungen bestätigt');
      }, (error: any) => {
        console.error('Call Detection: Berechtigungen verweigert:', error);
        Alert.alert(
          'Berechtigungen verweigert',
          'Die App benötigt Zugriff auf Anrufstatus für automatische Notizen.'
        );
        setHasPermission(false);
      });

      console.log('Call Detection gestartet');
    } catch (error) {
      console.error('Fehler beim Starten der Call Detection:', error);
      setHasPermission(false);
    }
  }, [hasPermission, cleanupCallDetection]);

  const handleCallStart = useCallback(async (phoneNumber: string | null) => {
    try {
      if (!phoneNumber) {
        console.log('Call Detection: Unbekannte Nummer');
        return;
      }
      
      // Bereinige die Telefonnummer
      let cleanedPhoneNumber = phoneNumber.replace(/[^\d+]/g, '');
      
      // Ignoriere zu kurze Nummern
      if (cleanedPhoneNumber.length < 5) {
        console.log('Call Detection: Nummer zu kurz, ignoriere');
        return;
      }
      
      // Falls keine Ländervorwahl, füge +49 hinzu (Deutschland)
      if (!cleanedPhoneNumber.startsWith('+') && cleanedPhoneNumber.length >= 10) {
        cleanedPhoneNumber = `+49${cleanedPhoneNumber.substring(1)}`;
      }
      
      // Markiere den Anruf in der Datenbank
      await markCallStarted(cleanedPhoneNumber);
      
      // Callback oder Navigation
      if (onCallDetected) {
        onCallDetected(cleanedPhoneNumber);
      } else {
        // @ts-ignore - Navigation zu Detailansicht
        navigation.navigate('note-detail', { phoneNumber: cleanedPhoneNumber });
      }
    } catch (error) {
      console.error('Fehler bei der Verarbeitung des Anrufs:', error);
    }
  }, [navigation, onCallDetected]);

  return null;
};

export default CallDetectionService;
