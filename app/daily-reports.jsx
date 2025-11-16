
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';
import { child, get, ref, set } from 'firebase/database';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Modal, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, ActivityIndicator } from 'react-native';
import { database } from '../firebaseConfig';
import { getDailyReportsAI } from '../services/aiService';

const HEALTH_STATUS = ['Healthy', 'Sick', 'Under Treatment', 'Recovering'];
const ILLNESS_TYPES = [
  'Fever',
  'Digestive Issue',
  'Respiratory',
  'Skin Infection',
  'Foot Problem',
  'Mastitis',
  'Eye Infection',
  'Injury',
  'Other'
];

function StatusChip({ label, active, onPress, color }) {
  return (
    <TouchableOpacity 
      onPress={onPress} 
      style={[
        styles.statusChip, 
        active && { backgroundColor: color || '#10b981', borderColor: color || '#10b981' }
      ]}
    >
      <Text style={[styles.statusChipText, active && styles.statusChipTextActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

export default function DailyReportsScreen() {
  const [mode, setMode] = useState('initial'); // 'initial', 'listCows', 'cowSelected', 'enterData', 'viewDetails'
  const [searchQuery, setSearchQuery] = useState('');
  const [cowData, setCowData] = useState(null);
  const [reports, setReports] = useState({}); // { 'YYYY-MM-DD': {...} }
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [scanVisible, setScanVisible] = useState(false);
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [tempSelectedDate, setTempSelectedDate] = useState(new Date());
  const [permission, requestPermission] = useCameraPermissions();
  const [isLoading, setIsLoading] = useState(false);
  const [userPhone, setUserPhone] = useState('');
  const [allCows, setAllCows] = useState([]);
  const [filteredCows, setFilteredCows] = useState([]);
  const [isLoadingCows, setIsLoadingCows] = useState(false);
  const [showAIAnalysis, setShowAIAnalysis] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState('');
  const [isLoadingAI, setIsLoadingAI] = useState(false);

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

  // Load all cows when entering list mode
  const loadAllCows = async () => {
    if (!userPhone) return;
    
    setIsLoadingCows(true);
    try {
      const cowsRef = ref(database, 'CowFarm/cows');
      const allCowsSnapshot = await get(cowsRef);
      
      if (allCowsSnapshot.exists()) {
        const allCowsData = allCowsSnapshot.val();
        const userCows = Object.entries(allCowsData)
          .filter(([id, cow]) => cow.userPhoneNumber === userPhone)
          .map(([id, cow]) => ({
            ...cow,
            uniqueId: id,
          }))
          .sort((a, b) => {
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

  // Load cows when entering list mode and userPhone is available
  useEffect(() => {
    if (mode === 'listCows' && userPhone) {
      loadAllCows();
    }
  }, [mode, userPhone]);

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

  const currentReport = reports[dateKey] || null;

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

  // Load health report data for selected date
  const loadReportData = async (date) => {
    if (!cowData || !cowData.uniqueId) return;
    
    setIsLoading(true);
    try {
      const dbRef = ref(database);
      const reportPath = `CowFarm/healthReports/${cowData.uniqueId}/${date}`;
      const reportSnapshot = await get(child(dbRef, reportPath));
      
      if (reportSnapshot.exists()) {
        const reportData = reportSnapshot.val();
        setReports(prev => ({
          ...prev,
          [date]: reportData
        }));
      } else {
        // Initialize empty report for this date
        setReports(prev => ({
          ...prev,
          [date]: {
            healthStatus: '',
            illnessType: '',
            symptoms: '',
            temperature: '',
            appetite: '',
            medication: '',
            veterinarianVisit: false,
            veterinarianName: '',
            treatmentCost: '',
            notes: ''
          }
        }));
      }
      setIsLoading(false);
    } catch (error) {
      console.error('Error loading report data:', error);
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
  };

  const handleSelectCow = (cow) => {
    setCowData(cow);
    setMode('cowSelected');
    setSearchQuery('');
  };

  const handleGetAIAnalysis = async () => {
    if (!cowData || !currentReport) {
      Alert.alert('No Data', 'Please enter or view health report data first.');
      return;
    }

    setIsLoadingAI(true);
    try {
      const reportData = {
        date: dateKey,
        healthStatus: currentReport.healthStatus || 'Not recorded',
        illnessType: currentReport.illnessType || 'N/A',
        symptoms: currentReport.symptoms || 'None',
        temperature: currentReport.temperature || 'Not recorded',
        appetite: currentReport.appetite || 'Not recorded',
        medication: currentReport.medication || 'None',
        veterinarianVisit: currentReport.veterinarianVisit || false,
        notes: currentReport.notes || 'None',
      };
      const result = await getDailyReportsAI(cowData, reportData);
      setAiAnalysis(result.analysis || result.recommendations || 'No analysis available.');
      setShowAIAnalysis(true);
    } catch (error) {
      console.error('Error getting AI analysis:', error);
      Alert.alert('Error', 'Failed to get AI analysis. Please try again.');
    } finally {
      setIsLoadingAI(false);
    }
  };

  const handleEnterData = () => {
    setSelectedDate(new Date());
    setMode('enterData');
    loadReportData(todayKey);
  };

  const handleViewDetails = () => {
    setMode('viewDetails');
    loadReportData(dateKey);
  };

  const updateReport = (field, value) => {
    setReports((prev) => ({
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

    const report = reports[dateKey];
    if (!report?.healthStatus) {
      Alert.alert('Validation Error', 'Please select a health status');
      return;
    }

    setIsLoading(true);
    try {
      const reportData = {
        ...report,
        cowId: cowData.uniqueId,
        cowName: cowData.name,
        date: dateKey,
        updatedAt: new Date().toISOString(),
        userPhoneNumber: userPhone
      };

      const dbRef = ref(database);
      const reportPath = `CowFarm/healthReports/${cowData.uniqueId}/${dateKey}`;
      await set(child(dbRef, reportPath), reportData);

      Alert.alert('Success', `Health report saved for ${formatPrettyDate(selectedDate)}`, [
        { text: 'OK', onPress: () => setMode('cowSelected') }
      ]);
      setIsLoading(false);
    } catch (error) {
      console.error('Error saving report data:', error);
      Alert.alert('Error', 'Failed to save report: ' + error.message);
      setIsLoading(false);
    }
  };

  const goPrevDay = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() - 1);
    setSelectedDate(newDate);
    loadReportData(formatDate(newDate));
  };

  const goNextDay = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + 1);
    setSelectedDate(newDate);
    loadReportData(formatDate(newDate));
  };

  const goToday = () => {
    const now = new Date();
    setSelectedDate(now);
    loadReportData(todayKey);
  };

  const handleDateSelect = () => {
    setSelectedDate(new Date(tempSelectedDate));
    const dateStr = formatDate(tempSelectedDate);
    loadReportData(dateStr);
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

  const getStatusColor = (status) => {
    switch (status) {
      case 'Healthy': return '#10b981';
      case 'Sick': return '#ef4444';
      case 'Under Treatment': return '#f59e0b';
      case 'Recovering': return '#3b82f6';
      default: return '#6b7280';
    }
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

  const renderHealthForm = () => (
    <View style={styles.card}>
      <View style={styles.cowInfo}>
        <Ionicons name="medical" size={20} color="#ef4444" />
        <View style={styles.cowMeta}>
          <Text style={styles.cowIdText} numberOfLines={1} ellipsizeMode="tail">
            {cowData?.uniqueId || 'No Cow Selected'}
          </Text>
          {cowData?.name && (
            <Text style={styles.cowNameText} numberOfLines={1} ellipsizeMode="tail">{cowData.name}</Text>
          )}
        </View>
      </View>

      {/* Health Status */}
      <Text style={styles.label}>Health Status *</Text>
      <View style={styles.statusRow}>
        {HEALTH_STATUS.map((status) => (
          <StatusChip
            key={status}
            label={status}
            active={currentReport?.healthStatus === status}
            onPress={() => mode === 'enterData' && updateReport('healthStatus', status)}
            color={getStatusColor(status)}
          />
        ))}
      </View>

      {/* Show illness fields if not healthy */}
      {currentReport?.healthStatus && currentReport.healthStatus !== 'Healthy' && (
        <>
          <Text style={styles.label}>Illness Type</Text>
          <View style={styles.illnessRow}>
            {ILLNESS_TYPES.map((illness) => (
              <TouchableOpacity
                key={illness}
                onPress={() => mode === 'enterData' && updateReport('illnessType', illness)}
                style={[
                  styles.illnessButton,
                  currentReport?.illnessType === illness && styles.illnessButtonActive,
                  mode === 'viewDetails' && styles.illnessButtonDisabled
                ]}
                disabled={mode === 'viewDetails'}
              >
                <Text style={[
                  styles.illnessText,
                  currentReport?.illnessType === illness && styles.illnessTextActive
                ]}>
                  {illness}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Symptoms</Text>
          <TextInput
            value={currentReport?.symptoms || ''}
            onChangeText={(v) => updateReport('symptoms', v)}
            style={[styles.input, styles.textarea]}
            placeholder="Describe symptoms observed..."
            multiline
            editable={mode === 'enterData'}
          />
        </>
      )}

      {/* Temperature */}
      <Text style={styles.label}>Temperature (°F)</Text>
      <TextInput 
        value={currentReport?.temperature || ''} 
        onChangeText={(v) => updateReport('temperature', v)} 
        style={styles.input} 
        placeholder="Normal: 101.5°F"
        keyboardType="decimal-pad"
        editable={mode === 'enterData'}
      />

      {/* Appetite */}
      <Text style={styles.label}>Appetite</Text>
      <View style={styles.appetiteRow}>
        {['Normal', 'Reduced', 'Poor', 'None'].map((appetite) => (
          <TouchableOpacity
            key={appetite}
            onPress={() => mode === 'enterData' && updateReport('appetite', appetite)}
            style={[
              styles.appetiteButton,
              currentReport?.appetite === appetite && styles.appetiteButtonActive,
              mode === 'viewDetails' && styles.appetiteButtonDisabled
            ]}
            disabled={mode === 'viewDetails'}
          >
            <Text style={[
              styles.appetiteText,
              currentReport?.appetite === appetite && styles.appetiteTextActive
            ]}>
              {appetite}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Medication */}
      <Text style={styles.label}>Medication Given</Text>
      <TextInput
        value={currentReport?.medication || ''}
        onChangeText={(v) => updateReport('medication', v)}
        style={[styles.input, styles.textarea]}
        placeholder="List medications and dosage..."
        multiline
        editable={mode === 'enterData'}
      />

      {/* Veterinarian Visit */}
      <TouchableOpacity 
        style={styles.checkboxRow}
        onPress={() => mode === 'enterData' && updateReport('veterinarianVisit', !currentReport?.veterinarianVisit)}
        disabled={mode === 'viewDetails'}
      >
        <View style={[styles.checkbox, currentReport?.veterinarianVisit && styles.checkboxChecked]}>
          {currentReport?.veterinarianVisit && <Ionicons name="checkmark" size={16} color="#fff" />}
        </View>
        <Text style={styles.checkboxLabel}>Veterinarian Visit</Text>
      </TouchableOpacity>

      {currentReport?.veterinarianVisit && (
        <>
          <Text style={styles.label}>Veterinarian Name</Text>
          <TextInput
            value={currentReport?.veterinarianName || ''}
            onChangeText={(v) => updateReport('veterinarianName', v)}
            style={styles.input}
            placeholder="Dr. Name"
            editable={mode === 'enterData'}
          />

          <Text style={styles.label}>Treatment Cost (₹)</Text>
          <TextInput
            value={currentReport?.treatmentCost || ''}
            onChangeText={(v) => updateReport('treatmentCost', v)}
            style={styles.input}
            placeholder="Enter amount"
            keyboardType="decimal-pad"
            editable={mode === 'enterData'}
          />
        </>
      )}

      {/* Notes */}
      <Text style={styles.label}>Additional Notes</Text>
      <TextInput
        value={currentReport?.notes || ''}
        onChangeText={(v) => updateReport('notes', v)}
        style={[styles.input, styles.textarea]}
        placeholder="Any additional observations..."
        multiline
        editable={mode === 'enterData'}
      />
    </View>
  );

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
            <ActivityIndicator size="large" color="#ef4444" />
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
                  <Ionicons name="leaf" size={24} color="#ef4444" />
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
          <Text style={styles.title}>Daily Health Reports</Text>
          <Text style={styles.subtitle}>Track cow health & illness updates</Text>
        </View>

        <View style={styles.initialContainer}>
          <View style={styles.scanIconContainer}>
            <Ionicons name="medkit-outline" size={80} color="#ef4444" />
          </View>
          <Text style={styles.initialTitle}>Scan Cow QR Code</Text>
          <Text style={styles.initialSubtitle}>Point your camera at the cow's QR code to record health updates</Text>
          
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
            <Text style={styles.title}>Daily Health Reports</Text>
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
              <Text style={styles.actionButtonText}>Enter Today's Report</Text>
              <Text style={styles.actionButtonSubtext}>Record health status for today</Text>
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

  // Enter Data or View Details Mode
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setMode('cowSelected')} style={styles.back}>
            <Ionicons name="arrow-back" size={22} color="#2c3e50" />
          </TouchableOpacity>
          <Text style={styles.title}>
            {mode === 'enterData' ? "Enter Today's Report" : 'View Details'}
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
            <Ionicons name="calendar" size={16} color="#ef4444" />
            <Text style={styles.todayText}>Today: {formatPrettyDate(new Date())}</Text>
          </View>
        )}

        {/* Health Status Summary */}
        {currentReport?.healthStatus && (
          <View style={[styles.statusCard, { backgroundColor: getStatusColor(currentReport.healthStatus) + '20', borderColor: getStatusColor(currentReport.healthStatus) }]}>
            <Ionicons name="pulse" size={24} color={getStatusColor(currentReport.healthStatus)} />
            <View style={styles.statusInfo}>
              <Text style={styles.statusLabel}>Health Status</Text>
              <Text style={[styles.statusValue, { color: getStatusColor(currentReport.healthStatus) }]}>
                {currentReport.healthStatus}
              </Text>
            </View>
          </View>
        )}

        {currentReport || mode === 'enterData' ? renderHealthForm() : (
          <View style={styles.placeholder}> 
            <Ionicons name="medical" size={28} color="#9aa3a9" />
            <Text style={styles.placeholderText}>
              {mode === 'viewDetails' 
                ? `No health report found for ${formatPrettyDate(selectedDate)}.`
                : 'Start entering health report for today.'}
            </Text>
          </View>
        )}

        {/* AI Analysis Button */}
        {currentReport && (mode === 'viewDetails' || mode === 'enterData') && (
          <TouchableOpacity 
            style={[styles.aiButton, isLoadingAI && styles.aiButtonDisabled]} 
            onPress={handleGetAIAnalysis}
            disabled={isLoadingAI}
          >
            <Ionicons name="sparkles" size={20} color="#fff" />
            <Text style={styles.aiButtonText}>
              {isLoadingAI ? 'Analyzing...' : 'Get AI Analysis'}
            </Text>
          </TouchableOpacity>
        )}

        {mode === 'enterData' && (
          <TouchableOpacity 
            style={[styles.saveBtn, isLoading && styles.saveBtnDisabled]} 
            onPress={handleSave}
            disabled={isLoading}
          >
            <Text style={styles.saveText}>
              {isLoading ? 'Saving...' : 'Save Health Report'}
            </Text>
            {!isLoading && <Ionicons name="checkmark" size={18} color="#fff" />}
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* AI Analysis Modal */}
      <Modal
        visible={showAIAnalysis}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAIAnalysis(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>AI Health Analysis</Text>
              <TouchableOpacity onPress={() => setShowAIAnalysis(false)}>
                <Ionicons name="close" size={24} color="#2c3e50" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody}>
              <Text style={styles.aiAnalysisText}>{aiAnalysis}</Text>
            </ScrollView>
            <TouchableOpacity 
              style={styles.modalCloseButton}
              onPress={() => setShowAIAnalysis(false)}
            >
              <Text style={styles.modalCloseButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

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
    backgroundColor: '#fee2e2',
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
    backgroundColor: '#ef4444',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 32,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 30,
    shadowColor: '#ef4444',
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
    backgroundColor: '#ef4444',
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
    backgroundColor: '#ef4444',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#ef4444',
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
    backgroundColor: '#fee2e2',
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
    backgroundColor: '#ef4444',
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
    backgroundColor: '#ef4444',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 8,
  },
  viewButton: {
    backgroundColor: '#3b82f6',
    shadowColor: '#3b82f6',
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
  chipBtnLight: { backgroundColor: '#fee2e2' },
  chipBtnPrimary: { backgroundColor: '#ef4444' },
  chipTextLight: { color: '#fff', fontWeight: '700', marginLeft: 4, fontSize: 12 },
  chipTextDark: { color: '#2c3e50', fontWeight: '700', marginHorizontal: 2, fontSize: 12 },

  todayBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fee2e2',
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginBottom: 16,
    alignSelf: 'flex-start',
  },
  todayText: {
    color: '#ef4444',
    fontWeight: '600',
    marginLeft: 8,
    fontSize: 14,
  },

  // Status Card
  statusCard: {
    backgroundColor: '#fee2e2',
    borderRadius: 16,
    padding: 16,
    marginTop: 16,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#ef4444',
  },
  statusInfo: { marginLeft: 12, flex: 1 },
  statusLabel: { fontSize: 14, color: '#7f8c8d', fontWeight: '600' },
  statusValue: { fontSize: 20, fontWeight: '800', marginTop: 2 },

  // Form
  card: {
    backgroundColor: 'white', 
    borderRadius: 16, 
    padding: 16, 
    marginTop: 16,
    borderWidth: 1, 
    borderColor: '#eef2f7',
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 2 }, 
    shadowOpacity: 0.06, 
    shadowRadius: 6, 
    elevation: 2,
  },
  cowInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fee2e2',
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  cowMeta: { marginLeft: 8, flex: 1 },
  cowIdText: { fontSize: 16, fontWeight: '700', color: '#991b1b' },
  cowNameText: { fontSize: 14, color: '#dc2626', marginTop: 2 },
  label: { fontSize: 13, color: '#6b7280', marginTop: 10, marginBottom: 6, fontWeight: '600' },
  input: { 
    backgroundColor: '#fff', 
    borderRadius: 12, 
    borderWidth: 1, 
    borderColor: '#e6e8eb', 
    paddingHorizontal: 12, 
    paddingVertical: 12, 
    fontSize: 16, 
    color: '#111827' 
  },
  textarea: { minHeight: 90, textAlignVertical: 'top' },

  // Status Row
  statusRow: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    gap: 8, 
    marginTop: 8,
    marginBottom: 8 
  },
  statusChip: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#e6e8eb',
    backgroundColor: '#fff',
  },
  statusChipText: { 
    fontSize: 13, 
    color: '#6b7280', 
    fontWeight: '600' 
  },
  statusChipTextActive: { color: '#fff' },

  // Illness Type
  illnessRow: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    gap: 8, 
    marginTop: 8 
  },
  illnessButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e6e8eb',
    backgroundColor: '#fff',
  },
  illnessButtonActive: {
    backgroundColor: '#f59e0b',
    borderColor: '#f59e0b',
  },
  illnessButtonDisabled: {
    opacity: 0.6,
  },
  illnessText: { fontSize: 12, color: '#6b7280', fontWeight: '600' },
  illnessTextActive: { color: '#fff' },

  // Appetite
  appetiteRow: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    gap: 8, 
    marginTop: 8 
  },
  appetiteButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e6e8eb',
    backgroundColor: '#fff',
  },
  appetiteButtonActive: {
    backgroundColor: '#8b5cf6',
    borderColor: '#8b5cf6',
  },
  appetiteButtonDisabled: {
    opacity: 0.6,
  },
  appetiteText: { fontSize: 12, color: '#6b7280', fontWeight: '600' },
  appetiteTextActive: { color: '#fff' },

  // Checkbox
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 8,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#e6e8eb',
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#10b981',
    borderColor: '#10b981',
  },
  checkboxLabel: {
    fontSize: 14,
    color: '#2c3e50',
    fontWeight: '600',
    marginLeft: 10,
  },

  placeholder: { 
    alignItems: 'center', 
    justifyContent: 'center', 
    paddingVertical: 40 
  },
  placeholderText: { 
    marginTop: 8, 
    color: '#9aa3a9', 
    textAlign: 'center', 
    paddingHorizontal: 20 
  },

  saveBtn: { 
    marginTop: 20, 
    backgroundColor: '#10b981', 
    borderRadius: 12, 
    paddingVertical: 14, 
    flexDirection: 'row', 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveText: { 
    color: '#fff', 
    fontSize: 16, 
    fontWeight: 'bold', 
    marginRight: 8 
  },
  
  // AI Button
  aiButton: {
    marginTop: 16,
    backgroundColor: '#9333ea',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#9333ea',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 8,
  },
  aiButtonDisabled: { opacity: 0.6 },
  aiButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  
  // AI Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 20,
    width: '90%',
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e6e8eb',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  modalBody: {
    padding: 20,
    maxHeight: 400,
  },
  aiAnalysisText: {
    fontSize: 15,
    lineHeight: 24,
    color: '#2c3e50',
  },
  modalCloseButton: {
    backgroundColor: '#ef4444',
    borderRadius: 12,
    paddingVertical: 14,
    margin: 20,
    alignItems: 'center',
  },
  modalCloseButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },

  // Scanner
  scanContainer: { flex: 1, backgroundColor: '#000' },
  scanTitle: { 
    color: '#fff', 
    textAlign: 'center', 
    padding: 16, 
    fontWeight: 'bold', 
    fontSize: 16 
  },
  scannerBox: { flex: 1 },
  scanInfo: { color: '#fff', textAlign: 'center', marginTop: 16 },
  scanClose: { 
    padding: 14, 
    backgroundColor: '#111', 
    alignItems: 'center' 
  },
  scanCloseText: { color: '#fff', fontWeight: '600' },
  searchBtn: {
    flexDirection: 'row', 
    alignItems: 'center',
    backgroundColor: '#10b981', 
    borderRadius: 10, 
    paddingVertical: 12, 
    paddingHorizontal: 14,
    marginLeft: 4,
  },
  searchText: { 
    color: '#fff', 
    fontSize: 15, 
    fontWeight: '600', 
    marginLeft: 6 
  },

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
    backgroundColor: '#ef4444',
    borderRadius: 20,
  },
  calendarCellToday: {
    backgroundColor: '#fee2e2',
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
    color: '#ef4444',
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
    backgroundColor: '#ef4444',
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