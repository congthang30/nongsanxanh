import { useEffect, useRef, useState } from 'react';
import { formatVnd } from '../../lib/format';
import { BarcodeLookup } from '../pos.api';

/**
 * Modal nhap khoi luong cho san pham can ky (WEIGHT). Khong dung prompt().
 */
export function WeightModal({
  product,
  onConfirm,
  onClose,
}: {
  product: BarcodeLookup;
  onConfirm: (qty: number) => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const qty = parseFloat(value);
  const valid = !isNaN(qty) && qty > 0;
  const lineTotal = valid ? Math.round(product.unitPrice * qty) : 0;

  const submit = () => {
    if (valid) onConfirm(qty);
  };

  return (
    <div className="pos-modal-overlay" onClick={onClose}>
      <div className="pos-modal" onClick={(e) => e.stopPropagation()}>
        <h3>{product.productName}</h3>
        <p className="sub">
          Cân ký &middot; {formatVnd(product.unitPrice)}/{product.unit} &middot; Tồn: {product.available} {product.unit}
        </p>
        <label className="pos-field-label">Nhập khối lượng ({product.unit})</label>
        <input
          ref={inputRef}
          className="pos-big-input pos-tabular"
          type="number"
          step="0.001"
          min="0"
          inputMode="decimal"
          value={value}
          placeholder="0.000"
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit();
            if (e.key === 'Escape') onClose();
          }}
        />
        <div className="pos-change-box" style={{ marginTop: 14 }}>
          <span>Thành tiền</span>
          <b className="pos-tabular">{formatVnd(lineTotal)}</b>
        </div>
        <div className="pos-modal-actions">
          <button className="pos-btn" onClick={onClose}>
            Hủy
          </button>
          <button className="pos-btn pos-btn-primary" disabled={!valid} onClick={submit}>
            Thêm vào hóa đơn
          </button>
        </div>
      </div>
    </div>
  );
}
