import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCartStore } from '../lib/cart.store';
import { useAuthStore } from '../lib/auth.store';
import { useToastStore } from '../lib/toast.store';
import { getErrorMessage } from '../lib/api';
import { formatVnd } from '../lib/format';
import { EmptyState } from '../components/States';
import './cart.css';

export default function CartPage() {
  const { items, subtotal, hasIssues, fetch, update, remove, loading } =
    useCartStore();
  const { user } = useAuthStore();
  const { push } = useToastStore();
  const navigate = useNavigate();
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    fetch().catch(() => {});
  }, [fetch]);

  const changeQty = async (itemId: string, quantity: number) => {
    if (quantity < 1) return;
    setBusyId(itemId);
    try {
      await update(itemId, quantity);
    } catch (e) {
      push(getErrorMessage(e), 'error');
    } finally {
      setBusyId(null);
    }
  };

  const removeItem = async (itemId: string) => {
    setBusyId(itemId);
    try {
      await remove(itemId);
    } catch (e) {
      push(getErrorMessage(e), 'error');
    } finally {
      setBusyId(null);
    }
  };

  if (loading && items.length === 0) {
    return (
      <div className="container section">
        <div className="skeleton" style={{ height: 200 }} />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="container section">
        <EmptyState
          title="Giỏ hàng trống"
          description="Hãy khám phá các nông sản tươi ngon của chúng tôi."
          action={<Link to="/products" className="btn btn-primary">Mua sắm ngay</Link>}
        />
      </div>
    );
  }

  return (
    <div className="container section">
      <h1 style={{ marginBottom: 16 }}>Giỏ hàng</h1>

      <div className="cart-layout">
        <div className="stack gap">
          <div className="stack gap-sm" style={{ marginBottom: 16 }}>
            {items.map((it) => {
              const itemBusy = busyId === it.id;
              return (
                <div key={it.id} className={`card cart-item ${!it.inStock ? 'cart-item-issue' : ''}`}>
                  <div className="cart-item-img">
                    {it.image ? (
                      <img src={it.image} alt={it.name} />
                    ) : (
                      <div className="product-img-ph">NS</div>
                    )}
                  </div>
                  <div className="cart-item-info">
                    <Link to={`/products/${it.productId}`} className="cart-item-name">
                      {it.name}
                    </Link>
                    <span className="muted">{it.sku}</span>
                    <span className="price">{formatVnd(it.unitPrice)}/{it.unit}</span>
                    {!it.inStock && (
                      <span className="cart-item-warn">Chỉ còn {it.available} {it.unit}</span>
                    )}
                  </div>
                  <div className="qty-stepper">
                    <button
                      onClick={() => changeQty(it.id, Math.max(1, it.quantity - 1))}
                      disabled={itemBusy}
                      aria-label="Giảm số lượng"
                    >-</button>
                    <span>{it.quantity}</span>
                    <button
                      onClick={() => changeQty(it.id, it.quantity + 1)}
                      disabled={itemBusy}
                      aria-label="Tăng số lượng"
                    >+</button>
                  </div>
                  <div className="cart-item-total price">{formatVnd(it.lineTotal)}</div>
                  <button
                    className="cart-remove"
                    onClick={() => removeItem(it.id)}
                    disabled={itemBusy}
                    aria-label={`Xóa ${it.name}`}
                  >
                    Xóa
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        <aside className="card cart-summary">
          <h3>Tóm tắt đơn hàng</h3>
          <div className="summary-row">
            <span className="muted">Tạm tính</span>
            <span>{formatVnd(subtotal)}</span>
          </div>
          <div className="summary-row">
            <span className="muted">Phí giao hàng</span>
            <span className="cart-fee-hint">Tính sau khi chọn địa chỉ</span>
          </div>
          <div className="summary-divider" />
          <div className="summary-row summary-total">
            <strong>Tổng tạm tính</strong>
            <strong className="price">{formatVnd(subtotal)}</strong>
          </div>
          {hasIssues && (
            <p className="cart-item-warn" style={{ margin: '8px 0' }}>
              Một số sản phẩm vượt tồn kho cửa hàng. Vui lòng giảm số lượng.
            </p>
          )}
          <button
            className="btn btn-primary btn-block"
            disabled={hasIssues}
            onClick={() => navigate(user ? '/checkout' : '/login')}
          >
            {user ? 'Tiến hành đặt hàng' : 'Đăng nhập để đặt hàng'}
          </button>
          <Link to="/products" className="btn btn-ghost btn-block">
            Tiếp tục mua sắm
          </Link>
          <p className="note-banner note-banner-info" style={{ marginTop: 14 }}>
            Cửa hàng phụ trách sẽ được hệ thống chọn tự động theo địa chỉ giao
            hàng và tồn kho.
          </p>
        </aside>
      </div>
    </div>
  );
}
