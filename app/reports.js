import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import * as Print from "expo-print";
import { router } from "expo-router";
import * as Sharing from "expo-sharing";
import { get, ref } from "firebase/database";
import { useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Animated,
    Dimensions,
    Platform,
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

// Anthropic API Configuration
const ANTHROPIC_API_KEY =
  ""; // Replace with your actual key
const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export default function ReportsScreen() {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [userPhone, setUserPhone] = useState("");
  const [currentView, setCurrentView] = useState("analytics"); // 'analytics' or 'ai'

  // Detailed Report Data
  const [reportData, setReportData] = useState({
    // Basic Stats
    totalCows: 0,
    healthyCows: 0,
    sickCows: 0,
    underTreatment: 0,
    recovering: 0,

    // Milk Production Stats
    totalMilkProduction: 0,
    averageMilkPerCow: 0,
    morningMilkTotal: 0,
    eveningMilkTotal: 0,
    bestProducingCow: { name: "N/A", quantity: 0 },
    lowestProducingCow: { name: "N/A", quantity: 0 },

    // Expense Stats
    totalExpenses: 0,
    feedExpenses: 0,
    doctorExpenses: 0,
    otherExpenses: 0,
    averageExpensePerDay: 0,
    highestExpenseDay: { date: "N/A", amount: 0 },

    // Health Stats
    commonIllnesses: [],
    veterinarianVisits: 0,
    totalTreatmentCost: 0,
    averageTemperature: 0,

    // Breed Distribution
    breedDistribution: [],

    // Production Quality
    milkQualityDistribution: {
      excellent: 0,
      good: 0,
      fair: 0,
      poor: 0,
    },

    // Detailed Lists
    cowsNeedingAttention: [],
    recentHealthIssues: [],
    topPerformers: [],
  });

  const [selectedPeriod, setSelectedPeriod] = useState("all"); // week, month, year, all
  const [exporting, setExporting] = useState(false);

  // AI Analysis States
  const [aiAnalysis, setAiAnalysis] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiError, setAiError] = useState("");

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const statsAnims = useRef(
    [...Array(12)].map(() => new Animated.Value(0)),
  ).current;

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

    loadUserAndData();
  }, []);

  useEffect(() => {
    if (!loading) {
      Animated.stagger(
        50,
        statsAnims.map((anim) =>
          Animated.spring(anim, {
            toValue: 1,
            useNativeDriver: true,
            tension: 60,
            friction: 9,
          }),
        ),
      ).start();
    }
  }, [loading]);

  const loadUserAndData = async () => {
    try {
      const phone = await AsyncStorage.getItem("userPhone");
      if (!phone) {
        Alert.alert(t("common.error"), "Please login first");
        router.replace("/login");
        return;
      }
      setUserPhone(phone);
      await fetchDetailedReportData(phone);
    } catch (error) {
      console.error("Error loading user:", error);
      Alert.alert(t("common.error"), "Failed to load user data");
    } finally {
      setLoading(false);
    }
  };

  const fetchDetailedReportData = async (phone) => {
    try {
      // Fetch all data
      const [cowsSnap, healthSnap, milkSnap, expensesSnap, reportsSnap] =
        await Promise.all([
          get(ref(database, "CowFarm/cows")),
          get(ref(database, "CowFarm/healthReports")),
          get(ref(database, "CowFarm/milkProduction")),
          get(ref(database, `CowFarm/expenses/${phone}`)),
          get(ref(database, "CowFarm/reports")),
        ]);

      const allCows = cowsSnap.val() || {};
      const healthReports = healthSnap.val() || {};
      const milkData = milkSnap.val() || {};
      const expensesData = expensesSnap.val() || {};
      const reportsData = reportsSnap.val() || {};

      const userCows = Object.values(allCows).filter(
        (cow) => cow.userPhoneNumber === phone,
      );

      // Initialize counters
      let stats = {
        totalCows: userCows.length,
        healthyCows: 0,
        sickCows: 0,
        underTreatment: 0,
        recovering: 0,

        totalMilkProduction: 0,
        morningMilkTotal: 0,
        eveningMilkTotal: 0,

        totalExpenses: 0,
        feedExpenses: 0,
        doctorExpenses: 0,
        otherExpenses: 0,

        veterinarianVisits: 0,
        totalTreatmentCost: 0,
        temperatureSum: 0,
        temperatureCount: 0,

        breedCounts: {},
        illnessCounts: {},
        qualityCounts: { excellent: 0, good: 0, fair: 0, poor: 0 },

        cowMilkTotals: {},
        cowsNeedingAttention: [],
        recentHealthIssues: [],
        expensesByDate: {},
      };

      // Process Health Reports
      userCows.forEach((cow) => {
        const cowHealth = healthReports[cow.uniqueId];
        if (cowHealth) {
          const reports = Object.values(cowHealth);
          const latestReport = reports.sort(
            (a, b) => new Date(b.date) - new Date(a.date),
          )[0];

          if (latestReport) {
            const status = latestReport.healthStatus;
            if (status === "Healthy") stats.healthyCows++;
            else if (status === "Sick") stats.sickCows++;
            else if (status === "Under Treatment") stats.underTreatment++;
            else if (status === "Recovering") stats.recovering++;

            if (status !== "Healthy") {
              stats.cowsNeedingAttention.push({
                name: cow.name || "Unnamed",
                id: cow.uniqueId,
                status: status,
                issue: latestReport.illnessType || "Unknown",
              });
            }

            if (latestReport.illnessType) {
              stats.illnessCounts[latestReport.illnessType] =
                (stats.illnessCounts[latestReport.illnessType] || 0) + 1;
            }

            if (latestReport.veterinarianVisit) {
              stats.veterinarianVisits++;
            }

            if (latestReport.treatmentCost) {
              stats.totalTreatmentCost += parseFloat(
                latestReport.treatmentCost,
              );
            }

            if (latestReport.temperature) {
              stats.temperatureSum += parseFloat(latestReport.temperature);
              stats.temperatureCount++;
            }

            if (status !== "Healthy") {
              stats.recentHealthIssues.push({
                cow: cow.name || "Unnamed",
                date: latestReport.date,
                issue: latestReport.illnessType || "Unknown",
                status: status,
              });
            }
          }
        }

        // Breed distribution
        if (cow.breed) {
          stats.breedCounts[cow.breed] =
            (stats.breedCounts[cow.breed] || 0) + 1;
        }
      });

      // Process Milk Production
      userCows.forEach((cow) => {
        const cowMilk = milkData[cow.uniqueId];
        let cowTotal = 0;

        if (cowMilk) {
          Object.values(cowMilk).forEach((dayData) => {
            const morningQty = parseFloat(dayData.morning?.milkQuantity || 0);
            const eveningQty = parseFloat(dayData.evening?.milkQuantity || 0);

            stats.morningMilkTotal += morningQty;
            stats.eveningMilkTotal += eveningQty;
            stats.totalMilkProduction += morningQty + eveningQty;
            cowTotal += morningQty + eveningQty;

            // Quality tracking
            const morningQuality = dayData.morning?.milkQuality?.toLowerCase();
            const eveningQuality = dayData.evening?.milkQuality?.toLowerCase();

            if (
              morningQuality &&
              stats.qualityCounts[morningQuality] !== undefined
            ) {
              stats.qualityCounts[morningQuality]++;
            }
            if (
              eveningQuality &&
              stats.qualityCounts[eveningQuality] !== undefined
            ) {
              stats.qualityCounts[eveningQuality]++;
            }
          });
        }

        stats.cowMilkTotals[cow.uniqueId] = {
          name: cow.name || "Unnamed",
          total: cowTotal,
        };
      });

      // Process Expenses
      Object.entries(expensesData).forEach(([date, expense]) => {
        const feed = parseFloat(expense.feed || 0);
        const doctor = parseFloat(expense.doctor || 0);
        const other = parseFloat(expense.other || 0);
        const total = feed + doctor + other;

        stats.feedExpenses += feed;
        stats.doctorExpenses += doctor;
        stats.otherExpenses += other;
        stats.totalExpenses += total;

        stats.expensesByDate[date] = total;
      });

      // Calculate derived stats
      const averageMilkPerCow =
        stats.totalCows > 0 ? stats.totalMilkProduction / stats.totalCows : 0;

      const cowsNeedingCare =
        stats.sickCows + stats.underTreatment + stats.recovering;

      const breedDistribution = Object.entries(stats.breedCounts)
        .map(([breed, count]) => ({ breed, count }))
        .sort((a, b) => b.count - a.count);

      const commonIllnesses = Object.entries(stats.illnessCounts)
        .map(([illness, count]) => ({ illness, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      // Find best and worst producers
      const sortedProducers = Object.values(stats.cowMilkTotals).sort(
        (a, b) => b.total - a.total,
      );

      const bestProducingCow = sortedProducers[0] || { name: "N/A", total: 0 };
      const lowestProducingCow = sortedProducers[
        sortedProducers.length - 1
      ] || { name: "N/A", total: 0 };

      // Find highest expense day
      const expenseEntries = Object.entries(stats.expensesByDate);
      const highestExpenseDay =
        expenseEntries.length > 0
          ? expenseEntries.reduce(
              (max, [date, amount]) =>
                amount > max.amount ? { date, amount } : max,
              { date: "N/A", amount: 0 },
            )
          : { date: "N/A", amount: 0 };

      const averageExpensePerDay =
        expenseEntries.length > 0
          ? stats.totalExpenses / expenseEntries.length
          : 0;

      const averageTemperature =
        stats.temperatureCount > 0
          ? stats.temperatureSum / stats.temperatureCount
          : 0;

      // Top performers (healthy + high milk production)
      const topPerformers = sortedProducers
        .filter((cow) => {
          const cowData = userCows.find((c) => c.name === cow.name);
          if (!cowData) return false;
          const health = healthReports[cowData.uniqueId];
          if (!health) return true; // No health issues recorded
          const latestReport = Object.values(health).sort(
            (a, b) => new Date(b.date) - new Date(a.date),
          )[0];
          return latestReport?.healthStatus === "Healthy";
        })
        .slice(0, 5);

      setReportData({
        totalCows: stats.totalCows,
        healthyCows: stats.healthyCows,
        sickCows: stats.sickCows,
        underTreatment: stats.underTreatment,
        recovering: stats.recovering,

        totalMilkProduction: stats.totalMilkProduction.toFixed(2),
        averageMilkPerCow: averageMilkPerCow.toFixed(2),
        morningMilkTotal: stats.morningMilkTotal.toFixed(2),
        eveningMilkTotal: stats.eveningMilkTotal.toFixed(2),
        bestProducingCow: {
          name: bestProducingCow.name,
          quantity: bestProducingCow.total.toFixed(2),
        },
        lowestProducingCow: {
          name: lowestProducingCow.name,
          quantity: lowestProducingCow.total.toFixed(2),
        },

        totalExpenses: stats.totalExpenses.toFixed(2),
        feedExpenses: stats.feedExpenses.toFixed(2),
        doctorExpenses: stats.doctorExpenses.toFixed(2),
        otherExpenses: stats.otherExpenses.toFixed(2),
        averageExpensePerDay: averageExpensePerDay.toFixed(2),
        highestExpenseDay: {
          date: highestExpenseDay.date,
          amount: highestExpenseDay.amount.toFixed(2),
        },

        commonIllnesses,
        veterinarianVisits: stats.veterinarianVisits,
        totalTreatmentCost: stats.totalTreatmentCost.toFixed(2),
        averageTemperature: averageTemperature.toFixed(2),

        breedDistribution,

        milkQualityDistribution: stats.qualityCounts,

        cowsNeedingAttention: stats.cowsNeedingAttention.slice(0, 10),
        recentHealthIssues: stats.recentHealthIssues
          .sort((a, b) => new Date(b.date) - new Date(a.date))
          .slice(0, 5),
        topPerformers: topPerformers.map((p) => ({
          name: p.name,
          production: p.total.toFixed(2),
        })),
      });
    } catch (error) {
      console.error("Error fetching report data:", error);
      Alert.alert(t("common.error"), "Failed to load report data");
    }
  };

  const generateAIAnalysis = async () => {
    if (!ANTHROPIC_API_KEY || ANTHROPIC_API_KEY === "YOUR_API_KEY_HERE") {
      Alert.alert(
        "API Key Required",
        "Please set your Anthropic API key in the code to use AI analysis.",
      );
      return;
    }

    setIsAnalyzing(true);
    setAiError("");

    try {
      const analysisPrompt = `As an expert dairy farm consultant and veterinarian, analyze the following comprehensive farm data and provide detailed insights, recommendations, and predictions:

**FARM OVERVIEW:**
- Total Cows: ${reportData.totalCows}
- Healthy: ${reportData.healthyCows}
- Sick: ${reportData.sickCows}
- Under Treatment: ${reportData.underTreatment}
- Recovering: ${reportData.recovering}

**MILK PRODUCTION:**
- Total Production: ${reportData.totalMilkProduction}L
- Average per Cow: ${reportData.averageMilkPerCow}L
- Morning Total: ${reportData.morningMilkTotal}L
- Evening Total: ${reportData.eveningMilkTotal}L
- Best Producer: ${reportData.bestProducingCow.name} (${reportData.bestProducingCow.quantity}L)
- Lowest Producer: ${reportData.lowestProducingCow.name} (${reportData.lowestProducingCow.quantity}L)

**MILK QUALITY DISTRIBUTION:**
- Excellent: ${reportData.milkQualityDistribution.excellent} sessions
- Good: ${reportData.milkQualityDistribution.good} sessions
- Fair: ${reportData.milkQualityDistribution.fair} sessions
- Poor: ${reportData.milkQualityDistribution.poor} sessions

**FINANCIAL DATA:**
- Total Expenses: ₹${reportData.totalExpenses}
- Feed Costs: ₹${reportData.feedExpenses}
- Medical Costs: ₹${reportData.doctorExpenses}
- Other Costs: ₹${reportData.otherExpenses}
- Average Daily Expense: ₹${reportData.averageExpensePerDay}
- Highest Expense Day: ${reportData.highestExpenseDay.date} (₹${reportData.highestExpenseDay.amount})

**HEALTH DATA:**
- Veterinarian Visits: ${reportData.veterinarianVisits}
- Total Treatment Cost: ₹${reportData.totalTreatmentCost}
- Average Temperature: ${reportData.averageTemperature}°F
- Common Illnesses: ${reportData.commonIllnesses.map((i) => `${i.illness} (${i.count})`).join(", ")}

**BREED DISTRIBUTION:**
${reportData.breedDistribution.map((b) => `- ${b.breed}: ${b.count} cows`).join("\n")}

**COWS NEEDING ATTENTION:**
${reportData.cowsNeedingAttention.map((c) => `- ${c.name}: ${c.status} (${c.issue})`).join("\n")}

**TOP PERFORMERS:**
${reportData.topPerformers.map((p) => `- ${p.name}: ${p.production}L`).join("\n")}

Please provide:
1. **Overall Farm Health Assessment** - Rate the farm's overall health and performance
2. **Production Analysis** - Evaluate milk production trends and efficiency
3. **Financial Insights** - Analyze cost patterns and suggest optimization
4. **Health Concerns** - Identify critical health issues requiring immediate attention
5. **Breed Performance** - Compare breed-wise productivity
6. **Actionable Recommendations** - Provide specific, prioritized action items
7. **Predictions & Forecasts** - Predict likely outcomes based on current trends
8. **Risk Assessment** - Identify potential risks and mitigation strategies

Be specific, data-driven, and provide concrete numbers where possible.`;

      const response = await fetch(ANTHROPIC_API_URL, {
        method: "POST",
        headers: {
          "x-api-key": ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 4000,
          messages: [
            {
              role: "user",
              content: analysisPrompt,
            },
          ],
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          `API Error: ${response.status} - ${errorData.error?.message || "Unknown error"}`,
        );
      }

      const data = await response.json();
      setAiAnalysis(data.content[0].text);
    } catch (error) {
      console.error("AI Analysis Error:", error);
      setAiError(error.message || "Failed to generate AI analysis");
      Alert.alert(
        "Analysis Failed",
        "Could not generate AI analysis. Please check your API key and try again.",
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  const generatePDFReport = async () => {
    setExporting(true);
    try {
      // Generate AI analysis if not already generated
      let aiContent = aiAnalysis;
      if (
        !aiContent &&
        ANTHROPIC_API_KEY &&
        ANTHROPIC_API_KEY !== "YOUR_API_KEY_HERE"
      ) {
        try {
          const analysisPrompt = `As an expert dairy farm consultant and veterinarian, analyze the following comprehensive farm data and provide detailed insights, recommendations, and predictions:

**FARM OVERVIEW:**
- Total Cows: ${reportData.totalCows}
- Healthy: ${reportData.healthyCows}
- Sick: ${reportData.sickCows}
- Under Treatment: ${reportData.underTreatment}
- Recovering: ${reportData.recovering}

**MILK PRODUCTION:**
- Total Production: ${reportData.totalMilkProduction}L
- Average per Cow: ${reportData.averageMilkPerCow}L
- Morning Total: ${reportData.morningMilkTotal}L
- Evening Total: ${reportData.eveningMilkTotal}L
- Best Producer: ${reportData.bestProducingCow.name} (${reportData.bestProducingCow.quantity}L)

**FINANCIAL DATA:**
- Total Expenses: ₹${reportData.totalExpenses}
- Feed Costs: ₹${reportData.feedExpenses}
- Medical Costs: ₹${reportData.doctorExpenses}

**HEALTH DATA:**
- Veterinarian Visits: ${reportData.veterinarianVisits}
- Total Treatment Cost: ₹${reportData.totalTreatmentCost}
- Average Temperature: ${reportData.averageTemperature}°F

Please provide comprehensive analysis with specific recommendations.`;

          const response = await fetch(ANTHROPIC_API_URL, {
            method: "POST",
            headers: {
              "x-api-key": ANTHROPIC_API_KEY,
              "anthropic-version": "2023-06-01",
              "content-type": "application/json",
            },
            body: JSON.stringify({
              model: "claude-sonnet-4-20250514",
              max_tokens: 4000,
              messages: [{ role: "user", content: analysisPrompt }],
            }),
          });

          if (response.ok) {
            const data = await response.json();
            aiContent = data.content[0].text;
          }
        } catch (err) {
          console.log("Skipping AI analysis in PDF:", err);
        }
      }

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
              font-family: 'Helvetica', 'Arial', sans-serif;
              padding: 25px;
              background: linear-gradient(135deg, #0f1923 0%, #142233 100%);
              color: #fff;
              font-size: 11px;
              line-height: 1.6;
            }
            .page-break { page-break-after: always; }
            .header {
              text-align: center;
              margin-bottom: 25px;
              padding-bottom: 15px;
              border-bottom: 2px solid rgba(6,182,212,0.3);
            }
            .header h1 {
              color: #06b6d4;
              font-size: 26px;
              margin-bottom: 8px;
              font-weight: 800;
              letter-spacing: 0.5px;
            }
            .header .subtitle {
              color: rgba(255,255,255,0.7);
              font-size: 13px;
              margin-bottom: 10px;
              font-weight: 600;
            }
            .header p { 
              color: rgba(255,255,255,0.5); 
              font-size: 10px;
              margin: 3px 0;
            }
            
            .main-section {
              margin-bottom: 30px;
              page-break-inside: avoid;
            }
            .section-header {
              background: linear-gradient(90deg, rgba(6,182,212,0.2), transparent);
              padding: 10px 15px;
              border-left: 4px solid #06b6d4;
              margin-bottom: 15px;
            }
            .section-title {
              font-size: 16px;
              font-weight: 700;
              color: #06b6d4;
              text-transform: uppercase;
              letter-spacing: 0.8px;
            }
            .section-subtitle {
              font-size: 10px;
              color: rgba(255,255,255,0.5);
              margin-top: 3px;
            }
            
            .stats-grid {
              display: grid;
              grid-template-columns: repeat(3, 1fr);
              gap: 12px;
              margin-bottom: 15px;
            }
            .stats-grid-2 {
              display: grid;
              grid-template-columns: repeat(2, 1fr);
              gap: 12px;
              margin-bottom: 15px;
            }
            .stats-grid-4 {
              display: grid;
              grid-template-columns: repeat(4, 1fr);
              gap: 10px;
              margin-bottom: 15px;
            }
            
            .stat-card {
              background: linear-gradient(135deg, rgba(255,255,255,0.08), rgba(255,255,255,0.03));
              border: 1px solid rgba(255,255,255,0.12);
              border-radius: 10px;
              padding: 12px;
              text-align: center;
            }
            .stat-icon {
              font-size: 18px;
              margin-bottom: 6px;
            }
            .stat-label {
              color: rgba(255,255,255,0.5);
              font-size: 9px;
              text-transform: uppercase;
              letter-spacing: 0.6px;
              margin-bottom: 6px;
              font-weight: 700;
            }
            .stat-value {
              color: #fff;
              font-size: 20px;
              font-weight: 800;
              margin-bottom: 3px;
              letter-spacing: -0.5px;
            }
            .stat-value-small {
              font-size: 16px;
            }
            .stat-subtitle {
              color: rgba(255,255,255,0.4);
              font-size: 9px;
            }
            
            .info-box {
              background: linear-gradient(135deg, rgba(6,182,212,0.15), rgba(6,182,212,0.05));
              border: 1px solid rgba(6,182,212,0.3);
              border-radius: 8px;
              padding: 12px 15px;
              margin-bottom: 12px;
            }
            .info-box-warning {
              background: linear-gradient(135deg, rgba(239,68,68,0.15), rgba(239,68,68,0.05));
              border-color: rgba(239,68,68,0.3);
            }
            .info-box-success {
              background: linear-gradient(135deg, rgba(34,197,94,0.15), rgba(34,197,94,0.05));
              border-color: rgba(34,197,94,0.3);
            }
            .info-box h4 {
              font-size: 11px;
              color: #06b6d4;
              margin-bottom: 6px;
              font-weight: 700;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            .info-box-warning h4 { color: #ef4444; }
            .info-box-success h4 { color: #22c55e; }
            
            .list-container {
              display: grid;
              grid-template-columns: repeat(2, 1fr);
              gap: 8px;
              margin-bottom: 15px;
            }
            .list-item {
              padding: 10px 12px;
              background: rgba(255,255,255,0.04);
              border-left: 3px solid #06b6d4;
              border-radius: 4px;
              font-size: 10px;
            }
            .list-item strong {
              color: #fff;
              display: block;
              margin-bottom: 3px;
              font-size: 11px;
            }
            .list-item span {
              color: rgba(255,255,255,0.6);
            }
            
            .quality-bar {
              display: flex;
              gap: 8px;
              margin: 10px 0;
            }
            .quality-item {
              flex: 1;
              text-align: center;
              padding: 8px;
              background: rgba(255,255,255,0.05);
              border-radius: 6px;
              border: 1px solid rgba(255,255,255,0.1);
            }
            .quality-label {
              font-size: 9px;
              color: rgba(255,255,255,0.5);
              text-transform: uppercase;
              margin-bottom: 4px;
            }
            .quality-value {
              font-size: 16px;
              font-weight: 800;
              color: #fff;
            }
            
            .ai-section {
              background: linear-gradient(135deg, rgba(236,72,153,0.15), rgba(236,72,153,0.05));
              border: 2px solid rgba(236,72,153,0.3);
              border-radius: 12px;
              padding: 20px;
              margin-top: 30px;
            }
            .ai-header {
              text-align: center;
              margin-bottom: 20px;
              padding-bottom: 15px;
              border-bottom: 1px solid rgba(255,255,255,0.1);
            }
            .ai-header h2 {
              color: #ec4899;
              font-size: 20px;
              margin-bottom: 6px;
              font-weight: 800;
            }
            .ai-header p {
              color: rgba(255,255,255,0.6);
              font-size: 11px;
            }
            .ai-content {
              color: rgba(255,255,255,0.9);
              line-height: 1.8;
              font-size: 11px;
              white-space: pre-wrap;
            }
            
            .footer {
              text-align: center;
              margin-top: 30px;
              padding-top: 15px;
              border-top: 2px solid rgba(255,255,255,0.1);
              color: rgba(255,255,255,0.4);
              font-size: 9px;
            }
            
            .cyan { color: #06b6d4; }
            .green { color: #22c55e; }
            .red { color: #ef4444; }
            .purple { color: #a855f7; }
            .orange { color: #f97316; }
            .blue { color: #3b82f6; }
            .pink { color: #ec4899; }
          </style>
        </head>
        <body>
          <!-- HEADER -->
          <div class="header">
            <h1>🐄 Comprehensive Farm Analytics Report</h1>
            <div class="subtitle">Detailed Performance & Health Analysis</div>
            <p>Generated on ${new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })} at ${new Date().toLocaleTimeString()}</p>
            <p>Farm Contact: ${userPhone}</p>
            <p>Total Cows Tracked: ${reportData.totalCows}</p>
          </div>

          <!-- HEALTH OVERVIEW SECTION -->
          <div class="main-section">
            <div class="section-header">
              <div class="section-title">🏥 Health Overview</div>
              <div class="section-subtitle">Current health status of all cattle</div>
            </div>
            
            <div class="stats-grid">
              <div class="stat-card">
                <div class="stat-icon">🐮</div>
                <div class="stat-label">Total Cows</div>
                <div class="stat-value cyan">${reportData.totalCows}</div>
                <div class="stat-subtitle">Registered</div>
              </div>
              <div class="stat-card">
                <div class="stat-icon">✅</div>
                <div class="stat-label">Healthy</div>
                <div class="stat-value green">${reportData.healthyCows}</div>
                <div class="stat-subtitle">${((reportData.healthyCows / reportData.totalCows) * 100).toFixed(1)}% of herd</div>
              </div>
              <div class="stat-card">
                <div class="stat-icon">🚨</div>
                <div class="stat-label">Sick</div>
                <div class="stat-value red">${reportData.sickCows}</div>
                <div class="stat-subtitle">Immediate attention</div>
              </div>
            </div>

            <div class="stats-grid">
              <div class="stat-card">
                <div class="stat-icon">💊</div>
                <div class="stat-label">Under Treatment</div>
                <div class="stat-value orange">${reportData.underTreatment}</div>
                <div class="stat-subtitle">Active cases</div>
              </div>
              <div class="stat-card">
                <div class="stat-icon">📈</div>
                <div class="stat-label">Recovering</div>
                <div class="stat-value blue">${reportData.recovering}</div>
                <div class="stat-subtitle">Improving</div>
              </div>
              <div class="stat-card">
                <div class="stat-icon">🌡️</div>
                <div class="stat-label">Avg Temperature</div>
                <div class="stat-value purple">${reportData.averageTemperature}°F</div>
                <div class="stat-subtitle">Normal: 101.5°F</div>
              </div>
            </div>

            <div class="info-box">
              <h4>🩺 Veterinary Statistics</h4>
              <div style="display: flex; justify-content: space-between; margin-top: 8px;">
                <div>
                  <strong style="color: #06b6d4; font-size: 16px;">${reportData.veterinarianVisits}</strong>
                  <div style="font-size: 9px; color: rgba(255,255,255,0.5);">Total Vet Visits</div>
                </div>
                <div>
                  <strong style="color: #06b6d4; font-size: 16px;">₹${reportData.totalTreatmentCost}</strong>
                  <div style="font-size: 9px; color: rgba(255,255,255,0.5);">Total Treatment Cost</div>
                </div>
              </div>
            </div>
          </div>

          <!-- MILK PRODUCTION SECTION -->
          <div class="main-section">
            <div class="section-header">
              <div class="section-title">🥛 Milk Production Analytics</div>
              <div class="section-subtitle">Complete production performance metrics</div>
            </div>
            
            <div class="stats-grid-2">
              <div class="stat-card">
                <div class="stat-icon">💧</div>
                <div class="stat-label">Total Production</div>
                <div class="stat-value purple">${reportData.totalMilkProduction}L</div>
                <div class="stat-subtitle">Cumulative output</div>
              </div>
              <div class="stat-card">
                <div class="stat-icon">📊</div>
                <div class="stat-label">Average per Cow</div>
                <div class="stat-value blue">${reportData.averageMilkPerCow}L</div>
                <div class="stat-subtitle">Per animal average</div>
              </div>
            </div>

            <div class="stats-grid-2">
              <div class="stat-card">
                <div class="stat-icon">🌅</div>
                <div class="stat-label">Morning Production</div>
                <div class="stat-value orange">${reportData.morningMilkTotal}L</div>
                <div class="stat-subtitle">${((parseFloat(reportData.morningMilkTotal) / parseFloat(reportData.totalMilkProduction)) * 100).toFixed(1)}% of total</div>
              </div>
              <div class="stat-card">
                <div class="stat-icon">🌙</div>
                <div class="stat-label">Evening Production</div>
                <div class="stat-value blue">${reportData.eveningMilkTotal}L</div>
                <div class="stat-subtitle">${((parseFloat(reportData.eveningMilkTotal) / parseFloat(reportData.totalMilkProduction)) * 100).toFixed(1)}% of total</div>
              </div>
            </div>

            <div class="info-box-success">
              <h4>🏆 Best Producer</h4>
              <div style="margin-top: 8px;">
                <strong style="font-size: 14px; color: #22c55e;">${reportData.bestProducingCow.name}</strong>
                <div style="font-size: 10px; color: rgba(255,255,255,0.7); margin-top: 3px;">
                  Total Production: <strong>${reportData.bestProducingCow.quantity}L</strong>
                </div>
              </div>
            </div>

            <div class="info-box-warning">
              <h4>⚠️ Lowest Producer</h4>
              <div style="margin-top: 8px;">
                <strong style="font-size: 14px; color: #ef4444;">${reportData.lowestProducingCow.name}</strong>
                <div style="font-size: 10px; color: rgba(255,255,255,0.7); margin-top: 3px;">
                  Total Production: <strong>${reportData.lowestProducingCow.quantity}L</strong> - Requires attention
                </div>
              </div>
            </div>

            <h4 style="color: rgba(255,255,255,0.7); font-size: 11px; margin: 15px 0 10px 0; text-transform: uppercase; letter-spacing: 0.5px;">Milk Quality Distribution</h4>
            <div class="quality-bar">
              <div class="quality-item" style="border-color: rgba(34,197,94,0.3);">
                <div class="quality-label" style="color: #22c55e;">Excellent</div>
                <div class="quality-value green">${reportData.milkQualityDistribution.excellent}</div>
              </div>
              <div class="quality-item" style="border-color: rgba(59,130,246,0.3);">
                <div class="quality-label" style="color: #3b82f6;">Good</div>
                <div class="quality-value blue">${reportData.milkQualityDistribution.good}</div>
              </div>
              <div class="quality-item" style="border-color: rgba(251,191,36,0.3);">
                <div class="quality-label" style="color: #fbbf24;">Fair</div>
                <div class="quality-value" style="color: #fbbf24;">${reportData.milkQualityDistribution.fair}</div>
              </div>
              <div class="quality-item" style="border-color: rgba(239,68,68,0.3);">
                <div class="quality-label" style="color: #ef4444;">Poor</div>
                <div class="quality-value red">${reportData.milkQualityDistribution.poor}</div>
              </div>
            </div>
          </div>

          <!-- FINANCIAL SECTION -->
          <div class="main-section">
            <div class="section-header">
              <div class="section-title">💰 Financial Overview</div>
              <div class="section-subtitle">Expense tracking and cost analysis</div>
            </div>
            
            <div class="stats-grid-2">
              <div class="stat-card">
                <div class="stat-icon">💵</div>
                <div class="stat-label">Total Expenses</div>
                <div class="stat-value orange">₹${reportData.totalExpenses}</div>
                <div class="stat-subtitle">All categories</div>
              </div>
              <div class="stat-card">
                <div class="stat-icon">📅</div>
                <div class="stat-label">Average per Day</div>
                <div class="stat-value cyan">₹${reportData.averageExpensePerDay}</div>
                <div class="stat-subtitle">Daily average</div>
              </div>
            </div>

            <div class="stats-grid">
              <div class="stat-card">
                <div class="stat-icon">🌾</div>
                <div class="stat-label">Feed Costs</div>
                <div class="stat-value green">₹${reportData.feedExpenses}</div>
                <div class="stat-subtitle">${((parseFloat(reportData.feedExpenses) / parseFloat(reportData.totalExpenses)) * 100).toFixed(1)}% of total</div>
              </div>
              <div class="stat-card">
                <div class="stat-icon">🏥</div>
                <div class="stat-label">Medical Costs</div>
                <div class="stat-value red">₹${reportData.doctorExpenses}</div>
                <div class="stat-subtitle">${((parseFloat(reportData.doctorExpenses) / parseFloat(reportData.totalExpenses)) * 100).toFixed(1)}% of total</div>
              </div>
              <div class="stat-card">
                <div class="stat-icon">📦</div>
                <div class="stat-label">Other Costs</div>
                <div class="stat-value purple">₹${reportData.otherExpenses}</div>
                <div class="stat-subtitle">${((parseFloat(reportData.otherExpenses) / parseFloat(reportData.totalExpenses)) * 100).toFixed(1)}% of total</div>
              </div>
            </div>

            <div class="info-box-warning">
              <h4>📈 Highest Expense Day</h4>
              <div style="margin-top: 8px;">
                <strong style="font-size: 12px; color: #ef4444;">${reportData.highestExpenseDay.date}</strong>
                <div style="font-size: 10px; color: rgba(255,255,255,0.7); margin-top: 3px;">
                  Total Spent: <strong>₹${reportData.highestExpenseDay.amount}</strong>
                </div>
              </div>
            </div>
          </div>

          <div class="page-break"></div>

          <!-- COWS NEEDING ATTENTION -->
          ${
            reportData.cowsNeedingAttention.length > 0
              ? `
          <div class="main-section">
            <div class="section-header">
              <div class="section-title">⚠️ Cows Requiring Attention</div>
              <div class="section-subtitle">${reportData.cowsNeedingAttention.length} animals need care</div>
            </div>
            
            <div class="list-container">
              ${reportData.cowsNeedingAttention
                .map(
                  (cow) => `
                <div class="list-item" style="border-left-color: #ef4444;">
                  <strong>${cow.name}</strong>
                  <span>Status: ${cow.status}</span><br>
                  <span style="color: #ef4444;">Issue: ${cow.issue}</span>
                </div>
              `,
                )
                .join("")}
            </div>
          </div>
          `
              : ""
          }

          <!-- TOP PERFORMERS -->
          ${
            reportData.topPerformers.length > 0
              ? `
          <div class="main-section">
            <div class="section-header">
              <div class="section-title">🏆 Top Performing Cows</div>
              <div class="section-subtitle">Highest milk producers in excellent health</div>
            </div>
            
            <div class="list-container">
              ${reportData.topPerformers
                .map(
                  (cow, i) => `
                <div class="list-item" style="border-left-color: #22c55e;">
                  <strong>#${i + 1} ${cow.name}</strong>
                  <span>Production: ${cow.production}L</span><br>
                  <span style="color: #22c55e;">Status: Healthy & Productive</span>
                </div>
              `,
                )
                .join("")}
            </div>
          </div>
          `
              : ""
          }

          <!-- BREED DISTRIBUTION -->
          ${
            reportData.breedDistribution.length > 0
              ? `
          <div class="main-section">
            <div class="section-header">
              <div class="section-title">🐄 Breed Distribution</div>
              <div class="section-subtitle">Cattle breed composition analysis</div>
            </div>
            
            <div class="list-container">
              ${reportData.breedDistribution
                .map(
                  (breed) => `
                <div class="list-item" style="border-left-color: #06b6d4;">
                  <strong>${breed.breed}</strong>
                  <span>${breed.count} ${breed.count === 1 ? "cow" : "cows"} (${((breed.count / reportData.totalCows) * 100).toFixed(1)}%)</span>
                </div>
              `,
                )
                .join("")}
            </div>
          </div>
          `
              : ""
          }

          <!-- COMMON ILLNESSES -->
          ${
            reportData.commonIllnesses.length > 0
              ? `
          <div class="main-section">
            <div class="section-header">
              <div class="section-title">🦠 Common Health Issues</div>
              <div class="section-subtitle">Most frequent illnesses recorded</div>
            </div>
            
            <div class="list-container">
              ${reportData.commonIllnesses
                .map(
                  (illness) => `
                <div class="list-item" style="border-left-color: #f97316;">
                  <strong>${illness.illness}</strong>
                  <span>${illness.count} ${illness.count === 1 ? "case" : "cases"} reported</span>
                </div>
              `,
                )
                .join("")}
            </div>
          </div>
          `
              : ""
          }

          ${
            aiContent
              ? `
          <div class="page-break"></div>
          
          <!-- AI ANALYSIS SECTION -->
          <div class="ai-section">
            <div class="ai-header">
              <h2>🤖 AI & ML Analytics</h2>
              <p>Powered by Claude AI - Advanced Farm Intelligence</p>
            </div>
            <div class="ai-content">${aiContent}</div>
          </div>
          `
              : ""
          }

          <!-- FOOTER -->
          <div class="footer">
            <p><strong>Cow Farm Management System</strong></p>
            <p>This comprehensive report is auto-generated and contains detailed statistics from your farm database</p>
            <p>Report ID: CFM-${Date.now()} | Generated: ${new Date().toISOString()}</p>
            <p>© ${new Date().getFullYear()} Cow Farm Management. All rights reserved.</p>
          </div>
        </body>
        </html>
      `;

      const { uri } = await Print.printToFileAsync({ html });

      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(uri, {
          mimeType: "application/pdf",
          dialogTitle: "Share Comprehensive Farm Report",
          UTI: "com.adobe.pdf",
        });
      } else {
        Alert.alert(t("common.success"), "Report generated successfully!");
      }
    } catch (error) {
      console.error("Error generating PDF:", error);
      Alert.alert(t("common.error"), "Failed to generate PDF report");
    } finally {
      setExporting(false);
    }
  };

  const animStyle = {
    opacity: fadeAnim,
    transform: [{ translateY: slideAnim }],
  };

  if (loading) {
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
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#06b6d4" />
            <Text style={styles.loadingText}>{t("common.loading")}</Text>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

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
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Header */}
          <Animated.View style={[styles.header, animStyle]}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.backBtn}
              activeOpacity={0.7}
            >
              <Ionicons name="arrow-back" size={20} color="#fff" />
            </TouchableOpacity>

            <View style={styles.headerCenter}>
              <View style={styles.headerIconBadge}>
                <Ionicons name="bar-chart" size={22} color="#06b6d4" />
              </View>
              <View>
                <Text style={styles.headerTitle}>
                  {currentView === "analytics"
                    ? t("reports.title") || "Farm Reports"
                    : "AI & ML Analytics"}
                </Text>
                <Text style={styles.headerSubtitle}>
                  {currentView === "analytics"
                    ? t("reports.subtitle") || "Detailed Insights"
                    : "Powered by Claude AI"}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={generatePDFReport}
              style={styles.exportBtn}
              activeOpacity={0.7}
              disabled={exporting}
            >
              {exporting ? (
                <ActivityIndicator size="small" color="#06b6d4" />
              ) : (
                <Ionicons name="download-outline" size={20} color="#06b6d4" />
              )}
            </TouchableOpacity>
          </Animated.View>

          {/* View Toggle */}
          <View style={styles.viewToggle}>
            <TouchableOpacity
              onPress={() => setCurrentView("analytics")}
              style={[
                styles.toggleBtn,
                currentView === "analytics" && styles.toggleBtnActive,
              ]}
              activeOpacity={0.7}
            >
              <Ionicons
                name="analytics"
                size={18}
                color={
                  currentView === "analytics" ? "#fff" : "rgba(255,255,255,0.6)"
                }
              />
              <Text
                style={[
                  styles.toggleText,
                  currentView === "analytics" && styles.toggleTextActive,
                ]}
              >
                Analytics
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setCurrentView("ai")}
              style={[
                styles.toggleBtn,
                currentView === "ai" && styles.toggleBtnActive,
              ]}
              activeOpacity={0.7}
            >
              <Ionicons
                name="sparkles"
                size={18}
                color={currentView === "ai" ? "#fff" : "rgba(255,255,255,0.6)"}
              />
              <Text
                style={[
                  styles.toggleText,
                  currentView === "ai" && styles.toggleTextActive,
                ]}
              >
                AI Analysis
              </Text>
            </TouchableOpacity>
          </View>

          {currentView === "analytics" ? (
            // ANALYTICS VIEW
            <>
              {/* PDF Download Button */}
              <TouchableOpacity
                style={styles.pdfDownloadBtn}
                onPress={generatePDFReport}
                disabled={exporting}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={["#06b6d4", "#0891b2"]}
                  style={styles.pdfGradient}
                >
                  {exporting ? (
                    <>
                      <ActivityIndicator size="small" color="#fff" />
                      <Text style={styles.pdfText}>Generating PDF...</Text>
                    </>
                  ) : (
                    <>
                      <Ionicons name="document-text" size={22} color="#fff" />
                      <Text style={styles.pdfText}>
                        Download Complete PDF Report
                      </Text>
                      <Text style={styles.pdfSubtext}>
                        Includes all analytics & AI analysis
                      </Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>

              {/* Health Overview */}
              <View style={styles.sectionContainer}>
                <Text style={styles.sectionTitle}>
                  {t("reports.healthOverview") || "Health Overview"}
                </Text>
                <View style={styles.statsGrid3}>
                  <StatCard
                    anim={statsAnims[0]}
                    icon="leaf"
                    iconColor="#06b6d4"
                    iconBg="rgba(6,182,212,0.18)"
                    value={reportData.totalCows}
                    label="Total Cows"
                  />
                  <StatCard
                    anim={statsAnims[1]}
                    icon="checkmark-circle"
                    iconColor="#22c55e"
                    iconBg="rgba(34,197,94,0.18)"
                    value={reportData.healthyCows}
                    label="Healthy"
                  />
                  <StatCard
                    anim={statsAnims[2]}
                    icon="alert-circle"
                    iconColor="#ef4444"
                    iconBg="rgba(239,68,68,0.18)"
                    value={reportData.sickCows}
                    label="Sick"
                  />
                </View>
                <View style={styles.statsGrid3}>
                  <StatCard
                    anim={statsAnims[3]}
                    icon="medkit"
                    iconColor="#f97316"
                    iconBg="rgba(249,115,22,0.18)"
                    value={reportData.underTreatment}
                    label="Under Treatment"
                  />
                  <StatCard
                    anim={statsAnims[4]}
                    icon="fitness"
                    iconColor="#3b82f6"
                    iconBg="rgba(59,130,246,0.18)"
                    value={reportData.recovering}
                    label="Recovering"
                  />
                  <StatCard
                    anim={statsAnims[5]}
                    icon="thermometer"
                    iconColor="#8b5cf6"
                    iconBg="rgba(139,92,246,0.18)"
                    value={reportData.averageTemperature + "°F"}
                    label="Avg Temp"
                  />
                </View>
              </View>

              {/* Milk Production */}
              <View style={styles.sectionContainer}>
                <Text style={styles.sectionTitle}>
                  {t("reports.milkProduction") || "Milk Production"}
                </Text>
                <View style={styles.statsGrid2}>
                  <StatCard
                    anim={statsAnims[6]}
                    icon="water"
                    iconColor="#a855f7"
                    iconBg="rgba(168,85,247,0.18)"
                    value={reportData.totalMilkProduction + "L"}
                    label="Total Production"
                  />
                  <StatCard
                    anim={statsAnims[7]}
                    icon="analytics"
                    iconColor="#06b6d4"
                    iconBg="rgba(6,182,212,0.18)"
                    value={reportData.averageMilkPerCow + "L"}
                    label="Avg per Cow"
                  />
                </View>
                <View style={styles.statsGrid2}>
                  <StatCard
                    anim={statsAnims[8]}
                    icon="sunny"
                    iconColor="#fbbf24"
                    iconBg="rgba(251,191,36,0.18)"
                    value={reportData.morningMilkTotal + "L"}
                    label="Morning Total"
                  />
                  <StatCard
                    anim={statsAnims[9]}
                    icon="moon"
                    iconColor="#818cf8"
                    iconBg="rgba(129,140,248,0.18)"
                    value={reportData.eveningMilkTotal + "L"}
                    label="Evening Total"
                  />
                </View>

                {/* Best/Worst Producers */}
                <View style={styles.infoCard}>
                  <LinearGradient
                    colors={["rgba(34,197,94,0.15)", "rgba(34,197,94,0.05)"]}
                    style={styles.infoCardGradient}
                  >
                    <View style={styles.infoRow}>
                      <Ionicons name="trophy" size={20} color="#22c55e" />
                      <View style={styles.infoTextContainer}>
                        <Text style={styles.infoLabel}>Best Producer</Text>
                        <Text style={styles.infoValue}>
                          {reportData.bestProducingCow.name} -{" "}
                          {reportData.bestProducingCow.quantity}L
                        </Text>
                      </View>
                    </View>
                  </LinearGradient>
                </View>
              </View>

              {/* Financial Overview */}
              <View style={styles.sectionContainer}>
                <Text style={styles.sectionTitle}>
                  {t("reports.financialOverview") || "Financial Overview"}
                </Text>
                <View style={styles.statsGrid2}>
                  <StatCard
                    anim={statsAnims[10]}
                    icon="calculator"
                    iconColor="#f97316"
                    iconBg="rgba(249,115,22,0.18)"
                    value={"₹" + reportData.totalExpenses}
                    label="Total Expenses"
                  />
                  <StatCard
                    anim={statsAnims[11]}
                    icon="trending-up"
                    iconColor="#06b6d4"
                    iconBg="rgba(6,182,212,0.18)"
                    value={"₹" + reportData.averageExpensePerDay}
                    label="Avg per Day"
                  />
                </View>
                <View style={styles.statsGrid3}>
                  <StatCard
                    anim={statsAnims[0]}
                    icon="fast-food"
                    iconColor="#22c55e"
                    iconBg="rgba(34,197,94,0.18)"
                    value={"₹" + reportData.feedExpenses}
                    label="Feed"
                    small
                  />
                  <StatCard
                    anim={statsAnims[1]}
                    icon="medical"
                    iconColor="#ef4444"
                    iconBg="rgba(239,68,68,0.18)"
                    value={"₹" + reportData.doctorExpenses}
                    label="Medical"
                    small
                  />
                  <StatCard
                    anim={statsAnims[2]}
                    icon="ellipsis-horizontal"
                    iconColor="#8b5cf6"
                    iconBg="rgba(139,92,246,0.18)"
                    value={"₹" + reportData.otherExpenses}
                    label="Other"
                    small
                  />
                </View>
              </View>

              {/* Cows Needing Attention */}
              {reportData.cowsNeedingAttention.length > 0 && (
                <View style={styles.sectionContainer}>
                  <Text style={styles.sectionTitle}>
                    {t("reports.needsAttention") || "Needs Attention"}
                  </Text>
                  {reportData.cowsNeedingAttention.map((cow, index) => (
                    <View key={index} style={styles.listItem}>
                      <LinearGradient
                        colors={[
                          "rgba(239,68,68,0.15)",
                          "rgba(239,68,68,0.05)",
                        ]}
                        style={styles.listItemGradient}
                      >
                        <View style={styles.listItemIcon}>
                          <Ionicons name="warning" size={16} color="#ef4444" />
                        </View>
                        <View style={styles.listItemContent}>
                          <Text style={styles.listItemTitle}>{cow.name}</Text>
                          <Text style={styles.listItemSubtitle}>
                            {cow.status} - {cow.issue}
                          </Text>
                        </View>
                      </LinearGradient>
                    </View>
                  ))}
                </View>
              )}

              {/* Top Performers */}
              {reportData.topPerformers.length > 0 && (
                <View style={styles.sectionContainer}>
                  <Text style={styles.sectionTitle}>
                    {t("reports.topPerformers") || "Top Performers"}
                  </Text>
                  {reportData.topPerformers.map((cow, index) => (
                    <View key={index} style={styles.listItem}>
                      <LinearGradient
                        colors={[
                          "rgba(34,197,94,0.15)",
                          "rgba(34,197,94,0.05)",
                        ]}
                        style={styles.listItemGradient}
                      >
                        <View style={styles.listItemIcon}>
                          <Text style={styles.rankNumber}>#{index + 1}</Text>
                        </View>
                        <View style={styles.listItemContent}>
                          <Text style={styles.listItemTitle}>{cow.name}</Text>
                          <Text style={styles.listItemSubtitle}>
                            {cow.production}L produced
                          </Text>
                        </View>
                      </LinearGradient>
                    </View>
                  ))}
                </View>
              )}

              {/* Breed Distribution */}
              {reportData.breedDistribution.length > 0 && (
                <View style={styles.sectionContainer}>
                  <Text style={styles.sectionTitle}>
                    {t("reports.breedDistribution") || "Breed Distribution"}
                  </Text>
                  {reportData.breedDistribution.map((breed, index) => (
                    <View key={index} style={styles.listItem}>
                      <LinearGradient
                        colors={[
                          "rgba(6,182,212,0.15)",
                          "rgba(6,182,212,0.05)",
                        ]}
                        style={styles.listItemGradient}
                      >
                        <View style={styles.listItemIcon}>
                          <Ionicons name="leaf" size={16} color="#06b6d4" />
                        </View>
                        <View style={styles.listItemContent}>
                          <Text style={styles.listItemTitle}>
                            {breed.breed}
                          </Text>
                          <Text style={styles.listItemSubtitle}>
                            {breed.count} {breed.count === 1 ? "cow" : "cows"}
                          </Text>
                        </View>
                      </LinearGradient>
                    </View>
                  ))}
                </View>
              )}
            </>
          ) : (
            // AI ANALYSIS VIEW
            <View style={styles.aiContainer}>
              <View style={styles.aiHeader}>
                <View style={styles.aiIconBadge}>
                  <Ionicons name="sparkles" size={32} color="#ec4899" />
                </View>
                <Text style={styles.aiTitle}>AI & ML Analytics</Text>
                <Text style={styles.aiSubtitle}>
                  Advanced farm insights powered by Claude AI
                </Text>
              </View>

              {/* PDF Download Button */}
              <TouchableOpacity
                style={styles.pdfDownloadBtn}
                onPress={generatePDFReport}
                disabled={exporting}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={["#06b6d4", "#0891b2"]}
                  style={styles.pdfGradient}
                >
                  {exporting ? (
                    <>
                      <ActivityIndicator size="small" color="#fff" />
                      <Text style={styles.pdfText}>Generating PDF...</Text>
                    </>
                  ) : (
                    <>
                      <Ionicons name="document-text" size={22} color="#fff" />
                      <Text style={styles.pdfText}>
                        Download Complete PDF Report
                      </Text>
                      <Text style={styles.pdfSubtext}>
                        Includes all analytics & AI analysis
                      </Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.analyzeButton}
                onPress={generateAIAnalysis}
                disabled={isAnalyzing}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={["#ec4899", "#db2777"]}
                  style={styles.analyzeGradient}
                >
                  {isAnalyzing ? (
                    <>
                      <ActivityIndicator size="small" color="#fff" />
                      <Text style={styles.analyzeText}>
                        Analyzing Farm Data...
                      </Text>
                    </>
                  ) : (
                    <>
                      <Ionicons name="rocket" size={20} color="#fff" />
                      <Text style={styles.analyzeText}>
                        Generate AI Analysis
                      </Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>

              {aiError ? (
                <View style={styles.errorContainer}>
                  <LinearGradient
                    colors={["rgba(239,68,68,0.15)", "rgba(239,68,68,0.05)"]}
                    style={styles.errorGradient}
                  >
                    <Ionicons name="warning" size={24} color="#ef4444" />
                    <Text style={styles.errorText}>{aiError}</Text>
                  </LinearGradient>
                </View>
              ) : null}

              {aiAnalysis ? (
                <View style={styles.analysisContainer}>
                  <LinearGradient
                    colors={["rgba(236,72,153,0.15)", "rgba(236,72,153,0.05)"]}
                    style={styles.analysisGradient}
                  >
                    <View style={styles.analysisHeader}>
                      <Ionicons
                        name="document-text"
                        size={20}
                        color="#ec4899"
                      />
                      <Text style={styles.analysisHeaderText}>
                        Comprehensive AI Analysis
                      </Text>
                    </View>
                    <Text style={styles.analysisText}>{aiAnalysis}</Text>
                  </LinearGradient>
                </View>
              ) : !isAnalyzing ? (
                <View style={styles.placeholderContainer}>
                  <LinearGradient
                    colors={[
                      "rgba(255,255,255,0.08)",
                      "rgba(255,255,255,0.04)",
                    ]}
                    style={styles.placeholderGradient}
                  >
                    <Ionicons
                      name="bulb-outline"
                      size={48}
                      color="rgba(255,255,255,0.3)"
                    />
                    <Text style={styles.placeholderText}>
                      Tap the button above to generate an AI-powered analysis of
                      your farm data
                    </Text>
                    <Text style={styles.placeholderSubtext}>
                      Get insights on health, production, finances, and
                      actionable recommendations
                    </Text>
                  </LinearGradient>
                </View>
              ) : null}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

// Reusable Stat Card Component
function StatCard({ anim, icon, iconColor, iconBg, value, label, small }) {
  return (
    <Animated.View
      style={[
        small ? styles.statCardSmall : styles.statCard,
        {
          opacity: anim,
          transform: [
            {
              translateY: anim.interpolate({
                inputRange: [0, 1],
                outputRange: [30, 0],
              }),
            },
          ],
        },
      ]}
    >
      <LinearGradient
        colors={["rgba(255,255,255,0.14)", "rgba(255,255,255,0.06)"]}
        style={styles.statCardGradient}
      >
        <View style={[styles.statIconBadge, { backgroundColor: iconBg }]}>
          <Ionicons name={icon} size={small ? 16 : 20} color={iconColor} />
        </View>
        <Text style={small ? styles.statValueSmall : styles.statValue}>
          {value}
        </Text>
        <Text style={styles.statLabel}>{label}</Text>
      </LinearGradient>
    </Animated.View>
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

  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: "rgba(255,255,255,0.6)",
    fontWeight: "500",
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.08)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  headerCenter: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 12,
    gap: 12,
  },
  headerIconBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(6,182,212,0.15)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "rgba(6,182,212,0.2)",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: 0.2,
  },
  headerSubtitle: {
    fontSize: 12,
    color: "rgba(255,255,255,0.5)",
    marginTop: 2,
    fontWeight: "500",
  },
  exportBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(6,182,212,0.12)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(6,182,212,0.2)",
  },

  // View Toggle
  viewToggle: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 24,
  },
  toggleBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.15)",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  toggleBtnActive: {
    borderColor: "#06b6d4",
    backgroundColor: "#06b6d4",
  },
  toggleText: {
    fontSize: 13,
    color: "rgba(255,255,255,0.6)",
    fontWeight: "600",
  },
  toggleTextActive: {
    color: "#fff",
  },

  // Section
  sectionContainer: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#06b6d4",
    marginBottom: 12,
    letterSpacing: 0.3,
  },

  // Stats Grid
  statsGrid2: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
  },
  statsGrid3: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
  },
  statCard: {
    flex: 1,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.09)",
  },
  statCardSmall: {
    flex: 1,
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.09)",
  },
  statCardGradient: {
    padding: 14,
    alignItems: "center",
  },
  statIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
  },
  statValue: {
    fontSize: 22,
    fontWeight: "800",
    color: "#fff",
    marginBottom: 4,
    letterSpacing: -0.5,
    textAlign: "center",
  },
  statValueSmall: {
    fontSize: 18,
    fontWeight: "800",
    color: "#fff",
    marginBottom: 4,
    letterSpacing: -0.5,
    textAlign: "center",
  },
  statLabel: {
    fontSize: 11,
    color: "rgba(255,255,255,0.5)",
    fontWeight: "600",
    letterSpacing: 0.3,
    textAlign: "center",
  },

  // Info Card
  infoCard: {
    borderRadius: 14,
    overflow: "hidden",
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(34,197,94,0.2)",
  },
  infoCardGradient: {
    padding: 14,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  infoTextContainer: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 11,
    color: "rgba(255,255,255,0.6)",
    fontWeight: "600",
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  infoValue: {
    fontSize: 15,
    color: "#fff",
    fontWeight: "700",
  },

  // List Items
  listItem: {
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  listItemGradient: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    gap: 12,
  },
  listItemIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.1)",
    justifyContent: "center",
    alignItems: "center",
  },
  rankNumber: {
    fontSize: 14,
    fontWeight: "800",
    color: "#22c55e",
  },
  listItemContent: {
    flex: 1,
  },
  listItemTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 2,
  },
  listItemSubtitle: {
    fontSize: 12,
    color: "rgba(255,255,255,0.6)",
    fontWeight: "500",
  },

  // AI Container
  aiContainer: {
    flex: 1,
  },
  aiHeader: {
    alignItems: "center",
    marginBottom: 24,
  },
  aiIconBadge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(236,72,153,0.15)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
    borderWidth: 3,
    borderColor: "rgba(236,72,153,0.25)",
  },
  aiTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#fff",
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  aiSubtitle: {
    fontSize: 14,
    color: "rgba(255,255,255,0.6)",
    textAlign: "center",
    fontWeight: "500",
  },

  analyzeButton: {
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 24,
  },
  analyzeGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingVertical: 18,
  },
  analyzeText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
  },

  errorContainer: {
    borderRadius: 14,
    overflow: "hidden",
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.2)",
  },
  errorGradient: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    color: "#ef4444",
    fontWeight: "600",
  },

  analysisContainer: {
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(236,72,153,0.2)",
  },
  analysisGradient: {
    padding: 20,
  },
  analysisHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.1)",
  },
  analysisHeaderText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#ec4899",
  },
  analysisText: {
    fontSize: 14,
    lineHeight: 22,
    color: "rgba(255,255,255,0.9)",
    fontWeight: "500",
  },

  placeholderContainer: {
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  placeholderGradient: {
    padding: 32,
    alignItems: "center",
  },
  placeholderText: {
    fontSize: 15,
    color: "rgba(255,255,255,0.6)",
    textAlign: "center",
    marginTop: 16,
    fontWeight: "600",
  },
  placeholderSubtext: {
    fontSize: 13,
    color: "rgba(255,255,255,0.4)",
    textAlign: "center",
    marginTop: 8,
    fontWeight: "500",
  },

  // PDF Download Button
  pdfDownloadBtn: {
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 24,
    borderWidth: 2,
    borderColor: "rgba(6,182,212,0.3)",
  },
  pdfGradient: {
    paddingVertical: 18,
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  pdfText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
    textAlign: "center",
  },
  pdfSubtext: {
    fontSize: 11,
    color: "rgba(255,255,255,0.8)",
    fontWeight: "500",
    textAlign: "center",
  },
});
