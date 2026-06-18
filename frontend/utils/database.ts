import * as SQLite from 'expo-sqlite';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { executeSqlAsync } from './sqliteAsync';

// Öffne oder erstelle die SQLite-Datenbank
const db = SQLite.openDatabase('callNotes.db');

// Initialisiere alle Datenbank-Tabellen
export const initAllDatabases = async (): Promise<void> => {
  try {
    await initDatabase();
    await initFeedbackDatabase();
    await initContactNotesDatabase();
    await initComplianceDatabase();
  } catch (error) {
    console.error('Fehler bei der Initialisierung der Datenbanken:', error);
    throw error;
  }
};

// Initialisiere die Datenbank-Tabellen
export const initDatabase = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    db.transaction(tx => {
      // Tabelle für Anrufnotizen
      tx.executeSql(
        `CREATE TABLE IF NOT EXISTS call_notes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          phone_number TEXT NOT NULL UNIQUE,
          last_call_time TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );`,
        [],
        () => {},
        (_, error) => {
          console.error('Fehler beim Erstellen der call_notes-Tabelle:', error);
          return false;
        }
      );

      // Tabelle für einzelne Notizen
      tx.executeSql(
        `CREATE TABLE IF NOT EXISTS notes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          call_note_id INTEGER NOT NULL,
          note_id TEXT NOT NULL UNIQUE,
          text TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          synced_with_crm INTEGER DEFAULT 0,
          synced_at TEXT,
          FOREIGN KEY (call_note_id) REFERENCES call_notes(id) ON DELETE CASCADE
        );`,
        [],
        () => {},
        (_, error) => {
          console.error('Fehler beim Erstellen der notes-Tabelle:', error);
          return false;
        }
      );

      // Index für bessere Performance
      tx.executeSql(
        `CREATE INDEX IF NOT EXISTS idx_call_notes_phone_number ON call_notes(phone_number);`,
        [],
        () => {},
        (_, error) => {
          console.error('Fehler beim Erstellen des Index:', error);
          return false;
        }
      );

      tx.executeSql(
        `CREATE INDEX IF NOT EXISTS idx_notes_call_note_id ON notes(call_note_id);`,
        [],
        () => {},
        (_, error) => {
          console.error('Fehler beim Erstellen des Index:', error);
          return false;
        }
      );
    }, resolve, reject);
  });
};

// Interface für Notizen
export interface Note {
  id: number;
  note_id: string;
  text: string;
  created_at: string;
  updated_at: string;
}

// Interface für Anrufnotizen
export interface CallNote {
  id: number;
  phone_number: string;
  last_call_time: string;
  notes: Note[];
}

// Interface für Zusammenfassung
export interface PhoneNumberSummary {
  phone_number: string;
  last_note: string | null;
  last_call_time: string;
  note_count: number;
}

// Interfaces für Backup-Daten
export interface BackupNote {
  id: number;
  note_id: string;
  text: string;
  created_at: string;
  updated_at: string;
}

export interface BackupCallNote {
  id: number;
  phone_number: string;
  last_call_time: string;
  created_at: string;
  notes: BackupNote[];
}

export interface BackupData {
  version: string;
  created_at: string;
  call_notes: BackupCallNote[];
}

// Interface für signierte Backup-Daten
export interface SignedBackupData {
  backup: BackupData;
  signature: string;
  hash: string;
}

// Interface für Signatur-Informationen
export interface BackupSignature {
  hash: string;
  signature: string;
}

// Interface für Validierungsergebnis
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

// Hilfsfunktion für SQL-Transaktionen
const executeSql = (sql: string, params: any[] = []): Promise<any> => {
  return executeSqlAsync(db, sql, params);
};

// Schlüssel für das Secret im AsyncStorage
const BACKUP_SECRET_KEY = 'backup_signature_secret';

