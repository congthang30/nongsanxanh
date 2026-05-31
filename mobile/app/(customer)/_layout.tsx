import React from 'react';
import { Tabs, router } from 'expo-router';
import { Text } from 'react-native';
import { useAuthStore } from '../../src/store/auth.store';
import { colors } from '../../src/theme';

/** Icon don gian bang emoji de khong them dependency icon. */
function tabIcon(emoji: string) {
  return ({ color }: { color: string }) => (
    <Text style={{ fontSize: 20, color }}>{emoji}</Text>
  );
}

export default function CustomerLayout() {
  const user = useAuthStore((s) => s.user);
  const initializing = useAuthStore((s) => s.initializing);

  // Bao ve route: chua login -> ve auth.
  React.useEffect(() => {
    if (!initializing && !user) {
      router.replace('/(auth)/login');
    }
  }, [user, initializing]);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { height: 60, paddingBottom: 8, paddingTop: 6 },
      }}
    >
      <Tabs.Screen name="home" options={{ title: 'Trang chu', tabBarIcon: tabIcon('🏠') }} />
      <Tabs.Screen name="products" options={{ title: 'San pham', tabBarIcon: tabIcon('🛒') }} />
      <Tabs.Screen name="cart" options={{ title: 'Gio hang', tabBarIcon: tabIcon('🧺') }} />
      <Tabs.Screen name="orders" options={{ title: 'Don hang', tabBarIcon: tabIcon('📦') }} />
      <Tabs.Screen name="account" options={{ title: 'Tai khoan', tabBarIcon: tabIcon('👤') }} />

      {/* Screens an khoi tab bar */}
      <Tabs.Screen name="product/[slug]" options={{ href: null }} />
      <Tabs.Screen name="checkout" options={{ href: null }} />
      <Tabs.Screen name="order/[id]" options={{ href: null }} />
      <Tabs.Screen name="addresses" options={{ href: null }} />
    </Tabs>
  );
}
