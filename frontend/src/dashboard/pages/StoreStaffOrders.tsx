import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, getErrorMessage } from '../../lib/api';
import { useToastStore } from '../../lib/toast.store';
import { formatVnd, paymentMethodLabel } from '../../lib/format';
import { PageHeader } from '../components/PageHeader';
import { DataTable } from '../components/DataTable';
import { StatusBadge } from '../components/StatusBadge';
import { ConfirmModal } from '../../components/ConfirmModal';

interface StoreOrder {
  id: string; orderNumber: string; status: string; grandTotal: number; createdAt: string;
  paymentMethod: string;
  user: { profile: { fullName: string } | null; email: string | null };
  items: { id: string; productNameSnapshot: string; quantity: string }[];
}

const TABS = [
  { code: 'ALL', label: 'Tất cả' },
  { code: 'PLACED', label: 'Đơn mới' },
  { code: 'STORE_CONFIRMED', label: 'Đã xác nhận' },
  { code: 'PICKING', label: 'Đang soạn' },
];

export default function StoreStaffOrders() {
  const qc = useQueryClient();
  const { push } = useToastStore();
  const [tab, setTab] = useState('PLACED');
  const [cancelTarget, setCancelTarget] = useState<StoreOrder | null>(null);

  const { data: orders, isLoading, isError, refetch } = useQuery({
    queryKey: ['ss-orders', tab],
    queryFn: () => api.get('/store/orders', { params: tab === 'ALL' ? {} : { status: tab } }).then((r) => r.data.data as StoreOrder[]),
  });

  const act = useMutation({
    mutationFn: ({ id, path, body }: { id: string; path: string; body?: object }) =>
      api.post(`/store/orders/${id}/${path}`, body ?? {}),
    onSuccess: () => { push('Đã cập nhật'); setCancelTarget(null); qc.invalidateQueries({ queryKey: ['ss-orders'] }); },
    onError: (e) => push(getErrorMessage(e), 'error'),
  });

  return (
    <>
      <PageHeader title="Đơn hàng cửa hàng" subtitle="Xác nhận đơn mới và chuyển sang soạn hàng" />
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
        error={isError ? 'Không tải được danh sách đơn hàng.' : null}
        onRetry={() => refetch()}
        rowKey={(o) => o.id}
        emptyText="Không có đơn hàng"
        columns={[
          { key: 'order', title: 'Mã đơn', render: (o) => (
            <div><strong>#{o.orderNumber}</strong><div className="muted" style={{ fontSize: 12 }}>{paymentMethodLabel(o.paymentMethod)}</div></div>
          ) },
          { key: 'customer', title: 'Khách hàng', render: (o) => o.user.profile?.fullName ?? o.user.email },
          { key: 'items', title: 'Sản phẩm', render: (o) => <span className="muted" style={{ fontSize: 13 }}>{o.items.map((i) => `${i.productNameSnapshot}×${Number(i.quantity)}`).join(', ')}</span> },
          { key: 'total', title: 'Tổng', align: 'right', render: (o) => <strong>{formatVnd(o.grandTotal)}</strong> },
          { key: 'status', title: 'Trạng thái', render: (o) => <StatusBadge status={o.status} /> },
          {
            key: 'act', title: 'Thao tác', render: (o) => (
              <div className="dash-row-actions">
                {o.status === 'PLACED' && (
                  <button className="dash-btn dash-btn-sm dash-btn-primary" disabled={act.isPending} onClick={() => act.mutate({ id: o.id, path: 'confirm' })}>Xác nhận đơn</button>
                )}
                {o.status === 'STORE_CONFIRMED' && (
                  <button className="dash-btn dash-btn-sm dash-btn-primary" disabled={act.isPending} onClick={() => act.mutate({ id: o.id, path: 'start-picking' })}>Bắt đầu soạn</button>
                )}
                {['PLACED', 'STORE_CONFIRMED'].includes(o.status) && (
                  <button className="dash-btn dash-btn-sm" disabled={act.isPending} onClick={() => setCancelTarget(o)}>Báo thiếu hàng</button>
                )}
              </div>
            ),
          },
        ]}
      />

      <ConfirmModal
        open={!!cancelTarget}
        title="Báo thiếu hàng / hủy đơn"
        message={cancelTarget ? `Báo thiếu hàng cho đơn #${cancelTarget.orderNumber}? Quản lý sẽ nhận được thông báo.` : ''}
        confirmLabel="Gửi báo cáo"
        danger
        loading={act.isPending}
        requireReason
        reasonLabel="Lý do (sản phẩm thiếu, hết hàng...)"
        onCancel={() => setCancelTarget(null)}
        onConfirm={(reason) => cancelTarget && act.mutate({ id: cancelTarget.id, path: 'cancel-request', body: { reason } })}
      />
    </>
  );
}
