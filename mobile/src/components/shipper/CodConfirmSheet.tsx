import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SheetModal } from '../ui/SheetModal';
import { Button } from '../ui/Button';
import { colors, fontSize, spacing } from '../../theme';
import { formatVnd } from '../../lib/format';

/**
 * Modal xac nhan thu COD truoc khi danh dau giao thanh cong.
 * Theo spec muc 9.4: bat buoc xac nhan da thu du tien cho don COD.
 */
export function CodConfirmSheet({
  visible,
  amount,
  loading,
  onConfirmCollected,
  onNotCollected,
  onClose,
}: {
  visible: boolean;
  amount: number;
  loading?: boolean;
  /** Da thu du tien -> delivered(id, true). */
  onConfirmCollected: () => void;
  /** Chua thu duoc tien -> chuyen sang flow giao that bai. */
  onNotCollected: () => void;
  onClose: () => void;
}) {
  return (
    <SheetModal visible={visible} title="Xác nhận thu tiền COD" onClose={onClose}>
      <View style={styles.amountBox}>
        <Text style={styles.amountLabel}>Số tiền cần thu</Text>
        <Text style={styles.amount}>{formatVnd(amount)}</Text>
      </View>
      <Text style={styles.question}>Bạn đã thu đủ tiền COD chưa?</Text>
      <Button
        title="Đã thu đủ tiền"
        onPress={onConfirmCollected}
        loading={loading}
        large
      />
      <Button
        title="Chưa thu được tiền"
        onPress={onNotCollected}
        variant="danger"
        disabled={loading}
      />
      <Button title="Đóng" onPress={onClose} variant="ghost" disabled={loading} />
    </SheetModal>
  );
}

const styles = StyleSheet.create({
  amountBox: {
    backgroundColor: colors.primaryLight,
    borderRadius: 12,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.xs,
  },
  amountLabel: { fontSize: fontSize.sm, color: colors.primaryDark, fontWeight: '600' },
  amount: { fontSize: fontSize.xxl, fontWeight: '800', color: colors.primaryDark },
  question: { fontSize: fontSize.md, fontWeight: '700', color: colors.text, textAlign: 'center' },
});