// Generiere oder hole das Secret für die HMAC-Signatur
const getOrCreateSecret = async (): Promise<string> => {
  try {
    // Prüfen, ob ein Secret bereits existiert
    const existingSecret = await AsyncStorage.getItem(BACKUP_SECRET_KEY);
    if (existingSecret) {
      return existingSecret;
    }

    // Neues Secret generieren (32 Bytes als Hex-String)
    const secretArray = new Uint8Array(32);
    if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
      window.crypto.getRandomValues(secretArray);
    } else {
      // Fallback für React Native ohne Web Crypto API
      for (let i = 0; i < 32; i++) {
        secretArray[i] = Math.floor(Math.random() * 256);
      }
    }

    // Convert to hex string
    const secret = Array.from(secretArray)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    // Secret speichern
    await AsyncStorage.setItem(BACKUP_SECRET_KEY, secret);
    return secret;
  } catch (error) {
    console.error('Fehler beim Abrufen/Erstellen des Secrets:', error);
    throw error;
  }
};

// Erstelle einen SHA-256 Hash des Backup-Inhalts
const createHash = async (data: string): Promise<string> => {
  try {
    // Encode data as UTF-8
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);

    // Hash the data
    if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
      const hashBuffer = await window.crypto.subtle.digest('SHA-256', dataBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } else {
      // Fallback für React Native
      // Verwende react-native-crypto falls verfügbar
      try {
        const crypto = require('react-native-crypto');
        const hash = crypto.createHash('sha256');
        hash.update(data);
        return hash.digest('hex');
      } catch (fallbackError) {
        // Einfacher Fallback (nicht kryptografisch sicher!)
        console.warn('Keine sichere Hash-Funktion verfügbar, verwende Fallback');
        // Dies ist nur ein Fallback und sollte nicht in Produktion verwendet werden
        return data.split('').reduce((a, b) => {
          a = ((a << 5) - a) + b.charCodeAt(0);
          return a & a;
        }, 0).toString(16);
      }
    }
  } catch (error) {
    console.error('Fehler beim Erstellen des Hash:', error);
    throw error;
  }
};

// Erstelle eine HMAC-Signatur mit dem Secret
const createHmacSignature = async (data: string, secret: string): Promise<string> => {
  try {
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    const secretBuffer = encoder.encode(secret);

    if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
      // Import the secret key
      const key = await window.crypto.subtle.importKey(
        'raw',
        secretBuffer,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );

      // Sign the data
      const signatureBuffer = await window.crypto.subtle.sign('HMAC', key, dataBuffer);
      const signatureArray = Array.from(new Uint8Array(signatureBuffer));
      return signatureArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } else {
      // Fallback für React Native
      try {
        const crypto = require('react-native-crypto');
        const hmac = crypto.createHmac('sha256', secret);
        hmac.update(data);
        return hmac.digest('hex');
      } catch (fallbackError) {
        console.error('Fehler beim Erstellen der HMAC-Signatur:', fallbackError);
        throw new Error('HMAC-Signatur nicht verfügbar: react-native-crypto nicht installiert');
      }
    }
  } catch (error) {
    console.error('Fehler beim Erstellen der HMAC-Signatur:', error);
    throw error;
  }
};

// Überprüfe eine HMAC-Signatur
const verifyHmacSignature = async (data: string, secret: string, signature: string): Promise<boolean> => {
  try {
    const expectedSignature = await createHmacSignature(data, secret);
    return expectedSignature === signature;
  } catch (error) {
    console.error('Fehler beim Überprüfen der HMAC-Signatur:', error);
    return false;
  }
};

// Alle Telefonnummern abrufen
export const getAllPhoneNumbers = (search?: string): Promise<PhoneNumberSummary[]> => {
  return new Promise((resolve, reject) => {
    db.transaction(tx => {
      let query = `
        SELECT cn.phone_number, cn.last_call_time, 
               n.text as last_note, 
               COUNT(n.id) as note_count
        FROM call_notes cn
        LEFT JOIN notes n ON cn.id = n.call_note_id
      `;
      const params: any[] = [];

      if (search) {
        query += ` WHERE cn.phone_number LIKE ? OR n.text LIKE ?`;
        params.push(`%${search}%`, `%${search}%`);
      }

      query += ` GROUP BY cn.phone_number ORDER BY cn.last_call_time DESC`;

      tx.executeSql(
        query,
        params,
        (_, result) => {
          const summaries: PhoneNumberSummary[] = [];
          for (let i = 0; i < result.rows.length; i++) {
            const row = result.rows.item(i);
            summaries.push({
              phone_number: row.phone_number,
              last_note: row.last_note || null,
              last_call_time: row.last_call_time,
              note_count: row.note_count
            });
          }
          resolve(summaries);
        },
        (_, error) => {
          console.error('Fehler beim Abrufen der Telefonnummern:', error);
          reject(error);
          return false;
        }
      );
    });
  });
};

