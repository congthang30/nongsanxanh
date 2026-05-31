import { useEffect, useState, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useCartStore } from '../lib/cart.store';

export default function PaymentReturnPage() {
  const [params] = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'failed'>('loading');
  const { fetch } = useCartStore();
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;
    // Gui toan bo query VNPay len backend de verify + cap nhat
    const qs = params.toString();
    api
      .get(`/payments/vnpay/return?${qs}`)
      .then((r) => {
        setStatus(r.data.data.success ? 'success' : 'failed');
        fetch().catch(() => {});
      })
      .catch(() => setStatus('failed'));
  }, [params, fetch]);

  return (
    <div className="container section">
      <div className="card" style={{ padding: 56, textAlign: 'center', maxWidth: 480, margin: '0 auto' }}>
        {status === 'loading' && <><div style={{ fontSize: 56 }}>⏳</div><h2>Đang xác nhận thanh toán...</h2></>}
        {status === 'success' && (
          <>
            <div style={{ fontSize: 64 }}>✅</div>
            <h2 style={{ color: 'var(--green-600)' }}>Thanh toán thành công!</h2>
            <p className="muted" style={{ margin: '12px 0 24px' }}>Đơn hàng của bạn đã được xác nhận.</p>
            <Link to="/orders" className="btn btn-primary">Xem đơn hàng</Link>
          </>
        )}
        {status === 'failed' && (
          <>
            <div style={{ fontSize: 64 }}>❌</div>
            <h2 style={{ color: 'var(--danger)' }}>Thanh toán thất bại</h2>
            <p className="muted" style={{ margin: '12px 0 24px' }}>Giao dịch chưa hoàn tất. Bạn có thể thử lại trong chi tiết đơn.</p>
            <Link to="/orders" className="btn btn-dark">Về đơn hàng</Link>
          </>
        )}
      </div>
    </div>
  );
}
