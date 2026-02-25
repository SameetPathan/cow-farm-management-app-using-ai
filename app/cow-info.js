import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { CameraView, useCameraPermissions } from "expo-camera";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { child, get, ref, set } from "firebase/database";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import LanguageSelector from "../components/LanguageSelector";
import { useLanguage } from "../contexts/LanguageContext";
import { database } from "../firebaseConfig";

// ─── Tab button ──────────────────────────────────────────────────────────────
function TabButton({ label, active, onPress }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.tabBtn, active && styles.tabBtnActive]}
      activeOpacity={0.8}
    >
      <Text
        style={[styles.tabText, active && styles.tabTextActive]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

export default function CowInfoScreen() {
  const { t } = useLanguage();
  const [mode, setMode] = useState("initial");
  const [activeTab, setActiveTab] = useState("Overview");
  const TABS = [
    { key: "Overview", label: t("cowInfo.overview") },
    { key: "Vitals", label: t("cowInfo.vitals") },
    { key: "Production", label: t("cowInfo.production") },
    { key: "Intake", label: t("cowInfo.intake") },
    { key: "Health", label: t("cowInfo.health") },
  ];
  const [searchQuery, setSearchQuery] = useState("");
  const [cowData, setCowData] = useState(null);
  const [records, setRecords] = useState({});
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [scanVisible, setScanVisible] = useState(false);
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [tempSelectedDate, setTempSelectedDate] = useState(new Date());
  const [permission, requestPermission] = useCameraPermissions();
  const [isLoading, setIsLoading] = useState(false);
  const [userPhone, setUserPhone] = useState("");
  const [allCows, setAllCows] = useState([]);
  const [filteredCows, setFilteredCows] = useState([]);
  const [isLoadingCows, setIsLoadingCows] = useState(false);

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(fadeAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 60,
        friction: 9,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 60,
        friction: 9,
      }),
    ]).start();
  }, [mode]);

  useEffect(() => {
    AsyncStorage.getItem("userPhone")
      .then((phone) => {
        if (phone) setUserPhone(phone);
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (mode === "listCows" && userPhone) loadAllCows();
  }, [mode, userPhone]);

  const loadAllCows = async () => {
    if (!userPhone) return;
    setIsLoadingCows(true);
    try {
      const snapshot = await get(ref(database, "CowFarm/cows"));
      if (snapshot.exists()) {
        const data = snapshot.val();
        const userCows = Object.entries(data)
          .filter(([, c]) => c.userPhoneNumber === userPhone)
          .map(([id, c]) => ({ ...c, uniqueId: id }))
          .sort((a, b) =>
            (a.name || "")
              .toLowerCase()
              .localeCompare((b.name || "").toLowerCase()),
          );
        setAllCows(userCows);
        setFilteredCows(userCows);
      } else {
        setAllCows([]);
        setFilteredCows([]);
      }
    } catch (e) {
      Alert.alert(
        t("common.error"),
        t("cowInfo.failedToLoadCows") + ": " + e.message,
      );
      setAllCows([]);
      setFilteredCows([]);
    } finally {
      setIsLoadingCows(false);
    }
  };

  useEffect(() => {
    if (mode === "listCows") {
      const q = searchQuery.toLowerCase();
      setFilteredCows(
        q
          ? allCows.filter(
              (c) =>
                c.name?.toLowerCase().includes(q) ||
                c.uniqueId?.toLowerCase().includes(q) ||
                c.breed?.toLowerCase().includes(q),
            )
          : allCows,
      );
    }
  }, [searchQuery, allCows, mode]);

  const dateKey = useMemo(() => {
    const y = selectedDate.getFullYear();
    const m = String(selectedDate.getMonth() + 1).padStart(2, "0");
    const d = String(selectedDate.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }, [selectedDate]);

  const todayKey = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  }, []);

  const data = records[dateKey] || null;

  const formatPrettyDate = (date) =>
    date.toLocaleDateString(undefined, {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
    });

  const formatDate = (date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

  const fetchCowData = async (searchValue) => {
    setIsLoading(true);
    try {
      const dbRef = ref(database);
      const cowSnapshot = await get(
        child(dbRef, `CowFarm/cows/${searchValue}`),
      );
      if (cowSnapshot.exists()) {
        setCowData({ ...cowSnapshot.val(), uniqueId: searchValue });
        setMode("cowSelected");
        setIsLoading(false);
        return true;
      }
      const allSnapshot = await get(ref(database, "CowFarm/cows"));
      if (allSnapshot.exists()) {
        const found = Object.entries(allSnapshot.val()).find(
          ([, c]) =>
            c.name && c.name.toLowerCase().includes(searchValue.toLowerCase()),
        );
        if (found) {
          const [id, c] = found;
          setCowData({ ...c, uniqueId: id });
          setMode("cowSelected");
          setIsLoading(false);
          return true;
        }
      }
      Alert.alert(t("common.error"), t("cowInfo.cowNotFound"));
      setIsLoading(false);
      return false;
    } catch (e) {
      Alert.alert(
        t("common.error"),
        t("cowInfo.failedToFetchCowData") + ": " + e.message,
      );
      setIsLoading(false);
      return false;
    }
  };

  const loadDailyReport = async (date) => {
    if (!cowData?.uniqueId) return;
    setIsLoading(true);
    try {
      const reportSnapshot = await get(
        child(ref(database), `CowFarm/reports/${cowData.uniqueId}/${date}`),
      );
      setRecords((prev) => ({
        ...prev,
        [date]: reportSnapshot.exists() ? reportSnapshot.val() : {},
      }));
    } catch (e) {
      console.error(e);
    } finally {
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
      Alert.alert(t("common.error"), t("cowInfo.enterSearch"));
      return;
    }
    await fetchCowData(searchQuery.trim());
  };
  const handleListCows = () => setMode("listCows");
  const handleSelectCow = (cow) => {
    setCowData(cow);
    setMode("cowSelected");
    setSearchQuery("");
  };
  const handleEnterReport = () => {
    setSelectedDate(new Date());
    setMode("enterReport");
    loadDailyReport(todayKey);
  };
  const handleViewDetails = () => {
    setMode("viewDetails");
    loadDailyReport(dateKey);
  };
  const updateRecord = (field, value) =>
    setRecords((prev) => ({
      ...prev,
      [dateKey]: { ...(prev[dateKey] || {}), [field]: value },
    }));

  const handleSave = async () => {
    if (!cowData?.uniqueId) {
      Alert.alert(t("common.error"), t("cowInfo.cowDataNotFound"));
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
        userPhoneNumber: userPhone,
      };
      await set(
        child(ref(database), `CowFarm/reports/${cowData.uniqueId}/${dateKey}`),
        reportData,
      );
      Alert.alert(
        t("common.success"),
        t("cowInfo.reportSaved") + " " + formatPrettyDate(selectedDate),
        [{ text: t("common.ok"), onPress: () => setMode("cowSelected") }],
      );
    } catch (e) {
      Alert.alert(
        t("common.error"),
        t("cowInfo.failedToSaveReport") + ": " + e.message,
      );
    } finally {
      setIsLoading(false);
    }
  };

  const goPrevDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() - 1);
    setSelectedDate(d);
    loadDailyReport(formatDate(d));
  };
  const goNextDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + 1);
    setSelectedDate(d);
    loadDailyReport(formatDate(d));
  };
  const goToday = () => {
    const d = new Date();
    setSelectedDate(d);
    loadDailyReport(todayKey);
  };
  const openDatePicker = () => {
    setTempSelectedDate(new Date(selectedDate));
    setDatePickerVisible(true);
  };
  const handleDateSelect = () => {
    setSelectedDate(new Date(tempSelectedDate));
    loadDailyReport(formatDate(tempSelectedDate));
    setDatePickerVisible(false);
  };

  // Calendar helpers
  const getDaysInMonth = (date) =>
    new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const getFirstDayOfMonth = (date) =>
    new Date(date.getFullYear(), date.getMonth(), 1).getDay();

  const renderCalendar = () => {
    const daysInMonth = getDaysInMonth(tempSelectedDate);
    const firstDay = getFirstDayOfMonth(tempSelectedDate);
    const days = [
      ...Array(firstDay).fill(null),
      ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
    ];
    const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const months = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];
    const changeMonth = (delta) => {
      const d = new Date(tempSelectedDate);
      d.setMonth(d.getMonth() + delta);
      setTempSelectedDate(d);
    };

    return (
      <View style={styles.calWrap}>
        <View style={styles.calHeader}>
          <TouchableOpacity
            onPress={() => changeMonth(-1)}
            style={styles.calNavBtn}
          >
            <Ionicons
              name="chevron-back"
              size={18}
              color="rgba(255,255,255,0.7)"
            />
          </TouchableOpacity>
          <Text style={styles.calMonth}>
            {months[tempSelectedDate.getMonth()]}{" "}
            {tempSelectedDate.getFullYear()}
          </Text>
          <TouchableOpacity
            onPress={() => changeMonth(1)}
            style={styles.calNavBtn}
          >
            <Ionicons
              name="chevron-forward"
              size={18}
              color="rgba(255,255,255,0.7)"
            />
          </TouchableOpacity>
        </View>
        <View style={styles.calWeekRow}>
          {weekDays.map((d) => (
            <View key={d} style={styles.calWeekCell}>
              <Text style={styles.calWeekText}>{d}</Text>
            </View>
          ))}
        </View>
        <View style={styles.calGrid}>
          {days.map((day, i) => {
            if (!day) return <View key={i} style={styles.calCell} />;
            const isSelected = day === tempSelectedDate.getDate();
            const now = new Date();
            const isToday =
              day === now.getDate() &&
              tempSelectedDate.getMonth() === now.getMonth() &&
              tempSelectedDate.getFullYear() === now.getFullYear();
            return (
              <TouchableOpacity
                key={i}
                style={[
                  styles.calCell,
                  isSelected && styles.calCellSel,
                  isToday && !isSelected && styles.calCellToday,
                ]}
                onPress={() => {
                  const d = new Date(tempSelectedDate);
                  d.setDate(day);
                  setTempSelectedDate(d);
                }}
                activeOpacity={0.75}
              >
                <Text
                  style={[
                    styles.calDayText,
                    isSelected && styles.calDayTextSel,
                    isToday && !isSelected && styles.calDayTextToday,
                  ]}
                >
                  {day}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  };

  // Tab content renderers
  const renderOverview = () => (
    <View style={styles.card}>
      {[
        { label: t("cowInfo.cowId"), value: cowData?.uniqueId },
        { label: t("cowInfo.name"), value: cowData?.name },
        { label: t("cowInfo.breed"), value: cowData?.breed },
        { label: t("cowInfo.dateOfBirth"), value: cowData?.dob },
      ].map(({ label, value }) => (
        <View key={label}>
          <Text style={styles.fieldLabel}>{label}</Text>
          <View style={styles.fieldBox}>
            <Text style={styles.fieldText}>{value || "—"}</Text>
          </View>
        </View>
      ))}
    </View>
  );

  const renderVitals = () => (
    <View style={styles.card}>
      {[
        {
          label: t("cowInfo.weight"),
          field: "weight",
          placeholder: t("cowInfo.enterWeight"),
        },
        {
          label: t("cowInfo.height"),
          field: "height",
          placeholder: t("cowInfo.enterHeight"),
        },
        {
          label: t("cowInfo.temperature"),
          field: "temperature",
          placeholder: t("cowInfo.enterTemperature"),
        },
      ].map(({ label, field, placeholder }) => (
        <View key={field}>
          <Text style={styles.fieldLabel}>{label}</Text>
          <TextInput
            value={data?.[field] || ""}
            onChangeText={(v) => updateRecord(field, v)}
            style={styles.inputField}
            keyboardType="decimal-pad"
            placeholder={placeholder}
            placeholderTextColor="rgba(255,255,255,0.3)"
          />
        </View>
      ))}
    </View>
  );

  const renderProduction = () => (
    <View style={styles.card}>
      <Text style={styles.fieldLabel}>{t("cowInfo.milkYield")}</Text>
      <TextInput
        value={data?.milkYield || ""}
        onChangeText={(v) => updateRecord("milkYield", v)}
        style={styles.inputField}
        keyboardType="decimal-pad"
        placeholder={t("cowInfo.enterMilkYield")}
        placeholderTextColor="rgba(255,255,255,0.3)"
      />
    </View>
  );

  const renderIntake = () => (
    <View style={styles.card}>
      {[
        {
          label: t("cowInfo.foodIntake"),
          field: "intakeFood",
          placeholder: t("cowInfo.enterFoodIntake"),
        },
        {
          label: t("cowInfo.waterIntake"),
          field: "intakeWater",
          placeholder: t("cowInfo.enterWaterIntake"),
        },
      ].map(({ label, field, placeholder }) => (
        <View key={field}>
          <Text style={styles.fieldLabel}>{label}</Text>
          <TextInput
            value={data?.[field] || ""}
            onChangeText={(v) => updateRecord(field, v)}
            style={styles.inputField}
            keyboardType="decimal-pad"
            placeholder={placeholder}
            placeholderTextColor="rgba(255,255,255,0.3)"
          />
        </View>
      ))}
    </View>
  );

  const renderHealth = () => (
    <View style={styles.card}>
      {[
        {
          label: t("cowInfo.vaccinations"),
          field: "vaccinations",
          placeholder: t("cowInfo.enterVaccinationDetails"),
        },
        {
          label: t("cowInfo.illnessHistory"),
          field: "illnesses",
          placeholder: t("cowInfo.enterIllnessHistory"),
        },
      ].map(({ label, field, placeholder }) => (
        <View key={field}>
          <Text style={styles.fieldLabel}>{label}</Text>
          <TextInput
            value={data?.[field] || ""}
            onChangeText={(v) => updateRecord(field, v)}
            style={[styles.inputField, styles.textarea]}
            multiline
            placeholder={placeholder}
            placeholderTextColor="rgba(255,255,255,0.3)"
          />
        </View>
      ))}
    </View>
  );

  const Content = useMemo(() => {
    const map = {
      Vitals: renderVitals,
      Production: renderProduction,
      Intake: renderIntake,
      Health: renderHealth,
      Overview: renderOverview,
    };
    return map[activeTab] || renderOverview;
  }, [activeTab, data, cowData]);

  const animStyle = {
    opacity: fadeAnim,
    transform: [{ translateY: slideAnim }],
  };

  // ═════════════════════════════════════════════════════════════════════════
  // MODE: LIST COWS
  // ═════════════════════════════════════════════════════════════════════════
  if (mode === "listCows") {
    return (
      <LinearGradient
        colors={["#0f1923", "#142233", "#0d1f2d"]}
        style={styles.gradient}
      >
        <StatusBar
          barStyle="light-content"
          backgroundColor="transparent"
          translucent
        />
        <SafeAreaView style={styles.safe}>
          <View style={styles.langWrap}>
            <LanguageSelector />
          </View>

          <Animated.View style={[styles.headerRow, animStyle]}>
            <TouchableOpacity
              onPress={() => {
                setMode("initial");
                setSearchQuery("");
                setFilteredCows([]);
              }}
              style={styles.backBtn}
            >
              <Ionicons name="arrow-back" size={20} color="#fff" />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={styles.pageTitle}>{t("cowInfo.allCows")}</Text>
              <Text style={styles.pageSubtitle}>
                {filteredCows.length}{" "}
                {filteredCows.length !== 1
                  ? t("cowInfo.cowsFoundPlural")
                  : t("cowInfo.cowsFound")}
              </Text>
            </View>
          </Animated.View>

          {/* Search bar */}
          <View style={styles.searchBarWrap}>
            <LinearGradient
              colors={["rgba(255,255,255,0.10)", "rgba(255,255,255,0.05)"]}
              style={styles.searchBar}
            >
              <Ionicons name="search" size={16} color="rgba(255,255,255,0.5)" />
              <TextInput
                placeholder={t("cowInfo.searchByCowId")}
                value={searchQuery}
                onChangeText={setSearchQuery}
                style={styles.searchInput}
                placeholderTextColor="rgba(255,255,255,0.3)"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity
                  onPress={() => setSearchQuery("")}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons
                    name="close-circle"
                    size={16}
                    color="rgba(255,255,255,0.5)"
                  />
                </TouchableOpacity>
              )}
            </LinearGradient>
          </View>

          {/* List */}
          {isLoadingCows ? (
            <View style={styles.centerWrap}>
              <ActivityIndicator size="large" color="#22c55e" />
              <Text style={styles.loadingText}>{t("cowInfo.loadingCows")}</Text>
            </View>
          ) : filteredCows.length > 0 ? (
            <FlatList
              data={filteredCows}
              keyExtractor={(c) => c.uniqueId}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => handleSelectCow(item)}
                  style={styles.cowTile}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={[
                      "rgba(255,255,255,0.10)",
                      "rgba(255,255,255,0.05)",
                    ]}
                    style={styles.cowTileInner}
                  >
                    <View style={styles.cowIconBadge}>
                      <Ionicons name="leaf" size={20} color="#22c55e" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cowTileName} numberOfLines={1}>
                        {item.name || t("cowInfo.unnamed")}
                      </Text>
                      <Text style={styles.cowTileId} numberOfLines={1}>
                        {t("cowInfo.cowId")}: {item.uniqueId}
                      </Text>
                      {item.breed && (
                        <Text style={styles.cowTileBreed} numberOfLines={1}>
                          • {item.breed}
                        </Text>
                      )}
                    </View>
                    <Ionicons
                      name="chevron-forward"
                      size={18}
                      color="rgba(255,255,255,0.4)"
                    />
                  </LinearGradient>
                </TouchableOpacity>
              )}
            />
          ) : (
            <View style={styles.centerWrap}>
              <Ionicons
                name="leaf-outline"
                size={64}
                color="rgba(255,255,255,0.15)"
              />
              <Text style={styles.emptyText}>
                {searchQuery.trim()
                  ? t("cowInfo.noCowsFound")
                  : t("cowInfo.noCowsRegistered")}
              </Text>
              {!searchQuery.trim() && (
                <TouchableOpacity
                  style={styles.addBtn}
                  onPress={() => router.push("/cow-registration")}
                  activeOpacity={0.85}
                >
                  <Ionicons name="add-circle" size={18} color="#fff" />
                  <Text style={styles.addBtnText}>
                    {t("cowInfo.registerNewCow")}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </SafeAreaView>
      </LinearGradient>
    );
  }

  // ═════════════════════════════════════════════════════════════════════════
  // MODE: INITIAL (SCAN / SEARCH / LIST)
  // ═════════════════════════════════════════════════════════════════════════
  if (mode === "initial") {
    return (
      <LinearGradient
        colors={["#0f1923", "#142233", "#0d1f2d"]}
        style={styles.gradient}
      >
        <StatusBar
          barStyle="light-content"
          backgroundColor="transparent"
          translucent
        />
        <SafeAreaView style={styles.safe}>
          <View style={styles.langWrap}>
            <LanguageSelector />
          </View>
          <ScrollView
            contentContainerStyle={styles.scrollCentered}
            showsVerticalScrollIndicator={false}
          >
            <Animated.View style={animStyle}>
              <View style={styles.headerRow}>
                <TouchableOpacity
                  onPress={() => router.back()}
                  style={styles.backBtn}
                >
                  <Ionicons name="arrow-back" size={20} color="#fff" />
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                  <Text style={styles.pageTitle}>{t("cowInfo.title")}</Text>
                  <Text style={styles.pageSubtitle}>
                    {t("cowInfo.subtitle")}
                  </Text>
                </View>
              </View>

              <View style={styles.initialWrap}>
                <View style={styles.qrIconBadge}>
                  <Ionicons name="qr-code" size={64} color="#22c55e" />
                </View>
                <Text style={styles.initialTitle}>
                  {t("cowInfo.scanQrCode")}
                </Text>
                <Text style={styles.initialSub}>
                  {t("cowInfo.scanQrDescription")}
                </Text>

                <TouchableOpacity
                  style={styles.scanBtn}
                  onPress={() => setScanVisible(true)}
                  disabled={isLoading}
                  activeOpacity={0.85}
                >
                  <LinearGradient
                    colors={["#22c55e", "#16a34a"]}
                    style={StyleSheet.absoluteFillObject}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  />
                  <Ionicons name="camera" size={20} color="#fff" />
                  <Text style={styles.scanBtnText}>
                    {t("cowInfo.scanQrCode")}
                  </Text>
                </TouchableOpacity>

                <View style={styles.divider}>
                  <Text style={styles.orText}>{t("common.or")}</Text>
                </View>

                <View style={styles.searchWrap}>
                  <LinearGradient
                    colors={[
                      "rgba(255,255,255,0.10)",
                      "rgba(255,255,255,0.05)",
                    ]}
                    style={styles.searchBox}
                  >
                    <TextInput
                      placeholder={t("cowInfo.searchByCowId")}
                      value={searchQuery}
                      onChangeText={setSearchQuery}
                      style={styles.searchBoxInput}
                      placeholderTextColor="rgba(255,255,255,0.3)"
                      autoCapitalize="none"
                    />
                  </LinearGradient>
                  <TouchableOpacity
                    style={styles.searchBoxBtn}
                    onPress={handleSearch}
                    disabled={isLoading}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="search" size={18} color="#fff" />
                    <Text style={styles.searchBoxBtnText}>
                      {t("common.search")}
                    </Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.divider}>
                  <Text style={styles.orText}>{t("common.or")}</Text>
                </View>

                <TouchableOpacity
                  style={styles.listViewBtn}
                  onPress={handleListCows}
                  disabled={isLoadingCows}
                  activeOpacity={0.85}
                >
                  <Ionicons name="list" size={20} color="#fff" />
                  <Text style={styles.listViewBtnText}>
                    {t("cowInfo.viewAllCows")}
                  </Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          </ScrollView>

          {/* Scanner Modal */}
          <Modal visible={scanVisible} animationType="slide">
            <View style={styles.scanModalWrap}>
              <SafeAreaView style={styles.scanModalSafe}>
                <Text style={styles.scanModalTitle}>
                  {t("cowInfo.scanQrCode")}
                </Text>
                {permission?.granted === false ? (
                  <View style={styles.centerWrap}>
                    <Text style={styles.scanPermText}>
                      {t("cowInfo.cameraPermissionNotGranted")}
                    </Text>
                    <TouchableOpacity
                      style={styles.permBtn}
                      onPress={requestPermission}
                    >
                      <Ionicons name="camera" size={16} color="#fff" />
                      <Text style={styles.permBtnText}>
                        {t("cowInfo.grantPermission")}
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.scannerBox}>
                    <CameraView
                      style={StyleSheet.absoluteFillObject}
                      onBarcodeScanned={handleScan}
                      barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
                    />
                  </View>
                )}
                <TouchableOpacity
                  style={styles.scanCloseBtn}
                  onPress={() => setScanVisible(false)}
                >
                  <Text style={styles.scanCloseBtnText}>
                    {t("common.close")}
                  </Text>
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
  if (mode === "cowSelected") {
    return (
      <LinearGradient
        colors={["#0f1923", "#142233", "#0d1f2d"]}
        style={styles.gradient}
      >
        <StatusBar
          barStyle="light-content"
          backgroundColor="transparent"
          translucent
        />
        <SafeAreaView style={styles.safe}>
          <View style={styles.langWrap}>
            <LanguageSelector />
          </View>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <Animated.View style={animStyle}>
              <View style={styles.headerRow}>
                <TouchableOpacity
                  onPress={() => {
                    setMode("initial");
                    setCowData(null);
                    setSearchQuery("");
                  }}
                  style={styles.backBtn}
                >
                  <Ionicons name="arrow-back" size={20} color="#fff" />
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                  <Text style={styles.pageTitle}>{t("cowInfo.title")}</Text>
                  <Text style={styles.pageSubtitle}>
                    {cowData?.name || t("cowInfo.cowDetails")}
                  </Text>
                </View>
              </View>

              <LinearGradient
                colors={["rgba(255,255,255,0.10)", "rgba(255,255,255,0.05)"]}
                style={styles.cowInfoBox}
              >
                <Text style={styles.cowInfoName}>
                  {cowData?.name || t("cowInfo.unknown")}
                </Text>
                <Text style={styles.cowInfoId}>
                  {t("cowInfo.cowId")}: {cowData?.uniqueId}
                </Text>
                <Text style={styles.cowInfoBreed}>
                  {t("cowInfo.breed")}: {cowData?.breed || t("cowInfo.na")}
                </Text>
              </LinearGradient>

              <View style={styles.actionBtnRow}>
                <TouchableOpacity
                  style={styles.actionCard}
                  onPress={handleEnterReport}
                  activeOpacity={0.85}
                >
                  <LinearGradient
                    colors={["#22c55e", "#16a34a"]}
                    style={styles.actionCardGradient}
                  >
                    <Ionicons name="create-outline" size={32} color="#fff" />
                    <Text style={styles.actionCardTitle}>
                      {t("cowInfo.enterTodayReport")}
                    </Text>
                    <Text style={styles.actionCardSub}>
                      {t("cowInfo.addDailyDetails")}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.actionCard}
                  onPress={handleViewDetails}
                  activeOpacity={0.85}
                >
                  <LinearGradient
                    colors={["#3b82f6", "#2563eb"]}
                    style={styles.actionCardGradient}
                  >
                    <Ionicons name="eye-outline" size={32} color="#fff" />
                    <Text style={styles.actionCardTitle}>
                      {t("cowInfo.viewDetails")}
                    </Text>
                    <Text style={styles.actionCardSub}>
                      {t("cowInfo.viewReportsByDate")}
                    </Text>
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
  // MODE: ENTER REPORT / VIEW DETAILS
  // ═════════════════════════════════════════════════════════════════════════
  return (
    <LinearGradient
      colors={["#0f1923", "#142233", "#0d1f2d"]}
      style={styles.gradient}
    >
      <StatusBar
        barStyle="light-content"
        backgroundColor="transparent"
        translucent
      />
      <SafeAreaView style={styles.safe}>
        <View style={styles.langWrap}>
          <LanguageSelector />
        </View>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View style={animStyle}>
            <View style={styles.headerRow}>
              <TouchableOpacity
                onPress={() => setMode("cowSelected")}
                style={styles.backBtn}
              >
                <Ionicons name="arrow-back" size={20} color="#fff" />
              </TouchableOpacity>
              <View style={{ flex: 1 }}>
                <Text style={styles.pageTitle}>
                  {mode === "enterReport"
                    ? t("cowInfo.enterTodayReportTitle")
                    : t("cowInfo.viewDetails")}
                </Text>
                <Text style={styles.pageSubtitle}>
                  {cowData?.name || t("cowInfo.cowDetails")}
                </Text>
              </View>
            </View>

            {mode === "viewDetails" && (
              <View style={styles.dateNav}>
                <TouchableOpacity
                  onPress={goPrevDay}
                  style={styles.dateNavBtn}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name="chevron-back"
                    size={14}
                    color="rgba(255,255,255,0.7)"
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={openDatePicker}
                  style={styles.dateBadge}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name="calendar"
                    size={14}
                    color="rgba(255,255,255,0.7)"
                  />
                  <Text style={styles.dateBadgeText} numberOfLines={1}>
                    {formatPrettyDate(selectedDate)}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={goNextDay}
                  style={styles.dateNavBtn}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name="chevron-forward"
                    size={14}
                    color="rgba(255,255,255,0.7)"
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={goToday}
                  style={styles.todayBtn}
                  activeOpacity={0.8}
                >
                  <Ionicons name="flash" size={12} color="#fff" />
                  <Text style={styles.todayBtnText}>{t("common.today")}</Text>
                </TouchableOpacity>
              </View>
            )}

            {mode === "enterReport" && (
              <View style={styles.todayBadgeBox}>
                <Ionicons name="calendar" size={14} color="#22c55e" />
                <Text style={styles.todayBadgeBoxText}>
                  {t("common.today")}: {formatPrettyDate(new Date())}
                </Text>
              </View>
            )}

            {/* Tabs */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.tabsScroll}
            >
              <View style={styles.tabsRow}>
                {TABS.map((tab) => (
                  <TabButton
                    key={tab.key}
                    label={tab.label}
                    active={tab.key === activeTab}
                    onPress={() => setActiveTab(tab.key)}
                  />
                ))}
              </View>
            </ScrollView>

            {data || mode === "enterReport" ? (
              Content()
            ) : (
              <View style={styles.emptyBox}>
                <Ionicons
                  name="information-circle-outline"
                  size={48}
                  color="rgba(255,255,255,0.2)"
                />
                <Text style={styles.emptyBoxText}>
                  {mode === "viewDetails"
                    ? t("cowInfo.noReportFound") +
                      " " +
                      formatPrettyDate(selectedDate) +
                      "."
                    : t("cowInfo.startEnteringData")}
                </Text>
              </View>
            )}

            {mode === "enterReport" && (
              <TouchableOpacity
                style={[styles.saveBtn, isLoading && styles.saveBtnDisabled]}
                onPress={handleSave}
                disabled={isLoading}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={["#22c55e", "#16a34a"]}
                  style={StyleSheet.absoluteFillObject}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                />
                {isLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Text style={styles.saveBtnText}>
                      {t("cowInfo.saveTodayReport")}
                    </Text>
                    <Ionicons
                      name="checkmark-circle"
                      size={18}
                      color="#fff"
                      style={{ marginLeft: 8 }}
                    />
                  </>
                )}
              </TouchableOpacity>
            )}
          </Animated.View>
        </ScrollView>

        {/* Date Picker Modal */}
        <Modal
          visible={datePickerVisible}
          transparent
          animationType="slide"
          onRequestClose={() => setDatePickerVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalSheet}>
              <View style={styles.modalHandle} />
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{t("cowInfo.selectDate")}</Text>
                <TouchableOpacity
                  onPress={() => setDatePickerVisible(false)}
                  style={styles.modalClose}
                >
                  <Ionicons name="close" size={20} color="#6b7280" />
                </TouchableOpacity>
              </View>
              {renderCalendar()}
              <View style={styles.modalBtns}>
                <TouchableOpacity
                  style={styles.modalCancelBtn}
                  onPress={() => setDatePickerVisible(false)}
                >
                  <Text style={styles.modalCancelText}>
                    {t("common.cancel")}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.modalConfirmBtn}
                  onPress={handleDateSelect}
                >
                  <Text style={styles.modalConfirmText}>
                    {t("common.select")}
                  </Text>
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
  safe: {
    flex: 1,
    paddingTop: Platform.OS === "android" ? StatusBar.currentHeight || 0 : 0,
  },

  langWrap: {
    position: "absolute",
    top: Platform.OS === "ios" ? 52 : (StatusBar.currentHeight || 0) + 12,
    right: 16,
    zIndex: 1000,
  },

  scrollContent: {
    paddingHorizontal: 20,
    paddingTop:
      Platform.OS === "ios" ? 64 : (StatusBar.currentHeight || 0) + 20,
    paddingBottom: 48,
  },
  scrollCentered: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingTop:
      Platform.OS === "ios" ? 64 : (StatusBar.currentHeight || 0) + 20,
    paddingBottom: 48,
  },

  // Header
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 24,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.1)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  pageTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: 0.2,
  },
  pageSubtitle: {
    fontSize: 13,
    color: "rgba(255,255,255,0.5)",
    marginTop: 2,
    fontWeight: "500",
  },

  // Initial screen
  initialWrap: { alignItems: "center", gap: 16, marginTop: 40 },
  qrIconBadge: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: "rgba(34,197,94,0.12)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
    borderWidth: 2,
    borderColor: "rgba(34,197,94,0.2)",
  },
  initialTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#fff",
    textAlign: "center",
  },
  initialSub: {
    fontSize: 14,
    color: "rgba(255,255,255,0.5)",
    textAlign: "center",
    paddingHorizontal: 30,
    marginBottom: 10,
  },

  scanBtn: {
    width: "100%",
    borderRadius: 14,
    paddingVertical: 16,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    overflow: "hidden",
    shadowColor: "#22c55e",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  scanBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },

  divider: { width: "100%", alignItems: "center", marginVertical: 10 },
  orText: {
    fontSize: 12,
    color: "rgba(255,255,255,0.4)",
    fontWeight: "600",
    textTransform: "uppercase",
  },

  searchWrap: { width: "100%", gap: 10 },
  searchBox: {
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  searchBoxInput: { fontSize: 15, color: "#fff", fontWeight: "500" },
  searchBoxBtn: {
    backgroundColor: "#3b82f6",
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    shadowColor: "#3b82f6",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 6,
  },
  searchBoxBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },

  listViewBtn: {
    width: "100%",
    backgroundColor: "#3b82f6",
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    shadowColor: "#3b82f6",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 6,
  },
  listViewBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },

  // List view
  searchBarWrap: { paddingHorizontal: 20, paddingVertical: 12 },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  searchInput: { flex: 1, fontSize: 15, color: "#fff", fontWeight: "500" },

  listContent: { padding: 20, gap: 12 },
  cowTile: { borderRadius: 16, overflow: "hidden" },
  cowTileInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  cowIconBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(34,197,94,0.12)",
    justifyContent: "center",
    alignItems: "center",
  },
  cowTileName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 3,
  },
  cowTileId: { fontSize: 12, color: "rgba(255,255,255,0.5)", marginBottom: 2 },
  cowTileBreed: { fontSize: 12, color: "rgba(255,255,255,0.5)" },

  centerWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
    gap: 14,
  },
  loadingText: {
    fontSize: 14,
    color: "rgba(255,255,255,0.5)",
    fontWeight: "500",
  },
  emptyText: {
    fontSize: 14,
    color: "rgba(255,255,255,0.4)",
    textAlign: "center",
    paddingHorizontal: 40,
  },
  addBtn: {
    marginTop: 10,
    backgroundColor: "#22c55e",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  addBtnText: { color: "#fff", fontSize: 14, fontWeight: "600" },

  // Cow selected
  cowInfoBox: {
    borderRadius: 18,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  cowInfoName: {
    fontSize: 20,
    fontWeight: "800",
    color: "#fff",
    marginBottom: 8,
  },
  cowInfoId: { fontSize: 13, color: "rgba(255,255,255,0.6)", marginBottom: 4 },
  cowInfoBreed: { fontSize: 13, color: "rgba(255,255,255,0.6)" },

  actionBtnRow: { gap: 14 },
  actionCard: { borderRadius: 16, overflow: "hidden" },
  actionCardGradient: {
    padding: 24,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  actionCardTitle: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "700",
    marginTop: 12,
    marginBottom: 4,
  },
  actionCardSub: { color: "rgba(255,255,255,0.8)", fontSize: 13 },

  // Date nav
  dateNav: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
  },
  dateNavBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.08)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  dateBadge: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  dateBadgeText: {
    fontSize: 12,
    color: "rgba(255,255,255,0.7)",
    fontWeight: "600",
    flex: 1,
    textAlign: "center",
  },
  todayBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#22c55e",
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  todayBtnText: { fontSize: 11, color: "#fff", fontWeight: "700" },

  todayBadgeBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(34,197,94,0.12)",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 16,
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: "rgba(34,197,94,0.25)",
  },
  todayBadgeBoxText: { fontSize: 13, color: "#22c55e", fontWeight: "600" },

  // Tabs
  tabsScroll: { marginBottom: 16 },
  tabsRow: {
    flexDirection: "row",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 12,
    padding: 4,
  },
  tabBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    minWidth: 80,
    alignItems: "center",
  },
  tabBtnActive: { backgroundColor: "#22c55e" },
  tabText: { fontSize: 12, color: "rgba(255,255,255,0.6)", fontWeight: "600" },
  tabTextActive: { color: "#fff", fontWeight: "700" },

  // Form card
  card: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    gap: 14,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "rgba(255,255,255,0.5)",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  fieldBox: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  fieldText: {
    fontSize: 14,
    color: "rgba(255,255,255,0.7)",
    fontWeight: "500",
  },
  inputField: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: "#fff",
    fontWeight: "500",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  textarea: { minHeight: 80, textAlignVertical: "top" },

  emptyBox: { alignItems: "center", paddingVertical: 40, gap: 12 },
  emptyBoxText: {
    fontSize: 14,
    color: "rgba(255,255,255,0.4)",
    textAlign: "center",
    paddingHorizontal: 30,
  },

  saveBtn: {
    marginTop: 24,
    borderRadius: 14,
    paddingVertical: 16,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
    shadowColor: "#22c55e",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },

  // Scanner modal
  scanModalWrap: { flex: 1, backgroundColor: "#000" },
  scanModalSafe: { flex: 1 },
  scanModalTitle: {
    color: "#fff",
    textAlign: "center",
    padding: 16,
    fontWeight: "700",
    fontSize: 16,
  },
  scanPermText: {
    color: "rgba(255,255,255,0.7)",
    textAlign: "center",
    paddingHorizontal: 40,
    marginBottom: 16,
  },
  permBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#22c55e",
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  permBtnText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  scannerBox: { flex: 1 },
  scanCloseBtn: {
    padding: 16,
    backgroundColor: "#0f1923",
    alignItems: "center",
  },
  scanCloseBtnText: { color: "#fff", fontWeight: "600", fontSize: 15 },

  // Date picker modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: "#1a2535",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: 36,
    borderTopWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignSelf: "center",
    marginBottom: 20,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  modalTitle: { fontSize: 18, fontWeight: "700", color: "#fff" },
  modalClose: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.08)",
    justifyContent: "center",
    alignItems: "center",
  },

  // Calendar
  calWrap: { marginBottom: 20 },
  calHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  calNavBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.06)",
    justifyContent: "center",
    alignItems: "center",
  },
  calMonth: { fontSize: 16, fontWeight: "700", color: "#fff" },
  calWeekRow: { flexDirection: "row", marginBottom: 8 },
  calWeekCell: { flex: 1, alignItems: "center", paddingVertical: 6 },
  calWeekText: {
    fontSize: 11,
    fontWeight: "600",
    color: "rgba(255,255,255,0.5)",
  },
  calGrid: { flexDirection: "row", flexWrap: "wrap" },
  calCell: {
    width: "14.28%",
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 4,
  },
  calCellSel: { backgroundColor: "#22c55e", borderRadius: 12 },
  calCellToday: { backgroundColor: "rgba(34,197,94,0.12)", borderRadius: 12 },
  calDayText: {
    fontSize: 13,
    color: "rgba(255,255,255,0.7)",
    fontWeight: "500",
  },
  calDayTextSel: { color: "#fff", fontWeight: "700" },
  calDayTextToday: { color: "#22c55e", fontWeight: "700" },

  modalBtns: { flexDirection: "row", gap: 10, marginTop: 20 },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.07)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  modalCancelText: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 15,
    fontWeight: "600",
  },
  modalConfirmBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: "center",
    backgroundColor: "#22c55e",
  },
  modalConfirmText: { color: "#fff", fontSize: 15, fontWeight: "700" },
});
