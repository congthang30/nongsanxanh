import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { RefreshCw, Search } from 'lucide-react';
import { api, getErrorMessage } from '../../lib/api';
import { useToastStore } from '../../lib/toast.store';
import { formatDateTime, formatVnd, paymentMethodLabel } from '../../lib/format';
import { PageHeader } from '../components/PageHeader';
import { StatCard } from '../components/StatCard';
import { DataTable } from '../components/DataTable';
import { StatusBadge } from '../components/StatusBadge';
import { ConfirmModal } from '../../components/ConfirmModal';

interface StoreOrder {
  id: string;
  orderNumber: string;
  status: string;
  grandTotal: number;
  createdAt: string;
  paymentMethod: string;
  paymentStatus?: string;
  user: { profile: { fullName: string } | null; email: string | null };
  delivery: { status: string; shipperId?: string } | null;
  items: {
    id: string;
    productNameSnapshot: string;
    quantity: string;
    unitSnapshot?: string;
  }[];
}

type OrderView = 'ALL' | 'WAREHOUSE' | 'SHIPPING' | 'ATTENTION' | 'DONE';

const ACTIVE_WAREHOUSE = new Set(['PLACED', 'STORE_CONFIRMED', 'PICKING', 'PACKED']);
const ACTIVE_SHIPPING = new Set(['READY_FOR_DELIVERY', 'OUT_FOR_DELIVERY', 'DELIVERED']);
const ATTENTION = new Set(['DELIVERY_FAILED', 'RETURN_REQUESTED']);
const DONE = new Set(['COMPLETED', 'CANCELLED', 'RETURNED']);

const VIEWS: { code: OrderView; label: string }[] = [
  { code: 'ALL', label: 'Tất cả đơn' },
  { code: 'WAREHOUSE', label: 'Kho đang xử lý' },
  { code: 'SHIPPING', label: 'Chờ lấy & đang giao' },
  { code: 'ATTENTION', label: 'Cần can thiệp' },
  { code: 'DONE', label: 'Đã kết thúc' },
];

