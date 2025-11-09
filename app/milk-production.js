import React, { useMemo, useState, useEffect } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView, Alert, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { database } from '../firebaseConfig';
import { ref, get, set, child } from 'firebase/database';

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
  const [mode, setMode] = useState('initial'); // 'initial', 'cowSelected', 'enterData', 'viewDetails'
  const [activeSession, setActiveSession] = useState('Morning');
  const [searchQuery, setSearchQuery] = useState('');
  const [cowData, setCowData] = useState(null);
  const [records, setRecords] = useState({}); // { 'YYYY-MM-DD': { morning: {...}, evening: {...} } }
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [scanVisible, setScanVisible] = useState(false);
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [tempSelectedDate, setTempSelectedDate] = useState(new Date());
  const [permission, requestPermission] = useCameraPermissions();
  const [isLoading, setIsLoading] = useState(false);
  const [userPhone, setUserPhone] = useState('');

  // Get user phone number from AsyncStorage
  useEffect(() => {
    const getUserPhone = async () => {
      try {
        const phone = await AsyncStorage.getItem('userPhone');
        if (phone) {
          setUserPhone(phone);
        }
      } catch (error) {
        console.error('Error getting user phone:', error);
      }
    };
    getUserPhone();
  }, []);

  const dateKey = useMemo(() => {
    const y = selectedDate.getFullYear();
    const m = String(selectedDate.getMonth() + 1).padStart(2, '0');
    const d = String(selectedDate.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }, [selectedDate]);

  const todayKey = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }, []);

  const currentRecord = records[dateKey]?.[activeSession.toLowerCase()] || null;
  const hasAnyRecord = records[dateKey] && (records[dateKey].morning || records[dateKey].evening);

  const formatPrettyDate = (date) => {
    return date.toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
  };

  const formatDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Fetch cow data from Firebase by ID or name
  const fetchCowData = async (searchValue) => {
    setIsLoading(true);
    try {
      const dbRef = ref(database);
      
      // Try to find by uniqueId first
      const cowSnapshot = await get(child(dbRef, `CowFarm/cows/${searchValue}`));
      
      if (cowSnapshot.exists()) {
        const cow = cowSnapshot.val();
        setCowData({ ...cow, uniqueId: searchValue });
        setMode('cowSelected');
        setIsLoading(false);
        return true;
      }

      // If not found by ID, search by name
      const cowsRef = ref(database, 'CowFarm/cows');
      const allCowsSnapshot = await get(cowsRef);
      
      if (allCowsSnapshot.exists()) {
        const allCows = allCowsSnapshot.val();
        const foundCow = Object.entries(allCows).find(([id, cow]) => 
          cow.name && cow.name.toLowerCase().includes(searchValue.toLowerCase())
        );
        
        if (foundCow) {
          const [id, cow] = foundCow;
          setCowData({ ...cow, uniqueId: id });
          setMode('cowSelected');
          setIsLoading(false);
          return true;
        }
      }

      Alert.alert('Not Found', 'Cow not found. Please check the ID or name and try again.');
      setIsLoading(false);
      return false;
    } catch (error) {
      console.error('Error fetching cow data:', error);
      Alert.alert('Error', 'Failed to fetch cow data: ' + error.message);
      setIsLoading(false);
      return false;
    }
  };

  // Load milk production data for selected date
  const loadMilkData = async (date) => {
    if (!cowData || !cowData.uniqueId) return;
    
    setIsLoading(true);
    try {
      const dbRef = ref(database);
      const milkPath = `CowFarm/milkProduction/${cowData.uniqueId}/${date}`;
      const milkSnapshot = await get(child(dbRef, milkPath));
      
      if (milkSnapshot.exists()) {
        const milkData = milkSnapshot.val();
        setRecords(prev => ({
          ...prev,
          [date]: {
            morning: milkData.morning || {},
            evening: milkData.evening || {}
          }
        }));
      } else {
        // Initialize empty record for this date
        setRecords(prev => ({
          ...prev,
          [date]: {
            morning: {},
            evening: {}
          }
        }));
      }
      setIsLoading(false);
    } catch (error) {
      console.error('Error loading milk data:', error);
      setIsLoading(false);
    }
  };

  const handleScan = ({ data }) => {
    setScanVisible(false);
    setSearchQuery(data);
    fetchCowData(data);
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      Alert.alert('Enter Search', 'Please scan QR code or enter cow ID/name');
      return;
    }
    await fetchCowData(searchQuery.trim());
  };

  const handleEnterData = () => {
    setSelectedDate(new Date());
    setMode('enterData');
    loadMilkData(todayKey);
  };

  const handleViewDetails = () => {
    setMode('viewDetails');
    loadMilkData(dateKey);
  };

  const updateRecord = (field, value) => {
    setRecords((prev) => ({
      ...prev,
      [dateKey]: {
        ...(prev[dateKey] || { morning: {}, evening: {} }),
        [activeSession.toLowerCase()]: {
          ...(prev[dateKey]?.[activeSession.toLowerCase()] || {}),
          [field]: value,
        },
      },
    }));
  };

  const handleSave = async () => {
    if (!cowData || !cowData.uniqueId) {
      Alert.alert('Error', 'Cow data not found');
      return;
    }

    setIsLoading(true);
    try {
      const milkData = {
        morning: records[dateKey]?.morning || {},
        evening: records[dateKey]?.evening || {},
        cowId: cowData.uniqueId,
        cowName: cowData.name,
        date: dateKey,
        updatedAt: new Date().toISOString(),
        userPhoneNumber: userPhone
      };

      const dbRef = ref(database);
      const milkPath = `CowFarm/milkProduction/${cowData.uniqueId}/${dateKey}`;
      await set(child(dbRef, milkPath), milkData);

      Alert.alert('Success', `${activeSession} session saved for ${formatPrettyDate(selectedDate)}`, [
        { text: 'OK', onPress: () => setMode('cowSelected') }
      ]);
      setIsLoading(false);
    } catch (error) {
      console.error('Error saving milk data:', error);
      Alert.alert('Error', 'Failed to save milk data: ' + error.message);
      setIsLoading(false);
    }
  };

  const goPrevDay = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() - 1);
    setSelectedDate(newDate);
    loadMilkData(formatDate(newDate));
  };

  const goNextDay = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + 1);
    setSelectedDate(newDate);
    loadMilkData(formatDate(newDate));
  };

  const goToday = () => {
    const now = new Date();
    setSelectedDate(now);
    loadMilkData(todayKey);
  };

  const handleDateSelect = () => {
    setSelectedDate(new Date(tempSelectedDate));
    const dateStr = formatDate(tempSelectedDate);
    loadMilkData(dateStr);
    setDatePickerVisible(false);
  };

  const openDatePicker = () => {
    setTempSelectedDate(new Date(selectedDate));
    setDatePickerVisible(true);
  };

  const getDaysInMonth = (date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const getTotalMilk = () => {
    const dayRecord = records[dateKey];
    if (!dayRecord) return 0;
    const morning = parseFloat(dayRecord.morning?.milkQuantity || 0);
    const evening = parseFloat(dayRecord.evening?.milkQuantity || 0);
    return (morning + evening).toFixed(1);
  };

  const renderCalendar = () => {
    const daysInMonth = getDaysInMonth(tempSelectedDate);
    const firstDay = getFirstDayOfMonth(tempSelectedDate);
    const days = [];
    
    for (let i = 0; i < firstDay; i++) {
      days.push(null);
    }
    
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(day);
    }
    
    const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 
                   'July', 'August', 'September', 'October', 'November', 'December'];
    
    return (
      <View style={styles.calendarContainer}>
        <View style={styles.calendarHeader}>
          <TouchableOpacity 
            onPress={() => {
              const newDate = new Date(tempSelectedDate);
              newDate.setMonth(newDate.getMonth() - 1);
              setTempSelectedDate(newDate);
            }}
            style={styles.calendarNavButton}
          >
            <Ionicons name="chevron-back" size={20} color="#2c3e50" />
          </TouchableOpacity>
          
          <Text style={styles.calendarMonthText}>
            {months[tempSelectedDate.getMonth()]} {tempSelectedDate.getFullYear()}
          </Text>
          
          <TouchableOpacity 
            onPress={() => {
              const newDate = new Date(tempSelectedDate);
              newDate.setMonth(newDate.getMonth() + 1);
              setTempSelectedDate(newDate);
            }}
            style={styles.calendarNavButton}
          >
            <Ionicons name="chevron-forward" size={20} color="#2c3e50" />
          </TouchableOpacity>
        </View>
        
        <View style={styles.weekDaysRow}>
          {weekDays.map((day) => (
            <View key={day} style={styles.weekDayCell}>
              <Text style={styles.weekDayText}>{day}</Text>
            </View>
          ))}
        </View>
        
        <View style={styles.calendarGrid}>
          {days.map((day, index) => {
            if (day === null) {
              return <View key={index} style={styles.calendarCell} />;
            }
            
            const isSelected = day === tempSelectedDate.getDate();
            const isToday = day === new Date().getDate() &&
                           tempSelectedDate.getMonth() === new Date().getMonth() &&
                           tempSelectedDate.getFullYear() === new Date().getFullYear();
            
            return (
              <TouchableOpacity
                key={index}
                style={[
                  styles.calendarCell,
                  isSelected && styles.calendarCellSelected,
                  isToday && !isSelected && styles.calendarCellToday
                ]}
                onPress={() => {
                  const newDate = new Date(tempSelectedDate);
                  newDate.setDate(day);
                  setTempSelectedDate(newDate);
                }}
              >
                <Text style={[
                  styles.calendarDayText,
                  isSelected && styles.calendarDayTextSelected,
                  isToday && !isSelected && styles.calendarDayTextToday
                ]}>
                  {day}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  };

  const renderMilkForm = () => (
    <View style={styles.card}>
      <View style={styles.cowInfo}>
        <Ionicons name="cow" size={20} color="#10b981" />
        <View style={styles.cowMeta}>
          <Text style={styles.cowIdText} numberOfLines={1} ellipsizeMode="tail">
            {cowData?.uniqueId || 'No Cow Selected'}
          </Text>
          {cowData?.name && (
            <Text style={styles.cowNameText} numberOfLines={1} ellipsizeMode="tail">{cowData.name}</Text>
          )}
        </View>
      </View>

      <Text style={styles.label}>Milk Quantity (Liters)</Text>
      <TextInput 
        value={currentRecord?.milkQuantity || ''} 
        onChangeText={(v) => updateRecord('milkQuantity', v)} 
        style={styles.input} 
        placeholder="Enter milk quantity"
        keyboardType="decimal-pad"
        editable={mode === 'enterData'}
      />

      <Text style={styles.label}>Milk Quality</Text>
      <View style={styles.qualityRow}>
        {['Excellent', 'Good', 'Fair', 'Poor'].map((quality) => (
          <TouchableOpacity
            key={quality}
            onPress={() => mode === 'enterData' && updateRecord('milkQuality', quality)}
            style={[
              styles.qualityButton,
              currentRecord?.milkQuality === quality && styles.qualityButtonActive,
              mode === 'viewDetails' && styles.qualityButtonDisabled
            ]}
            disabled={mode === 'viewDetails'}
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
        keyboardType="decimal-pad"
        editable={mode === 'enterData'}
      />

      <Text style={styles.label}>Notes</Text>
      <TextInput
        value={currentRecord?.notes || ''}
        onChangeText={(v) => updateRecord('notes', v)}
        style={[styles.input, styles.textarea]}
        placeholder="Any additional notes..."
        multiline
        editable={mode === 'enterData'}
      />
    </View>
  );

  // Initial Screen - Only Scan Option
  if (mode === 'initial') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.back}>
            <Ionicons name="arrow-back" size={22} color="#2c3e50" />
          </TouchableOpacity>
          <Text style={styles.title}>Milk Production</Text>
          <Text style={styles.subtitle}>Scan QR code to get started</Text>
        </View>

        <View style={styles.initialContainer}>
          <View style={styles.scanIconContainer}>
            <Ionicons name="water-outline" size={80} color="#2196F3" />
          </View>
          <Text style={styles.initialTitle}>Scan Cow QR Code</Text>
          <Text style={styles.initialSubtitle}>Point your camera at the cow&apos;s QR code to record milk production</Text>
          
          <TouchableOpacity 
            style={styles.scanButton} 
            onPress={() => setScanVisible(true)}
            disabled={isLoading}
          >
            <Ionicons name="camera" size={24} color="#fff" />
            <Text style={styles.scanButtonText}>Scan QR Code</Text>
          </TouchableOpacity>

          <View style={styles.searchContainer}>
            <Text style={styles.orText}>OR</Text>
            <View style={styles.searchBox}>
              <TextInput
                placeholder="Search by Cow ID or Name"
                value={searchQuery}
                onChangeText={setSearchQuery}
                style={styles.searchInput}
              />
            </View>
            <TouchableOpacity 
              style={styles.searchButton} 
              onPress={handleSearch}
              disabled={isLoading}
            >
              <Ionicons name="search" size={20} color="#fff" />
              <Text style={styles.searchButtonText}>Search</Text>
            </TouchableOpacity>
          </View>
        </View>

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

  // Cow Selected - Show Action Buttons
  if (mode === 'cowSelected') {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => {
              setMode('initial');
              setCowData(null);
              setSearchQuery('');
            }} style={styles.back}>
              <Ionicons name="arrow-back" size={22} color="#2c3e50" />
            </TouchableOpacity>
            <Text style={styles.title}>Milk Production</Text>
            <Text style={styles.subtitle}>{cowData?.name || 'Cow Details'}</Text>
          </View>

          <View style={styles.cowInfoCard}>
            <Text style={styles.cowName}>{cowData?.name || 'Unknown'}</Text>
            <Text style={styles.cowId}>ID: {cowData?.uniqueId}</Text>
            <Text style={styles.cowBreed}>Breed: {cowData?.breed || 'N/A'}</Text>
          </View>

          <View style={styles.actionButtonsContainer}>
            <TouchableOpacity style={styles.actionButton} onPress={handleEnterData}>
              <Ionicons name="create-outline" size={32} color="#fff" />
              <Text style={styles.actionButtonText}>Enter Today&apos;s Data</Text>
              <Text style={styles.actionButtonSubtext}>Record milk production for today</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.actionButton, styles.viewButton]} onPress={handleViewDetails}>
              <Ionicons name="eye-outline" size={32} color="#fff" />
              <Text style={styles.actionButtonText}>View Details</Text>
              <Text style={styles.actionButtonSubtext}>View production by date</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Enter Data or View Details Mode
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setMode('cowSelected')} style={styles.back}>
            <Ionicons name="arrow-back" size={22} color="#2c3e50" />
          </TouchableOpacity>
          <Text style={styles.title}>
            {mode === 'enterData' ? "Enter Today's Data" : 'View Details'}
          </Text>
          <Text style={styles.subtitle}>{cowData?.name || 'Cow Details'}</Text>
        </View>

        {mode === 'viewDetails' && (
          <View style={styles.dateRow}>
            <TouchableOpacity onPress={goPrevDay} style={[styles.chipBtn, styles.chipBtnLight]}>
              <Ionicons name="chevron-back" size={14} color="#2c3e50" />
              <Text style={styles.chipTextDark}>Prev</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={openDatePicker}
              style={styles.datePill}
            >
              <Ionicons name="calendar" size={14} color="#2c3e50" />
              <Text style={styles.dateText} numberOfLines={1}>{formatPrettyDate(selectedDate)}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={goNextDay} style={[styles.chipBtn, styles.chipBtnLight]}>
              <Text style={styles.chipTextDark}>Next</Text>
              <Ionicons name="chevron-forward" size={14} color="#2c3e50" />
            </TouchableOpacity>
            <TouchableOpacity onPress={goToday} style={[styles.chipBtn, styles.chipBtnPrimary]}>
              <Ionicons name="flash" size={14} color="#fff" />
              <Text style={styles.chipTextLight}>Today</Text>
            </TouchableOpacity>
          </View>
        )}

        {mode === 'enterData' && (
          <View style={styles.todayBadge}>
            <Ionicons name="calendar" size={16} color="#2196F3" />
            <Text style={styles.todayText}>Today: {formatPrettyDate(new Date())}</Text>
          </View>
        )}

        {/* Daily Total */}
        {hasAnyRecord && (
          <View style={styles.totalCard}>
            <Ionicons name="water" size={24} color="#2196F3" />
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

        {currentRecord || mode === 'enterData' ? renderMilkForm() : (
          <View style={styles.placeholder}> 
            <Ionicons name="water" size={28} color="#9aa3a9" />
            <Text style={styles.placeholderText}>
              {mode === 'viewDetails' 
                ? `No data found for ${formatPrettyDate(selectedDate)}.`
                : 'Start entering milk production data for today.'}
            </Text>
          </View>
        )}

        {mode === 'enterData' && (
          <TouchableOpacity 
            style={[styles.saveBtn, isLoading && styles.saveBtnDisabled]} 
            onPress={handleSave}
            disabled={isLoading}
          >
            <Text style={styles.saveText}>
              {isLoading ? 'Saving...' : `Save ${activeSession} Session`}
            </Text>
            {!isLoading && <Ionicons name="checkmark" size={18} color="#fff" />}
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* Date Picker Modal */}
      <Modal
        visible={datePickerVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setDatePickerVisible(false)}
      >
        <View style={styles.datePickerModalOverlay}>
          <View style={styles.datePickerModalContent}>
            <View style={styles.datePickerModalHeader}>
              <Text style={styles.datePickerModalTitle}>Select Date</Text>
              <TouchableOpacity onPress={() => setDatePickerVisible(false)}>
                <Ionicons name="close" size={24} color="#2c3e50" />
              </TouchableOpacity>
            </View>
            
            {renderCalendar()}
            
            <View style={styles.datePickerButtons}>
              <TouchableOpacity 
                style={[styles.datePickerButton, styles.datePickerCancelButton]}
                onPress={() => setDatePickerVisible(false)}
              >
                <Text style={styles.datePickerCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.datePickerButton, styles.datePickerConfirmButton]}
                onPress={handleDateSelect}
              >
                <Text style={styles.datePickerConfirmText}>Select</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  content: { padding: 20, paddingBottom: 32 },
  header: { marginBottom: 10 },
  back: { padding: 6, alignSelf: 'flex-start' },
  title: { fontSize: 24, fontWeight: '800', color: '#1f2937', marginTop: 6, paddingLeft: 10 },
  subtitle: { fontSize: 14, color: '#6b7280', marginTop: 2, paddingLeft: 10 },

  // Initial Screen Styles
  initialContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  scanIconContainer: {
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: '#e3f2fd',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 30,
  },
  initialTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 10,
  },
  initialSubtitle: {
    fontSize: 16,
    color: '#7f8c8d',
    textAlign: 'center',
    paddingHorizontal: 40,
    marginBottom: 40,
  },
  scanButton: {
    backgroundColor: '#2196F3',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 32,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 30,
    shadowColor: '#2196F3',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 8,
  },
  scanButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  searchContainer: {
    width: '100%',
    paddingHorizontal: 20,
  },
  orText: {
    textAlign: 'center',
    color: '#7f8c8d',
    marginBottom: 15,
    fontSize: 14,
  },
  searchBox: {
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e6e8eb',
    marginBottom: 10,
  },
  searchInput: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: '#2c3e50',
  },
  searchButton: {
    backgroundColor: '#2196F3',
    borderRadius: 10,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },

  // Cow Selected Screen
  cowInfoCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#eef2f7',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  cowName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 8,
  },
  cowId: {
    fontSize: 14,
    color: '#7f8c8d',
    marginBottom: 4,
  },
  cowBreed: {
    fontSize: 14,
    color: '#7f8c8d',
  },
  actionButtonsContainer: {
    gap: 15,
  },
  actionButton: {
    backgroundColor: '#2196F3',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#2196F3',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 8,
  },
  viewButton: {
    backgroundColor: '#4CAF50',
    shadowColor: '#4CAF50',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 12,
    marginBottom: 4,
  },
  actionButtonSubtext: {
    color: '#fff',
    fontSize: 14,
    opacity: 0.9,
  },

  // Date Navigation
  dateRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginTop: 8, 
    marginBottom: 16,
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

  todayBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e3f2fd',
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginBottom: 16,
    alignSelf: 'flex-start',
  },
  todayText: {
    color: '#2196F3',
    fontWeight: '600',
    marginLeft: 8,
    fontSize: 14,
  },

  // Total Card
  totalCard: {
    backgroundColor: '#e3f2fd',
    borderRadius: 16,
    padding: 16,
    marginTop: 16,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#bae6fd',
  },
  totalInfo: { marginLeft: 12, flex: 1 },
  totalLabel: { fontSize: 14, color: '#0369a1', fontWeight: '600' },
  totalValue: { fontSize: 20, color: '#0c4a6e', fontWeight: '800', marginTop: 2 },

  // Sessions
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

  // Form
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
  qualityButtonDisabled: {
    opacity: 0.6,
  },
  qualityText: { fontSize: 12, color: '#6b7280', fontWeight: '600' },
  qualityTextActive: { color: '#fff' },

  placeholder: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40 },
  placeholderText: { marginTop: 8, color: '#9aa3a9', textAlign: 'center', paddingHorizontal: 20 },

  saveBtn: { marginTop: 20, backgroundColor: '#10b981', borderRadius: 12, paddingVertical: 14, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  saveBtnDisabled: { opacity: 0.6 },
  saveText: { color: '#fff', fontSize: 16, fontWeight: 'bold', marginRight: 8 },

  // Scanner
  scanContainer: { flex: 1, backgroundColor: '#000' },
  scanTitle: { color: '#fff', textAlign: 'center', padding: 16, fontWeight: 'bold', fontSize: 16 },
  scannerBox: { flex: 1 },
  scanInfo: { color: '#fff', textAlign: 'center', marginTop: 16 },
  scanClose: { padding: 14, backgroundColor: '#111', alignItems: 'center' },
  scanCloseText: { color: '#fff', fontWeight: '600' },
  searchBtn: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#10b981', borderRadius: 10, paddingVertical: 12, paddingHorizontal: 14,
    marginLeft: 4,
  },
  searchText: { color: '#fff', fontSize: 15, fontWeight: '600', marginLeft: 6 },

  // Date Picker Modal Styles
  datePickerModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  datePickerModalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%',
  },
  datePickerModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  datePickerModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  calendarContainer: {
    marginBottom: 20,
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingHorizontal: 10,
  },
  calendarNavButton: {
    padding: 8,
  },
  calendarMonthText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  weekDaysRow: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  weekDayCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  weekDayText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calendarCell: {
    width: '14.28%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
  },
  calendarCellSelected: {
    backgroundColor: '#4CAF50',
    borderRadius: 20,
  },
  calendarCellToday: {
    backgroundColor: '#e8f5e8',
    borderRadius: 20,
  },
  calendarDayText: {
    fontSize: 14,
    color: '#2c3e50',
    fontWeight: '500',
  },
  calendarDayTextSelected: {
    color: '#fff',
    fontWeight: 'bold',
  },
  calendarDayTextToday: {
    color: '#4CAF50',
    fontWeight: 'bold',
  },
  datePickerButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
    gap: 10,
  },
  datePickerButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  datePickerCancelButton: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e6e8eb',
  },
  datePickerConfirmButton: {
    backgroundColor: '#4CAF50',
  },
  datePickerCancelText: {
    color: '#2c3e50',
    fontSize: 16,
    fontWeight: '600',
  },
  datePickerConfirmText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
