import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { child, get, ref, set } from 'firebase/database';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated, FlatList, Modal, Platform, SafeAreaView,
  ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View
} from 'react-native';
import LanguageSelector from '../components/LanguageSelector';
import { useLanguage } from '../contexts/LanguageContext';
import { database } from '../firebaseConfig';
import { getDailyReportsAI } from '../services/aiService';

// ─── Status chip component ───────────────────────────────────────────────────
function StatusChip({ label, active, onPress, color }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.statusChip, active && { backgroundColor: color, borderColor: color }]}
      activeOpacity={0.8}
    >
      <Text style={[styles.statusChipText, active && styles.statusChipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function DailyReportsScreen() {
  const { t } = useLanguage();
  const [mode, setMode] = useState('initial');
  const [searchQuery, setSearchQuery] = useState('');
  const [cowData, setCowData] = useState(null);
  const [reports, setReports] = useState({});
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

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(fadeAnim, { toValue: 1, useNativeDriver: true, tension: 60, friction: 9 }),
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 60, friction: 9 }),
    ]).start();
  }, [mode]);

  const HEALTH_STATUS = [
    { key: 'Healthy', label: t('dailyReports.healthy'), color: '#22c55e' },
    { key: 'Sick', label: t('dailyReports.sick'), color: '#ef4444' },
    { key: 'Under Treatment', label: t('dailyReports.underTreatment'), color: '#f59e0b' },
    { key: 'Recovering', label: t('dailyReports.recovering'), color: '#3b82f6' },
  ];

  const ILLNESS_TYPES = [
    'Fever', 'Digestive Issue', 'Respiratory', 'Skin Infection',
    'Foot Problem', 'Mastitis', 'Eye Infection', 'Injury', 'Other',
  ].map(k => ({ key: k, label: t(`dailyReports.${k.toLowerCase().replace(/ /g, '')}`) || k }));

  useEffect(() => {
    AsyncStorage.getItem('userPhone').then(phone => { if (phone) setUserPhone(phone); }).catch(console.error);
  }, []);

  useEffect(() => {
    if (mode === 'listCows' && userPhone) loadAllCows();
  }, [mode, userPhone]);

  const loadAllCows = async () => {
    if (!userPhone) return;
    setIsLoadingCows(true);
    try {
      const snapshot = await get(ref(database, 'CowFarm/cows'));
      if (snapshot.exists()) {
        const data = snapshot.val();
        const userCows = Object.entries(data)
          .filter(([, c]) => c.userPhoneNumber === userPhone)
          .map(([id, c]) => ({ ...c, uniqueId: id }))
          .sort((a, b) => (a.name || '').toLowerCase().localeCompare((b.name || '').toLowerCase()));
        setAllCows(userCows);
        setFilteredCows(userCows);
      } else {
        setAllCows([]);
        setFilteredCows([]);
      }
    } catch (e) {
      console.error(e);
      setAllCows([]);
      setFilteredCows([]);
    } finally {
      setIsLoadingCows(false);
    }
  };

  useEffect(() => {
    if (mode === 'listCows') {
      const q = searchQuery.toLowerCase();
      setFilteredCows(q ? allCows.filter(c =>
        c.name?.toLowerCase().includes(q) ||
        c.uniqueId?.toLowerCase().includes(q) ||
        c.breed?.toLowerCase().includes(q)
      ) : allCows);
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
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }, []);

  const currentReport = reports[dateKey] || null;

  const formatPrettyDate = (date) =>
    date.toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });

  const formatDate = (date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

  const fetchCowData = async (searchValue) => {
    setIsLoading(true);
    try {
      const dbRef = ref(database);
      const cowSnapshot = await get(child(dbRef, `CowFarm/cows/${searchValue}`));
      if (cowSnapshot.exists()) {
        setCowData({ ...cowSnapshot.val(), uniqueId: searchValue });
        setMode('cowSelected');
        setIsLoading(false);
        return true;
      }
      const allSnapshot = await get(ref(database, 'CowFarm/cows'));
      if (allSnapshot.exists()) {
        const found = Object.entries(allSnapshot.val()).find(([, c]) =>
          c.name && c.name.toLowerCase().includes(searchValue.toLowerCase())
        );
        if (found) {
          const [id, c] = found;
          setCowData({ ...c, uniqueId: id });
          setMode('cowSelected');
          setIsLoading(false);
          return true;
        }
      }
      Alert.alert(t('common.error'), t('dailyReports.cowNotFound'));
      setIsLoading(false);
      return false;
    } catch (e) {
      Alert.alert(t('common.error'), t('dailyReports.failedToFetchCowData') + ': ' + e.message);
      setIsLoading(false);
      return false;
    }
  };

  const loadReportData = async (date) => {
    if (!cowData?.uniqueId) return;
    setIsLoading(true);
    try {
      const reportSnapshot = await get(child(ref(database), `CowFarm/healthReports/${cowData.uniqueId}/${date}`));
      setReports(prev => ({
        ...prev,
        [date]: reportSnapshot.exists() ? reportSnapshot.val() : {
          healthStatus: '', illnessType: '', symptoms: '', temperature: '', appetite: '',
          medication: '', veterinarianVisit: false, veterinarianName: '', treatmentCost: '', notes: '',
        },
      }));
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleScan = ({ data }) => { setScanVisible(false); setSearchQuery(data); fetchCowData(data); };
  const handleSearch = async () => {
    if (!searchQuery.trim()) { Alert.alert(t('common.error'), t('dailyReports.enterSearch')); return; }
    await fetchCowData(searchQuery.trim());
  };
  const handleListCows = () => setMode('listCows');
  const handleSelectCow = (cow) => { setCowData(cow); setMode('cowSelected'); setSearchQuery(''); };
  const handleEnterData = () => { setSelectedDate(new Date()); setMode('enterData'); loadReportData(todayKey); };
  const handleViewDetails = () => { setMode('viewDetails'); loadReportData(dateKey); };
  const updateReport = (field, value) => setReports(prev => ({ ...prev, [dateKey]: { ...(prev[dateKey] || {}), [field]: value } }));

  const handleSave = async () => {
    if (!cowData?.uniqueId) { Alert.alert(t('common.error'), t('dailyReports.cowDataNotFound')); return; }
    if (!reports[dateKey]?.healthStatus) { Alert.alert(t('common.error'), t('dailyReports.selectHealthStatus')); return; }
    setIsLoading(true);
    try {
      const reportData = {
        ...reports[dateKey],
        cowId: cowData.uniqueId, cowName: cowData.name, date: dateKey,
        updatedAt: new Date().toISOString(), userPhoneNumber: userPhone,
      };
      await set(child(ref(database), `CowFarm/healthReports/${cowData.uniqueId}/${dateKey}`), reportData);
      Alert.alert(t('common.success'), t('dailyReports.reportSaved') + ' ' + formatPrettyDate(selectedDate), [
        { text: t('common.ok'), onPress: () => setMode('cowSelected') }
      ]);
    } catch (e) {
      Alert.alert(t('common.error'), t('dailyReports.failedToSaveReport') + ': ' + e.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGetAIAnalysis = async () => {
    if (!cowData || !currentReport) { Alert.alert('No Data', 'Please enter or view health report data first.'); return; }
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
    } catch (e) {
      Alert.alert('Error', 'Failed to get AI analysis. Please try again.');
    } finally {
      setIsLoadingAI(false);
    }
  };

  const goPrevDay = () => { const d = new Date(selectedDate); d.setDate(d.getDate() - 1); setSelectedDate(d); loadReportData(formatDate(d)); };
  const goNextDay = () => { const d = new Date(selectedDate); d.setDate(d.getDate() + 1); setSelectedDate(d); loadReportData(formatDate(d)); };
  const goToday = () => { const d = new Date(); setSelectedDate(d); loadReportData(todayKey); };
  const openDatePicker = () => { setTempSelectedDate(new Date(selectedDate)); setDatePickerVisible(true); };
  const handleDateSelect = () => {
    setSelectedDate(new Date(tempSelectedDate));
    loadReportData(formatDate(tempSelectedDate));
    setDatePickerVisible(false);
  };

  const getDaysInMonth = (date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const getFirstDayOfMonth = (date) => new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  const getStatusColor = (status) => HEALTH_STATUS.find(s => s.key === status)?.color || '#6b7280';

  const renderCalendar = () => {
    const daysInMonth = getDaysInMonth(tempSelectedDate);
    const firstDay = getFirstDayOfMonth(tempSelectedDate);
    const days = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
    const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const changeMonth = (delta) => { const d = new Date(tempSelectedDate); d.setMonth(d.getMonth() + delta); setTempSelectedDate(d); };

    return (
      <View style={styles.calWrap}>
        <View style={styles.calHeader}>
          <TouchableOpacity onPress={() => changeMonth(-1)} style={styles.calNavBtn}>
            <Ionicons name="chevron-back" size={18} color="rgba(255,255,255,0.7)" />
          </TouchableOpacity>
          <Text style={styles.calMonth}>{months[tempSelectedDate.getMonth()]} {tempSelectedDate.getFullYear()}</Text>
          <TouchableOpacity onPress={() => changeMonth(1)} style={styles.calNavBtn}>
            <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.7)" />
          </TouchableOpacity>
        </View>
        <View style={styles.calWeekRow}>
          {weekDays.map(d => (
            <View key={d} style={styles.calWeekCell}><Text style={styles.calWeekText}>{d}</Text></View>
          ))}
        </View>
        <View style={styles.calGrid}>
          {days.map((day, i) => {
            if (!day) return <View key={i} style={styles.calCell} />;
            const isSelected = day === tempSelectedDate.getDate();
            const now = new Date();
            const isToday = day === now.getDate() && tempSelectedDate.getMonth() === now.getMonth() && tempSelectedDate.getFullYear() === now.getFullYear();
            return (
              <TouchableOpacity
                key={i}
                style={[styles.calCell, isSelected && styles.calCellSel, isToday && !isSelected && styles.calCellToday]}
                onPress={() => { const d = new Date(tempSelectedDate); d.setDate(day); setTempSelectedDate(d); }}
                activeOpacity={0.75}
              >
                <Text style={[styles.calDayText, isSelected && styles.calDayTextSel, isToday && !isSelected && styles.calDayTextToday]}>
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
      {/* Cow info badge */}
      <LinearGradient colors={['rgba(239,68,68,0.15)', 'rgba(239,68,68,0.08)']} style={styles.cowInfoBadge}>
        <Ionicons name="medical" size={18} color="#ef4444" />
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={styles.cowIdBadge} numberOfLines={1}>{cowData?.uniqueId || 'No cow'}</Text>
          {cowData?.name && <Text style={styles.cowNameBadge} numberOfLines={1}>{cowData.name}</Text>}
        </View>
      </LinearGradient>

      {/* Health status */}
      <Text style={styles.fieldLabel}>{t('dailyReports.healthStatus')} *</Text>
      <View style={styles.chipRow}>
        {HEALTH_STATUS.map(s => (
          <StatusChip
            key={s.key}
            label={s.label}
            active={currentReport?.healthStatus === s.key}
            onPress={() => mode === 'enterData' && updateReport('healthStatus', s.key)}
            color={s.color}
          />
        ))}
      </View>

      {/* Illness fields if not healthy */}
      {currentReport?.healthStatus && currentReport.healthStatus !== 'Healthy' && (
        <>
          <Text style={styles.fieldLabel}>{t('dailyReports.illnessType')}</Text>
          <View style={styles.chipRow}>
            {ILLNESS_TYPES.map(({ key, label }) => (
              <TouchableOpacity
                key={key}
                onPress={() => mode === 'enterData' && updateReport('illnessType', key)}
                style={[
                  styles.illnessChip,
                  currentReport?.illnessType === key && styles.illnessChipActive,
                  mode === 'viewDetails' && styles.chipDisabled,
                ]}
                disabled={mode === 'viewDetails'}
                activeOpacity={0.8}
              >
                <Text style={[styles.illnessChipText, currentReport?.illnessType === key && styles.illnessChipTextActive]}>
                  {label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.fieldLabel}>{t('dailyReports.symptoms')}</Text>
          <TextInput
            value={currentReport?.symptoms || ''}
            onChangeText={v => updateReport('symptoms', v)}
            style={[styles.inputField, styles.textarea]}
            placeholder={t('dailyReports.describeSymptoms')}
            placeholderTextColor="rgba(255,255,255,0.3)"
            multiline
            editable={mode === 'enterData'}
          />
        </>
      )}

      {/* Temperature */}
      <Text style={styles.fieldLabel}>{t('dailyReports.temperature')}</Text>
      <TextInput
        value={currentReport?.temperature || ''}
        onChangeText={v => updateReport('temperature', v)}
        style={styles.inputField}
        placeholder={t('dailyReports.normalTemperature')}
        placeholderTextColor="rgba(255,255,255,0.3)"
        keyboardType="decimal-pad"
        editable={mode === 'enterData'}
      />

      {/* Appetite */}
      <Text style={styles.fieldLabel}>{t('dailyReports.appetite')}</Text>
      <View style={styles.chipRow}>
        {['Normal', 'Reduced', 'Poor', 'None'].map(a => (
          <TouchableOpacity
            key={a}
            onPress={() => mode === 'enterData' && updateReport('appetite', a)}
            style={[
              styles.appetiteChip,
              currentReport?.appetite === a && styles.appetiteChipActive,
              mode === 'viewDetails' && styles.chipDisabled,
            ]}
            disabled={mode === 'viewDetails'}
            activeOpacity={0.8}
          >
            <Text style={[styles.appetiteChipText, currentReport?.appetite === a && styles.appetiteChipTextActive]}>
              {t(`dailyReports.${a.toLowerCase()}`)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Medication */}
      <Text style={styles.fieldLabel}>{t('dailyReports.medicationGiven')}</Text>
      <TextInput
        value={currentReport?.medication || ''}
        onChangeText={v => updateReport('medication', v)}
        style={[styles.inputField, styles.textarea]}
        placeholder={t('dailyReports.listMedications')}
        placeholderTextColor="rgba(255,255,255,0.3)"
        multiline
        editable={mode === 'enterData'}
      />

      {/* Veterinarian visit */}
      <TouchableOpacity
        style={styles.checkboxRow}
        onPress={() => mode === 'enterData' && updateReport('veterinarianVisit', !currentReport?.veterinarianVisit)}
        disabled={mode === 'viewDetails'}
        activeOpacity={0.8}
      >
        <View style={[styles.checkbox, currentReport?.veterinarianVisit && styles.checkboxChecked]}>
          {currentReport?.veterinarianVisit && <Ionicons name="checkmark" size={14} color="#fff" />}
        </View>
        <Text style={styles.checkboxLabel}>{t('dailyReports.veterinarianVisit')}</Text>
      </TouchableOpacity>

      {currentReport?.veterinarianVisit && (
        <>
          <Text style={styles.fieldLabel}>{t('dailyReports.veterinarianName')}</Text>
          <TextInput
            value={currentReport?.veterinarianName || ''}
            onChangeText={v => updateReport('veterinarianName', v)}
            style={styles.inputField}
            placeholder={t('dailyReports.drName')}
            placeholderTextColor="rgba(255,255,255,0.3)"
            editable={mode === 'enterData'}
          />

          <Text style={styles.fieldLabel}>{t('dailyReports.treatmentCost')}</Text>
          <TextInput
            value={currentReport?.treatmentCost || ''}
            onChangeText={v => updateReport('treatmentCost', v)}
            style={styles.inputField}
            placeholder={t('dailyReports.enterAmount')}
            placeholderTextColor="rgba(255,255,255,0.3)"
            keyboardType="decimal-pad"
            editable={mode === 'enterData'}
          />
        </>
      )}

      {/* Notes */}
      <Text style={styles.fieldLabel}>{t('dailyReports.additionalNotes')}</Text>
      <TextInput
        value={currentReport?.notes || ''}
        onChangeText={v => updateReport('notes', v)}
        style={[styles.inputField, styles.textarea]}
        placeholder={t('dailyReports.additionalObservations')}
        placeholderTextColor="rgba(255,255,255,0.3)"
        multiline
        editable={mode === 'enterData'}
      />
    </View>
  );

  const animStyle = { opacity: fadeAnim, transform: [{ translateY: slideAnim }] };

  // ═════════════════════════════════════════════════════════════════════════
  // MODE: LIST COWS
  // ═════════════════════════════════════════════════════════════════════════
  if (mode === 'listCows') {
    return (
      <LinearGradient colors={['#0f1923', '#142233', '#0d1f2d']} style={styles.gradient}>
        <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
        <SafeAreaView style={styles.safe}>
          <View style={styles.langWrap}><LanguageSelector /></View>

          <Animated.View style={[styles.headerRow, animStyle]}>
            <TouchableOpacity onPress={() => { setMode('initial'); setSearchQuery(''); setFilteredCows([]); }} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={20} color="#fff" />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={styles.pageTitle}>{t('dailyReports.allCows')}</Text>
              <Text style={styles.pageSubtitle}>
                {filteredCows.length} {filteredCows.length !== 1 ? t('dailyReports.cowsFoundPlural') : t('dailyReports.cowsFound')}
              </Text>
            </View>
          </Animated.View>

          {/* Search bar */}
          <View style={styles.searchBarWrap}>
            <LinearGradient colors={['rgba(255,255,255,0.10)', 'rgba(255,255,255,0.05)']} style={styles.searchBar}>
              <Ionicons name="search" size={16} color="rgba(255,255,255,0.5)" />
              <TextInput
                placeholder={t('dailyReports.searchByCowId')}
                value={searchQuery}
                onChangeText={setSearchQuery}
                style={styles.searchInput}
                placeholderTextColor="rgba(255,255,255,0.3)"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="close-circle" size={16} color="rgba(255,255,255,0.5)" />
                </TouchableOpacity>
              )}
            </LinearGradient>
          </View>

          {/* List */}
          {isLoadingCows ? (
            <View style={styles.centerWrap}>
              <ActivityIndicator size="large" color="#ef4444" />
              <Text style={styles.loadingText}>{t('dailyReports.loadingCows')}</Text>
            </View>
          ) : filteredCows.length > 0 ? (
            <FlatList
              data={filteredCows}
              keyExtractor={c => c.uniqueId}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => (
                <TouchableOpacity onPress={() => handleSelectCow(item)} style={styles.cowTile} activeOpacity={0.8}>
                  <LinearGradient colors={['rgba(255,255,255,0.10)', 'rgba(255,255,255,0.05)']} style={styles.cowTileInner}>
                    <View style={styles.cowIconBadge}>
                      <Ionicons name="leaf" size={20} color="#ef4444" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cowTileName} numberOfLines={1}>{item.name || t('dailyReports.unnamed')}</Text>
                      <Text style={styles.cowTileId} numberOfLines={1}>
                        {t('dailyReports.cowId')}: {item.uniqueId}
                      </Text>
                      {item.breed && <Text style={styles.cowTileBreed} numberOfLines={1}>• {item.breed}</Text>}
                    </View>
                    <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.4)" />
                  </LinearGradient>
                </TouchableOpacity>
              )}
            />
          ) : (
            <View style={styles.centerWrap}>
              <Ionicons name="leaf-outline" size={64} color="rgba(255,255,255,0.15)" />
              <Text style={styles.emptyText}>
                {searchQuery.trim() ? t('dailyReports.noCowsFound') : t('dailyReports.noCowsRegistered')}
              </Text>
              {!searchQuery.trim() && (
                <TouchableOpacity style={styles.addBtn} onPress={() => router.push('/cow-registration')} activeOpacity={0.85}>
                  <Ionicons name="add-circle" size={18} color="#fff" />
                  <Text style={styles.addBtnText}>{t('dailyReports.registerNewCow')}</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </SafeAreaView>
      </LinearGradient>
    );
  }

  // ═════════════════════════════════════════════════════════════════════════
  // MODE: INITIAL
  // ═════════════════════════════════════════════════════════════════════════
  if (mode === 'initial') {
    return (
      <LinearGradient colors={['#0f1923', '#142233', '#0d1f2d']} style={styles.gradient}>
        <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
        <SafeAreaView style={styles.safe}>
          <View style={styles.langWrap}><LanguageSelector /></View>
          <ScrollView contentContainerStyle={styles.scrollCentered} showsVerticalScrollIndicator={false}>
            <Animated.View style={animStyle}>
              <View style={styles.headerRow}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                  <Ionicons name="arrow-back" size={20} color="#fff" />
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                  <Text style={styles.pageTitle}>{t('dailyReports.title')}</Text>
                  <Text style={styles.pageSubtitle}>{t('dailyReports.subtitle')}</Text>
                </View>
              </View>

              <View style={styles.initialWrap}>
                <View style={styles.medIconBadge}>
                  <Ionicons name="medkit" size={64} color="#ef4444" />
                </View>
                <Text style={styles.initialTitle}>{t('dailyReports.scanCowQrCode')}</Text>
                <Text style={styles.initialSub}>{t('dailyReports.scanQrDescription')}</Text>

                <TouchableOpacity
                  style={styles.scanBtn}
                  onPress={() => setScanVisible(true)}
                  disabled={isLoading}
                  activeOpacity={0.85}
                >
                  <LinearGradient colors={['#ef4444', '#dc2626']} style={StyleSheet.absoluteFillObject} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} />
                  <Ionicons name="camera" size={20} color="#fff" />
                  <Text style={styles.scanBtnText}>{t('dailyReports.scanQrCode')}</Text>
                </TouchableOpacity>

                <View style={styles.divider}><Text style={styles.orText}>{t('common.or')}</Text></View>

                <View style={styles.searchWrap}>
                  <LinearGradient colors={['rgba(255,255,255,0.10)', 'rgba(255,255,255,0.05)']} style={styles.searchBox}>
                    <TextInput
                      placeholder={t('dailyReports.searchByCowId')}
                      value={searchQuery}
                      onChangeText={setSearchQuery}
                      style={styles.searchBoxInput}
                      placeholderTextColor="rgba(255,255,255,0.3)"
                      autoCapitalize="none"
                    />
                  </LinearGradient>
                  <TouchableOpacity style={styles.searchBoxBtn} onPress={handleSearch} disabled={isLoading} activeOpacity={0.85}>
                    <Ionicons name="search" size={18} color="#fff" />
                    <Text style={styles.searchBoxBtnText}>{t('common.search')}</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.divider}><Text style={styles.orText}>{t('common.or')}</Text></View>

                <TouchableOpacity style={styles.listViewBtn} onPress={handleListCows} disabled={isLoadingCows} activeOpacity={0.85}>
                  <Ionicons name="list" size={20} color="#fff" />
                  <Text style={styles.listViewBtnText}>{t('dailyReports.viewAllCows')}</Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          </ScrollView>

          {/* Scanner Modal */}
          <Modal visible={scanVisible} animationType="slide">
            <View style={styles.scanModalWrap}>
              <SafeAreaView style={styles.scanModalSafe}>
                <Text style={styles.scanModalTitle}>{t('dailyReports.scanQrCode')}</Text>
                {permission?.granted === false ? (
                  <View style={styles.centerWrap}>
                    <Text style={styles.scanPermText}>Camera permission not granted.</Text>
                    <TouchableOpacity style={styles.permBtn} onPress={requestPermission}>
                      <Ionicons name="camera" size={16} color="#fff" />
                      <Text style={styles.permBtnText}>Grant Permission</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.scannerBox}>
                    <CameraView
                      style={StyleSheet.absoluteFillObject}
                      onBarcodeScanned={handleScan}
                      barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                    />
                  </View>
                )}
                <TouchableOpacity style={styles.scanCloseBtn} onPress={() => setScanVisible(false)}>
                  <Text style={styles.scanCloseBtnText}>{t('common.close')}</Text>
                </TouchableOpacity>
              </SafeAreaView>
            </View>
          </Modal>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  // ═════════════════════════════════════════════════════════════════════════
  // MODE: COW SELECTED
  // ═════════════════════════════════════════════════════════════════════════
  if (mode === 'cowSelected') {
    return (
      <LinearGradient colors={['#0f1923', '#142233', '#0d1f2d']} style={styles.gradient}>
        <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
        <SafeAreaView style={styles.safe}>
          <View style={styles.langWrap}><LanguageSelector /></View>
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            <Animated.View style={animStyle}>
              <View style={styles.headerRow}>
                <TouchableOpacity onPress={() => { setMode('initial'); setCowData(null); setSearchQuery(''); }} style={styles.backBtn}>
                  <Ionicons name="arrow-back" size={20} color="#fff" />
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                  <Text style={styles.pageTitle}>{t('dailyReports.title')}</Text>
                  <Text style={styles.pageSubtitle}>{cowData?.name || t('dailyReports.cowDetails')}</Text>
                </View>
              </View>

              <LinearGradient colors={['rgba(255,255,255,0.10)', 'rgba(255,255,255,0.05)']} style={styles.cowInfoBox}>
                <Text style={styles.cowInfoName}>{cowData?.name || t('dailyReports.unknown')}</Text>
                <Text style={styles.cowInfoId}>{t('dailyReports.cowId')}: {cowData?.uniqueId}</Text>
                <Text style={styles.cowInfoBreed}>{t('dailyReports.breed')}: {cowData?.breed || t('dailyReports.na')}</Text>
              </LinearGradient>

              <View style={styles.actionBtnRow}>
                <TouchableOpacity style={styles.actionCard} onPress={handleEnterData} activeOpacity={0.85}>
                  <LinearGradient colors={['#ef4444', '#dc2626']} style={styles.actionCardGradient}>
                    <Ionicons name="create-outline" size={32} color="#fff" />
                    <Text style={styles.actionCardTitle}>{t('dailyReports.enterTodayReport')}</Text>
                    <Text style={styles.actionCardSub}>{t('dailyReports.recordHealthStatus')}</Text>
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity style={styles.actionCard} onPress={handleViewDetails} activeOpacity={0.85}>
                  <LinearGradient colors={['#3b82f6', '#2563eb']} style={styles.actionCardGradient}>
                    <Ionicons name="eye-outline" size={32} color="#fff" />
                    <Text style={styles.actionCardTitle}>{t('dailyReports.viewDetails')}</Text>
                    <Text style={styles.actionCardSub}>{t('dailyReports.viewReportsByDate')}</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </Animated.View>
          </ScrollView>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  // ═════════════════════════════════════════════════════════════════════════
  // MODE: ENTER DATA / VIEW DETAILS
  // ═════════════════════════════════════════════════════════════════════════
  return (
    <LinearGradient colors={['#0f1923', '#142233', '#0d1f2d']} style={styles.gradient}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <SafeAreaView style={styles.safe}>
        <View style={styles.langWrap}><LanguageSelector /></View>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <Animated.View style={animStyle}>
            <View style={styles.headerRow}>
              <TouchableOpacity onPress={() => setMode('cowSelected')} style={styles.backBtn}>
                <Ionicons name="arrow-back" size={20} color="#fff" />
              </TouchableOpacity>
              <View style={{ flex: 1 }}>
                <Text style={styles.pageTitle}>
                  {mode === 'enterData' ? t('dailyReports.enterTodayReportTitle') : t('dailyReports.viewDetails')}
                </Text>
                <Text style={styles.pageSubtitle}>{cowData?.name || t('dailyReports.cowDetails')}</Text>
              </View>
            </View>

            {mode === 'viewDetails' && (
              <View style={styles.dateNav}>
                <TouchableOpacity onPress={goPrevDay} style={styles.dateNavBtn} activeOpacity={0.8}>
                  <Ionicons name="chevron-back" size={14} color="rgba(255,255,255,0.7)" />
                </TouchableOpacity>
                <TouchableOpacity onPress={openDatePicker} style={styles.dateBadge} activeOpacity={0.8}>
                  <Ionicons name="calendar" size={14} color="rgba(255,255,255,0.7)" />
                  <Text style={styles.dateBadgeText} numberOfLines={1}>{formatPrettyDate(selectedDate)}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={goNextDay} style={styles.dateNavBtn} activeOpacity={0.8}>
                  <Ionicons name="chevron-forward" size={14} color="rgba(255,255,255,0.7)" />
                </TouchableOpacity>
                <TouchableOpacity onPress={goToday} style={styles.todayBtn} activeOpacity={0.8}>
                  <Ionicons name="flash" size={12} color="#fff" />
                  <Text style={styles.todayBtnText}>{t('common.today')}</Text>
                </TouchableOpacity>
              </View>
            )}

            {mode === 'enterData' && (
              <View style={styles.todayBadgeBox}>
                <Ionicons name="calendar" size={14} color="#ef4444" />
                <Text style={styles.todayBadgeBoxText}>{t('common.today')}: {formatPrettyDate(new Date())}</Text>
              </View>
            )}

            {/* Health status summary */}
            {currentReport?.healthStatus && (
              <LinearGradient
                colors={[getStatusColor(currentReport.healthStatus) + '20', getStatusColor(currentReport.healthStatus) + '10']}
                style={[styles.statusSummary, { borderColor: getStatusColor(currentReport.healthStatus) }]}
              >
                <Ionicons name="pulse" size={22} color={getStatusColor(currentReport.healthStatus)} />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.statusSummaryLabel}>{t('dailyReports.healthStatus')}</Text>
                  <Text style={[styles.statusSummaryValue, { color: getStatusColor(currentReport.healthStatus) }]}>
                    {HEALTH_STATUS.find(s => s.key === currentReport.healthStatus)?.label || currentReport.healthStatus}
                  </Text>
                </View>
              </LinearGradient>
            )}

            {currentReport || mode === 'enterData' ? (
              renderHealthForm()
            ) : (
              <View style={styles.emptyBox}>
                <Ionicons name="medical" size={48} color="rgba(255,255,255,0.2)" />
                <Text style={styles.emptyBoxText}>
                  {mode === 'viewDetails'
                    ? t('dailyReports.noReportFound') + ' ' + formatPrettyDate(selectedDate) + '.'
                    : t('dailyReports.startEnteringReport')}
                </Text>
              </View>
            )}

            {/* AI Analysis */}
            {currentReport && (
              <TouchableOpacity
                style={[styles.aiBtn, isLoadingAI && styles.btnDisabled]}
                onPress={handleGetAIAnalysis}
                disabled={isLoadingAI}
                activeOpacity={0.85}
              >
                <LinearGradient colors={['#7c3aed', '#6d28d9']} style={StyleSheet.absoluteFillObject} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} />
                {isLoadingAI ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="sparkles" size={18} color="#fff" />
                    <Text style={styles.aiBtnText}>{t('dailyReports.getAIAnalysis')}</Text>
                  </>
                )}
              </TouchableOpacity>
            )}

            {mode === 'enterData' && (
              <TouchableOpacity
                style={[styles.saveBtn, isLoading && styles.btnDisabled]}
                onPress={handleSave}
                disabled={isLoading}
                activeOpacity={0.85}
              >
                <LinearGradient colors={['#22c55e', '#16a34a']} style={StyleSheet.absoluteFillObject} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} />
                {isLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Text style={styles.saveBtnText}>{t('dailyReports.saveHealthReport')}</Text>
                    <Ionicons name="checkmark-circle" size={18} color="#fff" style={{ marginLeft: 8 }} />
                  </>
                )}
              </TouchableOpacity>
            )}
          </Animated.View>
        </ScrollView>

        {/* AI Analysis Modal */}
        <Modal visible={showAIAnalysis} transparent animationType="slide" onRequestClose={() => setShowAIAnalysis(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalSheet}>
              <View style={styles.modalHandle} />
              <View style={styles.modalHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={styles.aiSparkBadge}>
                    <Ionicons name="sparkles" size={14} color="#fff" />
                  </View>
                  <Text style={styles.modalTitle}>{t('dailyReports.aiHealthAnalysis')}</Text>
                </View>
                <TouchableOpacity onPress={() => setShowAIAnalysis(false)} style={styles.modalClose}>
                  <Ionicons name="close" size={20} color="#6b7280" />
                </TouchableOpacity>
              </View>
              <ScrollView style={{ marginBottom: 12 }} showsVerticalScrollIndicator={false}>
                <Text style={styles.aiText}>{aiAnalysis}</Text>
              </ScrollView>
              <TouchableOpacity style={styles.modalConfirmBtn} onPress={() => setShowAIAnalysis(false)}>
                <Text style={styles.modalConfirmText}>{t('common.close')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Date Picker Modal */}
        <Modal visible={datePickerVisible} transparent animationType="slide" onRequestClose={() => setDatePickerVisible(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalSheet}>
              <View style={styles.modalHandle} />
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{t('dailyReports.selectDate')}</Text>
                <TouchableOpacity onPress={() => setDatePickerVisible(false)} style={styles.modalClose}>
                  <Ionicons name="close" size={20} color="#6b7280" />
                </TouchableOpacity>
              </View>
              {renderCalendar()}
              <View style={styles.modalBtns}>
                <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setDatePickerVisible(false)}>
                  <Text style={styles.modalCancelText}>{t('common.cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalConfirmBtn} onPress={handleDateSelect}>
                  <Text style={styles.modalConfirmText}>{t('common.select')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </LinearGradient>
  );
}

// ═════════════════════════════════════════════════════════════════════════
// STYLES
// ═════════════════════════════════════════════════════════════════════════
const styles = StyleSheet.create({
  gradient: { flex: 1 },
  safe: { flex: 1, paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0 },

  langWrap: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 52 : (StatusBar.currentHeight || 0) + 12,
    right: 16,
    zIndex: 1000,
  },

  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 64 : (StatusBar.currentHeight || 0) + 20,
    paddingBottom: 48,
  },
  scrollCentered: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 64 : (StatusBar.currentHeight || 0) + 20,
    paddingBottom: 48,
  },

  // Header
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 24 },
  backBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
  },
  pageTitle: { fontSize: 22, fontWeight: '800', color: '#fff', letterSpacing: 0.2 },
  pageSubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.5)', marginTop: 2, fontWeight: '500' },

  // Initial screen
  initialWrap: { alignItems: 'center', gap: 16, marginTop: 40 },
  medIconBadge: {
    width: 140, height: 140, borderRadius: 70,
    backgroundColor: 'rgba(239,68,68,0.12)',
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 10,
    borderWidth: 2, borderColor: 'rgba(239,68,68,0.2)',
  },
  initialTitle: { fontSize: 22, fontWeight: '700', color: '#fff', textAlign: 'center' },
  initialSub: { fontSize: 14, color: 'rgba(255,255,255,0.5)', textAlign: 'center', paddingHorizontal: 30, marginBottom: 10 },

  scanBtn: {
    width: '100%', borderRadius: 14, paddingVertical: 16,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8,
    overflow: 'hidden',
    shadowColor: '#ef4444', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 8,
  },
  scanBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  divider: { width: '100%', alignItems: 'center', marginVertical: 10 },
  orText: { fontSize: 12, color: 'rgba(255,255,255,0.4)', fontWeight: '600', textTransform: 'uppercase' },

  searchWrap: { width: '100%', gap: 10 },
  searchBox: {
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  searchBoxInput: { fontSize: 15, color: '#fff', fontWeight: '500' },
  searchBoxBtn: {
    backgroundColor: '#3b82f6', borderRadius: 12, paddingVertical: 14,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8,
    shadowColor: '#3b82f6', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.35, shadowRadius: 6, elevation: 6,
  },
  searchBoxBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  listViewBtn: {
    width: '100%', backgroundColor: '#3b82f6', borderRadius: 12, paddingVertical: 14,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8,
    shadowColor: '#3b82f6', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.35, shadowRadius: 6, elevation: 6,
  },
  listViewBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  // List view
  searchBarWrap: { paddingHorizontal: 20, paddingVertical: 12 },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  searchInput: { flex: 1, fontSize: 15, color: '#fff', fontWeight: '500' },

  listContent: { padding: 20, gap: 12 },
  cowTile: { borderRadius: 16, overflow: 'hidden' },
  cowTileInner: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  cowIconBadge: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(239,68,68,0.12)',
    justifyContent: 'center', alignItems: 'center',
  },
  cowTileName: { fontSize: 16, fontWeight: '700', color: '#fff', marginBottom: 3 },
  cowTileId: { fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 2 },
  cowTileBreed: { fontSize: 12, color: 'rgba(255,255,255,0.5)' },

  centerWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 60, gap: 14 },
  loadingText: { fontSize: 14, color: 'rgba(255,255,255,0.5)', fontWeight: '500' },
  emptyText: { fontSize: 14, color: 'rgba(255,255,255,0.4)', textAlign: 'center', paddingHorizontal: 40 },
  addBtn: {
    marginTop: 10, backgroundColor: '#ef4444', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 20,
    flexDirection: 'row', alignItems: 'center', gap: 6,
  },
  addBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },

  // Cow selected
  cowInfoBox: {
    borderRadius: 18, padding: 20, marginBottom: 20,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  cowInfoName: { fontSize: 20, fontWeight: '800', color: '#fff', marginBottom: 8 },
  cowInfoId: { fontSize: 13, color: 'rgba(255,255,255,0.6)', marginBottom: 4 },
  cowInfoBreed: { fontSize: 13, color: 'rgba(255,255,255,0.6)' },

  actionBtnRow: { gap: 14 },
  actionCard: { borderRadius: 16, overflow: 'hidden' },
  actionCardGradient: {
    padding: 24, alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 8,
  },
  actionCardTitle: { color: '#fff', fontSize: 17, fontWeight: '700', marginTop: 12, marginBottom: 4 },
  actionCardSub: { color: 'rgba(255,255,255,0.8)', fontSize: 13 },

  // Date nav
  dateNav: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  dateNavBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  dateBadge: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  dateBadgeText: { fontSize: 12, color: 'rgba(255,255,255,0.7)', fontWeight: '600', flex: 1, textAlign: 'center' },
  todayBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#ef4444', borderRadius: 10, paddingVertical: 8, paddingHorizontal: 10,
  },
  todayBtnText: { fontSize: 11, color: '#fff', fontWeight: '700' },

  todayBadgeBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(239,68,68,0.12)', borderRadius: 12,
    paddingVertical: 10, paddingHorizontal: 14, marginBottom: 16, alignSelf: 'flex-start',
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.25)',
  },
  todayBadgeBoxText: { fontSize: 13, color: '#ef4444', fontWeight: '600' },

  // Status summary
  statusSummary: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 16, padding: 16, marginBottom: 16,
    borderWidth: 2,
  },
  statusSummaryLabel: { fontSize: 13, color: 'rgba(255,255,255,0.6)', fontWeight: '600' },
  statusSummaryValue: { fontSize: 18, fontWeight: '800', marginTop: 2 },

  // Form card
  card: {
    backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 18, padding: 18,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', gap: 14,
  },
  cowInfoBadge: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 12, padding: 12, marginBottom: 8,
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)',
  },
  cowIdBadge: { fontSize: 14, fontWeight: '700', color: '#ef4444' },
  cowNameBadge: { fontSize: 12, color: 'rgba(239,68,68,0.8)', marginTop: 2 },

  fieldLabel: {
    fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.5)',
    letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 6,
  },
  inputField: {
    backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: '#fff', fontWeight: '500',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  textarea: { minHeight: 80, textAlignVertical: 'top' },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statusChip: {
    paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12,
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  statusChipText: { fontSize: 12, color: 'rgba(255,255,255,0.6)', fontWeight: '600' },
  statusChipTextActive: { color: '#fff', fontWeight: '700' },

  illnessChip: {
    paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  illnessChipActive: { backgroundColor: '#f59e0b', borderColor: '#f59e0b' },
  illnessChipText: { fontSize: 11, color: 'rgba(255,255,255,0.6)', fontWeight: '600' },
  illnessChipTextActive: { color: '#fff' },

  appetiteChip: {
    paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  appetiteChipActive: { backgroundColor: '#8b5cf6', borderColor: '#8b5cf6' },
  appetiteChipText: { fontSize: 11, color: 'rgba(255,255,255,0.6)', fontWeight: '600' },
  appetiteChipTextActive: { color: '#fff' },

  chipDisabled: { opacity: 0.5 },

  checkboxRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12, marginBottom: 8 },
  checkbox: {
    width: 22, height: 22, borderRadius: 6,
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center', alignItems: 'center',
  },
  checkboxChecked: { backgroundColor: '#22c55e', borderColor: '#22c55e' },
  checkboxLabel: { fontSize: 13, color: 'rgba(255,255,255,0.8)', fontWeight: '600', marginLeft: 10 },

  emptyBox: { alignItems: 'center', paddingVertical: 40, gap: 12 },
  emptyBoxText: { fontSize: 14, color: 'rgba(255,255,255,0.4)', textAlign: 'center', paddingHorizontal: 30 },

  aiBtn: {
    marginTop: 16, borderRadius: 12, paddingVertical: 14,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8,
    overflow: 'hidden',
    shadowColor: '#7c3aed', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 6,
  },
  aiBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  saveBtn: {
    marginTop: 24, borderRadius: 14, paddingVertical: 16,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    overflow: 'hidden',
    shadowColor: '#22c55e', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 8,
  },
  btnDisabled: { opacity: 0.5 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  // Scanner modal
  scanModalWrap: { flex: 1, backgroundColor: '#000' },
  scanModalSafe: { flex: 1 },
  scanModalTitle: { color: '#fff', textAlign: 'center', padding: 16, fontWeight: '700', fontSize: 16 },
  scanPermText: { color: 'rgba(255,255,255,0.7)', textAlign: 'center', paddingHorizontal: 40, marginBottom: 16 },
  permBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#ef4444', borderRadius: 10, paddingVertical: 12, paddingHorizontal: 16,
  },
  permBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  scannerBox: { flex: 1 },
  scanCloseBtn: { padding: 16, backgroundColor: '#0f1923', alignItems: 'center' },
  scanCloseBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },

  // Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: '#1a2535',
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 24, paddingBottom: 36,
    borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  modalHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignSelf: 'center', marginBottom: 20,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },
  modalClose: {
    width: 32, height: 32, borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center', alignItems: 'center',
  },
  aiSparkBadge: {
    width: 28, height: 28, borderRadius: 8,
    backgroundColor: '#7c3aed',
    justifyContent: 'center', alignItems: 'center',
  },
  aiText: { fontSize: 15, color: 'rgba(255,255,255,0.85)', lineHeight: 24 },

  // Calendar
  calWrap: { marginBottom: 20 },
  calHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, paddingHorizontal: 8 },
  calNavBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.06)', justifyContent: 'center', alignItems: 'center' },
  calMonth: { fontSize: 16, fontWeight: '700', color: '#fff' },
  calWeekRow: { flexDirection: 'row', marginBottom: 8 },
  calWeekCell: { flex: 1, alignItems: 'center', paddingVertical: 6 },
  calWeekText: { fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.5)' },
  calGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calCell: { width: '14.28%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', padding: 4 },
  calCellSel: { backgroundColor: '#ef4444', borderRadius: 12 },
  calCellToday: { backgroundColor: 'rgba(239,68,68,0.12)', borderRadius: 12 },
  calDayText: { fontSize: 13, color: 'rgba(255,255,255,0.7)', fontWeight: '500' },
  calDayTextSel: { color: '#fff', fontWeight: '700' },
  calDayTextToday: { color: '#ef4444', fontWeight: '700' },

  modalBtns: { flexDirection: 'row', gap: 10, marginTop: 20 },
  modalCancelBtn: {
    flex: 1, paddingVertical: 13, borderRadius: 12, alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  modalCancelText: { color: 'rgba(255,255,255,0.6)', fontSize: 15, fontWeight: '600' },
  modalConfirmBtn: { flex: 1, paddingVertical: 13, borderRadius: 12, alignItems: 'center', backgroundColor: '#ef4444' },
  modalConfirmText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});