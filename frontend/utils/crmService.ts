/*
  CRM-Service (offline-first) — enqueuePersistent now contains dedupe logic:
  - Option B: prevent duplicates within a 5-minute window (based on item.timestamp)
  Duplicate detection is performed in JS by reading recent queue rows and parsing their JSON payload.
*/

import * as SQLite from 'expo-sqlite';
import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';

export interface CRMContact { id: string; phoneNumbers: string[]; name?: string; email?: string; company?: string; customFields?: Record<string,string>; }
export interface CRMNote { id: string; contactId: string; text: string; createdAt: string; updatedAt: string; callDuration?: number; callDirection?: 'incoming' | 'outgoing'; }
export interface CRMSyncResult { success: boolean; syncedNotes: number; errors: string[]; timestamp: string; }
export interface CRMConfig { type: 'hubspot' | 'salesforce' | 'zoho' | 'custom'; enabled: boolean; autoSync: boolean; syncInterval: number; }

const DEFAULT_CONFIG: CRMConfig = { type: 'custom', enabled: false, autoSync: false, syncInterval: 60 };

let currentConfig: CRMConfig = { ...DEFAULT_CONFIG };

const db = SQLite.openDatabase('callNotes.db');

const FIVE_MINUTES_MS = 5 * 60 * 1000;

const ensureQueueTable = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    db.transaction(tx => {
      tx.executeSql(
        `CREATE TABLE IF NOT EXISTS crm_queue (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          type TEXT NOT NULL,
          data TEXT NOT NULL,
          timestamp TEXT NOT NULL,
          retry_count INTEGER DEFAULT 0
        );`,
        [],
        () => resolve(),
        (_, error) => { console.error('Fehler beim Erstellen der crm_queue-Tabelle:', error); return false; }
      );
    }, reject);
  });
};

export const initCRMService = async (): Promise<void> => {
  await loadConfig();
  await ensureQueueTable();
};

const loadConfig = async (): Promise<void> => {
  try {
    const configFile = `${FileSystem.documentDirectory}crm_config.json`;
    const fileInfo = await FileSystem.getInfoAsync(configFile);
    if (fileInfo.exists) {
      const configContent = await FileSystem.readAsStringAsync(configFile);
      const savedConfig = JSON.parse(configContent);
      currentConfig = { ...DEFAULT_CONFIG, type: savedConfig.type || DEFAULT_CONFIG.type, enabled: !!savedConfig.enabled, autoSync: !!savedConfig.autoSync, syncInterval: savedConfig.syncInterval || DEFAULT_CONFIG.syncInterval };
    }
  } catch (error) { console.error('Fehler beim Laden der CRM-Konfiguration:', error); }
};

export const saveConfig = async (config: Partial<CRMConfig>): Promise<void> => {
  currentConfig = { ...currentConfig, ...config };
  try {
    const configFile = `${FileSystem.documentDirectory}crm_config.json`;
    const toPersist = { type: currentConfig.type, enabled: currentConfig.enabled, autoSync: currentConfig.autoSync, syncInterval: currentConfig.syncInterval };
    await FileSystem.writeAsStringAsync(configFile, JSON.stringify(toPersist, null, 2));
  } catch (error) { console.error('Fehler beim Speichern der CRM-Konfiguration:', error); throw error; }
};

export const getConfig = (): CRMConfig => ({ ...currentConfig });

