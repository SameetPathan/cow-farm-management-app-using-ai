import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { child, get, ref } from "firebase/database";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
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

export default function LoginScreen() {
  const { t } = useLanguage();
  const [phoneNumber, setPhoneNumber] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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

  const validateForm = () => {
    if (!phoneNumber || !password) {
      Alert.alert(t("common.error"), t("login.fillAllFields"));
      return false;
    }
    const phoneRegex = /^\d{10}$/;
    if (!phoneRegex.test(phoneNumber)) {
      Alert.alert(t("common.error"), t("login.validPhone"));
      return false;
    }
    return true;
  };

  const handleLogin = () => {
    if (!validateForm()) return;
    setIsLoading(true);

    const dbRef = ref(database);
    get(child(dbRef, `CowFarm/users/${phoneNumber}`))
      .then((snapshot) => {
        setIsLoading(false);
        if (snapshot.exists()) {
          const userData = snapshot.val();
          if (userData.password === password) {
            AsyncStorage.setItem("userPhone", phoneNumber)
              .then(() => {
                Alert.alert(t("common.success"), t("login.loginSuccess"), [
                  {
                    text: t("common.ok"),
                    onPress: () => router.replace("/home"),
                  },
                ]);
              })
              .catch((error) => {
                Alert.alert(
                  t("common.error"),
                  t("login.loginFailed") + ": " + error.message,
                );
              });
          } else {
            Alert.alert(t("common.error"), t("login.incorrectPassword"));
          }
        } else {
          Alert.alert(t("common.error"), t("login.userNotFound"));
        }
      })
      .catch((error) => {
        setIsLoading(false);
        Alert.alert(
          t("common.error"),
          t("login.loginFailed") + ": " + error.message,
        );
      });
  };

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
          <Animated.View style={[styles.content, animStyle]}>
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.iconBadge}>
                <LinearGradient
                  colors={["rgba(34,197,94,0.2)", "rgba(34,197,94,0.1)"]}
                  style={styles.iconGradient}
                >
                  <Ionicons name="leaf" size={56} color="#22c55e" />
                </LinearGradient>
              </View>
              <Text style={styles.title}>{t("login.title")}</Text>
              <Text style={styles.subtitle}>{t("login.subtitle")}</Text>
            </View>

            {/* Form */}
            <View style={styles.form}>
              {/* Phone Number Input */}
              <View style={styles.inputWrapper}>
                <Text style={styles.label}>{t("login.phoneNumber")}</Text>
                <LinearGradient
                  colors={["rgba(255,255,255,0.08)", "rgba(255,255,255,0.04)"]}
                  style={styles.inputContainer}
                >
                  <Ionicons
                    name="call"
                    size={20}
                    color="#22c55e"
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="10-digit phone number"
                    placeholderTextColor="rgba(255,255,255,0.3)"
                    value={phoneNumber}
                    onChangeText={setPhoneNumber}
                    keyboardType="phone-pad"
                    maxLength={10}
                  />
                </LinearGradient>
              </View>

              {/* Password Input */}
              <View style={styles.inputWrapper}>
                <Text style={styles.label}>{t("login.password")}</Text>
                <LinearGradient
                  colors={["rgba(255,255,255,0.08)", "rgba(255,255,255,0.04)"]}
                  style={styles.inputContainer}
                >
                  <Ionicons
                    name="lock-closed"
                    size={20}
                    color="#22c55e"
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="Enter your password"
                    placeholderTextColor="rgba(255,255,255,0.3)"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                  />
                  <TouchableOpacity
                    onPress={() => setShowPassword(!showPassword)}
                    style={styles.eyeBtn}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={showPassword ? "eye-off" : "eye"}
                      size={20}
                      color="rgba(255,255,255,0.5)"
                    />
                  </TouchableOpacity>
                </LinearGradient>
              </View>

              {/* Login Button */}
              <TouchableOpacity
                style={styles.loginBtn}
                onPress={handleLogin}
                disabled={isLoading}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={["#22c55e", "#16a34a"]}
                  style={styles.loginGradient}
                >
                  {isLoading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Text style={styles.loginText}>{t("login.login")}</Text>
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
                  {t("login.dontHaveAccount")}
                </Text>
                <TouchableOpacity
                  onPress={() => router.push("/register")}
                  activeOpacity={0.7}
                >
                  <Text style={styles.registerLink}>{t("login.register")}</Text>
                </TouchableOpacity>
              </LinearGradient>
            </View>
          </Animated.View>
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
    justifyContent: "center",
  },

  content: {
    paddingHorizontal: 24,
  },

  // Header
  header: {
    alignItems: "center",
    marginBottom: 40,
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
    marginBottom: 28,
  },
  inputWrapper: {
    marginBottom: 20,
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

  loginBtn: {
    borderRadius: 14,
    marginTop: 8,
    overflow: "hidden",
    shadowColor: "#22c55e",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  loginGradient: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
    paddingVertical: 16,
  },
  loginText: {
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
  registerLink: {
    color: "#22c55e",
    fontSize: 14,
    fontWeight: "700",
  },
});
