import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Button } from './Button';
import { colors, fontSize, spacing } from '../../theme';

export function LoadingState({ label = 'Dang tai...' }: { label?: string }) {
  return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={styles.muted}>{label}</Text>
    </View>
  );
}

export function ErrorState({
  message = 'Co loi xay ra',
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <View style={styles.center}>
      <Text style={styles.errorTitle}>Khong tai duoc du lieu</Text>
      <Text style={styles.muted}>{message}</Text>
      {onRetry && (
        <View style={styles.retryWrap}>
          <Button title="Thu lai" onPress={onRetry} variant="secondary" fullWidth={false} />
        </View>
      )}
    </View>
  );
}

export function EmptyState({
  title = 'Khong co du lieu',
  description,
  actionLabel,
  onAction,
}: {
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.center}>
      <Text style={styles.emptyTitle}>{title}</Text>
      {description ? <Text style={styles.muted}>{description}</Text> : null}
      {actionLabel && onAction ? (
        <View style={styles.retryWrap}>
          <Button title={actionLabel} onPress={onAction} fullWidth={false} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.sm,
  },
  muted: { color: colors.textMuted, fontSize: fontSize.sm, textAlign: 'center' },
  errorTitle: { color: colors.danger, fontSize: fontSize.lg, fontWeight: '700' },
  emptyTitle: { color: colors.text, fontSize: fontSize.lg, fontWeight: '700' },
  retryWrap: { marginTop: spacing.md },
});
