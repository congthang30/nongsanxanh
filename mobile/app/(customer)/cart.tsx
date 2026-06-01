import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { cartApi } from '../../src/lib/api/cart.api';
import { useDeliveryStore } from '../../src/store/delivery.store';
import { useAuthStore } from '../../src/store/auth.store';
import { Button } from '../../src/components/ui/Button';
import { Card } from '../../src/components/ui/Card';
import { EmptyState, ErrorState, LoadingState } from '../../src/components/ui/States';
import { StoreResolveBanner } from '../../src/components/customer/StoreResolveBanner';
import { AddressResolverSheet } from '../../src/components/customer/AddressResolverSheet';
import { Icon } from '../../src/components/ui/Icon';
import { colors, fontSize, radius, spacing } from '../../src/theme';
import { formatVnd, formatQty } from '../../src/lib/format';
import { CartItem } from '../../src/types';

export default function CartScreen() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const { store, activeAddress } = useDeliveryStore();
  const [sheetOpen, setSheetOpen] = useState(false);

  const cartQuery = useQuery({ queryKey: ['cart'], queryFn: () => cartApi.get() });

  // Revalidate khi man hinh focus + co dia chi/store (theo spec: truoc checkout).
  useFocusEffect(
    React.useCallback(() => {
      if (store?.storeId || activeAddress?.id) {
        cartApi
          .revalidate({ storeId: store?.storeId, addressId: activeAddress?.id })
          .then(() => queryClient.invalidateQueries({ queryKey: ['cart'] }))
          .catch(() => {});
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [store?.storeId, activeAddress?.id]),
  );

  const updateMutation = useMutation({
    mutationFn: ({ id, quantity }: { id: string; quantity: number }) => cartApi.updateItem(id, quantity),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cart'] }),
  });
  const removeMutation = useMutation({
    mutationFn: (id: string) => cartApi.removeItem(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cart'] }),
  });

  const cart = cartQuery.data;
  const items = cart?.items ?? [];
  const subtotal =
    cart?.subtotal ??
    items.reduce((sum, it) => sum + (it.lineTotal ?? (it.unitPrice ?? it.unitPriceSnapshot ?? 0) * it.quantity), 0);

  function itemName(it: CartItem) {
    return it.productName ?? it.productNameSnapshot ?? 'Sản phẩm';
  }

  function goCheckout() {
    if (!user) {
      router.push('/(auth)/login');
      return;
    }
    router.push('/(customer)/checkout');
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Giỏ hàng</Text>
        <StoreResolveBanner onChangeAddress={() => setSheetOpen(true)} />
      </View>

      {cartQuery.isLoading ? (
        <LoadingState />
      ) : cartQuery.isError ? (
        <ErrorState message={(cartQuery.error as Error).message} onRetry={() => cartQuery.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState
          title="Giỏ hàng trống"
          description="Thêm sản phẩm để bắt đầu."
          actionLabel="Xem sản phẩm"
          onAction={() => router.push('/(customer)/products')}
        />
      ) : (
        <>
          <ScrollView contentContainerStyle={styles.content}>
            {/* Canh bao revalidate (vd doi store fulfillment) */}
            {cart?.warnings?.map((w, i) => (
              <View key={i} style={styles.warning}>
                <Icon name="warning" size={16} color={colors.warning} />
                <Text style={styles.warningText}>{w}</Text>
              </View>
            ))}
            {cart?.blockingIssues?.map((w, i) => (
              <View key={`b${i}`} style={styles.blocking}>
                <Icon name="block" size={16} color={colors.danger} />
                <Text style={styles.blockingText}>{w}</Text>
              </View>
            ))}

            {items.map((it) => {
              const unavailable = it.available != null && it.available < it.quantity;
              return (
                <Card key={it.id} style={unavailable ? styles.cardError : undefined}>
                  <Text style={styles.itemName}>{itemName(it)}</Text>
                  <Text style={styles.itemMeta}>
                    {formatVnd(it.unitPrice ?? it.unitPriceSnapshot)} {it.unit ? `/ ${it.unit}` : ''}
                  </Text>
                  {unavailable ? (
                    <Text style={styles.itemWarn}>Chỉ còn {it.available}. Giảm số lượng hoặc xóa.</Text>
                  ) : null}
                  <View style={styles.itemFooter}>
                    <View style={styles.qtyRow}>
                      <Pressable
                        style={styles.qtyBtn}
                        onPress={() => updateMutation.mutate({ id: it.id, quantity: Math.max(1, it.quantity - 1) })}
                      >
                        <Icon name="minus" size={18} color={colors.primaryDark} strokeWidth={2.4} />
                      </Pressable>
                      <Text style={styles.qtyValue}>{formatQty(it.quantity)}</Text>
                      <Pressable
                        style={styles.qtyBtn}
                        onPress={() => updateMutation.mutate({ id: it.id, quantity: it.quantity + 1 })}
                      >
                        <Icon name="plus" size={18} color={colors.primaryDark} strokeWidth={2.4} />
                      </Pressable>
                    </View>
                    <Text style={styles.remove} onPress={() => removeMutation.mutate(it.id)}>
                      Xóa
                    </Text>
                  </View>
                </Card>
              );
            })}
          </ScrollView>

          <View style={styles.footer}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Tạm tính</Text>
              <Text style={styles.summaryValue}>{formatVnd(subtotal)}</Text>
            </View>
            <Text style={styles.feeNote}>Phí giao hàng được tính ở bước thanh toán</Text>
            <Button
              title="Tiến hành đặt hàng"
              onPress={goCheckout}
              large
              disabled={(cart?.blockingIssues?.length ?? 0) > 0}
            />
          </View>
        </>
      )}

      <AddressResolverSheet visible={sheetOpen} onClose={() => setSheetOpen(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: { padding: spacing.lg, gap: spacing.md },
  title: { fontSize: fontSize.xl, fontWeight: '800', color: colors.text },
  content: { padding: spacing.lg, gap: spacing.md },
  warning: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.warningLight, padding: spacing.sm, borderRadius: radius.sm },
  warningText: { flex: 1, color: colors.warning, fontSize: fontSize.sm },
  blocking: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.dangerLight, padding: spacing.sm, borderRadius: radius.sm },
  blockingText: { flex: 1, color: colors.danger, fontSize: fontSize.sm },
  cardError: { borderColor: colors.danger },
  itemName: { fontSize: fontSize.md, fontWeight: '700', color: colors.text },
  itemMeta: { fontSize: fontSize.sm, color: colors.textMuted },
  itemWarn: { fontSize: fontSize.xs, color: colors.danger },
  itemFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.xs },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  qtyBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primaryLight },
  qtyValue: { fontSize: fontSize.md, fontWeight: '700', minWidth: 28, textAlign: 'center' },
  remove: { color: colors.danger, fontSize: fontSize.sm, fontWeight: '600' },
  footer: { padding: spacing.lg, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface, gap: spacing.md },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between' },
  summaryLabel: { fontSize: fontSize.md, color: colors.textMuted },
  summaryValue: { fontSize: fontSize.lg, fontWeight: '800', color: colors.text },
  feeNote: { fontSize: fontSize.xs, color: colors.textMuted },
});
