import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Alert, ActivityIndicator, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Note, CallNote, getNotesForPhoneNumber, createNote, updateNote, deleteNote } from '../../utils/database';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Ionicons } from '@expo/vector-icons';

const NoteDetailScreen: React.FC = () => {
  const params = useLocalSearchParams<{ phoneNumber: string }>();
  const router = useRouter();
  const phoneNumber = params.phoneNumber ? decodeURIComponent(params.phoneNumber) : '';
  const [callNote, setCallNote] = useState<CallNote | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [newNoteText, setNewNoteText] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [editingText, setEditingText] = useState('');

  // Lade Notizen
  useEffect(() => {
    if (phoneNumber) {
      loadNotes();
    }
  }, [phoneNumber]);

  const loadNotes = useCallback(async () => {
    try {
      setLoading(true);
      const noteData = await getNotesForPhoneNumber(phoneNumber);
      if (noteData) {
        setCallNote(noteData);
        setNotes(noteData.notes);
      } else {
        // Erstelle eine leere CallNote, falls keine existiert
        setCallNote({
          id: -1,
          phone_number: phoneNumber,
          last_call_time: new Date().toISOString(),
          notes: []
        });
        setNotes([]);
      }
    } catch (error) {
      console.error('Fehler beim Laden der Notizen:', error);
      Alert.alert('Fehler', 'Notizen konnten nicht geladen werden');
    } finally {
      setLoading(false);
    }
  }, [phoneNumber]);

  // Füge neue Notiz hinzu
  const addNote = async () => {
    if (!newNoteText.trim()) {
      Alert.alert('Hinweis', 'Bitte geben Sie einen Notiztext ein');
      return;
    }
    try {
      setSaving(true);
      const newNote = await createNote(phoneNumber, newNoteText);
      setNewNoteText('');
      setNotes(prev => [newNote, ...prev]);
      
      // Aktualisiere die callNote-Daten
      if (callNote) {
        setCallNote({
          ...callNote,
          last_call_time: new Date().toISOString(),
          notes: [newNote, ...callNote.notes]
        });
      }
    } catch (error) {
      console.error('Fehler beim Erstellen der Notiz:', error);
      Alert.alert('Fehler', 'Notiz konnte nicht erstellt werden');
    } finally {
      setSaving(false);
    }
  };

  // Notiz bearbeiten
  const startEditing = (note: Note) => {
    setEditingNote(note);
    setEditingText(note.text);
  };

  // Notiz aktualisieren
  const saveEdit = async () => {
    if (!editingNote || !editingText.trim()) {
      Alert.alert('Hinweis', 'Bitte geben Sie einen Notiztext ein');
      return;
    }
    
    try {
      setSaving(true);
      const updatedNote = await updateNote(phoneNumber, editingNote.note_id, editingText);
      if (updatedNote) {
        // Aktualisiere die Notiz in der Liste
        setNotes(prev => prev.map(n => 
          n.note_id === updatedNote.note_id ? updatedNote : n
        ));
        setEditingNote(null);
        setEditingText('');
      }
    } catch (error) {
      console.error('Fehler beim Aktualisieren der Notiz:', error);
      Alert.alert('Fehler', 'Notiz konnte nicht aktualisiert werden');
    } finally {
      setSaving(false);
    }
  };

  // Notiz löschen
  const handleDelete = async (note: Note) => {
    Alert.alert(
      'Notiz löschen',
      'Möchtest du diese Notiz wirklich löschen?',
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Löschen',
          style: 'destructive',
          onPress: async () => {
            try {
              setSaving(true);
              const success = await deleteNote(phoneNumber, note.note_id);
              if (success) {
                setNotes(prev => prev.filter(n => n.note_id !== note.note_id));
                
                // Aktualisiere die callNote-Daten
                if (callNote) {
                  setCallNote({
                    ...callNote,
                    notes: callNote.notes.filter(n => n.note_id !== note.note_id)
                  });
                }
              }
            } catch (error) {
              console.error('Fehler beim Löschen der Notiz:', error);
              Alert.alert('Fehler', 'Notiz konnte nicht gelöscht werden');
            } finally {
              setSaving(false);
            }
          }
        }
      ]
    );
  };

  // Export als CSV
  const exportAsCSV = async () => {
    try {
      setSaving(true);
      if (!callNote) return;
      
      let csvContent = 'Datum,Notiz\n';
      callNote.notes.forEach(note => {
        const formattedDate = new Date(note.created_at).toLocaleString('de-DE');
        const text = `"${note.text.replace(/"/g, '""')}"`;
        csvContent += `"${formattedDate}",${text}\n`;
      });
      
      const safePhoneNumber = phoneNumber.replace(/[^a-zA-Z0-9]/g, '_');
      const fileUri = FileSystem.documentDirectory + `calllivenotes_${safePhoneNumber}.csv`;
      await FileSystem.writeAsStringAsync(fileUri, csvContent);
      await Sharing.shareAsync(fileUri, { mimeType: 'text/csv' });
    } catch (error) {
      console.error('Fehler beim CSV-Export:', error);
      Alert.alert('Fehler', 'Export fehlgeschlagen');
    } finally {
      setSaving(false);
    }
  };

  // Export als Text
  const exportAsText = async () => {
    try {
      setSaving(true);
      if (!callNote) return;
      
      let textContent = `Anrufnotizen für ${phoneNumber}\n\n`;
      textContent += `Letzter Anruf: ${new Date(callNote.last_call_time).toLocaleString('de-DE')}\n\n`;
      
      callNote.notes.forEach((note, index) => {
        textContent += `${index + 1}. Notiz (${new Date(note.created_at).toLocaleString('de-DE')})\n`;
        textContent += `${note.text}\n\n`;
      });
      
      const safePhoneNumber = phoneNumber.replace(/[^a-zA-Z0-9]/g, '_');
      const fileUri = FileSystem.documentDirectory + `calllivenotes_${safePhoneNumber}.txt`;
      await FileSystem.writeAsStringAsync(fileUri, textContent);
      await Sharing.shareAsync(fileUri, { mimeType: 'text/plain' });
    } catch (error) {
      console.error('Fehler beim Text-Export:', error);
      Alert.alert('Fehler', 'Export fehlgeschlagen');
    } finally {
      setSaving(false);
    }
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
    
    return date.toLocaleString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Render
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{phoneNumber}</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.exportButton} onPress={exportAsCSV} disabled={saving}>
            <Text style={styles.exportButtonText}>CSV</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.exportButton} onPress={exportAsText} disabled={saving}>
            <Text style={styles.exportButtonText}>Text</Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#007AFF" style={styles.loader} />
      ) : notes.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Keine Notizen für diese Telefonnummer</Text>
          <Text style={styles.emptySubtext}>
            Fügen Sie unten eine neue Notiz hinzu
          </Text>
        </View>
      ) : (
        <FlatList
          data={notes}
          renderItem={({ item }) => (
            <View style={styles.noteCard}>
              <View style={styles.noteHeader}>
                <Text style={styles.noteDate}>{formatDate(item.created_at)}</Text>
                <View style={styles.noteActions}>
                  <TouchableOpacity onPress={() => startEditing(item)} disabled={saving}>
                    <Ionicons name="create-outline" size={20} color="#007AFF" />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleDelete(item)} disabled={saving}>
                    <Ionicons name="trash-outline" size={20} color="#ff3b30" />
                  </TouchableOpacity>
                </View>
              </View>
              
              {editingNote && editingNote.note_id === item.note_id ? (
                <View style={styles.editContainer}>
                  <TextInput
                    style={styles.editInput}
                    value={editingText}
                    onChangeText={setEditingText}
                    multiline
                    autoFocus
                  />
                  <View style={styles.editActions}>
                    <TouchableOpacity 
                      style={styles.editButton} 
                      onPress={() => {
                        setEditingNote(null);
                        setEditingText('');
                      }}
                      disabled={saving}
                    >
                      <Text style={styles.editButtonText}>Abbrechen</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={[styles.editButton, styles.saveButton]} 
                      onPress={saveEdit}
                      disabled={saving || !editingText.trim()}
                    >
                      <Text style={[styles.editButtonText, styles.saveButtonText]}>
                        {saving ? 'Speichern...' : 'Speichern'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <Text style={styles.noteText}>{item.text}</Text>
              )}

              {item.updated_at !== item.created_at && (
                <Text style={styles.updatedText}>
                  Aktualisiert: {formatDate(item.updated_at)}
                </Text>
              )}
            </View>
          )}
          keyExtractor={(item) => item.note_id}
          contentContainerStyle={styles.listContent}
        />
      )}

      <View style={styles.addNoteContainer}>
        <TextInput
          style={styles.addNoteInput}
          placeholder="Neue Notiz hinzufügen..."
          value={newNoteText}
          onChangeText={setNewNoteText}
          multiline
          editable={!saving}
        />
        <TouchableOpacity 
          style={[styles.addNoteButton, (!newNoteText.trim() || saving) && styles.addNoteButtonDisabled]} 
          onPress={addNote} 
          disabled={!newNoteText.trim() || saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name="send" size={20} color="#fff" />
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

// Styles
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
    backgroundColor: '#fff',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  exportButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  exportButtonText: {
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
    fontSize: 16,
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
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 80,
  },
  noteCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  noteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  noteDate: {
    fontSize: 12,
    color: '#999',
  },
  noteActions: {
    flexDirection: 'row',
    gap: 16,
  },
  noteText: {
    fontSize: 16,
    color: '#333',
    lineHeight: 22,
  },
  updatedText: {
    fontSize: 11,
    color: '#666',
    marginTop: 8,
    fontStyle: 'italic',
  },
  editContainer: {
    marginTop: 8,
  },
  editInput: {
    backgroundColor: '#f9f9f9',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  editActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
    gap: 8,
  },
  editButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#e0e0e0',
  },
  saveButton: {
    backgroundColor: '#007AFF',
  },
  editButtonText: {
    color: '#333',
    fontSize: 14,
    fontWeight: '500',
  },
  saveButtonText: {
    color: '#fff',
  },
  addNoteContainer: {
    flexDirection: 'row',
    position: 'absolute',
    bottom: 20,
    left: 16,
    right: 16,
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 8,
    paddingRight: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  addNoteInput: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    maxHeight: 100,
  },
  addNoteButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  addNoteButtonDisabled: {
    backgroundColor: '#ccc',
  },
});

export default NoteDetailScreen;
