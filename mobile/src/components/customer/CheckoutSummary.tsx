import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fontSize, spacing } from '../../theme';
import { formatVnd } from '../../lib/format';

interface Row {
  label: string;
  value: number | null | undefined;
}

/**
 * Tom tat tien cho checkout/order. Hien tam tinh, giam gia, phi giao, tong cong.
 * Tat ca so tien deu qua formatVnd.
 */
export function CheckoutSummary({
  subtotal,
  discountTotal,
  shippingFee,
  grandTotal,
  itemCount,
}: {
  subtotal?: number | null;
  discountTotal?: number | null;
  shippingFee?: number | null;
  grandTotal?: number | null;
  itemCount?: number;
}) {
  const rows: Row[] = [
    { label: 'Tạm tính', value: subtotal },
    { label: 'Giảm giá', value: discountTotal ? -Math.abs(discountTotal) : 0 },
    { label: 'Phí giao hàng', value: shippingFee },
  ];
  return (
    <View style={styles.wrap}>
      {itemCount != null ? (
        <Text style={styles.count}>{itemCount} sản phẩm</Text>
      ) : null}
      {rows.map((r) => (
        <View key={r.label} style={styles.row}>
          <Text style={styles.label}>{r.label}</Text>
          <Text style={styles.value}>{formatVnd(r.value ?? 0)}</Text>
        </View>
      ))}
      <View style={styles.divider} />
      <View style={styles.row}>
        <Text style={styles.totalLabel}>Tổng cộng</Text>
        <Text style={styles.totalValue}>{formatVnd(grandTotal ?? 0)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  count: { fontSize: fontSize.sm, color: colors.textMuted, fontWeight: '600' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { fontSize: fontSize.sm, color: colors.textMuted },
  value: { fontSize: fontSize.sm, color: colors.text, fontWeight: '600' },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.xs },
  totalLabel: { fontSize: fontSize.md, color: colors.text, fontWeight: '700' },
  totalValue: { fontSize: fontSize.xl, color: colors.primary, fontWeight: '800' },
});
