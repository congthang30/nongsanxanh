import { ReactNode } from 'react';

export interface DataTableColumn<T> {
  key: string;
  title: string;
  width?: number | string;
  render?: (row: T) => ReactNode;
  align?: 'left' | 'center' | 'right';
}

interface DataTableProps<T> {
  title?: string;
  rows: T[];
  columns: DataTableColumn<T>[];
  rowKey?: (row: T) => string | number;
  actions?: ReactNode;
  emptyText?: string;
  loading?: boolean;
  /** Thông báo lỗi (kèm nút thử lại nếu có onRetry). */
  error?: string | null;
  onRetry?: () => void;
}

export function DataTable<T>({
  title,
  rows,
  columns,
  rowKey,
  actions,
  emptyText = 'Không có dữ liệu',
  loading,
  error,
  onRetry,
}: DataTableProps<T>) {
  return (
    <div className="dash-table-card">
      {(title || actions) && (
        <div className="dash-table-head">
          {title && <h3>{title}</h3>}
          {actions && <div className="dash-table-actions">{actions}</div>}
        </div>
      )}
      <div style={{ overflowX: 'auto' }}>
        <table className="dash-table">
          <thead>
            <tr>
              {columns.map((c) => (
                <th
                  key={c.key}
                  style={{
                    width: c.width,
                    textAlign: c.align ?? 'left',
                  }}
                >
                  {c.title}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {error ? (
              <tr>
                <td colSpan={columns.length} className="dash-table-state">
                  <div className="dash-state dash-state-error">
                    <span>{error}</span>
                    {onRetry && (
                      <button className="dash-btn dash-btn-sm" onClick={onRetry}>
                        Thử lại
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ) : loading ? (
              <tr>
                <td colSpan={columns.length} className="dash-table-state">
                  <span className="dash-state-spinner" aria-hidden="true" />
                  Đang tải...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="dash-table-state">
                  {emptyText}
                </td>
              </tr>
            ) : (
              rows.map((row, i) => (
                <tr key={rowKey ? rowKey(row) : i}>
                  {columns.map((c) => (
                    <td key={c.key} style={{ textAlign: c.align ?? 'left' }}>
                      {c.render
                        ? c.render(row)
                        : String((row as Record<string, unknown>)[c.key] ?? '—')}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
