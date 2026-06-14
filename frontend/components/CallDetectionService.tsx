import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Platform, Alert, AppState, AppStateStatus } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { markCallStarted, createNote } from '../utils/database';
import QuickNoteModal from './QuickNoteModal';
import { isUnknownContact } from '../utils/contactNotesService';

interface CallDetectionServiceProps {
  onCallDetected?: (phoneNumber: string) => void;
}

interface CallInfo {
  phoneNumber?: string;
  number?: string;
  callState?: string;
  callType?: number;
}

const CallDetectionService: React.FC<CallDetectionServiceProps> = ({ onCallDetected }) => {
  const navigation = useNavigation();
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [currentCall, setCurrentCall] = useState<{
    phoneNumber: string;
    callDirection: 'incoming' | 'outgoing';
    timestamp: number;
  } | null>(null);
  const [showQuickNote, setShowQuickNote] = useState(false);
  const [appState, setAppState] = useState(AppState.currentState);
  const callTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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

    // AppState-Listener für Hintergrund/ Vordergrund
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      setAppState(nextAppState);
      
      // Wenn App in den Vordergrund kommt, prüfe ob ein Anruf aktiv ist
      if (nextAppState === 'active' && currentCall) {
        // Zeige QuickNote nach kurzer Verzögerung
        setTimeout(() => {
          if (currentCall) {
            setShowQuickNote(true);
          }
        }, 1000);
      }
    });

    return () => subscription.remove();
  }, []);

  // Cleanup
  useEffect(() => {
    return () => {
      if (callTimeoutRef.current) {
        clearTimeout(callTimeoutRef.current);
      }
    };
  }, []);

  const startCallDetection = useCallback(() => {
    if (Platform.OS !== 'android' || !hasPermission) return;

    try {
      // Import dynamisch, um Fehler auf iOS zu vermeiden
      const CallDetection = require('react-native-call-detection');
      
      CallDetection.start({
        onCallStart: (callInfo: CallInfo) => handleCallStart(callInfo),
        onCallIncoming: (callInfo: CallInfo) => handleCallIncoming(callInfo),
        onCallOutgoing: (callInfo: CallInfo) => handleCallOutgoing(callInfo),
        onCallEnd: (callInfo: CallInfo) => handleCallEnd(callInfo),
      });
    } catch (error) {
      console.error('Fehler beim Starten der Call Detection:', error);
    }
  }, [hasPermission]);

  const handleCallStart = useCallback(async (callInfo: CallInfo) => {
    // Wird für beide Anrufarten aufgerufen
    handleCallIncoming(callInfo);
  }, []);

  const handleCallIncoming = useCallback(async (callInfo: CallInfo) => {
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
      
      // Speichere aktuellen Anruf
      setCurrentCall({
        phoneNumber,
        callDirection: 'incoming',
        timestamp: Date.now(),
      });
      
      // Markiere den Anruf in der Datenbank
      await markCallStarted(phoneNumber);
      
      // Zeige QuickNote nach kurzer Verzögerung (wenn App im Vordergrund)
      if (appState === 'active') {
        setTimeout(() => {
          if (currentCall?.phoneNumber === phoneNumber) {
            setShowQuickNote(true);
          }
        }, 500);
      }
      
      // Callback
      if (onCallDetected) {
        onCallDetected(phoneNumber);
      }
      
    } catch (error) {
      console.error('Fehler bei der Verarbeitung des eingehenden Anrufs:', error);
    }
  }, [appState, currentCall, onCallDetected]);

  const handleCallOutgoing = useCallback(async (callInfo: CallInfo) => {
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
      
      // Speichere aktuellen Anruf
      setCurrentCall({
        phoneNumber,
        callDirection: 'outgoing',
        timestamp: Date.now(),
      });
      
      // Markiere den Anruf in der Datenbank
      await markCallStarted(phoneNumber);
      
      // Zeige QuickNote nach kurzer Verzögerung (wenn App im Vordergrund)
      if (appState === 'active') {
        setTimeout(() => {
          if (currentCall?.phoneNumber === phoneNumber) {
            setShowQuickNote(true);
          }
        }, 500);
      }
      
      // Callback
      if (onCallDetected) {
        onCallDetected(phoneNumber);
      }
      
    } catch (error) {
      console.error('Fehler bei der Verarbeitung des ausgehenden Anrufs:', error);
    }
  }, [appState, currentCall, onCallDetected]);

  const handleCallEnd = useCallback(async (callInfo: CallInfo) => {
    try {
      // Anruf beendet - QuickNote nach kurzer Verzögerung anzeigen
      // (falls noch nicht angezeigt)
      if (currentCall && !showQuickNote) {
        setTimeout(() => {
          if (currentCall) {
            setShowQuickNote(true);
          }
        }, 1000);
      }
      
      // Nach 30 Sekunden: Anruf zurücksetzen (falls QuickNote nicht geöffnet wurde)
      if (callTimeoutRef.current) {
        clearTimeout(callTimeoutRef.current);
      }
      
      callTimeoutRef.current = setTimeout(() => {
        setCurrentCall(null);
      }, 30000);
      
    } catch (error) {
      console.error('Fehler bei der Verarbeitung des Anrufendes:', error);
    }
  }, [currentCall, showQuickNote]);

  // Notiz erstellt - zurücksetzen
  const handleNoteCreated = useCallback(async (noteText: string, phoneNumber: string) => {
    setShowQuickNote(false);
    
    // Prüfe ob die Nummer unbekannt ist und zeige Hinweis an
    const unknown = await isUnknownContact(phoneNumber);
    if (unknown) {
      Alert.alert(
        'Unbekannte Nummer',
        `Die Nummer ${phoneNumber} ist nicht in Ihrem Telefonbuch.\n\nSie können einen Vermerk hinterlegen, um sie später zu identifizieren.`
      );
    }
    
    // Nach kurzer Verzögerung zurücksetzen
    setTimeout(() => {
      setCurrentCall(null);
    }, 2000);
    
    // Navigation zur Detailansicht
    // @ts-ignore - Navigation wird durch Expo Router gehandhabt
    navigation.navigate('note-detail', { phoneNumber });
  }, [navigation]);

  return (
    <>
      {Platform.OS === 'android' && hasPermission && (
        <>
          {/* QuickNote Modal für schnelle Notizerstellung während des Anrufs */}
          <QuickNoteModal
            visible={showQuickNote}
            onClose={() => {
              setShowQuickNote(false);
              setCurrentCall(null);
            }}
            phoneNumber={currentCall?.phoneNumber}
            onNoteCreated={handleNoteCreated}
            callDirection={currentCall?.callDirection}
          />
        </>
      )}
    </>
  );
};

export default CallDetectionService;
