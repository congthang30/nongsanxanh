import { ExpoConfig, ConfigContext } from 'expo/config';

/**
 * App config cho NongSan Xanh mobile (Customer + Shipper).
 * API base URL doc tu EXPO_PUBLIC_API_BASE_URL (xem .env / app.config env).
 */
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'NongSan Xanh',
  slug: 'nongsanxanh-mobile',
  scheme: 'nongsanxanh',
  version: '0.1.0',
  orientation: 'portrait',
  userInterfaceStyle: 'light',
  newArchEnabled: true,
  splash: {
    backgroundColor: '#1f8a4c',
    resizeMode: 'contain',
  },
  assetBundlePatterns: ['**/*'],
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.nongsanxanh.mobile',
    config: {
      googleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY,
    },
    infoPlist: {
      NSLocationWhenInUseUsageDescription:
        'NongSan Xanh dung vi tri cua ban de tim cua hang gan nhat va ho tro shipper chi duong.',
      LSApplicationQueriesSchemes: ['comgooglemaps', 'maps'],
    },
  },
  android: {
    package: 'com.nongsanxanh.mobile',
    adaptiveIcon: {
      backgroundColor: '#1f8a4c',
    },
    permissions: [
      'ACCESS_COARSE_LOCATION',
      'ACCESS_FINE_LOCATION',
      'INTERNET',
      'POST_NOTIFICATIONS',
    ],
    config: {
      googleMaps: {
        apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY,
      },
    },
  },
  plugins: [
    'expo-router',
    'expo-secure-store',
    [
      'expo-location',
      {
        locationWhenInUsePermission:
          'NongSan Xanh dung vi tri cua ban de tim cua hang gan nhat va ho tro shipper chi duong.',
      },
    ],
    [
      'expo-notifications',
      {
        // icon/color mac dinh; backend push chua san sang (xem lib/notifications)
      },
    ],
  ],
  extra: {
    apiBaseUrl:
      process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:3000/api/v1',
    mapProvider: process.env.EXPO_PUBLIC_MAP_PROVIDER ?? 'google',
  },
});
