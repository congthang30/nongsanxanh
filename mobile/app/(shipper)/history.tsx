import React from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { shipperApi } from '../../src/lib/api/shipper.api';
import { Card } from '../../src/components/ui/Card';
import { Badge } from '../../src/components/ui/Badge';
import { EmptyState, ErrorState, LoadingState } from '../../src/components/ui/States';
import { colors, fontSize, spacing } from '../../src/theme';
import { formatVnd, formatDateTime } from '../../src/lib/format';
import { DELIVERY_STATUS_LABEL, deliveryStatusTone } from '../../src/lib/format/status';

export default function ShipperHistoryScreen() {
  const query = useQuery({
    queryKey: ['shipper-jobs', 'history'],
    queryFn: () => shipperApi.jobs('history'),
  });

  const jobs = query.data ?? [];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Lịch sử giao hàng</Text>
      </View>

      {query.isLoading ? (
        <LoadingState label="Đang tải lịch sử..." />
      ) : query.isError ? (
        <ErrorState message={(query.error as Error).message} onRetry={() => query.refetch()} />
      ) : (
        <FlatList
          data={jobs}
          keyExtractor={(j) => j.id}
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={query.isFetching}
              onRefresh={() => query.refetch()}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <EmptyState title="Chưa có lịch sử giao" description="Các đơn đã giao hoặc giao thất bại sẽ hiển thị ở đây." />
          }
          renderItem={({ item }) => {
            const isCod = (item.codAmount != null && item.codAmount > 0) || item.order?.paymentMethod === 'COD';
            return (
              <Card>
                <View style={styles.rowBetween}>
                  <Text style={styles.orderNumber}>Đơn #{item.order?.orderNumber ?? item.orderId.slice(0, 8)}</Text>
                  <Badge label={DELIVERY_STATUS_LABEL[item.status] ?? item.status} tone={deliveryStatusTone(item.status)} />
                </View>
                {item.dropoffName ? <Text style={styles.customer}>{item.dropoffName}</Text> : null}
                {item.dropoffAddress ? <Text style={styles.address} numberOfLines={2}>{item.dropoffAddress}</Text> : null}
                <View style={styles.rowBetween}>
                  {isCod ? (
                    <Text style={styles.cod}>COD: {formatVnd(item.codAmount ?? item.order?.grandTotal ?? 0)}</Text>
                  ) : (
                    <Text style={styles.muted}>Đã thanh toán</Text>
                  )}
                  {item.deliveredAt ? (
                    <Text style={styles.muted}>{formatDateTime(item.deliveredAt)}</Text>
                  ) : null}
                </View>
                {item.failureReason ? (
                  <Text style={styles.failReason}>Lý do: {item.failureReason}</Text>
                ) : null}
                <Text
                  style={styles.cta}
                  onPress={() => router.push({ pathname: '/(shipper)/job/[id]', params: { id: item.id } })}
                >
                  Xem chi tiết ›
                </Text>
              </Card>
            );
          }}
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
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm },
  orderNumber: { fontSize: fontSize.md, fontWeight: '800', color: colors.text, flexShrink: 1 },
  customer: { fontSize: fontSize.sm, fontWeight: '600', color: colors.text },
  address: { fontSize: fontSize.sm, color: colors.textMuted, lineHeight: 20 },
  cod: { fontSize: fontSize.sm, fontWeight: '700', color: colors.warning },
  muted: { fontSize: fontSize.xs, color: colors.textMuted },
  failReason: { fontSize: fontSize.xs, color: colors.danger },
  cta: { fontSize: fontSize.sm, fontWeight: '700', color: colors.primary, marginTop: spacing.xs },
});
