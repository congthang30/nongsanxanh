import React, { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDeliveryStore } from '../../../src/store/delivery.store';
import { productsApi } from '../../../src/lib/api/products.api';
import { cartApi } from '../../../src/lib/api/cart.api';
import { Button } from '../../../src/components/ui/Button';
import { Badge } from '../../../src/components/ui/Badge';
import { ErrorState, LoadingState } from '../../../src/components/ui/States';
import { Icon } from '../../../src/components/ui/Icon';
import { colors, fontSize, green, radius, spacing } from '../../../src/theme';
import { formatVnd } from '../../../src/lib/format';

export default function ProductDetailScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const store = useDeliveryStore((s) => s.store);
  const queryClient = useQueryClient();
  const [variantId, setVariantId] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  const [toast, setToast] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ['product', store?.storeId, slug],
    queryFn: () => productsApi.detailByStore(store!.storeId, slug),
    enabled: !!store?.storeId && !!slug,
  });

  const product = query.data;
  const selectedVariant =
    product?.variants.find((v) => v.id === variantId) ?? product?.variants[0] ?? null;
  const allOutOfStock = !!product && product.variants.every((v) => v.available <= 0);

  const addMutation = useMutation({
    mutationFn: () =>
      cartApi.addItem({ variantId: selectedVariant!.id, quantity: qty }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cart'] });
      setToast('Đã thêm vào giỏ');
      setTimeout(() => setToast(null), 1500);
    },
  });

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.topbar}>
        <Pressable style={styles.backBtn} onPress={() => router.back()} accessibilityRole="button">
          <Icon name="chevron-left" size={20} color={colors.primaryDark} strokeWidth={2.4} />
          <Text style={styles.back}>Quay lại</Text>
        </Pressable>
      </View>

      {query.isLoading ? (
        <LoadingState />
      ) : query.isError || !product ? (
        <ErrorState message={(query.error as Error)?.message} onRetry={() => query.refetch()} />
      ) : (
        <>
          <ScrollView contentContainerStyle={styles.content}>
            {product.images[0] ? (
              <Image source={{ uri: product.images[0].url }} style={styles.image} resizeMode="cover" />
            ) : (
              <View style={[styles.image, styles.imagePlaceholder]}>
                <Icon name="leaf" size={64} color={green[400]} />
              </View>
            )}

            <Text style={styles.name}>{product.name}</Text>
            <Text style={styles.store}>Cửa hàng phụ trách: {product.store.name}</Text>

            {selectedVariant ? (
              <View style={styles.priceRow}>
                <Text style={styles.price}>{formatVnd(selectedVariant.price)}</Text>
                <Text style={styles.unit}>/ {selectedVariant.unit}</Text>
              </View>
            ) : null}

            {/* Variants */}
            {product.variants.length > 1 ? (
              <View style={styles.variants}>
                <Text style={styles.label}>Lựa chọn</Text>
                <View style={styles.variantRow}>
                  {product.variants.map((v) => {
                    const active = v.id === (selectedVariant?.id ?? '');
                    const disabled = v.available <= 0;
                    return (
                      <Text
                        key={v.id}
                        onPress={() => !disabled && setVariantId(v.id)}
                        style={[
                          styles.variantChip,
                          active && styles.variantChipActive,
                          disabled && styles.variantChipDisabled,
                        ]}
                      >
                        {v.unit} {disabled ? '(hết)' : ''}
                      </Text>
                    );
                  })}
                </View>
              </View>
            ) : null}

            {/* Ton kha dung */}
            {selectedVariant ? (
              selectedVariant.available > 0 ? (
                <Badge label={`Còn ${selectedVariant.available} ${selectedVariant.unit}`} tone="success" />
              ) : (
                <Badge label="Hết hàng tại cửa hàng này" tone="danger" />
              )
            ) : null}

            {product.description ? <Text style={styles.desc}>{product.description}</Text> : null}
            {product.originRegion ? (
              <Text style={styles.meta}>Xuất xứ: {product.originRegion}</Text>
            ) : null}
            {product.storageInstruction ? (
              <Text style={styles.meta}>Bảo quản: {product.storageInstruction}</Text>
            ) : null}
          </ScrollView>

          {/* Add to cart bar */}
          <View style={styles.footer}>
            <View style={styles.qtyRow}>
              <Pressable style={styles.qtyBtn} onPress={() => setQty((q) => Math.max(1, q - 1))}>
                <Icon name="minus" size={18} color={colors.primaryDark} strokeWidth={2.4} />
              </Pressable>
              <Text style={styles.qtyValue}>{qty}</Text>
              <Pressable style={styles.qtyBtn} onPress={() => setQty((q) => q + 1)}>
                <Icon name="plus" size={18} color={colors.primaryDark} strokeWidth={2.4} />
              </Pressable>
            </View>
            <View style={styles.flex}>
              <Button
                title={allOutOfStock ? 'Hết hàng' : toast ?? 'Thêm vào giỏ'}
                onPress={() => addMutation.mutate()}
                loading={addMutation.isPending}
                disabled={allOutOfStock || !selectedVariant || selectedVariant.available <= 0}
              />
            </View>
          </View>
          {addMutation.isError ? (
            <Text style={styles.error}>{(addMutation.error as Error).message}</Text>
          ) : null}
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  topbar: { padding: spacing.md },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 2, alignSelf: 'flex-start' },
  back: { fontSize: fontSize.md, color: colors.primaryDark, fontWeight: '700' },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  image: { width: '100%', aspectRatio: 1, borderRadius: radius.lg, backgroundColor: colors.background },
  imagePlaceholder: { alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: fontSize.xl, fontWeight: '800', color: colors.text },
  store: { fontSize: fontSize.sm, color: colors.textMuted },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.xs },
  price: { fontSize: fontSize.xxl, fontWeight: '800', color: colors.primary },
  unit: { fontSize: fontSize.md, color: colors.textMuted },
  variants: { gap: spacing.sm },
  label: { fontSize: fontSize.sm, fontWeight: '700', color: colors.textMuted },
  variantRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  variantChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    overflow: 'hidden',
  },
  variantChipActive: { borderColor: colors.primary, backgroundColor: colors.primaryLight, color: colors.primaryDark },
  variantChipDisabled: { opacity: 0.4 },
  desc: { fontSize: fontSize.sm, color: colors.text, lineHeight: 22 },
  meta: { fontSize: fontSize.sm, color: colors.textMuted },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  flex: { flex: 1 },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  qtyBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primaryLight },
  qtyValue: { fontSize: fontSize.lg, fontWeight: '700', minWidth: 24, textAlign: 'center' },
  error: { color: colors.danger, fontSize: fontSize.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
});