export default function StoreManagerOrders() {
  const qc = useQueryClient();
  const { push } = useToastStore();
  const [view, setView] = useState<OrderView>('ALL');
  const [search, setSearch] = useState('');
  const [cancelTarget, setCancelTarget] = useState<StoreOrder | null>(null);
  const [restockTarget, setRestockTarget] = useState<StoreOrder | null>(null);

  const { data: orders, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['sm-orders'],
    queryFn: () =>
      api.get('/store-manager/orders').then((response) => response.data.data as StoreOrder[]),
  });

  const act = useMutation({
    mutationFn: ({ id, path, body }: { id: string; path: string; body?: object }) =>
      api.post(`/store-manager/orders/${id}/${path}`, body ?? {}),
    onSuccess: (_response, variables) => {
      push(
        variables.path === 'reassign-delivery'
          ? 'Đã giao lại đơn cho shipper chính'
          : variables.path === 'mark-cod-collected'
            ? 'Đã xác nhận thu tiền COD'
            : 'Đã cập nhật đơn hàng',
      );
      setCancelTarget(null);
      setRestockTarget(null);
      qc.invalidateQueries({ queryKey: ['sm-orders'] });
      qc.invalidateQueries({ queryKey: ['sm-dashboard'] });
    },
    onError: (error) => push(getErrorMessage(error), 'error'),
  });

  const counts = useMemo(() => {
    const rows = orders ?? [];
    return {
      ALL: rows.length,
      WAREHOUSE: rows.filter((order) => ACTIVE_WAREHOUSE.has(order.status)).length,
      SHIPPING: rows.filter((order) => ACTIVE_SHIPPING.has(order.status)).length,
      ATTENTION: rows.filter(needsAttention).length,
      DONE: rows.filter((order) => DONE.has(order.status)).length,
    };
  }, [orders]);

  const filteredOrders = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase('vi');
    return (orders ?? []).filter((order) => {
      if (view === 'WAREHOUSE' && !ACTIVE_WAREHOUSE.has(order.status)) return false;
      if (view === 'SHIPPING' && !ACTIVE_SHIPPING.has(order.status)) return false;
      if (view === 'ATTENTION' && !needsAttention(order)) return false;
      if (view === 'DONE' && !DONE.has(order.status)) return false;
      if (!normalizedSearch) return true;

      return [
        order.orderNumber,
        order.user.profile?.fullName,
        order.user.email,
        ...order.items.map((item) => item.productNameSnapshot),
      ]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase('vi')
        .includes(normalizedSearch);
    });
  }, [orders, search, view]);

  return (
    <>
      <PageHeader
        title="Đơn hàng cửa hàng"
        subtitle="Giám sát tiến độ và xử lý các đơn phát sinh ngoại lệ"
        actions={(
          <button
            id="manager-orders-refresh"
            type="button"
            className="dash-btn"
            disabled={isFetching}
            onClick={() => refetch()}
          >
            <RefreshCw size={15} />
            {isFetching ? 'Đang tải...' : 'Làm mới'}
          </button>
        )}
      />

      <div className="dash-stat-grid">
        <StatCard icon="Package" label="Kho đang xử lý" value={counts.WAREHOUSE} color="#ca8a04" />
        <StatCard icon="Truck" label="Chờ lấy & đang giao" value={counts.SHIPPING} color="#2563eb" />
        <StatCard icon="AlertTriangle" label="Cần can thiệp" value={counts.ATTENTION} color="#dc2626" />
        <StatCard icon="CheckCircle" label="Đã kết thúc" value={counts.DONE} color="#16a34a" />
      </div>

      <div className="dash-table-card" style={{ padding: 12, marginBottom: 16 }}>
        <div className="dash-filter-bar" style={{ marginTop: 0 }}>
          <div style={{ position: 'relative', minWidth: 240, flex: '1 1 300px', maxWidth: 480 }}>
            <Search
              size={16}
              aria-hidden="true"
              style={{
                position: 'absolute',
                left: 12,
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#64748b',
              }}
            />
            <input
              id="manager-orders-search"
              className="input"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Tìm mã đơn, khách hàng hoặc sản phẩm"
              aria-label="Tìm đơn hàng"
              style={{ width: '100%', paddingLeft: 36 }}
            />
          </div>
          <select
            id="manager-orders-status-filter"
            className="input"
            value={view}
            onChange={(event) => setView(event.target.value as OrderView)}
            aria-label="Lọc nhóm trạng thái đơn hàng"
            style={{ flex: '0 1 14rem', minWidth: '13rem', maxWidth: '18rem' }}
          >
            {VIEWS.map((item) => (
              <option key={item.code} value={item.code}>
                {item.label} ({counts[item.code]})
              </option>
            ))}
          </select>
        </div>
        <p className="muted" style={{ margin: '10px 0 0', fontSize: 13 }} aria-live="polite">
          Hiển thị {filteredOrders.length}/{orders?.length ?? 0} đơn
        </p>
      </div>

      <DataTable<StoreOrder>
        rows={filteredOrders}
        rowKey={(order) => order.id}
        loading={isLoading}
        error={isError ? 'Không tải được danh sách đơn hàng' : null}
        onRetry={() => refetch()}
        emptyText="Không có đơn phù hợp bộ lọc"
        columns={[
          {
            key: 'order',
            title: 'Đơn hàng',
            width: 160,
            render: (order) => (
              <div>
                <strong>#{order.orderNumber}</strong>
                <div className="muted" style={{ marginTop: 4, fontSize: 12, whiteSpace: 'nowrap' }}>
                  {formatDateTime(order.createdAt)}
                </div>
              </div>
            ),
          },
          {
            key: 'customer',
            title: 'Khách hàng',
            width: 180,
            render: (order) => (
              <div>
                <strong>{order.user.profile?.fullName ?? order.user.email ?? 'Khách hàng'}</strong>
                {order.user.email && (
                  <div className="muted" style={{ marginTop: 4, fontSize: 12, overflowWrap: 'anywhere' }}>
                    {order.user.email}
                  </div>
                )}
              </div>
            ),
          },
          {
            key: 'items',
            title: 'Sản phẩm',
            width: '30%',
            render: (order) => (
              <ul className="wh-pick-items" style={{ minWidth: 220 }}>
                {order.items.length > 0 ? order.items.map((item) => (
                  <li key={item.id}>
                    <span style={{ overflowWrap: 'anywhere' }}>
                      {item.productNameSnapshot}{' '}
                      <strong>
                        ×{Number(item.quantity)}{item.unitSnapshot ? ` ${item.unitSnapshot}` : ''}
                      </strong>
                    </span>
                  </li>
                )) : (
                  <li className="muted">Không có sản phẩm</li>
                )}
              </ul>
            ),
          },
          {
            key: 'payment',
            title: 'Thanh toán',
            width: 145,
            render: (order) => (
              <div>
                <strong style={{ color: '#15803d', whiteSpace: 'nowrap' }}>
                  {formatVnd(order.grandTotal)}
                </strong>
                <div className="muted" style={{ marginTop: 4, fontSize: 12 }}>
                  {paymentMethodLabel(order.paymentMethod)}
                </div>
              </div>
            ),
          },
          {
            key: 'status',
            title: 'Trạng thái',
            width: 180,
            render: (order) => (
              <div className="stack gap-sm">
                <div className="flex gap-sm" style={{ flexWrap: 'wrap' }}>
                  <StatusBadge status={order.status} />
                  {order.delivery && <StatusBadge status={order.delivery.status} />}
                </div>
                <span
                  className="muted"
                  style={{
                    fontSize: 12,
                    lineHeight: 1.4,
                    color: needsAttention(order) ? '#b91c1c' : undefined,
                  }}
                >
                  {progressMessage(order)}
                </span>
              </div>
            ),
          },
          {
            key: 'actions',
            title: 'Thao tác',
            width: 220,
            render: (order) => {
              const deliveryFailure = needsDeliveryIntervention(order);
              const canCollectCod = needsCodReconciliation(order);
              const canCancel = ['PLACED', 'STORE_CONFIRMED', 'PICKING'].includes(order.status);
              return (
                <div className="dash-row-actions">
                  {deliveryFailure && (
                    <>
                      <button
                        type="button"
                        className="dash-btn dash-btn-sm dash-btn-primary"
                        disabled={act.isPending}
                        onClick={() => act.mutate({ id: order.id, path: 'reassign-delivery' })}
                      >
                        Giao lại
                      </button>
                      <button
                        type="button"
                        className="dash-btn dash-btn-sm"
                        disabled={act.isPending}
                        onClick={() => setRestockTarget(order)}
                      >
                        Hủy & hoàn kho
                      </button>
                    </>
                  )}
                  {canCollectCod && (
                    <button
                      type="button"
                      className="dash-btn dash-btn-sm dash-btn-primary"
                      disabled={act.isPending}
                      onClick={() => act.mutate({ id: order.id, path: 'mark-cod-collected' })}
                    >
                      Đã thu COD
                    </button>
                  )}
                  {canCancel && (
                    <button
                      type="button"
                      className="dash-btn dash-btn-sm"
                      disabled={act.isPending}
                      onClick={() => setCancelTarget(order)}
                    >
                      Hủy đơn
                    </button>
                  )}
                  {!deliveryFailure && !canCollectCod && !canCancel && (
                    <span className="muted" style={{ fontSize: 12 }}>Chỉ theo dõi</span>
                  )}
                </div>
              );
            },
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
        onConfirm={(reason) =>
          cancelTarget && act.mutate({ id: cancelTarget.id, path: 'cancel', body: { reason } })}
      />

      <ConfirmModal
        open={!!restockTarget}
        title="Hủy đơn và hoàn kho"
        message={restockTarget
          ? `Hủy đơn #${restockTarget.orderNumber} và hoàn lại tồn kho? Thao tác này không thể hoàn tác.`
          : ''}
        confirmLabel="Hủy & hoàn kho"
        danger
        loading={act.isPending}
        requireReason
        reasonLabel="Lý do"
        onCancel={() => setRestockTarget(null)}
        onConfirm={(reason) =>
          restockTarget && act.mutate({ id: restockTarget.id, path: 'cancel-restock', body: { reason } })}
      />
    </>
  );
}

function needsAttention(order: StoreOrder) {
  return (
    ATTENTION.has(order.status) ||
    needsDeliveryIntervention(order) ||
    needsCodReconciliation(order)
  );
}

function needsDeliveryIntervention(order: StoreOrder) {
  return order.status === 'DELIVERY_FAILED' || order.delivery?.status === 'FAILED';
}

function needsCodReconciliation(order: StoreOrder) {
  return (
    order.status === 'DELIVERED' &&
    order.paymentMethod === 'COD' &&
    order.paymentStatus !== 'SUCCESS'
  );
}

function progressMessage(order: StoreOrder) {
  if (needsDeliveryIntervention(order)) return 'Giao thất bại — cần giao lại hoặc hoàn kho';
  if (needsCodReconciliation(order)) return 'Đã giao — cần đối soát COD';
  if (order.status === 'RETURN_REQUESTED') return 'Khách đã yêu cầu trả hàng';
  switch (order.status) {
    case 'PLACED':
      return 'Chờ kho kiểm tra và xác nhận';
    case 'STORE_CONFIRMED':
    case 'PICKING':
      return 'Kho đang soạn hàng';
    case 'PACKED':
      return 'Đang tự động bàn giao shipper';
    case 'READY_FOR_DELIVERY':
      return 'Chờ shipper đến lấy';
    case 'OUT_FOR_DELIVERY':
      return 'Shipper đang giao hàng';
    case 'DELIVERED':
      return 'Đã giao thành công';
    case 'COMPLETED':
      return 'Đã hoàn tất và đối soát';
    case 'CANCELLED':
      return 'Đơn đã hủy';
    case 'RETURNED':
      return 'Hàng đã được trả lại';
    default:
      return 'Đang theo dõi tiến độ';
  }
}
