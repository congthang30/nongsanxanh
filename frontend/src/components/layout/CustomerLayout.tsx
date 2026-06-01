import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuthStore } from '../../lib/auth.store';
import { useCartStore } from '../../lib/cart.store';
import { ChatWidget } from '../ChatWidget';
import { NotificationBell } from '../NotificationBell';
import { CartIcon } from '../icons';
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
            <span className="brand-logo" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 20A7 7 0 0 1 4 13c0-4 3-7 9-9 0 6-2 9-6 11" />
                <path d="M11 20c0-5 2-8 9-10" />
              </svg>
            </span>
            <span className="brand-name">Nông Sản<span>Xanh</span></span>
          </Link>

          <nav className="main-nav hide-mobile">
            <NavLink to="/" end>Trang chủ</NavLink>
            <NavLink to="/products">Sản phẩm</NavLink>
            {hasRole('ADMIN', 'SUPER_ADMIN') && (
              <NavLink to="/admin/dashboard">Quản trị</NavLink>
            )}
            {hasRole('STORE_MANAGER') && !hasRole('ADMIN', 'SUPER_ADMIN') && (
              <NavLink to="/store-manager/dashboard">Cửa hàng</NavLink>
            )}
            {hasRole('STORE_STAFF') && !hasRole('STORE_MANAGER', 'ADMIN', 'SUPER_ADMIN') && (
              <NavLink to="/store/orders">Đơn hàng</NavLink>
            )}
            {hasRole('WAREHOUSE_STAFF') && !hasRole('STORE_MANAGER', 'ADMIN', 'SUPER_ADMIN') && (
              <NavLink to="/warehouse/dashboard">Kho</NavLink>
            )}
            {hasRole('SHIPPER') && !hasRole('ADMIN', 'SUPER_ADMIN') && (
              <NavLink to="/shipper/dashboard">Giao hàng</NavLink>
            )}
            {hasRole('SUPPORT') && !hasRole('ADMIN', 'SUPER_ADMIN') && (
              <NavLink to="/staff/dashboard">Hỗ trợ</NavLink>
            )}
          </nav>

          <div className="header-actions">
            <Link to="/cart" className="cart-btn" aria-label="Giỏ hàng">
              <CartIcon />
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
              <span className="brand-logo" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 20A7 7 0 0 1 4 13c0-4 3-7 9-9 0 6-2 9-6 11" />
                  <path d="M11 20c0-5 2-8 9-10" />
                </svg>
              </span>
              <span className="brand-name">Nông Sản<span>Xanh</span></span>
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
          <div className="container">© 2026 Nông Sản Xanh. Demo TMĐT nông sản.</div>
        </div>
      </footer>

      <ChatWidget />
    </div>
  );
}
