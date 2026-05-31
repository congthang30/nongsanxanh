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
  { code: '', label: 'Tat ca', color: '#64748b' },
  { code: 'IMPORT', label: 'Nhap', color: '#16a34a' },
  { code: 'EXPORT', label: 'Xuat', color: '#7c3aed' },
  { code: 'ADJUST', label: 'Dieu chinh', color: '#0891b2' },
  { code: 'POS_SALE', label: 'POS ban', color: '#0f766e' },
  { code: 'POS_RETURN', label: 'POS tra', color: '#0284c7' },
  { code: 'POS_LOSS', label: 'Hu hong', color: '#dc2626' },
  { code: 'RESERVE', label: 'Reserve', color: '#94a3b8' },
  { code: 'RELEASE', label: 'Release', color: '#94a3b8' },
  { code: 'COMMIT', label: 'Commit', color: '#94a3b8' },
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
        title="Lich su nhap/xuat ton kho"
        subtitle="Truy vet moi thay doi ton kho theo cua hang"
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
            title: 'Thoi gian',
            render: (r) => new Date(r.createdAt).toLocaleString('vi-VN'),
          },
          {
            key: 'type',
            title: 'Loai',
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
            title: 'So luong',
            align: 'right',
            render: (r) => (
              <strong style={{ fontVariantNumeric: 'tabular-nums' }}>
                {Number(r.quantity).toLocaleString('vi-VN')}
              </strong>
            ),
          },
          {
            key: 'before',
            title: 'Truoc',
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
            title: 'Ly do',
            render: (r) => r.reason ?? <span className="muted">—</span>,
          },
          {
            key: 'ref',
            title: 'Lien quan',
            render: (r) =>
              r.orderId ? (
                <span className="muted" style={{ fontSize: 12 }}>
                  Order #{r.orderId.slice(0, 8)}
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
