import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

export default function ExpensesScreen() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [records, setRecords] = useState({}); // { 'YYYY-MM-DD': { feed: '', doctor: '', other: '', note: '' } }

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

  const getTotal = () => {
    const feed = parseFloat(data?.feed || 0) || 0;
    const doctor = parseFloat(data?.doctor || 0) || 0;
    const other = parseFloat(data?.other || 0) || 0;
    return (feed + doctor + other).toFixed(2);
  };

  const handleSave = () => {
    console.log('Save expenses for', dateKey, ':', records[dateKey]);
    Alert.alert('Saved (Mock)', `Saved expenses for ${formatPrettyDate(selectedDate)}.`);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.back}>
            <Ionicons name="arrow-back" size={22} color="#2c3e50" />
          </TouchableOpacity>
          <Text style={styles.title}>Expenses</Text>
          <Text style={styles.subtitle}>Enter daily expense details</Text>
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

        <View style={styles.card}>
          <Text style={styles.label}>Food intake fees (₹)</Text>
          <TextInput 
            value={data?.feed || ''}
            onChangeText={(v) => updateRecord('feed', v)}
            style={styles.input}
            placeholder="Enter amount"
            keyboardType="numeric"
          />

          <Text style={styles.label}>Doctor fees (₹)</Text>
          <TextInput 
            value={data?.doctor || ''}
            onChangeText={(v) => updateRecord('doctor', v)}
            style={styles.input}
            placeholder="Enter amount"
            keyboardType="numeric"
          />

          <Text style={styles.label}>Other expenses (₹)</Text>
          <TextInput 
            value={data?.other || ''}
            onChangeText={(v) => updateRecord('other', v)}
            style={styles.input}
            placeholder="Enter amount"
            keyboardType="numeric"
          />

          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>₹{getTotal()}</Text>
          </View>
        </View>

        {data && (
          <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
            <Text style={styles.saveText}>Save Expenses</Text>
            <Ionicons name="checkmark" size={18} color="#fff" />
          </TouchableOpacity>
        )}
      </ScrollView>
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

  card: {
    backgroundColor: 'white', borderRadius: 16, padding: 16, marginTop: 16,
    borderWidth: 1, borderColor: '#eef2f7',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  label: { fontSize: 13, color: '#6b7280', marginTop: 10, marginBottom: 6 },
  input: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e6e8eb', paddingHorizontal: 12, paddingVertical: 12, fontSize: 16, color: '#111827' },

  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#eef2f7' },
  totalLabel: { fontSize: 14, color: '#374151', fontWeight: '700' },
  totalValue: { fontSize: 18, color: '#111827', fontWeight: '800' },

  saveBtn: { marginTop: 20, backgroundColor: '#10b981', borderRadius: 12, paddingVertical: 14, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  saveText: { color: '#fff', fontSize: 16, fontWeight: 'bold', marginRight: 8 },
});

