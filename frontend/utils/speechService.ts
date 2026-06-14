/**
 * SpeechService - Spracherkennung für CallLiveNotes
 * 
 * Dieser Service ermöglicht die Umwandlung von Sprache in Text
 * für schnelle Notizerstellung während Telefonaten.
 * 
 * WICHTIG: Es wird NUR die Sprache des Nutzers erfasst, KEINE Anrufpartner-Daten!
 */

import { Platform } from 'react-native';

// Typdefinitionen
export interface SpeechResult {
  text: string;
  isFinal: boolean;
  error?: string;
}

export interface SpeechOptions {
  language?: string;
  continuous?: boolean;
  interimResults?: boolean;
}

// Standard-Sprachoptionen
const DEFAULT_OPTIONS: SpeechOptions = {
  language: 'de-DE', // Deutsch
  continuous: false,
  interimResults: true,
};

// Status der Spracherkennung
export type SpeechStatus = 'idle' | 'listening' | 'processing' | 'error' | 'unsupported';

// Aktueller Status
let currentStatus: SpeechStatus = 'idle';
let currentText: string = '';
let isAvailable: boolean = false;

// Callback für Sprachergebnisse
let onResultCallback: ((result: SpeechResult) => void) | null = null;
let onStatusCallback: ((status: SpeechStatus) => void) | null = null;
let onErrorCallback: ((error: string) => void) | null = null;

/**
 * Initialisiert den Speech-Service
 */
export const initSpeechService = async (): Promise<boolean> => {
  try {
    // Prüfe Plattform-Unterstützung
    if (Platform.OS === 'web') {
      // Web: Prüfe auf Web Speech API
      if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        isAvailable = true;
        currentStatus = 'idle';
        return true;
      }
    } else {
      // Mobile: Prüfe auf Expo Speech
      try {
        // @ts-ignore - Dynamischer Import für Expo Speech
        const Speech = require('expo-speech');
        isAvailable = true;
        currentStatus = 'idle';
        return true;
      } catch (error) {
        // Falls expo-speech nicht verfügbar
        console.warn('expo-speech nicht verfügbar, versuche alternative Methode');
      }
    }
    
    currentStatus = 'unsupported';
    isAvailable = false;
    return false;
    
  } catch (error) {
    console.error('Fehler bei der Initialisierung des Speech-Service:', error);
    currentStatus = 'error';
    isAvailable = false;
    return false;
  }
};

/**
 * Prüft ob Spracherkennung verfügbar ist
 */
export const isSpeechAvailable = (): boolean => {
  return isAvailable;
};

/**
 * Gibt den aktuellen Status zurück
 */
export const getSpeechStatus = (): SpeechStatus => {
  return currentStatus;
};

/**
 * Gibt den aktuellen erkannten Text zurück
 */
export const getCurrentText = (): string => {
  return currentText;
};

/**
 * Setzt Callback für Sprachergebnisse
 */
export const setOnResultCallback = (callback: (result: SpeechResult) => void): void => {
  onResultCallback = callback;
};

/**
 * Setzt Callback für Statusänderungen
 */
export const setOnStatusCallback = (callback: (status: SpeechStatus) => void): void => {
  onStatusCallback = callback;
};

/**
 * Setzt Callback für Fehler
 */
export const setOnErrorCallback = (callback: (error: string) => void): void => {
  onErrorCallback = callback;
};

/**
 * Startet die Spracherkennung
 */
export const startSpeechRecognition = (options: SpeechOptions = {}): void => {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  if (!isAvailable) {
    currentStatus = 'unsupported';
    onStatusCallback?.('unsupported');
    onErrorCallback?.('Spracherkennung nicht verfügbar');
    return;
  }
  
  if (currentStatus === 'listening') {
    onErrorCallback?.('Spracherkennung läuft bereits');
    return;
  }
  
  currentText = '';
  currentStatus = 'listening';
  onStatusCallback?.('listening');
  
  try {
    if (Platform.OS === 'web') {
      startWebSpeechRecognition(opts);
    } else {
      startMobileSpeechRecognition(opts);
    }
  } catch (error) {
    currentStatus = 'error';
    onStatusCallback?.('error');
    onErrorCallback?.(`Fehler beim Starten: ${error}`);
  }
};

/**
 * Startet Spracherkennung im Web
 */
const startWebSpeechRecognition = (options: SpeechOptions): void => {
  // @ts-ignore - Web Speech API
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  
  if (!SpeechRecognition) {
    currentStatus = 'unsupported';
    onStatusCallback?.('unsupported');
    onErrorCallback?.('Web Speech API nicht verfügbar');
    return;
  }
  
  const recognition = new SpeechRecognition();
  
  // Konfiguration
  recognition.continuous = options.continuous || false;
  recognition.interimResults = options.interimResults || true;
  recognition.lang = options.language || 'de-DE';
  
  // Event-Handler
  recognition.onstart = () => {
    currentStatus = 'listening';
    onStatusCallback?.('listening');
  };
  
  recognition.onend = () => {
    currentStatus = 'idle';
    onStatusCallback?.('idle');
  };
  
  recognition.onerror = (event: any) => {
    currentStatus = 'error';
    onStatusCallback?.('error');
    onErrorCallback?.(`Fehler: ${event.error}`);
  };
  
  recognition.onresult = (event: any) => {
    let interimTranscript = '';
    let finalTranscript = '';
    
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript = event.results[i][0].transcript;
      
      if (event.results[i].isFinal) {
        finalTranscript += transcript;
      } else {
        interimTranscript += transcript;
      }
    }
    
    currentText = finalTranscript || currentText;
    
    if (finalTranscript) {
      onResultCallback?.({ text: finalTranscript, isFinal: true });
    }
    
    if (interimTranscript) {
      onResultCallback?.({ text: interimTranscript, isFinal: false });
    }
  };
  
  recognition.start();
};

