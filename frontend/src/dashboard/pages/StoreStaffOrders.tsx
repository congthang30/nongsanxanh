import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, getErrorMessage } from '../../lib/api';
import { useToastStore } from '../../lib/toast.store';
import { formatVnd } from '../../lib/format';
import { PageHeader } from '../components/PageHeader';
import { DataTable } from '../components/DataTable';
import { StatusBadge } from '../components/StatusBadge';

interface StoreOrder {
  id: string; orderNumber: string; status: string; grandTotal: number; createdAt: string;
  paymentMethod: string;
  user: { profile: { fullName: string } | null; email: string | null };
  items: { id: string; productNameSnapshot: string; quantity: string }[];
}

const TABS = [
  { code: 'ALL', label: 'Tat ca' },
  { code: 'PLACED', label: 'Don moi' },
  { code: 'STORE_CONFIRMED', label: 'Da xac nhan' },
  { code: 'PICKING', label: 'Dang soan' },
];

export default function StoreStaffOrders() {
  const qc = useQueryClient();
  const { push } = useToastStore();
  const [tab, setTab] = useState('PLACED');

  const { data: orders, isLoading } = useQuery({
    queryKey: ['ss-orders', tab],
    queryFn: () => api.get('/store/orders', { params: tab === 'ALL' ? {} : { status: tab } }).then((r) => r.data.data as StoreOrder[]),
  });

  const act = useMutation({
    mutationFn: ({ id, path, body }: { id: string; path: string; body?: object }) =>
      api.post(`/store/orders/${id}/${path}`, body ?? {}),
    onSuccess: () => { push('Da cap nhat'); qc.invalidateQueries({ queryKey: ['ss-orders'] }); },
    onError: (e) => push(getErrorMessage(e), 'error'),
  });

  return (
    <>
      <PageHeader title="Don hang cua hang" subtitle="Xac nhan don moi va chuyen sang soan hang" />
      <div className="dash-table-card" style={{ padding: 12, marginBottom: 16, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {TABS.map((t) => (
          <button key={t.code} className={`dash-btn dash-btn-sm ${tab === t.code ? 'dash-btn-primary' : ''}`} onClick={() => setTab(t.code)}>
            {t.label}
          </button>
        ))}
      </div>
      <DataTable<StoreOrder>
        rows={orders ?? []}
        loading={isLoading}
        rowKey={(o) => o.id}
        columns={[
          { key: 'order', title: 'Ma don', render: (o) => <strong>#{o.orderNumber}</strong> },
          { key: 'customer', title: 'Khach', render: (o) => o.user.profile?.fullName ?? o.user.email },
          { key: 'items', title: 'San pham', render: (o) => <span className="muted" style={{ fontSize: 13 }}>{o.items.map((i) => `${i.productNameSnapshot}x${Number(i.quantity)}`).join(', ')}</span> },
          { key: 'total', title: 'Tong', align: 'right', render: (o) => <strong>{formatVnd(o.grandTotal)}</strong> },
          { key: 'status', title: 'Trang thai', render: (o) => <StatusBadge status={o.status} /> },
          {
            key: 'act', title: 'Thao tac', render: (o) => (
              <div className="dash-row-actions">
                {o.status === 'PLACED' && (
                  <button className="dash-btn dash-btn-sm dash-btn-primary" disabled={act.isPending} onClick={() => act.mutate({ id: o.id, path: 'confirm' })}>Xac nhan</button>
                )}
                {o.status === 'STORE_CONFIRMED' && (
                  <button className="dash-btn dash-btn-sm dash-btn-primary" disabled={act.isPending} onClick={() => act.mutate({ id: o.id, path: 'start-picking' })}>Bat dau soan</button>
                )}
                {['PLACED', 'STORE_CONFIRMED'].includes(o.status) && (
                  <button className="dash-btn dash-btn-sm" disabled={act.isPending} onClick={() => act.mutate({ id: o.id, path: 'cancel-request', body: { reason: 'Het hang / khach huy' } })}>Huy</button>
                )}
              </div>
            ),
          },
        ]}
      />
    </>
  );
}
