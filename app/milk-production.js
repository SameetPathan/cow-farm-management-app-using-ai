import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView, Alert, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';

const SESSIONS = ['Morning', 'Evening'];

function SessionButton({ label, active, onPress }) {
  return (
    <TouchableOpacity onPress={onPress} style={[styles.sessionButton, active && styles.sessionButtonActive]}>
      <Ionicons 
        name={label === 'Morning' ? 'sunny' : 'moon'} 
        size={16} 
        color={active ? '#fff' : '#10b981'} 
      />
      <Text style={[styles.sessionText, active && styles.sessionTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function MilkProductionScreen() {
  const [activeSession, setActiveSession] = useState('Morning');
  const [searchId, setSearchId] = useState('');
  const [records, setRecords] = useState({}); // { 'YYYY-MM-DD': { morning: {...}, evening: {...} } }
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [scanVisible, setScanVisible] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();

  const dateKey = useMemo(() => {
    const y = selectedDate.getFullYear();
    const m = String(selectedDate.getMonth() + 1).padStart(2, '0');
    const d = String(selectedDate.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }, [selectedDate]);

  const currentRecord = records[dateKey]?.[activeSession.toLowerCase()] || null;
  const hasAnyRecord = records[dateKey] && (records[dateKey].morning || records[dateKey].evening);

  const updateRecord = (field, value) => {
    setRecords((prev) => ({
      ...prev,
      [dateKey]: {
        ...(prev[dateKey] || {}),
        [activeSession.toLowerCase()]: {
          ...(prev[dateKey]?.[activeSession.toLowerCase()] || {}),
          [field]: value,
        },
      },
    }));
  };

  const setRecordBulk = (payload) => {
    setRecords((prev) => ({
      ...prev,
      [dateKey]: {
        ...(prev[dateKey] || {}),
        [activeSession.toLowerCase()]: {
          ...(prev[dateKey]?.[activeSession.toLowerCase()] || {}),
          ...payload,
        },
      },
    }));
  };

  const formatPrettyDate = (date) => {
    return date.toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
  };

  const goPrevDay = () => {
    setSelectedDate((d) => new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1));
  };

  const goNextDay = () => {
    setSelectedDate((d) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1));
  };

  const goToday = () => {
    const now = new Date();
    setSelectedDate(new Date(now.getFullYear(), now.getMonth(), now.getDate()));
  };

  const handleScan = ({ data }) => {
    setScanVisible(false);
    setSearchId(data);
    setTimeout(() => loadMock(data), 200);
  };

  const loadMock = (id) => {
    const mock = {
      cowId: id,
      cowName: `Cow ${id}`,
      breed: 'Holstein Friesian',
      milkQuantity: '',
      milkQuality: 'Good',
      temperature: '',
      notes: '',
      session: activeSession.toLowerCase(),
      date: dateKey,
    };
    setRecordBulk(mock);
  };

  const handleSearch = () => {
    if (!searchId) {
      Alert.alert('Enter ID', 'Please scan or enter a valid cow ID');
      return;
    }
    loadMock(searchId);
  };

  const handleSave = () => {
    console.log('Save milk production for', dateKey, activeSession, ':', records[dateKey]?.[activeSession.toLowerCase()]);
    Alert.alert('Saved (Mock)', `Saved ${activeSession} session for ${formatPrettyDate(selectedDate)}.`);
  };

  const getTotalMilk = () => {
    const dayRecord = records[dateKey];
    if (!dayRecord) return 0;
    const morning = parseFloat(dayRecord.morning?.milkQuantity || 0);
    const evening = parseFloat(dayRecord.evening?.milkQuantity || 0);
    return (morning + evening).toFixed(1);
  };

  const renderMilkForm = () => (
    <View style={styles.card}>
      <View style={styles.cowInfo}>
        <Ionicons name="cow" size={20} color="#10b981" />
        <View style={styles.cowMeta}>
          <Text style={styles.cowIdText} numberOfLines={1} ellipsizeMode="tail">
            {currentRecord?.cowId || 'No Cow Selected'}
          </Text>
          {currentRecord?.cowName && (
            <Text style={styles.cowNameText} numberOfLines={1} ellipsizeMode="tail">{currentRecord.cowName}</Text>
          )}
        </View>
      </View>

      <Text style={styles.label}>Milk Quantity (Liters)</Text>
      <TextInput 
        value={currentRecord?.milkQuantity || ''} 
        onChangeText={(v) => updateRecord('milkQuantity', v)} 
        style={styles.input} 
        placeholder="Enter milk quantity"
        keyboardType="numeric"
      />

      <Text style={styles.label}>Milk Quality</Text>
      <View style={styles.qualityRow}>
        {['Excellent', 'Good', 'Fair', 'Poor'].map((quality) => (
          <TouchableOpacity
            key={quality}
            onPress={() => updateRecord('milkQuality', quality)}
            style={[
              styles.qualityButton,
              currentRecord?.milkQuality === quality && styles.qualityButtonActive
            ]}
          >
            <Text style={[
              styles.qualityText,
              currentRecord?.milkQuality === quality && styles.qualityTextActive
            ]}>
              {quality}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Temperature (°C)</Text>
      <TextInput 
        value={currentRecord?.temperature || ''} 
        onChangeText={(v) => updateRecord('temperature', v)} 
        style={styles.input} 
        placeholder="Enter temperature"
        keyboardType="numeric"
      />

      <Text style={styles.label}>Notes</Text>
      <TextInput
        value={currentRecord?.notes || ''}
        onChangeText={(v) => updateRecord('notes', v)}
        style={[styles.input, styles.textarea]}
        placeholder="Any additional notes..."
        multiline
      />
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.back}>
            <Ionicons name="arrow-back" size={22} color="#2c3e50" />
          </TouchableOpacity>
          <Text style={styles.title}>Milk Production</Text>
          <Text style={styles.subtitle}>Track daily milk yield by session</Text>
        </View>

        <View style={styles.dateRow}>
          <TouchableOpacity onPress={goPrevDay} style={[styles.chipBtn, styles.chipBtnLight]}>
            <Ionicons name="chevron-back" size={14} color="#2c3e50" />
            <Text style={styles.chipTextDark}>Prev</Text>
          </TouchableOpacity>
          <View style={styles.datePill}>
            <Ionicons name="calendar" size={14} color="#2c3e50" />
            <Text style={styles.dateText} numberOfLines={1}>{formatPrettyDate(selectedDate)}</Text>
          </View>
          <TouchableOpacity onPress={goNextDay} style={[styles.chipBtn, styles.chipBtnLight]}>
            <Text style={styles.chipTextDark}>Next</Text>
            <Ionicons name="chevron-forward" size={14} color="#2c3e50" />
          </TouchableOpacity>
          <TouchableOpacity onPress={goToday} style={[styles.chipBtn, styles.chipBtnPrimary]}>
            <Ionicons name="flash" size={14} color="#fff" />
            <Text style={styles.chipTextLight}>Today</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.searchRow}>
          <View style={styles.searchBox}>
            <TextInput
              placeholder="Enter Cow ID"
              value={searchId}
              onChangeText={setSearchId}
              style={styles.searchInput}
            />
          </View>
          <TouchableOpacity style={styles.searchBtn} onPress={handleSearch}>
            <Ionicons name="search" size={18} color="#fff" />
            <Text style={styles.searchText}>Search</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.searchBtn, styles.scanBtn]} onPress={() => setScanVisible(true)}>
            <Ionicons name="qr-code" size={18} color="#fff" />
            <Text style={styles.searchText}>Scan</Text>
          </TouchableOpacity>
        </View>

        {/* Daily Total */}
        {hasAnyRecord && (
          <View style={styles.totalCard}>
            <Ionicons name="water" size={24} color="#0ea5e9" />
            <View style={styles.totalInfo}>
              <Text style={styles.totalLabel}>Daily Total</Text>
              <Text style={styles.totalValue}>{getTotalMilk()} Liters</Text>
            </View>
          </View>
        )}

        {/* Session Tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.sessionsContainer}>
          <View style={styles.sessions}>
            {SESSIONS.map((session) => (
              <SessionButton 
                key={session} 
                label={session} 
                active={session === activeSession} 
                onPress={() => setActiveSession(session)} 
              />
            ))}
          </View>
        </ScrollView>

        {currentRecord ? renderMilkForm() : (
          <View style={styles.placeholder}> 
            <Ionicons name="water" size={28} color="#9aa3a9" />
            <Text style={styles.placeholderText}>
              Search or scan a Cow ID to begin recording {activeSession.toLowerCase()} milk production for {formatPrettyDate(selectedDate)}.
            </Text>
          </View>
        )}

        {currentRecord && (
          <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
            <Text style={styles.saveText}>Save {activeSession} Session</Text>
            <Ionicons name="checkmark" size={18} color="#fff" />
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* Scanner Modal */}
      <Modal visible={scanVisible} animationType="slide">
        <SafeAreaView style={styles.scanContainer}>
          <Text style={styles.scanTitle}>Scan QR Code</Text>
          {permission?.granted === false && (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
              <Text style={styles.scanInfo}>Camera permission not granted.</Text>
              <TouchableOpacity style={[styles.searchBtn, { marginTop: 16 }]} onPress={requestPermission}>
                <Ionicons name="camera" size={18} color="#fff" />
                <Text style={styles.searchText}>Grant Permission</Text>
              </TouchableOpacity>
            </View>
          )}
          {permission?.granted && (
            <View style={styles.scannerBox}>
              <CameraView
                style={StyleSheet.absoluteFillObject}
                onBarcodeScanned={handleScan}
                barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              />
            </View>
          )}
          <TouchableOpacity style={styles.scanClose} onPress={() => setScanVisible(false)}>
            <Text style={styles.scanCloseText}>Close</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  content: { padding: 20, paddingBottom: 32 },
  header: { marginBottom: 10 },
  back: { padding: 6, alignSelf: 'flex-start' },
  title: { fontSize: 24, fontWeight: '800', color: '#1f2937', marginTop: 6 },
  subtitle: { fontSize: 14, color: '#6b7280', marginTop: 2 },

  dateRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginTop: 8, 
    paddingHorizontal: 4,
    gap: 6
  },
  datePill: { 
    flex: 1, 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    backgroundColor: '#fff', 
    borderWidth: 1, 
    borderColor: '#e6e8eb', 
    borderRadius: 20, 
    paddingVertical: 8, 
    paddingHorizontal: 12,
    minHeight: 40
  },
  dateText: { 
    marginLeft: 6, 
    color: '#111827', 
    fontWeight: '600', 
    fontSize: 13,
    flex: 1,
    textAlign: 'center'
  },
  chipBtn: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    borderRadius: 20, 
    paddingVertical: 8, 
    paddingHorizontal: 10,
    minHeight: 40,
    minWidth: 60,
    justifyContent: 'center'
  },
  chipBtnLight: { backgroundColor: '#e5f3e8' },
  chipBtnPrimary: { backgroundColor: '#10b981' },
  chipTextLight: { color: '#fff', fontWeight: '700', marginLeft: 4, fontSize: 12 },
  chipTextDark: { color: '#2c3e50', fontWeight: '700', marginHorizontal: 2, fontSize: 12 },

  searchRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  searchBox: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e6e8eb',
    marginRight: 10,
  },
  searchInput: { paddingHorizontal: 12, paddingVertical: 12, fontSize: 16, color: '#2c3e50' },
  searchBtn: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#10b981', borderRadius: 10, paddingVertical: 12, paddingHorizontal: 14,
    marginLeft: 4,
  },
  scanBtn: { backgroundColor: '#0ea5e9' },
  searchText: { color: '#fff', fontSize: 15, fontWeight: '600', marginLeft: 6 },

  totalCard: {
    backgroundColor: '#e0f2fe',
    borderRadius: 16,
    padding: 16,
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#bae6fd',
  },
  totalInfo: { marginLeft: 12, flex: 1 },
  totalLabel: { fontSize: 14, color: '#0369a1', fontWeight: '600' },
  totalValue: { fontSize: 20, color: '#0c4a6e', fontWeight: '800', marginTop: 2 },

  sessionsContainer: { marginTop: 16 },
  sessions: { 
    flexDirection: 'row', 
    backgroundColor: '#e6f7ef', 
    borderRadius: 12, 
    padding: 4,
    minWidth: '100%'
  },
  sessionButton: { 
    paddingVertical: 12, 
    paddingHorizontal: 16, 
    borderRadius: 10, 
    alignItems: 'center',
    minWidth: 100,
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center'
  },
  sessionButtonActive: { backgroundColor: '#10b981' },
  sessionText: { color: '#2c3e50', fontWeight: '600', fontSize: 13, marginLeft: 6 },
  sessionTextActive: { color: '#fff' },

  card: {
    backgroundColor: 'white', borderRadius: 16, padding: 16, marginTop: 16,
    borderWidth: 1, borderColor: '#eef2f7',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  cowInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#dcfce7',
  },
  cowMeta: { marginLeft: 8, flex: 1 },
  cowIdText: { fontSize: 16, fontWeight: '700', color: '#166534' },
  cowNameText: { fontSize: 14, color: '#16a34a', marginTop: 2 },
  label: { fontSize: 13, color: '#6b7280', marginTop: 10, marginBottom: 6 },
  input: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e6e8eb', paddingHorizontal: 12, paddingVertical: 12, fontSize: 16, color: '#111827' },
  textarea: { minHeight: 90, textAlignVertical: 'top' },

  qualityRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  qualityButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e6e8eb',
    backgroundColor: '#fff',
  },
  qualityButtonActive: {
    backgroundColor: '#10b981',
    borderColor: '#10b981',
  },
  qualityText: { fontSize: 12, color: '#6b7280', fontWeight: '600' },
  qualityTextActive: { color: '#fff' },

  placeholder: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40 },
  placeholderText: { marginTop: 8, color: '#9aa3a9', textAlign: 'center', paddingHorizontal: 20 },

  saveBtn: { marginTop: 20, backgroundColor: '#10b981', borderRadius: 12, paddingVertical: 14, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  saveText: { color: '#fff', fontSize: 16, fontWeight: 'bold', marginRight: 8 },

  scanContainer: { flex: 1, backgroundColor: '#000' },
  scanTitle: { color: '#fff', textAlign: 'center', padding: 16, fontWeight: 'bold', fontSize: 16 },
  scannerBox: { flex: 1 },
  scanInfo: { color: '#fff', textAlign: 'center', marginTop: 16 },
  scanClose: { padding: 14, backgroundColor: '#111', alignItems: 'center' },
  scanCloseText: { color: '#fff', fontWeight: '600' },
});
