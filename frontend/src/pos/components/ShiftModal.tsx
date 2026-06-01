import { useEffect, useRef, useState } from 'react';
import { formatVnd } from '../../lib/format';
import { CashierShift } from '../pos.api';

/**
 * Modal mo ca (nhap tien dau ca) hoac dong ca (nhap tien dem duoc).
 * Khi dong ca hien expected vs counted + chenh lech.
 */
export function ShiftModal({
  mode,
  shift,
  loading,
  onConfirm,
  onClose,
}: {
  mode: 'open' | 'close';
  shift?: CashierShift | null;
  loading?: boolean;
  onConfirm: (amount: number, note?: string) => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState('');
  const [note, setNote] = useState('');
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);

  const amount = parseInt(value || '0', 10);
  const expected = shift?.expectedCash ?? 0;
  const diff = mode === 'close' ? amount - expected : 0;

  return (
    <div className="pos-modal-overlay" onClick={onClose}>
      <div className="pos-modal" onClick={(e) => e.stopPropagation()}>
        <h3>{mode === 'open' ? 'Mở ca bán hàng' : 'Đóng ca bán hàng'}</h3>
        <p className="sub">
          {mode === 'open'
            ? 'Nhập số tiền mặt đầu ca trong ngăn kéo'
            : 'Đếm tiền mặt thực tế trong ngăn kéo để đối soát'}
        </p>

        {mode === 'close' && shift && (
          <>
            <div className="pos-sum-row">
              <span>Tiền đầu ca</span>
              <b className="pos-tabular">{formatVnd(shift.openingCash)}</b>
            </div>
            <div className="pos-sum-row">
              <span>Doanh thu tiền mặt</span>
              <b className="pos-tabular">{formatVnd(expected - shift.openingCash)}</b>
            </div>
            <div className="pos-sum-row">
              <span>Tiền mặt dự kiến</span>
              <b className="pos-tabular">{formatVnd(expected)}</b>
            </div>
          </>
        )}

        <label className="pos-field-label" style={{ marginTop: 12 }}>
          {mode === 'open' ? 'Tiền đầu ca' : 'Tiền đếm được'}
        </label>
        <input
          ref={ref}
          className="pos-input pos-tabular"
          type="number"
          min="0"
          value={value}
          placeholder="0"
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && value) onConfirm(amount, note || undefined);
            if (e.key === 'Escape') onClose();
          }}
        />

        {mode === 'close' && value !== '' && (
          <div
            className="pos-change-box"
            style={{
              marginTop: 12,
              background: diff === 0 ? 'rgba(34,197,94,0.1)' : 'rgba(251,191,36,0.1)',
              borderColor: diff === 0 ? 'rgba(34,197,94,0.3)' : 'rgba(251,191,36,0.3)',
            }}
          >
            <span>Chênh lệch</span>
            <b className="pos-tabular" style={{ color: diff === 0 ? 'var(--pos-accent)' : 'var(--pos-amber)' }}>
              {diff > 0 ? '+' : ''}
              {formatVnd(diff)}
            </b>
          </div>
        )}

        <div className="pos-modal-actions">
          <button className="pos-btn" onClick={onClose}>
            Hủy
          </button>
          <button
            className="pos-btn pos-btn-primary"
            disabled={loading || value === ''}
            onClick={() => onConfirm(amount, note || undefined)}
          >
            {loading ? <span className="pos-spinner" /> : mode === 'open' ? 'Mở ca' : 'Đóng ca'}
          </button>
        </div>
      </div>
    </div>
  );
}
