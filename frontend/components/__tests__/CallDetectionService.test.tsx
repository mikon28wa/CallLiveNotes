/**
 * Tests für CallDetectionService
 * 
 * Diese Tests simulieren verschiedene Szenarien:
 * 1. Berechtigungen werden zunächst verweigert, dann erteilt
 * 2. Berechtigungen werden zur Laufzeit widerrufen
 * 3. App kommt aus dem Hintergrund zurück
 * 4. Bereinigung beim Unmount
 * 5. Fehlerbehandlung
 */

import React from 'react';
import { render, act, fireEvent, waitFor } from '@testing-library/react-native';
import CallDetectionService from '../CallDetectionService';
import { PermissionsAndroid, Platform } from 'react-native';

// Mock Platform
jest.mock('react-native', () => ({
  ...jest.requireActual('react-native'),
  Platform: {
    OS: 'android',
    select: jest.fn((objs) => objs.android),
  },
  AppState: {
    currentState: 'active',
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  },
}));

// Mock PermissionsAndroid
jest.mock('react-native', () => ({
  ...jest.requireActual('react-native'),
  PermissionsAndroid: {
    PERMISSIONS: {
      READ_PHONE_STATE: 'android.permission.READ_PHONE_STATE',
      READ_CALL_LOG: 'android.permission.READ_CALL_LOG',
      PROCESS_OUTGOING_CALLS: 'android.permission.PROCESS_OUTGOING_CALLS',
    },
    RESULTS: {
      GRANTED: 'granted',
      DENIED: 'denied',
      NEVER_ASK_AGAIN: 'never_ask_again',
    },
    check: jest.fn(),
    shouldShowRequestPermissionRationale: jest.fn(),
    requestMultiple: jest.fn(),
  },
}));

// Mock react-native-call-detection
jest.mock('react-native-call-detection', () => ({
  start: jest.fn(),
  stop: jest.fn(),
}));

// Mock useNavigation
const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: mockNavigate,
  }),
}));

// Mock database
jest.mock('../../utils/database', () => ({
  markCallStarted: jest.fn().mockResolvedValue(undefined),
}));

// Mock Alert
jest.mock('react-native', () => ({
  ...jest.requireActual('react-native'),
  Alert: {
    alert: jest.fn(),
  },
}));

