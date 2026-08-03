import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { api, getErrorMessage } from '../../lib/api';
import { useToastStore } from '../../lib/toast.store';
import { ModalPortal } from '../../components/ModalPortal';

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
  const hasValue = value.trim() !== '';
  const reasonRequired = mode === 'export';
  const invalidQuantity =
    !hasValue ||
    !Number.isFinite(numericValue) ||
    (mode === 'adjust' ? numericValue < 0 : numericValue <= 0) ||
    (mode === 'export' && numericValue > row.available);
  const invalidReason = reasonRequired && reason.trim().length < 3;

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

  const submitDisabled = invalidQuantity || invalidReason || mutation.isPending;

  const title =
    mode === 'import'
      ? 'Nhập hàng'
      : mode === 'adjust'
        ? 'Kiểm kê / điều chỉnh'
        : 'Xuất kho / ghi nhận hư hỏng';

  return (
    <ModalPortal>
    <div className="dash-modal-overlay" onClick={onClose}>
      <div className="dash-modal" onClick={(event) => event.stopPropagation()}>
        <h2>{title}</h2>
        <p className="muted">
          {row.productName} ({row.sku}) · tồn {row.quantityOnHand} {row.unit} · khả dụng {row.available}
        </p>

        {mode === 'export' && (
          <div className="flex gap-sm" style={{ marginTop: 12 }}>
            <button
              id={`stock-export-kind-${row.variantId}`}
              type="button"
              className={'dash-btn dash-btn-sm ' + (exportKind === 'EXPORT' ? 'dash-btn-primary' : '')}
              onClick={() => setExportKind('EXPORT')}
            >
              Xuất / chuyển đi
            </button>
            <button
              id={`stock-loss-kind-${row.variantId}`}
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
            id={`stock-movement-quantity-${row.variantId}`}
            className="input"
            type="number"
            min={mode === 'adjust' ? 0 : 0.001}
            max={mode === 'export' ? row.available : undefined}
            step="0.001"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            autoFocus
          />
          {invalidQuantity && (
            <span
              className={hasValue ? undefined : 'muted'}
              style={{ display: 'block', marginTop: 4, color: hasValue ? '#dc2626' : undefined, fontSize: 12 }}
            >
              {!hasValue
                ? mode === 'adjust'
                  ? 'Nhập số tồn thực tế sau kiểm kê (có thể bằng 0).'
                  : 'Nhập số lượng lớn hơn 0.'
                : mode === 'export' && numericValue > row.available
                  ? `Chỉ có thể xuất/hủy tối đa ${row.available} ${row.unit}.`
                  : mode === 'adjust'
                    ? 'Tồn thực tế không được là số âm.'
                    : 'Số lượng phải lớn hơn 0.'}
            </span>
          )}
        </label>

        <label style={{ display: 'block', marginTop: 10 }}>
          Lý do {reasonRequired && <span style={{ color: '#dc2626' }}>*</span>}
          <input
            id={`stock-movement-reason-${row.variantId}`}
            className="input"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder={reasonRequired ? 'Bắt buộc, tối thiểu 3 ký tự' : 'Tùy chọn'}
          />
          {invalidReason && (
            <span style={{ display: 'block', marginTop: 4, color: '#dc2626', fontSize: 12 }}>
              Cần nhập lý do tối thiểu 3 ký tự để truy vết xuất/hủy kho.
            </span>
          )}
        </label>



        <div className="flex gap-sm" style={{ marginTop: 16, justifyContent: 'flex-end' }}>
          <button id={`stock-movement-cancel-${row.variantId}`} type="button" className="btn btn-ghost" onClick={onClose}>Đóng</button>
          <button id={`stock-movement-submit-${row.variantId}`} type="button" className="btn btn-primary" disabled={submitDisabled} onClick={() => mutation.mutate()}>
            {mutation.isPending ? 'Đang xử lý...' : 'Xác nhận'}
          </button>
        </div>
      </div>
    </div>
    </ModalPortal>
  );
}