import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Picker } from "@react-native-picker/picker";
import { LinearGradient } from "expo-linear-gradient";
import * as Linking from "expo-linking";
import { router } from "expo-router";
import * as Sharing from "expo-sharing";
import { child, get, ref, set } from "firebase/database";
import React, { useEffect, useRef, useState } from "react";
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
  useWindowDimensions,
  View,
} from "react-native";
import QRCode from "react-native-qrcode-svg";
import { captureRef } from "react-native-view-shot";
import LanguageSelector from "../components/LanguageSelector";
import { useLanguage } from "../contexts/LanguageContext";
import { database } from "../firebaseConfig";
import { getCowRegistrationAI } from "../services/aiService";

function generateUniqueId() {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 7).toUpperCase();
  return `COW-${timestamp}-${random}`;
}

const BREEDS = [
  "Holstein Friesian",
  "Jersey",
  "Guernsey",
  "Ayrshire",
  "Brown Swiss",
  "Sahiwal",
  "Gir",
  "Red Sindhi",
  "Rathi",
  "Tharparkar",
  "Kankrej",
  "Ongole",
  "Hariana",
  "Deoni",
];

// ─── Reusable field label ────────────────────────────────────────────────────
function FieldLabel({ text }) {
  return <Text style={styles.label}>{text}</Text>;
}

