import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api, getErrorMessage } from '../../lib/api';
import { useToastStore } from '../../lib/toast.store';
import { formatVnd, paymentMethodLabel } from '../../lib/format';
import { PageHeader } from '../../dashboard/components/PageHeader';
import { DataTable } from '../../dashboard/components/DataTable';
import { StatusBadge } from '../../dashboard/components/StatusBadge';
import { ConfirmModal } from '../../components/ConfirmModal';

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
  { code: 'ALL', label: 'Tất cả' },
  { code: 'PLACED', label: 'Mới' },
  { code: 'STORE_CONFIRMED', label: 'Đã xác nhận' },
  { code: 'OUT_FOR_DELIVERY', label: 'Đang giao' },
  { code: 'COMPLETED', label: 'Hoàn tất' },
  { code: 'DELIVERY_FAILED', label: 'Giao thất bại' },
  { code: 'CANCELLED', label: 'Đã hủy' },
];

export default function AdminOrdersPage() {
  const qc = useQueryClient();
  const { push } = useToastStore();
  const [tab, setTab] = useState('ALL');
  const [storeFilter, setStoreFilter] = useState('');
  const [reassign, setReassign] = useState<AdminOrder | null>(null);
  const [refundTarget, setRefundTarget] = useState<AdminOrder | null>(null);

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
    mutationFn: (id: string) => api.post(`/admin/orders/${id}/refund`, { reason: 'Admin hoàn tiền' }),
    onSuccess: () => { push('Đã hoàn tiền'); setRefundTarget(null); qc.invalidateQueries({ queryKey: ['admin-orders'] }); },
    onError: (e) => { push(getErrorMessage(e), 'error'); setRefundTarget(null); },
  });

  return (
    <>
      <PageHeader title="Đơn hàng toàn hệ thống" subtitle="Theo dõi và can thiệp đơn hàng tất cả cửa hàng" />

      <div className="dash-table-card" style={{ padding: 12, marginBottom: 16, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        {TABS.map((t) => (
          <button key={t.code} className={`dash-btn dash-btn-sm ${tab === t.code ? 'dash-btn-primary' : ''}`} onClick={() => setTab(t.code)}>
            {t.label}
          </button>
        ))}
        <select className="input" style={{ width: 'auto', marginLeft: 'auto' }} value={storeFilter} onChange={(e) => setStoreFilter(e.target.value)} aria-label="Lọc theo cửa hàng">
          <option value="">Tất cả cửa hàng</option>
          {stores?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>

      <DataTable<AdminOrder>
        rows={orders ?? []}
        loading={isLoading}
        rowKey={(o) => o.id}
        emptyText="Không có đơn hàng"
        columns={[
          {
            key: 'orderNumber', title: 'Mã đơn',
            render: (o) => (
              <div>
                <strong>#{o.orderNumber}</strong>
                <div className="muted" style={{ fontSize: 12 }}>{paymentMethodLabel(o.paymentMethod)}</div>
              </div>
            ),
          },
          { key: 'store', title: 'Cửa hàng', render: (o) => o.store?.name ?? <span className="muted">—</span> },
          { key: 'customer', title: 'Khách hàng', render: (o) => o.user.profile?.fullName ?? o.user.email },
          { key: 'date', title: 'Ngày', render: (o) => <span className="muted">{new Date(o.createdAt).toLocaleDateString('vi-VN')}</span> },
          { key: 'total', title: 'Tổng', align: 'right', render: (o) => <strong>{formatVnd(o.grandTotal)}</strong> },
          { key: 'payment', title: 'Thanh toán', render: (o) => <StatusBadge status={o.paymentStatus} kind="payment" /> },
          { key: 'status', title: 'Trạng thái', render: (o) => <StatusBadge status={o.status} /> },
          {
            key: 'actions', title: 'Thao tác',
            render: (o) => (
              <div className="dash-row-actions">
                {['PLACED', 'STORE_CONFIRMED'].includes(o.status) && (
                  <button className="dash-btn dash-btn-sm" onClick={() => setReassign(o)}>Chuyển CH</button>
                )}
                {o.paymentStatus !== 'REFUNDED' && ['CANCELLED', 'DELIVERY_FAILED', 'RETURNED'].includes(o.status) && (
                  <button className="dash-btn dash-btn-sm" onClick={() => setRefundTarget(o)} disabled={refundMut.isPending}>Hoàn tiền</button>
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

      <ConfirmModal
        open={!!refundTarget}
        title="Hoàn tiền đơn hàng"
        message={refundTarget ? `Xác nhận hoàn tiền cho đơn #${refundTarget.orderNumber} (${formatVnd(refundTarget.grandTotal)})? Thao tác này không thể hoàn tác.` : ''}
        confirmLabel="Hoàn tiền"
        danger
        loading={refundMut.isPending}
        onCancel={() => setRefundTarget(null)}
        onConfirm={() => refundTarget && refundMut.mutate(refundTarget.id)}
      />
    </>
  );
}

function ReassignModal({ order, stores, onClose, onDone }: {
  order: AdminOrder; stores: StoreOpt[]; onClose: () => void; onDone: () => void;
}) {
  const { push } = useToastStore();
  const [storeId, setStoreId] = useState('');
  const mut = useMutation({
    mutationFn: () => api.post(`/admin/orders/${order.id}/reassign-store`, { storeId, reason: 'Admin điều chuyển' }),
    onSuccess: () => { push('Đã chuyển đơn sang cửa hàng khác'); onDone(); },
    onError: (e) => push(getErrorMessage(e), 'error'),
  });
  return (
    <div className="dash-modal-overlay" onClick={onClose}>
      <div className="dash-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Chuyển đơn #{order.orderNumber}</h2>
        <p className="muted">Từ cửa hàng: {order.store?.name ?? '—'}</p>
        <select className="input" value={storeId} onChange={(e) => setStoreId(e.target.value)} style={{ marginTop: 12 }} aria-label="Chọn cửa hàng mới">
          <option value="">-- Chọn cửa hàng mới --</option>
          {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <div className="flex gap-sm" style={{ marginTop: 16, justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost" onClick={onClose}>Hủy</button>
          <button className="btn btn-primary" disabled={!storeId || mut.isPending} onClick={() => mut.mutate()}>Xác nhận chuyển</button>
        </div>
      </div>
    </div>
  );
}
