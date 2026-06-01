import { useEffect, useRef, useState } from 'react';

/** Modal nhap ly do (void/refund). Thay cho prompt() tho. */
export function ReasonModal({
  title,
  subtitle,
  confirmLabel = 'Xác nhận',
  danger = true,
  onConfirm,
  onClose,
}: {
  title: string;
  subtitle?: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: (reason: string) => void;
  onClose: () => void;
}) {
  const [reason, setReason] = useState('');
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);

  return (
    <div className="pos-modal-overlay" onClick={onClose}>
      <div className="pos-modal" onClick={(e) => e.stopPropagation()}>
        <h3>{title}</h3>
        {subtitle && <p className="sub">{subtitle}</p>}
        <label className="pos-field-label">Lý do</label>
        <textarea
          ref={ref}
          className="pos-textarea"
          value={reason}
          placeholder="Nhập lý do..."
          onChange={(e) => setReason(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') onClose();
          }}
        />
        <div className="pos-modal-actions">
          <button className="pos-btn" onClick={onClose}>
            Quay lại
          </button>
          <button
            className={`pos-btn ${danger ? 'pos-btn-danger' : 'pos-btn-primary'}`}
            disabled={reason.trim().length < 3}
            onClick={() => onConfirm(reason.trim())}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
