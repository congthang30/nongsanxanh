import React from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ordersApi } from '../../src/lib/api/orders.api';
import { OrderCard } from '../../src/components/order/OrderCard';
import { EmptyState, ErrorState, LoadingState } from '../../src/components/ui/States';
import { colors, fontSize, spacing } from '../../src/theme';

export default function OrdersScreen() {
  const query = useQuery({
    queryKey: ['orders'],
    queryFn: () => ordersApi.list(),
  });

  const orders = query.data ?? [];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Đơn hàng</Text>
      </View>

      {query.isLoading ? (
        <LoadingState label="Đang tải đơn hàng..." />
      ) : query.isError ? (
        <ErrorState message={(query.error as Error).message} onRetry={() => query.refetch()} />
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(o) => o.id}
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={query.isFetching}
              onRefresh={() => query.refetch()}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <EmptyState
              title="Bạn chưa có đơn hàng nào"
              description="Khi bạn đặt hàng, đơn sẽ hiển thị ở đây."
              actionLabel="Mua sắm ngay"
              onAction={() => router.push('/(customer)/products')}
            />
          }
          renderItem={({ item }) => (
            <OrderCard
              order={item}
              onPress={() =>
                router.push({ pathname: '/(customer)/order/[id]', params: { id: item.id } })
              }
            />
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: { padding: spacing.lg },
  title: { fontSize: fontSize.xl, fontWeight: '800', color: colors.text },
  content: { padding: spacing.lg, gap: spacing.md, flexGrow: 1 },
});
