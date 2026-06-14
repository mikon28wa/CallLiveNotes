/**
 * FeedbackService - Rückmeldungsverwaltung für CallLiveNotes
 * 
 * Dieser Service verwaltet Rückmeldungen, Termine und vereinbarte Aktionen.
 * Ziel: Reduzierung von Vergesslichkeit, Erhöhung der Absprachequalität,
 * Vermeidung doppelter Termine.
 * 
 * WICHTIG: Es werden NUR Nutzer-Rückmeldungen gespeichert, KEINE Anrufpartner-Daten!
 */

import * as SQLite from 'expo-sqlite';
import { Platform } from 'react-native';

// Typdefinitionen
export interface Feedback {
  id: number;
  feedback_id: string;
  phone_number: string;
  title: string; // Betreff
  description: string; // Rückmeldungstext
  reason: string; // Grund
  due_date: string | null; // Fälligkeitsdatum (ISO)
  due_time: string | null; // Fälligkeitszeit (HH:mm)
  status: 'pending' | 'completed' | 'cancelled' | 'overdue';
  priority: 'low' | 'medium' | 'high';
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  call_note_id: number | null;
  synced_with_crm: number;
  synced_at: string | null;
}

export interface FeedbackSummary {
  id: number;
  feedback_id: string;
  phone_number: string;
  title: string;
  due_date: string | null;
  due_time: string | null;
  status: 'pending' | 'completed' | 'cancelled' | 'overdue';
  priority: 'low' | 'medium' | 'high';
  created_at: string;
}

export interface FeedbackStats {
  total: number;
  pending: number;
  completed: number;
  overdue: number;
  byPriority: {
    low: number;
    medium: number;
    high: number;
  };
}

export interface FeedbackFilter {
  status?: 'pending' | 'completed' | 'cancelled' | 'overdue' | 'all';
  priority?: 'low' | 'medium' | 'high' | 'all';
  search?: string;
  dueBefore?: string;
  dueAfter?: string;
  sortBy?: 'due_date' | 'created_at' | 'title' | 'priority';
  sortOrder?: 'asc' | 'desc';
}

// Datenbank
const db = SQLite.openDatabase('callNotes.db');

/**
 * Initialisiert die Feedback-Tabelle
 */
