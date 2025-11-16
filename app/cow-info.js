import React, { useMemo, useState, useEffect } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView, Alert, Modal, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { database } from '../firebaseConfig';
import { ref, get, set, child } from 'firebase/database';

const TABS = ['Overview', 'Vitals', 'Production', 'Intake', 'Health'];

function TabButton({ label, active, onPress }) {
  return (
    <TouchableOpacity onPress={onPress} style={[styles.tabButton, active && styles.tabButtonActive]}>
      <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function CowInfoScreen() {
  const [mode, setMode] = useState('initial'); // 'initial', 'listCows', 'cowSelected', 'enterReport', 'viewDetails'
  const [activeTab, setActiveTab] = useState('Overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [cowData, setCowData] = useState(null); // Cow registration data
  const [records, setRecords] = useState({}); // { 'YYYY-MM-DD': { ...fields } }
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [scanVisible, setScanVisible] = useState(false);
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [tempSelectedDate, setTempSelectedDate] = useState(new Date());
  const [permission, requestPermission] = useCameraPermissions();
  const [isLoading, setIsLoading] = useState(false);
  const [userPhone, setUserPhone] = useState('');
  const [allCows, setAllCows] = useState([]); // List of all cows
  const [filteredCows, setFilteredCows] = useState([]); // Filtered cows for search
  const [isLoadingCows, setIsLoadingCows] = useState(false);

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

  // Load cows when entering list mode and userPhone is available
  useEffect(() => {
    if (mode === 'listCows' && userPhone) {
      loadAllCows();
    }
  }, [mode, userPhone]);

  // Load all cows when entering list mode
  const loadAllCows = async () => {
    if (!userPhone) return;
    
    setIsLoadingCows(true);
    try {
      const cowsRef = ref(database, 'CowFarm/cows');
      const allCowsSnapshot = await get(cowsRef);
      
      if (allCowsSnapshot.exists()) {
        const allCowsData = allCowsSnapshot.val();
        // Filter cows by user phone number
        const userCows = Object.entries(allCowsData)
          .filter(([id, cow]) => cow.userPhoneNumber === userPhone)
          .map(([id, cow]) => ({
            ...cow,
            uniqueId: id,
          }))
          .sort((a, b) => {
            // Sort by name alphabetically
            const nameA = (a.name || '').toLowerCase();
            const nameB = (b.name || '').toLowerCase();
            return nameA.localeCompare(nameB);
          });
        
        setAllCows(userCows);
        setFilteredCows(userCows);
      } else {
        setAllCows([]);
        setFilteredCows([]);
      }
    } catch (error) {
      console.error('Error loading cows:', error);
      Alert.alert('Error', 'Failed to load cows: ' + error.message);
      setAllCows([]);
      setFilteredCows([]);
    } finally {
      setIsLoadingCows(false);
    }
  };

  // Filter cows based on search query
  useEffect(() => {
    if (mode === 'listCows' && searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const filtered = allCows.filter(cow => 
        cow.name?.toLowerCase().includes(query) ||
        cow.uniqueId?.toLowerCase().includes(query) ||
        cow.breed?.toLowerCase().includes(query)
      );
      setFilteredCows(filtered);
    } else if (mode === 'listCows') {
      setFilteredCows(allCows);
    }
  }, [searchQuery, allCows, mode]);

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

  const data = records[dateKey] || null;

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

      // If not found by ID, search by name (need to query all cows)
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

  // Load daily report for selected date
  const loadDailyReport = async (date) => {
    if (!cowData || !cowData.uniqueId) return;
    
    setIsLoading(true);
    try {
      const dbRef = ref(database);
      const reportPath = `CowFarm/reports/${cowData.uniqueId}/${date}`;
      const reportSnapshot = await get(child(dbRef, reportPath));
      
      if (reportSnapshot.exists()) {
        const report = reportSnapshot.val();
        setRecords(prev => ({
          ...prev,
          [date]: report
        }));
      } else {
        // Initialize empty record for this date
        setRecords(prev => ({
          ...prev,
          [date]: {}
        }));
      }
      setIsLoading(false);
    } catch (error) {
      console.error('Error loading daily report:', error);
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

  const handleListCows = () => {
    setMode('listCows');
    // loadAllCows will be called by useEffect when mode changes
  };

  const handleSelectCow = (cow) => {
    setCowData(cow);
    setMode('cowSelected');
    setSearchQuery('');
  };

  const handleEnterReport = () => {
    setSelectedDate(new Date());
    setMode('enterReport');
    loadDailyReport(todayKey);
  };

  const handleViewDetails = () => {
    setMode('viewDetails');
    loadDailyReport(dateKey);
  };

  const updateRecord = (field, value) => {
    setRecords((prev) => ({
      ...prev,
      [dateKey]: {
        ...(prev[dateKey] || {}),
        [field]: value,
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
      const reportData = {
        ...records[dateKey],
        cowId: cowData.uniqueId,
        cowName: cowData.name,
        date: dateKey,
        updatedAt: new Date().toISOString(),
        userPhoneNumber: userPhone
      };

      const dbRef = ref(database);
      const reportPath = `CowFarm/reports/${cowData.uniqueId}/${dateKey}`;
      await set(child(dbRef, reportPath), reportData);

      Alert.alert('Success', `Report saved for ${formatPrettyDate(selectedDate)}`, [
        { text: 'OK', onPress: () => setMode('cowSelected') }
      ]);
      setIsLoading(false);
    } catch (error) {
      console.error('Error saving report:', error);
      Alert.alert('Error', 'Failed to save report: ' + error.message);
      setIsLoading(false);
    }
  };

  const goPrevDay = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() - 1);
    setSelectedDate(newDate);
    loadDailyReport(formatDate(newDate));
  };

  const goNextDay = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + 1);
    setSelectedDate(newDate);
    loadDailyReport(formatDate(newDate));
  };

  const goToday = () => {
    const now = new Date();
    setSelectedDate(now);
    loadDailyReport(todayKey);
  };

  const handleDateSelect = () => {
    setSelectedDate(new Date(tempSelectedDate));
    const dateStr = formatDate(tempSelectedDate);
    loadDailyReport(dateStr);
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

  const renderCalendar = () => {
    const daysInMonth = getDaysInMonth(tempSelectedDate);
    const firstDay = getFirstDayOfMonth(tempSelectedDate);
    const days = [];
    
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < firstDay; i++) {
      days.push(null);
    }
    
    // Add days of the month
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

  const renderOverview = () => (
    <View style={styles.card}>
      <Text style={styles.label}>Cow ID</Text>
      <TextInput value={cowData?.uniqueId || ''} editable={false} style={[styles.input, styles.disabledInput]} />

      <Text style={styles.label}>Name</Text>
      <TextInput value={cowData?.name || ''} editable={false} style={[styles.input, styles.disabledInput]} />

      <Text style={styles.label}>Breed</Text>
      <TextInput value={cowData?.breed || ''} editable={false} style={[styles.input, styles.disabledInput]} />

      <Text style={styles.label}>Date of Birth</Text>
      <TextInput value={cowData?.dob || ''} editable={false} style={[styles.input, styles.disabledInput]} />
    </View>
  );

  const renderVitals = () => (
    <View style={styles.card}>
      <Text style={styles.label}>Weight (kg)</Text>
      <TextInput 
        value={data?.weight || ''} 
        onChangeText={(v) => updateRecord('weight', v)} 
        style={styles.input}
        keyboardType="decimal-pad"
        placeholder="Enter weight"
      />

      <Text style={styles.label}>Height (cm)</Text>
      <TextInput 
        value={data?.height || ''} 
        onChangeText={(v) => updateRecord('height', v)} 
        style={styles.input}
        keyboardType="decimal-pad"
        placeholder="Enter height"
      />

      <Text style={styles.label}>Temperature (°C)</Text>
      <TextInput 
        value={data?.temperature || ''} 
        onChangeText={(v) => updateRecord('temperature', v)} 
        style={styles.input}
        keyboardType="decimal-pad"
        placeholder="Enter temperature"
      />
    </View>
  );

  const renderProduction = () => (
    <View style={styles.card}>
      <Text style={styles.label}>Milk yield (L/day)</Text>
      <TextInput 
        value={data?.milkYield || ''} 
        onChangeText={(v) => updateRecord('milkYield', v)} 
        style={styles.input}
        keyboardType="decimal-pad"
        placeholder="Enter milk yield"
      />
    </View>
  );

  const renderIntake = () => (
    <View style={styles.card}>
      <Text style={styles.label}>Food intake (kg/day)</Text>
      <TextInput 
        value={data?.intakeFood || ''} 
        onChangeText={(v) => updateRecord('intakeFood', v)} 
        style={styles.input}
        keyboardType="decimal-pad"
        placeholder="Enter food intake"
      />

      <Text style={styles.label}>Water intake (L/day)</Text>
      <TextInput 
        value={data?.intakeWater || ''} 
        onChangeText={(v) => updateRecord('intakeWater', v)} 
        style={styles.input}
        keyboardType="decimal-pad"
        placeholder="Enter water intake"
      />
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
        placeholder="Enter vaccination details"
      />

      <Text style={styles.label}>Illness history</Text>
      <TextInput
        value={data?.illnesses || ''}
        onChangeText={(v) => updateRecord('illnesses', v)}
        style={[styles.input, styles.textarea]}
        multiline
        placeholder="Enter illness history"
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
  }, [activeTab, data, cowData]);

  // List Cows Screen
  if (mode === 'listCows') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => {
            setMode('initial');
            setSearchQuery('');
            setFilteredCows([]);
          }} style={styles.back}>
            <Ionicons name="arrow-back" size={22} color="#2c3e50" />
          </TouchableOpacity>
          <Text style={styles.title}>All Cows</Text>
          <Text style={styles.subtitle}>{filteredCows.length} cow{filteredCows.length !== 1 ? 's' : ''} found</Text>
        </View>

        {/* Search Bar */}
        <View style={styles.listSearchContainer}>
          <View style={styles.listSearchBox}>
            <Ionicons name="search" size={20} color="#7f8c8d" style={styles.searchIcon} />
            <TextInput
              placeholder="Search by name, ID, or breed..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              style={styles.listSearchInput}
              autoCapitalize="none"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={20} color="#7f8c8d" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Cows List */}
        {isLoadingCows ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#4CAF50" />
            <Text style={styles.loadingText}>Loading cows...</Text>
          </View>
        ) : filteredCows.length > 0 ? (
          <ScrollView style={styles.cowsList} contentContainerStyle={styles.cowsListContent}>
            {filteredCows.map((cow) => (
              <TouchableOpacity
                key={cow.uniqueId}
                style={styles.cowListItem}
                onPress={() => handleSelectCow(cow)}
              >
                <View style={styles.cowListItemIcon}>
                  <Ionicons name="leaf" size={24} color="#4CAF50" />
                </View>
                <View style={styles.cowListItemContent}>
                  <Text style={styles.cowListItemName}>{cow.name || 'Unnamed'}</Text>
                  <View style={styles.cowListItemDetails}>
                    <Text style={styles.cowListItemId}>ID: {cow.uniqueId}</Text>
                    {cow.breed && (
                      <Text style={styles.cowListItemBreed}>• {cow.breed}</Text>
                    )}
                  </View>
                  {cow.dob && (
                    <Text style={styles.cowListItemDob}>DOB: {cow.dob}</Text>
                  )}
                </View>
                <Ionicons name="chevron-forward" size={20} color="#7f8c8d" />
              </TouchableOpacity>
            ))}
          </ScrollView>
        ) : (
          <View style={styles.emptyContainer}>
            <Ionicons name="leaf-outline" size={64} color="#cbd5e1" />
            <Text style={styles.emptyText}>
              {searchQuery.trim() 
                ? 'No cows found matching your search' 
                : 'No cows registered yet'}
            </Text>
            {!searchQuery.trim() && (
              <TouchableOpacity 
                style={styles.addCowButton}
                onPress={() => router.push('/cow-registration')}
              >
                <Ionicons name="add-circle" size={20} color="#fff" />
                <Text style={styles.addCowButtonText}>Register New Cow</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </SafeAreaView>
    );
  }

  // Initial Screen - Only Scan Option
  if (mode === 'initial') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.back}>
            <Ionicons name="arrow-back" size={22} color="#2c3e50" />
          </TouchableOpacity>
          <Text style={styles.title}>Cow Information</Text>
          <Text style={styles.subtitle}>Scan QR code to get started</Text>
        </View>

        <View style={styles.initialContainer}>
          <View style={styles.scanIconContainer}>
            <Ionicons name="qr-code-outline" size={80} color="#4CAF50" />
          </View>
          <Text style={styles.initialTitle}>Scan Cow QR Code</Text>
          <Text style={styles.initialSubtitle}>Point your camera at the cow&apos;s QR code to retrieve information</Text>
          
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

          <View style={styles.listContainer}>
            <Text style={styles.orText}>OR</Text>
            <TouchableOpacity 
              style={styles.listButton} 
              onPress={handleListCows}
              disabled={isLoadingCows}
            >
              <Ionicons name="list" size={24} color="#fff" />
              <Text style={styles.listButtonText}>View All Cows</Text>
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
            <Text style={styles.title}>Cow Information</Text>
            <Text style={styles.subtitle}>{cowData?.name || 'Cow Details'}</Text>
          </View>

          <View style={styles.cowInfoCard}>
            <Text style={styles.cowName}>{cowData?.name || 'Unknown'}</Text>
            <Text style={styles.cowId}>ID: {cowData?.uniqueId}</Text>
            <Text style={styles.cowBreed}>Breed: {cowData?.breed || 'N/A'}</Text>
          </View>

          <View style={styles.actionButtonsContainer}>
            <TouchableOpacity style={styles.actionButton} onPress={handleEnterReport}>
              <Ionicons name="create-outline" size={32} color="#fff" />
              <Text style={styles.actionButtonText}>Enter Today&apos;s Report</Text>
              <Text style={styles.actionButtonSubtext}>Add daily details for this cow</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.actionButton, styles.viewButton]} onPress={handleViewDetails}>
              <Ionicons name="eye-outline" size={32} color="#fff" />
              <Text style={styles.actionButtonText}>View Details</Text>
              <Text style={styles.actionButtonSubtext}>View reports by date</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Enter Report or View Details Mode
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setMode('cowSelected')} style={styles.back}>
            <Ionicons name="arrow-back" size={22} color="#2c3e50" />
          </TouchableOpacity>
          <Text style={styles.title}>
            {mode === 'enterReport' ? "Enter Today's Report" : 'View Details'}
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

        {mode === 'enterReport' && (
          <View style={styles.todayBadge}>
            <Ionicons name="calendar" size={16} color="#4CAF50" />
            <Text style={styles.todayText}>Today: {formatPrettyDate(new Date())}</Text>
          </View>
        )}

        {/* Tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsContainer}>
          <View style={styles.tabs}>
            {TABS.map((t) => (
              <TabButton key={t} label={t} active={t === activeTab} onPress={() => setActiveTab(t)} />
            ))}
          </View>
        </ScrollView>

        {data || mode === 'enterReport' ? Content : (
          <View style={styles.placeholder}> 
            <Ionicons name="information-circle" size={28} color="#9aa3a9" />
            <Text style={styles.placeholderText}>
              {mode === 'viewDetails' 
                ? `No report found for ${formatPrettyDate(selectedDate)}.`
                : 'Start entering data for today.'}
            </Text>
          </View>
        )}

        {mode === 'enterReport' && (
          <TouchableOpacity 
            style={[styles.saveBtn, isLoading && styles.saveBtnDisabled]} 
            onPress={handleSave}
            disabled={isLoading}
          >
            <Text style={styles.saveText}>
              {isLoading ? 'Saving...' : "Save Today's Report"}
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
  container: { flex: 1, backgroundColor: '#f8f9fa'},
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
    backgroundColor: '#e8f5e8',
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
    backgroundColor: '#4CAF50',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 32,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 30,
    shadowColor: '#4CAF50',
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

  // List View Styles
  listContainer: {
    width: '100%',
    paddingHorizontal: 20,
    marginTop: 10,
  },
  listButton: {
    backgroundColor: '#2196F3',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2196F3',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 8,
  },
  listButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  listSearchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e6e8eb',
  },
  listSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#e6e8eb',
  },
  searchIcon: {
    marginRight: 8,
  },
  listSearchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: '#2c3e50',
  },
  cowsList: {
    flex: 1,
  },
  cowsListContent: {
    padding: 16,
  },
  cowListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e6e8eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  cowListItemIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#e8f5e8',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  cowListItemContent: {
    flex: 1,
  },
  cowListItemName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 4,
  },
  cowListItemDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  cowListItemId: {
    fontSize: 13,
    color: '#7f8c8d',
    marginRight: 8,
  },
  cowListItemBreed: {
    fontSize: 13,
    color: '#7f8c8d',
  },
  cowListItemDob: {
    fontSize: 12,
    color: '#9aa3a9',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#7f8c8d',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: '#9aa3a9',
    textAlign: 'center',
  },
  addCowButton: {
    marginTop: 24,
    backgroundColor: '#4CAF50',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  addCowButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
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
    backgroundColor: '#4CAF50',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#4CAF50',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 8,
  },
  viewButton: {
    backgroundColor: '#2196F3',
    shadowColor: '#2196F3',
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
    backgroundColor: '#e8f5e8',
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginBottom: 16,
    alignSelf: 'flex-start',
  },
  todayText: {
    color: '#4CAF50',
    fontWeight: '600',
    marginLeft: 8,
    fontSize: 14,
  },

  // Tabs
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

  // Form
  card: {
    backgroundColor: 'white', borderRadius: 16, padding: 16, marginTop: 16,
    borderWidth: 1, borderColor: '#eef2f7',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  label: { fontSize: 13, color: '#6b7280', marginTop: 10, marginBottom: 6 },
  input: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e6e8eb', paddingHorizontal: 12, paddingVertical: 12, fontSize: 16, color: '#111827' },
  disabledInput: { backgroundColor: '#f8f9fa', color: '#6b7280' },
  textarea: { minHeight: 90, textAlignVertical: 'top' },

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
