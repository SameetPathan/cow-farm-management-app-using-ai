import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  SafeAreaView,
  ScrollView,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

const { width, height } = Dimensions.get('window');

export default function LandingScreen() {
  const [fadeAnim] = useState(new Animated.Value(0));
  const [slideAnim] = useState(new Animated.Value(50));
  const [scaleAnim] = useState(new Animated.Value(0.8));

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1200,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const features = [
    {
      icon: 'qr-code',
      title: 'QR Code Management',
      description: 'Generate and scan QR codes for each cow',
      color: '#4CAF50',
    },
    {
      icon: 'analytics',
      title: 'AI-Powered Analytics',
      description: 'Smart insights and automated reports',
      color: '#2196F3',
    },
    {
      icon: 'water',
      title: 'Milk Production Tracking',
      description: 'Monitor daily milk yield and quality',
      color: '#9C27B0',
    },
    {
      icon: 'medical',
      title: 'Health Monitoring',
      description: 'Track vaccinations and health records',
      color: '#FF9800',
    },
    {
      icon: 'calculator',
      title: 'Expense Management',
      description: 'Track costs and calculate profits',
      color: '#F44336',
    },
    {
      icon: 'document-text',
      title: 'Automated Reports',
      description: 'Generate comprehensive farm reports',
      color: '#607D8B',
    },
  ];

  const handleGetStarted = () => {
    router.push('/login');
  };

  const handleRegister = () => {
    router.push('/register');
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          style={[
            styles.content,
            {
              opacity: fadeAnim,
              transform: [
                { translateY: slideAnim },
                { scale: scaleAnim },
              ],
            },
          ]}
        >
          {/* Header Section */}
          <View style={styles.header}>
            <Animated.View
              style={[
                styles.logoContainer,
                {
                  transform: [
                    {
                      scale: scaleAnim.interpolate({
                        inputRange: [0.8, 1],
                        outputRange: [0.8, 1],
                      }),
                    },
                  ],
                },
              ]}
            >
              <View style={styles.logoCircle}>
                <Ionicons name="leaf" size={60} color="#4CAF50" />
              </View>
            </Animated.View>
            
            <Text style={styles.appTitle}>Cow Farm Management</Text>
            <Text style={styles.appSubtitle}>
              Revolutionize your dairy farm with AI-powered management
            </Text>
          </View>

          {/* Features Section */}
          <View style={styles.featuresSection}>
            <Text style={styles.sectionTitle}>Why Choose Our App?</Text>
            <Text style={styles.sectionSubtitle}>
              Everything you need to manage your dairy farm efficiently
            </Text>
            
            <View style={styles.featuresGrid}>
              {features.map((feature, index) => (
                <Animated.View
                  key={index}
                  style={[
                    styles.featureCard,
                    {
                      opacity: fadeAnim,
                      transform: [
                        {
                          translateY: slideAnim.interpolate({
                            inputRange: [0, 50],
                            outputRange: [0, 50 + index * 20],
                          }),
                        },
                      ],
                    },
                  ]}
                >
                  <View style={[styles.featureIcon, { backgroundColor: feature.color + '20' }]}>
                    <Ionicons name={feature.icon as any} size={24} color={feature.color} />
                  </View>
                  <Text style={styles.featureTitle}>{feature.title}</Text>
                  <Text style={styles.featureDescription}>{feature.description}</Text>
                </Animated.View>
              ))}
            </View>
          </View>

          {/* Stats Section */}
          <View style={styles.statsSection}>
            <Text style={styles.statsTitle}>Trusted by Farmers</Text>
            <View style={styles.statsContainer}>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>500+</Text>
                <Text style={styles.statLabel}>Active Farms</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>10K+</Text>
                <Text style={styles.statLabel}>Cows Managed</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>95%</Text>
                <Text style={styles.statLabel}>User Satisfaction</Text>
              </View>
            </View>
          </View>

          {/* CTA Section */}
          <View style={styles.ctaSection}>
            <Text style={styles.ctaTitle}>Ready to Transform Your Farm?</Text>
            <Text style={styles.ctaSubtitle}>
              Join thousands of farmers who have revolutionized their dairy management
            </Text>
            
            <View style={styles.buttonContainer}>
              <TouchableOpacity style={styles.primaryButton} onPress={handleGetStarted}>
                <Text style={styles.primaryButtonText}>Get Started</Text>
                <Ionicons name="arrow-forward" size={20} color="white" />
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.secondaryButton} onPress={handleRegister}>
                <Text style={styles.secondaryButtonText}>Create Account</Text>
                <Ionicons name="person-add" size={20} color="#4CAF50" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              © 2024 Cow Farm Management. All rights reserved.
            </Text>
            <Text style={styles.footerSubtext}>
              Powered by AI & Machine Learning
            </Text>
          </View>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  header: {
    alignItems: 'center',
    paddingTop: 40,
    paddingBottom: 40,
  },
  logoContainer: {
    marginBottom: 20,
  },
  logoCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#e8f5e8',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#4CAF50',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 10,
  },
  appTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#2c3e50',
    textAlign: 'center',
    marginBottom: 10,
  },
  appSubtitle: {
    fontSize: 16,
    color: '#7f8c8d',
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 20,
  },
  featuresSection: {
    paddingVertical: 30,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2c3e50',
    textAlign: 'center',
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#7f8c8d',
    textAlign: 'center',
    marginBottom: 30,
    paddingHorizontal: 20,
  },
  featuresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  featureCard: {
    width: (width - 60) / 2,
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  featureIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  featureTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2c3e50',
    textAlign: 'center',
    marginBottom: 8,
  },
  featureDescription: {
    fontSize: 12,
    color: '#7f8c8d',
    textAlign: 'center',
    lineHeight: 16,
  },
  statsSection: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 30,
    marginVertical: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  statsTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2c3e50',
    textAlign: 'center',
    marginBottom: 20,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#7f8c8d',
    textAlign: 'center',
  },
  ctaSection: {
    paddingVertical: 30,
    alignItems: 'center',
  },
  ctaTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2c3e50',
    textAlign: 'center',
    marginBottom: 10,
  },
  ctaSubtitle: {
    fontSize: 14,
    color: '#7f8c8d',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 30,
    paddingHorizontal: 20,
  },
  buttonContainer: {
    width: '100%',
    gap: 15,
  },
  primaryButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 16,
    paddingVertical: 18,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#4CAF50',
    shadowOffset: {
      width: 0,
      height: 6,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  primaryButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginRight: 10,
  },
  secondaryButton: {
    backgroundColor: 'white',
    borderRadius: 16,
    paddingVertical: 18,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#4CAF50',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  secondaryButtonText: {
    color: '#4CAF50',
    fontSize: 18,
    fontWeight: 'bold',
    marginRight: 10,
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 30,
    paddingBottom: 40,
  },
  footerText: {
    fontSize: 12,
    color: '#7f8c8d',
    textAlign: 'center',
    marginBottom: 4,
  },
  footerSubtext: {
    fontSize: 10,
    color: '#bdc3c7',
    textAlign: 'center',
  },
});
