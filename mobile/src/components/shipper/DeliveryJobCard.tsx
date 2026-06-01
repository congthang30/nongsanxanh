import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Badge } from '../ui/Badge';
import { colors, fontSize, radius, spacing } from '../../theme';
import { formatVnd, formatDistanceKm } from '../../lib/format';
import { DELIVERY_STATUS_LABEL, deliveryStatusTone } from '../../lib/format/status';
import { DeliveryJob } from '../../types';

/**
 * Card don giao cho shipper. Thong tin to, ro rang khi dang di duong.
 * KHONG co nut accept/reject/bid — chi xem chi tiet + hanh dong trang thai o detail.
 */
export function DeliveryJobCard({
  job,
  onPress,
}: {
  job: DeliveryJob;
  onPress: () => void;
}) {
  const isCod = (job.codAmount != null && job.codAmount > 0) || job.order?.paymentMethod === 'COD';
  const codValue = job.codAmount ?? job.order?.grandTotal ?? 0;

  return (
    <Pressable style={styles.card} onPress={onPress} accessibilityRole="button">
      <View style={styles.headerRow}>
        <Text style={styles.orderNumber}>Đơn #{job.order?.orderNumber ?? job.orderId.slice(0, 8)}</Text>
        <Badge label={DELIVERY_STATUS_LABEL[job.status] ?? job.status} tone={deliveryStatusTone(job.status)} />
      </View>

      {/* Pickup */}
      <View style={styles.block}>
        <Text style={styles.blockLabel}>Lấy hàng</Text>
        <Text style={styles.storeName}>{job.pickupName ?? job.store?.name ?? 'Cửa hàng'}</Text>
        {job.pickupAddress ? (
          <Text style={styles.address}>{job.pickupAddress}</Text>
        ) : null}
      </View>

      {/* Dropoff */}
      <View style={styles.block}>
        <Text style={styles.blockLabel}>Giao đến</Text>
        <Text style={styles.customer}>{job.dropoffName ?? 'Khách hàng'}</Text>
        {job.dropoffPhone ? <Text style={styles.phone}>{job.dropoffPhone}</Text> : null}
        {job.dropoffAddress ? <Text style={styles.address}>{job.dropoffAddress}</Text> : null}
      </View>

      <View style={styles.footerRow}>
        <View style={styles.tags}>
          {isCod ? (
            <View style={styles.codBox}>
              <Text style={styles.codLabel}>COD</Text>
              <Text style={styles.codValue}>{formatVnd(codValue)}</Text>
            </View>
          ) : (
            <Badge label="Đã thanh toán" tone="neutral" />
          )}
          {job.distanceKm != null ? (
            <Badge label={formatDistanceKm(job.distanceKm)} tone="neutral" />
          ) : null}
        </View>
        <Text style={styles.cta}>Chi tiết ›</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  orderNumber: { fontSize: fontSize.md, fontWeight: '800', color: colors.text, flexShrink: 1 },
  block: { gap: 2 },
  blockLabel: { fontSize: fontSize.xs, color: colors.textMuted, fontWeight: '700', textTransform: 'uppercase' },
  storeName: { fontSize: fontSize.md, fontWeight: '700', color: colors.text },
  customer: { fontSize: fontSize.md, fontWeight: '700', color: colors.text },
  phone: { fontSize: fontSize.sm, color: colors.primary, fontWeight: '600' },
  address: { fontSize: fontSize.sm, color: colors.textMuted, lineHeight: 20 },
  footerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  tags: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap', flex: 1 },
  codBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.warningLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
  },
  codLabel: { fontSize: fontSize.xs, fontWeight: '800', color: colors.warning },
  codValue: { fontSize: fontSize.sm, fontWeight: '800', color: colors.warning },
  cta: { fontSize: fontSize.sm, fontWeight: '700', color: colors.primary },
});
