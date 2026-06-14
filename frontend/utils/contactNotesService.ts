/**
 * ContactNotesService - Verwaltung von Vermerken zu Telefonnummern
 * 
 * Dieser Service ermöglicht das Hinterlegen von Vermerken zu unbekannten
 * oder bekannten Telefonnummern, um die Rückverfolgbarkeit zu verbessern.
 * 
 * WICHTIG: Es werden NUR Nutzer-Vermerke gespeichert, KEINE Anrufpartner-Daten!
 * 
 * - Bekannte Nummern: Stammt aus dem Telefonbuch des Nutzers
 * - Unbekannte Nummern: Wurde nicht im Telefonbuch gefunden, Nutzer kann Vermerk hinterlegen
 */

import * as SQLite from 'expo-sqlite';
import * as Contacts from 'expo-contacts';

// Typdefinitionen
export interface ContactNote {
  id: number;
  phone_number: string;
  note: string; // Vermerk zur Nummer
  is_known: boolean; // Ob die Nummer im Telefonbuch ist
  contact_name: string | null; // Name aus Telefonbuch (falls bekannt)
  created_at: string;
  updated_at: string;
}

export interface ContactNoteSummary {
  phone_number: string;
  note: string;
  is_known: boolean;
  contact_name: string | null;
  note_count: number;
}

// Datenbank
const db = SQLite.openDatabase('callNotes.db');

/**
 * Initialisiert die ContactNotes-Tabelle
 */
