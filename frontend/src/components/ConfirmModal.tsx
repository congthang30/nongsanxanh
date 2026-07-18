import { ReactNode, useEffect, useState } from 'react';
import { ModalPortal } from './ModalPortal';
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
  requireReason?: false;
  onConfirm: () => void;
}

interface ReasonProps extends BaseProps {
  requireReason: true;
  reasonLabel?: string;
  reasonPlaceholder?: string;
  minReasonLength?: number;
  onConfirm: (reason: string) => void;
}

type Props = ConfirmProps | ReasonProps;

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

  useEffect(() => {
    if (open) setReason('');
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onCancel]);

  if (!open) return null;

  const requireReason = props.requireReason === true;
  const minLength = requireReason ? props.minReasonLength ?? 3 : 0;
  const reasonValid = !requireReason || reason.trim().length >= minLength;

  const handleConfirm = () => {
    if (requireReason) {
      if (!reasonValid) return;
      props.onConfirm(reason.trim());
      return;
    }
    props.onConfirm();
  };

  return (
    <ModalPortal>
    <div
      className="cm-backdrop"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="cm-modal" onClick={(event) => event.stopPropagation()}>
        <h3 className="cm-title">{title}</h3>
        {message && <div className="cm-message">{message}</div>}

        {requireReason && (
          <div className="cm-field">
            <label htmlFor="cm-reason">{props.reasonLabel ?? 'Lý do'}</label>
            <textarea
              id="cm-reason"
              className="cm-textarea"
              rows={3}
              placeholder={props.reasonPlaceholder ?? 'Nhập lý do...'}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              autoFocus
            />
            {!reasonValid && reason.length > 0 && (
              <span className="cm-error">Vui lòng nhập ít nhất {minLength} ký tự</span>
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
            className={'cm-btn ' + (danger ? 'cm-btn-danger' : 'cm-btn-primary')}
            onClick={handleConfirm}
            disabled={loading || (requireReason && !reasonValid)}
          >
            {loading ? 'Đang xử lý...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
    </ModalPortal>
  );
}

export function useConfirm<T = void>() {
  const [isOpen, setIsOpen] = useState(false);
  const [payload, setPayload] = useState<T | undefined>(undefined);
  return {
    isOpen,
    payload,
    open: (value?: T) => {
      setPayload(value);
      setIsOpen(true);
    },
    close: () => setIsOpen(false),
  };
}