export default function CowRegistrationScreen() {
  const { t } = useLanguage();
  const { width } = useWindowDimensions();
  const [name, setName] = useState("");
  const [dob, setDob] = useState("");
  const [breed, setBreed] = useState("");
  const [uniqueId, setUniqueId] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [userPhone, setUserPhone] = useState("");
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isQrGenerated, setIsQrGenerated] = useState(false);
  const [showAISuggestions, setShowAISuggestions] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState("");
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [showBreedPicker, setShowBreedPicker] = useState(false);
  const qrRef = useRef(null);
  const qrContainerRef = useRef(null);

  // Entrance animations
  const headerAnim = useRef(new Animated.Value(0)).current;
  const cardAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.stagger(120, [
      Animated.spring(headerAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 60,
        friction: 9,
      }),
      Animated.spring(cardAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 60,
        friction: 9,
      }),
    ]).start();

    AsyncStorage.getItem("userPhone")
      .then((phone) => {
        if (phone) setUserPhone(phone);
        else
          Alert.alert(t("common.error"), t("cowRegistration.userNotLoggedIn"), [
            { text: t("common.ok"), onPress: () => router.replace("/login") },
          ]);
      })
      .catch(() => {
        Alert.alert(
          t("common.error"),
          t("cowRegistration.failedToGetUserInfo"),
          [{ text: t("common.ok"), onPress: () => router.replace("/login") }],
        );
      });
  }, []);

  const formatDate = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };

  const handleDateSelect = () => {
    setDob(formatDate(selectedDate));
    setShowDatePicker(false);
  };

  const handleGenerate = () => {
    const id = generateUniqueId();
    setUniqueId(id);
    setIsQrGenerated(true);
  };

  const validateForm = () => {
    if (!name.trim()) {
      Alert.alert(t("common.error"), t("cowRegistration.enterCowName"));
      return false;
    }
    if (!dob.trim()) {
      Alert.alert(t("common.error"), t("cowRegistration.selectDob"));
      return false;
    }
    if (!breed.trim()) {
      Alert.alert(t("common.error"), t("cowRegistration.selectBreedError"));
      return false;
    }
    if (!isQrGenerated || !uniqueId) {
      Alert.alert(t("common.error"), t("cowRegistration.generateQrFirst"));
      return false;
    }
    if (!userPhone) {
      Alert.alert(t("common.error"), t("cowRegistration.userNotLoggedIn"));
      return false;
    }
    return true;
  };

  const handleSubmit = () => {
    if (!validateForm()) return;
    setIsLoading(true);
    const dbRef = ref(database);
    get(child(dbRef, `CowFarm/cows/${uniqueId}`))
      .then((snapshot) => {
        if (snapshot.exists()) {
          setIsLoading(false);
          Alert.alert(t("common.error"), t("cowRegistration.cowExists"));
          setUniqueId(generateUniqueId());
        } else {
          set(ref(database, `CowFarm/cows/${uniqueId}`), {
            name: name.trim(),
            dob: dob.trim(),
            breed,
            uniqueId,
            userPhoneNumber: userPhone,
            createdAt: new Date().toISOString(),
          })
            .then(() => {
              setIsLoading(false);
              Alert.alert(
                t("common.success"),
                t("cowRegistration.cowRegistered"),
                [
                  {
                    text: t("common.ok"),
                    onPress: () => {
                      setName("");
                      setDob("");
                      setBreed("");
                      setUniqueId("");
                      router.back();
                    },
                  },
                ],
              );
            })
            .catch((e) => {
              setIsLoading(false);
              Alert.alert(
                t("common.error"),
                t("cowRegistration.registrationFailed") + ": " + e.message,
              );
            });
        }
      })
      .catch((e) => {
        setIsLoading(false);
        Alert.alert(
          t("common.error"),
          t("cowRegistration.databaseError") + ": " + e.message,
        );
      });
  };

  const handleGetAISuggestions = async () => {
    if (!name || !breed || !dob) {
      Alert.alert(t("common.info"), t("cowRegistration.fillFieldsForAI"));
      return;
    }
    setIsLoadingAI(true);
    try {
      const response = await getCowRegistrationAI({ name, breed, dob });
      if (response.success) {
        setAiSuggestions(response.suggestions);
        setShowAISuggestions(true);
      } else
        Alert.alert(
          t("common.error"),
          t("cowRegistration.failedToGetAISuggestions"),
        );
    } catch {
      Alert.alert(
        t("common.error"),
        t("cowRegistration.failedToGetAISuggestions"),
      );
    } finally {
      setIsLoadingAI(false);
    }
  };

  const handleDownloadQr = async () => {
    if (!uniqueId || !qrContainerRef.current) {
      Alert.alert(
        t("cowRegistration.qrCode"),
        t("cowRegistration.generateIdFirst"),
      );
      return;
    }
    try {
      const uri = await captureRef(qrContainerRef, {
        format: "png",
        quality: 1.0,
        result: "tmpfile",
      });
      const whatsappUrl = `whatsapp://send?text=Cow Registration QR Code - ${uniqueId}`;
      const canOpen = await Linking.canOpenURL(whatsappUrl);
      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(uri, {
          mimeType: "image/png",
          dialogTitle: "Share QR Code",
        });
      } else if (canOpen) {
        await Linking.openURL(whatsappUrl);
      } else {
        Alert.alert("Error", "Sharing is not available on this device.");
      }
    } catch (e) {
      Alert.alert("Error", "Failed to share QR code: " + e.message);
    }
  };

  const headerAnimStyle = {
    opacity: headerAnim,
    transform: [
      {
        translateY: headerAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [-16, 0],
        }),
      },
    ],
  };
  const cardAnimStyle = {
    opacity: cardAnim,
    transform: [
      {
        translateY: cardAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [24, 0],
        }),
      },
    ],
  };

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
        {/* Language selector */}
        <View style={styles.langWrap}>
          <LanguageSelector />
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── HEADER ── */}
          <Animated.View style={[styles.headerRow, headerAnimStyle]}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.backBtn}
              activeOpacity={0.75}
            >
              <Ionicons name="arrow-back" size={20} color="#fff" />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={styles.pageTitle}>{t("cowRegistration.title")}</Text>
              <Text style={styles.pageSubtitle}>
                {t("cowRegistration.subtitle")}
              </Text>
            </View>
          </Animated.View>

          {/* ── FORM CARD ── */}
          <Animated.View style={cardAnimStyle}>
            <LinearGradient
              colors={["rgba(255,255,255,0.10)", "rgba(255,255,255,0.05)"]}
              style={styles.card}
            >
              {/* Name */}
              <FieldLabel text={t("cowRegistration.cowName")} />
              <View style={styles.inputWrap}>
                <Ionicons
                  name="paw"
                  size={16}
                  color="#22c55e"
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.input}
                  value={name}
                  onChangeText={setName}
                  placeholder="e.g., Rosie"
                  placeholderTextColor="rgba(255,255,255,0.3)"
                />
              </View>

              {/* Date of Birth */}
              <FieldLabel text={t("cowRegistration.dateOfBirth")} />
              <TouchableOpacity
                onPress={() => setShowDatePicker(true)}
                style={styles.inputWrap}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="calendar"
                  size={16}
                  color="#22c55e"
                  style={styles.inputIcon}
                />
                <Text style={[styles.input, !dob && styles.placeholder]}>
                  {dob || t("cowRegistration.selectDateOfBirth")}
                </Text>
                <Ionicons
                  name="chevron-down"
                  size={16}
                  color="rgba(255,255,255,0.4)"
                />
              </TouchableOpacity>

              {/* Breed */}
              <FieldLabel text={t("cowRegistration.breed")} />
              <TouchableOpacity
                style={styles.inputWrap}
                onPress={() => setShowBreedPicker(true)}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="leaf"
                  size={16}
                  color="#22c55e"
                  style={styles.inputIcon}
                />
                <Text
                  style={[styles.input, !breed && styles.placeholder]}
                  numberOfLines={1}
                >
                  {breed || t("cowRegistration.selectBreed")}
                </Text>
                <Ionicons
                  name="chevron-down"
                  size={16}
                  color="rgba(255,255,255,0.4)"
                />
              </TouchableOpacity>

              {/* AI Suggestions */}
              {name && breed && dob && (
                <TouchableOpacity
                  style={[styles.aiBtn, isLoadingAI && styles.btnDisabled]}
                  onPress={handleGetAISuggestions}
                  disabled={isLoadingAI}
                  activeOpacity={0.82}
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
                      <Ionicons name="sparkles" size={16} color="#fff" />
                      <Text style={styles.btnText}>
                        {t("cowRegistration.getAISuggestions")}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              )}

              {/* Divider */}
              <View style={styles.divider} />

              {/* QR Preview */}
              {!!uniqueId && (
                <View
                  ref={qrContainerRef}
                  style={styles.qrSection}
                  collapsable={false}
                >
                  <Text style={styles.qrName}>{name}</Text>
                  <View style={styles.qrFrame}>
                    <QRCode
                      value={uniqueId}
                      size={Math.min(width - 160, 180)}
                      backgroundColor="#FFFFFF"
                      color="#0f1923"
                      getRef={(c) => (qrRef.current = c)}
                    />
                  </View>
                  <Text style={styles.qrHint}>
                    {t("cowRegistration.scanToView")}
                  </Text>
                </View>
              )}

              {/* ID Badge */}
              {uniqueId ? (
                <View style={styles.idBadge}>
                  <View style={styles.idBadgeLeft}>
                    <Ionicons name="qr-code" size={16} color="#22c55e" />
                    <Text style={styles.idLabel}>
                      {t("cowRegistration.uniqueId")}
                    </Text>
                  </View>
                  <Text
                    style={styles.idValue}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                  >
                    {uniqueId}
                  </Text>
                </View>
              ) : null}

              {/* Action buttons */}
              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: "#22c55e" }]}
                  onPress={handleGenerate}
                  activeOpacity={0.82}
                >
                  <Ionicons name="key" size={16} color="#fff" />
                  <Text
                    style={styles.actionBtnText}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.7}
                  >
                    {t("cowRegistration.generateId")}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: "#25D366" }]}
                  onPress={handleDownloadQr}
                  activeOpacity={0.82}
                >
                  <Ionicons name="logo-whatsapp" size={16} color="#fff" />
                  <Text
                    style={styles.actionBtnText}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.7}
                  >
                    {t("cowRegistration.shareViaWhatsApp")}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Submit */}
              <TouchableOpacity
                style={[
                  styles.submitBtn,
                  (isLoading || !isQrGenerated) && styles.btnDisabled,
                ]}
                onPress={handleSubmit}
                disabled={isLoading || !isQrGenerated}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={
                    isQrGenerated
                      ? ["#22c55e", "#16a34a"]
                      : ["#374151", "#374151"]
                  }
                  style={StyleSheet.absoluteFillObject}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                />
                {isLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Text style={styles.submitText}>{t("common.save")}</Text>
                    <Ionicons
                      name="checkmark-circle"
                      size={20}
                      color="#fff"
                      style={{ marginLeft: 8 }}
                    />
                  </>
                )}
              </TouchableOpacity>
            </LinearGradient>
          </Animated.View>
        </ScrollView>

        {/* ── DATE PICKER MODAL ── */}
        <Modal
          visible={showDatePicker}
          transparent
          animationType="slide"
          onRequestClose={() => setShowDatePicker(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalSheet}>
              <View style={styles.modalHandle} />
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {t("cowRegistration.selectDateOfBirth")}
                </Text>
                <TouchableOpacity
                  onPress={() => setShowDatePicker(false)}
                  style={styles.modalClose}
                >
                  <Ionicons name="close" size={20} color="#6b7280" />
                </TouchableOpacity>
              </View>

              {Platform.OS === "ios" ? (
                <View>
                  <View style={styles.iosDateRow}>
                    <TouchableOpacity
                      style={styles.dateArrow}
                      onPress={() => {
                        const d = new Date(selectedDate);
                        d.setDate(d.getDate() - 1);
                        setSelectedDate(d);
                      }}
                    >
                      <Ionicons name="chevron-back" size={22} color="#22c55e" />
                    </TouchableOpacity>
                    <Text style={styles.dateDisplay}>
                      {formatDate(selectedDate)}
                    </Text>
                    <TouchableOpacity
                      style={styles.dateArrow}
                      onPress={() => {
                        const d = new Date(selectedDate);
                        d.setDate(d.getDate() + 1);
                        setSelectedDate(d);
                      }}
                    >
                      <Ionicons
                        name="chevron-forward"
                        size={22}
                        color="#22c55e"
                      />
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <View>
                  {[
                    {
                      label: "Year",
                      value: String(selectedDate.getFullYear()),
                      onChange: (v) => {
                        const d = new Date(selectedDate);
                        d.setFullYear(parseInt(v) || d.getFullYear());
                        setSelectedDate(d);
                      },
                    },
                    {
                      label: "Day",
                      value: String(selectedDate.getDate()),
                      onChange: (v) => {
                        const d = new Date(selectedDate);
                        d.setDate(parseInt(v) || d.getDate());
                        setSelectedDate(d);
                      },
                    },
                  ].map(({ label, value, onChange }) => (
                    <View key={label} style={styles.androidRow}>
                      <Text style={styles.androidLabel}>{label}</Text>
                      <TextInput
                        style={styles.androidInput}
                        value={value}
                        onChangeText={onChange}
                        keyboardType="numeric"
                      />
                    </View>
                  ))}
                  <View style={styles.androidRow}>
                    <Text style={styles.androidLabel}>Month</Text>
                    <Picker
                      selectedValue={selectedDate.getMonth() + 1}
                      onValueChange={(m) => {
                        const d = new Date(selectedDate);
                        d.setMonth(m - 1);
                        setSelectedDate(d);
                      }}
                      style={styles.monthPicker}
                    >
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                        <Picker.Item key={m} label={String(m)} value={m} />
                      ))}
                    </Picker>
                  </View>
                </View>
              )}

              <View style={styles.modalBtns}>
                <TouchableOpacity
                  style={styles.modalCancelBtn}
                  onPress={() => setShowDatePicker(false)}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.modalConfirmBtn}
                  onPress={handleDateSelect}
                >
                  <Text style={styles.modalConfirmText}>Confirm</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* ── AI SUGGESTIONS MODAL ── */}
        <Modal
          visible={showAISuggestions}
          transparent
          animationType="slide"
          onRequestClose={() => setShowAISuggestions(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalSheet, { maxHeight: "75%" }]}>
              <View style={styles.modalHandle} />
              <View style={styles.modalHeader}>
                <View
                  style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
                >
                  <View style={styles.aiSparkBadge}>
                    <Ionicons name="sparkles" size={14} color="#fff" />
                  </View>
                  <Text style={styles.modalTitle}>
                    {t("cowRegistration.aiSuggestions")}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => setShowAISuggestions(false)}
                  style={styles.modalClose}
                >
                  <Ionicons name="close" size={20} color="#6b7280" />
                </TouchableOpacity>
              </View>
              <ScrollView
                style={{ marginBottom: 12 }}
                showsVerticalScrollIndicator={false}
              >
                <Text style={styles.aiText}>{aiSuggestions}</Text>
              </ScrollView>
              <TouchableOpacity
                style={styles.modalConfirmBtn}
                onPress={() => setShowAISuggestions(false)}
              >
                <Text style={styles.modalConfirmText}>{t("common.gotIt")}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* ── BREED PICKER MODAL ── */}
        <Modal
          visible={showBreedPicker}
          transparent
          animationType="slide"
          onRequestClose={() => setShowBreedPicker(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalSheet, { maxHeight: "65%" }]}>
              <View style={styles.modalHandle} />
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {t("cowRegistration.selectBreed")}
                </Text>
                <TouchableOpacity
                  onPress={() => setShowBreedPicker(false)}
                  style={styles.modalClose}
                >
                  <Ionicons name="close" size={20} color="#6b7280" />
                </TouchableOpacity>
              </View>
              <FlatList
                data={BREEDS}
                keyExtractor={(item) => item}
                showsVerticalScrollIndicator={false}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[
                      styles.breedItem,
                      breed === item && styles.breedItemActive,
                    ]}
                    onPress={() => {
                      setBreed(item);
                      setShowBreedPicker(false);
                    }}
                    activeOpacity={0.75}
                  >
                    <Text
                      style={[
                        styles.breedItemText,
                        breed === item && styles.breedItemTextActive,
                      ]}
                    >
                      {item}
                    </Text>
                    {breed === item && (
                      <Ionicons
                        name="checkmark-circle"
                        size={18}
                        color="#22c55e"
                      />
                    )}
                  </TouchableOpacity>
                )}
                ItemSeparatorComponent={() => <View style={styles.breedSep} />}
              />
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </LinearGradient>
  );
}

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

  // ── Header ──
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

  // ── Card ──
  card: {
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },

  // ── Form fields ──
  label: {
    fontSize: 12,
    fontWeight: "700",
    color: "rgba(255,255,255,0.5)",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginTop: 18,
    marginBottom: 8,
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    paddingHorizontal: 14,
    paddingVertical: 13,
    gap: 10,
  },
  inputIcon: { width: 18 },
  input: {
    flex: 1,
    fontSize: 15,
    color: "#fff",
    fontWeight: "500",
  },
  placeholder: { color: "rgba(255,255,255,0.3)" },

  // ── AI button ──
  aiBtn: {
    marginTop: 20,
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
  btnText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  btnDisabled: { opacity: 0.5 },

  // ── Divider ──
  divider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.08)",
    marginVertical: 20,
  },

  // ── QR ──
  qrSection: {
    alignItems: "center",
    marginBottom: 16,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  qrName: { fontSize: 17, fontWeight: "700", color: "#fff", marginBottom: 16 },
  qrFrame: {
    padding: 16,
    backgroundColor: "#fff",
    borderRadius: 16,
    shadowColor: "#22c55e",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 8,
  },
  qrHint: {
    fontSize: 12,
    color: "rgba(255,255,255,0.45)",
    marginTop: 14,
    fontStyle: "italic",
  },

  // ── ID badge ──
  idBadge: {
    backgroundColor: "rgba(34,197,94,0.12)",
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(34,197,94,0.25)",
  },
  idBadgeLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
  },
  idLabel: {
    fontSize: 11,
    color: "rgba(34,197,94,0.8)",
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  idValue: {
    fontSize: 14,
    color: "#fff",
    fontWeight: "700",
    letterSpacing: 0.5,
  },

  // ── Action row ──
  actionRow: { flexDirection: "row", gap: 10, marginBottom: 16 },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 13,
    paddingHorizontal: 10,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  actionBtnText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
    flexShrink: 1,
  },

  // ── Submit ──
  submitBtn: {
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
  submitText: { color: "#fff", fontSize: 16, fontWeight: "700" },

  // ── Modals ──
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
  aiSparkBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: "#7c3aed",
    justifyContent: "center",
    alignItems: "center",
  },
  aiText: { fontSize: 15, color: "rgba(255,255,255,0.85)", lineHeight: 24 },

  // iOS date
  iosDateRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    marginVertical: 20,
  },
  dateArrow: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "rgba(34,197,94,0.12)",
    justifyContent: "center",
    alignItems: "center",
  },
  dateDisplay: {
    fontSize: 22,
    fontWeight: "700",
    color: "#22c55e",
    minWidth: 120,
    textAlign: "center",
  },

  // Android date
  androidRow: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  androidLabel: {
    width: 60,
    fontSize: 14,
    color: "rgba(255,255,255,0.6)",
    fontWeight: "600",
  },
  androidInput: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 10,
    padding: 10,
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  monthPicker: { flex: 1, color: "#fff", height: 48 },

  // Modal buttons
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

  // ── Breed picker list ──
  breedItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 4,
  },
  breedItemActive: {
    backgroundColor: "rgba(34,197,94,0.08)",
    borderRadius: 10,
    paddingHorizontal: 10,
  },
  breedItemText: {
    fontSize: 15,
    color: "rgba(255,255,255,0.7)",
    fontWeight: "500",
  },
  breedItemTextActive: { color: "#22c55e", fontWeight: "700" },
  breedSep: { height: 1, backgroundColor: "rgba(255,255,255,0.06)" },
});
