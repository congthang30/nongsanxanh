import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import { useState } from 'react';
import { api, getErrorMessage } from '../lib/api';
import { useToastStore } from '../lib/toast.store';
import {
  formatVnd,
  ORDER_STATUS_LABEL,
  ORDER_STATUS_BADGE,
  DELIVERY_STATUS_LABEL,
} from '../lib/format';
import './order-detail.css';

interface OrderDetail {
  id: string; orderNumber: string; status: string; paymentStatus: string; paymentMethod: string;
  subtotal: number; discountTotal: number; shippingFee: number; grandTotal: number; note: string | null;
  createdAt: string;
  recipientName: string; recipientPhone: string; deliveryAddress: string; deliveryNote: string | null;
  assignmentDistanceKm: number | null;
  items: { id: string; productNameSnapshot: string; unitSnapshot: string; unitPrice: number; quantity: string; lineTotal: number; productId: string }[];
  statusHistory: { id: string; toStatus: string; reason: string | null; createdAt: string }[];
  store: { id: string; name: string; code: string; phone: string | null; province: string; district: string | null } | null;
  delivery: { id: string; status: string; distanceKm: number | null; events: { id: string; status: string; note: string | null; createdAt: string }[] } | null;
}

export default function OrderDetailPage() {
  const { id } = useParams();
  const qc = useQueryClient();
  const { push } = useToastStore();
  const [reviewing, setReviewing] = useState<string | null>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');

  const { data: order, isLoading } = useQuery({
    queryKey: ['order', id],
    queryFn: () => api.get(`/orders/${id}`).then((r) => r.data.data as OrderDetail),
  });

  const cancelMut = useMutation({
    mutationFn: () => api.post(`/orders/${id}/cancel`, { reason: 'Khach yeu cau huy' }),
    onSuccess: () => { push('Da huy don hang'); qc.invalidateQueries({ queryKey: ['order', id] }); },
    onError: (e) => push(getErrorMessage(e), 'error'),
  });

  const payMut = useMutation({
    mutationFn: () => api.post('/payments', { orderId: id }),
    onSuccess: (r) => { window.location.href = r.data.data.paymentUrl; },
    onError: (e) => push(getErrorMessage(e), 'error'),
  });

  const returnMut = useMutation({
    mutationFn: () =>
      api.post(`/orders/${id}/return`, {
        reason: 'Khach yeu cau tra hang',
        items: (order?.items ?? []).map((it) => ({
          orderItemId: it.id,
          quantity: Number(it.quantity),
        })),
      }),
    onSuccess: () => { push('Da gui yeu cau tra hang'); qc.invalidateQueries({ queryKey: ['order', id] }); },
    onError: (e) => push(getErrorMessage(e), 'error'),
  });

  const submitReview = async (orderItemId: string, productId: string) => {
    try {
      await api.post(`/orders/${id}/reviews`, { orderItemId, rating, comment });
      push('Cam on danh gia cua ban!');
      setReviewing(null); setComment(''); setRating(5);
      qc.invalidateQueries({ queryKey: ['reviews', productId] });
    } catch (e) {
      push(getErrorMessage(e), 'error');
    }
  };

  if (isLoading || !order) {
    return <div className="container section"><div className="skeleton" style={{ height: 300 }} /></div>;
  }

  const canCancel = ['PENDING_PAYMENT', 'PLACED', 'STORE_CONFIRMED'].includes(order.status);
  const canReview = ['DELIVERED', 'COMPLETED'].includes(order.status);
  const canReturn = ['DELIVERED', 'COMPLETED'].includes(order.status);
  const canPay = order.paymentMethod === 'VNPAY' && order.paymentStatus !== 'SUCCESS' && order.status !== 'CANCELLED';

  return (
    <div className="container section">
      <Link to="/orders" className="muted" style={{ fontSize: 14 }}>&larr; Quay lai don hang</Link>
      <div className="between" style={{ margin: '12px 0 24px' }}>
        <h1>Don #{order.orderNumber}</h1>
        <span className={`badge ${ORDER_STATUS_BADGE[order.status] ?? 'badge-gray'}`}>
          {ORDER_STATUS_LABEL[order.status] ?? order.status}
        </span>
      </div>

      <div className="order-detail-grid">
        <div className="stack gap-lg">
          {order.store && (
            <section className="card" style={{ padding: 20 }}>
              <div className="muted" style={{ fontSize: 13 }}>Cua hang phu trach</div>
              <strong style={{ fontSize: 16 }}>{order.store.name}</strong>
              <div className="muted">
                {order.store.district ? `${order.store.district}, ` : ''}{order.store.province}
                {order.store.phone && <> &middot; {order.store.phone}</>}
              </div>
            </section>
          )}

          <section className="card" style={{ padding: 24 }}>
            <h3 style={{ marginBottom: 16 }}>San pham</h3>
            {order.items.map((it) => (
              <div key={it.id} className="order-item-row">
                <div>
                  <strong>{it.productNameSnapshot}</strong>
                  <div className="muted">{formatVnd(it.unitPrice)}/{it.unitSnapshot} &times; {Number(it.quantity)}</div>
                </div>
                <div className="flex gap center">
                  <span className="price">{formatVnd(it.lineTotal ?? it.unitPrice * Number(it.quantity))}</span>
                  {canReview && (
                    <button className="btn btn-ghost btn-sm" onClick={() => setReviewing(reviewing === it.id ? null : it.id)}>
                      Danh gia
                    </button>
                  )}
                </div>
                {reviewing === it.id && (
                  <div className="review-form">
                    <div className="flex gap-sm" style={{ marginBottom: 8 }}>
                      {[1, 2, 3, 4, 5].map((s) => (
                        <button key={s} className={`star-btn ${s <= rating ? 'on' : ''}`} onClick={() => setRating(s)} type="button">
                          {s <= rating ? '\u2605' : '\u2606'}
                        </button>
                      ))}
                    </div>
                    <textarea className="input" rows={2} placeholder="Cam nhan cua ban..." value={comment} onChange={(e) => setComment(e.target.value)} />
                    <button className="btn btn-dark btn-sm" style={{ marginTop: 8 }} onClick={() => submitReview(it.id, it.productId)}>Gui danh gia</button>
                  </div>
                )}
              </div>
            ))}
          </section>

          {/* Timeline */}
          <section className="card" style={{ padding: 24 }}>
            <h3 style={{ marginBottom: 16 }}>Lich su don hang</h3>
            <div className="timeline">
              {order.statusHistory.map((h) => (
                <div key={h.id} className="timeline-item">
                  <div className="timeline-dot" />
                  <div>
                    <strong>{ORDER_STATUS_LABEL[h.toStatus] ?? h.toStatus}</strong>
                    {h.reason && <span className="muted"> &middot; {h.reason}</span>}
                    <div className="muted" style={{ fontSize: 13 }}>{new Date(h.createdAt).toLocaleString('vi-VN')}</div>
                  </div>
                </div>
              ))}
            </div>
            {order.delivery && order.delivery.events.length > 0 && (
              <>
                <h4 style={{ margin: '16px 0 12px' }}>Giao hang</h4>
                <div className="timeline">
                  {order.delivery.events.map((e) => (
                    <div key={e.id} className="timeline-item">
                      <div className="timeline-dot ship" />
                      <div>
                        <strong>{DELIVERY_STATUS_LABEL[e.status] ?? e.status}</strong>{e.note && <span className="muted"> &middot; {e.note}</span>}
                        <div className="muted" style={{ fontSize: 13 }}>{new Date(e.createdAt).toLocaleString('vi-VN')}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>
        </div>

        <aside className="stack gap">
          <section className="card" style={{ padding: 24 }}>
            <h3 style={{ marginBottom: 14 }}>Thanh toan</h3>
            <div className="summary-row between"><span className="muted">Tam tinh</span><span>{formatVnd(order.subtotal)}</span></div>
            {order.discountTotal > 0 && <div className="summary-row between" style={{ color: 'var(--green-600)' }}><span>Giam gia</span><span>&minus;{formatVnd(order.discountTotal)}</span></div>}
            <div className="summary-row between">
              <span className="muted">
                Phi giao{order.assignmentDistanceKm != null && (
                  <span style={{ fontSize: 12, color: '#94a3b8' }}> &middot; {Math.round(order.assignmentDistanceKm * 10) / 10} km</span>
                )}
              </span>
              <span>{order.shippingFee === 0 ? 'Mien phi' : formatVnd(order.shippingFee)}</span>
            </div>
            <div className="summary-divider" />
            <div className="summary-row between summary-total"><strong>Tong</strong><strong className="price">{formatVnd(order.grandTotal)}</strong></div>
            <p className="muted" style={{ fontSize: 13, marginTop: 8 }}>
              {order.paymentMethod} &middot; {order.paymentStatus}
            </p>
            {canPay && <button className="btn btn-primary btn-block" style={{ marginTop: 12 }} onClick={() => payMut.mutate()}>Thanh toan VNPay</button>}
            {canCancel && <button className="btn btn-ghost btn-block" style={{ marginTop: 8 }} onClick={() => cancelMut.mutate()}>Huy don</button>}
            {canReturn && <button className="btn btn-ghost btn-block" style={{ marginTop: 8 }} onClick={() => returnMut.mutate()} disabled={returnMut.isPending}>Yeu cau tra hang</button>}
          </section>

          <section className="card" style={{ padding: 24 }}>
            <h3 style={{ marginBottom: 10 }}>Giao den</h3>
            <strong>{order.recipientName}</strong>
            <div className="muted">{order.recipientPhone}</div>
            <div className="muted">{order.deliveryAddress}</div>
            {order.deliveryNote && <div className="muted" style={{ marginTop: 6, fontSize: 13 }}>Ghi chu: {order.deliveryNote}</div>}
          </section>
        </aside>
      </div>
    </div>
  );
}
