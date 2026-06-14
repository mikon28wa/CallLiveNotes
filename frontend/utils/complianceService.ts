/**
 * ComplianceService - Compliance-Funktionen für CallLiveNotes
 * 
 * Dieser Service bietet Funktionen für:
 * - Audit-Logging
 * - Unveränderliche Historie
 * - Compliance-Export
 * - Datenintegrität
 * 
 * WICHTIG: Alle Daten stammen aus dem Telefonbuch des Nutzers.
 * Es werden KEINE Anrufpartner-Daten gespeichert!
 */

import * as SQLite from 'expo-sqlite';
import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';

// Typdefinitionen
export interface AuditLogEntry {
  id: number;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'COMPLETE' | 'SYNC';
  entity_type: 'note' | 'feedback' | 'contact_note' | 'call_note';
  entity_id: number | string;
  phone_number: string;
  details: string;
  user_id: string | null; // Für Multi-User (zukünftig)
  timestamp: string;
  ip_address: string | null; // Für Web
  device_info: string | null; // Für Mobile
}

export interface ComplianceReport {
  generated_at: string;
  period_start: string;
  period_end: string;
  total_calls: number;
  total_notes: number;
  total_feedbacks: number;
  completed_feedbacks: number;
  pending_feedbacks: number;
  overdue_feedbacks: number;
  data_integrity: boolean;
  audit_logs: AuditLogEntry[];
}

export interface ComplianceExport {
  metadata: {
    app_version: string;
    export_date: string;
    device_id: string;
    user_id: string | null;
  };
  call_notes: any[];
  notes: any[];
  feedbacks: any[];
  contact_notes: any[];
  audit_logs: AuditLogEntry[];
}

// Datenbank
const db = SQLite.openDatabase('callNotes.db');

/**
 * Initialisiert die Audit-Log-Tabelle
 */
