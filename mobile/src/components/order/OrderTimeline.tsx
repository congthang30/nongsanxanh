import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fontSize, spacing } from '../../theme';
import { formatDateTime } from '../../lib/format';
import { ORDER_STATUS_LABEL } from '../../lib/format/status';
import { OrderStatusHistory } from '../../types';

/**
 * Timeline trang thai don hang. Hien moc thoi gian + nhan tieng Viet.
 * Sap xep tu moi nhat -> cu (hoac giu nguyen neu backend da sap).
 */
export function OrderTimeline({ history }: { history?: OrderStatusHistory[] | null }) {
  if (!history || history.length === 0) {
    return <Text style={styles.empty}>Chưa có lịch sử trạng thái.</Text>;
  }
  const items = [...history].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  return (
    <View style={styles.wrap}>
      {items.map((h, idx) => {
        const isLatest = idx === 0;
        return (
          <View key={h.id} style={styles.row}>
            <View style={styles.markerColumn}>
              <View style={[styles.dot, isLatest && styles.dotActive]} />
              {idx < items.length - 1 ? <View style={styles.connector} /> : null}
            </View>
            <View style={styles.content}>
              <Text style={[styles.status, isLatest && styles.statusActive]}>
                {ORDER_STATUS_LABEL[h.toStatus] ?? h.toStatus}
              </Text>
              <Text style={styles.time}>{formatDateTime(h.createdAt)}</Text>
              {h.reason ? <Text style={styles.reason}>{h.reason}</Text> : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 0 },
  empty: { fontSize: fontSize.sm, color: colors.textMuted },
  row: { flexDirection: 'row', gap: spacing.md },
  markerColumn: { alignItems: 'center', width: 16 },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.border,
    marginTop: 3,
  },
  dotActive: { backgroundColor: colors.primary },
  connector: { flex: 1, width: 2, backgroundColor: colors.border, marginVertical: 2 },
  content: { flex: 1, paddingBottom: spacing.lg },
  status: { fontSize: fontSize.sm, color: colors.textMuted, fontWeight: '600' },
  statusActive: { color: colors.text, fontWeight: '800' },
  time: { fontSize: fontSize.xs, color: colors.textMuted },
  reason: { fontSize: fontSize.xs, color: colors.warning, marginTop: 2 },
});
