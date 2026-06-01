import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { shipperApi } from '../../../src/lib/api/shipper.api';
import { Card } from '../../../src/components/ui/Card';
import { Badge } from '../../../src/components/ui/Badge';
import { ErrorState, LoadingState } from '../../../src/components/ui/States';
import { AddressActionRow } from '../../../src/components/shipper/AddressActionRow';
import { DeliveryActionPanel } from '../../../src/components/shipper/DeliveryActionPanel';
import { colors, fontSize, spacing } from '../../../src/theme';
import { formatVnd, formatQty, formatDateTime } from '../../../src/lib/format';
import { DELIVERY_STATUS_LABEL, deliveryStatusTone } from '../../../src/lib/format/status';

export default function ShipperJobDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const query = useQuery({
    queryKey: ['shipper-job', id],
    queryFn: () => shipperApi.job(id),
    enabled: !!id,
  });

  const job = query.data;

  if (query.isLoading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <TopBar />
        <LoadingState label="Đang tải đơn giao..." />
      </SafeAreaView>
    );
  }
  if (query.isError || !job) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <TopBar />
        <ErrorState message={(query.error as Error)?.message} onRetry={() => query.refetch()} />
      </SafeAreaView>
    );
  }

  const isCod = (job.codAmount != null && job.codAmount > 0) || job.order?.paymentMethod === 'COD';
  const codValue = job.codAmount ?? job.order?.grandTotal ?? 0;
  const items = job.order?.items ?? [];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <TopBar />
      <ScrollView contentContainerStyle={styles.content}>
        {/* Status header */}
        <View style={styles.headerRow}>
          <Text style={styles.orderNumber}>Đơn #{job.order?.orderNumber ?? job.orderId.slice(0, 8)}</Text>
          <Badge label={DELIVERY_STATUS_LABEL[job.status] ?? job.status} tone={deliveryStatusTone(job.status)} />
        </View>

        {/* Pickup */}
        <Card>
          <AddressActionRow
            title="Lấy hàng tại cửa hàng"
            name={job.pickupName ?? job.store?.name}
            phone={job.store?.phone}
            address={job.pickupAddress ?? job.store?.formattedAddress}
            lat={job.pickupLat}
            lng={job.pickupLng}
          />
        </Card>

        {/* Dropoff */}
        <Card>
          <AddressActionRow
            title="Giao đến khách hàng"
            name={job.dropoffName}
            phone={job.dropoffPhone}
            address={job.dropoffAddress}
            lat={job.dropoffLat}
            lng={job.dropoffLng}
          />
        </Card>

        {/* Payment / COD */}
        <Card>
          <Text style={styles.sectionTitle}>Thanh toán</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Phương thức</Text>
            <Text style={styles.value}>{isCod ? 'COD (thu khi giao)' : 'Đã thanh toán'}</Text>
          </View>
          {isCod ? (
            <View style={styles.row}>
              <Text style={styles.label}>Số tiền thu</Text>
              <Text style={styles.codValue}>{formatVnd(codValue)}</Text>
            </View>
          ) : null}
          {job.codCollected ? (
            <Badge label="Đã thu tiền" tone="success" />
          ) : null}
        </Card>

        {/* Items */}
        {items.length > 0 ? (
          <Card>
            <Text style={styles.sectionTitle}>Sản phẩm</Text>
            {items.map((it, idx) => (
              <View key={idx} style={styles.itemRow}>
                <Text style={styles.itemName} numberOfLines={2}>{it.productNameSnapshot}</Text>
                <Text style={styles.itemQty}>
                  {formatQty(it.quantity)} {it.unitSnapshot}
                </Text>
              </View>
            ))}
          </Card>
        ) : null}

        {/* Timeline */}
        {job.events && job.events.length > 0 ? (
          <Card>
            <Text style={styles.sectionTitle}>Lịch sử giao hàng</Text>
            {[...job.events]
              .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
              .map((ev) => (
                <View key={ev.id} style={styles.eventRow}>
                  <Text style={styles.eventStatus}>{DELIVERY_STATUS_LABEL[ev.status] ?? ev.status}</Text>
                  <Text style={styles.eventTime}>{formatDateTime(ev.createdAt)}</Text>
                  {ev.note ? <Text style={styles.eventNote}>{ev.note}</Text> : null}
                </View>
              ))}
          </Card>
        ) : null}

        {job.failureReason ? (
          <Text style={styles.failReason}>Lý do giao thất bại: {job.failureReason}</Text>
        ) : null}

        {/* Action panel */}
        <DeliveryActionPanel job={job} onUpdated={() => query.refetch()} />
      </ScrollView>
    </SafeAreaView>
  );
}

function TopBar() {
  return (
    <View style={styles.topbar}>
      <Text style={styles.back} onPress={() => router.back()}>‹ Quay lại</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  topbar: { padding: spacing.md },
  back: { fontSize: fontSize.md, color: colors.primary, fontWeight: '600' },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  orderNumber: { fontSize: fontSize.xl, fontWeight: '800', color: colors.text, flexShrink: 1 },
  sectionTitle: { fontSize: fontSize.md, fontWeight: '700', color: colors.text },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { fontSize: fontSize.sm, color: colors.textMuted },
  value: { fontSize: fontSize.sm, color: colors.text, fontWeight: '600' },
  codValue: { fontSize: fontSize.lg, fontWeight: '800', color: colors.warning },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm, paddingVertical: 4 },
  itemName: { fontSize: fontSize.sm, color: colors.text, flex: 1 },
  itemQty: { fontSize: fontSize.sm, fontWeight: '700', color: colors.text },
  eventRow: { gap: 2, paddingVertical: spacing.xs },
  eventStatus: { fontSize: fontSize.sm, fontWeight: '700', color: colors.text },
  eventTime: { fontSize: fontSize.xs, color: colors.textMuted },
  eventNote: { fontSize: fontSize.xs, color: colors.textMuted },
  failReason: { fontSize: fontSize.sm, color: colors.danger, fontWeight: '600' },
});
