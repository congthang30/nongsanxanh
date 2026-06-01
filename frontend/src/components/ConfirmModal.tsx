import { ReactNode, useEffect, useState } from 'react';
import './confirm-modal.css';

interface BaseProps {
  open: boolean;
  title: string;
  message?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  loading?: boolean;
  onCancel: () => void;
}

interface ConfirmProps extends BaseProps {
  /** Khong yeu cau nhap ly do */
  requireReason?: false;
  onConfirm: () => void;
}

interface ReasonProps extends BaseProps {
  /** Yeu cau nguoi dung nhap ly do truoc khi confirm */
  requireReason: true;
  reasonLabel?: string;
  reasonPlaceholder?: string;
  minReasonLength?: number;
  onConfirm: (reason: string) => void;
}

type Props = ConfirmProps | ReasonProps;

/**
 * Modal xac nhan dung chung cho cac action nghiep vu (huy don, tu choi, giao that bai...).
 * Thay the prompt()/confirm() tho. Ho tro che do nhap ly do bat buoc.
 */
export function ConfirmModal(props: Props) {
  const {
    open,
    title,
    message,
    confirmLabel = 'Xác nhận',
    cancelLabel = 'Hủy bỏ',
    danger,
    loading,
    onCancel,
  } = props;
  const [reason, setReason] = useState('');

  // Reset reason khi mo lai
  useEffect(() => {
    if (open) setReason('');
  }, [open]);

  // Dong bang phim Esc
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  if (!open) return null;

  const requireReason = props.requireReason === true;
  const minLen = requireReason ? props.minReasonLength ?? 3 : 0;
  const reasonValid = !requireReason || reason.trim().length >= minLen;

  const handleConfirm = () => {
    if (requireReason) {
      if (!reasonValid) return;
      props.onConfirm(reason.trim());
    } else {
      props.onConfirm();
    }
  };

  return (
    <div
      className="cm-backdrop"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="cm-modal" onClick={(e) => e.stopPropagation()}>
        <h3 className="cm-title">{title}</h3>
        {message && <div className="cm-message">{message}</div>}

        {requireReason && (
          <div className="cm-field">
            <label htmlFor="cm-reason">
              {props.reasonLabel ?? 'Lý do'}
            </label>
            <textarea
              id="cm-reason"
              className="cm-textarea"
              rows={3}
              placeholder={props.reasonPlaceholder ?? 'Nhập lý do...'}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              autoFocus
            />
            {!reasonValid && reason.length > 0 && (
              <span className="cm-error">
                Vui lòng nhập ít nhất {minLen} ký tự
              </span>
            )}
          </div>
        )}

        <div className="cm-actions">
          <button
            type="button"
            className="cm-btn cm-btn-ghost"
            onClick={onCancel}
            disabled={loading}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`cm-btn ${danger ? 'cm-btn-danger' : 'cm-btn-primary'}`}
            onClick={handleConfirm}
            disabled={loading || (requireReason && !reasonValid)}
          >
            {loading ? 'Đang xử lý...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Hook tien ich quan ly 1 confirm modal voi payload generic.
 * Vi du:
 *   const dialog = useConfirm<string>();
 *   dialog.open(shipmentId);
 *   <ConfirmModal open={dialog.isOpen} ... onConfirm={() => doSomething(dialog.payload)} onCancel={dialog.close} />
 */
export function useConfirm<T = void>() {
  const [isOpen, setIsOpen] = useState(false);
  const [payload, setPayload] = useState<T | undefined>(undefined);
  return {
    isOpen,
    payload,
    open: (p?: T) => {
      setPayload(p);
      setIsOpen(true);
    },
    close: () => setIsOpen(false),
  };
}
