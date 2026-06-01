import { ReactNode } from 'react';

/**
 * Các state dùng chung cho mọi trang async: rỗng / lỗi / đang tải.
 * Dùng được cả ở storefront và dashboard (không phụ thuộc layout).
 */

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
}

export function EmptyState({ title, description, icon, action }: EmptyStateProps) {
  return (
    <div className="ui-state">
      {icon && <div className="ui-state-icon" aria-hidden="true">{icon}</div>}
      <h3 className="ui-state-title">{title}</h3>
      {description && <p className="ui-state-desc">{description}</p>}
      {action && <div className="ui-state-action">{action}</div>}
    </div>
  );
}

interface ErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
}

export function ErrorState({
  title = 'Đã có lỗi xảy ra',
  description = 'Không tải được dữ liệu. Vui lòng thử lại.',
  onRetry,
}: ErrorStateProps) {
  return (
    <div className="ui-state ui-state-error-block">
      <h3 className="ui-state-title">{title}</h3>
      <p className="ui-state-desc">{description}</p>
      {onRetry && (
        <div className="ui-state-action">
          <button className="btn btn-ghost btn-sm" onClick={onRetry}>
            Thử lại
          </button>
        </div>
      )}
    </div>
  );
}

interface LoadingStateProps {
  label?: string;
  /** Số ô skeleton hiển thị. */
  rows?: number;
  height?: number;
}

export function LoadingState({ label = 'Đang tải...', rows = 1, height = 120 }: LoadingStateProps) {
  return (
    <div className="ui-state-loading" role="status" aria-live="polite">
      <span className="ui-sr-only">{label}</span>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="skeleton" style={{ height, borderRadius: 12 }} />
      ))}
    </div>
  );
}
