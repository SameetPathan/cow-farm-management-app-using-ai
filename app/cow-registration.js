import React, { useRef, useState, useEffect } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView, Alert, useWindowDimensions, Modal, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Picker } from '@react-native-picker/picker';
import QRCode from 'react-native-qrcode-svg';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import * as Linking from 'expo-linking';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { database } from '../firebaseConfig';
import { ref, set, get, child } from 'firebase/database';
import { getCowRegistrationAI } from '../services/aiService';

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
  const [isLoading, setIsLoading] = useState(false);
  const [userPhone, setUserPhone] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isQrGenerated, setIsQrGenerated] = useState(false);
  const [showAISuggestions, setShowAISuggestions] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState('');
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const qrRef = useRef(null);
  const qrContainerRef = useRef(null);

  // Get user phone number from AsyncStorage
  useEffect(() => {
    const getUserPhone = async () => {
      try {
        const phone = await AsyncStorage.getItem('userPhone');
        if (phone) {
          setUserPhone(phone);
        } else {
          Alert.alert('Error', 'User not logged in. Please login first.', [
            { text: 'OK', onPress: () => router.replace('/login') }
          ]);
        }
      } catch (error) {
        console.error('Error getting user phone:', error);
        Alert.alert('Error', 'Failed to get user information. Please login again.', [
          { text: 'OK', onPress: () => router.replace('/login') }
        ]);
      }
    };
    getUserPhone();
  }, []);

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
    setIsQrGenerated(true);
  };

  const formatDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const handleDateSelect = () => {
    setDob(formatDate(selectedDate));
    setShowDatePicker(false);
  };

  const validateForm = () => {
    if (!name || name.trim() === '') {
      Alert.alert('Error', 'Please enter cow name');
      return false;
    }
    if (!dob || dob.trim() === '') {
      Alert.alert('Error', 'Please select date of birth');
      return false;
    }
    if (!breed || breed.trim() === '') {
      Alert.alert('Error', 'Please select a breed');
      return false;
    }
    if (!isQrGenerated || !uniqueId) {
      Alert.alert('Error', 'Please generate QR code first before saving');
      return false;
    }
    if (!userPhone) {
      Alert.alert('Error', 'User not logged in. Please login first.');
      return false;
    }
    return true;
  };

  const handleSubmit = () => {
    if (!validateForm()) return;

    const finalUniqueId = uniqueId;
    
    setIsLoading(true);

    // Check if cow with this ID already exists
    const dbRef = ref(database);
    get(child(dbRef, `CowFarm/cows/${finalUniqueId}`))
      .then((snapshot) => {
        if (snapshot.exists()) {
          setIsLoading(false);
          Alert.alert('Error', 'A cow with this ID already exists. Please generate a new ID.');
          // Generate new ID
          const newId = generateUniqueId();
          setUniqueId(newId);
        } else {
          // Save cow to Firebase Realtime Database
          set(ref(database, `CowFarm/cows/${finalUniqueId}`), {
            name: name.trim(),
            dob: dob.trim(),
            breed: breed,
            uniqueId: finalUniqueId,
            userPhoneNumber: userPhone,
            createdAt: new Date().toISOString()
          })
            .then(() => {
              setIsLoading(false);
              Alert.alert('Success', 'Cow registered successfully!', [
                { 
                  text: 'OK', 
                  onPress: () => {
                    // Reset form
                    setName('');
                    setDob('');
                    setBreed('');
                    setUniqueId('');
                    router.back();
                  }
                },
              ]);
            })
            .catch((error) => {
              setIsLoading(false);
              Alert.alert('Error', 'Registration failed: ' + error.message);
            });
        }
      })
      .catch((error) => {
        setIsLoading(false);
        Alert.alert('Error', 'Database error: ' + error.message);
      });
  };

  const handleGetAISuggestions = async () => {
    if (!name || !breed || !dob) {
      Alert.alert('Info', 'Please fill in name, breed, and date of birth to get AI suggestions.');
      return;
    }

    setIsLoadingAI(true);
    try {
      const cowData = { name, breed, dob };
      const response = await getCowRegistrationAI(cowData);
      
      if (response.success) {
        setAiSuggestions(response.suggestions);
        setShowAISuggestions(true);
      } else {
        Alert.alert('Error', 'Failed to get AI suggestions. Please try again.');
      }
    } catch (error) {
      console.error('Error getting AI suggestions:', error);
      Alert.alert('Error', 'Failed to get AI suggestions. Please check your connection.');
    } finally {
      setIsLoadingAI(false);
    }
  };

  const handleDownloadQr = async () => {
    if (!uniqueId) {
      Alert.alert('QR Code', 'Generate Unique ID first.');
      return;
    }
    if (!qrContainerRef.current) {
      Alert.alert('QR Code', 'QR container not ready yet.');
      return;
    }

    try {
      // Capture the entire QR container (title + QR code + subtitle) as image
      const uri = await captureRef(qrContainerRef, {
        format: 'png',
        quality: 1.0,
        result: 'tmpfile',
      });

      // Share via WhatsApp
      const whatsappUrl = `whatsapp://send?text=Cow Registration QR Code - ${uniqueId}`;
      const canOpen = await Linking.canOpenURL(whatsappUrl);
      
      if (canOpen) {
        // Share the image file
        const isAvailable = await Sharing.isAvailableAsync();
        if (isAvailable) {
          await Sharing.shareAsync(uri, {
            mimeType: 'image/png',
            dialogTitle: 'Share QR Code via WhatsApp',
          });
        } else {
          // Fallback: Open WhatsApp with text
          await Linking.openURL(whatsappUrl);
          Alert.alert('Info', 'Please attach the QR code image manually from your gallery.');
        }
      } else {
        // WhatsApp not installed, use general sharing
        const isAvailable = await Sharing.isAvailableAsync();
        if (isAvailable) {
          await Sharing.shareAsync(uri, {
            mimeType: 'image/png',
            dialogTitle: 'Share QR Code',
          });
        } else {
          Alert.alert('Error', 'Sharing is not available on this device.');
        }
      }
    } catch (error) {
      console.error('Error in handleDownloadQr', error);
      Alert.alert('Error', 'Failed to share QR code: ' + error.message);
    }
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
          <TouchableOpacity onPress={() => setShowDatePicker(true)} style={styles.dateInputContainer}>
            <TextInput 
              value={dob} 
              placeholder="Select Date of Birth" 
              style={[styles.input, styles.dateInput]} 
              editable={false}
              placeholderTextColor="#999"
            />
            <Ionicons name="calendar" size={20} color="#666" style={styles.dateIcon} />
          </TouchableOpacity>

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

          {/* AI Suggestions Button */}
          {name && breed && dob && (
            <TouchableOpacity
              style={[styles.aiButton, isLoadingAI && styles.aiButtonDisabled]}
              onPress={handleGetAISuggestions}
              disabled={isLoadingAI}
            >
              <Ionicons name="sparkles" size={18} color="#fff" />
              <Text style={styles.aiButtonText}>
                {isLoadingAI ? 'Getting AI Suggestions...' : 'Get AI Suggestions'}
              </Text>
            </TouchableOpacity>
          )}

          {/* QR Preview */}
          {!!uniqueId && (
            <View ref={qrContainerRef} style={styles.qrContainer} collapsable={false}>
              <Text style={styles.qrTitle}>{name}</Text>
              <View style={styles.qrBox}>
                <QRCode
                  value={uniqueId}
                  size={Math.min(width - 120, 220)}
                  backgroundColor="#FFFFFF"
                  color="#000000"
                  getRef={(c) => (qrRef.current = c)}
                />
              </View>
              <Text style={styles.qrSubtitle}>Scan to view cow details</Text>
            </View>
          )}

          <View style={styles.row}>
            <TouchableOpacity style={[styles.actionButton, styles.actionFlex]} onPress={handleGenerate}>
              <Ionicons name="key" size={18} color="#fff" />
              <Text style={styles.actionText}>Generate ID</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionButton, styles.actionFlex, { backgroundColor: '#25D366' }]} onPress={handleDownloadQr}>
              <Ionicons name="logo-whatsapp" size={18} color="#fff" />
              <Text style={styles.actionText}>Share via WhatsApp</Text>
            </TouchableOpacity>
          </View>

          {uniqueId ? (
            <View style={styles.idBox}>
              <Text style={styles.idLabel}>Unique ID</Text>
              <Text style={styles.idValue}>{uniqueId}</Text>
            </View>
          ) : null}

          <TouchableOpacity 
            style={[styles.submitButton, (isLoading || !isQrGenerated) && styles.submitButtonDisabled]} 
            onPress={handleSubmit}
            disabled={isLoading || !isQrGenerated}
          >
            <Text style={styles.submitText}>
              {isLoading ? 'Saving...' : 'Save'}
            </Text>
            {!isLoading && <Ionicons name="checkmark" size={18} color="#fff" />}
          </TouchableOpacity>
        </View>

        {/* Date Picker Modal */}
        <Modal
          visible={showDatePicker}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setShowDatePicker(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Select Date of Birth</Text>
                <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                  <Ionicons name="close" size={24} color="#2c3e50" />
                </TouchableOpacity>
              </View>
              
              {Platform.OS === 'ios' ? (
                <View style={styles.datePickerContainer}>
                  <Text style={styles.datePreview}>
                    {formatDate(selectedDate)}
                  </Text>
                  <View style={styles.dateInputRow}>
                    <TouchableOpacity 
                      style={styles.dateButton}
                      onPress={() => {
                        const newDate = new Date(selectedDate);
                        newDate.setDate(newDate.getDate() - 1);
                        setSelectedDate(newDate);
                      }}
                    >
                      <Ionicons name="chevron-back" size={20} color="#4CAF50" />
                    </TouchableOpacity>
                    <Text style={styles.dateDisplay}>{formatDate(selectedDate)}</Text>
                    <TouchableOpacity 
                      style={styles.dateButton}
                      onPress={() => {
                        const newDate = new Date(selectedDate);
                        newDate.setDate(newDate.getDate() + 1);
                        setSelectedDate(newDate);
                      }}
                    >
                      <Ionicons name="chevron-forward" size={20} color="#4CAF50" />
                    </TouchableOpacity>
                  </View>
                  <View style={styles.datePickerButtons}>
                    <TouchableOpacity 
                      style={[styles.modalButton, styles.cancelButton]}
                      onPress={() => setShowDatePicker(false)}
                    >
                      <Text style={styles.cancelButtonText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={[styles.modalButton, styles.confirmButton]}
                      onPress={handleDateSelect}
                    >
                      <Text style={styles.confirmButtonText}>Confirm</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <View style={styles.datePickerContainer}>
                  <View style={styles.androidDatePicker}>
                    <Text style={styles.dateLabel}>Year:</Text>
                    <TextInput
                      style={styles.dateInputField}
                      value={String(selectedDate.getFullYear())}
                      onChangeText={(text) => {
                        const year = parseInt(text) || selectedDate.getFullYear();
                        const newDate = new Date(selectedDate);
                        newDate.setFullYear(year);
                        setSelectedDate(newDate);
                      }}
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={styles.androidDatePicker}>
                    <Text style={styles.dateLabel}>Month:</Text>
                    <Picker
                      selectedValue={selectedDate.getMonth() + 1}
                      onValueChange={(month) => {
                        const newDate = new Date(selectedDate);
                        newDate.setMonth(month - 1);
                        setSelectedDate(newDate);
                      }}
                      style={styles.monthPicker}
                    >
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                        <Picker.Item key={month} label={String(month)} value={month} />
                      ))}
                    </Picker>
                  </View>
                  <View style={styles.androidDatePicker}>
                    <Text style={styles.dateLabel}>Day:</Text>
                    <TextInput
                      style={styles.dateInputField}
                      value={String(selectedDate.getDate())}
                      onChangeText={(text) => {
                        const day = parseInt(text) || selectedDate.getDate();
                        const newDate = new Date(selectedDate);
                        newDate.setDate(day);
                        setSelectedDate(newDate);
                      }}
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={styles.datePickerButtons}>
                    <TouchableOpacity 
                      style={[styles.modalButton, styles.cancelButton]}
                      onPress={() => setShowDatePicker(false)}
                    >
                      <Text style={styles.cancelButtonText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={[styles.modalButton, styles.confirmButton]}
                      onPress={handleDateSelect}
                    >
                      <Text style={styles.confirmButtonText}>Confirm</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          </View>
        </Modal>

        {/* AI Suggestions Modal */}
        <Modal
          visible={showAISuggestions}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setShowAISuggestions(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <View style={styles.modalHeaderLeft}>
                  <Ionicons name="sparkles" size={24} color="#4CAF50" />
                  <Text style={styles.modalTitle}>AI Suggestions</Text>
                </View>
                <TouchableOpacity onPress={() => setShowAISuggestions(false)}>
                  <Ionicons name="close" size={24} color="#2c3e50" />
                </TouchableOpacity>
              </View>
              
              <ScrollView style={styles.aiSuggestionsContent}>
                <Text style={styles.aiSuggestionsText}>{aiSuggestions}</Text>
              </ScrollView>

              <View style={styles.modalButtons}>
                <TouchableOpacity 
                  style={[styles.modalButton, styles.confirmButton]}
                  onPress={() => setShowAISuggestions(false)}
                >
                  <Text style={styles.confirmButtonText}>Got it</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
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
  qrContainer: {
    marginTop: 20,
    marginBottom: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 12,
  },
  qrTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 16,
    textAlign: 'center',
  },
  qrBox: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 12,
    borderWidth: 3,
    borderColor: '#4CAF50',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  qrSubtitle: {
    fontSize: 12,
    color: '#7f8c8d',
    marginTop: 12,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  submitButton: {
    marginTop: 18,
    backgroundColor: '#4CAF50',
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitText: { color: '#fff', fontSize: 16, fontWeight: 'bold', marginRight: 8 },
  dateInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e6e8eb',
    paddingHorizontal: 12,
  },
  dateInput: {
    flex: 1,
    borderWidth: 0,
    paddingHorizontal: 0,
  },
  dateIcon: {
    marginLeft: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '50%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  aiButton: {
    marginTop: 16,
    backgroundColor: '#9333ea',
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  aiButtonDisabled: {
    opacity: 0.6,
  },
  aiButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  aiSuggestionsContent: {
    maxHeight: 400,
    marginBottom: 20,
  },
  aiSuggestionsText: {
    fontSize: 15,
    lineHeight: 22,
    color: '#2c3e50',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 10,
  },
  datePickerContainer: {
    paddingVertical: 10,
  },
  datePreview: {
    fontSize: 16,
    color: '#2c3e50',
    textAlign: 'center',
    marginBottom: 20,
    fontWeight: '600',
  },
  dateInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  dateButton: {
    padding: 10,
  },
  dateDisplay: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginHorizontal: 20,
    minWidth: 120,
    textAlign: 'center',
  },
  androidDatePicker: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  dateLabel: {
    fontSize: 16,
    color: '#2c3e50',
    marginRight: 10,
    minWidth: 60,
  },
  dateInputField: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e6e8eb',
    fontSize: 16,
    color: '#2c3e50',
  },
  monthPicker: {
    flex: 1,
    height: 50,
  },
  datePickerButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginHorizontal: 5,
  },
  cancelButton: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e6e8eb',
  },
  confirmButton: {
    backgroundColor: '#4CAF50',
  },
  cancelButtonText: {
    color: '#2c3e50',
    fontSize: 16,
    fontWeight: '600',
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});


