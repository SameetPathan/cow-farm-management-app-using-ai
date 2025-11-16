import React, { useMemo, useState, useEffect } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView, Alert, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { database } from '../firebaseConfig';
import { ref, get, set, child } from 'firebase/database';
import { getExpensesAI } from '../services/aiService';

export default function ExpensesScreen() {
  const [mode, setMode] = useState('initial'); // 'initial', 'enterExpense', 'viewDetails'
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [tempSelectedDate, setTempSelectedDate] = useState(new Date());
  const [records, setRecords] = useState({}); // { 'YYYY-MM-DD': { feed: '', doctor: '', other: '', notes: '' } }
  const [isLoading, setIsLoading] = useState(false);
  const [userPhone, setUserPhone] = useState('');
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

  // Load expenses for selected date
  const loadExpenses = async (date) => {
    if (!userPhone) return;
    
    setIsLoading(true);
    try {
      const dbRef = ref(database);
      const expensePath = `CowFarm/expenses/${userPhone}/${date}`;
      const expenseSnapshot = await get(child(dbRef, expensePath));
      
      if (expenseSnapshot.exists()) {
        const expenseData = expenseSnapshot.val();
        setRecords(prev => ({
          ...prev,
          [date]: expenseData
        }));
      } else {
        // Initialize empty record for this date
        setRecords(prev => ({
          ...prev,
          [date]: {
            feed: '',
            doctor: '',
            other: '',
            notes: ''
          }
        }));
      }
      setIsLoading(false);
    } catch (error) {
      console.error('Error loading expenses:', error);
      setIsLoading(false);
    }
  };

  const handleEnterExpense = () => {
    setSelectedDate(new Date());
    setMode('enterExpense');
    loadExpenses(todayKey);
  };

  const handleViewDetails = () => {
    setMode('viewDetails');
    loadExpenses(dateKey);
  };

  const updateRecord = (field, value) => {
    setRecords((prev) => ({
      ...prev,
      [dateKey]: {
        ...(prev[dateKey] || { feed: '', doctor: '', other: '', notes: '' }),
        [field]: value,
      },
    }));
  };

  const handleGetAIAnalysis = async () => {
    if (!data) {
      Alert.alert('No Data', 'Please enter or view expense data first.');
      return;
    }

    setIsLoadingAI(true);
    try {
      const expenseData = {
        date: dateKey,
        feed: data.feed || '0',
        doctor: data.doctor || '0',
        other: data.other || '0',
        notes: data.notes || 'None',
      };
      const result = await getExpensesAI(expenseData, 'daily');
      setAiAnalysis(result.analysis || result.suggestions || 'No analysis available.');
      setShowAIAnalysis(true);
    } catch (error) {
      console.error('Error getting AI analysis:', error);
      Alert.alert('Error', 'Failed to get AI analysis. Please try again.');
    } finally {
      setIsLoadingAI(false);
    }
  };

  const handleSave = async () => {
    if (!userPhone) {
      Alert.alert('Error', 'User not logged in');
      return;
    }

    setIsLoading(true);
    try {
      const expenseData = {
        ...records[dateKey],
        date: dateKey,
        updatedAt: new Date().toISOString(),
        userPhoneNumber: userPhone
      };

      const dbRef = ref(database);
      const expensePath = `CowFarm/expenses/${userPhone}/${dateKey}`;
      await set(child(dbRef, expensePath), expenseData);

      Alert.alert('Success', `Expenses saved for ${formatPrettyDate(selectedDate)}`, [
        { text: 'OK', onPress: () => setMode('initial') }
      ]);
      setIsLoading(false);
    } catch (error) {
      console.error('Error saving expenses:', error);
      Alert.alert('Error', 'Failed to save expenses: ' + error.message);
      setIsLoading(false);
    }
  };

  const goPrevDay = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() - 1);
    setSelectedDate(newDate);
    loadExpenses(formatDate(newDate));
  };

  const goNextDay = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + 1);
    setSelectedDate(newDate);
    loadExpenses(formatDate(newDate));
  };

  const goToday = () => {
    const now = new Date();
    setSelectedDate(now);
    loadExpenses(todayKey);
  };

  const handleDateSelect = () => {
    setSelectedDate(new Date(tempSelectedDate));
    const dateStr = formatDate(tempSelectedDate);
    loadExpenses(dateStr);
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

  const getTotal = () => {
    const feed = parseFloat(data?.feed || 0) || 0;
    const doctor = parseFloat(data?.doctor || 0) || 0;
    const other = parseFloat(data?.other || 0) || 0;
    return (feed + doctor + other).toFixed(2);
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

  // Initial Screen - Show Action Buttons
  if (mode === 'initial') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.back}>
            <Ionicons name="arrow-back" size={22} color="#2c3e50" />
          </TouchableOpacity>
          <Text style={styles.title}>Expenses</Text>
          <Text style={styles.subtitle}>Track daily farm expenses</Text>
        </View>

        <View style={styles.initialContainer}>
          <View style={styles.expenseIconContainer}>
            <Ionicons name="cash-outline" size={80} color="#FF9800" />
          </View>
          <Text style={styles.initialTitle}>Farm Expenses</Text>
          <Text style={styles.initialSubtitle}>Record and track your daily farm expenses</Text>
          
          <View style={styles.actionButtonsContainer}>
            <TouchableOpacity style={styles.actionButton} onPress={handleEnterExpense}>
              <Ionicons name="create-outline" size={32} color="#fff" />
              <Text style={styles.actionButtonText}>Enter Today&apos;s Expenses</Text>
              <Text style={styles.actionButtonSubtext}>Add expenses for today</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.actionButton, styles.viewButton]} onPress={handleViewDetails}>
              <Ionicons name="eye-outline" size={32} color="#fff" />
              <Text style={styles.actionButtonText}>View Expenses</Text>
              <Text style={styles.actionButtonSubtext}>View expenses by date</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // Enter Expense or View Details Mode
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setMode('initial')} style={styles.back}>
            <Ionicons name="arrow-back" size={22} color="#2c3e50" />
          </TouchableOpacity>
          <Text style={styles.title}>
            {mode === 'enterExpense' ? "Enter Today's Expenses" : 'View Expenses'}
          </Text>
          <Text style={styles.subtitle}>Daily expense tracking</Text>
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

        {mode === 'enterExpense' && (
          <View style={styles.todayBadge}>
            <Ionicons name="calendar" size={16} color="#FF9800" />
            <Text style={styles.todayText}>Today: {formatPrettyDate(new Date())}</Text>
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.label}>Food Intake Fees (₹)</Text>
          <TextInput 
            value={data?.feed || ''}
            onChangeText={(v) => updateRecord('feed', v)}
            style={styles.input}
            placeholder="Enter amount"
            keyboardType="decimal-pad"
            editable={mode === 'enterExpense'}
          />

          <Text style={styles.label}>Doctor Fees (₹)</Text>
          <TextInput 
            value={data?.doctor || ''}
            onChangeText={(v) => updateRecord('doctor', v)}
            style={styles.input}
            placeholder="Enter amount"
            keyboardType="decimal-pad"
            editable={mode === 'enterExpense'}
          />

          <Text style={styles.label}>Other Expenses (₹)</Text>
          <TextInput 
            value={data?.other || ''}
            onChangeText={(v) => updateRecord('other', v)}
            style={styles.input}
            placeholder="Enter amount"
            keyboardType="decimal-pad"
            editable={mode === 'enterExpense'}
          />

          <Text style={styles.label}>Notes</Text>
          <TextInput
            value={data?.notes || ''}
            onChangeText={(v) => updateRecord('notes', v)}
            style={[styles.input, styles.textarea]}
            placeholder="Any additional notes..."
            multiline
            editable={mode === 'enterExpense'}
          />

          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total Expenses</Text>
            <Text style={styles.totalValue}>₹{getTotal()}</Text>
          </View>
        </View>

        {/* AI Analysis Button */}
        {data && (mode === 'viewDetails' || mode === 'enterExpense') && (
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

        {mode === 'enterExpense' && (
          <TouchableOpacity 
            style={[styles.saveBtn, isLoading && styles.saveBtnDisabled]} 
            onPress={handleSave}
            disabled={isLoading}
          >
            <Text style={styles.saveText}>
              {isLoading ? 'Saving...' : "Save Today's Expenses"}
            </Text>
            {!isLoading && <Ionicons name="checkmark" size={18} color="#fff" />}
          </TouchableOpacity>
        )}

        {mode === 'viewDetails' && !data && (
          <View style={styles.placeholder}> 
            <Ionicons name="cash-outline" size={28} color="#9aa3a9" />
            <Text style={styles.placeholderText}>
              No expenses found for {formatPrettyDate(selectedDate)}.
            </Text>
          </View>
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
              <Text style={styles.modalTitle}>AI Expense Analysis</Text>
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
  expenseIconContainer: {
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: '#fff3e0',
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
  actionButtonsContainer: {
    width: '100%',
    paddingHorizontal: 20,
    gap: 15,
  },
  actionButton: {
    backgroundColor: '#FF9800',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#FF9800',
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
    backgroundColor: '#fff3e0',
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginBottom: 16,
    alignSelf: 'flex-start',
  },
  todayText: {
    color: '#FF9800',
    fontWeight: '600',
    marginLeft: 8,
    fontSize: 14,
  },

  // Form
  card: {
    backgroundColor: 'white', borderRadius: 16, padding: 16, marginTop: 16,
    borderWidth: 1, borderColor: '#eef2f7',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  label: { fontSize: 13, color: '#6b7280', marginTop: 10, marginBottom: 6 },
  input: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e6e8eb', paddingHorizontal: 12, paddingVertical: 12, fontSize: 16, color: '#111827' },
  textarea: { minHeight: 90, textAlignVertical: 'top' },

  totalRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginTop: 16, 
    paddingTop: 16, 
    borderTopWidth: 2, 
    borderTopColor: '#eef2f7' 
  },
  totalLabel: { fontSize: 16, color: '#374151', fontWeight: '700' },
  totalValue: { fontSize: 22, color: '#FF9800', fontWeight: '800' },

  placeholder: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40 },
  placeholderText: { marginTop: 8, color: '#9aa3a9', textAlign: 'center', paddingHorizontal: 20 },

  saveBtn: { marginTop: 20, backgroundColor: '#FF9800', borderRadius: 12, paddingVertical: 14, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  saveBtnDisabled: { opacity: 0.6 },
  saveText: { color: '#fff', fontSize: 16, fontWeight: 'bold', marginRight: 8 },
  
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
    backgroundColor: '#FF9800',
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
