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