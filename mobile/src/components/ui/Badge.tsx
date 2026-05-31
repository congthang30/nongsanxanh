import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { colors, fontSize, radius, spacing } from '../../theme';

type Tone = 'success' | 'warning' | 'danger' | 'neutral' | 'primary';

export function Badge({ label, tone = 'neutral', style }: { label: string; tone?: Tone; style?: ViewStyle }) {
  return (
    <View style={[styles.badge, toneBg[tone], style]}>
      <Text style={[styles.text, toneText[tone]]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
  text: { fontSize: fontSize.xs, fontWeight: '700' },
});

const toneBg: Record<Tone, ViewStyle> = {
  success: { backgroundColor: colors.primaryLight },
  warning: { backgroundColor: colors.warningLight },
  danger: { backgroundColor: colors.dangerLight },
  neutral: { backgroundColor: '#eef0f3' },
  primary: { backgroundColor: colors.primary },
};

const toneText: Record<Tone, { color: string }> = {
  success: { color: colors.primaryDark },
  warning: { color: colors.warning },
  danger: { color: colors.danger },
  neutral: { color: colors.textMuted },
  primary: { color: colors.textInverse },
};
