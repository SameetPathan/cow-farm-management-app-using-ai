import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { child, get, ref, set } from "firebase/database";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  KeyboardAvoidingView,
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

export default function RegisterScreen() {
  const { t } = useLanguage();
  const [formData, setFormData] = useState({
    fullName: "",
    phoneNumber: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

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
  }, []);

  const handleInputChange = (field, value) =>
    setFormData((prev) => ({ ...prev, [field]: value }));

  const validateForm = () => {
    const { fullName, phoneNumber, email, password, confirmPassword } =
      formData;

    if (!fullName || !phoneNumber || !email || !password || !confirmPassword) {
      Alert.alert(t("common.error"), t("register.fillAllFields"));
      return false;
    }
    if (!/^\d{10}$/.test(phoneNumber)) {
      Alert.alert(t("common.error"), t("register.validPhone"));
      return false;
    }
    if (password !== confirmPassword) {
      Alert.alert(t("common.error"), t("register.passwordsMatch"));
      return false;
    }
    if (password.length < 6) {
      Alert.alert(t("common.error"), t("register.passwordLength"));
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      Alert.alert(t("common.error"), t("register.validEmail"));
      return false;
    }
    return true;
  };

  const handleRegister = () => {
    if (!validateForm()) return;
    setIsLoading(true);

    const dbRef = ref(database);
    get(child(dbRef, `CowFarm/users/${formData.phoneNumber}`))
      .then((snapshot) => {
        if (snapshot.exists()) {
          setIsLoading(false);
          Alert.alert(t("common.error"), t("register.userExists"));
        } else {
          set(ref(database, `CowFarm/users/${formData.phoneNumber}`), {
            fullName: formData.fullName,
            email: formData.email,
            phoneNumber: formData.phoneNumber,
            password: formData.password,
            createdAt: new Date().toISOString(),
          })
            .then(() => {
              setIsLoading(false);
              Alert.alert(
                t("common.success"),
                t("register.registrationSuccess"),
                [
                  {
                    text: t("common.ok"),
                    onPress: () => {
                      setFormData({
                        fullName: "",
                        phoneNumber: "",
                        email: "",
                        password: "",
                        confirmPassword: "",
                      });
                      router.replace("/home");
                    },
                  },
                ],
              );
            })
            .catch((error) => {
              setIsLoading(false);
              Alert.alert(
                t("common.error"),
                t("register.registrationFailed") + ": " + error.message,
              );
            });
        }
      })
      .catch((error) => {
        setIsLoading(false);
        Alert.alert(
          t("common.error"),
          t("register.registrationFailed") + ": " + error.message,
        );
      });
  };

  const InputField = ({
    icon,
    label,
    placeholder,
    field,
    keyboardType,
    autoCapitalize,
    isPassword,
    showPw,
    togglePw,
    maxLength,
  }) => (
    <View style={styles.inputWrapper}>
      <Text style={styles.label}>{label}</Text>
      <LinearGradient
        colors={["rgba(255,255,255,0.08)", "rgba(255,255,255,0.04)"]}
        style={styles.inputContainer}
      >
        <Ionicons
          name={icon}
          size={20}
          color="#22c55e"
          style={styles.inputIcon}
        />
        <TextInput
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor="rgba(255,255,255,0.3)"
          value={formData[field]}
          onChangeText={(val) => handleInputChange(field, val)}
          keyboardType={keyboardType || "default"}
          autoCapitalize={autoCapitalize || "sentences"}
          secureTextEntry={isPassword ? !showPw : false}
          maxLength={maxLength}
        />
        {isPassword && (
          <TouchableOpacity
            onPress={togglePw}
            style={styles.eyeBtn}
            activeOpacity={0.7}
          >
            <Ionicons
              name={showPw ? "eye-off" : "eye"}
              size={20}
              color="rgba(255,255,255,0.5)"
            />
          </TouchableOpacity>
        )}
      </LinearGradient>
    </View>
  );

  const animStyle = {
    opacity: fadeAnim,
    transform: [{ translateY: slideAnim }],
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
      <SafeAreaView style={styles.safeArea}>
        {/* Language Selector */}
        <View style={styles.langWrap}>
          <LanguageSelector />
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.keyboardView}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <Animated.View style={[styles.content, animStyle]}>
              {/* Header */}
              <View style={styles.header}>
                <View style={styles.iconBadge}>
                  <LinearGradient
                    colors={["rgba(34,197,94,0.2)", "rgba(34,197,94,0.1)"]}
                    style={styles.iconGradient}
                  >
                    <Ionicons name="person-add" size={56} color="#22c55e" />
                  </LinearGradient>
                </View>
                <Text style={styles.title}>{t("register.title")}</Text>
                <Text style={styles.subtitle}>{t("register.subtitle")}</Text>
              </View>

              {/* Form */}
              <View style={styles.form}>
                <InputField
                  icon="person"
                  label={t("register.fullName")}
                  placeholder="Enter your full name"
                  field="fullName"
                />
                <InputField
                  icon="call"
                  label={t("register.phoneNumber")}
                  placeholder="10-digit phone number"
                  field="phoneNumber"
                  keyboardType="phone-pad"
                  autoCapitalize="none"
                  maxLength={10}
                />
                <InputField
                  icon="mail"
                  label={t("register.email")}
                  placeholder="your@email.com"
                  field="email"
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
                <InputField
                  icon="lock-closed"
                  label={t("register.password")}
                  placeholder="Minimum 6 characters"
                  field="password"
                  autoCapitalize="none"
                  isPassword
                  showPw={showPassword}
                  togglePw={() => setShowPassword((v) => !v)}
                />
                <InputField
                  icon="lock-closed"
                  label={t("register.confirmPassword")}
                  placeholder="Re-enter your password"
                  field="confirmPassword"
                  autoCapitalize="none"
                  isPassword
                  showPw={showConfirmPassword}
                  togglePw={() => setShowConfirmPassword((v) => !v)}
                />

                {/* Register Button */}
                <TouchableOpacity
                  style={styles.registerBtn}
                  onPress={handleRegister}
                  disabled={isLoading}
                  activeOpacity={0.85}
                >
                  <LinearGradient
                    colors={["#22c55e", "#16a34a"]}
                    style={styles.registerGradient}
                  >
                    {isLoading ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <Text style={styles.registerText}>
                          {t("register.createAccount")}
                        </Text>
                        <Ionicons name="arrow-forward" size={20} color="#fff" />
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </View>

              {/* Footer */}
              <View style={styles.footer}>
                <LinearGradient
                  colors={["rgba(255,255,255,0.08)", "rgba(255,255,255,0.04)"]}
                  style={styles.footerGradient}
                >
                  <Text style={styles.footerText}>
                    {t("register.alreadyHaveAccount")}
                  </Text>
                  <TouchableOpacity
                    onPress={() => router.back()}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.loginLink}>{t("register.login")}</Text>
                  </TouchableOpacity>
                </LinearGradient>
              </View>
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  safeArea: {
    flex: 1,
    paddingTop: Platform.OS === "android" ? StatusBar.currentHeight || 0 : 0,
  },

  langWrap: {
    position: "absolute",
    top: Platform.OS === "ios" ? 52 : (StatusBar.currentHeight || 0) + 12,
    right: 16,
    zIndex: 1000,
  },

  keyboardView: {
    flex: 1,
  },

  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingTop:
      Platform.OS === "ios" ? 80 : (StatusBar.currentHeight || 0) + 60,
    paddingBottom: 40,
  },

  content: {
    paddingHorizontal: 24,
  },

  // Header
  header: {
    alignItems: "center",
    marginBottom: 32,
  },
  iconBadge: {
    width: 120,
    height: 120,
    borderRadius: 60,
    marginBottom: 24,
    overflow: "hidden",
    borderWidth: 3,
    borderColor: "rgba(34,197,94,0.3)",
  },
  iconGradient: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#fff",
    marginBottom: 8,
    textAlign: "center",
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 15,
    color: "rgba(255,255,255,0.6)",
    textAlign: "center",
    fontWeight: "500",
  },

  // Form
  form: {
    marginBottom: 24,
  },
  inputWrapper: {
    marginBottom: 18,
  },
  label: {
    fontSize: 11,
    fontWeight: "700",
    color: "rgba(255,255,255,0.5)",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginBottom: 8,
    marginLeft: 4,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 15,
    color: "#fff",
    fontWeight: "500",
  },
  eyeBtn: {
    padding: 8,
  },

  registerBtn: {
    borderRadius: 14,
    marginTop: 8,
    overflow: "hidden",
    shadowColor: "#22c55e",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  registerGradient: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
    paddingVertical: 16,
  },
  registerText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: 0.3,
  },

  // Footer
  footer: {
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  footerGradient: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  footerText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 14,
    fontWeight: "500",
  },
  loginLink: {
    color: "#22c55e",
    fontSize: 14,
    fontWeight: "700",
  },
});
