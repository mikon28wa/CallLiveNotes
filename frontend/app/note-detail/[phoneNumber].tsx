import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { exportToPDF, exportSingleToCSV } from '../../utils/exportUtils';

const EXPO_PUBLIC_BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

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

export default function NoteDetail() {
  const router = useRouter();
  const { phoneNumber } = useLocalSearchParams();
  const decodedPhoneNumber = decodeURIComponent(phoneNumber as string);

  const [callNotes, setCallNotes] = useState<CallNotes | null>(null);
  const [loading, setLoading] = useState(true);
  const [newNoteText, setNewNoteText] = useState('');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);

  // Auto-save für ungespeicherten Text
  useEffect(() => {
    // Beim Verlassen der Seite: Prüfe ob noch ungespeicherter Text vorhanden ist
    return () => {
      if (newNoteText.trim() && !isSubmitting) {
        // Automatisch speichern wenn Text vorhanden ist
        autoSaveNote();
      }
    };
  }, [newNoteText]);

  const autoSaveNote = async () => {
    if (!newNoteText.trim()) return;

    try {
      await fetch(
        `${EXPO_PUBLIC_BACKEND_URL}/api/notes/${encodeURIComponent(decodedPhoneNumber)}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ text: newNoteText }),
        }
      );
      console.log('Notiz automatisch gespeichert');
    } catch (error) {
      console.error('Auto-Save Fehler:', error);
    }
  };

  const fetchNotes = async () => {
    try {
      const response = await fetch(
        `${EXPO_PUBLIC_BACKEND_URL}/api/notes/${encodeURIComponent(decodedPhoneNumber)}`
      );
      const data = await response.json();
      setCallNotes(data);
    } catch (error) {
      console.error('Fehler beim Laden der Notizen:', error);
      Alert.alert('Fehler', 'Notizen konnten nicht geladen werden');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotes();
  }, [decodedPhoneNumber]);

  const handleAddNote = async () => {
    if (!newNoteText.trim()) {
      Alert.alert('Hinweis', 'Bitte gib einen Text ein');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(
        `${EXPO_PUBLIC_BACKEND_URL}/api/notes/${encodeURIComponent(decodedPhoneNumber)}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ text: newNoteText }),
        }
      );

      if (response.ok) {
        setNewNoteText('');
        await fetchNotes();
      } else {
        Alert.alert('Fehler', 'Notiz konnte nicht erstellt werden');
      }
    } catch (error) {
      console.error('Fehler beim Erstellen der Notiz:', error);
      Alert.alert('Fehler', 'Notiz konnte nicht erstellt werden');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateNote = async (noteId: string) => {
    if (!editingText.trim()) {
      Alert.alert('Hinweis', 'Bitte gib einen Text ein');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(
        `${EXPO_PUBLIC_BACKEND_URL}/api/notes/${encodeURIComponent(decodedPhoneNumber)}/${noteId}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ text: editingText }),
        }
      );

      if (response.ok) {
        setEditingNoteId(null);
        setEditingText('');
        await fetchNotes();
      } else {
        Alert.alert('Fehler', 'Notiz konnte nicht aktualisiert werden');
      }
    } catch (error) {
      console.error('Fehler beim Aktualisieren der Notiz:', error);
      Alert.alert('Fehler', 'Notiz konnte nicht aktualisiert werden');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (Platform.OS === 'web') {
      // Auf Web: einfache confirm-Dialog
      const confirmed = window.confirm('Möchtest du diese Notiz wirklich löschen?');
      if (!confirmed) return;
      
      try {
        const response = await fetch(
          `${EXPO_PUBLIC_BACKEND_URL}/api/notes/${encodeURIComponent(decodedPhoneNumber)}/${noteId}`,
          {
            method: 'DELETE',
          }
        );

        if (response.ok) {
          await fetchNotes();
        } else {
          window.alert('Fehler: Notiz konnte nicht gelöscht werden');
        }
      } catch (error) {
        console.error('Fehler beim Löschen der Notiz:', error);
        window.alert('Fehler: Notiz konnte nicht gelöscht werden');
      }
    } else {
      // Auf Mobile: Native Alert
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
                const response = await fetch(
                  `${EXPO_PUBLIC_BACKEND_URL}/api/notes/${encodeURIComponent(decodedPhoneNumber)}/${noteId}`,
                  {
                    method: 'DELETE',
                  }
                );

                if (response.ok) {
                  await fetchNotes();
                } else {
                  Alert.alert('Fehler', 'Notiz konnte nicht gelöscht werden');
                }
              } catch (error) {
                console.error('Fehler beim Löschen der Notiz:', error);
                Alert.alert('Fehler', 'Notiz konnte nicht gelöscht werden');
              }
            },
          },
        ]
      );
    }
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleExportPDF = async () => {
    if (!callNotes) return;
    
    try {
      setShowExportMenu(false);
      await exportToPDF(callNotes);
      Alert.alert('Erfolg', 'PDF wurde erstellt');
    } catch (error) {
      console.error('PDF Export Fehler:', error);
    }
  };

  const handleExportCSV = async () => {
    if (!callNotes) return;
    
    try {
      setShowExportMenu(false);
      await exportSingleToCSV(callNotes);
      Alert.alert('Erfolg', 'CSV wurde erstellt');
    } catch (error) {
      console.error('CSV Export Fehler:', error);
    }
  };

  const renderNoteItem = ({ item }: { item: Note }) => {
    const isEditing = editingNoteId === item.note_id;

    return (
      <View style={styles.noteItem}>
        <View style={styles.noteHeader}>
          <Text style={styles.noteDate}>{formatDateTime(item.created_at)}</Text>
          <View style={styles.noteActions}>
            {!isEditing && (
              <>
                <TouchableOpacity
                  onPress={() => {
                    setEditingNoteId(item.note_id);
                    setEditingText(item.text);
                  }}
                  style={styles.actionButton}
                >
                  <Ionicons name="create-outline" size={20} color="#4CAF50" />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleDeleteNote(item.note_id)}
                  style={styles.actionButton}
                >
                  <Ionicons name="trash-outline" size={20} color="#f44336" />
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>

        {isEditing ? (
          <View>
            <TextInput
              style={styles.editInput}
              value={editingText}
              onChangeText={setEditingText}
              multiline
              autoFocus
            />
            <View style={styles.editActions}>
              <TouchableOpacity
                onPress={() => {
                  setEditingNoteId(null);
                  setEditingText('');
                }}
                style={[styles.editButton, styles.cancelButton]}
              >
                <Text style={styles.editButtonText}>Abbrechen</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => handleUpdateNote(item.note_id)}
                style={[styles.editButton, styles.saveButton]}
                disabled={isSubmitting}
              >
                <Text style={styles.editButtonText}>
                  {isSubmitting ? 'Speichern...' : 'Speichern'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <Text style={styles.noteText}>{item.text}</Text>
        )}

        {item.updated_at !== item.created_at && (
          <Text style={styles.updatedText}>
            Aktualisiert: {formatDateTime(item.updated_at)}
          </Text>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" />
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#4CAF50" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>{decodedPhoneNumber}</Text>
            <Text style={styles.headerSubtitle}>
              {callNotes?.notes.length || 0} Notizen
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => setShowExportMenu(!showExportMenu)}
            style={styles.exportButton}
          >
            <Ionicons name="share-outline" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        {showExportMenu && (
          <View style={styles.exportMenu}>
            <TouchableOpacity
              style={styles.exportMenuItem}
              onPress={handleExportPDF}
            >
              <Ionicons name="document-text-outline" size={20} color="#4CAF50" />
              <Text style={styles.exportMenuText}>Als PDF exportieren</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.exportMenuItem}
              onPress={handleExportCSV}
            >
              <Ionicons name="grid-outline" size={20} color="#4CAF50" />
              <Text style={styles.exportMenuText}>Als CSV exportieren</Text>
            </TouchableOpacity>
          </View>
        )}

        <FlatList
          data={callNotes?.notes || []}
          renderItem={renderNoteItem}
          keyExtractor={(item) => item.note_id}
          contentContainerStyle={styles.listContainer}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="document-text-outline" size={80} color="#555" />
              <Text style={styles.emptyText}>Noch keine Notizen</Text>
              <Text style={styles.emptySubtext}>
                Füge deine erste Notiz hinzu
              </Text>
            </View>
          }
        />

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Neue Notiz hinzufügen..."
            placeholderTextColor="#999"
            value={newNoteText}
            onChangeText={setNewNoteText}
            multiline
            maxLength={500}
          />
          <TouchableOpacity
            onPress={handleAddNote}
            style={[
              styles.sendButton,
              !newNoteText.trim() && styles.sendButtonDisabled,
            ]}
            disabled={!newNoteText.trim() || isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="send" size={20} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
  },
  backButton: {
    marginRight: 16,
    padding: 4,
  },
  headerTitleContainer: {
    flex: 1,
  },
  exportButton: {
    padding: 4,
    marginLeft: 8,
  },
  exportMenu: {
    backgroundColor: '#1e1e1e',
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
    padding: 8,
  },
  exportMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
  },
  exportMenuText: {
    color: '#fff',
    fontSize: 16,
    marginLeft: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#999',
    marginTop: 2,
  },
  listContainer: {
    padding: 16,
    flexGrow: 1,
  },
  noteItem: {
    backgroundColor: '#1e1e1e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
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
  },
  actionButton: {
    marginLeft: 16,
    padding: 4,
  },
  noteText: {
    fontSize: 16,
    color: '#fff',
    lineHeight: 22,
  },
  updatedText: {
    fontSize: 11,
    color: '#666',
    marginTop: 8,
    fontStyle: 'italic',
  },
  editInput: {
    backgroundColor: '#2a2a2a',
    color: '#fff',
    fontSize: 16,
    padding: 12,
    borderRadius: 8,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  editActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
  },
  editButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    marginLeft: 8,
  },
  cancelButton: {
    backgroundColor: '#555',
  },
  saveButton: {
    backgroundColor: '#4CAF50',
  },
  editButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#1e1e1e',
    borderTopWidth: 1,
    borderTopColor: '#2a2a2a',
    alignItems: 'flex-end',
  },
  input: {
    flex: 1,
    backgroundColor: '#2a2a2a',
    color: '#fff',
    fontSize: 16,
    padding: 12,
    borderRadius: 24,
    maxHeight: 100,
    marginRight: 8,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#555',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    marginTop: 24,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
  },
});
