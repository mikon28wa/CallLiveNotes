import * as SQLite from 'expo-sqlite';
import { Platform } from 'react-native';

// Öffne oder erstelle die SQLite-Datenbank
const db = SQLite.openDatabase('callNotes.db');

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

// Hilfsfunktion für SQL-Transaktionen
const executeSql = (sql: string, params: any[] = []): Promise<any> => {
  return new Promise((resolve, reject) => {
    db.transaction(tx => {
      tx.executeSql(
        sql,
        params,
        (_, result) => {
          resolve(result);
        },
        (_, error) => {
          console.error('SQL-Fehler:', sql, error);
          reject(error);
          return false;
        }
      );
    });
  });
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

// Anruf als gestartet markieren (für Anruferkennung)
export const markCallStarted = (phone_number: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    db.transaction(tx => {
      const now = new Date().toISOString();

      // Prüfen, ob die Telefonnummer bereits existiert
      tx.executeSql(
        `SELECT id FROM call_notes WHERE phone_number = ?`,
        [phone_number],
        (_, result) => {
          if (result.rows.length === 0) {
            // Neue call_note erstellen
            tx.executeSql(
              `INSERT INTO call_notes (phone_number, last_call_time, created_at) VALUES (?, ?, ?)`,
              [phone_number, now, now],
              () => {
                resolve();
              },
              (_, error) => {
                console.error('Fehler beim Erstellen der call_note für Anruf:', error);
                reject(error);
                return false;
              }
            );
          } else {
            // Bestehende call_note aktualisieren
            const callNoteId = result.rows.item(0).id;
            tx.executeSql(
              `UPDATE call_notes SET last_call_time = ? WHERE id = ?`,
              [now, callNoteId],
              () => {
                resolve();
              },
              (_, error) => {
                console.error('Fehler beim Aktualisieren der call_note für Anruf:', error);
                reject(error);
                return false;
              }
            );
          }
        },
        (_, error) => {
          console.error('Fehler beim Prüfen der Telefonnummer für Anruf:', error);
          reject(error);
          return false;
        }
      );
    });
  });
};

// Backup erstellen
export const createBackup = (): Promise<any> => {
  return new Promise((resolve, reject) => {
    db.transaction(tx => {
      // Alle call_notes abrufen
      tx.executeSql(
        `SELECT id, phone_number, last_call_time, created_at FROM call_notes`,
        [],
        (_, callNotesResult) => {
          const callNotes: any[] = [];
          const callNoteMap: { [key: number]: any } = {};

          // call_notes verarbeiten
          for (let i = 0; i < callNotesResult.rows.length; i++) {
            const row = callNotesResult.rows.item(i);
            const callNote = {
              id: row.id,
              phone_number: row.phone_number,
              last_call_time: row.last_call_time,
              created_at: row.created_at,
              notes: []
            };
            callNotes.push(callNote);
            callNoteMap[row.id] = callNote;
          }

          // Alle Notizen abrufen
          tx.executeSql(
            `SELECT id, call_note_id, note_id, text, created_at, updated_at FROM notes`,
            [],
            (_, notesResult) => {
              for (let i = 0; i < notesResult.rows.length; i++) {
                const row = notesResult.rows.item(i);
                const note = {
                  id: row.id,
                  note_id: row.note_id,
                  text: row.text,
                  created_at: row.created_at,
                  updated_at: row.updated_at
                };
                if (callNoteMap[row.call_note_id]) {
                  callNoteMap[row.call_note_id].notes.push(note);
                }
              }

              const backupData = {
                version: '1.0.0',
                created_at: new Date().toISOString(),
                call_notes: callNotes
              };
              resolve(backupData);
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
};

// Backup wiederherstellen
export const restoreBackup = (backupData: any, mode: 'merge' | 'replace'): Promise<{ restored_notes: number; skipped_entries: number }> => {
  return new Promise((resolve, reject) => {
    if (!backupData || !backupData.call_notes) {
      reject(new Error('Ungültiges Backup-Format'));
      return;
    }

    let restoredNotes = 0;
    let skippedEntries = 0;

    db.transaction(tx => {
      if (mode === 'replace') {
        // Alle bestehenden Daten löschen
        tx.executeSql(
          `DELETE FROM notes`,
          [],
          () => {},
          (_, error) => {
            console.error('Fehler beim Löschen der Notizen:', error);
            reject(error);
            return false;
          }
        );

        tx.executeSql(
          `DELETE FROM call_notes`,
          [],
          () => {},
          (_, error) => {
            console.error('Fehler beim Löschen der call_notes:', error);
            reject(error);
            return false;
          }
        );
      }

      // Backup-Daten verarbeiten
      for (const callNoteData of backupData.call_notes) {
        // Prüfen, ob die Telefonnummer bereits existiert (nur für merge-Modus)
        if (mode === 'merge') {
          tx.executeSql(
            `SELECT id FROM call_notes WHERE phone_number = ?`,
            [callNoteData.phone_number],
            (_, result) => {
              if (result.rows.length > 0) {
                // Telefonnummer existiert bereits, überspringen
                skippedEntries++;
                return;
              }
              insertCallNoteFromBackup(tx, callNoteData, () => {}, () => {});
            },
            (_, error) => {
              console.error('Fehler beim Prüfen der Telefonnummer:', error);
              reject(error);
              return false;
            }
          );
        } else {
          // replace-Modus: einfach einfügen
          insertCallNoteFromBackup(tx, callNoteData, () => {}, () => {});
        }
      }
    }, () => {
      // Transaktion erfolgreich abgeschlossen
      resolve({ restored_notes: restoredNotes, skipped_entries: skippedEntries });
    }, (_, error) => {
      console.error('Fehler bei der Wiederherstellung:', error);
      reject(error);
    });

    // Hilfsfunktion zum Einfügen aus Backup
    const insertCallNoteFromBackup = (tx: SQLite.SQLiteTransaction, callNoteData: any, onSuccess: any, onError: any) => {
      tx.executeSql(
        `INSERT INTO call_notes (phone_number, last_call_time, created_at) VALUES (?, ?, ?)`,
        [callNoteData.phone_number, callNoteData.last_call_time, callNoteData.created_at],
        (_, result) => {
          const callNoteId = result.insertId;

          // Notizen einfügen
          for (const noteData of callNoteData.notes) {
            tx.executeSql(
              `INSERT INTO notes (call_note_id, note_id, text, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
              [callNoteId, noteData.note_id, noteData.text, noteData.created_at, noteData.updated_at],
              () => {
                restoredNotes++;
              },
              (_, error) => {
                console.error('Fehler beim Einfügen der Notiz:', error);
                // Überspringen, aber weiter machen
              }
            );
          }
          onSuccess();
        },
        (_, error) => {
          console.error('Fehler beim Einfügen der call_note:', error);
          onError(error);
        }
      );
    };
  });
};

// Eindeutige Notiz-ID generieren
const generateNoteId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
};

// Telefonnummer validieren
export const validatePhoneNumber = (phoneNumber: string): boolean => {
  // Entferne alle Nicht-Ziffern und Plus-Zeichen
  const cleaned = phoneNumber.replace(/[^\d+]/g, '');
  
  // Standard-Regex für internationale Telefonnummern
  const regex = /^\+\d{8,15}$/;
  
  // Falls keine Ländervorwahl, prüfe ob es eine gültige nationale Nummer ist
  if (!cleaned.startsWith('+')) {
    // Deutsche Nummern (ohne Vorwahl)
    if (/^\d{10,15}$/.test(cleaned)) {
      return true;
    }
    return false;
  }
  
  return regex.test(cleaned);
};
