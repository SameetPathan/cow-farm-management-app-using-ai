import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView, Alert, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';

const TABS = ['Overview', 'Vitals', 'Production', 'Intake', 'Health'];

function TabButton({ label, active, onPress }) {
  return (
    <TouchableOpacity onPress={onPress} style={[styles.tabButton, active && styles.tabButtonActive]}>
      <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function CowInfoScreen() {
  const [activeTab, setActiveTab] = useState('Overview');
  const [searchId, setSearchId] = useState('');
  const [records, setRecords] = useState({}); // { 'YYYY-MM-DD': { ...fields } }
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [scanVisible, setScanVisible] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();

  const dateKey = useMemo(() => {
    const y = selectedDate.getFullYear();
    const m = String(selectedDate.getMonth() + 1).padStart(2, '0');
    const d = String(selectedDate.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }, [selectedDate]);

  const data = records[dateKey] || null;

  const updateRecord = (field, value) => {
    setRecords((prev) => ({
      ...prev,
      [dateKey]: {
        ...(prev[dateKey] || {}),
        [field]: value,
      },
    }));
  };

  const setRecordBulk = (payload) => {
    setRecords((prev) => ({
      ...prev,
      [dateKey]: {
        ...(prev[dateKey] || {}),
        ...payload,
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
    // Simulate fetch
    setTimeout(() => loadMock(data), 200);
  };

  const loadMock = (id) => {
    const mock = {
      id,
      type: 'Dairy',
      breed: 'Holstein Friesian',
      weight: '420 kg',
      height: '140 cm',
      temperature: '38.5 °C',
      milkYield: '18 L/day',
      intakeFood: '25 kg/day',
      intakeWater: '60 L/day',
      vaccinations: 'FMD (2024-04-10), HS (2024-06-02)',
      illnesses: 'None',
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
    console.log('Save cow info for', dateKey, ':', records[dateKey]);
    Alert.alert('Saved (Mock)', `Saved entry for ${formatPrettyDate(selectedDate)}.`);
  };

  const renderOverview = () => (
    <View style={styles.card}>
      <Text style={styles.label}>Cow ID</Text>
      <TextInput value={data?.id || ''} onChangeText={(v) => updateRecord('id', v)} style={styles.input} />

      <Text style={styles.label}>Type</Text>
      <TextInput value={data?.type || ''} onChangeText={(v) => updateRecord('type', v)} style={styles.input} />

      <Text style={styles.label}>Breed</Text>
      <TextInput value={data?.breed || ''} onChangeText={(v) => updateRecord('breed', v)} style={styles.input} />
    </View>
  );

  const renderVitals = () => (
    <View style={styles.card}>
      <Text style={styles.label}>Weight</Text>
      <TextInput value={data?.weight || ''} onChangeText={(v) => updateRecord('weight', v)} style={styles.input} />

      <Text style={styles.label}>Height</Text>
      <TextInput value={data?.height || ''} onChangeText={(v) => updateRecord('height', v)} style={styles.input} />

      <Text style={styles.label}>Temperature</Text>
      <TextInput value={data?.temperature || ''} onChangeText={(v) => updateRecord('temperature', v)} style={styles.input} />
    </View>
  );

  const renderProduction = () => (
    <View style={styles.card}>
      <Text style={styles.label}>Milk yield</Text>
      <TextInput value={data?.milkYield || ''} onChangeText={(v) => updateRecord('milkYield', v)} style={styles.input} />
    </View>
  );

  const renderIntake = () => (
    <View style={styles.card}>
      <Text style={styles.label}>Food intake</Text>
      <TextInput value={data?.intakeFood || ''} onChangeText={(v) => updateRecord('intakeFood', v)} style={styles.input} />

      <Text style={styles.label}>Water intake</Text>
      <TextInput value={data?.intakeWater || ''} onChangeText={(v) => updateRecord('intakeWater', v)} style={styles.input} />
    </View>
  );

  const renderHealth = () => (
    <View style={styles.card}>
      <Text style={styles.label}>Vaccinations</Text>
      <TextInput
        value={data?.vaccinations || ''}
        onChangeText={(v) => updateRecord('vaccinations', v)}
        style={[styles.input, styles.textarea]}
        multiline
      />

      <Text style={styles.label}>Illness history</Text>
      <TextInput
        value={data?.illnesses || ''}
        onChangeText={(v) => updateRecord('illnesses', v)}
        style={[styles.input, styles.textarea]}
        multiline
      />
    </View>
  );

  const Content = useMemo(() => {
    switch (activeTab) {
      case 'Vitals':
        return renderVitals();
      case 'Production':
        return renderProduction();
      case 'Intake':
        return renderIntake();
      case 'Health':
        return renderHealth();
      case 'Overview':
      default:
        return renderOverview();
    }
  }, [activeTab, data]);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.back}>
            <Ionicons name="arrow-back" size={22} color="#2c3e50" />
          </TouchableOpacity>
          <Text style={styles.title}>Cow Information</Text>
          <Text style={styles.subtitle}>Day-wise record entry</Text>
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

        {/* Tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsContainer}>
          <View style={styles.tabs}>
            {TABS.map((t) => (
              <TabButton key={t} label={t} active={t === activeTab} onPress={() => setActiveTab(t)} />
            ))}
          </View>
        </ScrollView>

        {data ? Content : (
          <View style={styles.placeholder}> 
            <Ionicons name="information-circle" size={28} color="#9aa3a9" />
            <Text style={styles.placeholderText}>Search or scan a Cow ID to begin entering data for {formatPrettyDate(selectedDate)}.</Text>
          </View>
        )}

        {data && (
          <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
            <Text style={styles.saveText}>Save Day Entry</Text>
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

  tabsContainer: { marginTop: 16 },
  tabs: { 
    flexDirection: 'row', 
    backgroundColor: '#e6f7ef', 
    borderRadius: 12, 
    padding: 4,
    minWidth: '100%'
  },
  tabButton: { 
    paddingVertical: 12, 
    paddingHorizontal: 16, 
    borderRadius: 10, 
    alignItems: 'center',
    minWidth: 80,
    flex: 1
  },
  tabButtonActive: { backgroundColor: '#10b981' },
  tabText: { color: '#2c3e50', fontWeight: '600', fontSize: 13 },
  tabTextActive: { color: '#fff' },

  card: {
    backgroundColor: 'white', borderRadius: 16, padding: 16, marginTop: 16,
    borderWidth: 1, borderColor: '#eef2f7',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  label: { fontSize: 13, color: '#6b7280', marginTop: 10, marginBottom: 6 },
  input: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e6e8eb', paddingHorizontal: 12, paddingVertical: 12, fontSize: 16, color: '#111827' },
  textarea: { minHeight: 90, textAlignVertical: 'top' },

  placeholder: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40 },
  placeholderText: { marginTop: 8, color: '#9aa3a9' },

  saveBtn: { marginTop: 20, backgroundColor: '#10b981', borderRadius: 12, paddingVertical: 14, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  saveText: { color: '#fff', fontSize: 16, fontWeight: 'bold', marginRight: 8 },

  scanContainer: { flex: 1, backgroundColor: '#000' },
  scanTitle: { color: '#fff', textAlign: 'center', padding: 16, fontWeight: 'bold', fontSize: 16 },
  scannerBox: { flex: 1 },
  scanInfo: { color: '#fff', textAlign: 'center', marginTop: 16 },
  scanClose: { padding: 14, backgroundColor: '#111', alignItems: 'center' },
  scanCloseText: { color: '#fff', fontWeight: '600' },
});


