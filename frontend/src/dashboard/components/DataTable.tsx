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
              {columns.map((column) => (
                <th
                  key={column.key}
                  style={{ width: column.width, textAlign: column.align ?? 'left' }}
                >
                  {column.title}
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
              rows.map((row, rowIndex) => (
                <tr key={rowKey ? rowKey(row) : rowIndex}>
                  {columns.map((column) => (
                    <td key={column.key} style={{ textAlign: column.align ?? 'left' }}>
                      {column.render
                        ? column.render(row)
                        : String((row as Record<string, unknown>)[column.key] ?? '-')}
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