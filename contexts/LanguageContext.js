import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { translations } from '../i18n/translations';

const LanguageContext = createContext();

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};

export const LanguageProvider = ({ children }) => {
  const [language, setLanguage] = useState('en');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadLanguage();
  }, []);

  const loadLanguage = async () => {
    try {
      const savedLanguage = await AsyncStorage.getItem('appLanguage');
      if (savedLanguage && ['en', 'hi', 'mr'].includes(savedLanguage)) {
        setLanguage(savedLanguage);
      }
    } catch (error) {
      console.error('Error loading language:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const changeLanguage = async (lang) => {
    try {
      if (['en', 'hi', 'mr'].includes(lang)) {
        setLanguage(lang);
        await AsyncStorage.setItem('appLanguage', lang);
      }
    } catch (error) {
      console.error('Error saving language:', error);
    }
  };

  const t = (key, params = {}) => {
    const keys = key.split('.');
    let value = translations[language];
    
    for (const k of keys) {
      if (value && value[k]) {
        value = value[k];
      } else {
        // Fallback to English if translation not found
        value = translations.en;
        for (const k2 of keys) {
          if (value && value[k2]) {
            value = value[k2];
          } else {
            return key; // Return key if translation not found
          }
        }
        break;
      }
    }
    
    // Replace parameters in the translation string
    if (typeof value === 'string' && Object.keys(params).length > 0) {
      return value.replace(/\{(\w+)\}/g, (match, key) => {
        return params[key] !== undefined ? params[key] : match;
      });
    }
    
    return typeof value === 'string' ? value : key;
  };

  return (
    <LanguageContext.Provider value={{ language, changeLanguage, t, isLoading }}>
      {children}
    </LanguageContext.Provider>
  );
};

