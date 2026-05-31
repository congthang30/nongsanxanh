import React, { useEffect } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Slot } from 'expo-router';
import { queryClient } from '../src/lib/api/queryClient';
import { useAuthStore } from '../src/store/auth.store';
import { useDeliveryStore } from '../src/store/delivery.store';

export default function RootLayout() {
  const bootstrap = useAuthStore((s) => s.bootstrap);
  const hydrate = useDeliveryStore((s) => s.hydrate);

  useEffect(() => {
    void bootstrap();
    void hydrate();
  }, [bootstrap, hydrate]);

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="dark" />
        <Slot />
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
