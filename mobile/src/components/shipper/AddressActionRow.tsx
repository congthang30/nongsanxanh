import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../ui/Button';
import { colors, fontSize, spacing } from '../../theme';
import { openExternalNavigation, callPhone } from '../../lib/maps/navigation';

/**
 * Hang hien dia chi pickup/dropoff kem nut Chi duong + Goi.
 * - Chi duong: mo external maps neu co toa do; neu thieu -> disable kem thong bao.
 * - Goi: mo dialer neu co so dien thoai.
 */
export function AddressActionRow({
  title,
  name,
  phone,
  address,
  lat,
  lng,
}: {
  title: string;
  name?: string | null;
  phone?: string | null;
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
}) {
  const hasCoords = lat != null && lng != null;
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{title}</Text>
      {name ? <Text style={styles.name}>{name}</Text> : null}
      {phone ? <Text style={styles.phone}>{phone}</Text> : null}
      {address ? <Text style={styles.address}>{address}</Text> : null}
      {!hasCoords ? <Text style={styles.noCoords}>Đơn chưa có tọa độ giao hàng</Text> : null}

      <View style={styles.actions}>
        <View style={styles.flex}>
          <Button
            title="Chỉ đường"
            onPress={() => hasCoords && openExternalNavigation(lat!, lng!, name ?? title)}
            variant="secondary"
            disabled={!hasCoords}
          />
        </View>
        {phone ? (
          <View style={styles.flex}>
            <Button title="Gọi" onPress={() => callPhone(phone)} variant="secondary" />
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  title: { fontSize: fontSize.sm, fontWeight: '700', color: colors.textMuted },
  name: { fontSize: fontSize.md, fontWeight: '700', color: colors.text },
  phone: { fontSize: fontSize.sm, color: colors.primary, fontWeight: '600' },
  address: { fontSize: fontSize.sm, color: colors.text, lineHeight: 20 },
  noCoords: { fontSize: fontSize.xs, color: colors.warning },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  flex: { flex: 1 },
});
