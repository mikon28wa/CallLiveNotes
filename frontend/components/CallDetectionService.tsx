import React, { useEffect, useState, useCallback } from 'react';
import { Platform, Alert, AppState, AppStateStatus } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { markCallStarted } from '../utils/database';

interface CallDetectionServiceProps {
  onCallDetected?: (phoneNumber: string) => void;
}

const CallDetectionService: React.FC<CallDetectionServiceProps> = ({ onCallDetected }) => {
  const navigation = useNavigation();
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'android') return;

    const checkPermissions = async () => {
      try {
        setHasPermission(true);
        startCallDetection();
      } catch (error) {
        setHasPermission(false);
      }
    };
    checkPermissions();
  }, []);

  const startCallDetection = useCallback(() => {
    if (Platform.OS !== 'android' || !hasPermission) return;

    try {
      // Import dynamisch, um Fehler auf iOS zu vermeiden
      const CallDetection = require('react-native-call-detection');
      
      CallDetection.start({
        onCallStart: (callInfo: any) => handleCallStart(callInfo),
        onCallIncoming: (callInfo: any) => handleCallStart(callInfo),
        onCallOutgoing: (callInfo: any) => handleCallStart(callInfo),
      });
    } catch (error) {
      console.error('Fehler beim Starten der Call Detection:', error);
    }
  }, [hasPermission]);

  const handleCallStart = useCallback(async (callInfo: any) => {
    try {
      let phoneNumber = callInfo.phoneNumber || callInfo.number || '';
      
      // Bereinige die Telefonnummer
      phoneNumber = phoneNumber.replace(/[^\d+]/g, '');
      
      // Ignoriere zu kurze Nummern
      if (phoneNumber.length < 5) return;
      
      // Falls keine Ländervorwahl, füge +49 hinzu (Deutschland)
      if (!phoneNumber.startsWith('+') && phoneNumber.length >= 10) {
        phoneNumber = `+49${phoneNumber.substring(1)}`;
      }
      
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
    }
  }, [navigation, onCallDetected]);

  return null;
};

export default CallDetectionService;