export const initFeedbackDatabase = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    db.transaction(tx => {
      tx.executeSql(
        `CREATE TABLE IF NOT EXISTS feedbacks (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          feedback_id TEXT NOT NULL UNIQUE,
          phone_number TEXT NOT NULL,
          title TEXT NOT NULL,
          description TEXT NOT NULL,
          reason TEXT NOT NULL,
          due_date TEXT,
          due_time TEXT,
          status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'completed', 'cancelled', 'overdue')),
          priority TEXT NOT NULL DEFAULT 'medium' CHECK(priority IN ('low', 'medium', 'high')),
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          completed_at TEXT,
          call_note_id INTEGER,
          synced_with_crm INTEGER DEFAULT 0,
          synced_at TEXT,
          FOREIGN KEY (call_note_id) REFERENCES call_notes(id) ON DELETE SET NULL
        );`,
        [],
        () => {},
        (_, error) => {
          console.error('Fehler beim Erstellen der feedbacks-Tabelle:', error);
          return false;
        }
      );

      // Index für bessere Performance
      tx.executeSql(
        `CREATE INDEX IF NOT EXISTS idx_feedbacks_phone_number ON feedbacks(phone_number);`,
        [],
        () => {},
        (_, error) => {
          console.error('Fehler beim Erstellen des Index:', error);
          return false;
        }
      );

      tx.executeSql(
        `CREATE INDEX IF NOT EXISTS idx_feedbacks_status ON feedbacks(status);`,
        [],
        () => {},
        (_, error) => {
          console.error('Fehler beim Erstellen des Index:', error);
          return false;
        }
      );

      tx.executeSql(
        `CREATE INDEX IF NOT EXISTS idx_feedbacks_due_date ON feedbacks(due_date);`,
        [],
        () => {},
        (_, error) => {
          console.error('Fehler beim Erstellen des Index:', error);
          return false;
        }
      );

      tx.executeSql(
        `CREATE INDEX IF NOT EXISTS idx_feedbacks_priority ON feedbacks(priority);`,
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
 * Generiert eine eindeutige Feedback-ID
 */
const generateFeedbackId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
};

/**
 * Erstellt eine neue Rückmeldung
 */
export const createFeedback = (
  phone_number: string,
  title: string,
  description: string,
  reason: string,
  due_date: string | null = null,
  due_time: string | null = null,
  priority: 'low' | 'medium' | 'high' = 'medium',
  call_note_id: number | null = null
): Promise<Feedback> => {
  return new Promise((resolve, reject) => {
    const now = new Date().toISOString();
    const feedback_id = generateFeedbackId();

    db.transaction(tx => {
      tx.executeSql(
        `INSERT INTO feedbacks (
          feedback_id, phone_number, title, description, reason, 
          due_date, due_time, status, priority, created_at, updated_at, call_note_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          feedback_id,
          phone_number,
          title,
          description,
          reason,
          due_date,
          due_time,
          'pending',
          priority,
          now,
          now,
          call_note_id
        ],
        (_, result) => {
          const feedback: Feedback = {
            id: result.insertId,
            feedback_id,
            phone_number,
            title,
            description,
            reason,
            due_date,
            due_time,
            status: 'pending',
            priority,
            created_at: now,
            updated_at: now,
            completed_at: null,
            call_note_id,
            synced_with_crm: 0,
            synced_at: null,
          };
          resolve(feedback);
        },
        (_, error) => {
          console.error('Fehler beim Erstellen der Rückmeldung:', error);
          reject(error);
          return false;
        }
      );
    });
  });
};

/**
 * Aktualisiert eine Rückmeldung
 */
export const updateFeedback = (
  id: number,
  updates: Partial<Omit<Feedback, 'id' | 'feedback_id' | 'created_at'>>
): Promise<Feedback | null> => {
  return new Promise((resolve, reject) => {
    const updatedAt = new Date().toISOString();
    
    db.transaction(tx => {
      // Baue das UPDATE-Statement dynamisch
      const fields: string[] = [];
      const values: any[] = [];
      
      if (updates.title !== undefined) {
        fields.push('title = ?');
        values.push(updates.title);
      }
      if (updates.description !== undefined) {
        fields.push('description = ?');
        values.push(updates.description);
      }
      if (updates.reason !== undefined) {
        fields.push('reason = ?');
        values.push(updates.reason);
      }
      if (updates.due_date !== undefined) {
        fields.push('due_date = ?');
        values.push(updates.due_date);
      }
      if (updates.due_time !== undefined) {
        fields.push('due_time = ?');
        values.push(updates.due_time);
      }
      if (updates.status !== undefined) {
        fields.push('status = ?');
        values.push(updates.status);
      }
      if (updates.priority !== undefined) {
        fields.push('priority = ?');
        values.push(updates.priority);
      }
      if (updates.completed_at !== undefined) {
        fields.push('completed_at = ?');
        values.push(updates.completed_at);
      }
      if (updates.call_note_id !== undefined) {
        fields.push('call_note_id = ?');
        values.push(updates.call_note_id);
      }
      
      fields.push('updated_at = ?');
      values.push(updatedAt);
      
      values.push(id);
      
      tx.executeSql(
        `UPDATE feedbacks SET ${fields.join(', ')} WHERE id = ?`,
        values,
        (_, result) => {
          if (result.rowsAffected === 0) {
            resolve(null);
            return;
          }
          
          // Hole die aktualisierte Rückmeldung
          tx.executeSql(
            `SELECT * FROM feedbacks WHERE id = ?`,
            [id],
            (_, selectResult) => {
              if (selectResult.rows.length === 0) {
                resolve(null);
                return;
              }
              resolve(mapRowToFeedback(selectResult.rows.item(0)));
            },
            (_, error) => {
              console.error('Fehler beim Abrufen der aktualisierten Rückmeldung:', error);
              reject(error);
              return false;
            }
          );
        },
        (_, error) => {
          console.error('Fehler beim Aktualisieren der Rückmeldung:', error);
          reject(error);
          return false;
        }
      );
    });
  });
};

/**
 * Markiert eine Rückmeldung als erledigt
 */
export const completeFeedback = (id: number): Promise<Feedback | null> => {
  return updateFeedback(id, {
    status: 'completed',
    completed_at: new Date().toISOString(),
  });
};

/**
 * Löscht eine Rückmeldung
 */
export const deleteFeedback = (id: number): Promise<boolean> => {
  return new Promise((resolve, reject) => {
    db.transaction(tx => {
      tx.executeSql(
        `DELETE FROM feedbacks WHERE id = ?`,
        [id],
        (_, result) => {
          resolve(result.rowsAffected > 0);
        },
        (_, error) => {
          console.error('Fehler beim Löschen der Rückmeldung:', error);
          reject(error);
          return false;
        }
      );
    });
  });
};

/**
 * Holt alle Rückmeldungen mit Filter und Sortierung
 */
export const getAllFeedbacks = (filter: FeedbackFilter = {}): Promise<Feedback[]> => {
  return new Promise((resolve, reject) => {
    const {
      status = 'all',
      priority = 'all',
      search = '',
      dueBefore,
      dueAfter,
      sortBy = 'due_date',
      sortOrder = 'asc',
    } = filter;

    let query = 'SELECT * FROM feedbacks WHERE 1=1';
    const params: any[] = [];

    // Status-Filter
    if (status !== 'all') {
      query += ' AND status = ?';
      params.push(status);
    }

    // Priorität-Filter
    if (priority !== 'all') {
      query += ' AND priority = ?';
      params.push(priority);
    }

    // Suchbegriff
    if (search) {
      query += ' AND (title LIKE ? OR description LIKE ? OR reason LIKE ? OR phone_number LIKE ?)';
      const searchParam = `%${search}%`;
      params.push(searchParam, searchParam, searchParam, searchParam);
    }

    // Fälligkeitsdatum-Filter
    if (dueBefore) {
      query += ' AND (due_date IS NULL OR due_date <= ?)';
      params.push(dueBefore);
    }

    if (dueAfter) {
      query += ' AND (due_date IS NULL OR due_date >= ?)';
      params.push(dueAfter);
    }

    // Sortierung
    let orderBy = '';
    switch (sortBy) {
      case 'due_date':
        orderBy = 'due_date IS NULL, due_date';
        break;
      case 'created_at':
        orderBy = 'created_at';
        break;
      case 'title':
        orderBy = 'title';
        break;
      case 'priority':
        orderBy = 'priority';
        break;
      default:
        orderBy = 'due_date IS NULL, due_date';
    }
    
    // Für überfällige Rückmeldungen: status = 'overdue' wenn due_date < heute
    query = `
      SELECT f.*, 
             CASE 
               WHEN f.status = 'pending' AND f.due_date IS NOT NULL AND f.due_date < date('now') THEN 'overdue'
               ELSE f.status 
             END as computed_status
      FROM feedbacks f
      WHERE 1=1
    ` + query.substring(query.indexOf('WHERE') + 5);

    query += ` ORDER BY ${orderBy} ${sortOrder}`;

    db.transaction(tx => {
      tx.executeSql(
        query,
        params,
        (_, result) => {
          const feedbacks: Feedback[] = [];
          for (let i = 0; i < result.rows.length; i++) {
            const row = result.rows.item(i);
            const feedback = mapRowToFeedback(row);
            // Überschreibe status mit computed_status
            feedback.status = row.computed_status as Feedback['status'];
            feedbacks.push(feedback);
          }
          resolve(feedbacks);
        },
        (_, error) => {
          console.error('Fehler beim Abrufen der Rückmeldungen:', error);
          reject(error);
          return false;
        }
      );
    });
  });
};

/**
 * Holt Rückmeldungen für eine bestimmte Telefonnummer
 */
export const getFeedbacksByPhoneNumber = (
  phone_number: string,
  filter: Omit<FeedbackFilter, 'search'> = {}
): Promise<Feedback[]> => {
  return new Promise((resolve, reject) => {
    const {
      status = 'all',
      priority = 'all',
      dueBefore,
      dueAfter,
      sortBy = 'due_date',
      sortOrder = 'asc',
    } = filter;

    let query = 'SELECT * FROM feedbacks WHERE phone_number = ?';
    const params: any[] = [phone_number];

    // Status-Filter
    if (status !== 'all') {
      query += ' AND status = ?';
      params.push(status);
    }

    // Priorität-Filter
    if (priority !== 'all') {
      query += ' AND priority = ?';
      params.push(priority);
    }

    // Fälligkeitsdatum-Filter
    if (dueBefore) {
      query += ' AND (due_date IS NULL OR due_date <= ?)';
      params.push(dueBefore);
    }

    if (dueAfter) {
      query += ' AND (due_date IS NULL OR due_date >= ?)';
      params.push(dueAfter);
    }

    // Sortierung
    let orderBy = '';
    switch (sortBy) {
      case 'due_date':
        orderBy = 'due_date IS NULL, due_date';
        break;
      case 'created_at':
        orderBy = 'created_at';
        break;
      case 'title':
        orderBy = 'title';
        break;
      case 'priority':
        orderBy = 'priority';
        break;
      default:
        orderBy = 'due_date IS NULL, due_date';
    }

    query += ` ORDER BY ${orderBy} ${sortOrder}`;

    db.transaction(tx => {
      tx.executeSql(
        query,
        params,
        (_, result) => {
          const feedbacks: Feedback[] = [];
          for (let i = 0; i < result.rows.length; i++) {
            feedbacks.push(mapRowToFeedback(result.rows.item(i)));
          }
          resolve(feedbacks);
        },
        (_, error) => {
          console.error('Fehler beim Abrufen der Rückmeldungen:', error);
          reject(error);
          return false;
        }
      );
    });
  });
};

/**
 * Holt ausstehende Rückmeldungen (für Arbeitsmodus-Anzeige)
 */
export const getPendingFeedbacks = (): Promise<Feedback[]> => {
  return getAllFeedbacks({ status: 'pending', sortBy: 'due_date', sortOrder: 'asc' });
};

/**
 * Holt überfällige Rückmeldungen
 */
export const getOverdueFeedbacks = (): Promise<Feedback[]> => {
  return getAllFeedbacks({ 
    status: 'pending', 
    dueBefore: new Date().toISOString().split('T')[0],
    sortBy: 'due_date', 
    sortOrder: 'asc' 
  });
};

/**
 * Holt Rückmeldungen nach Fälligkeitsdatum
 */
export const getFeedbacksDueToday = (): Promise<Feedback[]> => {
  const today = new Date().toISOString().split('T')[0];
  return getAllFeedbacks({ 
    status: 'pending',
    dueBefore: today,
    dueAfter: today,
    sortBy: 'due_time',
    sortOrder: 'asc'
  });
};

/**
 * Prüft auf Termin-Kollisionen
 */
export const checkFeedbackCollision = (
  due_date: string,
  due_time: string | null,
  excludeId?: number
): Promise<Feedback[]> => {
  return new Promise((resolve, reject) => {
    const params: any[] = [due_date];
    let query = 'SELECT * FROM feedbacks WHERE due_date = ?';
    
    if (due_time) {
      query += ' AND due_time = ?';
      params.push(due_time);
    }
    
    if (excludeId) {
      query += ' AND id != ?';
      params.push(excludeId);
    }
    
    query += ' AND status IN (\'pending\', \'overdue\')';

    db.transaction(tx => {
      tx.executeSql(
        query,
        params,
        (_, result) => {
          const feedbacks: Feedback[] = [];
          for (let i = 0; i < result.rows.length; i++) {
            feedbacks.push(mapRowToFeedback(result.rows.item(i)));
          }
          resolve(feedbacks);
        },
        (_, error) => {
          console.error('Fehler bei Kollisionsprüfung:', error);
          reject(error);
          return false;
        }
      );
    });
  });
};

/**
 * Holt Statistiken zu Rückmeldungen
 */
export const getFeedbackStats = (): Promise<FeedbackStats> => {
  return new Promise((resolve, reject) => {
    db.transaction(tx => {
      // Gesamtanzahl
      tx.executeSql(
        'SELECT COUNT(*) as count FROM feedbacks',
        [],
        (_, result) => {
          const total = result.rows.item(0).count;
          
          // Nach Status
          tx.executeSql(
            `SELECT 
             COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
             COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
             COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled,
             COUNT(CASE WHEN status = 'pending' AND due_date IS NOT NULL AND due_date < date('now') THEN 1 END) as overdue
             FROM feedbacks`,
            [],
            (_, statusResult) => {
              const stats = statusResult.rows.item(0);
              
              // Nach Priorität
              tx.executeSql(
                `SELECT 
                 COUNT(CASE WHEN priority = 'low' THEN 1 END) as low,
                 COUNT(CASE WHEN priority = 'medium' THEN 1 END) as medium,
                 COUNT(CASE WHEN priority = 'high' THEN 1 END) as high
                 FROM feedbacks`,
                [],
                (_, priorityResult) => {
                  const priorityStats = priorityResult.rows.item(0);
                  
                  resolve({
                    total,
                    pending: stats.pending,
                    completed: stats.completed,
                    overdue: stats.overdue,
                    byPriority: {
                      low: priorityStats.low,
                      medium: priorityStats.medium,
                      high: priorityStats.high,
                    },
                  });
                },
                (_, error) => {
                  console.error('Fehler bei Prioritäts-Statistik:', error);
                  reject(error);
                  return false;
                }
              );
            },
            (_, error) => {
              console.error('Fehler bei Status-Statistik:', error);
              reject(error);
              return false;
            }
          );
        },
        (_, error) => {
          console.error('Fehler bei Gesamtanzahl:', error);
          reject(error);
          return false;
        }
      );
    });
  });
};

/**
 * Konvertiert eine Datenbank-Zeile in ein Feedback-Objekt
 */
const mapRowToFeedback = (row: any): Feedback => {
  return {
    id: row.id,
    feedback_id: row.feedback_id,
    phone_number: row.phone_number,
    title: row.title,
    description: row.description,
    reason: row.reason,
    due_date: row.due_date || null,
    due_time: row.due_time || null,
    status: row.status,
    priority: row.priority,
    created_at: row.created_at,
    updated_at: row.updated_at,
    completed_at: row.completed_at || null,
    call_note_id: row.call_note_id || null,
    synced_with_crm: row.synced_with_crm || 0,
    synced_at: row.synced_at || null,
  };
};

/**
 * Sucht nach Rückmeldungen
 */
export const searchFeedbacks = (searchTerm: string): Promise<Feedback[]> => {
  return getAllFeedbacks({ search: searchTerm });
};

/**
 * Formatiert ein Feedback für die Anzeige
 */
export const formatFeedbackForDisplay = (feedback: Feedback): string => {
  const dueDate = feedback.due_date ? new Date(feedback.due_date).toLocaleDateString('de-DE') : 'Kein Datum';
  const dueTime = feedback.due_time || '';
  const dateTime = dueTime ? `${dueDate} ${dueTime}` : dueDate;
  
  return `[${feedback.priority.toUpperCase()}] ${feedback.title} - ${dateTime}`;
};

/**
 * Prüft ob ein Feedback überfällig ist
 */
export const isFeedbackOverdue = (feedback: Feedback): boolean => {
  if (feedback.status !== 'pending') return false;
  if (!feedback.due_date) return false;
  
  const dueDate = new Date(feedback.due_date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  return dueDate < today;
};

/**
 * Sortiert Feedback-Array nach verschiedenen Kriterien
 */
export const sortFeedbacks = (
  feedbacks: Feedback[],
  sortBy: 'due_date' | 'created_at' | 'title' | 'priority' = 'due_date',
  sortOrder: 'asc' | 'desc' = 'asc'
): Feedback[] => {
  const sorted = [...feedbacks];
  
  sorted.sort((a, b) => {
    let comparison = 0;
    
    switch (sortBy) {
      case 'due_date':
        // Null-Werte nach hinten
        if (!a.due_date && !b.due_date) comparison = 0;
        else if (!a.due_date) comparison = 1;
        else if (!b.due_date) comparison = -1;
        else comparison = new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
        break;
      case 'created_at':
        comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        break;
      case 'title':
        comparison = a.title.localeCompare(b.title);
        break;
      case 'priority':
        const priorityOrder = { low: 1, medium: 2, high: 3 };
        comparison = priorityOrder[a.priority] - priorityOrder[b.priority];
        break;
    }
    
    return sortOrder === 'asc' ? comparison : -comparison;
  });
  
  return sorted;
};

/**
 * Exportiert alle Rückmeldungen als CSV
 */
export const exportFeedbacksAsCSV = async (): Promise<string> => {
  const feedbacks = await getAllFeedbacks({ sortBy: 'due_date', sortOrder: 'asc' });
  
  let csv = 'Betreff,Telefonnummer,Beschreibung,Grund,Fälligkeitsdatum,Fälligkeitszeit,Status,Priorität,Erstellt am,Erledigt am\n';
  
  feedbacks.forEach(fb => {
    const dueDate = fb.due_date || '';
    const dueTime = fb.due_time || '';
    const completedAt = fb.completed_at || '';
    
    csv += `"${fb.title.replace(/"/g, '""')}",`;
    csv += `"${fb.phone_number}",`;
    csv += `"${fb.description.replace(/"/g, '""')}",`;
    csv += `"${fb.reason.replace(/"/g, '""')}",`;
    csv += `"${dueDate}",`;
    csv += `"${dueTime}",`;
    csv += `"${fb.status}",`;
    csv += `"${fb.priority}",`;
    csv += `"${fb.created_at}",`;
    csv += `"${completedAt}"\n`;
  });
  
  return csv;
};

/**
 * Importiert Rückmeldungen aus CSV
 */
export const importFeedbacksFromCSV = async (csv: string): Promise<{ imported: number; errors: string[] }> => {
  const result = { imported: 0, errors: [] as string[] };
  
  try {
    const lines = csv.split('\n');
    if (lines.length < 2) {
      result.errors.push('CSV enthält keine Daten');
      return result;
    }
    
    // Überspringe Header
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const values = parseCSVLine(line);
      if (values.length < 8) {
        result.errors.push(`Zeile ${i + 1}: Ungültiges Format`);
        continue;
      }
      
      try {
        const feedback = await createFeedback(
          values[1] || '', // phone_number
          values[0] || 'Unbekannt', // title
          values[2] || '', // description
          values[3] || '', // reason
          values[4] || null, // due_date
          values[5] || null, // due_time
          (values[7] as 'low' | 'medium' | 'high') || 'medium', // priority
          null // call_note_id
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