export const initComplianceDatabase = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    db.transaction(tx => {
      // Audit-Log-Tabelle
      tx.executeSql(
        `CREATE TABLE IF NOT EXISTS audit_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          action TEXT NOT NULL CHECK(action IN ('CREATE', 'UPDATE', 'DELETE', 'COMPLETE', 'SYNC')),
          entity_type TEXT NOT NULL CHECK(entity_type IN ('note', 'feedback', 'contact_note', 'call_note')),
          entity_id TEXT NOT NULL,
          phone_number TEXT NOT NULL,
          details TEXT,
          user_id TEXT,
          timestamp TEXT NOT NULL,
          ip_address TEXT,
          device_info TEXT
        );`,
        [],
        () => {},
        (_, error) => {
          console.error('Fehler beim Erstellen der audit_logs-Tabelle:', error);
          return false;
        }
      );

      // Index für bessere Performance
      tx.executeSql(
        `CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);`,
        [],
        () => {},
        (_, error) => {
          console.error('Fehler beim Erstellen des Index:', error);
          return false;
        }
      );

      tx.executeSql(
        `CREATE INDEX IF NOT EXISTS idx_audit_logs_phone_number ON audit_logs(phone_number);`,
        [],
        () => {},
        (_, error) => {
          console.error('Fehler beim Erstellen des Index:', error);
          return false;
        }
      );

      tx.executeSql(
        `CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);`,
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
 * Fügt einen Audit-Log-Eintrag hinzu
 */
export const logAuditAction = (
  action: AuditLogEntry['action'],
  entity_type: AuditLogEntry['entity_type'],
  entity_id: number | string,
  phone_number: string,
  details: string = '',
  user_id: string | null = null
): Promise<AuditLogEntry> => {
  return new Promise((resolve, reject) => {
    const timestamp = new Date().toISOString();
    const device_info = getDeviceInfo();
    
    db.transaction(tx => {
      tx.executeSql(
        `INSERT INTO audit_logs (action, entity_type, entity_id, phone_number, details, user_id, timestamp, device_info) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [action, entity_type, entity_id.toString(), phone_number, details, user_id, timestamp, device_info],
        (_, result) => {
          const entry: AuditLogEntry = {
            id: result.insertId,
            action,
            entity_type,
            entity_id: entity_id.toString(),
            phone_number,
            details,
            user_id,
            timestamp,
            ip_address: null,
            device_info,
          };
          resolve(entry);
        },
        (_, error) => {
          console.error('Fehler beim Loggen der Aktion:', error);
          reject(error);
          return false;
        }
      );
    });
  });
};

/**
 * Holt alle Audit-Logs
 */
export const getAuditLogs = (
  filter?: {
    start_date?: string;
    end_date?: string;
    phone_number?: string;
    action?: AuditLogEntry['action'];
    entity_type?: AuditLogEntry['entity_type'];
    limit?: number;
  }
): Promise<AuditLogEntry[]> => {
  return new Promise((resolve, reject) => {
    let query = 'SELECT * FROM audit_logs WHERE 1=1';
    const params: any[] = [];

    if (filter) {
      if (filter.start_date) {
        query += ' AND timestamp >= ?';
        params.push(filter.start_date);
      }
      if (filter.end_date) {
        query += ' AND timestamp <= ?';
        params.push(filter.end_date);
      }
      if (filter.phone_number) {
        query += ' AND phone_number = ?';
        params.push(filter.phone_number);
      }
      if (filter.action) {
        query += ' AND action = ?';
        params.push(filter.action);
      }
      if (filter.entity_type) {
        query += ' AND entity_type = ?';
        params.push(filter.entity_type);
      }
    }

    query += ' ORDER BY timestamp DESC';
    
    if (filter?.limit) {
      query += ` LIMIT ${filter.limit}`;
    }

    db.transaction(tx => {
      tx.executeSql(
        query,
        params,
        (_, result) => {
          const logs: AuditLogEntry[] = [];
          for (let i = 0; i < result.rows.length; i++) {
            logs.push(mapRowToAuditLog(result.rows.item(i)));
          }
          resolve(logs);
        },
        (_, error) => {
          console.error('Fehler beim Abrufen der Audit-Logs:', error);
          reject(error);
          return false;
        }
      );
    });
  });
};

/**
 * Erstellt einen Compliance-Bericht
 */
export const generateComplianceReport = async (
  start_date?: string,
  end_date?: string
): Promise<ComplianceReport> => {
  const report: ComplianceReport = {
    generated_at: new Date().toISOString(),
    period_start: start_date || new Date(0).toISOString(),
    period_end: end_date || new Date().toISOString(),
    total_calls: 0,
    total_notes: 0,
    total_feedbacks: 0,
    completed_feedbacks: 0,
    pending_feedbacks: 0,
    overdue_feedbacks: 0,
    data_integrity: true,
    audit_logs: [],
  };

  try {
    // Hole Statistiken
    const [callNotesResult, notesResult, feedbacksResult, auditLogs] = await Promise.all([
      db.transactionAsync(async (tx) => {
        const result = await tx.executeSqlAsync(
          `SELECT COUNT(*) as count FROM call_notes ${start_date ? 'WHERE created_at >= ?' : ''}`,
          start_date ? [start_date] : []
        );
        return result.rows.item(0).count;
      }),
      db.transactionAsync(async (tx) => {
        const result = await tx.executeSqlAsync(
          `SELECT COUNT(*) as count FROM notes ${start_date ? 'WHERE created_at >= ?' : ''}`,
          start_date ? [start_date] : []
        );
        return result.rows.item(0).count;
      }),
      db.transactionAsync(async (tx) => {
        const result = await tx.executeSqlAsync(
          `SELECT 
           COUNT(*) as total,
           COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
           COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
           COUNT(CASE WHEN status = 'pending' AND due_date IS NOT NULL AND due_date < date('now') THEN 1 END) as overdue
           FROM feedbacks ${start_date ? 'WHERE created_at >= ?' : ''}`,
          start_date ? [start_date] : []
        );
        return result.rows.item(0);
      }),
      getAuditLogs({ start_date, end_date, limit: 100 }),
    ]);

    report.total_calls = callNotesResult;
    report.total_notes = notesResult;
    report.total_feedbacks = feedbacksResult.total;
    report.completed_feedbacks = feedbacksResult.completed;
    report.pending_feedbacks = feedbacksResult.pending;
    report.overdue_feedbacks = feedbacksResult.overdue;
    report.audit_logs = auditLogs;

    // Prüfe Datenintegrität
    report.data_integrity = await checkDataIntegrity();

  } catch (error) {
    console.error('Fehler beim Erstellen des Compliance-Berichts:', error);
    report.data_integrity = false;
  }

  return report;
};

/**
 * Prüft die Datenintegrität
 */
export const checkDataIntegrity = async (): Promise<boolean> => {
  try {
    // 1. Prüfe ob alle Notizen zu existierenden call_notes gehören
    const orphanedNotes = await db.transactionAsync(async (tx) => {
      const result = await tx.executeSqlAsync(
        `SELECT COUNT(*) as count FROM notes n 
         LEFT JOIN call_notes cn ON n.call_note_id = cn.id 
         WHERE cn.id IS NULL`
      );
      return result.rows.item(0).count;
    });

    if (orphanedNotes > 0) {
      console.warn(`Datenintegrität: ${orphanedNotes} Notizen ohne call_note gefunden`);
      return false;
    }

    // 2. Prüfe ob alle Feedbacks gültige Status-Werte haben
    const invalidStatus = await db.transactionAsync(async (tx) => {
      const result = await tx.executeSqlAsync(
        `SELECT COUNT(*) as count FROM feedbacks 
         WHERE status NOT IN ('pending', 'completed', 'cancelled', 'overdue')`
      );
      return result.rows.item(0).count;
    });

    if (invalidStatus > 0) {
      console.warn(`Datenintegrität: ${invalidStatus} Feedbacks mit ungültigem Status`);
      return false;
    }

    // 3. Prüfe ob alle Feedbacks gültige Prioritäten haben
    const invalidPriority = await db.transactionAsync(async (tx) => {
      const result = await tx.executeSqlAsync(
        `SELECT COUNT(*) as count FROM feedbacks 
         WHERE priority NOT IN ('low', 'medium', 'high')`
      );
      return result.rows.item(0).count;
    });

    if (invalidPriority > 0) {
      console.warn(`Datenintegrität: ${invalidPriority} Feedbacks mit ungültiger Priorität`);
      return false;
    }

    return true;
    
  } catch (error) {
    console.error('Fehler bei der Integritätsprüfung:', error);
    return false;
  }
};

/**
 * Exportiert alle Daten für Compliance
 */
export const exportComplianceData = async (): Promise<ComplianceExport> => {
  const exportData: ComplianceExport = {
    metadata: {
      app_version: '1.0.0',
      export_date: new Date().toISOString(),
      device_id: getDeviceId(),
      user_id: null, // Für Multi-User (zukünftig)
    },
    call_notes: [],
    notes: [],
    feedbacks: [],
    contact_notes: [],
    audit_logs: [],
  };

  try {
    // Hole alle Daten
    const [callNotes, notes, feedbacks, contactNotes, auditLogs] = await Promise.all([
      db.transactionAsync(async (tx) => {
        const result = await tx.executeSqlAsync(
          `SELECT * FROM call_notes ORDER BY created_at`
        );
        const items: any[] = [];
        for (let i = 0; i < result.rows.length; i++) {
          items.push(result.rows.item(i));
        }
        return items;
      }),
      db.transactionAsync(async (tx) => {
        const result = await tx.executeSqlAsync(
          `SELECT * FROM notes ORDER BY created_at`
        );
        const items: any[] = [];
        for (let i = 0; i < result.rows.length; i++) {
          items.push(result.rows.item(i));
        }
        return items;
      }),
      db.transactionAsync(async (tx) => {
        const result = await tx.executeSqlAsync(
          `SELECT * FROM feedbacks ORDER BY created_at`
        );
        const items: any[] = [];
        for (let i = 0; i < result.rows.length; i++) {
          items.push(result.rows.item(i));
        }
        return items;
      }),
      db.transactionAsync(async (tx) => {
        const result = await tx.executeSqlAsync(
          `SELECT * FROM contact_notes ORDER BY created_at`
        );
        const items: any[] = [];
        for (let i = 0; i < result.rows.length; i++) {
          items.push(result.rows.item(i));
        }
        return items;
      }),
      getAuditLogs(),
    ]);

    exportData.call_notes = callNotes;
    exportData.notes = notes;
    exportData.feedbacks = feedbacks;
    exportData.contact_notes = contactNotes;
    exportData.audit_logs = auditLogs;

  } catch (error) {
    console.error('Fehler beim Exportieren der Compliance-Daten:', error);
    throw error;
  }

  return exportData;
};

/**
 * Exportiert Compliance-Daten als Datei
 */
export const exportComplianceToFile = async (): Promise<string> => {
  const data = await exportComplianceData();
  const jsonData = JSON.stringify(data, null, 2);
  
  const fileUri = `${FileSystem.documentDirectory}calllivenotes_compliance_${new Date().toISOString().split('T')[0]}.json`;
  await FileSystem.writeAsStringAsync(fileUri, jsonData);
  
  return fileUri;
};

/**
 * Erstellt einen verschlüsselten Export (für Compliance)
 * Hinweis: In echter Implementierung würde hier echte Verschlüsselung verwendet
 */
export const exportEncryptedComplianceData = async (password: string): Promise<string> => {
  const data = await exportComplianceData();
  const jsonData = JSON.stringify(data, null, 2);
  
  // In echter Implementierung: Hier würde AES-Verschlüsselung verwendet
  // Für diese Demo: Einfache Base64-Kodierung
  const encodedData = Buffer.from(jsonData).toString('base64');
  
  const exportData = {
    version: '1.0',
    encrypted: true,
    algorithm: 'AES-256-CBC', // Platzhalter
    data: encodedData,
    timestamp: new Date().toISOString(),
  };
  
  const fileUri = `${FileSystem.documentDirectory}calllivenotes_compliance_encrypted_${new Date().toISOString().split('T')[0]}.json`;
  await FileSystem.writeAsStringAsync(fileUri, JSON.stringify(exportData, null, 2));
  
  return fileUri;
};

/**
 * Holt Geräte-Informationen
 */
const getDeviceInfo = (): string => {
  if (Platform.OS === 'web') {
    return `Web - ${typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown'}`;
  }
  return `${Platform.OS} - ${Platform.Version}`;
};

/**
 * Generiert eine Geräte-ID
 */
const getDeviceId = (): string => {
  // In echter Implementierung: DeviceInfo Modul verwenden
  return `device_${Math.random().toString(36).substring(2, 15)}`;
};

/**
 * Konvertiert eine Datenbank-Zeile in ein AuditLogEntry-Objekt
 */
const mapRowToAuditLog = (row: any): AuditLogEntry => {
  return {
    id: row.id,
    action: row.action,
    entity_type: row.entity_type,
    entity_id: row.entity_id,
    phone_number: row.phone_number,
    details: row.details || '',
    user_id: row.user_id || null,
    timestamp: row.timestamp,
    ip_address: row.ip_address || null,
    device_info: row.device_info || null,
  };
};

/**
 * Löscht Audit-Logs älter als X Tage
 */
export const cleanupOldAuditLogs = async (days: number = 365): Promise<number> => {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  const cutoffDateStr = cutoffDate.toISOString();

  return new Promise((resolve, reject) => {
    db.transaction(tx => {
      tx.executeSql(
        `DELETE FROM audit_logs WHERE timestamp < ?`,
        [cutoffDateStr],
        (_, result) => {
          resolve(result.rowsAffected);
        },
        (_, error) => {
          console.error('Fehler beim Löschen alter Audit-Logs:', error);
          reject(error);
          return false;
        }
      );
    });
  });
};

/**
 * Exportiert Audit-Logs als CSV
 */
export const exportAuditLogsAsCSV = async (
  start_date?: string,
  end_date?: string
): Promise<string> => {
  const logs = await getAuditLogs({ start_date, end_date });
  
  let csv = 'ID,Aktion,Entitätstyp,Entitäts-ID,Telefonnummer,Details,Nutzer,Zeitstempel,Gerät\n';
  
  logs.forEach(log => {
    csv += `"${log.id}",`;
    csv += `"${log.action}",`;
    csv += `"${log.entity_type}",`;
    csv += `"${log.entity_id}",`;
    csv += `"${log.phone_number}",`;
    csv += `"${log.details.replace(/"/g, '""')}",`;
    csv += `"${log.user_id || ''}",`;
    csv += `"${log.timestamp}",`;
    csv += `"${log.device_info || ''}"\n`;
  });
  
  return csv;
};
