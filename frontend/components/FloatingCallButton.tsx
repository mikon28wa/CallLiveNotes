import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { createNote, validatePhoneNumber } from '../utils/database';
import { Ionicons } from '@expo/vector-icons';

const FloatingCallButton: React.FC = () => {
  const navigation = useNavigation();
  const [modalVisible, setModalVisible] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [noteText, setNoteText] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const createManualNote = async () => {
    if (!phoneNumber.trim() || !noteText.trim()) {
      Alert.alert('Fehler', 'Bitte geben Sie Telefonnummer und Notiztext ein');
      return;
    }
    
    // Validierung der Telefonnummer
    if (!validatePhoneNumber(phoneNumber) && !/^[\d\s\-\+\\(\)]{8,20}$/.test(phoneNumber)) {
      Alert.alert('Ungültige Telefonnummer', 'Bitte geben Sie eine gültige Telefonnummer ein');
      return;
    }
    
    try {
      setIsCreating(true);
      
      // Bereinige die Telefonnummer
      let cleanedPhoneNumber = phoneNumber.replace(/[^\d+]/g, '');
      
      // Falls keine Ländervorwahl, füge +49 hinzu (Deutschland)
      if (!cleanedPhoneNumber.startsWith('+') && cleanedPhoneNumber.length >= 10) {
        cleanedPhoneNumber = `+49${cleanedPhoneNumber.substring(1)}`;
      }
      
      // Erstelle die Notiz
      await createNote(cleanedPhoneNumber, noteText);
      
      // Schließe Modal und setze Felder zurück
      setModalVisible(false);
      setPhoneNumber('');
      setNoteText('');
      
      // Navigiere zur Detailansicht
      // @ts-ignore - Navigation wird durch Expo Router gehandhabt
      navigation.navigate('note-detail', { phoneNumber: cleanedPhoneNumber });
    } catch (error) {
      console.error('Fehler beim Erstellen der Notiz:', error);
      Alert.alert('Fehler', 'Notiz konnte nicht erstellt werden');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <>
      <TouchableOpacity style={styles.fab} onPress={() => setModalVisible(true)}>
        <Ionicons name="add" size={28} color="white" />
      </TouchableOpacity>
      
      {modalVisible && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Neue Notiz erstellen</Text>
            
            <TextInput
              style={styles.input}
              placeholder="Telefonnummer"
              value={phoneNumber}
              onChangeText={setPhoneNumber}
              keyboardType="phone-pad"
              editable={!isCreating}
            />
            
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Notiztext"
              value={noteText}
              onChangeText={setNoteText}
              multiline
              editable={!isCreating}
            />
            
            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={styles.cancelButton} 
                onPress={() => setModalVisible(false)} 
                disabled={isCreating}
              >
                <Text style={styles.cancelButtonText}>Abbrechen</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.createButton} 
                onPress={createManualNote} 
                disabled={isCreating || !phoneNumber.trim() || !noteText.trim()}
              >
                {isCreating ? (
                  <Text style={styles.createButtonText}>Erstellen...</Text>
                ) : (
                  <Text style={styles.createButtonText}>Notiz erstellen</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </>
  );
};

// Styles
const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  modalContent: {
    backgroundColor: '#fff',
    margin: 20,
    borderRadius: 12,
    padding: 20,
    width: '80%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 20,
    textAlign: 'center',
    color: '#333',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 20,
  },
  cancelButton: {
    padding: 12,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
  },
  cancelButtonText: {
    color: '#333',
    fontSize: 14,
    fontWeight: '500',
  },
  createButton: {
    padding: 12,
    backgroundColor: '#007AFF',
    borderRadius: 8,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
});

export default FloatingCallButton;
