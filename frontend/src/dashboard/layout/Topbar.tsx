import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useState } from 'react';
import { useAuthStore } from '../../lib/auth.store';
import { NotificationBell } from '../../components/NotificationBell';
import { RoleConfig } from '../menu';

interface Props {
  roleConfig: RoleConfig;
  onToggleSidebar: () => void;
}

export function DashboardTopbar({ roleConfig, onToggleSidebar }: Props) {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  // Breadcrumb don gian: tach pathname /admin/dashboard -> [admin, dashboard]
  const segments = location.pathname.split('/').filter(Boolean);
  const breadcrumbs = segments.map((seg, i) => ({
    path: '/' + segments.slice(0, i + 1).join('/'),
    label: humanize(seg),
  }));

  return (
    <header className="dash-topbar">
      <div className="dash-topbar-left">
        <button
          className="dash-icon-btn"
          onClick={onToggleSidebar}
          aria-label="Toggle sidebar"
        >
          ☰
        </button>
        <nav className="dash-breadcrumb" aria-label="Breadcrumb">
          {breadcrumbs.map((b, i) => (
            <span key={b.path} className="dash-breadcrumb-item">
              {i > 0 && <span className="dash-breadcrumb-sep">/</span>}
              {i === breadcrumbs.length - 1 ? (
                <span className="dash-breadcrumb-current">{b.label}</span>
              ) : (
                <Link to={b.path}>{b.label}</Link>
              )}
            </span>
          ))}
        </nav>
      </div>

      <div className="dash-topbar-right">
        <div className="dash-search">
          <input
            type="search"
            placeholder="Tim kiem nhanh..."
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const v = (e.target as HTMLInputElement).value.trim();
                if (v) navigate(`/products?q=${encodeURIComponent(v)}`);
              }
            }}
          />
        </div>
        <NotificationBell />
        <div className="dash-user-menu">
          <button
            className="dash-user-trigger"
            onClick={() => setMenuOpen((s) => !s)}
          >
            <span className="dash-user-avatar">
              {(user?.fullName ?? user?.email ?? '?')[0].toUpperCase()}
            </span>
            <span className="dash-user-info hide-mobile">
              <span className="dash-user-name">
                {user?.fullName ?? user?.email}
              </span>
              <span
                className="dash-user-role"
                style={{ color: roleConfig.badgeColor }}
              >
                {roleConfig.label}
              </span>
            </span>
            <span className="hide-mobile">▾</span>
          </button>
          {menuOpen && (
            <div
              className="dash-user-dropdown"
              onMouseLeave={() => setMenuOpen(false)}
            >
              <Link to="/" className="dash-dropdown-item">
                Ve trang khach
              </Link>
              <Link to="/orders" className="dash-dropdown-item">
                Don cua toi
              </Link>
              <button
                className="dash-dropdown-item"
                onClick={() => {
                  logout();
                  navigate('/login');
                }}
              >
                Dang xuat
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

function humanize(seg: string): string {
  const map: Record<string, string> = {
    admin: 'Admin',
    seller: 'Seller',
    staff: 'Staff',
    shipper: 'Shipper',
    warehouse: 'Warehouse',
    dashboard: 'Dashboard',
    orders: 'Don hang',
    products: 'San pham',
    shops: 'Shop',
    users: 'Nguoi dung',
    vouchers: 'Voucher',
    analytics: 'Phan tich',
    dispatch: 'Dieu phoi',
    settings: 'Cau hinh',
    profile: 'Ho so',
    areas: 'Khu vuc',
    inventory: 'Ton kho',
    reviews: 'Danh gia',
    tickets: 'Tickets',
    returns: 'Tra hang',
    offers: 'Don moi',
    active: 'Dang giao',
    history: 'Lich su',
    stock: 'Ton kho',
    imports: 'Nhap kho',
    exports: 'Xuat kho',
    packing: 'Dong goi',
    alerts: 'Canh bao',
  };
  return map[seg] ?? seg;
}
