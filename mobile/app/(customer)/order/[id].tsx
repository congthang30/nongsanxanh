import React, { useState } from 'react';
import { Linking, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ordersApi } from '../../../src/lib/api/orders.api';
import { paymentsApi } from '../../../src/lib/api/payments.api';
import { Button } from '../../../src/components/ui/Button';
import { Card } from '../../../src/components/ui/Card';
import { Badge } from '../../../src/components/ui/Badge';
import { Input } from '../../../src/components/ui/Input';
import { SheetModal } from '../../../src/components/ui/SheetModal';
import { ErrorState, LoadingState } from '../../../src/components/ui/States';
import { OrderTimeline } from '../../../src/components/order/OrderTimeline';
import { CheckoutSummary } from '../../../src/components/customer/CheckoutSummary';
import { colors, fontSize, spacing } from '../../../src/theme';
import { formatVnd, formatQty, formatDateTime } from '../../../src/lib/format';
import {
  ORDER_STATUS_LABEL,
  orderStatusTone,
  paymentStatusLabel,
  paymentStatusTone,
  DELIVERY_STATUS_LABEL,
} from '../../../src/lib/format/status';
import { ApiError } from '../../../src/lib/api/client';
import { OrderStatus } from '../../../src/types';

// Trang thai cho phep huy don (truoc khi giao).
const CANCELLABLE: OrderStatus[] = ['PENDING_PAYMENT', 'PLACED', 'STORE_CONFIRMED'];

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [payLoading, setPayLoading] = useState(false);

  const query = useQuery({
    queryKey: ['order', id],
    queryFn: () => ordersApi.detail(id),
    enabled: !!id,
  });

  const cancelMutation = useMutation({
    mutationFn: (reason: string) => ordersApi.cancel(id, reason || undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order', id] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      setCancelOpen(false);
      setCancelReason('');
    },
    onError: (e) => setActionError(e instanceof ApiError ? e.message : 'Không hủy được đơn.'),
  });

  const order = query.data;

  async function retryPayment() {
    if (!order || payLoading) return;
    setPayLoading(true);
    setActionError(null);
    try {
      const pay = await paymentsApi.create(order.id);
      if (pay?.paymentUrl) await Linking.openURL(pay.paymentUrl);
    } catch (e) {
      setActionError(e instanceof ApiError ? e.message : 'Không tạo được thanh toán.');
    } finally {
      setPayLoading(false);
    }
  }

  if (query.isLoading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <TopBar />
        <LoadingState label="Đang tải đơn hàng..." />
      </SafeAreaView>
    );
  }
  if (query.isError || !order) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <TopBar />
        <ErrorState message={(query.error as Error)?.message} onRetry={() => query.refetch()} />
      </SafeAreaView>
    );
  }

  const isVnpay = order.paymentMethod === 'VNPAY';
  const paid = order.paymentStatus === 'SUCCESS';
  const canRetryPayment = isVnpay && !paid && order.status !== 'CANCELLED';
  const canCancel = CANCELLABLE.includes(order.status);
  const delivery = order.delivery;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <TopBar />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={query.isFetching}
            onRefresh={() => query.refetch()}
            tintColor={colors.primary}
          />
        }
      >
        {/* Status header */}
        <View style={styles.headerRow}>
          <View style={styles.flex}>
            <Text style={styles.orderNumber}>Đơn #{order.orderNumber}</Text>
            <Text style={styles.date}>{formatDateTime(order.createdAt)}</Text>
          </View>
          <Badge label={ORDER_STATUS_LABEL[order.status] ?? order.status} tone={orderStatusTone(order.status)} />
        </View>

        {/* Payment summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Thanh toán</Text>
          <Card>
            <View style={styles.row}>
              <Text style={styles.label}>Phương thức</Text>
              <Text style={styles.value}>{isVnpay ? 'VNPay' : 'COD (khi nhận hàng)'}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Trạng thái</Text>
              <Badge label={paymentStatusLabel(order.paymentStatus)} tone={paymentStatusTone(order.paymentStatus)} />
            </View>
            <View style={styles.divider} />
            <CheckoutSummary
              subtotal={order.subtotal}
              discountTotal={order.discountTotal}
              shippingFee={order.shippingFee}
              grandTotal={order.grandTotal}
              itemCount={order.items?.length}
            />
          </Card>
        </View>

        {/* Delivery address */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Địa chỉ giao hàng</Text>
          <Card>
            <Text style={styles.recipient}>{order.recipientName}</Text>
            <Text style={styles.muted}>{order.recipientPhone}</Text>
            <Text style={styles.addressLine}>{order.deliveryAddress}</Text>
          </Card>
        </View>

        {/* Store responsible */}
        {order.store?.name ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Cửa hàng phụ trách</Text>
            <Card>
              <Text style={styles.recipient}>{order.store.name}</Text>
              {order.store.formattedAddress ? (
                <Text style={styles.muted}>{order.store.formattedAddress}</Text>
              ) : null}
            </Card>
          </View>
        ) : null}

        {/* Items */}
        {order.items && order.items.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Sản phẩm</Text>
            <Card>
              {order.items.map((it) => (
                <View key={it.id} style={styles.itemRow}>
                  <View style={styles.flex}>
                    <Text style={styles.itemName} numberOfLines={2}>{it.productNameSnapshot}</Text>
                    <Text style={styles.muted}>
                      {formatQty(it.quantity)} {it.unitSnapshot} × {formatVnd(it.unitPrice)}
                    </Text>
                  </View>
                  <Text style={styles.itemTotal}>{formatVnd(it.lineTotal)}</Text>
                </View>
              ))}
            </Card>
          </View>
        ) : null}

        {/* Delivery status (neu co) */}
        {delivery ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Giao hàng</Text>
            <Card>
              <View style={styles.row}>
                <Text style={styles.label}>Trạng thái giao</Text>
                <Text style={styles.value}>{DELIVERY_STATUS_LABEL[delivery.status] ?? delivery.status}</Text>
              </View>
              {delivery.failureReason ? (
                <Text style={styles.failReason}>Lý do: {delivery.failureReason}</Text>
              ) : null}
              {delivery.deliveredAt ? (
                <View style={styles.row}>
                  <Text style={styles.label}>Thời gian giao</Text>
                  <Text style={styles.value}>{formatDateTime(delivery.deliveredAt)}</Text>
                </View>
              ) : null}
            </Card>
          </View>
        ) : null}

        {/* Order timeline */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Lịch sử đơn hàng</Text>
          <Card>
            <OrderTimeline history={order.statusHistory} />
          </Card>
        </View>

        {actionError ? <Text style={styles.errorText}>{actionError}</Text> : null}

        {/* Actions */}
        {canRetryPayment || canCancel ? (
          <View style={styles.actions}>
            {canRetryPayment ? (
              <Button title="Thanh toán lại" onPress={retryPayment} loading={payLoading} />
            ) : null}
            {canCancel ? (
              <Button title="Hủy đơn" onPress={() => setCancelOpen(true)} variant="danger" />
            ) : null}
          </View>
        ) : null}
      </ScrollView>

      {/* Cancel modal */}
      <SheetModal visible={cancelOpen} title="Hủy đơn hàng" onClose={() => setCancelOpen(false)}>
        <Text style={styles.muted}>Vui lòng cho biết lý do hủy đơn (tùy chọn).</Text>
        <Input
          value={cancelReason}
          onChangeText={setCancelReason}
          placeholder="Lý do hủy đơn"
          multiline
          style={styles.reasonInput}
        />
        <Button
          title="Xác nhận hủy đơn"
          onPress={() => cancelMutation.mutate(cancelReason.trim())}
          variant="danger"
          loading={cancelMutation.isPending}
        />
        <Button title="Đóng" onPress={() => setCancelOpen(false)} variant="ghost" />
      </SheetModal>
    </SafeAreaView>
  );
}

