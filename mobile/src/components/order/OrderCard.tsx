import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Badge } from '../ui/Badge';
import { colors, fontSize, radius, spacing } from '../../theme';
import { formatVnd, formatDateTime } from '../../lib/format';
import {
  ORDER_STATUS_LABEL,
  orderStatusTone,
  paymentStatusLabel,
} from '../../lib/format/status';
import { Order } from '../../types';

/** Card tom tat don hang trong danh sach. */
export function OrderCard({ order, onPress }: { order: Order; onPress: () => void }) {
  const paymentLabel =
    order.paymentMethod === 'COD'
      ? 'COD'
      : `VNPay · ${paymentStatusLabel(order.paymentStatus)}`;
  return (
    <Pressable style={styles.card} onPress={onPress} accessibilityRole="button">
      <View style={styles.headerRow}>
        <Text style={styles.orderNumber}>Đơn #{order.orderNumber}</Text>
        <Badge label={ORDER_STATUS_LABEL[order.status] ?? order.status} tone={orderStatusTone(order.status)} />
      </View>

      {order.store?.name ? (
        <Text style={styles.store}>Cửa hàng phụ trách: {order.store.name}</Text>
      ) : null}

      <View style={styles.metaRow}>
        <Text style={styles.meta}>{formatDateTime(order.createdAt)}</Text>
        <Text style={styles.payment}>{paymentLabel}</Text>
      </View>

      <View style={styles.footerRow}>
        <Text style={styles.total}>{formatVnd(order.grandTotal)}</Text>
        <Text style={styles.cta}>Xem chi tiết ›</Text>
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
    gap: spacing.sm,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  orderNumber: { fontSize: fontSize.md, fontWeight: '800', color: colors.text, flexShrink: 1 },
  store: { fontSize: fontSize.sm, color: colors.textMuted },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  meta: { fontSize: fontSize.xs, color: colors.textMuted },
  payment: { fontSize: fontSize.xs, color: colors.textMuted, fontWeight: '600' },
  footerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.xs },
  total: { fontSize: fontSize.lg, fontWeight: '800', color: colors.primary },
  cta: { fontSize: fontSize.sm, fontWeight: '700', color: colors.primary },
});
