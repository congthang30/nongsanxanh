import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Badge } from '../ui/Badge';
import { colors, fontSize, radius, spacing } from '../../theme';
import { formatVnd } from '../../lib/format';
import { ProductListItem } from '../../types';

export function ProductCard({
  product,
  onPress,
}: {
  product: ProductListItem;
  onPress: () => void;
}) {
  const inStock = product.available > 0;
  return (
    <Pressable style={styles.card} onPress={onPress}>
      <View style={styles.imageWrap}>
        {product.image ? (
          <Image source={{ uri: product.image }} style={styles.image} resizeMode="cover" />
        ) : (
          <View style={[styles.image, styles.imagePlaceholder]}>
            <Text style={styles.placeholderText}>🥬</Text>
          </View>
        )}
        {inStock ? (
          <Badge label="Co the giao" tone="success" style={styles.badge} />
        ) : (
          <Badge label="Het hang" tone="danger" style={styles.badge} />
        )}
      </View>
      <Text style={styles.name} numberOfLines={2}>
        {product.name}
      </Text>
      <View style={styles.priceRow}>
        <Text style={styles.price}>{formatVnd(product.salePrice ?? product.fromPrice)}</Text>
        <Text style={styles.unit}>/ {product.unit}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.xs,
  },
  imageWrap: { position: 'relative' },
  image: { width: '100%', aspectRatio: 1, borderRadius: radius.sm, backgroundColor: colors.background },
  imagePlaceholder: { alignItems: 'center', justifyContent: 'center' },
  placeholderText: { fontSize: 36 },
  badge: { position: 'absolute', top: spacing.xs, left: spacing.xs },
  name: { fontSize: fontSize.sm, color: colors.text, fontWeight: '600', minHeight: 38 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 2 },
  price: { fontSize: fontSize.md, fontWeight: '800', color: colors.primary },
  unit: { fontSize: fontSize.xs, color: colors.textMuted },
});
