import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { PageHeader } from '../components/PageHeader';
import { DataTable } from '../components/DataTable';

interface Tx {
  id: string;
  storeId: string;
  variantId: string;
  type: string;
  quantity: string;
  beforeQty: string;
  afterQty: string;
  reason: string | null;
  orderId: string | null;
  createdBy: string | null;
  createdAt: string;
  store: { name: string; code: string } | null;
}

const TYPE_OPTIONS: { code: string; label: string; color: string }[] = [
  { code: '', label: 'Tất cả', color: '#64748b' },
  { code: 'IMPORT', label: 'Nhập', color: '#16a34a' },
  { code: 'EXPORT', label: 'Xuất', color: '#7c3aed' },
  { code: 'ADJUST', label: 'Điều chỉnh', color: '#0891b2' },
  { code: 'POS_SALE', label: 'POS bán', color: '#0f766e' },
  { code: 'POS_RETURN', label: 'POS trả', color: '#0284c7' },
  { code: 'POS_LOSS', label: 'Hư hỏng', color: '#dc2626' },
  { code: 'RESERVE', label: 'Giữ chỗ', color: '#94a3b8' },
  { code: 'RELEASE', label: 'Nhả giữ', color: '#94a3b8' },
  { code: 'COMMIT', label: 'Trừ kho', color: '#94a3b8' },
];

export default function WarehouseTransactions() {
  const [type, setType] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['wh-transactions', type, from, to],
    queryFn: () =>
      api
        .get('/warehouse/inventory/transactions', {
          params: {
            type: type || undefined,
            from: from || undefined,
            to: to || undefined,
          },
        })
        .then((r) => r.data.data as Tx[]),
  });

  return (
    <>
      <PageHeader
        title="Lịch sử nhập/xuất tồn kho"
        subtitle="Truy vết mọi thay đổi tồn kho theo cửa hàng"
      />
      <div
        className="dash-table-card"
        style={{
          padding: 12,
          marginBottom: 16,
          display: 'flex',
          gap: 8,
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        {TYPE_OPTIONS.map((opt) => (
          <button
            key={opt.code || 'all'}
            className={`dash-btn dash-btn-sm ${
              type === opt.code ? 'dash-btn-primary' : ''
            }`}
            onClick={() => setType(opt.code)}
          >
            {opt.label}
          </button>
        ))}
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <input
            type="date"
            className="input"
            style={{ width: 160 }}
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
          <input
            type="date"
            className="input"
            style={{ width: 160 }}
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </span>
      </div>
      <DataTable<Tx>
        rows={data ?? []}
        loading={isLoading}
        rowKey={(r) => r.id}
        columns={[
          {
            key: 'time',
            title: 'Thời gian',
            render: (r) => new Date(r.createdAt).toLocaleString('vi-VN'),
          },
          {
            key: 'type',
            title: 'Loại',
            render: (r) => {
              const opt = TYPE_OPTIONS.find((o) => o.code === r.type);
              return (
                <span
                  style={{
                    background: (opt?.color ?? '#64748b') + '20',
                    color: opt?.color ?? '#64748b',
                    padding: '3px 10px',
                    borderRadius: 12,
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  {opt?.label ?? r.type}
                </span>
              );
            },
          },
          {
            key: 'qty',
            title: 'Số lượng',
            align: 'right',
            render: (r) => (
              <strong style={{ fontVariantNumeric: 'tabular-nums' }}>
                {Number(r.quantity).toLocaleString('vi-VN')}
              </strong>
            ),
          },
          {
            key: 'before',
            title: 'Trước',
            align: 'right',
            render: (r) => Number(r.beforeQty).toLocaleString('vi-VN'),
          },
          {
            key: 'after',
            title: 'Sau',
            align: 'right',
            render: (r) => (
              <strong>{Number(r.afterQty).toLocaleString('vi-VN')}</strong>
            ),
          },
          {
            key: 'reason',
            title: 'Lý do',
            render: (r) => r.reason ?? <span className="muted">—</span>,
          },
          {
            key: 'ref',
            title: 'Liên quan',
            render: (r) =>
              r.orderId ? (
                <span className="muted" style={{ fontSize: 12 }}>
                  Đơn #{r.orderId.slice(0, 8)}
                </span>
              ) : (
                <span className="muted">—</span>
              ),
          },
        ]}
      />
    </>
  );
}
