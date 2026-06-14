/**
 * QuickNoteModal - Komponente für schnelle Notizerstellung während eines Anrufs
 * 
 * Diese Komponente ermöglicht das schnelle Erfassen von Notizen während eines Anrufs
 * mit minimalem Aufwand. Die Notizen werden automatisch mit der aktuellen Telefonnummer
 * verknüpft.
 * 
 * WICHTIG: Es werden NUR Nutzer-Notizen erfasst, KEINE Anrufpartner-Daten!
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Modal,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { createNote, validatePhoneNumber } from '../utils/database';
import { createCRMNote, getConfig } from '../utils/crmService';
import {
  isUnknownContact,
  setUnknownContactNote,
  getContactName,
} from '../utils/contactNotesService';

interface QuickNoteModalProps {
  visible: boolean;
  onClose: () => void;
  phoneNumber?: string;
  onNoteCreated?: (noteText: string, phoneNumber: string) => void;
  callDirection?: 'incoming' | 'outgoing';
  allowContactNote?: boolean; // Erlaubt das Hinterlegen eines Vermerks zur Nummer
}

interface NoteTemplate {
  id: string;
  label: string;
  text: string;
  icon: string;
}

const QuickNoteModal: React.FC<QuickNoteModalProps> = ({
  visible,
  onClose,
  phoneNumber: initialPhoneNumber,
  onNoteCreated,
  callDirection,
  allowContactNote = true,
}) => {
  const [noteText, setNoteText] = useState('');
  const [phoneNumber, setPhoneNumber] = useState(initialPhoneNumber || '');
  const [isCreating, setIsCreating] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [crmEnabled, setCrmEnabled] = useState(false);
  const [isUnknown, setIsUnknown] = useState(false);
  const [contactName, setContactName] = useState<string | null>(null);
  const [contactNote, setContactNote] = useState('');
  const [showContactNoteInput, setShowContactNoteInput] = useState(false);

  // Notiz-Vorlagen für schnelles Erfassen
  const noteTemplates: NoteTemplate[] = [
    {
      id: 'callback',
      label: 'Rückruf vereinbart',
      text: 'Rückruf vereinbart für ', // Wird mit Datum ergänzt
      icon: 'call-outline',
    },
    {
      id: 'info_request',
      label: 'Info angefragt',
      text: 'Informationen angefragt zu: ',
      icon: 'information-circle-outline',
    },
    {
      id: 'offer',
      label: 'Angebot besprochen',
      text: 'Angebot besprochen - Details: ',
      icon: 'document-text-outline',
    },
    {
      id: 'complaint',
      label: 'Beschwerde',
      text: 'Kunde beschwert sich über: ',
      icon: 'alert-circle-outline',
    },
    {
      id: 'question',
      label: 'Frage notiert',
      text: 'Frage: ',
      icon: 'help-circle-outline',
    },
    {
      id: 'followup',
      label: 'Follow-up nötig',
      text: 'Follow-up nötig bis: ',
      icon: 'calendar-outline',
    },
  ];

  // Prüfe, ob CRM aktiviert ist und ob die Nummer unbekannt ist
  useEffect(() => {
    const checkStatus = async () => {
      const config = getConfig();
      setCrmEnabled(config.enabled);
      
      if (phoneNumber) {
        const unknown = await isUnknownContact(phoneNumber);
        setIsUnknown(unknown);
        
        if (unknown && allowContactNote) {
          setShowContactNoteInput(true);
        }
        
        const name = await getContactName(phoneNumber);
        setContactName(name);
      }
    };
    checkStatus();
  }, [phoneNumber, allowContactNote]);

  // Aktualisiere Telefonnummer, wenn sich Props ändern
  useEffect(() => {
    if (initialPhoneNumber) {
      setPhoneNumber(initialPhoneNumber);
    }
  }, [initialPhoneNumber]);

  // Template auswählen
  const selectTemplate = useCallback((template: NoteTemplate) => {
    let templateText = template.text;
    
    // Für Rückruf-Vorlage: aktuelles Datum einfügen
    if (template.id === 'callback' || template.id === 'followup') {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      templateText += tomorrow.toLocaleDateString('de-DE');
    }
    
    setNoteText(prev => prev ? `${prev}\n${templateText}` : templateText);
    setShowTemplates(false);
  }, []);

  // Notiz erstellen
  const createQuickNote = useCallback(async () => {
    if (!noteText.trim()) {
      Alert.alert('Hinweis', 'Bitte geben Sie einen Notiztext ein');
      return;
    }

    // Falls keine Telefonnummer angegeben, frage nach
    let finalPhoneNumber = phoneNumber;
    if (!finalPhoneNumber.trim()) {
      Alert.alert(
        'Telefonnummer fehlt',
        'Möchten Sie eine Telefonnummer für diese Notiz angeben?',
        [
          { text: 'Abbrechen', style: 'cancel' },
          {
            text: 'Ohne Telefonnummer speichern',
            onPress: async () => {
              await saveNote('');
            },
          },
          {
            text: 'Telefonnummer eingeben',
            onPress: () => {
              // Öffne Modal zur Eingabe
              Alert.prompt(
                'Telefonnummer',
                'Bitte geben Sie die Telefonnummer ein',
                [
                  { text: 'Abbrechen', style: 'cancel' },
                  {
                    text: 'OK',
                    onPress: async (text) => {
                      if (text && validatePhoneNumber(text)) {
                        await saveNote(text);
                      } else {
                        Alert.alert('Fehler', 'Bitte geben Sie eine gültige Telefonnummer ein');
                      }
                    },
                  },
                ],
                'plain-text',
                phoneNumber
              );
            },
          },
        ]
      );
      return;
    }

    await saveNote(finalPhoneNumber);
  }, [noteText, phoneNumber]);

  // Notiz speichern
  const saveNote = async (finalPhoneNumber: string) => {
    try {
      setIsCreating(true);
      
      // Bereinige die Telefonnummer
      let cleanedPhoneNumber = finalPhoneNumber.replace(/[^\d+]/g, '');
      
      // Falls keine Ländervorwahl, füge +49 hinzu (Deutschland)
      if (!cleanedPhoneNumber.startsWith('+') && cleanedPhoneNumber.length >= 10) {
        cleanedPhoneNumber = `+49${cleanedPhoneNumber.substring(1)}`;
      }

      // Falls ein Vermerk zur Nummer hinterlegt wurde, speichere diesen
      if (contactNote.trim() && allowContactNote) {
        await setUnknownContactNote(cleanedPhoneNumber, contactNote);
      }

      // Erstelle Notiz in lokaler DB
      const newNote = await createNote(cleanedPhoneNumber, noteText);
      
      // Falls CRM aktiviert ist, synchronisiere auch dorthin
      if (crmEnabled && cleanedPhoneNumber) {
        try {
          // Suche nach Kontakt im CRM
          // In echter Implementierung: Kontakt-ID aus CRM holen
          const contactId = cleanedPhoneNumber; // Vereinfacht: Telefonnummer als ID
          await createCRMNote(contactId, noteText, cleanedPhoneNumber);
        } catch (crmError) {
          console.warn('CRM-Synchronisation fehlgeschlagen:', crmError);
          // Nicht als Fehler behandeln - Notiz wurde lokal gespeichert
        }
      }

      // Callback aufrufen
      if (onNoteCreated) {
        onNoteCreated(noteText, cleanedPhoneNumber);
      }

      // Zurücksetzen und schließen
      setNoteText('');
      setContactNote('');
      setShowContactNoteInput(false);
      onClose();
      
    } catch (error) {
      console.error('Fehler beim Erstellen der Notiz:', error);
      Alert.alert('Fehler', 'Notiz konnte nicht erstellt werden');
    } finally {
      setIsCreating(false);
    }
  };

  // Anrufrichtung anzeigen
  const getCallDirectionText = () => {
    switch (callDirection) {
      case 'incoming':
        return 'Eingehender Anruf';
      case 'outgoing':
        return 'Ausgehender Anruf';
      default:
        return 'Anruf';
    }
  };

  // Formatierung der Telefonnummer für die Anzeige
  const formatPhoneNumber = (phone: string): string => {
    if (!phone) return 'Unbekannte Nummer';
    return phone.replace(/[\s-]/g, '');
  };

  // Formatierung mit Kontaktnamen
  const formatPhoneNumberWithContact = (phone: string): string => {
    if (contactName) {
      return `${contactName} (${formatPhoneNumber(phone)})`;
    }
    if (isUnknown) {
      return `${formatPhoneNumber(phone)} (Unbekannt)`;
    }
    return formatPhoneNumber(phone);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalContainer}
      >
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>
              {getCallDirectionText()}
            </Text>
            {phoneNumber && (
              <Text style={styles.phoneNumber}>
                {formatPhoneNumberWithContact(phoneNumber)}
              </Text>
            )}
            <TouchableOpacity style={styles.closeButton} onPress={onClose} disabled={isCreating}>
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          {/* Notiz-Eingabe */}
          <View style={styles.inputContainer}>
            {/* Vermerk zur Nummer (für unbekannte Nummern) */}
            {showContactNoteInput && isUnknown && (
              <View style={styles.contactNoteContainer}>
                <Text style={styles.contactNoteLabel}>
                  Vermerk zur Nummer (optional):
                </Text>
                <TextInput
                  style={[styles.noteInput, styles.contactNoteInput]}
                  placeholder="z.B. 'Kunde XY', 'Unbekannte Nummer - Rückruf vereinbart'"
                  value={contactNote}
                  onChangeText={setContactNote}
                  editable={!isCreating}
                />
              </View>
            )}
            
            <TextInput
              style={styles.noteInput}
              placeholder="Schnelle Notiz eingeben... (z.B. 'Rückruf vereinbart', 'Info angefragt')"
              value={noteText}
              onChangeText={setNoteText}
              multiline
              autoFocus
              editable={!isCreating}
              textAlignVertical="top"
            />

            {/* Wortanzahl */}
            <Text style={styles.wordCount}>
              {noteText.trim() ? `${noteText.trim().split(/\s+/).length} Wörter` : '0 Wörter'}
            </Text>
          </View>

          {/* Template-Buttons */}
          {!showTemplates && noteText.length === 0 && (
            <View style={styles.templatesPreview}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {noteTemplates.slice(0, 4).map(template => (
                  <TouchableOpacity
                    key={template.id}
                    style={styles.templateButton}
                    onPress={() => selectTemplate(template)}
                  >
                    <Ionicons name={template.icon as any} size={20} color="#007AFF" />
                    <Text style={styles.templateButtonText}>{template.label}</Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity
                  style={styles.templateButton}
                  onPress={() => setShowTemplates(true)}
                >
                  <Ionicons name="apps" size={20} color="#007AFF" />
                  <Text style={styles.templateButtonText}>Alle</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          )}

          {/* Alle Templates anzeigen */}
          {showTemplates && (
            <View style={styles.templatesFull}>
              <ScrollView showsVerticalScrollIndicator={true}>
                <View style={styles.templatesGrid}>
                  {noteTemplates.map(template => (
                    <TouchableOpacity
                      key={template.id}
                      style={styles.templateFullButton}
                      onPress={() => selectTemplate(template)}
                    >
                      <Ionicons name={template.icon as any} size={24} color="#007AFF" />
                      <Text style={styles.templateFullButtonText}>{template.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => setShowTemplates(false)}
              >
                <Ionicons name="arrow-back" size={20} color="#666" />
                <Text style={styles.backButtonText}>Zurück</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Aktionsbuttons */}
          {!showTemplates && (
            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.actionButton, styles.cancelButton]}
                onPress={onClose}
                disabled={isCreating}
              >
                <Text style={styles.cancelButtonText}>Abbrechen</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, styles.saveButton]}
                onPress={createQuickNote}
                disabled={isCreating || !noteText.trim()}
              >
                {isCreating ? (
                  <Text style={styles.saveButtonText}>Speichern...</Text>
                ) : (
                  <Text style={styles.saveButtonText}>
                    Notiz speichern
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* CRM-Hinweis */}
          {crmEnabled && (
            <View style={styles.crmNotice}>
              <Ionicons name="cloud-upload-outline" size={16} color="#007AFF" />
              <Text style={styles.crmNoticeText}>
                Notizen werden mit CRM synchronisiert
              </Text>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
  },
  modalContent: {
    flex: 1,
    backgroundColor: '#fff',
    marginTop: Platform.OS === 'ios' ? 60 : 20,
    marginBottom: Platform.OS === 'ios' ? 60 : 20,
    marginHorizontal: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  phoneNumber: {
    fontSize: 16,
    color: '#007AFF',
    marginRight: 8,
  },
  closeButton: {
    padding: 4,
  },
  inputContainer: {
    flex: 1,
    padding: 16,
  },
  noteInput: {
    flex: 1,
    fontSize: 16,
    lineHeight: 24,
    color: '#333',
    textAlignVertical: 'top',
  },
  wordCount: {
    fontSize: 12,
    color: '#999',
    marginTop: 8,
    textAlign: 'right',
  },
  templatesPreview: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  templateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
  },
  templateButtonText: {
    fontSize: 12,
    color: '#333',
    marginLeft: 4,
  },
  templatesFull: {
    flex: 1,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  templatesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  templateFullButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    width: '48%',
  },
  templateFullButtonText: {
    fontSize: 14,
    color: '#333',
    marginLeft: 8,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginTop: 8,
  },
  backButtonText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 4,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    gap: 12,
  },
  actionButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    minWidth: 120,
  },
  cancelButton: {
    backgroundColor: '#f0f0f0',
  },
  cancelButtonText: {
    color: '#333',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  saveButton: {
    backgroundColor: '#007AFF',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  crmNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#e3f2fd',
    borderRadius: 8,
    margin: 16,
  },
  crmNoticeText: {
    fontSize: 12,
    color: '#007AFF',
    marginLeft: 8,
  },
  contactNoteContainer: {
    marginBottom: 12,
    padding: 12,
    backgroundColor: '#fff8e1',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ffc107',
  },
  contactNoteLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#ff9800',
    marginBottom: 8,
  },
  contactNoteInput: {
    minHeight: 40,
    fontSize: 14,
  },
});

export default QuickNoteModal;