// persistent enqueue with dedupe within 5 minutes (Option B)
export const enqueuePersistent = async (item: { type: 'note' | 'contact'; data: any; timestamp: string; retryCount: number; }): Promise<number> => {
  // 1) Read recent queue entries and check for duplicates within the time window
  const recentRows: Array<{ id: number; data: string; timestamp: string }> = await new Promise((resolve) => {
    db.transaction(tx => {
      tx.executeSql(`SELECT id, data, timestamp FROM crm_queue WHERE type = ? ORDER BY id DESC LIMIT 200`, [item.type], (_, result) => {
        const rows: any[] = [];
        for (let i = 0; i < result.rows.length; i++) rows.push(result.rows.item(i));
        resolve(rows);
      }, (_, error) => { console.error('Fehler beim Lesen der persistenten Queue für Dedupe:', error); resolve([]); return false; });
    });
  });

  try {
    const now = new Date(item.timestamp).getTime();
    for (const row of recentRows) {
      try {
        const parsed = JSON.parse(row.data);
        const rowTime = new Date(row.timestamp).getTime();
        if (Math.abs(now - rowTime) <= FIVE_MINUTES_MS) {
          // duplicate if same note id
          if (parsed && parsed.id && item.data && item.data.id && parsed.id === item.data.id) {
            // return existing id
            return row.id;
          }
          // duplicate if same text and phoneNumber
          if (parsed && parsed.text && item.data && item.data.text) {
            const sameText = parsed.text === item.data.text;
            const phoneA = parsed.phoneNumber || parsed.phone_number || parsed.phone;
            const phoneB = item.data.phoneNumber || item.data.phone_number || item.data.phone;
            if (sameText && phoneA && phoneB && phoneA === phoneB) {
              return row.id;
            }
          }
        }
      } catch (e) {
        // ignore parse errors
      }
    }
  } catch (e) {
    console.warn('Dedupe-Check schlug fehl:', e);
  }

  // 2) If no duplicate found, insert
  return await new Promise((resolve, reject) => {
    const payload = JSON.stringify(item.data);
    db.transaction(tx => {
      tx.executeSql(`INSERT INTO crm_queue (type, data, timestamp, retry_count) VALUES (?, ?, ?, ?)`, [item.type, payload, item.timestamp, item.retryCount], (_, result) => {
        resolve(result.insertId);
      }, (_, error) => { console.error('Fehler beim Enqueue:', error); reject(error); return false; });
    });
  });
};

export const getPersistentQueue = async (limit = 50): Promise<Array<{ id: number; type: string; data: any; timestamp: string; retry_count: number }>> => {
  return new Promise((resolve) => {
    db.transaction((tx) => {
      tx.executeSql(`SELECT id, type, data, timestamp, retry_count FROM crm_queue ORDER BY id LIMIT ?`, [limit], (_, result) => {
        const items: any[] = [];
        for (let i = 0; i < result.rows.length; i++) {
          const row = result.rows.item(i);
          items.push({ id: row.id, type: row.type, data: JSON.parse(row.data), timestamp: row.timestamp, retry_count: row.retry_count });
        }
        resolve(items);
      }, (_, error) => { console.error('Fehler beim Lesen der persistenten Queue:', error); resolve([]); return false; });
    });
  });
};

export const removePersistentQueueItem = async (id: number): Promise<void> => {
  return new Promise((resolve) => {
    db.transaction((tx) => {
      tx.executeSql(`DELETE FROM crm_queue WHERE id = ?`, [id], () => resolve(), (_, error) => { console.error('Fehler beim Löschen Queue-Item:', error); resolve(); return false; });
    });
  });
};

const syncNoteToCRM = async (note: any): Promise<void> => {
  // Offline-first placeholder
  await new Promise((r) => setTimeout(r, 100));
};

const markNoteAsSynced = async (noteId: number): Promise<void> => {
  return new Promise((resolve) => {
    db.transaction((tx) => {
      tx.executeSql(`UPDATE notes SET synced_with_crm = 1, synced_at = ? WHERE id = ?`, [new Date().toISOString(), noteId], () => resolve(), () => { resolve(); return false; });
    });
  });
};

const processOfflineQueue = async (): Promise<void> => {
  const items = await getPersistentQueue(100);
  for (const item of items) {
    try {
      if (item.type === 'note') {
        await syncNoteToCRM(item.data);
        if (item.data && item.data.id) {
          await markNoteAsSynced(item.data.id);
        }
      }
      await removePersistentQueueItem(item.id);
    } catch (error) {
      console.warn(`[Offline Queue] Verarbeitung fehlgeschlagen für id=${item.id}:`, error);
      db.transaction((tx) => { tx.executeSql(`UPDATE crm_queue SET retry_count = retry_count + 1 WHERE id = ?`, [item.id]); });
    }
  }
};

