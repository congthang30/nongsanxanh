import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { api, getErrorMessage } from '../../lib/api';
import { useToastStore } from '../../lib/toast.store';
import { ModalPortal } from '../../components/ModalPortal';

export interface InventoryBatchRow {
  id: string;
  batchCode: string;
  receivedDate: string;
  expiryDate: string;
  quantityOnHand: number;
  reservedQuantity: number;
  available: number;
  status: 'ACTIVE' | 'DEPLETED' | 'BLOCKED';
  isExpired: boolean;
}

export interface StockMovementRow {
  id: string;
  variantId: string;
  sku: string;
  productName: string;
  unit: string;
  quantityOnHand: number;
  reservedQuantity: number;
  available: number;
  batches: InventoryBatchRow[];
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

const dateOnly = (value: string) => value.slice(0, 10);

export function StockMovementModal({
  row,
  mode,
  endpointPrefix = '/warehouse/inventory',
  storeId,
  onClose,
  onDone,
}: Props) {
  const { push } = useToastStore();
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  const [value, setValue] = useState('');
  const [reason, setReason] = useState('');
  const [batchId, setBatchId] = useState('');
  const [batchCode, setBatchCode] = useState('');
  const [receivedDate, setReceivedDate] = useState(today);
  const [expiryDate, setExpiryDate] = useState('');
  const [exportKind, setExportKind] = useState<'EXPORT' | 'LOSS'>('EXPORT');
  const selectedBatch = row.batches.find((batch) => batch.id === batchId);
  const numericValue = Number(value);
  const hasValue = value.trim() !== '';
  const movableQuantity = selectedBatch
    ? Math.max(0, selectedBatch.quantityOnHand - selectedBatch.reservedQuantity)
    : 0;
  const invalidQuantity =
    !hasValue ||
    !Number.isFinite(numericValue) ||
    (mode === 'adjust' ? numericValue < 0 : numericValue <= 0) ||
    (mode === 'export' && numericValue > movableQuantity) ||
    (mode === 'adjust' && !!selectedBatch && numericValue < selectedBatch.reservedQuantity);
  const invalidReason = mode === 'export' && reason.trim().length < 3;
  const invalidBatch =
    mode === 'import'
      ? !batchCode.trim() || !receivedDate || !expiryDate || expiryDate < receivedDate || expiryDate < today
      : !selectedBatch;

  const mutation = useMutation({
    mutationFn: () => {
      const scope = storeId ? { storeId } : {};
      if (mode === 'import') {
        return api.post(endpointPrefix + '/import', {
          ...scope,
          variantId: row.variantId,
          quantity: numericValue,
          batchCode: batchCode.trim(),
          receivedDate,
          expiryDate,
          reason: reason || undefined,
        });
      }
      if (mode === 'adjust') {
        return api.post(endpointPrefix + '/adjust', {
          ...scope,
          variantId: row.variantId,
          batchId,
          newQuantity: numericValue,
          reason: reason || undefined,
        });
      }
      return api.post(endpointPrefix + '/export', {
        ...scope,
        variantId: row.variantId,
        batchId,
        quantity: numericValue,
        reason,
        kind: exportKind,
      });
    },
    onSuccess: () => {
      push(
        mode === 'import'
          ? 'Đã nhập hàng theo lô'
          : mode === 'adjust'
            ? 'Đã kiểm kê lô hàng'
            : exportKind === 'LOSS'
              ? 'Đã ghi nhận hư hỏng theo lô'
              : 'Đã xuất lô hàng',
      );
      onDone();
    },
    onError: (error) => push(getErrorMessage(error), 'error'),
  });

  const submitDisabled = invalidQuantity || invalidReason || invalidBatch || mutation.isPending;
  const title =
    mode === 'import'
      ? 'Nhập lô hàng'
      : mode === 'adjust'
        ? 'Kiểm kê theo lô'
        : 'Xuất / hủy theo lô';

  return (
    <ModalPortal>
      <div className="dash-modal-overlay" onClick={onClose}>
        <div className="dash-modal" onClick={(event) => event.stopPropagation()}>
          <h2>{title}</h2>
          <p className="muted">
            {row.productName} ({row.sku}) · tổng tồn {row.quantityOnHand} {row.unit} · khả dụng {row.available}
          </p>

          {mode === 'import' ? (
            <div className="dash-form-grid" style={{ marginTop: 14 }}>
              <label>
                Mã lô <span style={{ color: '#dc2626' }}>*</span>
                <input
                  id={`stock-batch-code-${row.variantId}`}
                  className="input"
                  maxLength={80}
                  value={batchCode}
                  onChange={(event) => setBatchCode(event.target.value.toUpperCase())}
                  placeholder="VD: LOT-2026-0803-A"
                  autoFocus
                />
              </label>
              <label>
                Ngày nhập <span style={{ color: '#dc2626' }}>*</span>
                <input
                  id={`stock-received-date-${row.variantId}`}
                  className="input"
                  type="date"
                  value={receivedDate}
                  onChange={(event) => setReceivedDate(event.target.value)}
                />
              </label>
              <label>
                Hạn sử dụng <span style={{ color: '#dc2626' }}>*</span>
                <input
                  id={`stock-expiry-date-${row.variantId}`}
                  className="input"
                  type="date"
                  min={receivedDate || today}
                  value={expiryDate}
                  onChange={(event) => setExpiryDate(event.target.value)}
                />
              </label>
              {invalidBatch && (
                <span style={{ color: '#dc2626', fontSize: 12 }}>
                  Nhập mã lô và hạn dùng hợp lệ, không nhận lô đã hết hạn.
                </span>
              )}
            </div>
          ) : (
            <label style={{ display: 'block', marginTop: 14 }}>
              Lô hàng <span style={{ color: '#dc2626' }}>*</span>
              <select
                id={`stock-batch-select-${row.variantId}`}
                className="input"
                value={batchId}
                onChange={(event) => {
                  setBatchId(event.target.value);
                  setValue('');
                }}
                autoFocus
              >
                <option value="">-- Chọn lô cần thao tác --</option>
                {row.batches.map((batch) => (
                  <option
                    key={batch.id}
                    value={batch.id}
                    disabled={mode === 'export' && batch.quantityOnHand <= batch.reservedQuantity}
                  >
                    {batch.batchCode} · HSD {dateOnly(batch.expiryDate)} · tồn {batch.quantityOnHand} · giữ {batch.reservedQuantity}
                    {batch.isExpired ? ' · ĐÃ HẾT HẠN' : ''}
                  </option>
                ))}
              </select>
              {row.batches.length === 0 && (
                <span style={{ display: 'block', marginTop: 5, color: '#dc2626', fontSize: 12 }}>
                  Sản phẩm chưa có lô. Hãy nhập một lô trước.
                </span>
              )}
            </label>
          )}

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
              ? 'Số lượng nhập lô'
              : mode === 'adjust'
                ? 'Tồn thực tế mới của lô'
                : 'Số lượng lấy từ lô'}
            <input
              id={`stock-movement-quantity-${row.variantId}`}
              className="input"
              type="number"
              min={mode === 'adjust' ? selectedBatch?.reservedQuantity ?? 0 : 0.001}
              max={mode === 'export' ? movableQuantity : undefined}
              step="0.001"
              value={value}
              onChange={(event) => setValue(event.target.value)}
              autoFocus={mode === 'import'}
            />
            {invalidQuantity && (
              <span
                className={hasValue ? undefined : 'muted'}
                style={{ display: 'block', marginTop: 4, color: hasValue ? '#dc2626' : undefined, fontSize: 12 }}
              >
                {!hasValue
                  ? 'Nhập số lượng cần xử lý.'
                  : mode === 'export' && numericValue > movableQuantity
                    ? `Lô đã chọn chỉ còn ${movableQuantity} ${row.unit} chưa được giữ.`
                    : mode === 'adjust' && selectedBatch && numericValue < selectedBatch.reservedQuantity
                      ? `Không thể thấp hơn ${selectedBatch.reservedQuantity} ${row.unit} đang giữ cho đơn.`
                      : 'Số lượng không hợp lệ.'}
              </span>
            )}
          </label>

          <label style={{ display: 'block', marginTop: 10 }}>
            Lý do {mode === 'export' && <span style={{ color: '#dc2626' }}>*</span>}
            <input
              id={`stock-movement-reason-${row.variantId}`}
              className="input"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder={mode === 'export' ? 'Bắt buộc, tối thiểu 3 ký tự' : 'Tùy chọn'}
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