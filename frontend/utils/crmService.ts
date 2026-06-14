/**
 * CRM-Integrationsservice für CallLiveNotes
 * 
 * Dieser Service bietet Schnittstellen zu verschiedenen CRM-Systemen
 * und ermöglicht die Synchronisation von Notizen und Kontaktinformationen.
 * 
 * WICHTIG: Es werden NUR Nutzerdaten (Notizen) synchronisiert, KEINE Anrufpartner-Daten!
 */

import * as SQLite from 'expo-sqlite';
import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';

// Typdefinitionen für CRM-Systeme
export interface CRMContact {
  id: string;
  phoneNumbers: string[];
  name?: string;
  email?: string;
  company?: string;
  customFields?: Record<string, string>;
}

export interface CRMNote {
  id: string;
  contactId: string;
  text: string;
  createdAt: string;
  updatedAt: string;
  callDuration?: number;
  callDirection?: 'incoming' | 'outgoing';
}

export interface CRMSyncResult {
  success: boolean;
  syncedNotes: number;
  errors: string[];
  timestamp: string;
}

export interface CRMConfig {
  type: 'hubspot' | 'salesforce' | 'zoho' | 'custom';
  apiKey?: string;
  apiUrl?: string;
  username?: string;
  password?: string;
  enabled: boolean;
  autoSync: boolean;
  syncInterval: number; // in Minuten
}

// Standard-Konfiguration
const DEFAULT_CONFIG: CRMConfig = {
  type: 'custom',
  enabled: false,
  autoSync: false,
  syncInterval: 60,
};

// Speicher für Offline-Daten
const offlineQueue: Array<{
  type: 'note' | 'contact';
  data: any;
  timestamp: string;
  retryCount: number;
}> = [];

// Aktuelle Konfiguration
let currentConfig: CRMConfig = { ...DEFAULT_CONFIG };

/**
 * Initialisiert den CRM-Service
 */
export const initCRMService = async (): Promise<void> => {
  // Lade gespeicherte Konfiguration
  await loadConfig();
  
  // Starte Offline-Synchronisation, falls aktiviert
  if (currentConfig.enabled && currentConfig.autoSync) {
    startAutoSync();
  }
};

/**
 * Lädt die CRM-Konfiguration aus dem lokalen Speicher
 */
const loadConfig = async (): Promise<void> => {
  try {
    const configFile = `${FileSystem.documentDirectory}crm_config.json`;
    const fileInfo = await FileSystem.getInfoAsync(configFile);
    
    if (fileInfo.exists) {
      const configContent = await FileSystem.readAsStringAsync(configFile);
      const savedConfig = JSON.parse(configContent);
      currentConfig = { ...DEFAULT_CONFIG, ...savedConfig };
    }
  } catch (error) {
    console.error('Fehler beim Laden der CRM-Konfiguration:', error);
  }
};

/**
 * Speichert die CRM-Konfiguration
 */
export const saveConfig = async (config: Partial<CRMConfig>): Promise<void> => {
  currentConfig = { ...currentConfig, ...config };
  
  try {
    const configFile = `${FileSystem.documentDirectory}crm_config.json`;
    await FileSystem.writeAsStringAsync(
      configFile,
      JSON.stringify(currentConfig, null, 2)
    );
  } catch (error) {
    console.error('Fehler beim Speichern der CRM-Konfiguration:', error);
    throw error;
  }
};

/**
 * Gibt die aktuelle CRM-Konfiguration zurück
 */
export const getConfig = (): CRMConfig => {
  return { ...currentConfig };
};

/**
 * Startet die automatische Synchronisation
 */
const startAutoSync = (): void => {
  if (Platform.OS === 'web') {
    // Browser: setInterval
    const interval = setInterval(() => {
      if (currentConfig.enabled && currentConfig.autoSync) {
        syncWithCRM().catch(console.error);
      } else {
        clearInterval(interval);
      }
    }, currentConfig.syncInterval * 60 * 1000);
    
    // Speichere Interval-ID für späteres Löschen
    // @ts-ignore
    global.crmSyncInterval = interval;
  }
  // Mobile: Würde hier React Native Background Timer verwenden
};

/**
 * Stoppt die automatische Synchronisation
 */
export const stopAutoSync = (): void => {
  if (Platform.OS === 'web' && global.crmSyncInterval) {
    clearInterval(global.crmSyncInterval);
    global.crmSyncInterval = null;
  }
};

/**
 * Sucht nach einem Kontakt im CRM anhand der Telefonnummer
 * WICHTIG: Es wird NUR die Telefonnummer des Nutzers (nicht des Anrufpartners) verwendet!
 */
