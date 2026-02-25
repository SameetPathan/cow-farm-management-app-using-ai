import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { get, ref } from "firebase/database";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Platform,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import LanguageSelector from "../components/LanguageSelector";
import { useLanguage } from "../contexts/LanguageContext";
import { database } from "../firebaseConfig";

const { width } = Dimensions.get("window");
const CARD_GAP = 12;
const H_PAD = 20;
const CARD_W = (width - H_PAD * 2 - CARD_GAP) / 2;

// ─── Staggered animation hook ───────────────────────────────────────────────
function useStagger(count, delay = 80) {
  const anims = useRef(
    Array.from({ length: count }, () => new Animated.Value(0)),
  ).current;
  const run = () => {
    Animated.stagger(
      delay,
      anims.map((a) =>
        Animated.spring(a, {
          toValue: 1,
          useNativeDriver: true,
          tension: 60,
          friction: 9,
        }),
      ),
    ).start();
  };
  const style = (i) => ({
    opacity: anims[i],
    transform: [
      {
        translateY: anims[i].interpolate({
          inputRange: [0, 1],
          outputRange: [24, 0],
        }),
      },
    ],
  });
  return { run, style };
}

// ─── Action tile ────────────────────────────────────────────────────────────
function ActionTile({ item, onPress, animStyle }) {
  return (
    <Animated.View style={[{ width: CARD_W }, animStyle]}>
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.82}
        style={styles.actionTile}
      >
        <LinearGradient
          colors={[item.color + "CC", item.color + "88"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.actionTileGradient}
        >
          <View
            style={[
              styles.actionCircle,
              { backgroundColor: "rgba(255,255,255,0.15)" },
            ]}
          />
          <View style={styles.actionIconWrap}>
            <Ionicons name={item.icon} size={26} color="#fff" />
          </View>
          <Text style={styles.actionTitle} numberOfLines={2}>
            {item.title}
          </Text>
          <Text style={styles.actionSub} numberOfLines={1}>
            {item.subtitle}
          </Text>
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Main screen ────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const { t } = useLanguage();
  const [userPhone, setUserPhone] = useState("");
  const [userName, setUserName] = useState("User");
  const [refreshing, setRefreshing] = useState(false);
  const [totalCows, setTotalCows] = useState(0);

  const headerAnim = useRef(new Animated.Value(0)).current;
  const statAnim = useRef(new Animated.Value(0)).current;
  const actionStagger = useStagger(7, 60);

  const runEntrance = () => {
    Animated.spring(headerAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 55,
      friction: 8,
    }).start();

    setTimeout(() => {
      Animated.spring(statAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 55,
        friction: 8,
      }).start();
      actionStagger.run();
    }, 150);
  };

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      const phone = await AsyncStorage.getItem("userPhone");
      const name = await AsyncStorage.getItem("userName");

      if (!phone) {
        router.replace("/login");
        return;
      }

      setUserPhone(phone);
      setUserName(name || "User");

      // Run entrance animations immediately
      runEntrance();

      // Load cow count in background (single fast query)
      fetchCowCount(phone);
    } catch (e) {
      console.error(e);
      router.replace("/login");
    }
  };

  const fetchCowCount = async (phone) => {
    try {
      const cowsSnapshot = await get(ref(database, "CowFarm/cows"));

      if (cowsSnapshot.exists()) {
        const allCows = cowsSnapshot.val();
        const count = Object.values(allCows).filter(
          (c) => c.userPhoneNumber === phone,
        ).length;
        setTotalCows(count);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchCowCount(userPhone);
    setRefreshing(false);
  };

  const handleLogout = async () => {
    await AsyncStorage.multiRemove(["userPhone", "userName"]);
    router.replace("/login");
  };

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return t("home.greetingMorning");
    if (h < 17) return t("home.greetingAfternoon");
    return t("home.greetingEvening");
  };

  const dashboardItems = [
    {
      id: 1,
      title: t("home.cowRegistration"),
      subtitle: t("home.addNewCows"),
      icon: "add-circle",
      color: "#22c55e",
      route: "/cow-registration",
    },
    {
      id: 2,
      title: t("home.cowInformation"),
      subtitle: t("home.viewCowDetails"),
      icon: "information-circle",
      color: "#3b82f6",
      route: "/cow-info",
    },
    {
      id: 3,
      title: t("home.dailyReports"),
      subtitle: t("home.trackDailyHealth"),
      icon: "document-text",
      color: "#ef4444",
      route: "/daily-reports",
    },
    {
      id: 4,
      title: t("home.milkProduction"),
      subtitle: t("home.monitorMilkYield"),
      icon: "water",
      color: "#a855f7",
      route: "/milk-production",
    },
    {
      id: 5,
      title: t("home.expenses"),
      subtitle: t("home.trackFarmExpenses"),
      icon: "calculator",
      color: "#f97316",
      route: "/expenses",
    },
    {
      id: 6,
      title: t("home.reports"),
      subtitle: t("home.viewAnalytics"),
      icon: "bar-chart",
      color: "#06b6d4",
      route: "/reports",
    },
    {
      id: 7,
      title: t("home.aiAssistant"),
      subtitle: t("home.getHelpAdvice"),
      icon: "chatbubbles",
      color: "#ec4899",
      route: "/chatbot",
    },
  ];

  const headerStyle = {
    opacity: headerAnim,
    transform: [
      {
        translateY: headerAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [-20, 0],
        }),
      },
    ],
  };

  const statStyle = {
    opacity: statAnim,
    transform: [
      {
        translateY: statAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [20, 0],
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

        {/* Header */}
        <Animated.View style={[styles.header, headerStyle]}>
          <LinearGradient
            colors={["rgba(255,255,255,0.10)", "rgba(255,255,255,0.04)"]}
            style={styles.headerGlass}
          >
            <View style={styles.headerLeft}>
              <LinearGradient
                colors={["#22c55e", "#16a34a"]}
                style={styles.avatar}
              >
                <Ionicons name="person" size={20} color="#fff" />
              </LinearGradient>
              <View>
                <Text style={styles.greeting}>{getGreeting()} 👋</Text>
                <Text style={styles.userName}>{userName}</Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={handleLogout}
              activeOpacity={0.7}
              style={styles.logoutBtn}
            >
              <Ionicons name="log-out-outline" size={20} color="#ef4444" />
            </TouchableOpacity>
          </LinearGradient>
        </Animated.View>

        {/* Scrollable body */}
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#22c55e"
              colors={["#22c55e"]}
            />
          }
        >
          {/* Farm overview - Single stat card */}
          <Animated.View style={statStyle}>
            <Text style={styles.sectionLabel}>{t("home.farmOverview")}</Text>
            <LinearGradient
              colors={["rgba(255,255,255,0.14)", "rgba(255,255,255,0.06)"]}
              style={styles.overviewCard}
            >
              <View style={styles.overviewIconBadge}>
                <Ionicons name="leaf" size={32} color="#22c55e" />
              </View>
              <View style={styles.overviewContent}>
                <Text style={styles.overviewLabel}>{t("home.totalCows")}</Text>
                <Text style={styles.overviewValue}>{totalCows}</Text>
                <Text style={styles.overviewSubtext}>
                  Registered in your farm
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => router.push("/cow-info")}
                style={styles.overviewBtn}
                activeOpacity={0.7}
              >
                <Ionicons name="arrow-forward" size={20} color="#22c55e" />
              </TouchableOpacity>
            </LinearGradient>
          </Animated.View>

          {/* Quick actions */}
          <Text style={[styles.sectionLabel, { marginTop: 28 }]}>
            {t("home.quickActions")}
          </Text>
          <View style={styles.row}>
            {dashboardItems.map((item, i) => (
              <ActionTile
                key={item.id}
                item={item}
                onPress={() => router.push(item.route)}
                animStyle={actionStagger.style(i)}
              />
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  gradient: { flex: 1 },
  safe: {
    flex: 1,
    paddingTop: Platform.OS === "android" ? StatusBar.currentHeight || 0 : 0,
  },

  // Language
  langWrap: {
    position: "absolute",
    top: Platform.OS === "ios" ? 52 : (StatusBar.currentHeight || 0) + 12,
    right: 16,
    zIndex: 1000,
  },

  // Header
  header: {
    marginHorizontal: H_PAD,
    marginTop: Platform.OS === "ios" ? 60 : (StatusBar.currentHeight || 0) + 16,
    marginBottom: 20,
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  headerGlass: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  greeting: {
    fontSize: 12,
    color: "rgba(255,255,255,0.55)",
    fontWeight: "500",
    marginBottom: 2,
  },
  userName: {
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
    letterSpacing: 0.2,
  },
  logoutBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "rgba(239,68,68,0.12)",
    justifyContent: "center",
    alignItems: "center",
  },

  // Scroll
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: H_PAD, paddingBottom: 40 },

  sectionLabel: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 1.1,
    color: "rgba(255,255,255,0.45)",
    textTransform: "uppercase",
    marginBottom: 12,
  },

  // Overview card
  overviewCard: {
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.09)",
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginBottom: 16,
  },
  overviewIconBadge: {
    width: 60,
    height: 60,
    borderRadius: 16,
    backgroundColor: "rgba(34,197,94,0.18)",
    justifyContent: "center",
    alignItems: "center",
  },
  overviewContent: {
    flex: 1,
  },
  overviewLabel: {
    fontSize: 12,
    color: "rgba(255,255,255,0.5)",
    fontWeight: "600",
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  overviewValue: {
    fontSize: 32,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: -0.5,
    marginBottom: 2,
  },
  overviewSubtext: {
    fontSize: 11,
    color: "rgba(255,255,255,0.4)",
    fontWeight: "500",
  },
  overviewBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(34,197,94,0.12)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(34,197,94,0.2)",
  },

  // Action tiles
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: CARD_GAP,
  },
  actionTile: {
    width: CARD_W,
    borderRadius: 18,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  actionTileGradient: {
    padding: 18,
    minHeight: 140,
    justifyContent: "flex-end",
    overflow: "hidden",
  },
  actionCircle: {
    position: "absolute",
    top: -18,
    right: -18,
    width: 90,
    height: 90,
    borderRadius: 45,
  },
  actionIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  actionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 3,
    lineHeight: 18,
  },
  actionSub: {
    fontSize: 11,
    color: "rgba(255,255,255,0.72)",
    fontWeight: "500",
  },
});
