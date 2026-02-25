import React from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

export default function GradientBackground({ children, style, colors }) {
  const defaultColors = colors || ['#667eea', '#764ba2', '#f093fb'];
  
  return (
    <LinearGradient
      colors={defaultColors}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[StyleSheet.absoluteFillObject, style]}
    >
      {children}
    </LinearGradient>
  );
}

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
};

