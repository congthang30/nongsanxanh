import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SheetModal } from '../ui/SheetModal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { colors, fontSize, radius, spacing } from '../../theme';
import { FAILED_REASONS } from '../../lib/format/status';

/**
 * Sheet nhap ly do giao that bai. Bat buoc co ly do (>= 3 ky tu).
 * Goi y nhanh cac ly do pho bien; "Khác" cho phep nhap tu do.
 */
export function FailReasonSheet({
  visible,
  loading,
  onSubmit,
  onClose,
}: {
  visible: boolean;
  loading?: boolean;
  onSubmit: (reason: string) => void;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [custom, setCustom] = useState('');

  const isOther = selected === 'Khác';
  const reason = isOther ? custom.trim() : selected ?? '';
  const valid = reason.length >= 3;

  function handleClose() {
    setSelected(null);
    setCustom('');
    onClose();
  }

  function handleSubmit() {
    if (!valid) return;
    onSubmit(reason);
  }

  return (
    <SheetModal visible={visible} title="Báo giao thất bại" onClose={handleClose}>
      <Text style={styles.label}>Chọn lý do giao thất bại</Text>
      <View style={styles.chips}>
        {FAILED_REASONS.map((r) => {
          const active = selected === r;
          return (
            <Pressable
              key={r}
              onPress={() => setSelected(r)}
              style={[styles.chip, active && styles.chipActive]}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{r}</Text>
            </Pressable>
          );
        })}
      </View>

      {isOther ? (
        <Input
          value={custom}
          onChangeText={setCustom}
          placeholder="Nhập lý do cụ thể"
          multiline
          style={styles.input}
        />
      ) : null}

      {selected && !valid ? (
        <Text style={styles.hint}>Vui lòng nhập lý do (tối thiểu 3 ký tự).</Text>
      ) : null}

      <Button
        title="Xác nhận giao thất bại"
        onPress={handleSubmit}
        variant="danger"
        loading={loading}
        disabled={!valid || loading}
      />
      <Button title="Đóng" onPress={handleClose} variant="ghost" disabled={loading} />
    </SheetModal>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: fontSize.sm, fontWeight: '700', color: colors.textMuted },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipActive: { borderColor: colors.danger, backgroundColor: colors.dangerLight },
  chipText: { fontSize: fontSize.sm, color: colors.text },
  chipTextActive: { color: colors.danger, fontWeight: '700' },
  input: { minHeight: 64, paddingTop: spacing.md, textAlignVertical: 'top' },
  hint: { fontSize: fontSize.xs, color: colors.warning },
});
