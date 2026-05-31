import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuthStore } from '../../lib/auth.store';
import { useCartStore } from '../../lib/cart.store';
import { ChatWidget } from '../ChatWidget';
import { NotificationBell } from '../NotificationBell';
import './layout.css';

export function CustomerLayout() {
  const { user, logout, hasRole } = useAuthStore();
  const { count, fetch } = useCartStore();
  const navigate = useNavigate();

  useEffect(() => {
    fetch().catch(() => {});
  }, [fetch]);

  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="container header-inner">
          <Link to="/" className="brand">
            <span className="brand-logo">🌿</span>
            <span className="brand-name">NongSan<span>Xanh</span></span>
          </Link>

          <nav className="main-nav hide-mobile">
            <NavLink to="/" end>Trang chủ</NavLink>
            <NavLink to="/products">Sản phẩm</NavLink>
            {hasRole('ADMIN', 'SUPER_ADMIN') && (
              <NavLink to="/admin/dashboard">Quan tri</NavLink>
            )}
            {hasRole('STORE_MANAGER') && !hasRole('ADMIN', 'SUPER_ADMIN') && (
              <NavLink to="/store-manager/dashboard">Cua hang</NavLink>
            )}
            {hasRole('STORE_STAFF') && !hasRole('STORE_MANAGER', 'ADMIN', 'SUPER_ADMIN') && (
              <NavLink to="/store/orders">Don hang</NavLink>
            )}
            {hasRole('WAREHOUSE_STAFF') && !hasRole('STORE_MANAGER', 'ADMIN', 'SUPER_ADMIN') && (
              <NavLink to="/warehouse/dashboard">Kho</NavLink>
            )}
            {hasRole('SHIPPER') && !hasRole('ADMIN', 'SUPER_ADMIN') && (
              <NavLink to="/shipper/dashboard">Giao hang</NavLink>
            )}
            {hasRole('SUPPORT') && !hasRole('ADMIN', 'SUPER_ADMIN') && (
              <NavLink to="/staff/dashboard">Ho tro</NavLink>
            )}
          </nav>

          <div className="header-actions">
            <Link to="/cart" className="cart-btn" aria-label="Gio hang">
              🛒
              {count > 0 && <span className="cart-count">{count}</span>}
            </Link>
            {user ? (
              <div className="user-menu">
                <NotificationBell />
                <Link to="/orders" className="btn btn-ghost btn-sm hide-mobile">Đơn của tôi</Link>
                <span className="user-name hide-mobile">{user.fullName ?? user.email}</span>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => { logout(); navigate('/'); }}
                >
                  Đăng xuất
                </button>
              </div>
            ) : (
              <Link to="/login" className="btn btn-primary btn-sm">Đăng nhập</Link>
            )}
          </div>
        </div>
      </header>

      <main className="site-main">
        <Outlet />
      </main>

      <footer className="site-footer">
        <div className="container footer-grid">
          <div>
            <div className="brand brand-footer">
              <span className="brand-logo">🌿</span>
              <span className="brand-name">NongSan<span>Xanh</span></span>
            </div>
            <p className="muted footer-desc">
              Nông sản tươi sạch, truy xuất nguồn gốc, giao nhanh tận nhà.
            </p>
          </div>
          <div>
            <h4>Mua sắm</h4>
            <Link to="/products">Tất cả sản phẩm</Link>
            <Link to="/cart">Giỏ hàng</Link>
            <Link to="/orders">Đơn hàng</Link>
          </div>
          <div>
            <h4>Hỗ trợ</h4>
            <a href="#">Chính sách giao hàng</a>
            <a href="#">Đổi trả & hoàn tiền</a>
            <a href="#">Truy xuất nguồn gốc</a>
          </div>
          <div>
            <h4>Thanh toán</h4>
            <p className="muted">COD · VNPay</p>
          </div>
        </div>
        <div className="footer-bottom">
          <div className="container">© 2026 NongSan Xanh. Demo TMĐT nông sản.</div>
        </div>
      </footer>

      <ChatWidget />
    </div>
  );
}
