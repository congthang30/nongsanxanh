import React, { useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDeliveryStore } from '../../src/store/delivery.store';
import { productsApi } from '../../src/lib/api/products.api';
import { ProductCard } from '../../src/components/product/ProductCard';
import { StoreResolveBanner } from '../../src/components/customer/StoreResolveBanner';
import { AddressResolverSheet } from '../../src/components/customer/AddressResolverSheet';
import { Icon } from '../../src/components/ui/Icon';
import { EmptyState, ErrorState, LoadingState } from '../../src/components/ui/States';
import { colors, fontSize, radius, shadow, spacing } from '../../src/theme';

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
        <Text style={styles.title}>Sản phẩm</Text>
        <StoreResolveBanner onChangeAddress={() => setSheetOpen(true)} />
        <View style={styles.search}>
          <Icon name="search" size={20} color={colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            value={q}
            onChangeText={setQ}
            placeholder="Tìm sản phẩm..."
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            returnKeyType="search"
          />
        </View>
      </View>

      {!store ? (
        <EmptyState
          title="Chưa có cửa hàng giao"
          description="Nhập địa chỉ giao hàng để xem sản phẩm khả dụng."
          actionLabel="Nhập địa chỉ"
          onAction={() => setSheetOpen(true)}
        />
      ) : query.isLoading ? (
        <LoadingState label="Đang tải sản phẩm..." />
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
          ListEmptyComponent={<EmptyState title="Không tìm thấy sản phẩm" description={debouncedQ ? `Không có kết quả cho "${debouncedQ}"` : undefined} />}
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
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: 4,
    ...shadow.sm,
  },
  searchInput: { flex: 1, fontSize: fontSize.sm, color: colors.text, paddingVertical: 10 },
  content: { padding: spacing.lg, gap: spacing.md },
  row: { gap: spacing.md },
  cardWrap: { flex: 1, marginBottom: spacing.md },
});
