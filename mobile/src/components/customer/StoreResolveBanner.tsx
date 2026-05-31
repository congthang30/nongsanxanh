import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useDeliveryStore } from '../../store/delivery.store';
import { Badge } from '../ui/Badge';
import { colors, fontSize, radius, spacing } from '../../theme';
import { formatDistanceKm } from '../../lib/format';

/**
 * Banner hien cua hang fulfillment he thong tu gan.
 * KHONG co dropdown chon khu vuc/store. Tap -> mo flow doi dia chi (onChangeAddress).
 */
export function StoreResolveBanner({ onChangeAddress }: { onChangeAddress: () => void }) {
  const { store, source, resolving, lastResult } = useDeliveryStore();

  let body: React.ReactNode;
  if (resolving) {
    body = (
      <View style={styles.row}>
        <ActivityIndicator size="small" color={colors.primary} />
        <Text style={styles.muted}>Dang tim cua hang gan nhat...</Text>
      </View>
    );
  } else if (store) {
    body = (
      <View style={styles.gap}>
        <Text style={styles.label}>Giao tu cua hang gan nhat co du hang</Text>
        <View style={styles.row}>
          <Text style={styles.storeName} numberOfLines={1}>
            {store.storeName}
          </Text>
          {store.distanceKm != null ? (
            <Badge label={formatDistanceKm(store.distanceKm)} tone="success" />
          ) : null}
        </View>
        {/* Neu store gan nhat thieu hang nhung resolver chon store xa hon */}
        {lastResult?.alternatives?.some((a) => !a.inStock) ? (
          <Text style={styles.note}>
            Mot so san pham khong du tai cua hang gan nhat. He thong xu ly don tu cua hang gan tiep theo co du hang.
          </Text>
        ) : null}
      </View>
    );
  } else {
    body = (
      <View style={styles.gap}>
        <Text style={styles.label}>Chua xac dinh cua hang giao</Text>
        <Text style={styles.note}>
          {lastResult?.message ?? 'Nhap dia chi giao hang de kiem tra ton kho va giao hang.'}
        </Text>
      </View>
    );
  }

  return (
    <Pressable style={styles.banner} onPress={onChangeAddress}>
      <View style={styles.flex}>{body}</View>
      <Text style={styles.change}>{source === 'none' ? 'Nhap dia chi' : 'Doi'}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  flex: { flex: 1 },
  gap: { gap: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  label: { fontSize: fontSize.xs, color: colors.primaryDark, fontWeight: '600' },
  storeName: { fontSize: fontSize.md, fontWeight: '700', color: colors.text, flexShrink: 1 },
  note: { fontSize: fontSize.xs, color: colors.warning },
  muted: { fontSize: fontSize.sm, color: colors.textMuted },
  change: { fontSize: fontSize.sm, fontWeight: '700', color: colors.primary },
});
