import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fontSize, radius, spacing, TOUCH_TARGET } from '../../theme';
import { PaymentMethod } from '../../types';

interface Option {
  value: PaymentMethod;
  label: string;
  description: string;
}

const OPTIONS: Option[] = [
  { value: 'COD', label: 'Thanh toán khi nhận hàng (COD)', description: 'Trả tiền mặt cho shipper khi nhận hàng' },
  { value: 'VNPAY', label: 'VNPay', description: 'Thanh toán trực tuyến qua VNPay' },
];

/** Chon phuong thuc thanh toan COD/VNPay. */
export function PaymentMethodSelector({
  value,
  onChange,
}: {
  value: PaymentMethod;
  onChange: (v: PaymentMethod) => void;
}) {
  return (
    <View style={styles.wrap}>
      {OPTIONS.map((opt) => {
        const active = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => onChange(opt.value)}
            style={[styles.option, active && styles.optionActive]}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
          >
            <View style={[styles.radio, active && styles.radioActive]}>
              {active ? <View style={styles.radioDot} /> : null}
            </View>
            <View style={styles.flex}>
              <Text style={styles.label}>{opt.label}</Text>
              <Text style={styles.description}>{opt.description}</Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  option: {
    minHeight: TOUCH_TARGET,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  optionActive: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  flex: { flex: 1 },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioActive: { borderColor: colors.primary },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
  label: { fontSize: fontSize.md, fontWeight: '700', color: colors.text },
  description: { fontSize: fontSize.xs, color: colors.textMuted },
});
