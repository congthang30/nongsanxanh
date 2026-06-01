import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import { useState } from 'react';
import { api, getErrorMessage } from '../lib/api';
import { useToastStore } from '../lib/toast.store';
import { ConfirmModal } from '../components/ConfirmModal';
import {
  formatVnd,
  formatDateTime,
  ORDER_STATUS_LABEL,
  ORDER_STATUS_BADGE,
  DELIVERY_STATUS_LABEL,
  PAYMENT_STATUS_LABEL,
  PAYMENT_STATUS_BADGE,
  paymentMethodLabel,
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
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);
  const [returnQty, setReturnQty] = useState<Record<string, number>>({});
  const [returnReason, setReturnReason] = useState('');

  const { data: order, isLoading } = useQuery({
    queryKey: ['order', id],
    queryFn: () => api.get(`/orders/${id}`).then((r) => r.data.data as OrderDetail),
  });

  const cancelMut = useMutation({
    mutationFn: (reason: string) => api.post(`/orders/${id}/cancel`, { reason }),
    onSuccess: () => { push('Đã hủy đơn hàng'); setConfirmCancel(false); qc.invalidateQueries({ queryKey: ['order', id] }); },
    onError: (e) => { push(getErrorMessage(e), 'error'); setConfirmCancel(false); },
  });

  const payMut = useMutation({
    mutationFn: () => api.post('/payments', { orderId: id }),
    onSuccess: (r) => { window.location.href = r.data.data.paymentUrl; },
    onError: (e) => push(getErrorMessage(e), 'error'),
  });

  const returnMut = useMutation({
    mutationFn: () =>
      api.post(`/orders/${id}/return`, {
        reason: returnReason.trim(),
        items: (order?.items ?? [])
          .filter((it) => (returnQty[it.id] ?? 0) > 0)
          .map((it) => ({ orderItemId: it.id, quantity: returnQty[it.id] })),
      }),
    onSuccess: () => {
      push('Đã gửi yêu cầu trả hàng');
      setReturnOpen(false); setReturnQty({}); setReturnReason('');
      qc.invalidateQueries({ queryKey: ['order', id] });
    },
    onError: (e) => push(getErrorMessage(e), 'error'),
  });

  const submitReview = async (orderItemId: string, productId: string) => {
    try {
      await api.post(`/orders/${id}/reviews`, { orderItemId, rating, comment });
      push('Cảm ơn đánh giá của bạn!');
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
  const returnTotalQty = Object.values(returnQty).reduce((s, n) => s + (n || 0), 0);

  return (
    <div className="container section">
      <Link to="/orders" className="muted" style={{ fontSize: 14 }}>&larr; Quay lại đơn hàng</Link>
      <div className="between" style={{ margin: '12px 0 24px', flexWrap: 'wrap', gap: 10 }}>
        <h1>Đơn #{order.orderNumber}</h1>
        <div className="flex gap-sm center">
          <span className={`badge ${ORDER_STATUS_BADGE[order.status] ?? 'badge-gray'}`}>
            {ORDER_STATUS_LABEL[order.status] ?? order.status}
          </span>
          <span className={`badge ${PAYMENT_STATUS_BADGE[order.paymentStatus] ?? 'badge-gray'}`}>
            {PAYMENT_STATUS_LABEL[order.paymentStatus] ?? order.paymentStatus}
          </span>
        </div>
      </div>

      <div className="order-detail-grid">
        <div className="stack gap-lg">
          {order.store && (
            <section className="card" style={{ padding: 20 }}>
              <div className="muted" style={{ fontSize: 13 }}>Cửa hàng phụ trách</div>
              <strong style={{ fontSize: 16 }}>{order.store.name}</strong>
              <div className="muted">
                {order.store.district ? `${order.store.district}, ` : ''}{order.store.province}
                {order.store.phone && <> &middot; {order.store.phone}</>}
              </div>
            </section>
          )}

          <section className="card" style={{ padding: 24 }}>
            <h3 style={{ marginBottom: 16 }}>Sản phẩm</h3>
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
                      Đánh giá
                    </button>
                  )}
                </div>
                {reviewing === it.id && (
                  <div className="review-form">
                    <div className="flex gap-sm" style={{ marginBottom: 8 }}>
                      {[1, 2, 3, 4, 5].map((s) => (
                        <button key={s} className={`star-btn ${s <= rating ? 'on' : ''}`} onClick={() => setRating(s)} type="button" aria-label={`${s} sao`}>
                          {s <= rating ? '\u2605' : '\u2606'}
                        </button>
                      ))}
                    </div>
                    <textarea className="input" rows={2} placeholder="Cảm nhận của bạn..." value={comment} onChange={(e) => setComment(e.target.value)} />
                    <button className="btn btn-dark btn-sm" style={{ marginTop: 8 }} onClick={() => submitReview(it.id, it.productId)}>Gửi đánh giá</button>
                  </div>
                )}
              </div>
            ))}
          </section>

          {/* Timeline */}
          <section className="card" style={{ padding: 24 }}>
            <h3 style={{ marginBottom: 16 }}>Lịch sử đơn hàng</h3>
            <div className="timeline">
              {order.statusHistory.map((h) => (
                <div key={h.id} className="timeline-item">
                  <div className="timeline-dot" />
                  <div>
                    <strong>{ORDER_STATUS_LABEL[h.toStatus] ?? h.toStatus}</strong>
                    {h.reason && <span className="muted"> &middot; {h.reason}</span>}
                    <div className="muted" style={{ fontSize: 13 }}>{formatDateTime(h.createdAt)}</div>
                  </div>
                </div>
              ))}
            </div>
            {order.delivery && order.delivery.events.length > 0 && (
              <>
                <h4 style={{ margin: '16px 0 12px' }}>Giao hàng</h4>
                <div className="timeline">
                  {order.delivery.events.map((e) => (
                    <div key={e.id} className="timeline-item">
                      <div className="timeline-dot ship" />
                      <div>
                        <strong>{DELIVERY_STATUS_LABEL[e.status] ?? e.status}</strong>{e.note && <span className="muted"> &middot; {e.note}</span>}
                        <div className="muted" style={{ fontSize: 13 }}>{formatDateTime(e.createdAt)}</div>
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
            <h3 style={{ marginBottom: 14 }}>Thanh toán</h3>
            <div className="summary-row between"><span className="muted">Tạm tính</span><span>{formatVnd(order.subtotal)}</span></div>
            {order.discountTotal > 0 && <div className="summary-row between" style={{ color: 'var(--green-600)' }}><span>Giảm giá</span><span>&minus;{formatVnd(order.discountTotal)}</span></div>}
            <div className="summary-row between">
              <span className="muted">
                Phí giao hàng{order.assignmentDistanceKm != null && (
                  <span style={{ fontSize: 12, color: '#94a3b8' }}> &middot; {Math.round(order.assignmentDistanceKm * 10) / 10} km</span>
                )}
              </span>
              <span>{order.shippingFee === 0 ? 'Miễn phí' : formatVnd(order.shippingFee)}</span>
            </div>
            <div className="summary-divider" />
            <div className="summary-row between summary-total"><strong>Tổng cộng</strong><strong className="price">{formatVnd(order.grandTotal)}</strong></div>
            <p className="muted" style={{ fontSize: 13, marginTop: 8 }}>
              {paymentMethodLabel(order.paymentMethod)} &middot; {PAYMENT_STATUS_LABEL[order.paymentStatus] ?? order.paymentStatus}
            </p>
            {canPay && <button className="btn btn-primary btn-block" style={{ marginTop: 12 }} onClick={() => payMut.mutate()} disabled={payMut.isPending}>{payMut.isPending ? 'Đang chuyển tới VNPay...' : 'Thanh toán qua VNPay'}</button>}
            {canCancel && <button className="btn btn-ghost btn-block" style={{ marginTop: 8 }} onClick={() => setConfirmCancel(true)}>Hủy đơn</button>}
            {canReturn && <button className="btn btn-ghost btn-block" style={{ marginTop: 8 }} onClick={() => setReturnOpen(true)}>Yêu cầu trả hàng</button>}
          </section>

          <section className="card" style={{ padding: 24 }}>
            <h3 style={{ marginBottom: 10 }}>Giao đến</h3>
            <strong>{order.recipientName}</strong>
            <div className="muted">{order.recipientPhone}</div>
            <div className="muted">{order.deliveryAddress}</div>
            {order.deliveryNote && <div className="muted" style={{ marginTop: 6, fontSize: 13 }}>Ghi chú: {order.deliveryNote}</div>}
          </section>
        </aside>
      </div>

      {/* Confirm hủy đơn */}
      <ConfirmModal
        open={confirmCancel}
        title="Hủy đơn hàng"
        message={`Bạn chắc chắn muốn hủy đơn #${order.orderNumber}? Thao tác này không thể hoàn tác.`}
        confirmLabel="Hủy đơn"
        cancelLabel="Không"
        danger
        loading={cancelMut.isPending}
        requireReason
        reasonLabel="Lý do hủy"
        reasonPlaceholder="VD: Đặt nhầm, muốn đổi sản phẩm..."
        onCancel={() => setConfirmCancel(false)}
        onConfirm={(reason) => cancelMut.mutate(reason)}
      />

      {/* Form trả hàng */}
      {returnOpen && (
        <div className="dash-modal-overlay" onClick={() => setReturnOpen(false)}>
          <div className="dash-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Yêu cầu trả hàng</h2>
            <p className="muted" style={{ marginBottom: 12 }}>Chọn sản phẩm và số lượng muốn trả.</p>
            <div className="stack gap-sm" style={{ marginBottom: 12 }}>
              {order.items.map((it) => {
                const max = Number(it.quantity);
                const val = returnQty[it.id] ?? 0;
                return (
                  <div key={it.id} className="between" style={{ gap: 12, alignItems: 'center' }}>
                    <span style={{ flex: 1 }}>{it.productNameSnapshot} <span className="muted">(tối đa {max})</span></span>
                    <div className="qty-stepper">
                      <button type="button" onClick={() => setReturnQty((s) => ({ ...s, [it.id]: Math.max(0, val - 1) }))} aria-label="Giảm">-</button>
                      <span>{val}</span>
                      <button type="button" onClick={() => setReturnQty((s) => ({ ...s, [it.id]: Math.min(max, val + 1) }))} aria-label="Tăng">+</button>
                    </div>
                  </div>
                );
              })}
            </div>
            <label className="field">
              <span style={{ fontWeight: 600, fontSize: 14 }}>Lý do trả hàng</span>
              <textarea className="input" rows={3} value={returnReason} onChange={(e) => setReturnReason(e.target.value)} placeholder="VD: Sản phẩm bị hỏng, không đúng mô tả..." />
            </label>
            <div className="flex gap-sm" style={{ justifyContent: 'flex-end', marginTop: 8 }}>
              <button className="btn btn-ghost" onClick={() => setReturnOpen(false)}>Đóng</button>
              <button
                className="btn btn-primary"
                disabled={returnMut.isPending || returnTotalQty === 0 || returnReason.trim().length < 3}
                onClick={() => returnMut.mutate()}
              >
                {returnMut.isPending ? 'Đang gửi...' : 'Gửi yêu cầu'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
