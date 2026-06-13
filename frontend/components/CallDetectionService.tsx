import React, { useEffect, useState, useCallback } from 'react';
import { Platform, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { PermissionsAndroid, Permission } from 'react-native';
import { markCallStarted } from '../utils/database';

interface CallDetectionServiceProps {
  onCallDetected?: (phoneNumber: string) => void;
}

/**
 * Erforderliche Android-Berechtigungen für die Anruferkennung
 */
const REQUIRED_PERMISSIONS: Permission[] = [
  PermissionsAndroid.PERMISSIONS.READ_PHONE_STATE,
  PermissionsAndroid.PERMISSIONS.READ_CALL_LOG,
  PermissionsAndroid.PERMISSIONS.PROCESS_OUTGOING_CALLS,
];

/**
 * Service-Komponente für die Erkennung von Telefonanrufen (nur Android)
 * Implementiert echte Berechtigungsprüfung und Fehlerbehandlung
 */
const CallDetectionService: React.FC<CallDetectionServiceProps> = ({ onCallDetected }) => {
  const navigation = useNavigation();
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [permissionError, setPermissionError] = useState<string | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'android') return;

    const checkAndRequestPermissions = async () => {
      try {
        // Prüfe ob Berechtigungen bereits erteilt wurden
        const allGranted = await checkPermissions();
        
        if (allGranted) {
          setHasPermission(true);
          startCallDetection();
        } else {
          // Berechtigungen anfordern
          const granted = await requestPermissions();
          setHasPermission(granted);
          if (granted) {
            startCallDetection();
          } else {
            setPermissionError('Berechtigungen wurden verweigert. Die Anruferkennung funktioniert nicht ohne READ_PHONE_STATE, READ_CALL_LOG und PROCESS_OUTGOING_CALLS Berechtigungen.');
            showPermissionDeniedAlert();
          }
        }
      } catch (error) {
        console.error('Fehler bei der Berechtigungsprüfung:', error);
        setPermissionError('Fehler bei der Berechtigungsprüfung: ' + (error instanceof Error ? error.message : String(error)));
        setHasPermission(false);
      }
    };

    checkAndRequestPermissions();

    // Cleanup: Stoppe Call Detection beim Unmount
    return () => {
      if (Platform.OS === 'android' && hasPermission) {
        try {
          const CallDetection = require('react-native-call-detection');
          CallDetection.stop();
        } catch (error) {
          console.error('Fehler beim Stoppen der Call Detection:', error);
        }
      }
    };
  }, []);

  /**
   * Prüft ob alle erforderlichen Berechtigungen bereits erteilt wurden
   * @returns Promise<boolean> - true wenn alle Berechtigungen erteilt wurden
   */
  const checkPermissions = async (): Promise<boolean> => {
    try {
      const results = await Promise.all(
        REQUIRED_PERMISSIONS.map(permission => 
          PermissionsAndroid.check(permission)
        )
      );
      return results.every(granted => granted);
    } catch (error) {
      console.error('Fehler beim Prüfen der Berechtigungen:', error);
      throw new Error('Berechtigungsprüfung fehlgeschlagen');
    }
  };

  /**
   * Fordert alle erforderlichen Berechtigungen an
   * @returns Promise<boolean> - true wenn alle Berechtigungen erteilt wurden
   */
  const requestPermissions = async (): Promise<boolean> => {
    try {
      // Prüfe zuerst, ob wir die Berechtigungen anfordern dürfen
      const shouldShowRationale = await Promise.all(
        REQUIRED_PERMISSIONS.map(permission => 
          PermissionsAndroid.shouldShowRequestPermissionRationale(permission)
        )
      );

      // Wenn eine Berechtigung bereits früher verweigert wurde, zeige Erklärung
      if (shouldShowRationale.some(shouldShow => shouldShow)) {
        Alert.alert(
          'Berechtigungen erforderlich',
          'Diese App benötigt Zugriff auf Telefonstatus und Anrufprotokolle, um Anrufe zu erkennen und Notizen automatisch zu erstellen.',
          [
            { text: 'Abbrechen', onPress: () => {}, style: 'cancel' },
            { text: 'Berechtigungen erteilen', onPress: () => requestPermissionsAgain() },
          ]
        );
        return false;
      }

      // Fordere alle Berechtigungen an
      const result = await PermissionsAndroid.requestMultiple(REQUIRED_PERMISSIONS);
      
      // Prüfe ob alle Berechtigungen erteilt wurden
      const allGranted = REQUIRED_PERMISSIONS.every(
        permission => result[permission] === PermissionsAndroid.RESULTS.GRANTED
      );

      if (!allGranted) {
        console.warn('Nicht alle Berechtigungen wurden erteilt:', result);
        // Zeige welche Berechtigungen fehlen
        const deniedPermissions = REQUIRED_PERMISSIONS.filter(
          permission => result[permission] !== PermissionsAndroid.RESULTS.GRANTED
        );
        console.warn('Verweigerte Berechtigungen:', deniedPermissions);
      }

      return allGranted;
    } catch (error) {
      console.error('Fehler beim Anfordern der Berechtigungen:', error);
      throw new Error('Berechtigungsanforderung fehlgeschlagen');
    }
  };

  /**
   * Fordert Berechtigungen erneut an (wird aufgerufen, wenn der Nutzer die Erklärung gesehen hat)
   * @returns Promise<boolean> - true wenn alle Berechtigungen erteilt wurden
   */
  const requestPermissionsAgain = async (): Promise<boolean> => {
    try {
      const result = await PermissionsAndroid.requestMultiple(REQUIRED_PERMISSIONS);
      const allGranted = REQUIRED_PERMISSIONS.every(
        permission => result[permission] === PermissionsAndroid.RESULTS.GRANTED
      );
      
      if (allGranted) {
        setHasPermission(true);
        startCallDetection();
      } else {
        setHasPermission(false);
        setPermissionError('Berechtigungen wurden verweigert.');
        showPermissionDeniedAlert();
      }
      
      return allGranted;
    } catch (error) {
      console.error('Fehler beim erneuten Anfordern der Berechtigungen:', error);
      setPermissionError('Fehler beim erneuten Anfordern der Berechtigungen');
      return false;
    }
  };

  /**
   * Zeigt einen Alert an, wenn Berechtigungen verweigert wurden
   */
  const showPermissionDeniedAlert = useCallback(() => {
    Alert.alert(
      'Berechtigungen verweigert',
      'Ohne die Berechtigungen READ_PHONE_STATE, READ_CALL_LOG und PROCESS_OUTGOING_CALLS kann die App keine Anrufe erkennen. Sie können die Berechtigungen jederzeit in den Einstellungen ändern.',
      [
        { text: 'OK', onPress: () => {} },
        { 
          text: 'Zu Einstellungen', 
          onPress: () => {
            // Öffne die App-Einstellungen
            if (Platform.OS === 'android') {
              try {
                // @ts-ignore - Android Intent zum Öffnen der App-Einstellungen
                import('react-native').then(({ Linking }) => {
                  Linking.openSettings();
                });
              } catch (error) {
                console.error('Fehler beim Öffnen der Einstellungen:', error);
              }
            }
          }
        },
      ]
    );
  }, []);

  /**
   * Startet die Anruferkennung
   */
  const startCallDetection = useCallback(() => {
    if (Platform.OS !== 'android' || !hasPermission) return;

    try {
      // Import dynamisch, um Fehler auf iOS zu vermeiden
      const CallDetection = require('react-native-call-detection');
      
      // Stoppe bestehende Call Detection, falls vorhanden
      CallDetection.stop();

      CallDetection.start({
        onCallStart: (callInfo: any) => handleCallStart(callInfo),
        onCallIncoming: (callInfo: any) => handleCallStart(callInfo),
        onCallOutgoing: (callInfo: any) => handleCallStart(callInfo),
        onCallEnd: (callInfo: any) => handleCallEnd(callInfo),
      });

      console.log('Call Detection erfolgreich gestartet');
    } catch (error) {
      console.error('Fehler beim Starten der Call Detection:', error);
      setPermissionError('Fehler beim Starten der Anruferkennung: ' + (error instanceof Error ? error.message : String(error)));
    }
  }, [hasPermission]);

  /**
   * Behandelt den Start eines Anrufs
   * @param callInfo - Informationen über den Anruf
   */
  const handleCallStart = useCallback(async (callInfo: any) => {
    try {
      if (!callInfo) {
        console.warn('handleCallStart: callInfo ist undefined oder null');
        return;
      }

      let phoneNumber = callInfo.phoneNumber || callInfo.number || callInfo.from || callInfo.to || '';
      
      // Bereinige die Telefonnummer
      phoneNumber = phoneNumber.replace(/[^\d+]/g, '');
      
      // Ignoriere zu kurze Nummern
      if (phoneNumber.length < 5) {
        console.log('Ignoriere zu kurze Telefonnummer:', phoneNumber);
        return;
      }
      
      // Falls keine Ländervorwahl, füge +49 hinzu (Deutschland)
      if (!phoneNumber.startsWith('+') && phoneNumber.length >= 10) {
        phoneNumber = `+49${phoneNumber.substring(1)}`;
      }
      
      console.log('Anruf erkannt von:', phoneNumber);
      
      // Markiere den Anruf in der Datenbank
      await markCallStarted(phoneNumber);
      
      // Callback oder Navigation
      if (onCallDetected) {
        onCallDetected(phoneNumber);
      } else {
        // @ts-ignore - Navigation zu Detailansicht
        navigation.navigate('note-detail', { phoneNumber });
      }
    } catch (error) {
      console.error('Fehler bei der Verarbeitung des Anrufs:', error);
      // Zeige Fehler nur in Debug-Modus
      if (__DEV__) {
        Alert.alert('Fehler', 'Fehler bei der Anrufverarbeitung: ' + (error instanceof Error ? error.message : String(error)));
      }
    }
  }, [navigation, onCallDetected]);

  /**
   * Behandelt das Ende eines Anrufs
   * @param callInfo - Informationen über den Anruf
   */
  const handleCallEnd = useCallback((callInfo: any) => {
    try {
      if (!callInfo) {
        console.warn('handleCallEnd: callInfo ist undefined oder null');
        return;
      }

      const phoneNumber = callInfo.phoneNumber || callInfo.number || callInfo.from || callInfo.to || '';
      const cleanedNumber = phoneNumber.replace(/[^\d+]/g, '');
      
      if (cleanedNumber.length >= 5) {
        console.log('Anruf beendet mit:', cleanedNumber);
      }
    } catch (error) {
      console.error('Fehler bei der Verarbeitung des Anrufendes:', error);
    }
  }, []);

  // Effekt zum Neustarten der Call Detection, wenn Berechtigungen nachträglich erteilt werden
  useEffect(() => {
    if (Platform.OS === 'android' && hasPermission === true) {
      startCallDetection();
    } else if (Platform.OS === 'android' && hasPermission === false) {
      // Stoppe Call Detection, wenn Berechtigungen entzogen wurden
      try {
        const CallDetection = require('react-native-call-detection');
        CallDetection.stop();
      } catch (error) {
        console.error('Fehler beim Stoppen der Call Detection:', error);
      }
    }
  }, [hasPermission, startCallDetection]);

  return null;
};

export default CallDetectionService;