export const initContactNotesDatabase = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    db.transaction(tx => {
      tx.executeSql(
        `CREATE TABLE IF NOT EXISTS contact_notes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          phone_number TEXT NOT NULL,
          note TEXT NOT NULL,
          is_known INTEGER DEFAULT 0,
          contact_name TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          UNIQUE(phone_number, note)
        );`,
        [],
        () => {},
        (_, error) => {
          console.error('Fehler beim Erstellen der contact_notes-Tabelle:', error);
          return false;
        }
      );

      // Index für bessere Performance
      tx.executeSql(
        `CREATE INDEX IF NOT EXISTS idx_contact_notes_phone_number ON contact_notes(phone_number);`,
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

/**
 * Erstellt einen neuen Vermerk zu einer Telefonnummer
 */
export const createContactNote = (
  phone_number: string,
  note: string,
  is_known: boolean = false,
  contact_name: string | null = null
): Promise<ContactNote> => {
  return new Promise((resolve, reject) => {
    const now = new Date().toISOString();
    
    db.transaction(tx => {
      tx.executeSql(
        `INSERT INTO contact_notes (phone_number, note, is_known, contact_name, created_at, updated_at) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [phone_number, note, is_known ? 1 : 0, contact_name, now, now],
        (_, result) => {
          const contactNote: ContactNote = {
            id: result.insertId,
            phone_number,
            note,
            is_known,
            contact_name,
            created_at: now,
            updated_at: now,
          };
          resolve(contactNote);
        },
        (_, error) => {
          console.error('Fehler beim Erstellen des Vermerks:', error);
          reject(error);
          return false;
        }
      );
    });
  });
};

/**
 * Aktualisiert einen Vermerk
 */
export const updateContactNote = (
  id: number,
  updates: Partial<Omit<ContactNote, 'id' | 'created_at'>>
): Promise<ContactNote | null> => {
  return new Promise((resolve, reject) => {
    const updatedAt = new Date().toISOString();
    
    db.transaction(tx => {
      const fields: string[] = [];
      const values: any[] = [];
      
      if (updates.phone_number !== undefined) {
        fields.push('phone_number = ?');
        values.push(updates.phone_number);
      }
      if (updates.note !== undefined) {
        fields.push('note = ?');
        values.push(updates.note);
      }
      if (updates.is_known !== undefined) {
        fields.push('is_known = ?');
        values.push(updates.is_known ? 1 : 0);
      }
      if (updates.contact_name !== undefined) {
        fields.push('contact_name = ?');
        values.push(updates.contact_name);
      }
      
      fields.push('updated_at = ?');
      values.push(updatedAt);
      values.push(id);
      
      tx.executeSql(
        `UPDATE contact_notes SET ${fields.join(', ')} WHERE id = ?`,
        values,
        (_, result) => {
          if (result.rowsAffected === 0) {
            resolve(null);
            return;
          }
          
          tx.executeSql(
            `SELECT * FROM contact_notes WHERE id = ?`,
            [id],
            (_, selectResult) => {
              if (selectResult.rows.length === 0) {
                resolve(null);
                return;
              }
              resolve(mapRowToContactNote(selectResult.rows.item(0)));
            },
            (_, error) => {
              console.error('Fehler beim Abrufen:', error);
              reject(error);
              return false;
            }
          );
        },
        (_, error) => {
          console.error('Fehler beim Aktualisieren:', error);
          reject(error);
          return false;
        }
      );
    });
  });
};

/**
 * Löscht einen Vermerk
 */
export const deleteContactNote = (id: number): Promise<boolean> => {
  return new Promise((resolve, reject) => {
    db.transaction(tx => {
      tx.executeSql(
        `DELETE FROM contact_notes WHERE id = ?`,
        [id],
        (_, result) => {
          resolve(result.rowsAffected > 0);
        },
        (_, error) => {
          console.error('Fehler beim Löschen:', error);
          reject(error);
          return false;
        }
      );
    });
  });
};

/**
 * Holt alle Vermerke zu einer Telefonnummer
 */
export const getContactNotesByPhoneNumber = (phone_number: string): Promise<ContactNote[]> => {
  return new Promise((resolve, reject) => {
    db.transaction(tx => {
      tx.executeSql(
        `SELECT * FROM contact_notes WHERE phone_number = ? ORDER BY created_at DESC`,
        [phone_number],
        (_, result) => {
          const notes: ContactNote[] = [];
          for (let i = 0; i < result.rows.length; i++) {
            notes.push(mapRowToContactNote(result.rows.item(i)));
          }
          resolve(notes);
        },
        (_, error) => {
          console.error('Fehler beim Abrufen:', error);
          reject(error);
          return false;
        }
      );
    });
  });
};

/**
 * Holt den aktuellen Vermerk zu einer Telefonnummer (den neuesten)
 */
export const getCurrentContactNote = (phone_number: string): Promise<ContactNote | null> => {
  return new Promise((resolve, reject) => {
    db.transaction(tx => {
      tx.executeSql(
        `SELECT * FROM contact_notes WHERE phone_number = ? ORDER BY created_at DESC LIMIT 1`,
        [phone_number],
        (_, result) => {
          if (result.rows.length === 0) {
            resolve(null);
            return;
          }
          resolve(mapRowToContactNote(result.rows.item(0)));
        },
        (_, error) => {
          console.error('Fehler beim Abrufen:', error);
          reject(error);
          return false;
        }
      );
    });
  });
};

/**
 * Holt alle Vermerke
 */
export const getAllContactNotes = (): Promise<ContactNote[]> => {
  return new Promise((resolve, reject) => {
    db.transaction(tx => {
      tx.executeSql(
        `SELECT * FROM contact_notes ORDER BY phone_number, created_at DESC`,
        [],
        (_, result) => {
          const notes: ContactNote[] = [];
          for (let i = 0; i < result.rows.length; i++) {
            notes.push(mapRowToContactNote(result.rows.item(i)));
          }
          resolve(notes);
        },
        (_, error) => {
          console.error('Fehler beim Abrufen:', error);
          reject(error);
          return false;
        }
      );
    });
  });
};

/**
 * Prüft ob eine Telefonnummer bekannt ist (im Telefonbuch)
 * Fragt das Kontaktebuch des Geräts ab
 */
export const isKnownContact = async (phone_number: string): Promise<boolean> => {
  try {
    // Normalisiere die Telefonnummer für den Vergleich
    const normalizedPhone = normalizePhoneNumber(phone_number);
    
    // Prüfe in der lokalen contact_notes-Datenbank
    const notes = await getContactNotesByPhoneNumber(phone_number);
    if (notes.length > 0) {
      // Wenn es Vermerke gibt, die als bekannt markiert sind
      return notes.some(n => n.is_known);
    }
    
    // Prüfe im Kontaktebuch des Geräts
    const { status } = await Contacts.requestPermissionsAsync();
    
    if (status === 'granted') {
      const { data: contacts } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Name],
      });
      
      for (const contact of contacts) {
        if (contact.phoneNumbers) {
          for (const phone of contact.phoneNumbers) {
            const contactNormalized = normalizePhoneNumber(phone.number);
            if (contactNormalized === normalizedPhone) {
              // Kontakt gefunden - speichere in contact_notes
              await createContactNote(
                phone_number,
                `Kontakt: ${contact.name || 'Unbekannt'}`,
                true, // is_known
                contact.name || null
              );
              return true;
            }
          }
        }
      }
    }
    
    // Nicht im Telefonbuch gefunden
    return false;
    
  } catch (error) {
    console.error('Fehler bei der Kontaktebuch-Abfrage:', error);
    // Falls Kontaktebuch nicht verfügbar, prüfe nur lokale Datenbank
    try {
      const notes = await getContactNotesByPhoneNumber(phone_number);
      return notes.some(n => n.is_known);
    } catch (dbError) {
      return false;
    }
  }
};

/**
 * Normalisiert eine Telefonnummer für den Vergleich
 */
const normalizePhoneNumber = (phone_number: string): string => {
  // Entferne alle Nicht-Ziffern und Plus-Zeichen
  return phone_number.replace(/[^\d+]/g, '');
};

/**
 * Prüft ob eine Telefonnummer unbekannt ist
 */
export const isUnknownContact = async (phone_number: string): Promise<boolean> => {
  return !(await isKnownContact(phone_number));
};

/**
 * Holt den Kontaktnamen aus dem Telefonbuch
 */
export const getContactName = async (phone_number: string): Promise<string | null> => {
  try {
    const normalizedPhone = normalizePhoneNumber(phone_number);
    
    // Prüfe in lokaler Datenbank
    const note = await getCurrentContactNote(phone_number);
    if (note && note.contact_name) {
      return note.contact_name;
    }
    
    // Prüfe im Kontaktebuch
    const { status } = await Contacts.requestPermissionsAsync();
    
    if (status === 'granted') {
      const { data: contacts } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Name],
      });
      
      for (const contact of contacts) {
        if (contact.phoneNumbers) {
          for (const phone of contact.phoneNumbers) {
            const contactNormalized = normalizePhoneNumber(phone.number);
            if (contactNormalized === normalizedPhone) {
              return contact.name || null;
            }
          }
        }
      }
    }
    
    return null;
  } catch (error) {
    console.error('Fehler beim Abrufen des Kontaktnamens:', error);
    return null;
  }
};

/**
 * Erstellt oder aktualisiert einen Vermerk für eine unbekannte Nummer
 */
export const setUnknownContactNote = async (
  phone_number: string,
  note: string
): Promise<ContactNote> => {
  // Prüfe ob die Nummer unbekannt ist
  const isUnknown = await isUnknownContact(phone_number);
  
  // Erstelle oder aktualisiere den Vermerk
  return setContactNote(phone_number, note, !isUnknown, null);
};

/**
 * Holt alle unbekannten Nummern mit Vermerken
 */
export const getUnknownContactsWithNotes = async (): Promise<ContactNote[]> => {
  const allNotes = await getAllContactNotes();
  return allNotes.filter(note => !note.is_known);
};

/**
 * Holt alle bekannten Kontakte mit Vermerken
 */
export const getKnownContactsWithNotes = async (): Promise<ContactNote[]> => {
  const allNotes = await getAllContactNotes();
  return allNotes.filter(note => note.is_known);
};

/**
 * Sucht nach Kontakten
 */
export const searchContactNotes = (searchTerm: string): Promise<ContactNote[]> => {
  return new Promise((resolve, reject) => {
    db.transaction(tx => {
      tx.executeSql(
        `SELECT * FROM contact_notes 
         WHERE phone_number LIKE ? OR note LIKE ? OR contact_name LIKE ? 
         ORDER BY phone_number`,
        [`%${searchTerm}%`, `%${searchTerm}%`, `%${searchTerm}%`],
        (_, result) => {
          const notes: ContactNote[] = [];
          for (let i = 0; i < result.rows.length; i++) {
            notes.push(mapRowToContactNote(result.rows.item(i)));
          }
          resolve(notes);
        },
        (_, error) => {
          console.error('Fehler beim Suchen:', error);
          reject(error);
          return false;
        }
      );
    });
  });
};

/**
 * Setzt oder aktualisiert den Vermerk zu einer Telefonnummer
 */
export const setContactNote = async (
  phone_number: string,
  note: string,
  is_known: boolean = false,
  contact_name: string | null = null
): Promise<ContactNote> => {
  // Prüfe ob bereits ein Vermerk existiert
  const existingNote = await getCurrentContactNote(phone_number);
  
  if (existingNote) {
    // Aktualisiere bestehenden Vermerk
    return updateContactNote(existingNote.id, { note, is_known, contact_name })!;
  } else {
    // Erstelle neuen Vermerk
    return createContactNote(phone_number, note, is_known, contact_name);
  }
};

/**
 * Formatiert eine Telefonnummer für die Anzeige
 */
export const formatPhoneNumberWithNote = async (phone_number: string): Promise<string> => {
  const contactNote = await getCurrentContactNote(phone_number);
  
  if (contactNote) {
    if (contactNote.contact_name) {
      return `${contactNote.contact_name} (${phone_number})`;
    }
    if (contactNote.note) {
      return `${phone_number} - ${contactNote.note}`;
    }
  }
  
  return phone_number;
};

/**
 * Konvertiert eine Datenbank-Zeile in ein ContactNote-Objekt
 */
const mapRowToContactNote = (row: any): ContactNote => {
  return {
    id: row.id,
    phone_number: row.phone_number,
    note: row.note,
    is_known: row.is_known === 1,
    contact_name: row.contact_name || null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
};

/**
 * Exportiert alle Kontaktnotizen als CSV
 */
export const exportContactNotesAsCSV = async (): Promise<string> => {
  const notes = await getAllContactNotes();
  
  let csv = 'Telefonnummer,Kontaktname,Bekannt,Vermerk,Erstellt am,Aktualisiert am\n';
  
  notes.forEach(note => {
    csv += `"${note.phone_number}",`;
    csv += `"${note.contact_name || ''}",`;
    csv += `"${note.is_known ? 'Ja' : 'Nein'}",`;
    csv += `"${note.note.replace(/"/g, '""')}",`;
    csv += `"${note.created_at}",`;
    csv += `"${note.updated_at}"\n`;
  });
  
  return csv;
};

/**
 * Importiert Kontaktnotizen aus CSV
 */
export const importContactNotesFromCSV = async (csv: string): Promise<{ imported: number; errors: string[] }> => {
  const result = { imported: 0, errors: [] as string[] };
  
  try {
    const lines = csv.split('\n');
    if (lines.length < 2) {
      result.errors.push('CSV enthält keine Daten');
      return result;
    }
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const values = parseCSVLine(line);
      if (values.length < 4) {
        result.errors.push(`Zeile ${i + 1}: Ungültiges Format`);
        continue;
      }
      
      try {
        await createContactNote(
          values[0], // phone_number
          values[3], // note
          values[2]?.toLowerCase() === 'ja', // is_known
          values[1] || null // contact_name
        );
        result.imported++;
      } catch (error) {
        result.errors.push(`Zeile ${i + 1}: ${error}`);
      }
    }
  } catch (error) {
    result.errors.push(`Allgemeiner Fehler: ${error}`);
  }
  
  return result;
};

/**
 * Parsed eine CSV-Zeile
 */
const parseCSVLine = (line: string): string[] => {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      values.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  
  values.push(current);
  return values;
};
