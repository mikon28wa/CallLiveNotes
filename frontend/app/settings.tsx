import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  TextInput,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  getConfig,
  saveConfig,
  syncWithCRM,
  getOfflineQueue,
  isOnline,
  exportForCRM,
  importFromCRM,
} from '../utils/crmService';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

const SettingsScreen: React.FC = () => {
  const router = useRouter();
  const [config, setConfig] = useState({
    type: 'custom' as const,
    enabled: false,
    autoSync: false,
    syncInterval: 60,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [online, setOnline] = useState(true);
  const [offlineQueueCount, setOfflineQueueCount] = useState(0);
  const [syncResult, setSyncResult] = useState<{
    success: boolean;
    syncedNotes: number;
    errors: string[];
  } | null>(null);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const currentConfig = getConfig();
        setConfig({
          type: currentConfig.type,
          enabled: currentConfig.enabled,
          autoSync: currentConfig.autoSync,
          syncInterval: currentConfig.syncInterval,
        });
        const onlineStatus = await isOnline();
        setOnline(onlineStatus);
        const queue = await getOfflineQueue();
        setOfflineQueueCount(queue.length);
      } catch (error) {
        console.error('Fehler beim Laden der Einstellungen:', error);
      } finally {
        setLoading(false);
      }
    };
    loadSettings();
  }, []);

  const saveSettings = useCallback(async () => {
    try {
      setSaving(true);
      await saveConfig(config);
      Alert.alert('Erfolg', 'Einstellungen wurden gespeichert');
    } catch (error) {
      console.error('Fehler beim Speichern der Einstellungen:', error);
      Alert.alert('Fehler', 'Einstellungen konnten nicht gespeichert werden');
    } finally {
      setSaving(false);
    }
  }, [config]);

  const handleSync = useCallback(async () => {
    try {
      setSyncing(true);
      setSyncResult(null);
      const result = await syncWithCRM();
      setSyncResult({ success: result.success, syncedNotes: result.syncedNotes, errors: result.errors });
      const queue = await getOfflineQueue();
      setOfflineQueueCount(queue.length);
      if (result.success) {
        Alert.alert('Erfolg', `Synchronisation abgeschlossen: ${result.syncedNotes} Notizen in Queue`);
      } else if (result.errors.length > 0) {
        Alert.alert('Warnung', `Synchronisation mit Fehlern: ${result.errors.join('\n')}`);
      }
    } catch (error) {
      console.error('Fehler bei der Synchronisation:', error);
      Alert.alert('Fehler', 'Synchronisation fehlgeschlagen');
    } finally {
      setSyncing(false);
    }
  }, []);

  const handleExportForCRM = useCallback(async () => {
    try {
      setLoading(true);
      const jsonData = await exportForCRM();
      const fileUri = FileSystem.documentDirectory + 'calllivenotes_crm_export.json';
      await FileSystem.writeAsStringAsync(fileUri, jsonData);
      await Sharing.shareAsync(fileUri, { mimeType: 'application/json', dialogTitle: 'CallLiveNotes CRM Export' });
    } catch (error) {
      console.error('Fehler beim CRM-Export:', error);
      Alert.alert('Fehler', 'Export fehlgeschlagen');
    } finally { setLoading(false); }
  }, []);

  const handleImportFromCRM = useCallback(async () => {
    try {
      setLoading(true);
      Alert.alert('CRM Import', 'Diese Funktion erwartet eine CRM-Exportdatei. In der Demo-Version ist der Datei-Dialog nicht implementiert. Nutzen Sie Import/Export manuell.', [{ text: 'OK' }]);
    } catch (error) {
      console.error('Fehler beim Import:', error);
      Alert.alert('Fehler', 'Import fehlgeschlagen');
      setLoading(false);
    }
  }, []);

  const handleCRMTypeChange = (type: 'hubspot' | 'salesforce' | 'zoho' | 'custom') => { setConfig(prev => ({ ...prev, type })); };
  const toggleEnabled = () => { setConfig(prev => ({ ...prev, enabled: !prev.enabled })); };
  const toggleAutoSync = () => { setConfig(prev => ({ ...prev, autoSync: !prev.autoSync })); };
  const handleSyncIntervalChange = (value: number) => { setConfig(prev => ({ ...prev, syncInterval: Math.max(5, value) })); };

  const renderSyncResult = () => { if (!syncResult) return null; return (
    <View style={styles.syncResult}>
      <Text style={syncResult.success ? styles.syncResultSuccess : styles.syncResultError}>{syncResult.success ? '✓ Synchronisation abgeschlossen' : '✗ Synchronisation mit Fehlern'}</Text>
      <Text style={styles.syncResultText}>{syncResult.syncedNotes} Notizen in Queue</Text>
      {syncResult.errors.length > 0 && (<Text style={styles.syncResultErrorText}>Fehler: {syncResult.errors.join(', ')}</Text>)}
    </View>
  ); };

  if (loading) return (<View style={styles.loadingContainer}><ActivityIndicator size="large" color="#007AFF" /><Text style={styles.loadingText}>Einstellungen werden geladen...</Text></View>);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}><TouchableOpacity onPress={() => router.back()} style={styles.backButton}><Ionicons name="arrow-back" size={24} color="#007AFF" /></TouchableOpacity><Text style={styles.headerTitle}>Einstellungen</Text></View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>CRM-Integration (Offline-first)</Text>

          <View style={styles.setting}>
            <Text style={styles.settingLabel}>CRM aktivieren</Text>
            <Switch value={config.enabled} onValueChange={toggleEnabled} disabled={saving} />
          </View>

          {config.enabled && (
            <>
              <View style={styles.setting}>
                <Text style={styles.settingLabel}>CRM-System</Text>
                <View style={styles.crmTypeSelector}>
                  {(['hubspot','salesforce','zoho','custom'] as const).map(type => (
                    <TouchableOpacity key={type} style={[styles.crmTypeButton, config.type === type && styles.crmTypeButtonSelected]} onPress={() => handleCRMTypeChange(type)}>
                      <Text style={[styles.crmTypeButtonText, config.type === type && styles.crmTypeButtonTextSelected]}>{type.charAt(0).toUpperCase() + type.slice(1)}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.setting}>
                <Text style={styles.settingLabel}>Automatische Synchronisation</Text>
                <Switch value={config.autoSync} onValueChange={toggleAutoSync} disabled={saving} />
              </View>

              {config.autoSync && (<View style={styles.setting}><Text style={styles.settingLabel}>Sync-Intervall (Minuten)</Text><View style={styles.intervalSelector}><TouchableOpacity style={styles.intervalButton} onPress={() => handleSyncIntervalChange(config.syncInterval - 5)} disabled={config.syncInterval <= 5}><Ionicons name="remove" size={20} color="#007AFF" /></TouchableOpacity><Text style={styles.intervalText}>{config.syncInterval}</Text><TouchableOpacity style={styles.intervalButton} onPress={() => handleSyncIntervalChange(config.syncInterval + 5)} disabled={config.syncInterval >= 1440}><Ionicons name="add" size={20} color="#007AFF" /></TouchableOpacity></View></View>)}

              <View style={styles.setting}>
                <Text style={styles.settingLabel}>Manuell synchronisieren</Text>
                <TouchableOpacity style={styles.syncButton} onPress={handleSync} disabled={syncing || !online}>{syncing ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.syncButtonText}>Jetzt synchronisieren</Text>}</TouchableOpacity>
              </View>

              {renderSyncResult()}

              <View style={styles.setting}><Text style={styles.settingLabel}>Offline-Warteschlange: {offlineQueueCount} Elemente</Text>{!online && (<Text style={styles.offlineNotice}>Sie sind offline. Notizen werden gesammelt und später synchronisiert.</Text>)}</View>
            </>
          )}

        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Daten-Export/Import</Text>
          <View style={styles.setting}><Text style={styles.settingLabel}>CRM-Export</Text><TouchableOpacity style={styles.exportButton} onPress={handleExportForCRM} disabled={loading}><Ionicons name="download-outline" size={20} color="#007AFF" /><Text style={styles.exportButtonText}>Daten exportieren</Text></TouchableOpacity></View>
          <View style={styles.setting}><Text style={styles.settingLabel}>CRM-Import</Text><TouchableOpacity style={styles.exportButton} onPress={handleImportFromCRM} disabled={loading}><Ionicons name="upload-outline" size={20} color="#007AFF" /><Text style={styles.exportButtonText}>Daten importieren</Text></TouchableOpacity></View>
        </View>

        <View style={styles.section}><Text style={styles.sectionTitle}>Status</Text><View style={styles.setting}><Text style={styles.settingLabel}>Internetverbindung</Text><View style={styles.statusIndicator}><View style={[styles.statusDot, online ? styles.statusDotOnline : styles.statusDotOffline]} /><Text style={online ? styles.statusTextOnline : styles.statusTextOffline}>{online ? 'Online' : 'Offline'}</Text></View></View></View>

        <View style={styles.saveContainer}><TouchableOpacity style={styles.saveButton} onPress={saveSettings} disabled={saving}>{saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.saveButtonText}>Einstellungen speichern</Text>}</TouchableOpacity></View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  scrollContent: { paddingBottom: 40 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 16, fontSize: 16, color: '#666' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#ddd' },
  backButton: { padding: 4, marginRight: 8 },
  headerTitle: { fontSize: 20, fontWeight: '600', color: '#333' },
  section: { backgroundColor: '#fff', marginTop: 12, padding: 16, borderRadius: 12, marginHorizontal: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: '#333', marginBottom: 16 },
  setting: { marginBottom: 16 },
  settingLabel: { fontSize: 14, color: '#333', marginBottom: 8 },
  crmTypeSelector: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  crmTypeButton: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: '#f0f0f0' },
  crmTypeButtonSelected: { backgroundColor: '#007AFF' },
  crmTypeButtonText: { fontSize: 12, color: '#666' },
  crmTypeButtonTextSelected: { color: '#fff' },
  intervalSelector: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  intervalButton: { padding: 8 },
  intervalText: { fontSize: 16, fontWeight: '500', color: '#333', minWidth: 40, textAlign: 'center' },
  syncButton: { backgroundColor: '#007AFF', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, alignSelf: 'flex-start' },
  syncButtonText: { color: '#fff', fontSize: 14, fontWeight: '500' },
  syncResult: { marginTop: 12, padding: 12, borderRadius: 8, backgroundColor: '#f5f5f5' },
  syncResultSuccess: { color: '#28a745', fontSize: 14, fontWeight: '500' },
  syncResultError: { color: '#dc3545', fontSize: 14, fontWeight: '500' },
  syncResultText: { fontSize: 12, color: '#666', marginTop: 4 },
  syncResultErrorText: { fontSize: 12, color: '#dc3545', marginTop: 4 },
  offlineNotice: { fontSize: 12, color: '#ffc107', marginTop: 4 },
  exportButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f0f0f0', padding: 12, borderRadius: 8, alignSelf: 'flex-start' },
  exportButtonText: { color: '#007AFF', fontSize: 14, fontWeight: '500', marginLeft: 8 },
  statusIndicator: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusDot: { width: 12, height: 12, borderRadius: 6 },
  statusDotOnline: { backgroundColor: '#28a745' },
  statusDotOffline: { backgroundColor: '#dc3545' },
  statusTextOnline: { fontSize: 14, color: '#28a745' },
  statusTextOffline: { fontSize: 14, color: '#dc3545' },
  saveContainer: { padding: 16, marginTop: 12 },
  saveButton: { backgroundColor: '#007AFF', padding: 16, borderRadius: 8, alignItems: 'center' },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: '500' },
});

export default SettingsScreen;
