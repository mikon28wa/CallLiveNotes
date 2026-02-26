import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  RefreshControl,
  Alert,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import CallDetectionService from '../components/CallDetectionService';
import * as DocumentPicker from 'expo-document-picker';
import { exportToCSV, createBackup } from '../utils/exportUtils';

const EXPO_PUBLIC_BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface PhoneNumberSummary {
  phone_number: string;
  last_note: string | null;
  last_call_time: string;
  note_count: number;
}

export default function Index() {
  const router = useRouter();
  const [phoneNumbers, setPhoneNumbers] = useState<PhoneNumberSummary[]>([]);
  const [filteredNumbers, setFilteredNumbers] = useState<PhoneNumberSummary[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const fetchPhoneNumbers = async () => {
    try {
      const response = await fetch(`${EXPO_PUBLIC_BACKEND_URL}/api/notes`);
      const data = await response.json();
      setPhoneNumbers(data);
      setFilteredNumbers(data);
    } catch (error) {
      console.error('Fehler beim Laden der Telefonnummern:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchPhoneNumbers();
  }, []);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredNumbers(phoneNumbers);
    } else {
      const filtered = phoneNumbers.filter((item) =>
        item.phone_number.includes(searchQuery)
      );
      setFilteredNumbers(filtered);
    }
  }, [searchQuery, phoneNumbers]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchPhoneNumbers();
  }, []);

  const formatDate = (dateString: string) => {
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

  const renderItem = ({ item }: { item: PhoneNumberSummary }) => (
    <TouchableOpacity
      style={styles.phoneItem}
      onPress={() => router.push(`/note-detail/${encodeURIComponent(item.phone_number)}`)}
    >
      <View style={styles.phoneIconContainer}>
        <Ionicons name="call" size={24} color="#4CAF50" />
      </View>
      <View style={styles.phoneInfo}>
        <Text style={styles.phoneNumber}>{item.phone_number}</Text>
        <Text style={styles.lastNote} numberOfLines={1}>
          {item.last_note || 'Keine Notizen'}
        </Text>
      </View>
      <View style={styles.phoneMetaContainer}>
        <Text style={styles.timeText}>{formatDate(item.last_call_time)}</Text>
        <View style={styles.noteBadge}>
          <Text style={styles.noteBadgeText}>{item.note_count}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

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
      <CallDetectionService onCallDetected={fetchPhoneNumbers} />
      
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Anrufnotizen</Text>
      </View>

      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#999" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Telefonnummer suchen..."
          placeholderTextColor="#999"
          value={searchQuery}
          onChangeText={setSearchQuery}
          keyboardType="phone-pad"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={20} color="#999" />
          </TouchableOpacity>
        )}
      </View>

      {filteredNumbers.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="call-outline" size={80} color="#555" />
          <Text style={styles.emptyText}>
            {searchQuery ? 'Keine Ergebnisse gefunden' : 'Noch keine Anrufnotizen'}
          </Text>
          <Text style={styles.emptySubtext}>
            {searchQuery
              ? 'Versuche eine andere Nummer'
              : 'Notizen werden automatisch bei Anrufen erstellt'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredNumbers}
          renderItem={renderItem}
          keyExtractor={(item) => item.phone_number}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#4CAF50"
              colors={['#4CAF50']}
            />
          }
        />
      )}
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
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e1e1e',
    marginHorizontal: 16,
    marginVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    height: 48,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
  },
  listContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  phoneItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e1e1e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  phoneIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(76, 175, 80, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  phoneInfo: {
    flex: 1,
  },
  phoneNumber: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  lastNote: {
    fontSize: 14,
    color: '#999',
  },
  phoneMetaContainer: {
    alignItems: 'flex-end',
  },
  timeText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 6,
  },
  noteBadge: {
    backgroundColor: '#4CAF50',
    borderRadius: 10,
    minWidth: 24,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  noteBadgeText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#fff',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
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
