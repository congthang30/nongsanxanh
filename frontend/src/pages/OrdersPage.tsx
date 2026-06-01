import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useMemo, useState } from 'react';
import { api } from '../lib/api';
import { formatVnd, formatDateTime, ORDER_STATUS_LABEL, ORDER_STATUS_BADGE, paymentMethodLabel } from '../lib/format';
import { EmptyState, ErrorState } from '../components/States';

interface OrderRow {
  id: string; orderNumber: string; status: string; paymentMethod: string;
  grandTotal: number; createdAt: string;
  store?: { name: string } | null;
  items: { id: string; productNameSnapshot: string; quantity: string }[];
}

const STATUS_FILTERS: { value: string; label: string }[] = [
  { value: '', label: 'Tất cả' },
  { value: 'PENDING_PAYMENT', label: 'Chờ thanh toán' },
  { value: 'PLACED', label: 'Đã đặt' },
  { value: 'OUT_FOR_DELIVERY', label: 'Đang giao' },
  { value: 'COMPLETED', label: 'Hoàn thành' },
  { value: 'CANCELLED', label: 'Đã hủy' },
];

export default function OrdersPage() {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['my-orders'],
    queryFn: () => api.get('/orders').then((r) => r.data.data as OrderRow[]),
  });

  const filtered = useMemo(() => {
    return (data ?? []).filter((o) => {
      if (status && o.status !== status) return false;
      if (q && !o.orderNumber.toLowerCase().includes(q.trim().toLowerCase())) return false;
      return true;
    });
  }, [data, q, status]);

  return (
    <div className="container section">
      <h1 style={{ marginBottom: 20 }}>Đơn hàng của tôi</h1>

      <div className="stack gap" style={{ marginBottom: 20 }}>
        <input
          className="input"
          style={{ maxWidth: 360 }}
          placeholder="Tìm theo mã đơn..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Tìm theo mã đơn"
        />
        <div className="flex gap-sm" style={{ flexWrap: 'wrap' }}>
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              className={`btn btn-sm ${status === f.value ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setStatus(f.value)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="skeleton" style={{ height: 160 }} />
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : filtered.length > 0 ? (
        <div className="stack gap">
          {filtered.map((o) => (
            <Link key={o.id} to={`/orders/${o.id}`} className="card card-hover" style={{ padding: 20 }}>
              <div className="between" style={{ marginBottom: 8 }}>
                <strong>#{o.orderNumber}</strong>
                <span className={`badge ${ORDER_STATUS_BADGE[o.status] ?? 'badge-gray'}`}>
                  {ORDER_STATUS_LABEL[o.status] ?? o.status}
                </span>
              </div>
              {o.store && (
                <div className="muted" style={{ fontSize: 13, marginBottom: 4 }}>
                  Cửa hàng phụ trách: {o.store.name}
                </div>
              )}
              <div className="muted" style={{ fontSize: 14, marginBottom: 8 }}>
                {o.items.map((i) => `${i.productNameSnapshot} ×${Number(i.quantity)}`).join(', ')}
              </div>
              <div className="between">
                <span className="muted" style={{ fontSize: 13 }}>
                  {formatDateTime(o.createdAt)} · {paymentMethodLabel(o.paymentMethod)}
                </span>
                <span className="price">{formatVnd(o.grandTotal)}</span>
              </div>
            </Link>
          ))}
        </div>
      ) : data && data.length > 0 ? (
        <EmptyState
          title="Không có đơn phù hợp"
          description="Thử đổi bộ lọc hoặc từ khóa tìm kiếm."
        />
      ) : (
        <EmptyState
          title="Bạn chưa có đơn hàng nào"
          description="Hãy bắt đầu mua sắm nông sản tươi."
          action={<Link to="/products" className="btn btn-primary">Mua sắm ngay</Link>}
        />
      )}
    </div>
  );
}
