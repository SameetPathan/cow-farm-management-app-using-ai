import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  Dimensions,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

const { width } = Dimensions.get('window');

export default function HomeScreen() {
  const [fadeAnim] = useState(new Animated.Value(0));
  const [slideAnim] = useState(new Animated.Value(30));

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const dashboardItems = [
    {
      id: 1,
      title: 'Cow Registration',
      subtitle: 'Add new cows & QR codes',
      icon: 'add-circle',
      color: '#4CAF50',
      route: '/cow-registration',
    },
    {
      id: 2,
      title: 'Cow Information',
      subtitle: 'View cow details & health',
      icon: 'information-circle',
      color: '#2196F3',
      route: '/cow-info',
    },
    {
      id: 3,
      title: 'Daily Reports',
      subtitle: 'Track daily activities',
      icon: 'document-text',
      color: '#FF9800',
      route: '/daily-reports',
    },
    {
      id: 4,
      title: 'Milk Production',
      subtitle: 'Monitor milk yield',
      icon: 'water',
      color: '#9C27B0',
      route: '/milk-production',
    },
    {
      id: 5,
      title: 'Expenses',
      subtitle: 'Track farm expenses',
      icon: 'calculator',
      color: '#F44336',
      route: '/expenses',
    },
    {
      id: 6,
      title: 'Reports',
      subtitle: 'View analytics & reports',
      icon: 'bar-chart',
      color: '#607D8B',
      route: '/reports',
    },
  ];

  const handleItemPress = (route: string) => {
    // For now, just show an alert since routes don't exist yet
    console.log(`Navigate to: ${route}`);
  };

  const handleLogout = () => {
    router.replace('/login');
  };

  return (
    <SafeAreaView style={styles.container}>
      <Animated.View
        style={[
          styles.content,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View>
              <Text style={styles.greeting}>Good Morning!</Text>
              <Text style={styles.farmName}>Cow Farm Management</Text>
            </View>
            <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
              <Ionicons name="log-out" size={24} color="#F44336" />
            </TouchableOpacity>
          </View>
          
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Ionicons name="leaf" size={24} color="#4CAF50" />
              <Text style={styles.statNumber}>12</Text>
              <Text style={styles.statLabel}>Total Cows</Text>
            </View>
            <View style={styles.statItem}>
              <Ionicons name="water" size={24} color="#2196F3" />
              <Text style={styles.statNumber}>45L</Text>
              <Text style={styles.statLabel}>Today's Milk</Text>
            </View>
            <View style={styles.statItem}>
              <Ionicons name="trending-up" size={24} color="#FF9800" />
              <Text style={styles.statNumber}>₹2,500</Text>
              <Text style={styles.statLabel}>Today's Income</Text>
            </View>
          </View>
        </View>

        {/* Dashboard Grid */}
        <ScrollView style={styles.dashboard} showsVerticalScrollIndicator={false}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.grid}>
            {dashboardItems.map((item, index) => (
              <Animated.View
                key={item.id}
                style={[
                  styles.gridItem,
                  {
                    opacity: fadeAnim,
                    transform: [
                      {
                        translateY: slideAnim.interpolate({
                          inputRange: [0, 30],
                          outputRange: [0, 30 + index * 10],
                        }),
                      },
                    ],
                  },
                ]}
              >
                <TouchableOpacity
                  style={[styles.itemCard, { borderLeftColor: item.color }]}
                  onPress={() => handleItemPress(item.route)}
                >
                  <View style={[styles.iconContainer, { backgroundColor: item.color + '20' }]}>
                    <Ionicons name={item.icon as any} size={28} color={item.color} />
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
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  content: {
    flex: 1,
  },
  header: {
    backgroundColor: 'white',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 30,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  greeting: {
    fontSize: 16,
    color: '#7f8c8d',
    marginBottom: 4,
  },
  farmName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  logoutButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#fff5f5',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#7f8c8d',
    marginTop: 4,
    textAlign: 'center',
  },
  dashboard: {
    flex: 1,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginTop: 20,
    marginBottom: 15,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  gridItem: {
    width: (width - 60) / 2,
    marginBottom: 15,
  },
  itemCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  iconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 4,
  },
  itemSubtitle: {
    fontSize: 12,
    color: '#7f8c8d',
    lineHeight: 16,
  },
});