function TopBar() {
  return (
    <View style={styles.topbar}>
      <Text style={styles.back} onPress={() => router.back()}>‹ Quay lại</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  topbar: { padding: spacing.md },
  back: { fontSize: fontSize.md, color: colors.primary, fontWeight: '600' },
  content: { padding: spacing.lg, gap: spacing.xl, paddingBottom: spacing.xxl },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  flex: { flex: 1 },
  orderNumber: { fontSize: fontSize.xl, fontWeight: '800', color: colors.text },
  date: { fontSize: fontSize.xs, color: colors.textMuted },
  section: { gap: spacing.sm },
  sectionTitle: { fontSize: fontSize.md, fontWeight: '700', color: colors.text },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { fontSize: fontSize.sm, color: colors.textMuted },
  value: { fontSize: fontSize.sm, color: colors.text, fontWeight: '600' },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.xs },
  recipient: { fontSize: fontSize.md, fontWeight: '700', color: colors.text },
  muted: { fontSize: fontSize.sm, color: colors.textMuted },
  addressLine: { fontSize: fontSize.sm, color: colors.text, lineHeight: 20 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xs },
  itemName: { fontSize: fontSize.sm, fontWeight: '600', color: colors.text },
  itemTotal: { fontSize: fontSize.sm, fontWeight: '700', color: colors.text },
  failReason: { fontSize: fontSize.sm, color: colors.danger },
  errorText: { color: colors.danger, fontSize: fontSize.sm },
  actions: { gap: spacing.sm },
  reasonInput: { minHeight: 72, paddingTop: spacing.md, textAlignVertical: 'top' },
});
