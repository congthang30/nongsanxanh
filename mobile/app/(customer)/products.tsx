import React, { useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDeliveryStore } from '../../src/store/delivery.store';
import { productsApi } from '../../src/lib/api/products.api';
import { ProductCard } from '../../src/components/product/ProductCard';
import { StoreResolveBanner } from '../../src/components/customer/StoreResolveBanner';
import { AddressResolverSheet } from '../../src/components/customer/AddressResolverSheet';
import { Input } from '../../src/components/ui/Input';
import { EmptyState, ErrorState, LoadingState } from '../../src/components/ui/States';
import { colors, fontSize, spacing } from '../../src/theme';

export default function ProductsScreen() {
  const store = useDeliveryStore((s) => s.store);
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [sheetOpen, setSheetOpen] = useState(false);

  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 350);
    return () => clearTimeout(t);
  }, [q]);

  const query = useQuery({
    queryKey: ['products', store?.storeId, debouncedQ],
    queryFn: () => productsApi.listByStore(store!.storeId, { q: debouncedQ || undefined, limit: 50 }),
    enabled: !!store?.storeId,
  });

  const products = query.data?.data ?? [];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>San pham</Text>
        <StoreResolveBanner onChangeAddress={() => setSheetOpen(true)} />
        <Input
          value={q}
          onChangeText={setQ}
          placeholder="Tim san pham..."
          autoCapitalize="none"
        />
      </View>

      {!store ? (
        <EmptyState
          title="Chua co cua hang giao"
          description="Nhap dia chi giao hang de xem san pham kha dung."
          actionLabel="Nhap dia chi"
          onAction={() => setSheetOpen(true)}
        />
      ) : query.isLoading ? (
        <LoadingState label="Dang tai san pham..." />
      ) : query.isError ? (
        <ErrorState message={(query.error as Error).message} onRetry={() => query.refetch()} />
      ) : (
        <FlatList
          data={products}
          keyExtractor={(p) => p.id}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl refreshing={query.isFetching} onRefresh={() => query.refetch()} tintColor={colors.primary} />
          }
          ListEmptyComponent={<EmptyState title="Khong tim thay san pham" description={debouncedQ ? `Khong co ket qua cho "${debouncedQ}"` : undefined} />}
          renderItem={({ item }) => (
            <View style={styles.cardWrap}>
              <ProductCard
                product={item}
                onPress={() => router.push({ pathname: '/(customer)/product/[slug]', params: { slug: item.slug } })}
              />
            </View>
          )}
        />
      )}

      <AddressResolverSheet visible={sheetOpen} onClose={() => setSheetOpen(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: { padding: spacing.lg, gap: spacing.md },
  title: { fontSize: fontSize.xl, fontWeight: '800', color: colors.text },
  content: { padding: spacing.lg, gap: spacing.md },
  row: { gap: spacing.md },
  cardWrap: { flex: 1, marginBottom: spacing.md },
});
