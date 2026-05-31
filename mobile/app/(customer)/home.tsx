import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDeliveryStore } from '../../src/store/delivery.store';
import { useAuthStore } from '../../src/store/auth.store';
import { usersApi } from '../../src/lib/api/users.api';
import { productsApi } from '../../src/lib/api/products.api';
import { getForegroundPermission } from '../../src/lib/location';
import { StoreResolveBanner } from '../../src/components/customer/StoreResolveBanner';
import { AddressResolverSheet } from '../../src/components/customer/AddressResolverSheet';
import { ProductCard } from '../../src/components/product/ProductCard';
import { EmptyState } from '../../src/components/ui/States';
import { colors, fontSize, spacing } from '../../src/theme';

export default function HomeScreen() {
  const user = useAuthStore((s) => s.user);
  const { store, source, resolveByAddress, resolveByCurrentGps } = useDeliveryStore();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [autoTried, setAutoTried] = useState(false);

  // Auto resolve khi mo app: dia chi mac dinh -> GPS (neu da co quyen) -> CTA nhap.
  useEffect(() => {
    if (autoTried || store) return;
    let cancelled = false;
    (async () => {
      setAutoTried(true);
      if (user) {
        try {
          const addresses = await usersApi.listAddresses();
          const def = addresses.find((a) => a.isDefault) ?? addresses[0];
          if (def && !cancelled) {
            await resolveByAddress(def);
            return;
          }
        } catch {
          // ignore -> thu GPS
        }
      }
      // Khong co dia chi -> neu da cap quyen GPS truoc do thi dung luon.
      const perm = await getForegroundPermission();
      if (perm === 'granted' && !cancelled) {
        await resolveByCurrentGps();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, store, autoTried, resolveByAddress, resolveByCurrentGps]);

  const productsQuery = useQuery({
    queryKey: ['home-products', store?.storeId],
    queryFn: () => productsApi.listByStore(store!.storeId, { limit: 8 }),
    enabled: !!store?.storeId,
  });

  useFocusEffect(
    useCallback(() => {
      if (store?.storeId) void productsQuery.refetch();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [store?.storeId]),
  );

  const products = productsQuery.data?.data ?? [];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.brand}>NongSan Xanh</Text>
        <Text style={styles.greeting}>{user?.fullName ? `Chao ${user.fullName}` : 'Chao ban'}</Text>
      </View>

      <FlatList
        data={products}
        keyExtractor={(p) => p.id}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={productsQuery.isFetching}
            onRefresh={() => productsQuery.refetch()}
            tintColor={colors.primary}
          />
        }
        ListHeaderComponent={
          <View style={styles.headerBlock}>
            <StoreResolveBanner onChangeAddress={() => setSheetOpen(true)} />
            {store ? (
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>San pham noi bat</Text>
                <Text style={styles.link} onPress={() => router.push('/(customer)/products')}>
                  Xem tat ca
                </Text>
              </View>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          !store ? (
            <EmptyState
              title="Nhap dia chi de bat dau"
              description="He thong se tu chon cua hang gan nhat co du hang. Ban khong can chon khu vuc."
              actionLabel="Nhap dia chi giao hang"
              onAction={() => setSheetOpen(true)}
            />
          ) : productsQuery.isLoading ? null : (
            <EmptyState title="Chua co san pham" description="Cua hang nay chua co san pham kha dung." />
          )
        }
        renderItem={({ item }) => (
          <View style={styles.cardWrap}>
            <ProductCard
              product={item}
              onPress={() =>
                router.push({ pathname: '/(customer)/product/[slug]', params: { slug: item.slug } })
              }
            />
          </View>
        )}
      />

      <AddressResolverSheet visible={sheetOpen} onClose={() => setSheetOpen(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  brand: { fontSize: fontSize.xl, fontWeight: '800', color: colors.primary },
  greeting: { fontSize: fontSize.sm, color: colors.textMuted },
  content: { padding: spacing.lg, gap: spacing.md },
  headerBlock: { gap: spacing.lg, marginBottom: spacing.sm },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { fontSize: fontSize.lg, fontWeight: '700', color: colors.text },
  link: { fontSize: fontSize.sm, color: colors.primary, fontWeight: '600' },
  row: { gap: spacing.md },
  cardWrap: { flex: 1, marginBottom: spacing.md },
});
