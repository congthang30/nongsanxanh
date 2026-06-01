import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useDeliveryStore } from '../../store/delivery.store';
import { Icon } from '../ui/Icon';
import { colors, fontSize, green, radius, spacing } from '../../theme';
import { formatDistanceKm } from '../../lib/format';

/**
 * Banner "Giao den" — lay dia chi/cua hang giao lam trong tam (giong web: khach chi quan tam
 * dia chi giao, he thong tu chon cua hang phia sau). KHONG co dropdown chon khu vuc/store.
 * Tap -> mo flow chon/doi dia chi (onChangeAddress).
 */
export function StoreResolveBanner({ onChangeAddress }: { onChangeAddress: () => void }) {
  const { store, activeAddress, source, resolving, lastResult } = useDeliveryStore();

  // Dong dia chi de hien thi (uu tien dia chi da chon, fallback ten cua hang).
  const addressLine = activeAddress
    ? [activeAddress.ward, activeAddress.district, activeAddress.province].filter(Boolean).join(', ')
    : null;

  let title: string;
  let subtitle: React.ReactNode;
  const hasContext = !!store || !!activeAddress;

  if (resolving) {
    title = 'Đang tìm cửa hàng gần bạn...';
    subtitle = null;
  } else if (hasContext) {
    title = 'Giao đến';
    subtitle = (
      <View style={styles.subRow}>
        <Text style={styles.address} numberOfLines={1}>
          {addressLine ?? store?.storeName ?? 'Địa chỉ của bạn'}
        </Text>
        {store?.distanceKm != null ? (
          <View style={styles.distBadge}>
            <Text style={styles.distText}>{formatDistanceKm(store.distanceKm)}</Text>
          </View>
        ) : null}
      </View>
    );
  } else {
    title = 'Nhập địa chỉ giao hàng';
    subtitle = (
      <Text style={styles.hint}>
        {lastResult?.message ?? 'Hệ thống sẽ tự chọn cửa hàng phù hợp gần bạn.'}
      </Text>
    );
  }

  return (
    <Pressable style={styles.banner} onPress={onChangeAddress} accessibilityRole="button">
      <View style={styles.iconWrap}>
        {resolving ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : (
          <Icon name="map-pin" size={20} color={colors.primary} />
        )}
      </View>
      <View style={styles.flex}>
        <Text style={styles.label}>{title}</Text>
        {subtitle}
        {/* Neu cua hang gan nhat thieu hang -> noti nhe */}
        {hasContext && lastResult?.alternatives?.some((a) => !a.inStock) ? (
          <Text style={styles.note}>
            Một số sản phẩm hết tại cửa hàng gần nhất, hệ thống dùng cửa hàng kế tiếp.
          </Text>
        ) : null}
      </View>
      <Text style={styles.change}>{source === 'none' ? 'Nhập' : 'Đổi'}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: green[50],
    borderWidth: 1,
    borderColor: green[200],
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex: { flex: 1, gap: 2 },
  subRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  label: { fontSize: fontSize.xs, color: colors.primaryDark, fontWeight: '700' },
  address: { fontSize: fontSize.md, fontWeight: '700', color: colors.text, flexShrink: 1 },
  distBadge: { backgroundColor: colors.primaryLight, paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.pill },
  distText: { fontSize: 11, fontWeight: '700', color: colors.primaryDark },
  hint: { fontSize: fontSize.xs, color: colors.textMuted },
  note: { fontSize: fontSize.xs, color: colors.warning },
  change: { fontSize: fontSize.sm, fontWeight: '700', color: colors.primary },
});
