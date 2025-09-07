import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  SafeAreaView,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// Mock data for cows
const mockCows = [
  {
    id: '1',
    name: 'Bella',
    breed: 'Holstein',
    age: '3 years',
    weight: '450 kg',
    milkYield: '25L/day',
    healthStatus: 'Healthy',
    lastVaccination: '2024-01-15',
  },
  {
    id: '2',
    name: 'Daisy',
    breed: 'Jersey',
    age: '2 years',
    weight: '380 kg',
    milkYield: '18L/day',
    healthStatus: 'Healthy',
    lastVaccination: '2024-01-10',
  },
  {
    id: '3',
    name: 'Molly',
    breed: 'Holstein',
    age: '4 years',
    weight: '520 kg',
    milkYield: '30L/day',
    healthStatus: 'Under Treatment',
    lastVaccination: '2024-01-05',
  },
  {
    id: '4',
    name: 'Luna',
    breed: 'Brown Swiss',
    age: '2.5 years',
    weight: '420 kg',
    milkYield: '22L/day',
    healthStatus: 'Healthy',
    lastVaccination: '2024-01-12',
  },
];

export default function CowsScreen() {
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

  const getHealthStatusColor = (status: string) => {
    switch (status) {
      case 'Healthy':
        return '#4CAF50';
      case 'Under Treatment':
        return '#FF9800';
      case 'Sick':
        return '#F44336';
      default:
        return '#9E9E9E';
    }
  };

  const renderCowItem = ({ item, index }: { item: any; index: number }) => (
    <Animated.View
      style={[
        styles.cowCard,
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
      <View style={styles.cowHeader}>
        <View style={styles.cowInfo}>
          <Text style={styles.cowName}>{item.name}</Text>
          <Text style={styles.cowBreed}>{item.breed}</Text>
        </View>
        <View style={[styles.healthIndicator, { backgroundColor: getHealthStatusColor(item.healthStatus) }]}>
          <Text style={styles.healthText}>{item.healthStatus}</Text>
        </View>
      </View>
      
      <View style={styles.cowDetails}>
        <View style={styles.detailRow}>
          <Ionicons name="calendar" size={16} color="#666" />
          <Text style={styles.detailText}>Age: {item.age}</Text>
        </View>
        <View style={styles.detailRow}>
          <Ionicons name="fitness" size={16} color="#666" />
          <Text style={styles.detailText}>Weight: {item.weight}</Text>
        </View>
        <View style={styles.detailRow}>
          <Ionicons name="water" size={16} color="#666" />
          <Text style={styles.detailText}>Milk: {item.milkYield}</Text>
        </View>
        <View style={styles.detailRow}>
          <Ionicons name="medical" size={16} color="#666" />
          <Text style={styles.detailText}>Last Vaccine: {item.lastVaccination}</Text>
        </View>
      </View>

      <View style={styles.cowActions}>
        <TouchableOpacity style={styles.actionButton}>
          <Ionicons name="eye" size={16} color="#2196F3" />
          <Text style={styles.actionText}>View Details</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton}>
          <Ionicons name="qr-code" size={16} color="#4CAF50" />
          <Text style={styles.actionText}>Scan QR</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton}>
          <Ionicons name="create" size={16} color="#FF9800" />
          <Text style={styles.actionText}>Edit</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );

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
          <Text style={styles.title}>My Cows</Text>
          <TouchableOpacity style={styles.addButton}>
            <Ionicons name="add" size={24} color="white" />
          </TouchableOpacity>
        </View>

        {/* Stats */}
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Ionicons name="leaf" size={24} color="#4CAF50" />
            <Text style={styles.statNumber}>{mockCows.length}</Text>
            <Text style={styles.statLabel}>Total Cows</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
            <Text style={styles.statNumber}>{mockCows.filter(cow => cow.healthStatus === 'Healthy').length}</Text>
            <Text style={styles.statLabel}>Healthy</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="warning" size={24} color="#FF9800" />
            <Text style={styles.statNumber}>{mockCows.filter(cow => cow.healthStatus === 'Under Treatment').length}</Text>
            <Text style={styles.statLabel}>Under Treatment</Text>
          </View>
        </View>

        {/* Cows List */}
        <FlatList
          data={mockCows}
          renderItem={renderCowItem}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContainer}
        />
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 20,
    backgroundColor: 'white',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  addButton: {
    backgroundColor: '#4CAF50',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: 'white',
    marginBottom: 10,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
  },
  statNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginTop: 5,
  },
  statLabel: {
    fontSize: 12,
    color: '#7f8c8d',
    marginTop: 2,
    textAlign: 'center',
  },
  listContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  cowCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  cowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  cowInfo: {
    flex: 1,
  },
  cowName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 2,
  },
  cowBreed: {
    fontSize: 14,
    color: '#7f8c8d',
  },
  healthIndicator: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
  },
  healthText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  cowDetails: {
    marginBottom: 15,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  detailText: {
    marginLeft: 10,
    fontSize: 14,
    color: '#2c3e50',
  },
  cowActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 15,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#f8f9fa',
  },
  actionText: {
    marginLeft: 5,
    fontSize: 12,
    color: '#2c3e50',
  },
});
