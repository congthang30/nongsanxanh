import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '../ui/Button';
import { CodConfirmSheet } from './CodConfirmSheet';
import { FailReasonSheet } from './FailReasonSheet';
import { shipperApi } from '../../lib/api/shipper.api';
import { colors, fontSize, spacing } from '../../theme';
import { ApiError } from '../../lib/api/client';
import { DeliveryJob } from '../../types';

type Pending = null | 'picked' | 'out' | 'arrived' | 'delivered' | 'failed';

/**
 * Panel hanh dong trang thai giao hang cho shipper.
 * Tuan theo bang chuyen trang thai trong spec muc 9.4.
 * COD: bat buoc xac nhan thu du tien truoc khi delivered.
 * Failed: bat buoc nhap ly do.
 */
export function DeliveryActionPanel({
  job,
  onUpdated,
}: {
  job: DeliveryJob;
  onUpdated?: (job: DeliveryJob) => void;
}) {
  const queryClient = useQueryClient();
  const [pending, setPending] = useState<Pending>(null);
  const [codOpen, setCodOpen] = useState(false);
  const [failOpen, setFailOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isCod =
    (job.codAmount != null && job.codAmount > 0) || job.order?.paymentMethod === 'COD';

  function invalidate(updated: DeliveryJob) {
    queryClient.invalidateQueries({ queryKey: ['shipper-jobs'] });
    queryClient.invalidateQueries({ queryKey: ['shipper-job', job.id] });
    onUpdated?.(updated);
  }

  async function run(kind: Exclude<Pending, null>, fn: () => Promise<DeliveryJob>) {
    setPending(kind);
    setError(null);
    try {
      const updated = await fn();
      invalidate(updated);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Không cập nhật được trạng thái.');
    } finally {
      setPending(null);
    }
  }

  function onPressDelivered() {
    setError(null);
    if (isCod) {
      setCodOpen(true);
    } else {
      void run('delivered', () => shipperApi.delivered(job.id));
    }
  }

  async function confirmCodCollected() {
    setCodOpen(false);
    await run('delivered', () => shipperApi.delivered(job.id, true));
  }

  function codNotCollected() {
    // Chua thu duoc tien -> chuyen sang flow bao that bai (khong fake delivered).
    setCodOpen(false);
    setFailOpen(true);
  }

  async function submitFailed(reason: string) {
    setFailOpen(false);
    await run('failed', () => shipperApi.failed(job.id, reason));
  }

  const status = job.status;
  const showFailed = status === 'OUT_FOR_DELIVERY' || status === 'ARRIVED_AT_CUSTOMER';

  // Trang thai cuoi -> khong con hanh dong.
  if (status === 'DELIVERED' || status === 'FAILED') {
    return null;
  }

  return (
    <View style={styles.wrap}>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {status === 'ASSIGNED' ? (
        <Button
          title="Đã lấy hàng"
          onPress={() => run('picked', () => shipperApi.pickedFromStore(job.id))}
          loading={pending === 'picked'}
          large
        />
      ) : null}

      {status === 'PICKED_FROM_STORE' ? (
        <Button
          title="Bắt đầu giao"
          onPress={() => run('out', () => shipperApi.outForDelivery(job.id))}
          loading={pending === 'out'}
          large
        />
      ) : null}

      {status === 'OUT_FOR_DELIVERY' ? (
        <Button
          title="Đã đến nơi"
          onPress={() => run('arrived', () => shipperApi.arrived(job.id))}
          loading={pending === 'arrived'}
          variant="secondary"
        />
      ) : null}

      {(status === 'OUT_FOR_DELIVERY' || status === 'ARRIVED_AT_CUSTOMER') ? (
        <Button
          title="Giao thành công"
          onPress={onPressDelivered}
          loading={pending === 'delivered'}
          large
        />
      ) : null}

      {showFailed ? (
        <Button
          title="Giao thất bại"
          onPress={() => setFailOpen(true)}
          variant="danger"
          disabled={pending !== null}
        />
      ) : null}

      <CodConfirmSheet
        visible={codOpen}
        amount={job.codAmount ?? job.order?.grandTotal ?? 0}
        loading={pending === 'delivered'}
        onConfirmCollected={confirmCodCollected}
        onNotCollected={codNotCollected}
        onClose={() => setCodOpen(false)}
      />
      <FailReasonSheet
        visible={failOpen}
        loading={pending === 'failed'}
        onSubmit={submitFailed}
        onClose={() => setFailOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  error: { color: colors.danger, fontSize: fontSize.sm },
});