// Notizen für eine bestimmte Telefonnummer abrufen
export const getNotesForPhoneNumber = (phone_number: string): Promise<CallNote | null> => {
  return new Promise((resolve, reject) => {
    db.transaction(tx => {
      // Zuerst die call_note abrufen
      tx.executeSql(
        `SELECT id, phone_number, last_call_time FROM call_notes WHERE phone_number = ?`,
        [phone_number],
        (_, result) => {
          if (result.rows.length === 0) {
            resolve(null);
            return;
          }

          const callNoteRow = result.rows.item(0);

          // Dann alle Notizen für diese call_note abrufen
          tx.executeSql(
            `SELECT id, note_id, text, created_at, updated_at FROM notes WHERE call_note_id = ? ORDER BY created_at DESC`,
            [callNoteRow.id],
            (_, notesResult) => {
              const notes: Note[] = [];
              for (let i = 0; i < notesResult.rows.length; i++) {
                const noteRow = notesResult.rows.item(i);
                notes.push({
                  id: noteRow.id,
                  note_id: noteRow.note_id,
                  text: noteRow.text,
                  created_at: noteRow.created_at,
                  updated_at: noteRow.updated_at
                });
              }

              const callNote: CallNote = {
                id: callNoteRow.id,
                phone_number: callNoteRow.phone_number,
                last_call_time: callNoteRow.last_call_time,
                notes: notes
              };
              resolve(callNote);
            },
            (_, error) => {
              console.error('Fehler beim Abrufen der Notizen:', error);
              reject(error);
              return false;
            }
          );
        },
        (_, error) => {
          console.error('Fehler beim Abrufen der call_note:', error);
          reject(error);
          return false;
        }
      );
    });
  });
};

// Neue Notiz erstellen
export const createNote = (phone_number: string, text: string): Promise<Note> => {
  return new Promise((resolve, reject) => {
    db.transaction(tx => {
      // Prüfen, ob die Telefonnummer bereits existiert
      tx.executeSql(
        `SELECT id FROM call_notes WHERE phone_number = ?`,
        [phone_number],
        (_, result) => {
          let callNoteId: number;

          if (result.rows.length === 0) {
            // Neue call_note erstellen
            const now = new Date().toISOString();
            tx.executeSql(
              `INSERT INTO call_notes (phone_number, last_call_time, created_at) VALUES (?, ?, ?)`,
              [phone_number, now, now],
              (_, insertResult) => {
                callNoteId = insertResult.insertId;
                insertNote(tx, callNoteId, text, resolve, reject);
              },
              (_, error) => {
                console.error('Fehler beim Erstellen der call_note:', error);
                reject(error);
                return false;
              }
            );
          } else {
            // Bestehende call_note verwenden und last_call_time aktualisieren
            const callNoteRow = result.rows.item(0);
            callNoteId = callNoteRow.id;
            const now = new Date().toISOString();
            tx.executeSql(
              `UPDATE call_notes SET last_call_time = ? WHERE id = ?`,
              [now, callNoteId],
              () => {
                insertNote(tx, callNoteId, text, resolve, reject);
              },
              (_, error) => {
                console.error('Fehler beim Aktualisieren der call_note:', error);
                reject(error);
                return false;
              }
            );
          }
        },
        (_, error) => {
          console.error('Fehler beim Prüfen der Telefonnummer:', error);
          reject(error);
          return false;
        }
      );
    });
  });
};