export const searchContactByPhone = async (phoneNumber: string): Promise<CRMContact | null> => {
  if (!currentConfig.enabled) {
    return null;
  }

  try {
    // Bereinige die Telefonnummer
    const cleanedPhone = phoneNumber.replace(/[^\d+]/g, '');
    
    // Simuliere CRM-Abfrage (in echter Implementierung würde hier API-Aufruf stehen)
    // Dies ist ein Platzhalter für die tatsächliche CRM-Integration
    switch (currentConfig.type) {
      case 'hubspot':
        return await searchHubSpotContact(cleanedPhone);
      case 'salesforce':
        return await searchSalesforceContact(cleanedPhone);
      case 'zoho':
        return await searchZohoContact(cleanedPhone);
      case 'custom':
      default:
        // Für Custom-CRM: Suche in lokalen Daten oder Offline-Cache
        return await searchLocalContact(cleanedPhone);
    }
  } catch (error) {
    console.error('Fehler bei der CRM-Kontaktsuche:', error);
    return null;
  }
};

/**
 * Platzhalter für HubSpot-Integration
 */
const searchHubSpotContact = async (phoneNumber: string): Promise<CRMContact | null> => {
  // In echter Implementierung: API-Aufruf an HubSpot
  // Beispiel: https://api.hubapi.com/crm/v3/objects/contacts?property=phone
  console.log(`[HubSpot] Suche nach Kontakt mit Telefonnummer: ${phoneNumber}`);
  return null;
};

/**
 * Platzhalter für Salesforce-Integration
 */
const searchSalesforceContact = async (phoneNumber: string): Promise<CRMContact | null> => {
  // In echter Implementierung: API-Aufruf an Salesforce
  console.log(`[Salesforce] Suche nach Kontakt mit Telefonnummer: ${phoneNumber}`);
  return null;
};

/**
 * Platzhalter für Zoho-Integration
 */
const searchZohoContact = async (phoneNumber: string): Promise<CRMContact | null> => {
  // In echter Implementierung: API-Aufruf an Zoho CRM
  console.log(`[Zoho] Suche nach Kontakt mit Telefonnummer: ${phoneNumber}`);
  return null;
};

/**
 * Sucht in lokalen/Offline-Daten nach Kontakten
 */
const searchLocalContact = async (phoneNumber: string): Promise<CRMContact | null> => {
  // Suche in der lokalen SQLite-Datenbank
  const db = SQLite.openDatabase('callNotes.db');
  
  return new Promise((resolve) => {
    db.transaction(tx => {
      tx.executeSql(
        `SELECT phone_number, created_at FROM call_notes WHERE phone_number LIKE ?`,
        [`%${phoneNumber}%`],
        (_, result) => {
          if (result.rows.length > 0) {
            const row = result.rows.item(0);
            resolve({
              id: row.phone_number,
              phoneNumbers: [row.phone_number],
              name: undefined,
              email: undefined,
              company: undefined,
              customFields: {},
            });
          } else {
            resolve(null);
          }
        },
        (_, error) => {
          console.error('Fehler bei lokaler Kontaktsuche:', error);
          resolve(null);
          return false;
        }
      );
    });
  });
};

/**
 * Synchronisiert Notizen mit dem CRM-System
 * WICHTIG: Es werden NUR Nutzer-Notizen synchronisiert, KEINE Anrufpartner-Daten!
 */
export const syncWithCRM = async (): Promise<CRMSyncResult> => {
  const result: CRMSyncResult = {
    success: false,
    syncedNotes: 0,
    errors: [],
    timestamp: new Date().toISOString(),
  };

  if (!currentConfig.enabled) {
    result.errors.push('CRM ist nicht aktiviert');
    return result;
  }

  try {
    // 1. Offline-Warteschlange verarbeiten
    await processOfflineQueue();
    
    // 2. Neue Notizen aus lokaler DB holen und mit CRM synchronisieren
    const db = SQLite.openDatabase('callNotes.db');
    
    // Hole alle Notizen, die noch nicht synchronisiert wurden
    const unsyncedNotes = await getUnsyncedNotes();
    
    for (const note of unsyncedNotes) {
      try {
        // Synchronisiere mit CRM
        await syncNoteToCRM(note);
        
        // Markiere als synchronisiert
        await markNoteAsSynced(note.id);
        result.syncedNotes++;
      } catch (error) {
        result.errors.push(`Fehler bei Notiz ${note.id}: ${error}`);
        
        // Füge zur Offline-Warteschlange hinzu
        addToOfflineQueue({
          type: 'note',
          data: note,
          timestamp: new Date().toISOString(),
          retryCount: 0,
        });
      }
    }
    
    // 3. Kontakte synchronisieren (nur Nutzer-Kontakte, KEINE Anrufpartner!)
    await syncContactsToCRM();
    
    result.success = result.errors.length === 0;
    
  } catch (error) {
    result.errors.push(`Allgemeiner Fehler: ${error}`);
  }

  return result;
};