export const addToOfflineQueue = async (item: { type: 'note' | 'contact'; data: any; timestamp: string; retryCount: number; }): Promise<number> => {
  return await enqueuePersistent(item);
};

export const getOfflineQueue = async (): Promise<any[]> => { return await getPersistentQueue(1000); };

export const createCRMNote = async (contactId: string, text: string, phoneNumber?: string): Promise<CRMNote | null> => {
  try {
    const noteId = generateNoteId();
    const now = new Date().toISOString();
    const newNote: CRMNote = { id: noteId, contactId, text, createdAt: now, updatedAt: now };
    await enqueuePersistent({ type: 'note', data: { ...newNote, phoneNumber }, timestamp: now, retryCount: 0 });
    return newNote;
  } catch (error) { console.error('Fehler beim Erstellen der CRM-Notiz:', error); return null; }
};

const generateNoteId = (): string => `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

export const isOnline = async (): Promise<boolean> => { return false; };

export const exportForCRM = async (): Promise<string> => {
  const db2 = SQLite.openDatabase('callNotes.db');
  return new Promise((resolve, reject) => {
    db2.transaction((tx) => {
      tx.executeSql(`SELECT cn.phone_number, cn.last_call_time, n.id as note_id, n.text, n.created_at, n.updated_at FROM call_notes cn JOIN notes n ON cn.id = n.call_note_id ORDER BY n.created_at DESC`, [], (_, result) => {
        const dataMap: Record<string, any> = {};
        for (let i = 0; i < result.rows.length; i++) {
          const row = result.rows.item(i);
          if (!dataMap[row.phone_number]) dataMap[row.phone_number] = { phone_number: row.phone_number, last_call_time: row.last_call_time, notes: [] };
          dataMap[row.phone_number].notes.push({ id: row.note_id, text: row.text, created_at: row.created_at, updated_at: row.updated_at });
        }
        resolve(JSON.stringify(Object.values(dataMap), null, 2));
      }, (_, error) => { console.error('Fehler beim Export für CRM:', error); reject(error); return false; });
    });
  });
};

export const importFromCRM = async (jsonData: string): Promise<CRMSyncResult> => {
  const result: CRMSyncResult = { success: false, syncedNotes: 0, errors: [], timestamp: new Date().toISOString() };
  try {
    const data = JSON.parse(jsonData);
    if (!Array.isArray(data)) { result.errors.push('Ungültiges Format: Erwartet Array'); return result; }
    const db2 = SQLite.openDatabase('callNotes.db');
    for (const item of data) {
      try {
        if (!item.phone_number || !item.notes) { result.errors.push(`Ungültiges Item: ${JSON.stringify(item)}`); continue; }
        await new Promise<void>((resolve) => {
          db2.transaction((tx) => {
            tx.executeSql(`SELECT id FROM call_notes WHERE phone_number = ?`, [item.phone_number], (_, existing) => {
              const handleNotes = (callNoteId: number) => {
                for (const note of item.notes) {
                  tx.executeSql(`INSERT OR IGNORE INTO notes (call_note_id, note_id, text, created_at, updated_at, synced_with_crm) VALUES (?, ?, ?, ?, ?, 1)`, [callNoteId, note.id.toString(), note.text, note.created_at, note.updated_at]);
                  result.syncedNotes++;
                }
                resolve();
              };
              if (existing.rows.length === 0) {
                tx.executeSql(`INSERT INTO call_notes (phone_number, last_call_time, created_at) VALUES (?, ?, ?)`, [item.phone_number, item.last_call_time || new Date().toISOString(), new Date().toISOString()], (_, insertResult) => { handleNotes(insertResult.insertId); });
              } else { handleNotes(existing.rows.item(0).id); }
            });
          }, () => { resolve(); });
        });
      } catch (error) { result.errors.push(`Fehler bei Item: ${error}`); }
    }
    result.success = result.errors.length === 0;
  } catch (error) { result.errors.push(`Allgemeiner Fehler: ${error}`); }
  return result;
};
