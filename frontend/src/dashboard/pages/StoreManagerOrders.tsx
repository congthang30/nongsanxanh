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
  paymentStatus?: string;
  user: { profile: { fullName: string } | null; email: string | null };
  delivery: { status: string } | null;
  items: { id: string; productNameSnapshot: string; quantity: string }[];
}

const TABS = [
  { code: 'ALL', label: 'Tất cả' },
  { code: 'PLACED', label: 'Mới' },
  { code: 'STORE_CONFIRMED', label: 'Đã xác nhận' },
  { code: 'PICKING', label: 'Đang soạn' },
  { code: 'PACKED', label: 'Đã đóng gói' },
  { code: 'READY_FOR_DELIVERY', label: 'Sẵn sàng giao' },
  { code: 'OUT_FOR_DELIVERY', label: 'Đang giao' },
  { code: 'DELIVERY_FAILED', label: 'Giao thất bại' },
  { code: 'COMPLETED', label: 'Hoàn tất' },
];

export default function StoreManagerOrders() {
  const qc = useQueryClient();
  const { push } = useToastStore();
  const [tab, setTab] = useState('ALL');
  const [cancelTarget, setCancelTarget] = useState<StoreOrder | null>(null);
  const [restockTarget, setRestockTarget] = useState<StoreOrder | null>(null);

  const { data: orders, isLoading, isError, refetch } = useQuery({
    queryKey: ['sm-orders', tab],
    queryFn: () => api.get('/store-manager/orders', { params: tab === 'ALL' ? {} : { status: tab } }).then((r) => r.data.data as StoreOrder[]),
  });

  const act = useMutation({
    mutationFn: ({ id, path, body }: { id: string; path: string; body?: object }) =>
      api.post(`/store-manager/orders/${id}/${path}`, body ?? {}),
    onSuccess: () => {
      push('Đã cập nhật đơn');
      setCancelTarget(null);
      setRestockTarget(null);
      qc.invalidateQueries({ queryKey: ['sm-orders'] });
    },
    onError: (e) => push(getErrorMessage(e), 'error'),
  });

  const actionsFor = (o: StoreOrder) => {
    switch (o.status) {
      case 'PLACED':
        return [{ label: 'Xác nhận đơn', path: 'confirm' }];
      case 'PACKED':
        return [{ label: 'Sẵn sàng giao', path: 'ready-for-delivery' }];
      default:
        return [];
    }
  };

  return (
    <>
      <PageHeader title="Đơn hàng cửa hàng" subtitle="Quản lý toàn bộ vòng đời đơn hàng" />
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
          { key: 'delivery', title: 'Giao', render: (o) => o.delivery ? <StatusBadge status={o.delivery.status} /> : <span className="muted">—</span> },
          {
            key: 'act', title: 'Thao tác', render: (o) => (
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
                      Giao lại
                    </button>
                    <button
                      className="dash-btn dash-btn-sm"
                      disabled={act.isPending}
                      onClick={() => setRestockTarget(o)}
                    >
                      Hủy &amp; hoàn kho
                    </button>
                  </>
                )}
                {o.status === 'DELIVERED' && o.paymentMethod === 'COD' && o.paymentStatus !== 'SUCCESS' && (
                  <button
                    className="dash-btn dash-btn-sm dash-btn-primary"
                    disabled={act.isPending}
                    onClick={() => act.mutate({ id: o.id, path: 'mark-cod-collected' })}
                  >
                    Đã thu COD
                  </button>
                )}
                {['PLACED', 'STORE_CONFIRMED', 'PICKING', 'PACKED', 'READY_FOR_DELIVERY'].includes(o.status) && (
                  <button className="dash-btn dash-btn-sm" disabled={act.isPending} onClick={() => setCancelTarget(o)}>
                    Hủy
                  </button>
                )}
              </div>
            ),
          },
        ]}
      />

      <ConfirmModal
        open={!!cancelTarget}
        title="Hủy đơn hàng"
        message={cancelTarget ? `Hủy đơn #${cancelTarget.orderNumber}?` : ''}
        confirmLabel="Hủy đơn"
        danger
        loading={act.isPending}
        requireReason
        reasonLabel="Lý do hủy"
        onCancel={() => setCancelTarget(null)}
        onConfirm={(reason) => cancelTarget && act.mutate({ id: cancelTarget.id, path: 'cancel', body: { reason } })}
      />

      <ConfirmModal
        open={!!restockTarget}
        title="Hủy đơn và hoàn kho"
        message={restockTarget ? `Hủy đơn #${restockTarget.orderNumber} và hoàn lại tồn kho? Thao tác này không thể hoàn tác.` : ''}
        confirmLabel="Hủy & hoàn kho"
        danger
        loading={act.isPending}
        requireReason
        reasonLabel="Lý do"
        onCancel={() => setRestockTarget(null)}
        onConfirm={(reason) => restockTarget && act.mutate({ id: restockTarget.id, path: 'cancel-restock', body: { reason } })}
      />
    </>
  );
}
