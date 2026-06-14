/**
 * WorkModeDisplay - Arbeitsmodus-Anzeige für ausstehende Rückmeldungen
 * 
 * Diese Komponente zeigt nicht telefonierte Rückmeldungen prominent an,
 * um die Vergesslichkeit zu reduzieren und die Qualität der Absprachen zu erhöhen.
 * 
 * WICHTIG: Es werden NUR Nutzer-Rückmeldungen angezeigt, KEINE Anrufpartner-Daten!
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  Feedback,
  getPendingFeedbacks,
  getOverdueFeedbacks,
  getFeedbacksDueToday,
  completeFeedback,
  getFeedbackStats,
  FeedbackStats,
} from '../utils/feedbackService';
import { getContactName, isUnknownContact } from '../utils/contactNotesService';
import { useNavigation } from '@react-navigation/native';

interface WorkModeDisplayProps {
  visible: boolean;
  onClose: () => void;
  onFeedbackSelect?: (feedback: Feedback) => void;
}

const WorkModeDisplay: React.FC<WorkModeDisplayProps> = ({
  visible,
  onClose,
  onFeedbackSelect,
}) => {
  const navigation = useNavigation();
  const [pendingFeedbacks, setPendingFeedbacks] = useState<Feedback[]>([]);
  const [overdueFeedbacks, setOverdueFeedbacks] = useState<Feedback[]>([]);
  const [dueTodayFeedbacks, setDueTodayFeedbacks] = useState<Feedback[]>([]);
  const [stats, setStats] = useState<FeedbackStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedSection, setExpandedSection] = useState<'overdue' | 'today' | 'pending' | null>(null);
  const [showDetails, setShowDetails] = useState<Feedback | null>(null);

  // Lade Rückmeldungen
  const loadFeedbacks = useCallback(async () => {
    try {
      setLoading(true);
      
      const [pending, overdue, dueToday, feedbackStats] = await Promise.all([
        getPendingFeedbacks(),
        getOverdueFeedbacks(),
        getFeedbacksDueToday(),
        getFeedbackStats(),
      ]);
      
      setPendingFeedbacks(pending);
      setOverdueFeedbacks(overdue);
      setDueTodayFeedbacks(dueToday);
      setStats(feedbackStats);
      
    } catch (error) {
      console.error('Fehler beim Laden der Rückmeldungen:', error);
      Alert.alert('Fehler', 'Rückmeldungen konnten nicht geladen werden');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (visible) {
      loadFeedbacks();
    }
  }, [visible, loadFeedbacks]);

  // Aktualisiere alle 30 Sekunden (für Echtzeit-Anzeige)
  useEffect(() => {
    const interval = setInterval(() => {
      if (visible) {
        loadFeedbacks();
      }
    }, 30000);
    
    return () => clearInterval(interval);
  }, [visible, loadFeedbacks]);

  // Formatierung der Fälligkeitszeit
  const formatDueDateTime = (feedback: Feedback): string => {
    if (!feedback.due_date) return 'Kein Datum';
    
    const dueDate = new Date(feedback.due_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const dueDateStr = dueDate.toLocaleDateString('de-DE');
    const dueTimeStr = feedback.due_time || '';
    
    // Relative Zeitangabe
    if (dueDate.toDateString() === today.toDateString()) {
      return dueTimeStr ? `Heute um ${dueTimeStr}` : 'Heute';
    }
    if (dueDate.toDateString() === tomorrow.toDateString()) {
      return dueTimeStr ? `Morgen um ${dueTimeStr}` : 'Morgen';
    }
    
    return dueTimeStr ? `${dueDateStr} um ${dueTimeStr}` : dueDateStr;
  };

  // Formatierung der Telefonnummer mit Kontaktnamen
  const formatPhoneNumberWithContact = async (phone_number: string): Promise<string> => {
    const contactName = await getContactName(phone_number);
    const isUnknown = await isUnknownContact(phone_number);
    
    if (contactName) {
      return `${contactName} (${phone_number})`;
    }
    if (isUnknown) {
      return `${phone_number} (Unbekannt)`;
    }
    return phone_number;
  };

  // Prioritätsfarbe
  const getPriorityColor = (priority: Feedback['priority']): string => {
    switch (priority) {
      case 'high':
        return '#dc3545'; // Rot
      case 'medium':
        return '#ffc107'; // Gelb
      case 'low':
        return '#28a745'; // Grün
      default:
        return '#6c757d'; // Grau
    }
  };

  // Statusfarbe
  const getStatusColor = (status: Feedback['status']): string => {
    switch (status) {
      case 'overdue':
        return '#dc3545'; // Rot
      case 'pending':
        return '#ffc107'; // Gelb
      case 'completed':
        return '#28a745'; // Grün
      case 'cancelled':
        return '#6c757d'; // Grau
      default:
        return '#6c757d';
    }
  };

  /**
   * Berechnet die Farbe basierend auf der Zeit bis zum Termin
   * - Grün: > 3 Stunden bis zum Termin
   * - Gelb-Grün Gradient: 3 Stunden bis 1.5 Stunden (gelb-grün Mischung)
   * - Gelb: 1.5 Stunden bis 30 Minuten
   * - Blau: 30 Minuten bis Termin
   * - Rot: Nach Termin (überfällig)
   */
  const getTimeBasedColor = (feedback: Feedback): string => {
    if (!feedback.due_date) return '#6c757d'; // Grau wenn kein Datum
    
    const dueDate = new Date(feedback.due_date);
    const now = new Date();
    
    // Wenn due_time vorhanden ist, parsen und zur dueDate hinzufügen
    if (feedback.due_time) {
      const [hours, minutes] = feedback.due_time.split(':');
      dueDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
    } else {
      // Standardmäßig auf Ende des Tages setzen
      dueDate.setHours(23, 59, 59, 999);
    }
    
    const diffMs = dueDate.getTime() - now.getTime();
    const diffMinutes = diffMs / (1000 * 60);
    const diffHours = diffMinutes / 60;
    
    // Überfällig (rot)
    if (diffMs < 0) {
      return '#dc3545';
    }
    
    // 0 bis 30 Minuten vor Termin (blau)
    if (diffMinutes <= 30) {
      return '#007AFF';
    }
    
    // 30 Minuten bis 1.5 Stunden (gelb-blau Übergang)
    if (diffMinutes <= 90) {
      // Lineare Interpolation von blau (#007AFF) zu gelb (#ffc107)
      const ratio = (diffMinutes - 30) / 60; // 0 bis 1
      return interpolateColor('#007AFF', '#ffc107', ratio);
    }
    
    // 1.5 Stunden bis 3 Stunden (gelb-grün Übergang)
    if (diffHours <= 3) {
      // Lineare Interpolation von gelb (#ffc107) zu grün (#28a745)
      const ratio = (diffHours - 1.5) / 1.5; // 0 bis 1
      return interpolateColor('#ffc107', '#28a745', ratio);
    }
    
    // Mehr als 3 Stunden (grün)
    return '#28a745';
  };

  /**
   * Interpoliert zwischen zwei Farben basierend auf einem Ratio (0-1)
   */
  const interpolateColor = (color1: string, color2: string, ratio: number): string => {
    // Clamp ratio zwischen 0 und 1
    ratio = Math.max(0, Math.min(1, ratio));
    
    const hexToRgb = (hex: string): { r: number; g: number; b: number } => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      } : { r: 0, g: 0, b: 0 };
    };
    
    const rgbToHex = (r: number, g: number, b: number): string => {
      return '#' + [r, g, b].map(x => {
        const hex = x.toString(16);
        return hex.length === 1 ? '0' + hex : hex;
      }).join('');
    };
    
    const c1 = hexToRgb(color1);
    const c2 = hexToRgb(color2);
    
    const r = Math.round(c1.r + (c2.r - c1.r) * ratio);
    const g = Math.round(c1.g + (c2.g - c1.g) * ratio);
    const b = Math.round(c1.b + (c2.b - c1.b) * ratio);
    
    return rgbToHex(r, g, b);
  };

  /**
   * Formatiert die verbleibende Zeit bis zum Termin
   */
  const formatTimeRemaining = (feedback: Feedback): string => {
    if (!feedback.due_date) return '';
    
    const dueDate = new Date(feedback.due_date);
    const now = new Date();
    
    if (feedback.due_time) {
      const [hours, minutes] = feedback.due_time.split(':');
      dueDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
    } else {
      dueDate.setHours(23, 59, 59, 999);
    }
    
    const diffMs = dueDate.getTime() - now.getTime();
    
    if (diffMs < 0) {
      return 'Überfällig';
    }
    
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMinutes / 60);
    const remainingMinutes = diffMinutes % 60;
    
    if (diffHours > 0) {
      return `${diffHours}std ${remainingMinutes}min`;
    }
    return `${diffMinutes}min`;
  };

  // Markiere Rückmeldung als erledigt
  const handleComplete = useCallback(async (feedback: Feedback) => {
    try {
      Alert.alert(
        'Rückmeldung erledigt',
        `Möchten Sie "${feedback.title}" als erledigt markieren?`,
        [
          { text: 'Abbrechen', style: 'cancel' },
          {
            text: 'Erledigt',
            style: 'default',
            onPress: async () => {
              await completeFeedback(feedback.id);
              loadFeedbacks();
            },
          },
        ]
      );
    } catch (error) {
      console.error('Fehler beim Markieren als erledigt:', error);
      Alert.alert('Fehler', 'Rückmeldung konnte nicht als erledigt markiert werden');
    }
  }, [loadFeedbacks]);

  // Zeige Details an
  const handleShowDetails = (feedback: Feedback) => {
    setShowDetails(feedback);
  };

  // Navigiere zur Telefonnummer
  const handleNavigateToPhone = (phoneNumber: string) => {
    setShowDetails(null);
    onClose();
    // @ts-ignore - Navigation wird durch Expo Router gehandhabt
    navigation.navigate('note-detail', { phoneNumber });
  };

  // Sortiere nach Priorität (High zuerst)
  const sortByPriority = (feedbacks: Feedback[]): Feedback[] => {
    const priorityOrder = { high: 1, medium: 2, low: 3 };
    return [...feedbacks].sort((a, b) => 
      priorityOrder[a.priority] - priorityOrder[b.priority]
    );
  };

  // Überfällige Rückmeldungen (rot markiert)
  const renderOverdueSection = () => {
    if (overdueFeedbacks.length === 0) return null;
    
    const sorted = sortByPriority(overdueFeedbacks);
    
    return (
      <View style={styles.section}>
        <TouchableOpacity
          style={styles.sectionHeader}
          onPress={() => setExpandedSection(expandedSection === 'overdue' ? null : 'overdue')}
        >
          <View style={styles.sectionHeaderContent}>
            <Ionicons name="alert-circle" size={20} color="#dc3545" />
            <Text style={styles.sectionTitle}>🔴 Überfällig ({sorted.length})</Text>
          </View>
          <Ionicons 
            name={expandedSection === 'overdue' ? 'chevron-up' : 'chevron-down'} 
            size={20} 
            color="#666"
          />
        </TouchableOpacity>
        
        {expandedSection === 'overdue' && (
          <View style={styles.sectionContent}>
            {sorted.map(feedback => (
              <View key={feedback.id} style={[styles.feedbackItem, { borderLeftWidth: 4, borderLeftColor: getTimeBasedColor(feedback) }]}>
                <View style={styles.feedbackPriority}>
                  <Text style={[styles.priorityText, { color: getPriorityColor(feedback.priority) }]}>
                    {feedback.priority.toUpperCase()}
                  </Text>
                </View>
                <View style={styles.feedbackInfo}>
                  <Text style={styles.feedbackTitle}>{feedback.title}</Text>
                  <Text style={styles.feedbackPhone}>
                    {feedback.phone_number} {feedback.is_unknown ? '(Unbekannt)' : ''}
                  </Text>
                  <Text style={[styles.feedbackDue, { color: '#dc3545' }]}>
                    {formatDueDateTime(feedback)} - Überfällig!
                  </Text>
                  <Text style={[styles.feedbackTimeRemaining, { color: getTimeBasedColor(feedback) }]}>
                    {formatTimeRemaining(feedback)}
                  </Text>
                </View>
                <View style={styles.feedbackActions}>
                  <TouchableOpacity 
                    style={styles.actionButton} 
                    onPress={() => handleShowDetails(feedback)}
                  >
                    <Ionicons name="information-circle-outline" size={20} color="#007AFF" />
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={styles.actionButton} 
                    onPress={() => handleComplete(feedback)}
                  >
                    <Ionicons name="checkmark-circle" size={20} color="#28a745" />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>
    );
  };

  // Heute fällige Rückmeldungen
  const renderTodaySection = () => {
    if (dueTodayFeedbacks.length === 0) return null;
    
    const sorted = sortByPriority(dueTodayFeedbacks);
    
    return (
      <View style={styles.section}>
        <TouchableOpacity
          style={styles.sectionHeader}
          onPress={() => setExpandedSection(expandedSection === 'today' ? null : 'today')}
        >
          <View style={styles.sectionHeaderContent}>
            <Ionicons name="calendar" size={20} color="#ffc107" />
            <Text style={styles.sectionTitle}>🟡 Heute fällig ({sorted.length})</Text>
          </View>
          <Ionicons 
            name={expandedSection === 'today' ? 'chevron-up' : 'chevron-down'} 
            size={20} 
            color="#666"
          />
        </TouchableOpacity>
        
        {expandedSection === 'today' && (
          <View style={styles.sectionContent}>
            {sorted.map(feedback => (
              <View key={feedback.id} style={[styles.feedbackItem, { borderLeftWidth: 4, borderLeftColor: getTimeBasedColor(feedback) }]}>
                <View style={styles.feedbackPriority}>
                  <Text style={[styles.priorityText, { color: getPriorityColor(feedback.priority) }]}>
                    {feedback.priority.toUpperCase()}
                  </Text>
                </View>
                <View style={styles.feedbackInfo}>
                  <Text style={styles.feedbackTitle}>{feedback.title}</Text>
                  <Text style={styles.feedbackPhone}>
                    {feedback.phone_number} {feedback.is_unknown ? '(Unbekannt)' : ''}
                  </Text>
                  <Text style={[styles.feedbackDue, { color: getTimeBasedColor(feedback) }]}>
                    Heute {feedback.due_time ? `um ${feedback.due_time}` : ''}
                  </Text>
                  <Text style={[styles.feedbackTimeRemaining, { color: getTimeBasedColor(feedback) }]}>
                    {formatTimeRemaining(feedback)}
                  </Text>
                </View>
                <View style={styles.feedbackActions}>
                  <TouchableOpacity 
                    style={styles.actionButton} 
                    onPress={() => handleShowDetails(feedback)}
                  >
                    <Ionicons name="information-circle-outline" size={20} color="#007AFF" />
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={styles.actionButton} 
                    onPress={() => handleComplete(feedback)}
                  >
                    <Ionicons name="checkmark-circle" size={20} color="#28a745" />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>
    );
  };

  // Ausstehende Rückmeldungen
  const renderPendingSection = () => {
    if (pendingFeedbacks.length === 0) return null;
    
    const sorted = sortByPriority(pendingFeedbacks);
    
    return (
      <View style={styles.section}>
        <TouchableOpacity
          style={styles.sectionHeader}
          onPress={() => setExpandedSection(expandedSection === 'pending' ? null : 'pending')}
        >
          <View style={styles.sectionHeaderContent}>
            <Ionicons name="time" size={20} color="#007AFF" />
            <Text style={styles.sectionTitle}>🟢 Ausstehend ({sorted.length})</Text>
          </View>
          <Ionicons 
            name={expandedSection === 'pending' ? 'chevron-up' : 'chevron-down'} 
            size={20} 
            color="#666"
          />
        </TouchableOpacity>
        
        {expandedSection === 'pending' && (
          <View style={styles.sectionContent}>
            {sorted.map(feedback => (
              <View key={feedback.id} style={[styles.feedbackItem, { borderLeftWidth: 4, borderLeftColor: getTimeBasedColor(feedback) }]}>
                <View style={styles.feedbackPriority}>
                  <Text style={[styles.priorityText, { color: getPriorityColor(feedback.priority) }]}>
                    {feedback.priority.toUpperCase()}
                  </Text>
                </View>
                <View style={styles.feedbackInfo}>
                  <Text style={styles.feedbackTitle}>{feedback.title}</Text>
                  <Text style={styles.feedbackPhone}>
                    {feedback.phone_number} {feedback.is_unknown ? '(Unbekannt)' : ''}
                  </Text>
                  <Text style={[styles.feedbackDue, { color: getTimeBasedColor(feedback) }]}>
                    {formatDueDateTime(feedback)}
                  </Text>
                  <Text style={[styles.feedbackTimeRemaining, { color: getTimeBasedColor(feedback) }]}>
                    {formatTimeRemaining(feedback)}
                  </Text>
                </View>
                <View style={styles.feedbackActions}>
                  <TouchableOpacity 
                    style={styles.actionButton} 
                    onPress={() => handleShowDetails(feedback)}
                  >
                    <Ionicons name="information-circle-outline" size={20} color="#007AFF" />
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={styles.actionButton} 
                    onPress={() => handleComplete(feedback)}
                  >
                    <Ionicons name="checkmark-circle" size={20} color="#28a745" />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>
    );
  };

  // Keine Rückmeldungen
  const renderEmptyState = () => {
    if (loading) {
      return (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Lade Rückmeldungen...</Text>
        </View>
      );
    }
    
    if (overdueFeedbacks.length === 0 && dueTodayFeedbacks.length === 0 && pendingFeedbacks.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Ionicons name="checkmark-circle" size={48} color="#28a745" />
          <Text style={styles.emptyText}>Keine ausstehenden Rückmeldungen</Text>
          <Text style={styles.emptySubtext}>
            Alle Rückmeldungen sind erledigt. Gut gemacht! 🎉
          </Text>
        </View>
      );
    }
    
    return null;
  };

  // Details-Modal
  const renderDetailsModal = () => {
    if (!showDetails) return null;
    
    return (
      <Modal
        visible={!!showDetails}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowDetails(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{showDetails.title}</Text>
              <TouchableOpacity 
                style={styles.modalClose} 
                onPress={() => setShowDetails(null)}
              >
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.modalBody}>
              <View style={styles.detailRow}>
                <Ionicons name="phone" size={18} color="#666" />
                <Text style={styles.detailText}>{showDetails.phone_number}</Text>
              </View>
              
              <View style={styles.detailRow}>
                <Ionicons name="calendar" size={18} color="#666" />
                <Text style={styles.detailText}>{formatDueDateTime(showDetails)}</Text>
              </View>
              
              <View style={styles.detailRow}>
                <Ionicons name="flag" size={18} color={getPriorityColor(showDetails.priority)} />
                <Text style={[styles.detailText, { color: getPriorityColor(showDetails.priority) }]}>
                  Priorität: {showDetails.priority}
                </Text>
              </View>
              
              <View style={styles.detailRow}>
                <Ionicons name="information-circle" size={18} color="#666" />
                <Text style={styles.detailText}>Grund: {showDetails.reason}</Text>
              </View>
              
              <View style={styles.detailSection}>
                <Text style={styles.detailSectionTitle}>Beschreibung:</Text>
                <Text style={styles.detailDescription}>{showDetails.description}</Text>
              </View>
              
              <View style={styles.detailSection}>
                <Text style={styles.detailSectionTitle}>Erstellt:</Text>
                <Text style={styles.detailText}>{new Date(showDetails.created_at).toLocaleString('de-DE')}</Text>
              </View>
            </ScrollView>
            
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalActionButton, styles.cancelButton]}
                onPress={() => setShowDetails(null)}
              >
                <Text style={styles.cancelButtonText}>Schließen</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalActionButton, styles.completeButton]}
                onPress={() => {
                  setShowDetails(null);
                  handleComplete(showDetails);
                }}
              >
                <Text style={styles.completeButtonText}>Erledigt</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalActionButton, styles.navigateButton]}
                onPress={() => handleNavigateToPhone(showDetails.phone_number)}
              >
                <Ionicons name="call" size={20} color="#fff" />
                <Text style={styles.navigateButtonText}>Anrufen</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  // Statistik-Anzeige
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

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>📋 Arbeitsmodus - Rückmeldungen</Text>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Ionicons name="close" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Statistik */}
        {renderStats()}

        {/* Inhalt */}
        <ScrollView style={styles.content}>
          {renderEmptyState()}
          {renderOverdueSection()}
          {renderTodaySection()}
          {renderPendingSection()}
        </ScrollView>

        {/* Details-Modal */}
        {renderDetailsModal()}

        {/* Hinweis */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Tippen Sie auf eine Rückmeldung für Details oder zum Markieren als erledigt
          </Text>
        </View>
      </View>
    </Modal>
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
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  closeButton: {
    padding: 4,
  },
  content: {
    flex: 1,
    padding: 16,
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
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  sectionHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  sectionContent: {
    padding: 8,
  },
  feedbackItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  feedbackPriority: {
    width: 40,
    alignItems: 'center',
  },
  priorityText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  feedbackInfo: {
    flex: 1,
  },
  feedbackTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 2,
  },
  feedbackPhone: {
    fontSize: 12,
    color: '#007AFF',
    marginBottom: 2,
  },
  feedbackDue: {
    fontSize: 12,
    color: '#666',
  },
  feedbackTimeRemaining: {
    fontSize: 11,
    fontWeight: 'bold',
    marginTop: 2,
  },
  feedbackActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    padding: 8,
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
  footer: {
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  footerText: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    width: '90%',
    maxHeight: '80%',
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
    padding: 16,
    maxHeight: 300,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  detailText: {
    fontSize: 14,
    color: '#333',
  },
  detailSection: {
    marginBottom: 16,
  },
  detailSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  detailDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  modalActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 8,
  },
  cancelButton: {
    backgroundColor: '#f0f0f0',
  },
  cancelButtonText: {
    color: '#333',
    fontSize: 14,
    fontWeight: '500',
  },
  completeButton: {
    backgroundColor: '#28a745',
  },
  completeButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  navigateButton: {
    backgroundColor: '#007AFF',
  },
  navigateButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
});

export default WorkModeDisplay;
