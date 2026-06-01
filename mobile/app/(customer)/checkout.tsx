import React, { useEffect, useMemo, useState } from 'react';
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usersApi } from '../../src/lib/api/users.api';
import { cartApi } from '../../src/lib/api/cart.api';
import { ordersApi } from '../../src/lib/api/orders.api';
import { paymentsApi } from '../../src/lib/api/payments.api';
import { useDeliveryStore } from '../../src/store/delivery.store';
import { Button } from '../../src/components/ui/Button';
import { Card } from '../../src/components/ui/Card';
import { Input } from '../../src/components/ui/Input';
import { Badge } from '../../src/components/ui/Badge';
import { ErrorState, LoadingState } from '../../src/components/ui/States';
import { AddressCard } from '../../src/components/customer/AddressCard';
import { CheckoutSummary } from '../../src/components/customer/CheckoutSummary';
import { PaymentMethodSelector } from '../../src/components/customer/PaymentMethodSelector';
import { AddressResolverSheet } from '../../src/components/customer/AddressResolverSheet';
import { colors, fontSize, spacing } from '../../src/theme';
import { Address, PaymentMethod } from '../../src/types';
import { ApiError } from '../../src/lib/api/client';

export default function CheckoutScreen() {
  const queryClient = useQueryClient();
  const { activeAddress, resolveByAddress } = useDeliveryStore();
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(activeAddress?.id ?? null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('COD');
  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<string | undefined>(undefined);
  const [note, setNote] = useState('');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Danh sach dia chi da luu.
  const addressesQuery = useQuery({
    queryKey: ['addresses'],
    queryFn: () => usersApi.listAddresses(),
  });
  const addresses = useMemo(() => addressesQuery.data ?? [], [addressesQuery.data]);

  // Chon dia chi mac dinh khi load xong (neu chua chon).
  useEffect(() => {
    if (selectedAddressId || addresses.length === 0) return;
    const def = addresses.find((a) => a.isDefault) ?? addresses[0];
    if (def) setSelectedAddressId(def.id);
  }, [addresses, selectedAddressId]);

  const selectedAddress: Address | undefined = addresses.find((a) => a.id === selectedAddressId);

  // Quote: backend resolve store tu addressId (source of truth). Refetch khi doi dia chi/coupon/payment.
  const quoteQuery = useQuery({
    queryKey: ['checkout-quote', selectedAddressId, appliedCoupon, paymentMethod],
    queryFn: () =>
      cartApi.checkoutQuote({
        addressId: selectedAddressId!,
        couponCode: appliedCoupon,
        paymentMethod,
      }),
    enabled: !!selectedAddressId,
    retry: false,
  });

  const quote = quoteQuery.data;
  const serviceable = quote?.serviceable !== false; // undefined coi nhu serviceable (backend khong tra)
  const quoteStore = quote?.selectedStore ?? quote?.autoAssignedStore ?? null;

  const placeMutation = useMutation({
    mutationFn: () =>
      ordersApi.create({
        addressId: selectedAddressId!,
        paymentMethod,
        couponCode: appliedCoupon || undefined,
        note: note.trim() || undefined,
      }),
  });

  async function onPlaceOrder() {
    if (!selectedAddressId || placing) return;
    setPlacing(true);
    setSubmitError(null);
    try {
      const order = await placeMutation.mutateAsync();
      // Invalidate cart + orders sau khi dat thanh cong.
      queryClient.invalidateQueries({ queryKey: ['cart'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });

      if (paymentMethod === 'VNPAY') {
        try {
          const pay = await paymentsApi.create(order.id);
          if (pay?.paymentUrl) {
            await Linking.openURL(pay.paymentUrl);
          }
        } catch {
          // Khong fake thanh cong: van chuyen sang order detail de user bam "kiem tra lai".
        }
      }
      router.replace({ pathname: '/(customer)/order/[id]', params: { id: order.id } });
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'Không đặt được đơn. Vui lòng thử lại.';
      setSubmitError(msg);
    } finally {
      setPlacing(false);
    }
  }

  function applyCoupon() {
    setAppliedCoupon(couponInput.trim() || undefined);
  }

  // Khi chon dia chi moi tu sheet -> dong bo voi delivery store de cart/quote nhat quan.
  async function onPickAddressFromList(addr: Address) {
    setSelectedAddressId(addr.id);
    try {
      await resolveByAddress(addr);
    } catch {
      // resolve loi se the hien qua quote error
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topbar}>
        <Text style={styles.back} onPress={() => router.back()}>‹ Quay lại</Text>
        <Text style={styles.title}>Thanh toán</Text>
      </View>

      {addressesQuery.isLoading ? (
        <LoadingState label="Đang tải thông tin..." />
      ) : (
        <>
          <ScrollView contentContainerStyle={styles.content}>
            {/* 1. Dia chi giao hang */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Địa chỉ giao hàng</Text>
                <Text style={styles.link} onPress={() => router.push('/(customer)/addresses')}>
                  Quản lý
                </Text>
              </View>
              {addresses.length === 0 ? (
                <Card>
                  <Text style={styles.muted}>Bạn chưa có địa chỉ giao hàng.</Text>
                  <Button title="Thêm địa chỉ giao hàng" onPress={() => setSheetOpen(true)} />
                </Card>
              ) : (
                <>
                  {addresses.map((addr) => (
                    <AddressCard
                      key={addr.id}
                      address={addr}
                      selected={addr.id === selectedAddressId}
                      onPress={() => onPickAddressFromList(addr)}
                    />
                  ))}
                  <Button
                    title="Thêm địa chỉ khác"
                    onPress={() => setSheetOpen(true)}
                    variant="ghost"
                  />
                </>
              )}
            </View>

            {/* 2. Cua hang phu trach (read-only) + serviceable */}
            {selectedAddressId ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Cửa hàng phụ trách</Text>
                <Card>
                  {quoteQuery.isLoading ? (
                    <Text style={styles.muted}>Đang kiểm tra cửa hàng và phí giao...</Text>
                  ) : quoteQuery.isError ? (
                    <Text style={styles.errorText}>
                      {(quoteQuery.error as ApiError)?.message ?? 'Không kiểm tra được đơn.'}
                    </Text>
                  ) : (
                    <>
                      <View style={styles.storeRow}>
                        <Text style={styles.storeName}>
                          {quoteStore?.storeName ?? quote?.storeName ?? 'Hệ thống tự chọn'}
                        </Text>
                        {serviceable ? (
                          <Badge label="Có thể giao" tone="success" />
                        ) : (
                          <Badge label="Không phục vụ" tone="danger" />
                        )}
                      </View>
                      <Text style={styles.hint}>Hệ thống tự chọn theo địa chỉ và tồn kho</Text>
                      {!serviceable && quote?.message ? (
                        <Text style={styles.errorText}>{quote.message}</Text>
                      ) : null}
                    </>
                  )}
                </Card>
              </View>
            ) : null}

            {/* 3. Phuong thuc thanh toan */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Phương thức thanh toán</Text>
              <PaymentMethodSelector value={paymentMethod} onChange={setPaymentMethod} />
            </View>

            {/* 4. Ma giam gia */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Mã giảm giá</Text>
              <View style={styles.couponRow}>
                <View style={styles.flex}>
                  <Input
                    value={couponInput}
                    onChangeText={setCouponInput}
                    placeholder="Nhập mã giảm giá"
                    autoCapitalize="characters"
                  />
                </View>
                <Button title="Áp dụng" onPress={applyCoupon} fullWidth={false} variant="secondary" />
              </View>
              {appliedCoupon ? (
                <Text style={styles.couponApplied}>Đã áp dụng mã: {appliedCoupon}</Text>
              ) : null}
            </View>

            {/* 5. Ghi chu */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Ghi chú</Text>
              <Input
                value={note}
                onChangeText={setNote}
                placeholder="Ghi chú cho đơn hàng (tùy chọn)"
                multiline
                style={styles.noteInput}
              />
            </View>

            {/* 6. Tom tat tien */}
            {quote ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Tóm tắt đơn hàng</Text>
                <Card>
                  <CheckoutSummary
                    subtotal={quote.subtotal}
                    discountTotal={quote.discountTotal}
                    shippingFee={quote.shippingFee}
                    grandTotal={quote.grandTotal ?? quote.total}
                  />
                </Card>
              </View>
            ) : null}

            {submitError ? <Text style={styles.errorText}>{submitError}</Text> : null}
          </ScrollView>

          {/* Submit bar */}
          <View style={styles.footer}>
            <Button
              title={paymentMethod === 'VNPAY' ? 'Đặt hàng & thanh toán VNPay' : 'Đặt hàng (COD)'}
              onPress={onPlaceOrder}
              large
              loading={placing}
              disabled={
                placing ||
                !selectedAddressId ||
                quoteQuery.isLoading ||
                quoteQuery.isError ||
                !serviceable
              }
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
  topbar: { padding: spacing.md, gap: spacing.xs },
  back: { fontSize: fontSize.md, color: colors.primary, fontWeight: '600' },
  title: { fontSize: fontSize.xl, fontWeight: '800', color: colors.text, paddingHorizontal: spacing.xs },
  content: { padding: spacing.lg, gap: spacing.xl, paddingBottom: spacing.xxl },
  section: { gap: spacing.sm },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { fontSize: fontSize.md, fontWeight: '700', color: colors.text },
  link: { fontSize: fontSize.sm, color: colors.primary, fontWeight: '600' },
  muted: { fontSize: fontSize.sm, color: colors.textMuted },
  hint: { fontSize: fontSize.xs, color: colors.textMuted },
  storeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  storeName: { fontSize: fontSize.md, fontWeight: '700', color: colors.text, flexShrink: 1 },
  couponRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  flex: { flex: 1 },
  couponApplied: { fontSize: fontSize.xs, color: colors.primaryDark, fontWeight: '600' },
  noteInput: { minHeight: 72, paddingTop: spacing.md, textAlignVertical: 'top' },
  errorText: { color: colors.danger, fontSize: fontSize.sm },
  footer: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
});
