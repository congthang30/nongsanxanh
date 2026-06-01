import React, { useEffect } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '../src/store/auth.store';
import { LoadingState } from '../src/components/ui/States';
import { colors } from '../src/theme';

/**
 * Gate dieu huong sau khi load session:
 *  - chua login -> (auth)
 *  - role SHIPPER (va dang o mode shipper) -> (shipper)
 *  - con lai -> (customer)
 */
export default function Index() {
  const { user, mode, initializing } = useAuthStore();

  useEffect(() => {
    if (initializing) return;
    if (!user) {
      router.replace('/(auth)/login');
      return;
    }
    if (mode === 'shipper') {
      router.replace('/(shipper)/jobs');
    } else {
      router.replace('/(customer)/home');
    }
  }, [user, mode, initializing]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <LoadingState label="Đang khởi động..." />
    </View>
  );
}
