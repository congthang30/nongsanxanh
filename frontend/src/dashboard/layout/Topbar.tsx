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
            placeholder="Tìm kiếm nhanh..."
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
                Về trang khách
              </Link>
              <Link to="/orders" className="dash-dropdown-item">
                Đơn của tôi
              </Link>
              <button
                className="dash-dropdown-item"
                onClick={() => {
                  logout();
                  navigate('/login');
                }}
              >
                Đăng xuất
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
    staff: 'Hỗ trợ',
    shipper: 'Shipper',
    warehouse: 'Kho',
    'store-manager': 'Quản lý cửa hàng',
    store: 'Cửa hàng',
    pos: 'POS',
    dashboard: 'Tổng quan',
    orders: 'Đơn hàng',
    products: 'Sản phẩm',
    stores: 'Cửa hàng',
    users: 'Người dùng',
    settings: 'Cấu hình',
    profile: 'Hồ sơ',
    inventory: 'Tồn kho',
    transactions: 'Lịch sử nhập/xuất',
    reviews: 'Đánh giá',
    reports: 'Báo cáo',
    audit: 'Nhật ký',
    tickets: 'Yêu cầu hỗ trợ',
    returns: 'Trả hàng',
    'pos-reports': 'Báo cáo POS',
    pick: 'Soạn hàng',
    active: 'Đang giao',
    history: 'Lịch sử',
    stock: 'Tồn kho',
    packing: 'Đóng gói',
    alerts: 'Cảnh báo',
  };
  return map[seg] ?? seg;
}
