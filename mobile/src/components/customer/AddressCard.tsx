import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Badge } from '../ui/Badge';
import { colors, fontSize, radius, spacing } from '../../theme';
import { Address } from '../../types';

/**
 * The hien dia chi giao hang. Dung trong checkout + man hinh addresses.
 * Chi hien thong tin dia chi; KHONG co lua chon khu vuc/store.
 */
export function AddressCard({
  address,
  selected,
  onPress,
  onEdit,
  onDelete,
}: {
  address: Address;
  selected?: boolean;
  onPress?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const line = [address.line1, address.ward, address.district, address.province]
    .filter(Boolean)
    .join(', ');
  return (
    <Pressable
      onPress={onPress}
      style={[styles.card, selected && styles.cardSelected]}
      accessibilityRole={onPress ? 'button' : undefined}
    >
      <View style={styles.headerRow}>
        <Text style={styles.name} numberOfLines={1}>
          {address.recipientName}
        </Text>
        {address.isDefault ? <Badge label="Mặc định" tone="success" /> : null}
      </View>
      <Text style={styles.phone}>{address.phone}</Text>
      <Text style={styles.line}>{address.formattedAddress || line}</Text>
      {address.deliveryNote ? (
        <Text style={styles.note}>Ghi chú: {address.deliveryNote}</Text>
      ) : null}

      {(onEdit || onDelete) && (
        <View style={styles.actions}>
          {onEdit ? (
            <Text style={styles.actionEdit} onPress={onEdit}>
              Sửa
            </Text>
          ) : null}
          {onDelete ? (
            <Text style={styles.actionDelete} onPress={onDelete}>
              Xóa
            </Text>
          ) : null}
        </View>
      )}
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
    gap: spacing.xs,
  },
  cardSelected: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  name: { fontSize: fontSize.md, fontWeight: '700', color: colors.text, flexShrink: 1 },
  phone: { fontSize: fontSize.sm, color: colors.textMuted },
  line: { fontSize: fontSize.sm, color: colors.text, lineHeight: 20 },
  note: { fontSize: fontSize.xs, color: colors.textMuted, fontStyle: 'italic' },
  actions: { flexDirection: 'row', gap: spacing.lg, marginTop: spacing.xs },
  actionEdit: { color: colors.primary, fontWeight: '700', fontSize: fontSize.sm },
  actionDelete: { color: colors.danger, fontWeight: '700', fontSize: fontSize.sm },
});
