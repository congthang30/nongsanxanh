import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { formatVnd, ORDER_STATUS_LABEL, ORDER_STATUS_BADGE } from '../lib/format';

interface OrderRow {
  id: string; orderNumber: string; status: string; paymentMethod: string;
  grandTotal: number; createdAt: string;
  store?: { name: string } | null;
  items: { id: string; productNameSnapshot: string; quantity: string }[];
}

export default function OrdersPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['my-orders'],
    queryFn: () => api.get('/orders').then((r) => r.data.data as OrderRow[]),
  });

  return (
    <div className="container section">
      <h1 style={{ marginBottom: 24 }}>Don hang cua toi</h1>
      {isLoading ? (
        <div className="skeleton" style={{ height: 160 }} />
      ) : data && data.length > 0 ? (
        <div className="stack gap">
          {data.map((o) => (
            <Link key={o.id} to={`/orders/${o.id}`} className="card card-hover" style={{ padding: 20 }}>
              <div className="between" style={{ marginBottom: 8 }}>
                <strong>#{o.orderNumber}</strong>
                <span className={`badge ${ORDER_STATUS_BADGE[o.status] ?? 'badge-gray'}`}>
                  {ORDER_STATUS_LABEL[o.status] ?? o.status}
                </span>
              </div>
              {o.store && (
                <div className="muted" style={{ fontSize: 13, marginBottom: 4 }}>{o.store.name}</div>
              )}
              <div className="muted" style={{ fontSize: 14, marginBottom: 8 }}>
                {o.items.map((i) => `${i.productNameSnapshot} ×${Number(i.quantity)}`).join(', ')}
              </div>
              <div className="between">
                <span className="muted" style={{ fontSize: 13 }}>
                  {new Date(o.createdAt).toLocaleString('vi-VN')} · {o.paymentMethod}
                </span>
                <span className="price">{formatVnd(o.grandTotal)}</span>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="card" style={{ padding: 48, textAlign: 'center' }}>
          <p className="muted">Ban chua co don hang nao.</p>
          <Link to="/products" className="btn btn-primary" style={{ marginTop: 12 }}>Mua sam ngay</Link>
        </div>
      )}
    </div>
  );
}
