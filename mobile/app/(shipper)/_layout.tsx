import React from 'react';
import { Tabs, router } from 'expo-router';
import { useAuthStore, authSelectors } from '../../src/store/auth.store';
import { Icon, IconName } from '../../src/components/ui/Icon';
import { colors } from '../../src/theme';

/** Tab icon dung SVG (react-native-svg), khong dung emoji. */
function tabIcon(name: IconName) {
  return ({ color, focused }: { color: string; focused: boolean }) => (
    <Icon name={name} size={24} color={color} strokeWidth={focused ? 2.4 : 2} />
  );
}

export default function ShipperLayout() {
  const user = useAuthStore((s) => s.user);
  const initializing = useAuthStore((s) => s.initializing);
  const isShipper = useAuthStore(authSelectors.isShipper);

  // Bao ve route: chua login -> auth; khong phai shipper -> ve customer home.
  React.useEffect(() => {
    if (initializing) return;
    if (!user) {
      router.replace('/(auth)/login');
      return;
    }
    if (!isShipper) {
      router.replace('/(customer)/home');
    }
  }, [user, initializing, isShipper]);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          height: 62,
          paddingBottom: 8,
          paddingTop: 6,
          borderTopColor: colors.border,
          backgroundColor: colors.surface,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tabs.Screen name="jobs" options={{ title: 'Đang giao', tabBarIcon: tabIcon('truck') }} />
      <Tabs.Screen name="history" options={{ title: 'Lịch sử', tabBarIcon: tabIcon('clock') }} />
      <Tabs.Screen name="account" options={{ title: 'Tài khoản', tabBarIcon: tabIcon('user') }} />

      {/* Screen an khoi tab bar */}
      <Tabs.Screen name="job/[id]" options={{ href: null }} />
    </Tabs>
  );
}
