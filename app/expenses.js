import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { child, get, ref, set } from "firebase/database";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
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
import { getExpensesAI } from "../services/aiService";

export default function ExpensesScreen() {
  const { t } = useLanguage();
  const [mode, setMode] = useState("initial");
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [tempSelectedDate, setTempSelectedDate] = useState(new Date());
  const [records, setRecords] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [userPhone, setUserPhone] = useState("");
  const [showAIAnalysis, setShowAIAnalysis] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState("");
  const [isLoadingAI, setIsLoadingAI] = useState(false);

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

  const loadExpenses = async (date) => {
    if (!userPhone) return;
    setIsLoading(true);
    try {
      const expenseSnapshot = await get(
        child(ref(database), `CowFarm/expenses/${userPhone}/${date}`),
      );
      setRecords((prev) => ({
        ...prev,
        [date]: expenseSnapshot.exists()
          ? expenseSnapshot.val()
          : {
              feed: "",
              doctor: "",
              other: "",
              notes: "",
            },
      }));
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEnterExpense = () => {
    setSelectedDate(new Date());
    setMode("enterExpense");
    loadExpenses(todayKey);
  };
  const handleViewDetails = () => {
    setMode("viewDetails");
    loadExpenses(dateKey);
  };
  const updateRecord = (field, value) =>
    setRecords((prev) => ({
      ...prev,
      [dateKey]: {
        ...(prev[dateKey] || { feed: "", doctor: "", other: "", notes: "" }),
        [field]: value,
      },
    }));

  const handleSave = async () => {
    if (!userPhone) {
      Alert.alert(t("common.error"), t("expenses.userNotLoggedIn"));
      return;
    }
    setIsLoading(true);
    try {
      const expenseData = {
        ...records[dateKey],
        date: dateKey,
        updatedAt: new Date().toISOString(),
        userPhoneNumber: userPhone,
      };
      await set(
        child(ref(database), `CowFarm/expenses/${userPhone}/${dateKey}`),
        expenseData,
      );
      Alert.alert(
        t("common.success"),
        t("expenses.expensesSaved") + " " + formatPrettyDate(selectedDate),
        [{ text: t("common.ok"), onPress: () => setMode("initial") }],
      );
    } catch (e) {
      Alert.alert(
        t("common.error"),
        "Failed To Save Expenses" + ": " + e.message,
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleGetAIAnalysis = async () => {
    if (!data) {
      Alert.alert(t("common.error"), t("expenses.noData"));
      return;
    }

    setIsLoadingAI(true);
    setShowAIAnalysis(true); // Open modal immediately
    setAiAnalysis(
      "🤖 Analyzing your expense data...\n\nPlease wait while I review your farm expenses and provide insights.",
    ); // Show loading message

    try {
      const expenseData = {
        date: dateKey,
        feed: data.feed || "0",
        doctor: data.doctor || "0",
        other: data.other || "0",
        notes: data.notes || "None",
        totalExpenses: getTotal(),
      };

      const result = await getExpensesAI(expenseData, "daily");
      console.log("AI Result:", result); // Debug log

      // Extract analysis from various possible response formats
      let analysisText = "";

      if (typeof result === "string") {
        // Direct string response
        analysisText = result;
      } else if (result.analysis) {
        // { analysis: "..." } format
        analysisText = result.analysis;
      } else if (result.suggestions) {
        // { suggestions: "..." } format
        analysisText = result.suggestions;
      } else if (result.content && Array.isArray(result.content)) {
        // Anthropic API response format: { content: [{ type: "text", text: "..." }] }
        analysisText = result.content
          .filter((item) => item.type === "text")
          .map((item) => item.text)
          .join("\n\n");
      } else if (
        result.content &&
        result.content[0] &&
        result.content[0].text
      ) {
        // Nested content format
        analysisText = result.content[0].text;
      } else if (result.text) {
        // { text: "..." } format
        analysisText = result.text;
      } else {
        // Fallback: stringify the entire result
        analysisText =
          "Unable to parse AI response. Raw data:\n\n" +
          JSON.stringify(result, null, 2);
      }

      // Final check
      if (!analysisText || analysisText.trim() === "") {
        analysisText =
          t("expenses.noAnalysisAvailable") ||
          "No analysis available at this time.";
      }

      setAiAnalysis(analysisText);
    } catch (e) {
      console.error("AI Analysis Error:", e);

      // Show detailed error in modal instead of alert
      const errorMessage = `❌ Failed to Generate Analysis\n\nError: ${e.message || "Unknown error"}\n\n${
        e.message?.includes("API") || e.message?.includes("fetch")
          ? "Please check:\n• Your internet connection\n• API key configuration\n• API service status"
          : "Please try again or contact support if the issue persists."
      }`;

      setAiAnalysis(errorMessage);
    } finally {
      setIsLoadingAI(false);
    }
  };

  const goPrevDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() - 1);
    setSelectedDate(d);
    loadExpenses(formatDate(d));
  };
  const goNextDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + 1);
    setSelectedDate(d);
    loadExpenses(formatDate(d));
  };
  const goToday = () => {
    const d = new Date();
    setSelectedDate(d);
    loadExpenses(todayKey);
  };
  const openDatePicker = () => {
    setTempSelectedDate(new Date(selectedDate));
    setDatePickerVisible(true);
  };
  const handleDateSelect = () => {
    setSelectedDate(new Date(tempSelectedDate));
    loadExpenses(formatDate(tempSelectedDate));
    setDatePickerVisible(false);
  };

  const getDaysInMonth = (date) =>
    new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const getFirstDayOfMonth = (date) =>
    new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  const getTotal = () => {
    const feed = parseFloat(data?.feed || 0) || 0;
    const doctor = parseFloat(data?.doctor || 0) || 0;
    const other = parseFloat(data?.other || 0) || 0;
    return (feed + doctor + other).toFixed(2);
  };

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

  const animStyle = {
    opacity: fadeAnim,
    transform: [{ translateY: slideAnim }],
  };

  // ═════════════════════════════════════════════════════════════════════════
  // MODE: INITIAL
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
                  <Text style={styles.pageTitle}>{t("expenses.title")}</Text>
                  <Text style={styles.pageSubtitle}>
                    {t("expenses.subtitle")}
                  </Text>
                </View>
              </View>

              <View style={styles.initialWrap}>
                <View style={styles.expenseIconBadge}>
                  <Ionicons name="cash" size={64} color="#f97316" />
                </View>
                <Text style={styles.initialTitle}>
                  {t("expenses.farmExpenses")}
                </Text>
                <Text style={styles.initialSub}>
                  {t("expenses.recordTrackExpenses")}
                </Text>

                <View style={styles.actionBtnRow}>
                  <TouchableOpacity
                    style={styles.actionCard}
                    onPress={handleEnterExpense}
                    activeOpacity={0.85}
                  >
                    <LinearGradient
                      colors={["#f97316", "#ea580c"]}
                      style={styles.actionCardGradient}
                    >
                      <Ionicons name="create-outline" size={32} color="#fff" />
                      <Text style={styles.actionCardTitle}>
                        {t("expenses.enterTodayExpenses")}
                      </Text>
                      <Text style={styles.actionCardSub}>
                        {t("expenses.addExpensesToday")}
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
                        {t("expenses.viewExpenses")}
                      </Text>
                      <Text style={styles.actionCardSub}>
                        {t("expenses.viewExpensesByDate")}
                      </Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </View>
            </Animated.View>
          </ScrollView>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  // ═════════════════════════════════════════════════════════════════════════
  // MODE: ENTER EXPENSE / VIEW DETAILS
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
                onPress={() => setMode("initial")}
                style={styles.backBtn}
              >
                <Ionicons name="arrow-back" size={20} color="#fff" />
              </TouchableOpacity>
              <View style={{ flex: 1 }}>
                <Text style={styles.pageTitle}>
                  {mode === "enterExpense"
                    ? t("expenses.enterTodayExpenses")
                    : t("expenses.viewExpenses")}
                </Text>
                <Text style={styles.pageSubtitle}>
                  {t("expenses.dailyExpenseTracking")}
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

            {mode === "enterExpense" && (
              <View style={styles.todayBadgeBox}>
                <Ionicons name="calendar" size={14} color="#f97316" />
                <Text style={styles.todayBadgeBoxText}>
                  {t("common.today")}: {formatPrettyDate(new Date())}
                </Text>
              </View>
            )}

            <View style={styles.card}>
              {/* Expense info badge */}
              <LinearGradient
                colors={["rgba(249,115,22,0.15)", "rgba(249,115,22,0.08)"]}
                style={styles.expenseInfoBadge}
              >
                <Ionicons name="wallet" size={18} color="#f97316" />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.expenseBadgeTitle}>
                    {t("expenses.dailyExpenseTracking")}
                  </Text>
                  <Text style={styles.expenseBadgeSub}>
                    {formatPrettyDate(selectedDate)}
                  </Text>
                </View>
              </LinearGradient>

              <Text style={styles.fieldLabel}>
                {t("expenses.foodIntakeFees")}
              </Text>
              <TextInput
                value={data?.feed || ""}
                onChangeText={(v) => updateRecord("feed", v)}
                style={styles.inputField}
                placeholder={t("expenses.enterAmount")}
                placeholderTextColor="rgba(255,255,255,0.3)"
                keyboardType="decimal-pad"
                editable={mode === "enterExpense"}
              />

              <Text style={styles.fieldLabel}>{t("expenses.doctorFees")}</Text>
              <TextInput
                value={data?.doctor || ""}
                onChangeText={(v) => updateRecord("doctor", v)}
                style={styles.inputField}
                placeholder={t("expenses.enterAmount")}
                placeholderTextColor="rgba(255,255,255,0.3)"
                keyboardType="decimal-pad"
                editable={mode === "enterExpense"}
              />

              <Text style={styles.fieldLabel}>
                {t("expenses.otherExpenses")}
              </Text>
              <TextInput
                value={data?.other || ""}
                onChangeText={(v) => updateRecord("other", v)}
                style={styles.inputField}
                placeholder={t("expenses.enterAmount")}
                placeholderTextColor="rgba(255,255,255,0.3)"
                keyboardType="decimal-pad"
                editable={mode === "enterExpense"}
              />

              <Text style={styles.fieldLabel}>{t("expenses.notes")}</Text>
              <TextInput
                value={data?.notes || ""}
                onChangeText={(v) => updateRecord("notes", v)}
                style={[styles.inputField, styles.textarea]}
                placeholder={t("expenses.additionalNotes")}
                placeholderTextColor="rgba(255,255,255,0.3)"
                multiline
                editable={mode === "enterExpense"}
              />

              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>
                  {t("expenses.totalExpenses")}
                </Text>
                <Text style={styles.totalValue}>₹{getTotal()}</Text>
              </View>
            </View>

            {/* AI Analysis */}
            {data && (
              <TouchableOpacity
                style={[styles.aiBtn, isLoadingAI && styles.btnDisabled]}
                onPress={handleGetAIAnalysis}
                disabled={isLoadingAI}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={["#7c3aed", "#6d28d9"]}
                  style={StyleSheet.absoluteFillObject}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                />
                {isLoadingAI ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="sparkles" size={18} color="#fff" />
                    <Text style={styles.aiBtnText}>
                      {t("expenses.getAIAnalysis")}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            )}

            {mode === "enterExpense" && (
              <TouchableOpacity
                style={[styles.saveBtn, isLoading && styles.btnDisabled]}
                onPress={handleSave}
                disabled={isLoading}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={["#f97316", "#ea580c"]}
                  style={StyleSheet.absoluteFillObject}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                />
                {isLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Text style={styles.saveBtnText}>
                      {t("expenses.saveTodayExpenses")}
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

            {mode === "viewDetails" && !data && (
              <View style={styles.emptyBox}>
                <Ionicons
                  name="cash-outline"
                  size={48}
                  color="rgba(255,255,255,0.2)"
                />
                <Text style={styles.emptyBoxText}>
                  {t("expenses.noExpensesFound")}{" "}
                  {formatPrettyDate(selectedDate)}.
                </Text>
              </View>
            )}
          </Animated.View>
        </ScrollView>

        {/* AI Analysis Modal */}

        <Modal
          visible={showAIAnalysis}
          transparent
          animationType="slide"
          onRequestClose={() => setShowAIAnalysis(false)}
        >
          <View style={styles.modalOverlay}>
            <TouchableOpacity
              style={styles.modalBackdrop}
              activeOpacity={1}
              onPress={() => setShowAIAnalysis(false)}
            />
            <View style={styles.modalSheet}>
              {/* Handle */}
              <View style={styles.modalHandle} />

              {/* Header */}
              <View style={styles.modalHeader}>
                <View style={styles.modalHeaderLeft}>
                  <LinearGradient
                    colors={["rgba(168,85,247,0.2)", "rgba(168,85,247,0.1)"]}
                    style={styles.aiSparkBadge}
                  >
                    <Ionicons name="sparkles" size={16} color="#a855f7" />
                  </LinearGradient>
                  <Text style={styles.modalTitle} numberOfLines={1}>
                    {t("expenses.aiExpenseAnalysis")}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => setShowAIAnalysis(false)}
                  style={styles.modalClose}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name="close"
                    size={22}
                    color="rgba(255,255,255,0.7)"
                  />
                </TouchableOpacity>
              </View>

              {/* Content - THIS IS THE KEY FIX */}
              {isLoadingAI ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color="#a855f7" />
                  <Text style={styles.loadingText}>
                    Analyzing your expenses...
                  </Text>
                </View>
              ) : (
                <ScrollView
                  style={styles.modalContent}
                  contentContainerStyle={styles.modalContentContainer}
                  showsVerticalScrollIndicator={true}
                  nestedScrollEnabled={true}
                >
                  <LinearGradient
                    colors={["rgba(168,85,247,0.1)", "rgba(168,85,247,0.05)"]}
                    style={styles.aiContentCard}
                  >
                    <Text style={styles.aiText}>
                      {aiAnalysis && aiAnalysis.trim() !== ""
                        ? aiAnalysis
                        : "No analysis available. Please try again."}
                    </Text>
                  </LinearGradient>
                </ScrollView>
              )}

              {/* Footer Button */}
              <View style={styles.modalFooter}>
                <TouchableOpacity
                  style={styles.modalConfirmBtn}
                  onPress={() => setShowAIAnalysis(false)}
                  activeOpacity={0.85}
                >
                  <LinearGradient
                    colors={["#a855f7", "#9333ea"]}
                    style={styles.modalConfirmGradient}
                  >
                    <Text style={styles.modalConfirmText}>
                      {t("common.close")}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

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
                <Text style={styles.modalTitle}>
                  {t("expenses.selectDate")}
                </Text>
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

  // Initial
  initialWrap: { alignItems: "center", gap: 16, marginTop: 40 },
  expenseIconBadge: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: "rgba(249,115,22,0.12)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
    borderWidth: 2,
    borderColor: "rgba(249,115,22,0.2)",
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

  actionBtnRow: { width: "100%", gap: 14 },
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
    backgroundColor: "#f97316",
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  todayBtnText: { fontSize: 11, color: "#fff", fontWeight: "700" },

  todayBadgeBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(249,115,22,0.12)",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 16,
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: "rgba(249,115,22,0.25)",
  },
  todayBadgeBoxText: { fontSize: 13, color: "#f97316", fontWeight: "600" },

  // Form card
  card: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    gap: 14,
  },
  expenseInfoBadge: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "rgba(249,115,22,0.2)",
  },
  expenseBadgeTitle: { fontSize: 13, fontWeight: "700", color: "#f97316" },
  expenseBadgeSub: {
    fontSize: 11,
    color: "rgba(249,115,22,0.7)",
    marginTop: 2,
  },

  fieldLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "rgba(255,255,255,0.5)",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginBottom: 6,
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

  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 12,
    paddingTop: 16,
    borderTopWidth: 2,
    borderTopColor: "rgba(255,255,255,0.1)",
  },
  totalLabel: {
    fontSize: 15,
    color: "rgba(255,255,255,0.8)",
    fontWeight: "700",
  },
  totalValue: { fontSize: 24, color: "#f97316", fontWeight: "800" },

  emptyBox: { alignItems: "center", paddingVertical: 40, gap: 12 },
  emptyBoxText: {
    fontSize: 14,
    color: "rgba(255,255,255,0.4)",
    textAlign: "center",
    paddingHorizontal: 30,
  },

  aiBtn: {
    marginTop: 16,
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    overflow: "hidden",
    shadowColor: "#7c3aed",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  aiBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },

  saveBtn: {
    marginTop: 24,
    borderRadius: 14,
    paddingVertical: 16,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
    shadowColor: "#f97316",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  btnDisabled: { opacity: 0.5 },
  saveBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },

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
  calCellSel: { backgroundColor: "#f97316", borderRadius: 12 },
  calCellToday: { backgroundColor: "rgba(249,115,22,0.12)", borderRadius: 12 },
  calDayText: {
    fontSize: 13,
    color: "rgba(255,255,255,0.7)",
    fontWeight: "500",
  },
  calDayTextSel: { color: "#fff", fontWeight: "700" },
  calDayTextToday: { color: "#f97316", fontWeight: "700" },

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

  // Modal Footer

  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.5)", // Add semi-transparent background
  },
  modalBackdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.4)",
  },

  // Modal Sheet - UPDATED
  modalSheet: {
    backgroundColor: "#1a2535",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 12,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === "ios" ? 34 : 24,
    height: "85%", // CHANGED FROM maxHeight to height
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
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

  // Modal Header
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  modalHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
    marginRight: 12,
  },
  aiSparkBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(168,85,247,0.25)",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
    letterSpacing: 0.2,
    flex: 1,
  },
  modalClose: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.08)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },

  // Loading Container - NEW
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 16,
    paddingVertical: 40,
  },
  loadingText: {
    fontSize: 15,
    color: "rgba(255,255,255,0.7)",
    fontWeight: "600",
    fontStyle: "italic",
  },

  // Modal Content - UPDATED
  modalContent: {
    flex: 1, // CRITICAL: Allows scrolling
    marginBottom: 20,
  },
  modalContentContainer: {
    flexGrow: 1, // CRITICAL: Ensures content fills and scrolls
    paddingBottom: 12,
  },
  aiContentCard: {
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: "rgba(168,85,247,0.2)",
    minHeight: 100, // NEW: Ensures card is visible
  },
  aiText: {
    fontSize: 15,
    lineHeight: 24,
    color: "rgba(255,255,255,0.9)",
    fontWeight: "500",
  },

  // Modal Footer
  modalFooter: {
    paddingTop: 12,
  },
  modalConfirmBtn: {
    borderRadius: 14,
    overflow: "hidden",
    shadowColor: "#a855f7",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  modalConfirmGradient: {
    paddingVertical: 16,
    alignItems: "center",
  },
  modalConfirmText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
    letterSpacing: 0.3,
  },
});
