import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCartStore } from '../lib/cart.store';
import { useStoreContext } from '../lib/store.store';
import { useAuthStore } from '../lib/auth.store';
import { formatVnd } from '../lib/format';
import './cart.css';

export default function CartPage() {
  const { items, storeName, subtotal, hasIssues, fetch, update, remove, loading } =
    useCartStore();
  const { store } = useStoreContext();
  const { user } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    fetch().catch(() => {});
  }, [fetch]);

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
        <div className="card empty-cart">
          <h2>Gio hang trong</h2>
          <p className="muted">Hay kham pha cac nong san tuoi ngon cua chung toi.</p>
          <Link to="/products" className="btn btn-primary">Mua sam ngay</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container section">
      <h1 style={{ marginBottom: 8 }}>Gio hang</h1>
      {(storeName || store) && (
        <div className="cart-store-banner">
          Mua tu cua hang: <strong>{storeName ?? store?.name}</strong>
        </div>
      )}

      <div className="cart-layout">
        <div className="stack gap">
          <div className="stack gap-sm" style={{ marginBottom: 16 }}>
            {items.map((it) => (
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
                    <span className="cart-item-warn">Chi con {it.available} {it.unit}</span>
                  )}
                </div>
                <div className="qty-stepper">
                  <button onClick={() => update(it.id, Math.max(1, it.quantity - 1))}>-</button>
                  <span>{it.quantity}</span>
                  <button onClick={() => update(it.id, it.quantity + 1)}>+</button>
                </div>
                <div className="cart-item-total price">{formatVnd(it.lineTotal)}</div>
                <button className="cart-remove" onClick={() => remove(it.id)} aria-label="Xoa">
                  Xoa
                </button>
              </div>
            ))}
          </div>
        </div>

        <aside className="card cart-summary">
          <h3>Tom tat</h3>
          <div className="summary-row">
            <span className="muted">Tam tinh</span>
            <span>{formatVnd(subtotal)}</span>
          </div>
          <div className="summary-row">
            <span className="muted">Phi giao</span>
            <span>Tinh o buoc sau</span>
          </div>
          <div className="summary-divider" />
          <div className="summary-row summary-total">
            <strong>Tong</strong>
            <strong className="price">{formatVnd(subtotal)}</strong>
          </div>
          {hasIssues && (
            <p className="cart-item-warn" style={{ margin: '8px 0' }}>
              Mot so san pham vuot ton kho cua hang. Vui long giam so luong.
            </p>
          )}
          <button
            className="btn btn-primary btn-block"
            disabled={hasIssues}
            onClick={() => navigate(user ? '/checkout' : '/login')}
          >
            {user ? 'Tien hanh dat hang' : 'Dang nhap de dat hang'}
          </button>
          <Link to="/products" className="btn btn-ghost btn-block">
            Tiep tuc mua sam
          </Link>
        </aside>
      </div>
    </div>
  );
}
