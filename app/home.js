import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { get, ref } from 'firebase/database';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Platform,
  RefreshControl,
  StatusBar as RNStatusBar,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { database } from '../firebaseConfig';

const { width } = Dimensions.get('window');
const ANDROID_STATUS_BAR = Platform.OS === 'android' ? (RNStatusBar.currentHeight || 0) : 0;

export default function HomeScreen() {
  const [fadeAnim] = useState(new Animated.Value(0));
  const [slideAnim] = useState(new Animated.Value(30));
  const [userPhone, setUserPhone] = useState('');
  const [userName, setUserName] = useState('User');
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Dashboard Stats
  const [stats, setStats] = useState({
    totalCows: 0,
    todayMilk: 0,
    healthyCows: 0,
    sickCows: 0,
    todayExpenses: 0,
    monthlyIncome: 0
  });

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 800, useNativeDriver: true }),
    ]).start();
    
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      const phone = await AsyncStorage.getItem('userPhone');
      const name = await AsyncStorage.getItem('userName');
      
      if (phone) {
        setUserPhone(phone);
        setUserName(name || 'User');
        await fetchDashboardData(phone);
      } else {
        router.replace('/login');
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchDashboardData = async (phone) => {
    try {
      // Fetch all cows for this user
      const cowsRef = ref(database, 'CowFarm/cows');
      const cowsSnapshot = await get(cowsRef);
      
      let totalCows = 0;
      let userCows = [];
      
      if (cowsSnapshot.exists()) {
        const allCows = cowsSnapshot.val();
        userCows = Object.entries(allCows).filter(([id, cow]) => 
          cow.userPhoneNumber === phone
        );
        totalCows = userCows.length;
      }

      // Fetch today's milk production
      const today = new Date();
      const dateKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      
      let todayMilk = 0;
      for (const [cowId] of userCows) {
        const milkRef = ref(database, `CowFarm/milkProduction/${cowId}/${dateKey}`);
        const milkSnapshot = await get(milkRef);
        
        if (milkSnapshot.exists()) {
          const milkData = milkSnapshot.val();
          const morning = parseFloat(milkData.morning?.milkQuantity || 0);
          const evening = parseFloat(milkData.evening?.milkQuantity || 0);
          todayMilk += morning + evening;
        }
      }

      // Fetch today's health reports
      let healthyCows = 0;
      let sickCows = 0;
      
      for (const [cowId] of userCows) {
        const healthRef = ref(database, `CowFarm/healthReports/${cowId}/${dateKey}`);
        const healthSnapshot = await get(healthRef);
        
        if (healthSnapshot.exists()) {
          const healthData = healthSnapshot.val();
          if (healthData.healthStatus === 'Healthy') {
            healthyCows++;
          } else if (healthData.healthStatus === 'Sick' || healthData.healthStatus === 'Under Treatment') {
            sickCows++;
          }
        }
      }

      // Fetch today's expenses
      const expensesRef = ref(database, `CowFarm/expenses/${phone}/${dateKey}`);
      const expensesSnapshot = await get(expensesRef);
      
      let todayExpenses = 0;
      if (expensesSnapshot.exists()) {
        const expenseData = expensesSnapshot.val();
        const feed = parseFloat(expenseData.feed || 0);
        const doctor = parseFloat(expenseData.doctor || 0);
        const other = parseFloat(expenseData.other || 0);
        todayExpenses = feed + doctor + other;
      }

      // Calculate monthly income (milk price assumed ₹60/liter)
      const monthlyIncome = await calculateMonthlyIncome(userCows, phone);

      setStats({
        totalCows,
        todayMilk: todayMilk.toFixed(1),
        healthyCows,
        sickCows,
        todayExpenses: todayExpenses.toFixed(2),
        monthlyIncome: monthlyIncome.toFixed(2)
      });
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    }
  };

  const calculateMonthlyIncome = async (userCows, phone) => {
    try {
      const today = new Date();
      const currentMonth = today.getMonth();
      const currentYear = today.getFullYear();
      
      let totalMilk = 0;
      let totalExpenses = 0;

      // Get all days in current month
      const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
      
      for (let day = 1; day <= today.getDate(); day++) {
        const dateKey = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        
        // Sum milk production
        for (const [cowId] of userCows) {
          const milkRef = ref(database, `CowFarm/milkProduction/${cowId}/${dateKey}`);
          const milkSnapshot = await get(milkRef);
          
          if (milkSnapshot.exists()) {
            const milkData = milkSnapshot.val();
            const morning = parseFloat(milkData.morning?.milkQuantity || 0);
            const evening = parseFloat(milkData.evening?.milkQuantity || 0);
            totalMilk += morning + evening;
          }
        }

        // Sum expenses
        const expensesRef = ref(database, `CowFarm/expenses/${phone}/${dateKey}`);
        const expensesSnapshot = await get(expensesRef);
        
        if (expensesSnapshot.exists()) {
          const expenseData = expensesSnapshot.val();
          const feed = parseFloat(expenseData.feed || 0);
          const doctor = parseFloat(expenseData.doctor || 0);
          const other = parseFloat(expenseData.other || 0);
          totalExpenses += feed + doctor + other;
        }
      }

      // Calculate net income (milk @ ₹60/liter - expenses)
      const milkIncome = totalMilk * 60;
      return milkIncome - totalExpenses;
    } catch (error) {
      console.error('Error calculating monthly income:', error);
      return 0;
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchDashboardData(userPhone);
    setRefreshing(false);
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  const dashboardItems = [
    { id: 1, title: 'Cow Registration', subtitle: 'Add new cows & QR codes', icon: 'add-circle', color: '#4CAF50', route: '/cow-registration' },
    { id: 2, title: 'Cow Information', subtitle: 'View cow details & health', icon: 'information-circle', color: '#2196F3', route: '/cow-info' },
    { id: 3, title: 'Daily Reports', subtitle: 'Track daily health', icon: 'document-text', color: '#ef4444', route: '/daily-reports' },
    { id: 4, title: 'Milk Production', subtitle: 'Monitor milk yield', icon: 'water', color: '#9C27B0', route: '/milk-production' },
    { id: 5, title: 'Expenses', subtitle: 'Track farm expenses', icon: 'calculator', color: '#FF9800', route: '/expenses' },
    { id: 6, title: 'Reports', subtitle: 'View analytics', icon: 'bar-chart', color: '#607D8B', route: '/reports' },
    { id: 7, title: 'AI Assistant', subtitle: 'Get help & advice', icon: 'chatbubbles', color: '#9333ea', route: '/chatbot' },
  ];

  const handleItemPress = (route) => {
    router.push(route);
  };

  const handleLogout = async () => {
    try {
      await AsyncStorage.removeItem('userPhone');
      await AsyncStorage.removeItem('userName');
      router.replace('/login');
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4CAF50" />
          <Text style={styles.loadingText}>Loading Dashboard...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Animated.View style={[styles.content, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View style={styles.headerLeft}>
              <View style={styles.avatarContainer}>
                <Ionicons name="person" size={24} color="#4CAF50" />
              </View>
              <View>
                <Text style={styles.greeting}>{getGreeting()}!</Text>
                <Text style={styles.farmName}>{userName}</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
              <Ionicons name="log-out-outline" size={24} color="#F44336" />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView
          style={styles.dashboard}
          contentContainerStyle={styles.dashboardContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#4CAF50']} />
          }
        >
          {/* Stats Overview */}
          <View style={styles.statsSection}>
            <Text style={styles.sectionTitle}>Farm Overview</Text>
            
            <View style={styles.statsGrid}>
              {/* Total Cows */}
              <View style={[styles.statCard, { backgroundColor: '#e8f5e8' }]}>
                <View style={styles.statIconContainer}>
                  <Ionicons name="leaf" size={24} color="#4CAF50" />
                </View>
                <Text style={styles.statNumber}>{stats.totalCows}</Text>
                <Text style={styles.statLabel}>Total Cows</Text>
              </View>

              {/* Today's Milk */}
              <View style={[styles.statCard, { backgroundColor: '#e3f2fd' }]}>
                <View style={styles.statIconContainer}>
                  <Ionicons name="water" size={24} color="#2196F3" />
                </View>
                <Text style={styles.statNumber}>{stats.todayMilk}L</Text>
                <Text style={styles.statLabel}>Today's Milk</Text>
              </View>

              {/* Healthy Cows */}
              <View style={[styles.statCard, { backgroundColor: '#f1f8e9' }]}>
                <View style={styles.statIconContainer}>
                  <Ionicons name="heart" size={24} color="#8BC34A" />
                </View>
                <Text style={styles.statNumber}>{stats.healthyCows}</Text>
                <Text style={styles.statLabel}>Healthy</Text>
              </View>

              {/* Sick Cows */}
              <View style={[styles.statCard, { backgroundColor: '#ffebee' }]}>
                <View style={styles.statIconContainer}>
                  <Ionicons name="medkit" size={24} color="#F44336" />
                </View>
                <Text style={styles.statNumber}>{stats.sickCows}</Text>
                <Text style={styles.statLabel}>Need Care</Text>
              </View>
            </View>

            {/* Financial Cards */}
            <View style={styles.financialSection}>
              <View style={styles.financialCard}>
                <View style={styles.financialHeader}>
                  <Ionicons name="trending-up" size={24} color="#4CAF50" />
                  <Text style={styles.financialLabel}>Monthly Income</Text>
                </View>
                <Text style={[styles.financialAmount, { color: '#4CAF50' }]}>₹{stats.monthlyIncome}</Text>
                <Text style={styles.financialSubtext}>Net profit this month</Text>
              </View>

              <View style={styles.financialCard}>
                <View style={styles.financialHeader}>
                  <Ionicons name="cash-outline" size={24} color="#FF9800" />
                  <Text style={styles.financialLabel}>Today's Expenses</Text>
                </View>
                <Text style={[styles.financialAmount, { color: '#FF9800' }]}>₹{stats.todayExpenses}</Text>
                <Text style={styles.financialSubtext}>Feed, medical & others</Text>
              </View>
            </View>
          </View>

          {/* Quick Actions */}
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.grid}>
            {dashboardItems.map((item) => (
              <Animated.View 
                key={item.id} 
                style={[styles.gridItem, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}
              >
                <TouchableOpacity 
                  style={[styles.itemCard, { borderLeftColor: item.color }]} 
                  onPress={() => handleItemPress(item.route)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.iconContainer, { backgroundColor: item.color + '20' }]}>
                    <Ionicons name={item.icon} size={28} color={item.color} />
                  </View>
                  <Text style={styles.itemTitle}>{item.title}</Text>
                  <Text style={styles.itemSubtitle}>{item.subtitle}</Text>
                </TouchableOpacity>
              </Animated.View>
            ))}
          </View>
        </ScrollView>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  content: { flex: 1 },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#7f8c8d',
  },
  header: {
    backgroundColor: 'white',
    paddingHorizontal: 20,
    paddingTop: 20 + ANDROID_STATUS_BAR,
    paddingBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  headerTop: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#e8f5e8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  greeting: { 
    fontSize: 14, 
    color: '#7f8c8d', 
    marginBottom: 2 
  },
  farmName: { 
    fontSize: 20, 
    fontWeight: 'bold', 
    color: '#2c3e50' 
  },
  logoutButton: { 
    padding: 8, 
    borderRadius: 8, 
    backgroundColor: '#fff5f5' 
  },
  dashboard: { 
    flex: 1, 
    paddingHorizontal: 20 
  },
  dashboardContent: { 
    paddingBottom: 24, 
    paddingTop: 20 
  },
  statsSection: {
    marginBottom: 24,
  },
  sectionTitle: { 
    fontSize: 20, 
    fontWeight: 'bold', 
    color: '#2c3e50', 
    marginBottom: 16 
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    width: (width - 64) / 2,
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  statIconContainer: {
    marginBottom: 8,
  },
  statNumber: { 
    fontSize: 28, 
    fontWeight: 'bold', 
    color: '#2c3e50', 
    marginBottom: 4 
  },
  statLabel: { 
    fontSize: 13, 
    color: '#7f8c8d', 
    textAlign: 'center',
    fontWeight: '500'
  },
  financialSection: {
    gap: 12,
  },
  financialCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  financialHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  financialLabel: {
    fontSize: 14,
    color: '#7f8c8d',
    fontWeight: '600',
  },
  financialAmount: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  financialSubtext: {
    fontSize: 12,
    color: '#95a5a6',
  },
  grid: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    gap: 12 
  },
  gridItem: { 
    width: (width - 52) / 2 
  },
  itemCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    minHeight: 140,
  },
  iconContainer: { 
    width: 50, 
    height: 50, 
    borderRadius: 25, 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginBottom: 12 
  },
  itemTitle: { 
    fontSize: 15, 
    fontWeight: 'bold', 
    color: '#2c3e50', 
    marginBottom: 4 
  },
  itemSubtitle: { 
    fontSize: 12, 
    color: '#7f8c8d', 
    lineHeight: 16 
  },
});