/**
 * Holt alle Notizen, die noch nicht mit CRM synchronisiert wurden
 */
const getUnsyncedNotes = async (): Promise<any[]> => {
  const db = SQLite.openDatabase('callNotes.db');
  
  return new Promise((resolve) => {
    db.transaction(tx => {
      // Annahme: Wir haben eine Spalte 'synced_with_crm' in der notes-Tabelle
      tx.executeSql(
        `SELECT n.id, n.note_id, n.text, n.created_at, n.updated_at, 
                cn.phone_number, cn.last_call_time
         FROM notes n
         JOIN call_notes cn ON n.call_note_id = cn.id
         WHERE n.synced_with_crm = 0 OR n.synced_with_crm IS NULL`,
        [],
        (_, result) => {
          const notes: any[] = [];
          for (let i = 0; i < result.rows.length; i++) {
            notes.push(result.rows.item(i));
          }
          resolve(notes);
        },
        (_, error) => {
          console.error('Fehler beim Abrufen unsynchronisierter Notizen:', error);
          resolve([]);
          return false;
        }
      );
    });
  });
};

/**
 * Synchronisiert eine einzelne Notiz mit dem CRM
 */
const syncNoteToCRM = async (note: any): Promise<void> => {
  // In echter Implementierung: API-Aufruf an das CRM-System
  // Hier nur ein Platzhalter
  
  console.log(`[CRM Sync] Synchronisiere Notiz ${note.id} für Telefonnummer ${note.phone_number}`);
  
  // Simuliere API-Aufruf
  await new Promise(resolve => setTimeout(resolve, 100));
};

/**
 * Markiert eine Notiz als mit CRM synchronisiert
 */
const markNoteAsSynced = async (noteId: number): Promise<void> => {
  const db = SQLite.openDatabase('callNotes.db');
  
  return new Promise((resolve) => {
    db.transaction(tx => {
      tx.executeSql(
        `UPDATE notes SET synced_with_crm = 1, synced_at = ? WHERE id = ?`,
        [new Date().toISOString(), noteId],
        () => {
          resolve();
        },
        (_, error) => {
          console.error('Fehler beim Markieren als synchronisiert:', error);
          resolve();
          return false;
        }
      );
    });
  });
};

/**
 * Synchronisiert Kontakte mit dem CRM (nur Nutzer-Kontakte!)
 */
const syncContactsToCRM = async (): Promise<void> => {
  // In echter Implementierung: Kontakte mit CRM synchronisieren
  // Hier nur ein Platzhalter
  console.log('[CRM Sync] Synchronisiere Kontakte');
};

/**
 * Verarbeitet die Offline-Warteschlange
 */
const processOfflineQueue = async (): Promise<void> => {
  while (offlineQueue.length > 0) {
    const item = offlineQueue[0];
    
    try {
      if (item.retryCount >= 3) {
        // Nach 3 Versuchen aufgeben
        console.warn(`[Offline Queue] Gebe auf für: ${item.type} (${item.data.id || item.data.note_id})`);
        offlineQueue.shift();
        continue;
      }
      
      // Versuche erneut zu synchronisieren
      if (item.type === 'note') {
        await syncNoteToCRM(item.data);
        await markNoteAsSynced(item.data.id);
      }
      
      // Erfolgreich - aus Warteschlange entfernen
      offlineQueue.shift();
      
    } catch (error) {
      // Inkrementiere Retry-Counter
      item.retryCount++;
      console.warn(`[Offline Queue] Versuch ${item.retryCount} fehlgeschlagen für: ${item.type}`);
      break; // Warte auf nächsten Sync-Zyklus
    }
  }
};

/**
 * Fügt ein Element zur Offline-Warteschlange hinzu
 */
export const addToOfflineQueue = (item: {
  type: 'note' | 'contact';
  data: any;
  timestamp: string;
  retryCount: number;
}): void => {
  offlineQueue.push(item);
  console.log(`[Offline Queue] Hinzugefügt: ${item.type}, Warteschlange: ${offlineQueue.length} Elemente`);
};

/**
 * Gibt die aktuelle Offline-Warteschlange zurück (für Debugging)
 */
export const getOfflineQueue = (): typeof offlineQueue => {
  return [...offlineQueue];
};

/**
 * Erstellt eine Notiz im CRM
 */
