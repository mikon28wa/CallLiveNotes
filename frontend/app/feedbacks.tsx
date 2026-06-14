/**
 * Feedbacks Screen - Rückmeldungsverwaltung
 * 
 * Dieser Bildschirm zeigt alle Rückmeldungen an und ermöglicht:
 * - Erstellen neuer Rückmeldungen
 * - Bearbeiten bestehender Rückmeldungen
 * - Markieren als erledigt
 * - Sortierung und Filterung
 * - Termin-Kollisionsprüfung
 * 
 * WICHTIG: Es werden NUR Nutzer-Rückmeldungen (aus dem Telefonbuch) angezeigt!
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Platform,
  Modal,
  KeyboardAvoidingView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  Feedback,
  getAllFeedbacks,
  createFeedback,
  updateFeedback,
  deleteFeedback,
  completeFeedback,
  checkFeedbackCollision,
  getFeedbackStats,
  FeedbackFilter,
  FeedbackStats,
} from '../utils/feedbackService';
import {
  startSpeechRecognition,
  stopSpeechRecognition,
  isSpeechAvailable,
  getSpeechStatus,
  getCurrentText,
  resetSpeechText,
  setOnResultCallback,
  setOnStatusCallback,
  setOnErrorCallback,
  SpeechStatus,
} from '../utils/speechService';
import DateTimePicker from '@react-native-community/datetimepicker';

const FeedbacksScreen: React.FC = () => {
  const router = useRouter();
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FeedbackFilter>({
    status: 'all',
    priority: 'all',
    sortBy: 'due_date',
    sortOrder: 'asc',
  });
  const [stats, setStats] = useState<FeedbackStats | null>(null);
  
  // Modal für neue/bearbeitete Rückmeldung
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [editingFeedback, setEditingFeedback] = useState<Feedback | null>(null);
  const [formData, setFormData] = useState({
    phone_number: '',
    title: '',
    description: '',
    reason: '',
    due_date: '',
    due_time: '',
    priority: 'medium' as const,
  });
  
  // Spracherkennung
  const [speechAvailable, setSpeechAvailable] = useState(false);
  const [speechStatus, setSpeechStatus] = useState<SpeechStatus>('idle');
  const [speechText, setSpeechText] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [collisionWarning, setCollisionWarning] = useState<string | null>(null);

  // Lade Rückmeldungen
  const loadFeedbacks = useCallback(async () => {
    try {
      setLoading(true);
      const [allFeedbacks, feedbackStats] = await Promise.all([
        getAllFeedbacks(filter),
        getFeedbackStats(),
      ]);
      setFeedbacks(allFeedbacks);
      setStats(feedbackStats);
    } catch (error) {
      console.error('Fehler beim Laden der Rückmeldungen:', error);
      Alert.alert('Fehler', 'Rückmeldungen konnten nicht geladen werden');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    loadFeedbacks();
  }, [loadFeedbacks]);

  // Initialisiere Spracherkennung
  useEffect(() => {
    const initSpeech = async () => {
      const available = await isSpeechAvailable();
      setSpeechAvailable(available);
      
      if (available) {
        setOnResultCallback((result) => {
          setSpeechText(prev => prev + (result.isFinal ? result.text : ''));
          if (result.isFinal) {
            setFormData(prev => ({ ...prev, description: prev.description + result.text }));
          }
        });
        
        setOnStatusCallback((status) => {
          setSpeechStatus(status);
        });
        
        setOnErrorCallback((error) => {
          Alert.alert('Fehler', `Spracherkennung: ${error}`);
        });
      }
    };
    
    initSpeech();
    
    return () => {
      stopSpeechRecognition();
      resetSpeechText();
    };
  }, []);

  // Filter ändern
  const handleFilterChange = (key: keyof FeedbackFilter, value: any) => {
    setFilter(prev => ({ ...prev, [key]: value }));
  };

  // Neue Rückmeldung erstellen
  const handleCreateFeedback = useCallback(async () => {
    // Validierung
    if (!formData.title.trim()) {
      Alert.alert('Fehler', 'Bitte geben Sie einen Betreff ein');
      return;
    }
    
    if (!formData.phone_number.trim()) {
      Alert.alert('Fehler', 'Bitte geben Sie eine Telefonnummer ein');
      return;
    }
    
    try {
      // Prüfe auf Termin-Kollision
      if (formData.due_date) {
        const collisions = await checkFeedbackCollision(
          formData.due_date,
          formData.due_time || null,
          editingFeedback?.id
        );
        
        if (collisions.length > 0) {
          setCollisionWarning(`Achtung: Es gibt bereits ${collisions.length} Rückmeldung(en) zu diesem Termin!`);
          Alert.alert(
            'Termin-Kollision',
            `Es gibt bereits ${collisions.length} Rückmeldung(en) für ${formData.due_date}${formData.due_time ? ` um ${formData.due_time}` : ''}.\n\nMöchten Sie trotzdem fortfahren?`,
            [
              { text: 'Abbrechen', style: 'cancel' },
              { text: 'Fortfahren', onPress: () => createFeedbackInternal() },
            ]
          );
          return;
        }
      }
      
      await createFeedbackInternal();
      
    } catch (error) {
      console.error('Fehler beim Erstellen der Rückmeldung:', error);
      Alert.alert('Fehler', 'Rückmeldung konnte nicht erstellt werden');
    }
  }, [formData, editingFeedback]);

  const createFeedbackInternal = async () => {
    try {
      const feedback = await createFeedback(
        formData.phone_number,
        formData.title,
        formData.description,
        formData.reason,
        formData.due_date || null,
        formData.due_time || null,
        formData.priority
      );
      
      // Zurücksetzen
      resetForm();
      setShowFeedbackModal(false);
      setCollisionWarning(null);
      
      // Neu laden
      loadFeedbacks();
      
      Alert.alert('Erfolg', 'Rückmeldung wurde erstellt');
      
    } catch (error) {
      console.error('Fehler:', error);
      Alert.alert('Fehler', 'Rückmeldung konnte nicht erstellt werden');
    }
  };

  // Rückmeldung aktualisieren
  const handleUpdateFeedback = useCallback(async () => {
    if (!editingFeedback) return;
    
    try {
      // Prüfe auf Termin-Kollision
      if (formData.due_date) {
        const collisions = await checkFeedbackCollision(
          formData.due_date,
          formData.due_time || null,
          editingFeedback.id
        );
        
        if (collisions.length > 0) {
          setCollisionWarning(`Achtung: Es gibt bereits ${collisions.length} Rückmeldung(en) zu diesem Termin!`);
          Alert.alert(
            'Termin-Kollision',
            `Es gibt bereits ${collisions.length} Rückmeldung(en) für ${formData.due_date}${formData.due_time ? ` um ${formData.due_time}` : ''}.\n\nMöchten Sie trotzdem fortfahren?`,
            [
              { text: 'Abbrechen', style: 'cancel' },
              { text: 'Fortfahren', onPress: () => updateFeedbackInternal() },
            ]
          );
          return;
        }
      }
      
      await updateFeedbackInternal();
      
    } catch (error) {
      console.error('Fehler beim Aktualisieren:', error);
      Alert.alert('Fehler', 'Rückmeldung konnte nicht aktualisiert werden');
    }
  }, [formData, editingFeedback]);

  const updateFeedbackInternal = async () => {
    if (!editingFeedback) return;
    
    try {
      await updateFeedback(editingFeedback.id, {
        title: formData.title,
        description: formData.description,
        reason: formData.reason,
        due_date: formData.due_date || null,
        due_time: formData.due_time || null,
        priority: formData.priority,
      });
      
      // Zurücksetzen
      resetForm();
      setShowFeedbackModal(false);
      setCollisionWarning(null);
      setEditingFeedback(null);
      
      // Neu laden
      loadFeedbacks();
      
      Alert.alert('Erfolg', 'Rückmeldung wurde aktualisiert');
      
    } catch (error) {
      console.error('Fehler:', error);
      Alert.alert('Fehler', 'Rückmeldung konnte nicht aktualisiert werden');
    }
  };

  // Formular zurücksetzen
  const resetForm = () => {
    setFormData({
      phone_number: '',
      title: '',
      description: '',
      reason: '',
      due_date: '',
      due_time: '',
      priority: 'medium',
    });
    setCollisionWarning(null);
    resetSpeechText();
    setSpeechText('');
  };

  // Rückmeldung bearbeiten
  const handleEditFeedback = (feedback: Feedback) => {
    setEditingFeedback(feedback);
    setFormData({
      phone_number: feedback.phone_number,
      title: feedback.title,
      description: feedback.description,
      reason: feedback.reason,
      due_date: feedback.due_date || '',
      due_time: feedback.due_time || '',
      priority: feedback.priority,
    });
    setShowFeedbackModal(true);
  };

  // Rückmeldung löschen
  const handleDeleteFeedback = useCallback(async (feedback: Feedback) => {
    Alert.alert(
      'Rückmeldung löschen',
      `Möchten Sie "${feedback.title}" wirklich löschen?`,
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Löschen',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteFeedback(feedback.id);
              loadFeedbacks();
            } catch (error) {
              console.error('Fehler beim Löschen:', error);
              Alert.alert('Fehler', 'Rückmeldung konnte nicht gelöscht werden');
            }
          },
        },
      ]
    );
  }, [loadFeedbacks]);

  // Rückmeldung als erledigt markieren
  const handleMarkAsCompleted = useCallback(async (feedback: Feedback) => {
    try {
      await completeFeedback(feedback.id);
      loadFeedbacks();
    } catch (error) {
      console.error('Fehler:', error);
      Alert.alert('Fehler', 'Rückmeldung konnte nicht als erledigt markiert werden');
    }
  }, [loadFeedbacks]);

  // Datum auswählen
  const handleDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      const dateStr = selectedDate.toISOString().split('T')[0];
      setFormData(prev => ({ ...prev, due_date: dateStr }));
    }
  };

  // Uhrzeit auswählen
  const handleTimeChange = (event: any, selectedTime?: Date) => {
    setShowTimePicker(Platform.OS === 'ios');
    if (selectedTime) {
      const hours = selectedTime.getHours().toString().padStart(2, '0');
      const minutes = selectedTime.getMinutes().toString().padStart(2, '0');
      setFormData(prev => ({ ...prev, due_time: `${hours}:${minutes}` }));
    }
  };

  // Spracherkennung starten/stoppen
  const toggleSpeechRecognition = () => {
    if (speechStatus === 'listening') {
      stopSpeechRecognition();
      setSpeechStatus('idle');
    } else {
      resetSpeechText();
      startSpeechRecognition();
    }
  };

  // Formatierung
  const formatDate = (dateStr: string | null): string => {
    if (!dateStr) return 'Kein Datum';
    return new Date(dateStr).toLocaleDateString('de-DE');
  };

  const formatTime = (timeStr: string | null): string => {
    if (!timeStr) return '';
    return timeStr;
  };

  const getStatusColor = (status: Feedback['status']): string => {
    switch (status) {
      case 'overdue': return '#dc3545';
      case 'pending': return '#ffc107';
      case 'completed': return '#28a745';
      case 'cancelled': return '#6c757d';
      default: return '#6c757d';
    }
  };

  const getPriorityColor = (priority: Feedback['priority']): string => {
    switch (priority) {
      case 'high': return '#dc3545';
      case 'medium': return '#ffc107';
      case 'low': return '#28a745';
      default: return '#6c757d';
    }
  };

  // Render Feedback-Item
  const renderFeedbackItem = (feedback: Feedback) => (
    <View key={feedback.id} style={styles.feedbackItem}>
      <View style={styles.feedbackHeader}>
        <View style={styles.feedbackPriority}>
          <Text style={[styles.priorityText, { color: getPriorityColor(feedback.priority) }]}>
            {feedback.priority.toUpperCase()}
          </Text>
        </View>
        <View style={styles.feedbackStatus}>
          <View style={[styles.statusDot, { backgroundColor: getStatusColor(feedback.status) }]} />
          <Text style={[styles.statusText, { color: getStatusColor(feedback.status) }]}>
            {feedback.status}
          </Text>
        </View>
      </View>
      
      <View style={styles.feedbackBody}>
        <Text style={styles.feedbackTitle}>{feedback.title}</Text>
        <Text style={styles.feedbackPhone}>{feedback.phone_number}</Text>
        <Text style={styles.feedbackReason}>Grund: {feedback.reason}</Text>
        <Text style={styles.feedbackDescription} numberOfLines={2}>
          {feedback.description}
        </Text>
      </View>
      
      <View style={styles.feedbackFooter}>
        <Text style={styles.feedbackDue}>
          {formatDate(feedback.due_date)} {formatTime(feedback.due_time)}
        </Text>
        <View style={styles.feedbackActions}>
          <TouchableOpacity 
            style={styles.actionButton} 
            onPress={() => handleEditFeedback(feedback)}
          >
            <Ionicons name="create-outline" size={18} color="#007AFF" />
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.actionButton} 
            onPress={() => handleMarkAsCompleted(feedback)}
          >
            <Ionicons name="checkmark-circle" size={18} color="#28a745" />
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.actionButton} 
            onPress={() => handleDeleteFeedback(feedback)}
          >
            <Ionicons name="trash-outline" size={18} color="#dc3545" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  // Render Filter
  const renderFilters = () => (
    <View style={styles.filters}>
      <View style={styles.filterGroup}>
        <Text style={styles.filterLabel}>Status:</Text>
        {(['all', 'pending', 'overdue', 'completed', 'cancelled'] as const).map(status => (
          <TouchableOpacity
            key={status}
            style={[
              styles.filterButton,
              filter.status === status && styles.filterButtonActive,
            ]}
            onPress={() => handleFilterChange('status', status)}
          >
            <Text style={[
              styles.filterButtonText,
              filter.status === status && styles.filterButtonTextActive,
            ]}>
              {status === 'all' ? 'Alle' : status.charAt(0).toUpperCase() + status.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      
      <View style={styles.filterGroup}>
        <Text style={styles.filterLabel}>Priorität:</Text>
        {(['all', 'high', 'medium', 'low'] as const).map(priority => (
          <TouchableOpacity
            key={priority}
            style={[
              styles.filterButton,
              filter.priority === priority && styles.filterButtonActive,
            ]}
            onPress={() => handleFilterChange('priority', priority)}
          >
            <Text style={[
              styles.filterButtonText,
              filter.priority === priority && styles.filterButtonTextActive,
            ]}>
              {priority === 'all' ? 'Alle' : priority.charAt(0).toUpperCase() + priority.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      
      <View style={styles.filterGroup}>
        <Text style={styles.filterLabel}>Sortieren:</Text>
        <TouchableOpacity
          style={[styles.filterButton, filter.sortBy === 'due_date' && styles.filterButtonActive]}
          onPress={() => handleFilterChange('sortBy', 'due_date')}
        >
          <Text style={[styles.filterButtonText, filter.sortBy === 'due_date' && styles.filterButtonTextActive]}>
            Datum
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, filter.sortBy === 'priority' && styles.filterButtonActive]}
          onPress={() => handleFilterChange('sortBy', 'priority')}
        >
          <Text style={[styles.filterButtonText, filter.sortBy === 'priority' && styles.filterButtonTextActive]}>
            Priorität
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, filter.sortBy === 'title' && styles.filterButtonActive]}
          onPress={() => handleFilterChange('sortBy', 'title')}
        >
          <Text style={[styles.filterButtonText, filter.sortBy === 'title' && styles.filterButtonTextActive]}>
            Betreff
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.filterButton}
          onPress={() => handleFilterChange('sortOrder', filter.sortOrder === 'asc' ? 'desc' : 'asc')}
        >
          <Ionicons name={filter.sortOrder === 'asc' ? 'arrow-up' : 'arrow-down'} size={16} color="#007AFF" />
        </TouchableOpacity>
      </View>
    </View>
  );

  // Render Feedback Modal
  const renderFeedbackModal = () => (
    <Modal
      visible={showFeedbackModal}
      animationType="slide"
      transparent={true}
      onRequestClose={() => {
        resetForm();
        setShowFeedbackModal(false);
        setEditingFeedback(null);
      }}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalContainer}
      >
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {editingFeedback ? 'Rückmeldung bearbeiten' : 'Neue Rückmeldung'}
            </Text>
            <TouchableOpacity
              style={styles.modalClose}
              onPress={() => {
                resetForm();
                setShowFeedbackModal(false);
                setEditingFeedback(null);
              }}
            >
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.modalBody}>
            {/* Telefonnummer */}
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Telefonnummer *</Text>
              <TextInput
                style={styles.formInput}
                value={formData.phone_number}
                onChangeText={(text) => setFormData(prev => ({ ...prev, phone_number: text }))}
                placeholder="Telefonnummer aus Kontakten"
                keyboardType="phone-pad"
              />
            </View>
            
            {/* Betreff */}
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Betreff *</Text>
              <TextInput
                style={styles.formInput}
                value={formData.title}
                onChangeText={(text) => setFormData(prev => ({ ...prev, title: text }))}
                placeholder="z.B. Rückruf vereinbart"
              />
            </View>
            
            {/* Grund */}
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Grund</Text>
              <TextInput
                style={styles.formInput}
                value={formData.reason}
                onChangeText={(text) => setFormData(prev => ({ ...prev, reason: text }))}
                placeholder="z.B. Angebot angefragt, Beschwerde, etc."
              />
            </View>
            
            {/* Beschreibung */}
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Beschreibung</Text>
              <View style={styles.descriptionInputContainer}>
                <TextInput
                  style={[styles.formInput, styles.descriptionInput]}
                  value={formData.description}
                  onChangeText={(text) => setFormData(prev => ({ ...prev, description: text }))}
                  placeholder="Detaillierte Beschreibung..."
                  multiline
                  textAlignVertical="top"
                />
                {speechAvailable && (
                  <TouchableOpacity
                    style={[styles.speechButton, speechStatus === 'listening' && styles.speechButtonActive]}
                    onPress={toggleSpeechRecognition}
                  >
                    <Ionicons 
                      name={speechStatus === 'listening' ? 'mic-off' : 'mic'} 
                      size={20} 
                      color={speechStatus === 'listening' ? '#dc3545' : '#007AFF'}
                    />
                  </TouchableOpacity>
                )}
              </View>
              {speechStatus === 'listening' && (
                <Text style={styles.speechStatusText}>Hört zu...</Text>
              )}
            </View>
            
            {/* Fälligkeitsdatum */}
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Fälligkeitsdatum</Text>
              <TouchableOpacity
                style={styles.formInput}
                onPress={() => setShowDatePicker(true)}
              >
                <Text style={formData.due_date ? styles.formInputText : styles.formInputPlaceholder}>
                  {formData.due_date ? formatDate(formData.due_date) : 'Datum auswählen'}
                </Text>
              </TouchableOpacity>
            </View>
            
            {/* Fälligkeitszeit */}
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Fälligkeitszeit</Text>
              <TouchableOpacity
                style={styles.formInput}
                onPress={() => setShowTimePicker(true)}
              >
                <Text style={formData.due_time ? styles.formInputText : styles.formInputPlaceholder}>
                  {formData.due_time || 'Zeit auswählen'}
                </Text>
              </TouchableOpacity>
            </View>
            
            {/* Priorität */}
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Priorität</Text>
              <View style={styles.prioritySelector}>
                {(['high', 'medium', 'low'] as const).map(priority => (
                  <TouchableOpacity
                    key={priority}
                    style={[
                      styles.priorityButton,
                      formData.priority === priority && styles.priorityButtonActive,
                      { borderColor: getPriorityColor(priority) },
                    ]}
                    onPress={() => setFormData(prev => ({ ...prev, priority }))}
                  >
                    <Text style={[
                      styles.priorityButtonText,
                      formData.priority === priority && { color: getPriorityColor(priority) },
                    ]}>
                      {priority.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            
            {/* Kollisionswarnung */}
            {collisionWarning && (
              <View style={styles.warningContainer}>
                <Ionicons name="alert-circle" size={16} color="#ffc107" />
                <Text style={styles.warningText}>{collisionWarning}</Text>
              </View>
            )}
          </ScrollView>
          
          <View style={styles.modalActions}>
            <TouchableOpacity
              style={[styles.actionButton, styles.cancelButton]}
              onPress={() => {
                resetForm();
                setShowFeedbackModal(false);
                setEditingFeedback(null);
              }}
            >
              <Text style={styles.cancelButtonText}>Abbrechen</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.saveButton]}
              onPress={editingFeedback ? handleUpdateFeedback : handleCreateFeedback}
              disabled={!formData.title.trim() || !formData.phone_number.trim()}
            >
              <Text style={styles.saveButtonText}>
                {editingFeedback ? 'Speichern' : 'Erstellen'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );

  // Render Statistik
  const renderStats = () => {
    if (!stats) return null;
    
    return (
      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{stats.overdue}</Text>
          <Text style={styles.statLabel}>Überfällig</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{stats.pending}</Text>
          <Text style={styles.statLabel}>Ausstehend</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{stats.completed}</Text>
          <Text style={styles.statLabel}>Erledigt</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{stats.total}</Text>
          <Text style={styles.statLabel}>Gesamt</Text>
        </View>
      </View>
    );
  };

  // Date/Time Picker
  const renderDateTimePickers = () => (
    <>
      {showDatePicker && (
        <DateTimePicker
          value={formData.due_date ? new Date(formData.due_date) : new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleDateChange}
          locale="de-DE"
        />
      )}
      {showTimePicker && (
        <DateTimePicker
          value={formData.due_time ? new Date(`1970-01-01T${formData.due_time}`) : new Date()}
          mode="time"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleTimeChange}
          locale="de-DE"
          is24Hour={true}
        />
      )}
    </>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Rückmeldungen</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => {
            resetForm();
            setEditingFeedback(null);
            setShowFeedbackModal(true);
          }}
        >
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Statistik */}
      {renderStats()}

      {/* Filter */}
      {renderFilters()}

      {/* Inhalt */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Lade Rückmeldungen...</Text>
        </View>
      ) : feedbacks.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="clipboard-outline" size={48} color="#ccc" />
          <Text style={styles.emptyText}>Keine Rückmeldungen gefunden</Text>
          <Text style={styles.emptySubtext}>
            Tippen Sie auf + um eine neue Rückmeldung zu erstellen
          </Text>
        </View>
      ) : (
        <ScrollView style={styles.content}>
          {feedbacks.map(renderFeedbackItem)}
        </ScrollView>
      )}

      {/* Feedback Modal */}
      {renderFeedbackModal()}

      {/* Date/Time Picker */}
      {renderDateTimePickers()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#007AFF',
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  addButton: {
    padding: 4,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  filters: {
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  filterGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    flexWrap: 'wrap',
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginRight: 8,
  },
  filterButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
    marginRight: 8,
    marginBottom: 4,
  },
  filterButtonActive: {
    backgroundColor: '#007AFF',
  },
  filterButtonText: {
    fontSize: 12,
    color: '#333',
  },
  filterButtonTextActive: {
    color: '#fff',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  feedbackItem: {
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
  feedbackHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  feedbackPriority: {
    alignItems: 'center',
  },
  priorityText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  feedbackStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
  },
  feedbackBody: {
    marginBottom: 8,
  },
  feedbackTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  feedbackPhone: {
    fontSize: 14,
    color: '#007AFF',
    marginBottom: 4,
  },
  feedbackReason: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  feedbackDescription: {
    fontSize: 14,
    color: '#666',
  },
  feedbackFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  feedbackDue: {
    fontSize: 12,
    color: '#666',
  },
  feedbackActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    padding: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginTop: 8,
  },
  modalContainer: {
    flex: 1,
  },
  modalContent: {
    flex: 1,
    backgroundColor: '#fff',
    margin: 20,
    borderRadius: 12,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  modalClose: {
    padding: 4,
  },
  modalBody: {
    flex: 1,
    padding: 16,
  },
  formGroup: {
    marginBottom: 16,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
  },
  formInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    backgroundColor: '#fff',
  },
  formInputText: {
    fontSize: 14,
    color: '#333',
  },
  formInputPlaceholder: {
    fontSize: 14,
    color: '#999',
  },
  descriptionInputContainer: {
    position: 'relative',
  },
  descriptionInput: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  speechButton: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    padding: 8,
    backgroundColor: '#f0f0f0',
    borderRadius: 20,
  },
  speechButtonActive: {
    backgroundColor: '#ffebee',
  },
  speechStatusText: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    fontStyle: 'italic',
  },
  prioritySelector: {
    flexDirection: 'row',
    gap: 8,
  },
  priorityButton: {
    flex: 1,
    padding: 10,
    borderWidth: 2,
    borderRadius: 8,
    alignItems: 'center',
  },
  priorityButtonActive: {
    backgroundColor: '#f0f0f0',
  },
  priorityButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  warningContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    backgroundColor: '#fff3cd',
    borderRadius: 8,
    marginBottom: 16,
  },
  warningText: {
    fontSize: 14,
    color: '#856404',
    flex: 1,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    gap: 12,
  },
  cancelButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
  },
  cancelButtonText: {
    color: '#333',
    fontSize: 14,
    fontWeight: '500',
  },
  saveButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#007AFF',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
});

export default FeedbacksScreen;
