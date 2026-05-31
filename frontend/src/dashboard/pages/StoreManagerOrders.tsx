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
  delivery: { status: string } | null;
  items: { id: string; productNameSnapshot: string; quantity: string }[];
}

const TABS = [
  { code: 'ALL', label: 'Tat ca' },
  { code: 'PLACED', label: 'Moi' },
  { code: 'STORE_CONFIRMED', label: 'Da xac nhan' },
  { code: 'PICKING', label: 'Dang soan' },
  { code: 'PACKED', label: 'Da dong goi' },
  { code: 'READY_FOR_DELIVERY', label: 'San sang giao' },
  { code: 'OUT_FOR_DELIVERY', label: 'Dang giao' },
  { code: 'DELIVERY_FAILED', label: 'Giao that bai' },
  { code: 'COMPLETED', label: 'Hoan tat' },
];

export default function StoreManagerOrders() {
  const qc = useQueryClient();
  const { push } = useToastStore();
  const [tab, setTab] = useState('ALL');

  const { data: orders, isLoading } = useQuery({
    queryKey: ['sm-orders', tab],
    queryFn: () => api.get('/store-manager/orders', { params: tab === 'ALL' ? {} : { status: tab } }).then((r) => r.data.data as StoreOrder[]),
  });

  const act = useMutation({
    mutationFn: ({ id, path, body }: { id: string; path: string; body?: object }) =>
      api.post(`/store-manager/orders/${id}/${path}`, body ?? {}),
    onSuccess: () => { push('Da cap nhat don'); qc.invalidateQueries({ queryKey: ['sm-orders'] }); },
    onError: (e) => push(getErrorMessage(e), 'error'),
  });

  const actionsFor = (o: StoreOrder) => {
    switch (o.status) {
      case 'PLACED':
        return [{ label: 'Xac nhan', path: 'confirm' }];
      case 'PACKED':
        return [{ label: 'San sang giao', path: 'ready-for-delivery' }];
      default:
        return [];
    }
  };

  return (
    <>
      <PageHeader title="Don hang cua hang" subtitle="Quan ly toan bo vong doi don hang" />
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
          { key: 'order', title: 'Ma don', render: (o) => (
            <div><strong>#{o.orderNumber}</strong><div className="muted" style={{ fontSize: 12 }}>{o.paymentMethod}</div></div>
          ) },
          { key: 'customer', title: 'Khach', render: (o) => o.user.profile?.fullName ?? o.user.email },
          { key: 'items', title: 'San pham', render: (o) => <span className="muted" style={{ fontSize: 13 }}>{o.items.map((i) => `${i.productNameSnapshot}x${Number(i.quantity)}`).join(', ')}</span> },
          { key: 'total', title: 'Tong', align: 'right', render: (o) => <strong>{formatVnd(o.grandTotal)}</strong> },
          { key: 'status', title: 'Trang thai', render: (o) => <StatusBadge status={o.status} /> },
          { key: 'delivery', title: 'Giao', render: (o) => o.delivery ? <StatusBadge status={o.delivery.status} /> : <span className="muted">—</span> },
          {
            key: 'act', title: 'Thao tac', render: (o) => (
              <div className="dash-row-actions">
                {actionsFor(o).map((a) => (
                  <button key={a.path} className="dash-btn dash-btn-sm dash-btn-primary" disabled={act.isPending} onClick={() => act.mutate({ id: o.id, path: a.path })}>
                    {a.label}
                  </button>
                ))}
                {(o.status === 'DELIVERY_FAILED' || o.delivery?.status === 'FAILED') && (
                  <>
                    <button
                      className="dash-btn dash-btn-sm dash-btn-primary"
                      disabled={act.isPending}
                      onClick={() => act.mutate({ id: o.id, path: 'reassign-delivery' })}
                    >
                      Giao lai
                    </button>
                    <button
                      className="dash-btn dash-btn-sm"
                      disabled={act.isPending}
                      onClick={() => {
                        const reason = prompt('Ly do huy va hoan kho?');
                        if (reason && reason.trim()) {
                          act.mutate({ id: o.id, path: 'cancel-restock', body: { reason: reason.trim() } });
                        }
                      }}
                    >
                      Huy &amp; hoan kho
                    </button>
                  </>
                )}
                {['PLACED', 'STORE_CONFIRMED', 'PICKING', 'PACKED', 'READY_FOR_DELIVERY'].includes(o.status) && (
                  <button className="dash-btn dash-btn-sm" disabled={act.isPending} onClick={() => act.mutate({ id: o.id, path: 'cancel', body: { reason: 'Manager huy don' } })}>
                    Huy
                  </button>
                )}
              </div>
            ),
          },
        ]}
      />
    </>
  );
}
