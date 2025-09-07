import { useEffect } from 'react';
import { router } from 'expo-router';

export default function IndexScreen() {
  useEffect(() => {
    // Redirect to landing screen on app start
    router.replace('/landing');
  }, []);

  return null;
}
