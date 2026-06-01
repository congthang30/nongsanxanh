import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, fontSize, gradients, radius, shadow, spacing, TOUCH_TARGET } from '../../theme';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';

interface Props {
  title: string;
  onPress: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  style?: ViewStyle;
  large?: boolean;
}

/**
 * Nut chinh. Touch target lon (>=48). Dung khap app.
 * Primary dung gradient-leaf + pill (dong bo web .btn-primary).
 */
export function Button({
  title,
  onPress,
  variant = 'primary',
  loading,
  disabled,
  fullWidth = true,
  style,
  large,
}: Props) {
  const isDisabled = disabled || loading;
  const content = loading ? (
    <ActivityIndicator color={variant === 'secondary' || variant === 'ghost' ? colors.primary : '#04210f'} />
  ) : (
    <Text style={[styles.text, textVariant[variant], large && styles.textLarge]}>{title}</Text>
  );

  if (variant === 'primary') {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
        onPress={onPress}
        disabled={isDisabled}
        style={({ pressed }) => [
          fullWidth && styles.fullWidth,
          !isDisabled && shadow.sm,
          isDisabled && styles.disabled,
          pressed && !isDisabled && styles.pressed,
          style,
        ]}
      >
        <LinearGradient
          colors={gradients.leaf}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.base, styles.pill, large && styles.large]}
        >
          {content}
        </LinearGradient>
      </Pressable>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        styles.pill,
        large && styles.large,
        fullWidth && styles.fullWidth,
        variantStyle[variant],
        isDisabled && styles.disabled,
        pressed && !isDisabled && styles.pressed,
        style,
      ]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: TOUCH_TARGET,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  pill: { borderRadius: radius.pill },
  large: { minHeight: 56 },
  fullWidth: { alignSelf: 'stretch' },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.9, transform: [{ translateY: 1 }] },
  text: { fontSize: fontSize.md, fontWeight: '700' },
  textLarge: { fontSize: fontSize.lg },
});

const variantStyle: Record<Variant, ViewStyle> = {
  primary: {},
  secondary: { backgroundColor: colors.primaryLight, borderWidth: 1.5, borderColor: colors.primaryDark },
  danger: { backgroundColor: colors.danger },
  ghost: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: colors.primaryLight },
};

const textVariant: Record<Variant, { color: string }> = {
  primary: { color: '#04210f' },
  secondary: { color: colors.primaryDark },
  danger: { color: colors.textInverse },
  ghost: { color: colors.primaryDark },
};
