require('dotenv').config();

module.exports = {
  expo: {
    name: 'cow-farm-management',
    slug: 'cow-farm-management',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/images/icon.png',
    scheme: 'cowfarmmanagement',
    userInterfaceStyle: 'automatic',
    newArchEnabled: true,
    ios: {
      supportsTablet: true,
    },
    android: {
      package: 'com.cowfarmmanagement.app',
      adaptiveIcon: {
        foregroundImage: './assets/images/adaptive-icon.png',
        backgroundColor: '#ffffff',
      },
      edgeToEdgeEnabled: true,
    },
    web: {
      bundler: 'metro',
      output: 'static',
      favicon: './assets/images/favicon.png',
    },
    plugins: [
      'expo-router',
      [
        'expo-splash-screen',
        {
          image: './assets/images/splash-icon.png',
          imageWidth: 200,
          resizeMode: 'contain',
          backgroundColor: '#ffffff',
        },
      ],
    ],
    experiments: {
      typedRoutes: true,
    },
    extra: {
      router: {},
      eas: {
        projectId: '720e1fe1-e12f-4504-a0a8-0035dcbc2cf2',
      },
      // Environment variables accessible via Constants.expoConfig.extra
      anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
    },
  },
};