// Hilfsfunktion zum Einfügen einer Notiz
const insertNote = (tx: SQLite.SQLiteTransaction, callNoteId: number, text: string, resolve: any, reject: any) => {
  const noteId = generateNoteId();
  const now = new Date().toISOString();

  tx.executeSql(
    `INSERT INTO notes (call_note_id, note_id, text, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
    [callNoteId, noteId, text, now, now],
    (_, result) => {
      const note: Note = {
        id: result.insertId,
        note_id: noteId,
        text: text,
        created_at: now,
        updated_at: now
      };
      resolve(note);
    },
    (_, error) => {
      console.error('Fehler beim Erstellen der Notiz:', error);
      reject(error);
      return false;
    }
  );
};

// Notiz aktualisieren
export const updateNote = (phone_number: string, note_id: string, text: string): Promise<Note | null> => {
  return new Promise((resolve, reject) => {
    db.transaction(tx => {
      // Zuerst die call_note_id für die Telefonnummer abrufen
      tx.executeSql(
        `SELECT id FROM call_notes WHERE phone_number = ?`,
        [phone_number],
        (_, result) => {
          if (result.rows.length === 0) {
            resolve(null);
            return;
          }

          const callNoteId = result.rows.item(0).id;
          const updatedAt = new Date().toISOString();

          // Notiz aktualisieren
          tx.executeSql(
            `UPDATE notes SET text = ?, updated_at = ? WHERE note_id = ? AND call_note_id = ?`,
            [text, updatedAt, note_id, callNoteId],
            (_, updateResult) => {
              if (updateResult.rowsAffected === 0) {
                resolve(null);
                return;
              }

              // Aktualisierte Notiz abrufen
              tx.executeSql(
                `SELECT id, note_id, text, created_at, updated_at FROM notes WHERE note_id = ?`,
                [note_id],
                (_, selectResult) => {
                  if (selectResult.rows.length === 0) {
                    resolve(null);
                    return;
                  }

                  const row = selectResult.rows.item(0);
                  const note: Note = {
                    id: row.id,
                    note_id: row.note_id,
                    text: row.text,
                    created_at: row.created_at,
                    updated_at: row.updated_at
                  };
                  resolve(note);
                },
                (_, error) => {
                  console.error('Fehler beim Abrufen der aktualisierten Notiz:', error);
                  reject(error);
                  return false;
                }
              );
            },
            (_, error) => {
              console.error('Fehler beim Aktualisieren der Notiz:', error);
              reject(error);
              return false;
            }
          );
        },
        (_, error) => {
          console.error('Fehler beim Abrufen der call_note:', error);
          reject(error);
          return false;
        }
      );
    });
  });
};

// Notiz löschen
export const deleteNote = (phone_number: string, note_id: string): Promise<boolean> => {
  return new Promise((resolve, reject) => {
    db.transaction(tx => {
      // Zuerst die call_note_id für die Telefonnummer abrufen
      tx.executeSql(
        `SELECT id FROM call_notes WHERE phone_number = ?`,
        [phone_number],
        (_, result) => {
          if (result.rows.length === 0) {
            resolve(false);
            return;
          }

          const callNoteId = result.rows.item(0).id;

          // Notiz löschen
          tx.executeSql(
            `DELETE FROM notes WHERE note_id = ? AND call_note_id = ?`,
            [note_id, callNoteId],
            (_, deleteResult) => {
              resolve(deleteResult.rowsAffected > 0);
            },
            (_, error) => {
              console.error('Fehler beim Löschen der Notiz:', error);
              reject(error);
              return false;
            }
          );
        },
        (_, error) => {
          console.error('Fehler beim Abrufen der call_note:', error);
          reject(error);
          return false;
        }
      );
    });
  });
};

// Anruf als gestartet markieren
export const markCallStarted = (phone_number: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    db.transaction(tx => {
      const now = new Date().toISOString();

      tx.executeSql(
        `SELECT id FROM call_notes WHERE phone_number = ?`,
        [phone_number],
        (_, result) => {
          if (result.rows.length === 0) {
            tx.executeSql(
              `INSERT INTO call_notes (phone_number, last_call_time, created_at) VALUES (?, ?, ?)`,
              [phone_number, now, now],
              () => {
                resolve();
              },
              (_, error) => {
                console.error('Fehler beim Erstellen der call_note:', error);
                reject(error);
                return false;
              }
            );
          } else {
            const callNoteId = result.rows.item(0).id;
            tx.executeSql(
              `UPDATE call_notes SET last_call_time = ? WHERE id = ?`,
              [now, callNoteId],
              () => {
                resolve();
              },
              (_, error) => {
                console.error('Fehler beim Aktualisieren der call_note:', error);
                reject(error);
                return false;
              }
            );
          }
        },
        (_, error) => {
          console.error('Fehler beim Prüfen der Telefonnummer:', error);
          reject(error);
          return false;
        }
      );
    });
  });
};

// Backup erstellen
export const createBackup = async (): Promise<SignedBackupData> => {
  try {
    const backupData = await new Promise<BackupData>((resolve, reject) => {
      db.transaction(tx => {
        tx.executeSql(
          `SELECT id, phone_number, last_call_time, created_at FROM call_notes`,
          [],
          (_, callNotesResult) => {
            const callNotes: BackupCallNote[] = [];
            const callNoteMap: { [key: number]: BackupCallNote } = {};

            for (let i = 0; i < callNotesResult.rows.length; i++) {
              const row = callNotesResult.rows.item(i);
              const callNote: BackupCallNote = {
                id: row.id,
                phone_number: row.phone_number,
                last_call_time: row.last_call_time,
                created_at: row.created_at,
                notes: []
              };
              callNotes.push(callNote);
              callNoteMap[row.id] = callNote;
            }

            tx.executeSql(
              `SELECT call_note_id, id, note_id, text, created_at, updated_at FROM notes`,
              [],
              (_, notesResult) => {
                for (let i = 0; i < notesResult.rows.length; i++) {
                  const row = notesResult.rows.item(i);
                  const callNote = callNoteMap[row.call_note_id];
                  if (callNote) {
                    callNote.notes.push({
                      id: row.id,
                      note_id: row.note_id,
                      text: row.text,
                      created_at: row.created_at,
                      updated_at: row.updated_at
                    });
                  }
                }

                const backup: BackupData = {
                  version: '1.0.0',
                  created_at: new Date().toISOString(),
                  call_notes: callNotes
                };
                resolve(backup);
              },
              (_, error) => {
                console.error('Fehler beim Abrufen der Notizen für Backup:', error);
                reject(error);
                return false;
              }
            );
          },
          (_, error) => {
            console.error('Fehler beim Abrufen der call_notes für Backup:', error);
            reject(error);
            return false;
          }
        );
      });
    });

    // Backup-Daten als JSON-String serialisieren
    const backupJson = JSON.stringify(backupData);

    // SHA-256 Hash erstellen
    const hash = await createHash(backupJson);

    // Secret abrufen oder erstellen
    const secret = await getOrCreateSecret();

    // HMAC-Signatur erstellen
    const signature = await createHmacSignature(backupJson, secret);

    return {
      backup: backupData,
      hash: hash,
      signature: signature
    };
  } catch (error) {
    console.error('Fehler beim Erstellen des signierten Backups:', error);
    throw error;
  }
};

// Signatur eines Backups überprüfen
export const verifyBackupSignature = async (backupData: BackupData, signature: string, hash?: string): Promise<boolean> => {
  try {
    // Backup-Daten als JSON-String serialisieren
    const backupJson = JSON.stringify(backupData);

    // Optional: Hash überprüfen
    if (hash) {
      const computedHash = await createHash(backupJson);
      if (computedHash !== hash) {
        console.error('Hash-Überprüfung fehlgeschlagen: Backup-Daten wurden manipuliert');
        return false;
      }
    }

    // Secret abrufen
    const secret = await getOrCreateSecret();

    // Signatur überprüfen
    const isValid = await verifyHmacSignature(backupJson, secret, signature);

    if (!isValid) {
      console.error('Signatur-Überprüfung fehlgeschlagen: Backup ist nicht vertrauenswürdig');
    }

    return isValid;
  } catch (error) {
    console.error('Fehler beim Überprüfen der Backup-Signatur:', error);
    return false;
  }
};

// Backup wiederherstellen
export const restoreBackup = async (backupData: BackupData | SignedBackupData, merge: boolean = false, skipSignatureCheck: boolean = false): Promise<void> => {
  try {
    // Extrahiere BackupData aus SignedBackupData falls vorhanden
    let actualBackupData: BackupData;
    let signature: string | undefined;
    let hash: string | undefined;

    if ('backup' in backupData && 'signature' in backupData) {
      const signedData = backupData as SignedBackupData;
      actualBackupData = signedData.backup;
      signature = signedData.signature;
      hash = signedData.hash;
    } else {
      actualBackupData = backupData as BackupData;
    }

    // Signaturprüfung durchführen (außer wenn explizit übersprungen)
    if (signature && !skipSignatureCheck) {
      const isValid = await verifyBackupSignature(actualBackupData, signature, hash);
      if (!isValid) {
        throw new Error('Backup-Signatur ist ungültig. Das Backup könnte manipuliert worden sein.');
      }
    } else if (!skipSignatureCheck) {
      console.warn('Keine Signatur gefunden. Backup wird ohne Signaturprüfung wiederhergestellt.');
      // Für Abwärtskompatibilität: alte Backups ohne Signatur werden akzeptiert
      // aber mit einer Warnung
    }

    // Datenbank-Transaktion für die Wiederherstellung
    await new Promise<void>((resolve, reject) => {
      db.transaction(tx => {
        if (!merge) {
          // Löschen aller bestehenden Daten
          tx.executeSql(
            `DELETE FROM notes`,
            [],
            () => {},
            (_, error) => {
              console.error('Fehler beim Löschen der Notizen:', error);
              return false;
            }
          );
          tx.executeSql(
            `DELETE FROM call_notes`,
            [],
            () => {},
            (_, error) => {
              console.error('Fehler beim Löschen der call_notes:', error);
              return false;
            }
          );
        }

        // Wiederherstellen der Daten
        let completed = 0;
        const total = actualBackupData.call_notes.length;

        if (total === 0) {
          resolve();
          return;
        }

        actualBackupData.call_notes.forEach((callNoteData, index) => {
          tx.executeSql(
            `INSERT OR REPLACE INTO call_notes (id, phone_number, last_call_time, created_at) VALUES (?, ?, ?, ?)`,
            [callNoteData.id, callNoteData.phone_number, callNoteData.last_call_time, callNoteData.created_at],
            () => {
              callNoteData.notes.forEach(noteData => {
                tx.executeSql(
                  `INSERT OR REPLACE INTO notes (id, call_note_id, note_id, text, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
                  [noteData.id, callNoteData.id, noteData.note_id, noteData.text, noteData.created_at, noteData.updated_at],
                  () => {},
                  (_, error) => {
                    console.error('Fehler beim Wiederherstellen der Notiz:', error);
                    return false;
                  }
                );
              });

              completed++;
              if (completed === total) {
                resolve();
              }
            },
            (_, error) => {
              console.error('Fehler beim Wiederherstellen der call_note:', error);
              reject(error);
              return false;
            }
          );
        });
      });
    });
  } catch (error) {
    console.error('Fehler beim Wiederherstellen des Backups:', error);
    throw error;
  }
};

