import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api, getErrorMessage } from '../../lib/api';
import { useToastStore } from '../../lib/toast.store';
import { formatVnd } from '../../lib/format';
import { PageHeader } from '../../dashboard/components/PageHeader';
import { DataTable } from '../../dashboard/components/DataTable';
import { StatusBadge } from '../../dashboard/components/StatusBadge';

interface AdminOrder {
  id: string;
  orderNumber: string;
  status: string;
  paymentMethod: string;
  paymentStatus: string;
  grandTotal: number;
  createdAt: string;
  user: { email: string | null; profile: { fullName: string } | null };
  store: { id: string; name: string; code: string } | null;
  delivery: { status: string; shipperId: string } | null;
}
interface StoreOpt { id: string; name: string; code: string; status: string; }

const TABS: { code: string; label: string }[] = [
  { code: 'ALL', label: 'Tat ca' },
  { code: 'PLACED', label: 'Moi' },
  { code: 'STORE_CONFIRMED', label: 'Da xac nhan' },
  { code: 'OUT_FOR_DELIVERY', label: 'Dang giao' },
  { code: 'COMPLETED', label: 'Hoan tat' },
  { code: 'DELIVERY_FAILED', label: 'Giao that bai' },
  { code: 'CANCELLED', label: 'Da huy' },
];

export default function AdminOrdersPage() {
  const qc = useQueryClient();
  const { push } = useToastStore();
  const [tab, setTab] = useState('ALL');
  const [storeFilter, setStoreFilter] = useState('');
  const [reassign, setReassign] = useState<AdminOrder | null>(null);

  const { data: stores } = useQuery({
    queryKey: ['admin-stores-opt'],
    queryFn: () => api.get('/admin/stores').then((r) => r.data.data as StoreOpt[]),
  });

  const { data: orders, isLoading } = useQuery({
    queryKey: ['admin-orders', tab, storeFilter],
    queryFn: () =>
      api
        .get('/admin/orders', {
          params: {
            ...(tab === 'ALL' ? {} : { status: tab }),
            ...(storeFilter ? { storeId: storeFilter } : {}),
          },
        })
        .then((r) => r.data.data as AdminOrder[]),
  });

  const refundMut = useMutation({
    mutationFn: (id: string) => api.post(`/admin/orders/${id}/refund`, { reason: 'Admin hoan tien' }),
    onSuccess: () => { push('Da hoan tien'); qc.invalidateQueries({ queryKey: ['admin-orders'] }); },
    onError: (e) => push(getErrorMessage(e), 'error'),
  });

  return (
    <>
      <PageHeader title="Don hang toan he thong" subtitle="Theo doi va can thiep don hang tat ca cua hang" />

      <div className="dash-table-card" style={{ padding: 12, marginBottom: 16, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        {TABS.map((t) => (
          <button key={t.code} className={`dash-btn dash-btn-sm ${tab === t.code ? 'dash-btn-primary' : ''}`} onClick={() => setTab(t.code)}>
            {t.label}
          </button>
        ))}
        <select className="input" style={{ width: 'auto', marginLeft: 'auto' }} value={storeFilter} onChange={(e) => setStoreFilter(e.target.value)}>
          <option value="">Tat ca cua hang</option>
          {stores?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>

      <DataTable<AdminOrder>
        rows={orders ?? []}
        loading={isLoading}
        rowKey={(o) => o.id}
        emptyText="Khong co don hang"
        columns={[
          {
            key: 'orderNumber', title: 'Ma don',
            render: (o) => (
              <div>
                <strong>#{o.orderNumber}</strong>
                <div className="muted" style={{ fontSize: 12 }}>{o.paymentMethod} · {o.paymentStatus}</div>
              </div>
            ),
          },
          { key: 'store', title: 'Cua hang', render: (o) => o.store?.name ?? <span className="muted">—</span> },
          { key: 'customer', title: 'Khach hang', render: (o) => o.user.profile?.fullName ?? o.user.email },
          { key: 'date', title: 'Ngay', render: (o) => <span className="muted">{new Date(o.createdAt).toLocaleDateString('vi-VN')}</span> },
          { key: 'total', title: 'Tong', align: 'right', render: (o) => <strong>{formatVnd(o.grandTotal)}</strong> },
          { key: 'status', title: 'Trang thai', render: (o) => <StatusBadge status={o.status} /> },
          {
            key: 'actions', title: 'Thao tac',
            render: (o) => (
              <div className="dash-row-actions">
                {['PLACED', 'STORE_CONFIRMED'].includes(o.status) && (
                  <button className="dash-btn dash-btn-sm" onClick={() => setReassign(o)}>Chuyen CH</button>
                )}
                {o.paymentStatus !== 'REFUNDED' && ['CANCELLED', 'DELIVERY_FAILED', 'RETURNED'].includes(o.status) && (
                  <button className="dash-btn dash-btn-sm" onClick={() => refundMut.mutate(o.id)} disabled={refundMut.isPending}>Hoan tien</button>
                )}
              </div>
            ),
          },
        ]}
      />

      {reassign && (
        <ReassignModal
          order={reassign}
          stores={(stores ?? []).filter((s) => s.status === 'ACTIVE' && s.id !== reassign.store?.id)}
          onClose={() => setReassign(null)}
          onDone={() => { setReassign(null); qc.invalidateQueries({ queryKey: ['admin-orders'] }); }}
        />
      )}
    </>
  );
}

function ReassignModal({ order, stores, onClose, onDone }: {
  order: AdminOrder; stores: StoreOpt[]; onClose: () => void; onDone: () => void;
}) {
  const { push } = useToastStore();
  const [storeId, setStoreId] = useState('');
  const mut = useMutation({
    mutationFn: () => api.post(`/admin/orders/${order.id}/reassign-store`, { storeId, reason: 'Admin dieu chuyen' }),
    onSuccess: () => { push('Da chuyen don sang cua hang khac'); onDone(); },
    onError: (e) => push(getErrorMessage(e), 'error'),
  });
  return (
    <div className="dash-modal-overlay" onClick={onClose}>
      <div className="dash-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Chuyen don #{order.orderNumber}</h2>
        <p className="muted">Tu cua hang: {order.store?.name ?? '—'}</p>
        <select className="input" value={storeId} onChange={(e) => setStoreId(e.target.value)} style={{ marginTop: 12 }}>
          <option value="">-- Chon cua hang moi --</option>
          {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <div className="flex gap-sm" style={{ marginTop: 16, justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost" onClick={onClose}>Huy</button>
          <button className="btn btn-primary" disabled={!storeId || mut.isPending} onClick={() => mut.mutate()}>Xac nhan chuyen</button>
        </div>
      </div>
    </div>
  );
}
