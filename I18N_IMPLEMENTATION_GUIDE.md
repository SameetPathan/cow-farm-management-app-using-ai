# Multi-Language Implementation Guide

## ✅ Completed Implementation

### Core Infrastructure
1. **Translation Files** (`i18n/translations.js`)
   - Complete translations for English, Hindi, and Marathi
   - All common strings, login, register, home, cow registration, cow info, milk production, and expenses screens

2. **Language Context** (`contexts/LanguageContext.js`)
   - Manages language state
   - Persists language preference in AsyncStorage
   - Provides `t()` function for translations
   - Supports parameter replacement in translations

3. **Language Selector Component** (`components/LanguageSelector.js`)
   - Beautiful modal-based language selector
   - Shows current language
   - Easy to integrate in any screen

4. **Layout Integration** (`app/_layout.js`)
   - LanguageProvider wraps entire app
   - Available to all screens

### Updated Screens
1. ✅ **Login Screen** (`app/login.js`)
   - All text translated
   - Language selector in top-right corner
   - All Alert messages translated

2. ✅ **Register Screen** (`app/register.js`)
   - All text translated
   - Language selector in top-right corner
   - All Alert messages translated

3. ✅ **Home Screen** (`app/home.js`)
   - All text translated
   - Language selector in top-right corner
   - Dashboard items translated
   - Stats labels translated

## 📋 Remaining Screens to Update

### Pattern for Updating Screens

For each remaining screen, follow this pattern:

1. **Import the hooks and component:**
```javascript
import { useLanguage } from '../contexts/LanguageContext';
import LanguageSelector from '../components/LanguageSelector';
```

2. **Add the hook in the component:**
```javascript
export default function YourScreen() {
  const { t } = useLanguage();
  // ... rest of your code
}
```

3. **Add LanguageSelector to the UI:**
```javascript
<SafeAreaView style={styles.container}>
  <View style={styles.languageSelectorContainer}>
    <LanguageSelector />
  </View>
  {/* ... rest of your UI */}
</SafeAreaView>
```

4. **Add style for language selector:**
```javascript
languageSelectorContainer: {
  position: 'absolute',
  top: 10,
  right: 20,
  zIndex: 1000,
},
```

5. **Replace all text strings:**
   - Replace `'Text'` with `t('key.path')`
   - Replace Alert messages: `Alert.alert(t('common.error'), t('screen.message'))`
   - Replace placeholders: `placeholder={t('screen.placeholder')}`

### Screens to Update

1. **cow-registration.js**
   - Replace all Alert messages
   - Replace all Text components
   - Replace all placeholders
   - Add LanguageSelector

2. **cow-info.js**
   - Replace all Alert messages
   - Replace all Text components
   - Replace all placeholders
   - Replace tab labels
   - Add LanguageSelector

3. **milk-production.js**
   - Replace all Alert messages
   - Replace all Text components
   - Replace all placeholders
   - Replace session labels (Morning/Evening)
   - Replace quality labels
   - Add LanguageSelector

4. **expenses.js**
   - Replace all Alert messages
   - Replace all Text components
   - Replace all placeholders
   - Add LanguageSelector

5. **daily-reports.jsx** (if exists)
   - Replace all text
   - Add LanguageSelector

6. **chatbot.js** (if exists)
   - Replace all text
   - Add LanguageSelector

## 🔑 Translation Keys Reference

### Common Keys
- `common.loading`, `common.save`, `common.cancel`, `common.confirm`, `common.close`, `common.back`, `common.search`, `common.select`, `common.today`, `common.prev`, `common.next`, `common.or`, `common.ok`, `common.error`, `common.success`

### Screen-Specific Keys
All keys follow the pattern: `screenName.keyName`

Examples:
- `login.title`, `login.phoneNumber`, `login.password`
- `home.farmOverview`, `home.totalCows`, `home.todayMilk`
- `cowRegistration.title`, `cowRegistration.cowName`
- `milkProduction.morning`, `milkProduction.evening`
- `expenses.foodIntakeFees`, `expenses.doctorFees`

## 📝 Example: Updating a Screen

Here's a complete example for updating `cow-registration.js`:

```javascript
// 1. Add imports
import { useLanguage } from '../contexts/LanguageContext';
import LanguageSelector from '../components/LanguageSelector';

// 2. Add hook
export default function CowRegistrationScreen() {
  const { t } = useLanguage();
  // ... existing code

  // 3. Replace Alert messages
  Alert.alert(t('common.error'), t('cowRegistration.enterCowName'));

  // 4. Replace Text components
  <Text style={styles.title}>{t('cowRegistration.title')}</Text>

  // 5. Replace placeholders
  <TextInput placeholder={t('cowRegistration.cowName')} />

  // 6. Add LanguageSelector in JSX
  <SafeAreaView style={styles.container}>
    <View style={styles.languageSelectorContainer}>
      <LanguageSelector />
    </View>
    {/* ... rest of UI */}
  </SafeAreaView>

  // 7. Add style
  languageSelectorContainer: {
    position: 'absolute',
    top: 10,
    right: 20,
    zIndex: 1000,
  },
}
```

## 🎯 Quick Checklist for Each Screen

- [ ] Import `useLanguage` and `LanguageSelector`
- [ ] Add `const { t } = useLanguage();` in component
- [ ] Add `<LanguageSelector />` in top-right corner
- [ ] Replace all `Text` components with `t()` calls
- [ ] Replace all `placeholder` props with `t()` calls
- [ ] Replace all `Alert.alert()` messages with `t()` calls
- [ ] Add `languageSelectorContainer` style
- [ ] Test language switching works

## 🌐 Language Support

The app now supports:
- **English (en)** - Default
- **Hindi (hi)** - हिंदी
- **Marathi (mr)** - मराठी

Language preference is saved in AsyncStorage and persists across app restarts.

## 🚀 Testing

1. Test language switching on each screen
2. Verify all text changes when language is switched
3. Check that language preference persists after app restart
4. Test on different screen sizes to ensure LanguageSelector is visible