// Hilfsfunktion zum Generieren einer eindeutigen Note-ID
const generateNoteId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
};

// Telefonnummer validieren
export const validatePhoneNumber = (phoneNumber: string): boolean => {
  const cleaned = phoneNumber.replace(/[^\d+]/g, '');
  
  const regex = /^\+\d{8,15}$/;
  
  if (!cleaned.startsWith('+')) {
    if (/^\d{10,15}$/.test(cleaned)) {
      return true;
    }
    return false;
  }
  
  return regex.test(cleaned);
};

// Validierungsfunktionen
const isArray = (value: any): value is any[] => {
  return Array.isArray(value);
};

const isString = (value: any): value is string => {
  return typeof value === 'string';
};

const isNumber = (value: any): value is number => {
  return typeof value === 'number';
};

// Validiere Backup-Daten
export const validateBackupData = (backupData: any): ValidationResult => {
  const errors: string[] = [];

  if (!isString(backupData.version)) {
    errors.push(`version muss ein String sein, ist aber ${typeof backupData.version}`);
  }
  
  if (!isString(backupData.created_at)) {
    errors.push(`created_at muss ein String sein, ist aber ${typeof backupData.created_at}`);
  }
  
  if (!isArray(backupData.call_notes)) {
    errors.push(`call_notes muss ein Array sein, ist aber ${typeof backupData.call_notes}`);
    return { valid: false, errors };
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
};

// Importiere notwendige Funktionen
import { 
  initFeedbackDatabase,
  createFeedback 
} from './feedbackService';

import { 
  initContactNotesDatabase 
} from './contactNotesService';

import { 
  initComplianceDatabase 
} from './complianceService';
