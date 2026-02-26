import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { Platform, Alert } from 'react-native';

interface Note {
  note_id: string;
  text: string;
  created_at: string;
  updated_at: string;
}

interface CallNotes {
  phone_number: string;
  notes: Note[];
  last_call_time: string;
}

/**
 * Exportiert Notizen einer Telefonnummer als PDF
 */
export const exportToPDF = async (callNotes: CallNotes) => {
  try {
    const formatDate = (dateString: string) => {
      return new Date(dateString).toLocaleString('de-DE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    };

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body {
              font-family: Arial, sans-serif;
              padding: 20px;
              color: #333;
            }
            h1 {
              color: #4CAF50;
              border-bottom: 2px solid #4CAF50;
              padding-bottom: 10px;
            }
            .note {
              background-color: #f5f5f5;
              padding: 15px;
              margin: 15px 0;
              border-radius: 8px;
              border-left: 4px solid #4CAF50;
            }
            .note-header {
              font-size: 12px;
              color: #666;
              margin-bottom: 8px;
            }
            .note-text {
              font-size: 14px;
              line-height: 1.6;
            }
            .footer {
              margin-top: 30px;
              padding-top: 20px;
              border-top: 1px solid #ddd;
              font-size: 12px;
              color: #999;
              text-align: center;
            }
          </style>
        </head>
        <body>
          <h1>Anrufnotizen: ${callNotes.phone_number}</h1>
          <p><strong>Anzahl Notizen:</strong> ${callNotes.notes.length}</p>
          <p><strong>Letzter Anruf:</strong> ${formatDate(callNotes.last_call_time)}</p>
          
          <h2>Notizen</h2>
          ${callNotes.notes.map(note => `
            <div class="note">
              <div class="note-header">
                📅 ${formatDate(note.created_at)}
                ${note.updated_at !== note.created_at ? ` (Aktualisiert: ${formatDate(note.updated_at)})` : ''}
              </div>
              <div class="note-text">${note.text.replace(/\n/g, '<br>')}</div>
            </div>
          `).join('')}
          
          <div class="footer">
            Exportiert am ${formatDate(new Date().toISOString())}<br>
            Anrufnotizen App
          </div>
        </body>
      </html>
    `;

    const { uri } = await Print.printToFileAsync({ html });
    
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: `Notizen für ${callNotes.phone_number}`,
        UTI: 'com.adobe.pdf',
      });
    }
    
    return uri;
  } catch (error) {
    console.error('Fehler beim PDF-Export:', error);
    Alert.alert('Fehler', 'PDF konnte nicht erstellt werden');
    throw error;
  }
};

/**
 * Exportiert Notizen als CSV
 */
export const exportToCSV = async (data: CallNotes[]) => {
  try {
    // CSV Header
    let csv = 'Telefonnummer,Notiz-Text,Erstellt am,Aktualisiert am\n';
    
    // CSV Daten
    data.forEach(callNote => {
      callNote.notes.forEach(note => {
        const row = [
          `"${callNote.phone_number}"`,
          `"${note.text.replace(/"/g, '""')}"`, // Escape quotes
          `"${new Date(note.created_at).toLocaleString('de-DE')}"`,
          `"${new Date(note.updated_at).toLocaleString('de-DE')}"`,
        ].join(',');
        csv += row + '\n';
      });
    });

    // Speichere CSV-Datei
    const fileName = `anrufnotizen_${new Date().toISOString().split('T')[0]}.csv`;
    const fileUri = FileSystem.documentDirectory + fileName;
    
    await FileSystem.writeAsStringAsync(fileUri, csv, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      await Sharing.shareAsync(fileUri, {
        mimeType: 'text/csv',
        dialogTitle: 'Anrufnotizen exportieren',
      });
    }

    return fileUri;
  } catch (error) {
    console.error('Fehler beim CSV-Export:', error);
    Alert.alert('Fehler', 'CSV konnte nicht erstellt werden');
    throw error;
  }
};

/**
 * Exportiert einzelne Telefonnummer als CSV
 */
export const exportSingleToCSV = async (callNotes: CallNotes) => {
  return exportToCSV([callNotes]);
};

/**
 * Erstellt ein Backup aller Daten
 */
export const createBackup = async (backupData: any) => {
  try {
    const fileName = `backup_anrufnotizen_${new Date().toISOString().split('T')[0]}.json`;
    const jsonString = JSON.stringify(backupData, null, 2);
    
    if (Platform.OS === 'web') {
      // Web: Download als Datei
      if (typeof window !== 'undefined' && typeof document !== 'undefined') {
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        
        // Cleanup
        setTimeout(() => {
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
        }, 100);
        
        return fileName;
      } else {
        throw new Error('Web environment not available');
      }
    } else {
      // Mobile: FileSystem + Sharing
      if (!FileSystem || !Sharing) {
        throw new Error('FileSystem or Sharing not available');
      }
      
      const fileUri = FileSystem.documentDirectory + fileName;
      
      await FileSystem.writeAsStringAsync(
        fileUri,
        jsonString,
        {
          encoding: FileSystem.EncodingType.UTF8,
        }
      );

      await Sharing.shareAsync(fileUri, {
        mimeType: 'application/json',
        dialogTitle: 'Backup speichern',
      });

      return fileUri;
    }
  } catch (error) {
    console.error('Fehler beim Backup:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unbekannter Fehler';
    Alert.alert('Fehler', `Backup konnte nicht erstellt werden: ${errorMessage}`);
    throw error;
  }
};