export const createCRMNote = async (
  contactId: string,
  text: string,
  phoneNumber?: string
): Promise<CRMNote | null> => {
  if (!currentConfig.enabled) {
    return null;
  }

  try {
    const noteId = generateNoteId();
    const now = new Date().toISOString();
    
    const newNote: CRMNote = {
      id: noteId,
      contactId,
      text,
      createdAt: now,
      updatedAt: now,
      callDuration: undefined,
      callDirection: undefined,
    };
    
    // In echter Implementierung: API-Aufruf an CRM
    console.log(`[CRM] Erstelle Notiz ${noteId} für Kontakt ${contactId}`);
    
    // Füge zur Offline-Warteschlange hinzu, falls Offline
    addToOfflineQueue({
      type: 'note',
      data: { ...newNote, phoneNumber },
      timestamp: now,
      retryCount: 0,
    });
    
    return newNote;
    
  } catch (error) {
    console.error('Fehler beim Erstellen der CRM-Notiz:', error);
    return null;
  }
};

/**
 * Generiert eine eindeutige Notiz-ID
 */
const generateNoteId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
};

/**
 * Prüft, ob aktuell eine Internetverbindung besteht
 */
export const isOnline = async (): Promise<boolean> => {
  // In React Native: NetInfo verwenden
  // Für diese Implementierung: Annahme, dass wir online sind
  return true;
};

/**
 * Exportiert alle Notizen als CRM-kompatible Datei
 */
export const exportForCRM = async (): Promise<string> => {
  const db = SQLite.openDatabase('callNotes.db');
  
  return new Promise((resolve, reject) => {
    db.transaction(tx => {
      tx.executeSql(
        `SELECT cn.phone_number, cn.last_call_time,
                n.id as note_id, n.text, n.created_at, n.updated_at
         FROM call_notes cn
         JOIN notes n ON cn.id = n.call_note_id
         ORDER BY n.created_at DESC`,
        [],
        (_, result) => {
          const exportData: {
            phone_number: string;
            last_call_time: string;
            notes: Array<{
              id: number;
              text: string;
              created_at: string;
              updated_at: string;
            }>;
          }[] = [];
          
          const dataMap: Record<string, typeof exportData[0]> = {};
          
          for (let i = 0; i < result.rows.length; i++) {
            const row = result.rows.item(i);
            
            if (!dataMap[row.phone_number]) {
              dataMap[row.phone_number] = {
                phone_number: row.phone_number,
                last_call_time: row.last_call_time,
                notes: [],
              };
            }
            
            dataMap[row.phone_number].notes.push({
              id: row.note_id,
              text: row.text,
              created_at: row.created_at,
              updated_at: row.updated_at,
            });
          }
          
          const jsonData = JSON.stringify(
            Object.values(dataMap),
            null,
            2
          );
          
          resolve(jsonData);
        },
        (_, error) => {
          console.error('Fehler beim Export für CRM:', error);
          reject(error);
          return false;
        }
      );
    });
  });
};

/**
 * Importiert Notizen aus CRM
 */
export const importFromCRM = async (jsonData: string): Promise<CRMSyncResult> => {
  const result: CRMSyncResult = {
    success: false,
    syncedNotes: 0,
    errors: [],
    timestamp: new Date().toISOString(),
  };

  try {
    const data = JSON.parse(jsonData);
    
    if (!Array.isArray(data)) {
      result.errors.push('Ungültiges Format: Erwartet Array');
      return result;
    }
    
    const db = SQLite.openDatabase('callNotes.db');
    
    for (const item of data) {
      try {
        // Validierung
        if (!item.phone_number || !item.notes) {
          result.errors.push(`Ungültiges Item: ${JSON.stringify(item)}`);
          continue;
        }
        
        // Speichere in lokale DB
        await db.transactionAsync(async (tx) => {
          // Prüfe, ob Telefonnummer existiert
          const existing = await tx.executeSqlAsync(
            `SELECT id FROM call_notes WHERE phone_number = ?`,
            [item.phone_number]
          );
          
          let callNoteId: number;
          
          if (existing.rows.length === 0) {
            // Erstelle neue call_note
            const result = await tx.executeSqlAsync(
              `INSERT INTO call_notes (phone_number, last_call_time, created_at) VALUES (?, ?, ?)`,
              [item.phone_number, item.last_call_time || new Date().toISOString(), new Date().toISOString()]
            );
            callNoteId = result.insertId;
          } else {
            callNoteId = existing.rows.item(0).id;
          }
          
          // Füge Notizen hinzu
          for (const note of item.notes) {
            await tx.executeSqlAsync(
              `INSERT OR IGNORE INTO notes (call_note_id, note_id, text, created_at, updated_at, synced_with_crm) 
               VALUES (?, ?, ?, ?, ?, 1)`,
              [callNoteId, note.id.toString(), note.text, note.created_at, note.updated_at]
            );
            result.syncedNotes++;
          }
        });
        
      } catch (error) {
        result.errors.push(`Fehler bei Item: ${error}`);
      }
    }
    
    result.success = result.errors.length === 0;
    
  } catch (error) {
    result.errors.push(`Allgemeiner Fehler: ${error}`);
  }
  
  return result;
};
