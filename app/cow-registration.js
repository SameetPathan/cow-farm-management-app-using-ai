import React, { useRef, useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView, Alert, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Picker } from '@react-native-picker/picker';
import QRCode from 'react-native-qrcode-svg';
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';

function generateUniqueId() {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 7).toUpperCase();
  return `COW-${timestamp}-${random}`;
}

export default function CowRegistrationScreen() {
  const { width } = useWindowDimensions();
  const [name, setName] = useState('');
  const [dob, setDob] = useState('');
  const [breed, setBreed] = useState('');
  const [uniqueId, setUniqueId] = useState('');
  const [hasMediaPermission, setHasMediaPermission] = useState(null);
  const qrRef = useRef(null);

  const BREEDS = [
    'Holstein Friesian',
    'Jersey',
    'Guernsey',
    'Ayrshire',
    'Brown Swiss',
    'Sahiwal',
    'Gir',
    'Red Sindhi',
    'Rathi',
    'Tharparkar',
    'Kankrej',
    'Ongole',
    'Hariana',
    'Deoni',
  ];

  const handleGenerate = () => {
    const id = generateUniqueId();
    setUniqueId(id);
  };

  const handleSubmit = () => {
    const payload = { name, dob, breed, uniqueId: uniqueId || generateUniqueId() };
    console.log('Cow Registration:', payload);
    Alert.alert('Saved (Mock)', 'Details logged to console.');
  };

  const handleDownloadQr = () => {
    if (!uniqueId) {
      Alert.alert('QR Code', 'Generate Unique ID first.');
      return;
    }
    if (!qrRef.current) {
      Alert.alert('QR Code', 'QR not ready yet.');
      return;
    }
    // Ask permission once
    const ensurePermission = async () => {
      if (hasMediaPermission === true) return true;
      const { status } = await MediaLibrary.requestPermissionsAsync();
      const granted = status === 'granted';
      setHasMediaPermission(granted);
      return granted;
    };
    (async () => {
      const ok = await ensurePermission();
      if (!ok) {
        Alert.alert('Permission needed', 'Allow media permissions to save the QR image.');
        return;
      }
      qrRef.current?.toDataURL(async (data) => {
        try {
          const pngBase64 = `data:image/png;base64,${data}`;
          const fileName = `${uniqueId}.png`;
          const fileUri = FileSystem.cacheDirectory + fileName;
          await FileSystem.writeAsStringAsync(fileUri, data, { encoding: FileSystem.EncodingType.Base64 });
          await MediaLibrary.saveToLibraryAsync(fileUri);
          Alert.alert('Saved', 'QR image saved to your gallery.');
        } catch (e) {
          console.error('QR save error', e);
          Alert.alert('Error', 'Failed to save QR image.');
        }
      });
    })();
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.back}>
            <Ionicons name="arrow-back" size={22} color="#2c3e50" />
          </TouchableOpacity>
          <Text style={styles.title}>Cow Registration</Text>
          <Text style={styles.subtitle}>Create unique ID and QR</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Cow Name</Text>
          <TextInput value={name} onChangeText={setName} placeholder="e.g., Rosie" style={styles.input} />

          <Text style={styles.label}>Date of Birth</Text>
          <TextInput value={dob} onChangeText={setDob} placeholder="YYYY-MM-DD" style={styles.input} />

          <Text style={styles.label}>Breed</Text>
          <View style={styles.pickerWrapper}>
            <Picker
              selectedValue={breed}
              onValueChange={(val) => setBreed(val)}
            >
              <Picker.Item label="Select breed" value="" />
              {BREEDS.map((b) => (
                <Picker.Item key={b} label={b} value={b} />
              ))}
            </Picker>
          </View>

          {/* QR Preview */}
          <View style={styles.qrBox}>
            {!!uniqueId && (
              <QRCode
                value={uniqueId}
                size={Math.min(width - 80, 220)}
                backgroundColor="#FFFFFF"
                color="#000000"
                getRef={(c) => (qrRef.current = c)}
              />
            )}
          </View>

          <View style={styles.row}>
            <TouchableOpacity style={[styles.actionButton, styles.actionFlex]} onPress={handleGenerate}>
              <Ionicons name="key" size={18} color="#fff" />
              <Text style={styles.actionText}>Generate ID</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionButton, styles.actionFlex, { backgroundColor: '#2196F3' }]} onPress={handleDownloadQr}>
              <Ionicons name="qr-code" size={18} color="#fff" />
              <Text style={styles.actionText}>Download QR</Text>
            </TouchableOpacity>
          </View>

          {uniqueId ? (
            <View style={styles.idBox}>
              <Text style={styles.idLabel}>Unique ID</Text>
              <Text style={styles.idValue}>{uniqueId}</Text>
            </View>
          ) : null}

          <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
            <Text style={styles.submitText}>Save</Text>
            <Ionicons name="checkmark" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  content: { padding: 20, paddingBottom: 32 },
  header: { marginBottom: 16 },
  back: { padding: 6, alignSelf: 'flex-start' },
  title: { fontSize: 22, fontWeight: 'bold', color: '#2c3e50', marginTop: 6 },
  subtitle: { fontSize: 14, color: '#7f8c8d', marginTop: 2 },
  card: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 3.84,
    elevation: 3,
  },
  label: { fontSize: 14, color: '#7f8c8d', marginTop: 10, marginBottom: 6 },
  input: {
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e6e8eb',
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: '#2c3e50',
  },
  pickerWrapper: {
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e6e8eb',
    overflow: 'hidden',
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4CAF50',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    marginRight: 10,
  },
  actionFlex: { flex: 1 },
  actionText: { color: '#fff', fontSize: 15, fontWeight: '600', marginLeft: 8 },
  idBox: { backgroundColor: '#f1f8f2', borderRadius: 10, padding: 12, marginTop: 16 },
  idLabel: { color: '#2c3e50', fontSize: 12, opacity: 0.7, marginBottom: 4 },
  idValue: { color: '#2c3e50', fontSize: 16, fontWeight: 'bold' },
  qrBox: { alignItems: 'center', justifyContent: 'center', marginTop: 16 },
  submitButton: {
    marginTop: 18,
    backgroundColor: '#4CAF50',
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  submitText: { color: '#fff', fontSize: 16, fontWeight: 'bold', marginRight: 8 },
});