describe('CallDetectionService - Berechtigungsablauf', () => {
  const mockCheck = PermissionsAndroid.check as jest.Mock;
  const mockShouldShowRationale = PermissionsAndroid.shouldShowRequestPermissionRationale as jest.Mock;
  const mockRequestMultiple = PermissionsAndroid.requestMultiple as jest.Mock;
  const mockStart = require('react-native-call-detection').start as jest.Mock;
  const mockStop = require('react-native-call-detection').stop as jest.Mock;
  const mockAlert = require('react-native').Alert.alert as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockCheck.mockResolvedValue(true);
    mockShouldShowRationale.mockResolvedValue(false);
    mockRequestMultiple.mockResolvedValue({
      'android.permission.READ_PHONE_STATE': 'granted',
      'android.permission.READ_CALL_LOG': 'granted',
      'android.permission.PROCESS_OUTGOING_CALLS': 'granted',
    });
  });

  describe('🔹 Initialisierung', () => {
    it('sollte CallDetection starten, wenn alle Berechtigungen bereits erteilt sind', async () => {
      mockCheck.mockResolvedValue(true);
      
      render(<CallDetectionService />);
      
      await waitFor(() => {
        expect(mockCheck).toHaveBeenCalledTimes(3);
        expect(mockStart).toHaveBeenCalled();
        expect(mockStop).not.toHaveBeenCalled();
      });
    });

    it('sollte Berechtigungen anfordern, wenn nicht alle erteilt sind', async () => {
      mockCheck.mockResolvedValue(false);
      mockRequestMultiple.mockResolvedValue({
        'android.permission.READ_PHONE_STATE': 'granted',
        'android.permission.READ_CALL_LOG': 'granted',
        'android.permission.PROCESS_OUTGOING_CALLS': 'granted',
      });
      
      render(<CallDetectionService />);
      
      await waitFor(() => {
        expect(mockCheck).toHaveBeenCalledTimes(3);
        expect(mockRequestMultiple).toHaveBeenCalled();
        expect(mockStart).toHaveBeenCalled();
      });
    });

    it('sollte Alert zeigen, wenn Berechtigungen verweigert werden', async () => {
      mockCheck.mockResolvedValue(false);
      mockRequestMultiple.mockResolvedValue({
        'android.permission.READ_PHONE_STATE': 'denied',
        'android.permission.READ_CALL_LOG': 'denied',
        'android.permission.PROCESS_OUTGOING_CALLS': 'denied',
      });
      
      render(<CallDetectionService />);
      
      await waitFor(() => {
        expect(mockAlert).toHaveBeenCalled();
        expect(mockStart).not.toHaveBeenCalled();
      });
    });
  });

  describe('🔹 Laufzeit-Berechtigungsänderungen', () => {
    it('sollte CallDetection stoppen, wenn Berechtigungen widerrufen werden', async () => {
      // Anfangs haben wir Berechtigungen
      mockCheck.mockResolvedValue(true);
      
      const { unmount } = render(<CallDetectionService />);
      
      await waitFor(() => {
        expect(mockStart).toHaveBeenCalled();
      });
      
      // Simuliere, dass Berechtigungen widerrufen werden
      mockCheck.mockResolvedValue(false);
      
      // Trigger AppState change (App kommt in Vordergrund)
      const appStateListeners = AppState.addEventListener.mock.calls;
      const listener = appStateListeners[0][1];
      
      await act(async () => {
        await listener('active');
      });
      
      await waitFor(() => {
        expect(mockStop).toHaveBeenCalled();
        expect(mockAlert).toHaveBeenCalled();
      });
      
      unmount();
    });

    it('sollte CallDetection starten, wenn Berechtigungen nachträglich erteilt werden', async () => {
      // Anfangs keine Berechtigungen
      mockCheck.mockResolvedValue(false);
      mockRequestMultiple.mockResolvedValue({
        'android.permission.READ_PHONE_STATE': 'denied',
        'android.permission.READ_CALL_LOG': 'denied',
        'android.permission.PROCESS_OUTGOING_CALLS': 'denied',
      });
      
      const { unmount } = render(<CallDetectionService />);
      
      await waitFor(() => {
        expect(mockStart).not.toHaveBeenCalled();
      });
      
      // Simuliere, dass Nutzer Berechtigungen in Einstellungen aktiviert
      mockCheck.mockResolvedValue(true);
      
      // Trigger AppState change
      const appStateListeners = AppState.addEventListener.mock.calls;
      const listener = appStateListeners[0][1];
      
      await act(async () => {
        await listener('active');
      });
      
      await waitFor(() => {
        expect(mockStart).toHaveBeenCalled();
      });
      
      unmount();
    });
  });

  describe('🔹 AppState-Überwachung', () => {
    it('sollte Berechtigungen überprüfen, wenn App aus Hintergrund kommt', async () => {
      mockCheck.mockResolvedValue(true);
      
      render(<CallDetectionService />);
      
      // Trigger AppState change von background zu active
      const appStateListeners = AppState.addEventListener.mock.calls;
      const listener = appStateListeners[0][1];
      
      // Setze aktuellen State auf background
      AppState.currentState = 'background';
      
      await act(async () => {
        await listener('active');
      });
      
      await waitFor(() => {
        expect(mockCheck).toHaveBeenCalledTimes(4); // 3 initiale + 1 nach AppState change
      });
    });

    it('sollte nichts tun, wenn App in Hintergrund geht', async () => {
      mockCheck.mockResolvedValue(true);
      
      render(<CallDetectionService />);
      
      // Trigger AppState change von active zu background
      const appStateListeners = AppState.addEventListener.mock.calls;
      const listener = appStateListeners[0][1];
      
      await act(async () => {
        await listener('background');
      });
      
      // Sollte keine zusätzliche Berechtigungsprüfung durchführen
      await waitFor(() => {
        expect(mockCheck).toHaveBeenCalledTimes(3); // Nur die initialen 3
      });
    });
  });

  describe('🔹 Bereinigung (Cleanup)', () => {
    it('sollte CallDetection stoppen beim Unmount', async () => {
      mockCheck.mockResolvedValue(true);
      
      const { unmount } = render(<CallDetectionService />);
      
      await waitFor(() => {
        expect(mockStart).toHaveBeenCalled();
      });
      
      unmount();
      
      await waitFor(() => {
        expect(mockStop).toHaveBeenCalled();
      });
    });

    it('sollte periodische Überprüfung stoppen beim Unmount', async () => {
      mockCheck.mockResolvedValue(true);
      
      const { unmount } = render(<CallDetectionService />);
      
      // ClearInterval sollte aufgerufen werden
      unmount();
      
      // Überprüfe, dass clearInterval aufgerufen wurde
      expect(clearInterval).toHaveBeenCalled();
    });

    it('sollte AppState Listener entfernen beim Unmount', async () => {
      mockCheck.mockResolvedValue(true);
      
      const { unmount } = render(<CallDetectionService />);
      
      unmount();
      
      expect(AppState.removeEventListener).toHaveBeenCalled();
    });
  });

  describe('🔹 Rationale-Anzeige', () => {
    it('sollte Rationale zeigen, wenn Berechtigung bereits verweigert wurde', async () => {
      mockCheck.mockResolvedValue(false);
      mockShouldShowRationale.mockResolvedValue(true);
      
      render(<CallDetectionService />);
      
      await waitFor(() => {
        expect(mockAlert).toHaveBeenCalled();
      });
    });

    it('sollte keine Rationale zeigen, wenn Berechtigung noch nicht angefordert wurde', async () => {
      mockCheck.mockResolvedValue(false);
      mockShouldShowRationale.mockResolvedValue(false);
      
      render(<CallDetectionService />);
      
      await waitFor(() => {
        expect(mockRequestMultiple).toHaveBeenCalled();
      });
    });
  });

  describe('🔹 Fehlerbehandlung', () => {
    it('sollte Fehler bei checkPermissions behandeln', async () => {
      mockCheck.mockRejectedValue(new Error('Berechtigungsprüfung fehlgeschlagen'));
      
      render(<CallDetectionService />);
      
      await waitFor(() => {
        expect(mockAlert).toHaveBeenCalled();
        expect(mockStart).not.toHaveBeenCalled();
      });
    });

    it('sollte Fehler bei requestPermissions behandeln', async () => {
      mockCheck.mockResolvedValue(false);
      mockRequestMultiple.mockRejectedValue(new Error('Berechtigungsanforderung fehlgeschlagen'));
      
      render(<CallDetectionService />);
      
      await waitFor(() => {
        expect(mockAlert).toHaveBeenCalled();
      });
    });

    it('sollte Fehler bei startCallDetection behandeln', async () => {
      mockCheck.mockResolvedValue(true);
      mockStart.mockImplementation(() => {
        throw new Error('CallDetection Start fehlgeschlagen');
      });
      
      render(<CallDetectionService />);
      
      await waitFor(() => {
        expect(mockAlert).toHaveBeenCalled();
      });
    });
  });

  describe('🔹 Sonderfälle', () => {
    it('sollte auf iOS nichts tun', () => {
      // Mock Platform.OS als iOS
      Platform.OS = 'ios';
      
      render(<CallDetectionService />);
      
      expect(mockCheck).not.toHaveBeenCalled();
      expect(mockStart).not.toHaveBeenCalled();
    });

    it('sollte partielle Berechtigungen erkennen', async () => {
      mockCheck.mockResolvedValue(false);
      mockRequestMultiple.mockResolvedValue({
        'android.permission.READ_PHONE_STATE': 'granted',
        'android.permission.READ_CALL_LOG': 'denied',
        'android.permission.PROCESS_OUTGOING_CALLS': 'granted',
      });
      
      render(<CallDetectionService />);
      
      await waitFor(() => {
        expect(mockStart).not.toHaveBeenCalled();
        expect(mockAlert).toHaveBeenCalled();
      });
    });
  });
});

