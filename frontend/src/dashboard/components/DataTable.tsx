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
}

export function DataTable<T>({
  title,
  rows,
  columns,
  rowKey,
  actions,
  emptyText = 'Khong co du lieu',
  loading,
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
            {loading ? (
              <tr>
                <td
                  colSpan={columns.length}
                  style={{ textAlign: 'center', padding: 30, color: '#94a3b8' }}
                >
                  Dang tai...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  style={{ textAlign: 'center', padding: 30, color: '#94a3b8' }}
                >
                  {emptyText}
                </td>
              </tr>
            ) : (
              rows.map((row, i) => (
                <tr key={rowKey ? rowKey(row) : i}>
                  {columns.map((c) => (
                    <td
                      key={c.key}
                      style={{ textAlign: c.align ?? 'left' }}
                    >
                      {c.render
                        ? c.render(row)
                        : String((row as any)[c.key] ?? '—')}
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
