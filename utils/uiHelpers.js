import { Platform, StyleSheet } from 'react-native';

export const getSafeAreaPadding = () => ({
  paddingTop: Platform.OS === 'ios' ? 50 : 20,
  paddingBottom: Platform.OS === 'ios' ? 20 : 10,
});

export const getCardStyle = () => ({
  backgroundColor: 'rgba(255, 255, 255, 0.95)',
  borderRadius: 18,
  padding: 20,
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.15,
  shadowRadius: 8,
  elevation: 5,
  borderWidth: 1,
  borderColor: 'rgba(255, 255, 255, 0.3)',
});

export const getInputStyle = () => ({
  backgroundColor: 'rgba(255, 255, 255, 0.95)',
  borderRadius: 15,
  paddingHorizontal: 18,
  paddingVertical: 16,
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.15,
  shadowRadius: 8,
  elevation: 5,
  borderWidth: 1,
  borderColor: 'rgba(255, 255, 255, 0.3)',
});

export const getButtonStyle = (colors = ['#4CAF50', '#45a049']) => ({
  borderRadius: 15,
  overflow: 'hidden',
  shadowColor: colors[0],
  shadowOffset: { width: 0, height: 6 },
  shadowOpacity: 0.4,
  shadowRadius: 8,
  elevation: 10,
});

export const gradientPresets = {
  primary: ['#667eea', '#764ba2', '#f093fb'],
  green: ['#11998e', '#38ef7d'],
  blue: ['#2196F3', '#21CBF3'],
  purple: ['#667eea', '#764ba2'],
  orange: ['#f093fb', '#f5576c'],
  sunset: ['#fa709a', '#fee140'],
  ocean: ['#00c6ff', '#0072ff'],
  forest: ['#134e5e', '#71b280'],
  warm: ['#fad961', '#f76b1c'],
  red: ['#ef4444', '#dc2626'],
};

