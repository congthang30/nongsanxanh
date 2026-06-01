import { useEffect, useState, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useCartStore } from '../lib/cart.store';
import './payment.css';

type ReturnStatus = 'loading' | 'success' | 'failed' | 'pending';

export default function PaymentReturnPage() {
  const [params] = useSearchParams();
  const [status, setStatus] = useState<ReturnStatus>('loading');
  const [orderId, setOrderId] = useState<string | null>(null);
  const { fetch } = useCartStore();
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;
    // Gửi toàn bộ query VNPay lên backend để verify + cập nhật.
    // Không tự đánh dấu thành công cho tới khi backend xác nhận.
    const qs = params.toString();
    api
      .get(`/payments/vnpay/return?${qs}`)
      .then((r) => {
        const data = r.data.data ?? {};
        setOrderId(data.orderId ?? null);
        if (data.success === true) setStatus('success');
        else if (data.pending === true || data.status === 'PENDING') setStatus('pending');
        else setStatus('failed');
        fetch().catch(() => {});
      })
      .catch(() => setStatus('pending'));
  }, [params, fetch]);

  const orderLink = orderId ? `/orders/${orderId}` : '/orders';

  return (
    <div className="container section">
      <div className="card payment-return-card">
        {status === 'loading' && (
          <>
            <span className="payment-spinner" aria-hidden="true" />
            <h2>Đang xác nhận thanh toán</h2>
            <p className="muted">Vui lòng đợi trong giây lát...</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="payment-icon payment-icon-success" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6 9 17l-5-5" />
              </svg>
            </div>
            <h2 style={{ color: 'var(--green-600)' }}>Thanh toán thành công</h2>
            <p className="muted">Đơn hàng đang được cửa hàng chuẩn bị.</p>
            <div className="payment-actions">
              <Link to={orderLink} className="btn btn-primary">Xem đơn hàng</Link>
              <Link to="/products" className="btn btn-ghost">Tiếp tục mua hàng</Link>
            </div>
          </>
        )}

        {status === 'failed' && (
          <>
            <div className="payment-icon payment-icon-failed" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </div>
            <h2 style={{ color: 'var(--danger)' }}>Thanh toán chưa hoàn tất</h2>
            <p className="muted">Bạn có thể thử lại từ chi tiết đơn hàng.</p>
            <div className="payment-actions">
              <Link to={orderLink} className="btn btn-primary">Xem đơn hàng</Link>
              <Link to="/products" className="btn btn-ghost">Tiếp tục mua hàng</Link>
            </div>
          </>
        )}

        {status === 'pending' && (
          <>
            <div className="payment-icon payment-icon-pending" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7v5l3 2" />
              </svg>
            </div>
            <h2 style={{ color: 'var(--color-sky-600, #0284c7)' }}>Đang chờ xác nhận</h2>
            <p className="muted">Chúng tôi đang chờ xác nhận từ cổng thanh toán. Vui lòng mở chi tiết đơn hàng để kiểm tra trạng thái.</p>
            <div className="payment-actions">
              <Link to={orderLink} className="btn btn-primary">Xem đơn hàng</Link>
              <Link to="/products" className="btn btn-ghost">Tiếp tục mua hàng</Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