describe('CallDetectionService - Anrufverarbeitung', () => {
  const mockCheck = PermissionsAndroid.check as jest.Mock;
  const mockStart = require('react-native-call-detection').start as jest.Mock;
  const mockMarkCallStarted = require('../../utils/database').markCallStarted as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockCheck.mockResolvedValue(true);
  });

  it('sollte Anruf mit gültiger Telefonnummer verarbeiten', async () => {
    const mockCallInfo = {
      phoneNumber: '+49123456789'
    };
    
    render(<CallDetectionService />);
    
    await waitFor(() => {
      expect(mockStart).toHaveBeenCalled();
    });
    
    // Simuliere Anruf-Event
    const startCallback = mockStart.mock.calls[0][0].onCallStart;
    
    await act(async () => {
      await startCallback(mockCallInfo);
    });
    
    await waitFor(() => {
      expect(mockMarkCallStarted).toHaveBeenCalledWith('+49123456789');
    });
  });

  it('sollte Anruf mit zu kurzer Telefonnummer ignorieren', async () => {
    const mockCallInfo = {
      phoneNumber: '123'
    };
    
    render(<CallDetectionService />);
    
    await waitFor(() => {
      expect(mockStart).toHaveBeenCalled();
    });
    
    const startCallback = mockStart.mock.calls[0][0].onCallStart;
    
    await act(async () => {
      await startCallback(mockCallInfo);
    });
    
    await waitFor(() => {
      expect(mockMarkCallStarted).not.toHaveBeenCalled();
    });
  });

  it('sollte deutsche Telefonnummer normalisieren', async () => {
    const mockCallInfo = {
      phoneNumber: '0123456789'
    };
    
    render(<CallDetectionService />);
    
    await waitFor(() => {
      expect(mockStart).toHaveBeenCalled();
    });
    
    const startCallback = mockStart.mock.calls[0][0].onCallStart;
    
    await act(async () => {
      await startCallback(mockCallInfo);
    });
    
    await waitFor(() => {
      expect(mockMarkCallStarted).toHaveBeenCalledWith('+49123456789');
    });
  });

  it('sollte Anruf aus verschiedenen callInfo-Feldern extrahieren', async () => {
    const testCases = [
      { input: { phoneNumber: '+49123456789' }, expected: '+49123456789' },
      { input: { number: '+49123456789' }, expected: '+49123456789' },
      { input: { from: '+49123456789' }, expected: '+49123456789' },
      { input: { to: '+49123456789' }, expected: '+49123456789' },
    ];

    for (const testCase of testCases) {
      mockMarkCallStarted.mockClear();
      
      render(<CallDetectionService />);
      
      await waitFor(() => {
        expect(mockStart).toHaveBeenCalled();
      });
      
      const startCallback = mockStart.mock.calls[0][0].onCallStart;
      
      await act(async () => {
        await startCallback(testCase.input);
      });
      
      await waitFor(() => {
        expect(mockMarkCallStarted).toHaveBeenCalledWith(testCase.expected);
      });
    }
  });
});
