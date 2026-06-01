import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Icon } from '../ui/Icon';
import { colors, fontSize, gradients, green, radius, shadow, spacing } from '../../theme';
import { formatVnd } from '../../lib/format';
import { ProductListItem } from '../../types';

/**
 * The san pham — dong bo voi web ProductCard (frontend/src/components/ProductCard.tsx):
 * anh 4:3, badge giam gia / het hang / vung trong, danh muc, sao danh gia,
 * gia (co gach gia goc khi sale) va nut "+" gradient.
 */
export function ProductCard({
  product,
  onPress,
}: {
  product: ProductListItem;
  onPress: () => void;
}) {
  const onSale = product.salePrice != null && product.fromPrice != null && product.salePrice < product.fromPrice;
  const discountPct = onSale
    ? Math.round((1 - (product.salePrice as number) / product.fromPrice) * 100)
    : 0;
  const soldOut = product.available != null && product.available <= 0;

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      onPress={onPress}
      accessibilityRole="button"
    >
      <View style={styles.imageWrap}>
        {product.image ? (
          <Image source={{ uri: product.image }} style={styles.image} resizeMode="cover" />
        ) : (
          <View style={[styles.image, styles.imagePlaceholder]}>
            <Icon name="leaf" size={40} color={green[400]} />
          </View>
        )}

        {product.originRegion ? (
          <View style={styles.originBadge}>
            <Text style={styles.originText} numberOfLines={1}>
              {product.originRegion}
            </Text>
          </View>
        ) : null}

        {onSale ? (
          <LinearGradient colors={gradients.flash} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.flashBadge}>
            <Text style={styles.flashText}>-{discountPct}%</Text>
          </LinearGradient>
        ) : null}

        {soldOut ? (
          <View style={styles.soldOutBadge}>
            <Text style={styles.soldOutText}>Tạm hết</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.body}>
        {product.category ? (
          <Text style={styles.cat} numberOfLines={1}>
            {product.category.name}
          </Text>
        ) : null}
        <Text style={styles.name} numberOfLines={2}>
          {product.name}
        </Text>
        <View style={styles.ratingRow}>
          <Icon name="star" size={13} color={colors.accent} />
          <Text style={styles.rating}>
            {product.ratingAvg > 0 ? product.ratingAvg.toFixed(1) : 'Mới'}
            {product.ratingCount > 0 ? ` (${product.ratingCount})` : ''}
          </Text>
        </View>

        <View style={styles.foot}>
          <View style={styles.priceCol}>
            {onSale ? (
              <>
                <Text style={styles.priceSale}>{formatVnd(product.salePrice as number)}</Text>
                <Text style={styles.priceStrike}>{formatVnd(product.fromPrice)}</Text>
              </>
            ) : (
              <Text style={styles.price}>{formatVnd(product.fromPrice)}</Text>
            )}
            {product.unit ? <Text style={styles.unit}>/{product.unit}</Text> : null}
          </View>
          <LinearGradient colors={gradients.leaf} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.addPill}>
            <Icon name="plus" size={18} color="#04210f" strokeWidth={2.6} />
          </LinearGradient>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    ...shadow.sm,
  },
  pressed: { opacity: 0.92, transform: [{ translateY: 1 }] },
  imageWrap: { position: 'relative', aspectRatio: 4 / 3, backgroundColor: colors.surfaceAlt },
  image: { width: '100%', height: '100%' },
  imagePlaceholder: { alignItems: 'center', justifyContent: 'center', backgroundColor: green[50] },
  originBadge: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    backgroundColor: 'rgba(220,252,231,0.92)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  originText: { fontSize: 11, fontWeight: '700', color: green[800] },
  flashBadge: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  flashText: { fontSize: 11, fontWeight: '800', color: '#fff' },
  soldOutBadge: {
    position: 'absolute',
    bottom: spacing.sm,
    left: spacing.sm,
    backgroundColor: 'rgba(220,38,38,0.92)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.sm,
  },
  soldOutText: { fontSize: 11, fontWeight: '700', color: '#fff' },
  body: { padding: spacing.md, gap: 4 },
  cat: { fontSize: 11, color: colors.primary, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3 },
  name: { fontSize: fontSize.sm, color: colors.text, fontWeight: '600', lineHeight: 19, minHeight: 38 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  rating: { fontSize: fontSize.xs, color: colors.textMuted },
  foot: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: spacing.xs },
  priceCol: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', flex: 1 },
  price: { fontSize: fontSize.md, fontWeight: '800', color: colors.primaryDark },
  priceSale: { fontSize: fontSize.md, fontWeight: '800', color: colors.danger },
  priceStrike: { fontSize: fontSize.xs, color: '#94a3b8', textDecorationLine: 'line-through', marginLeft: 4 },
  unit: { fontSize: fontSize.xs, color: colors.textMuted, marginLeft: 2 },
  addPill: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.sm,
  },
});