/**
 * Startet Spracherkennung auf Mobile (Expo Speech)
 */
const startMobileSpeechRecognition = async (options: SpeechOptions): Promise<void> => {
  try {
    // @ts-ignore - Dynamischer Import
    const { Speech } = require('expo-speech');
    
    // Expo Speech hat keine direkte Spracherkennung
    // Wir verwenden eine Alternative oder zeigen eine Nachricht
    console.warn('Expo Speech unterstützt keine Spracherkennung, nur Sprachausgabe');
    
    // Alternative: Verwende react-native-voice (falls installiert)
    try {
      // @ts-ignore - Dynamischer Import
      const Voice = require('react-native-voice');
      
      // Konfiguriere Voice
      await Voice.start(options.language || 'de-DE');
      
      Voice.onSpeechStart = () => {
        currentStatus = 'listening';
        onStatusCallback?.('listening');
      };
      
      Voice.onSpeechEnd = () => {
        currentStatus = 'idle';
        onStatusCallback?.('idle');
      };
      
      Voice.onSpeechError = (error: any) => {
        currentStatus = 'error';
        onStatusCallback?.('error');
        onErrorCallback?.(`Fehler: ${error.error}`);
      };
      
      Voice.onSpeechResults = (event: any) => {
        const text = event.value[0];
        currentText = text;
        onResultCallback?.({ text, isFinal: true });
      };
      
      Voice.onSpeechPartialResults = (event: any) => {
        const text = event.value[0];
        onResultCallback?.({ text, isFinal: false });
      };
      
    } catch (voiceError) {
      console.warn('react-native-voice nicht verfügbar');
      currentStatus = 'unsupported';
      onStatusCallback?.('unsupported');
      onErrorCallback?.('Spracherkennung nicht verfügbar - installieren Sie react-native-voice');
    }
    
  } catch (error) {
    currentStatus = 'error';
    onStatusCallback?.('error');
    onErrorCallback?.(`Fehler: ${error}`);
  }
};

/**
 * Stoppt die Spracherkennung
 */
export const stopSpeechRecognition = (): void => {
  if (currentStatus !== 'listening' && currentStatus !== 'processing') {
    return;
  }
  
  try {
    if (Platform.OS === 'web') {
      // @ts-ignore - Web Speech API
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        // Stoppe alle laufenden Erkennungen
        // @ts-ignore
        SpeechRecognition.stop();
      }
    } else {
      try {
        // @ts-ignore
        const Voice = require('react-native-voice');
        Voice.stop();
      } catch (error) {
        // Ignoriere Fehler
      }
    }
    
    currentStatus = 'idle';
    onStatusCallback?.('idle');
    
  } catch (error) {
    currentStatus = 'error';
    onStatusCallback?.('error');
    onErrorCallback?.(`Fehler beim Stoppen: ${error}`);
  }
};

/**
 * Bricht die Spracherkennung ab
 */
export const cancelSpeechRecognition = (): void => {
  stopSpeechRecognition();
  currentText = '';
};

/**
 * Setzt den erkannten Text zurück
 */
export const resetSpeechText = (): void => {
  currentText = '';
};

/**
 * Liest Text vor (Text-to-Speech)
 */
export const speakText = (text: string, options?: { language?: string; rate?: number; pitch?: number }): void => {
  try {
    if (Platform.OS === 'web') {
      // @ts-ignore - Web Speech API
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = options?.language || 'de-DE';
      utterance.rate = options?.rate || 1;
      utterance.pitch = options?.pitch || 1;
      
      // @ts-ignore
      window.speechSynthesis.speak(utterance);
    } else {
      try {
        // @ts-ignore
        const { Speech } = require('expo-speech');
        Speech.speak(text, {
          language: options?.language || 'de',
          rate: options?.rate || 1,
          pitch: options?.pitch || 1,
        });
      } catch (error) {
        console.warn('Text-to-Speech nicht verfügbar');
      }
    }
  } catch (error) {
    console.error('Fehler bei Text-to-Speech:', error);
  }
};

/**
 * Stoppt die Sprachausgabe
 */
export const stopSpeech = (): void => {
  try {
    if (Platform.OS === 'web') {
      // @ts-ignore
      window.speechSynthesis.cancel();
    } else {
      try {
        // @ts-ignore
        const { Speech } = require('expo-speech');
        Speech.stop();
      } catch (error) {
        // Ignoriere Fehler
      }
    }
  } catch (error) {
    console.error('Fehler beim Stoppen der Sprachausgabe:', error);
  }
};

/**
 * Prüft ob Sprachausgabe verfügbar ist
 */
export const isSpeechOutputAvailable = (): boolean => {
  if (Platform.OS === 'web') {
    // @ts-ignore
    return 'speechSynthesis' in window;
  }
  return true; // Auf Mobile immer verfügbar (Expo Speech)
};

/**
 * Konvertiert Sprache in Text (für manuelle Eingabe)
 * Dies ist ein Fallback, falls Spracherkennung nicht verfügbar ist
 */
export const convertSpeechToText = async (
  audioUri: string,
  language: string = 'de-DE'
): Promise<string> => {
  // In echter Implementierung: API-Aufruf an Speech-to-Text-Service
  // z.B. Google Cloud Speech-to-Text, Azure Cognitive Services, etc.
  
  console.warn('Sprach-zu-Text-Konvertierung nicht implementiert - installieren Sie ein Speech-to-Text SDK');
  return '';
};
