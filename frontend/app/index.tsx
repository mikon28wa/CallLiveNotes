import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Alert, ActivityIndicator, RefreshControl, Platform } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { PhoneNumberSummary, getAllPhoneNumbers, initDatabase } from '../utils/database';
import CallDetectionService from '../components/CallDetectionService';
import FloatingCallButton from '../components/FloatingCallButton';

const HomeScreen: React.FC = () => {
  const [phoneNumbers, setPhoneNumbers] = useState<PhoneNumberSummary[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dbInitialized, setDbInitialized] = useState(false);

  // Initialisiere Datenbank
  useEffect(() => {
    const initialize = async () => {
      try {
        await initDatabase();
        setDbInitialized(true);
        await loadPhoneNumbers();
      } catch (error) {
        console.error('Fehler bei der Datenbankinitialisierung:', error);
        Alert.alert('Fehler', 'Datenbank konnte nicht initialisiert werden');
      } finally {
        setLoading(false);
      }
    };
    initialize();
  }, []);

  // Lade Telefonnummern
  const loadPhoneNumbers = useCallback(async () => {
    if (!dbInitialized) return;
    try {
      setLoading(true);
      const numbers = await getAllPhoneNumbers(searchQuery || undefined);
      setPhoneNumbers(numbers);
    } catch (error) {
      console.error('Fehler beim Laden der Telefonnummern:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [dbInitialized, searchQuery]);

  // Aktualisiere bei Fokus
  useFocusEffect(
    useCallback(() => {
      if (dbInitialized) {
        loadPhoneNumbers();
      }
    }, [dbInitialized, loadPhoneNumbers])
  );

  // Export als CSV
  const exportAllAsCSV = async () => {
    try {
      setLoading(true);
      const allNumbers = await getAllPhoneNumbers();
      if (allNumbers.length === 0) {
        Alert.alert('Keine Daten', 'Es gibt keine Notizen zum Exportieren');
        return;
      }

      let csvContent = 'Telefonnummer,Letzte Notiz,Letzter Anruf,Anzahl Notizen\n';
      allNumbers.forEach(number => {
        const lastNote = number.last_note ? `"${number.last_note.replace(/"/g, '""')}"` : '';
        csvContent += `"${number.phone_number}",${lastNote},"${number.last_call_time}",${number.note_count}\n`;
      });

      const fileUri = FileSystem.documentDirectory + 'calllivenotes_export.csv';
      await FileSystem.writeAsStringAsync(fileUri, csvContent);
      await Sharing.shareAsync(fileUri, { mimeType: 'text/csv', dialogTitle: 'CallLiveNotes CSV Export' });
    } catch (error) {
      console.error('Fehler beim CSV-Export:', error);
      Alert.alert('Fehler', 'Export fehlgeschlagen');
    } finally {
      setLoading(false);
    }
  };

  // Export als Backup
  const exportBackup = async () => {
    try {
      setLoading(true);
      const { createBackup } = require('../utils/database');
      const backupData = await createBackup();
      const fileUri = FileSystem.documentDirectory + 'calllivenotes_backup.json';
      await FileSystem.writeAsStringAsync(fileUri, JSON.stringify(backupData, null, 2));
      await Sharing.shareAsync(fileUri, { mimeType: 'application/json', dialogTitle: 'CallLiveNotes Backup' });
    } catch (error) {
      console.error('Fehler beim Backup-Export:', error);
      Alert.alert('Fehler', 'Backup-Export fehlgeschlagen');
    } finally {
      setLoading(false);
    }
  };

  // Formatierung der Telefonnummer für die Anzeige
  const formatPhoneNumber = (phoneNumber: string): string => {
    // Entferne Leerzeichen und Bindestriche für die Anzeige
    return phoneNumber.replace(/[\s-]/g, '');
  };

  // Formatierung des Datums
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInMinutes = Math.floor(diffInMs / 60000);
    const diffInHours = Math.floor(diffInMinutes / 60);
    const diffInDays = Math.floor(diffInHours / 24);

    if (diffInMinutes < 1) return 'Gerade eben';
    if (diffInMinutes < 60) return `Vor ${diffInMinutes} Min`;
    if (diffInHours < 24) return `Vor ${diffInHours} Std`;
    if (diffInDays === 1) return 'Gestern';
    if (diffInDays < 7) return `Vor ${diffInDays} Tagen`;
    
    return date.toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  // Render
  return (
    <View style={styles.container}>
      <TextInput
        style={styles.searchInput}
        placeholder="Suche nach Telefonnummer oder Notiz..."
        placeholderTextColor="#999"
        value={searchQuery}
        onChangeText={setSearchQuery}
        keyboardType="phone-pad"
      />
      
      <View style={styles.actionBar}>
        <TouchableOpacity style={styles.actionButton} onPress={exportAllAsCSV} disabled={loading}>
          <Text style={styles.actionButtonText}>CSV Export</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} onPress={exportBackup} disabled={loading}>
          <Text style={styles.actionButtonText}>Backup</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#007AFF" style={styles.loader} />
      ) : phoneNumbers.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Keine Notizen vorhanden</Text>
          <Text style={styles.emptySubtext}>
            {Platform.OS === 'android' 
              ? 'Notizen werden automatisch bei Anrufen erstellt' 
              : 'Tippen Sie auf den + Button, um eine Notiz manuell zu erstellen'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={phoneNumbers}
          renderItem={({ item }) => (
            <TouchableOpacity 
              style={styles.card}
              onPress={() => {
                // @ts-ignore - Navigation wird durch Expo Router gehandhabt
                router.push(`/note-detail/${encodeURIComponent(item.phone_number)}`);
              }}
            >
              <View style={styles.cardContent}>
                <Text style={styles.phoneNumber}>{formatPhoneNumber(item.phone_number)}</Text>
                {item.last_note && (
                  <Text style={styles.lastNote} numberOfLines={1}>
                    {item.last_note}
                  </Text>
                )}
                <View style={styles.cardMeta}>
                  <Text style={styles.metaText}>Letzter Anruf: {formatDate(item.last_call_time)}</Text>
                  <View style={styles.noteCountContainer}>
                    <Text style={styles.noteCountText}>{item.note_count} Notizen</Text>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          )}
          keyExtractor={(item) => item.phone_number}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadPhoneNumbers} />}
          contentContainerStyle={styles.listContent}
        />
      )}

      {Platform.OS === 'android' && <CallDetectionService />}
      <FloatingCallButton />
    </View>
  );
};

// Styles
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    paddingTop: 60,
  },
  searchInput: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 12,
    fontSize: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  actionBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    marginBottom: 12,
    gap: 8,
  },
  actionButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  loader: {
    marginTop: 40,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  listContent: {
    paddingBottom: 20,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  cardContent: {
    padding: 16,
  },
  phoneNumber: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  lastNote: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  cardMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metaText: {
    fontSize: 12,
    color: '#999',
  },
  noteCountContainer: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  noteCountText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
});

// Typ-Definition für router (wird durch Expo Router bereitgestellt)
declare const router: {
  push: (path: string) => void;
};

export default HomeScreen;
