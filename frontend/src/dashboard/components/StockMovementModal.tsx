import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { api, getErrorMessage } from '../../lib/api';
import { useToastStore } from '../../lib/toast.store';

export interface StockMovementRow {
  id: string;
  variantId: string;
  sku: string;
  productName: string;
  unit: string;
  quantityOnHand: number;
  reservedQuantity: number;
  available: number;
}

export type StockMovementMode = 'import' | 'adjust' | 'export';

interface Props {
  row: StockMovementRow;
  mode: StockMovementMode;
  endpointPrefix?: '/warehouse/inventory' | '/admin/inventory';
  storeId?: string;
  onClose: () => void;
  onDone: () => void;
}

export function StockMovementModal({
  row,
  mode,
  endpointPrefix = '/warehouse/inventory',
  storeId,
  onClose,
  onDone,
}: Props) {
  const { push } = useToastStore();
  const [value, setValue] = useState('');
  const [reason, setReason] = useState('');
  const [exportKind, setExportKind] = useState<'EXPORT' | 'LOSS'>('EXPORT');
  const numericValue = Number(value);

  const mutation = useMutation({
    mutationFn: () => {
      const scope = storeId ? { storeId } : {};
      if (mode === 'import') {
        return api.post(endpointPrefix + '/import', {
          ...scope,
          variantId: row.variantId,
          quantity: numericValue,
          reason: reason || undefined,
        });
      }
      if (mode === 'adjust') {
        return api.post(endpointPrefix + '/adjust', {
          ...scope,
          variantId: row.variantId,
          newQuantity: numericValue,
          reason,
        });
      }
      return api.post(endpointPrefix + '/export', {
        ...scope,
        variantId: row.variantId,
        quantity: numericValue,
        reason,
        kind: exportKind,
      });
    },
    onSuccess: () => {
      push(
        mode === 'import'
          ? 'Đã nhập hàng'
          : mode === 'adjust'
            ? 'Đã điều chỉnh tồn kho'
            : exportKind === 'LOSS'
              ? 'Đã ghi nhận hư hỏng'
              : 'Đã xuất kho',
      );
      onDone();
    },
    onError: (error) => push(getErrorMessage(error), 'error'),
  });

  const reasonRequired = mode === 'export' || mode === 'adjust';
  const invalidQuantity =
    !Number.isFinite(numericValue) ||
    (mode === 'adjust' ? numericValue < 0 : numericValue <= 0) ||
    (mode === 'export' && numericValue > row.available);
  const submitDisabled =
    invalidQuantity ||
    (reasonRequired && reason.trim().length < 3) ||
    mutation.isPending;

  const title =
    mode === 'import'
      ? 'Nhập hàng'
      : mode === 'adjust'
        ? 'Kiểm kê / điều chỉnh'
        : 'Xuất kho / ghi nhận hư hỏng';

  return (
    <div className="dash-modal-overlay" onClick={onClose}>
      <div className="dash-modal" onClick={(event) => event.stopPropagation()}>
        <h2>{title}</h2>
        <p className="muted">
          {row.productName} ({row.sku}) · tồn {row.quantityOnHand} {row.unit} · khả dụng {row.available}
        </p>

        {mode === 'export' && (
          <div className="flex gap-sm" style={{ marginTop: 12 }}>
            <button
              type="button"
              className={'dash-btn dash-btn-sm ' + (exportKind === 'EXPORT' ? 'dash-btn-primary' : '')}
              onClick={() => setExportKind('EXPORT')}
            >
              Xuất / chuyển đi
            </button>
            <button
              type="button"
              className={'dash-btn dash-btn-sm ' + (exportKind === 'LOSS' ? 'dash-btn-primary' : '')}
              onClick={() => setExportKind('LOSS')}
            >
              Hư hỏng / mất
            </button>
          </div>
        )}

        <label style={{ display: 'block', marginTop: 12 }}>
          {mode === 'import'
            ? 'Số lượng nhập thêm'
            : mode === 'adjust'
              ? 'Số lượng tồn thực tế mới'
              : 'Số lượng xuất / đánh hỏng'}
          <input
            className="input"
            type="number"
            min={mode === 'adjust' ? 0 : 0.001}
            step="0.001"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            autoFocus
          />
        </label>

        <label style={{ display: 'block', marginTop: 10 }}>
          Lý do {reasonRequired && <span style={{ color: '#dc2626' }}>*</span>}
          <input
            className="input"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder={reasonRequired ? 'VD: kiểm kê, điều chuyển, hết hạn...' : 'Tùy chọn'}
          />
        </label>

        {mode === 'export' && numericValue > row.available && (
          <p style={{ color: '#dc2626', marginTop: 8 }}>Số lượng xuất vượt tồn khả dụng.</p>
        )}

        <div className="flex gap-sm" style={{ marginTop: 16, justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost" onClick={onClose}>Hủy</button>
          <button className="btn btn-primary" disabled={submitDisabled} onClick={() => mutation.mutate()}>
            {mutation.isPending ? 'Đang xử lý...' : 'Xác nhận'}
          </button>
        </div>
      </div>
    </div>
  );
}