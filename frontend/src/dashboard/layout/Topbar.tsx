import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  ChevronDown,
  LogOut,
  Menu,
  Search,
  ShoppingBag,
  Store,
  UserRound,
} from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getAccessTokenRoles, useAuthStore } from '../../lib/auth.store';
import { useBranchContextStore } from '../../lib/branch-context.store';
import { api } from '../../lib/api';
import { NotificationBell } from '../../components/NotificationBell';
import { RoleConfig } from '../menu';

interface Props {
  roleConfig: RoleConfig;
  onToggleSidebar: () => void;
}

interface StoreOption {
  id: string;
  name: string;
  code?: string;
}

export function DashboardTopbar({ roleConfig, onToggleSidebar }: Props) {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const decodedRoles = getAccessTokenRoles();
  const effectiveRoles = decodedRoles.length ? decodedRoles : (user?.roles ?? []);
  const isAdmin = effectiveRoles.includes('ADMIN') || effectiveRoles.includes('SUPER_ADMIN');
  const isAdminArea = location.pathname === '/admin' || location.pathname.startsWith('/admin/');
  const isAdminDashboard = location.pathname === '/admin' || location.pathname === '/admin/dashboard';
  const isStoreManagementRoute = [
    '/admin/stores',
    '/admin/orders',
    '/admin/inventory',
    '/admin/users',
    '/admin/reports',
    '/admin/returns',
    '/admin/audit',
  ].some((path) => location.pathname.startsWith(path));
  const hasStoreSpecificRole = effectiveRoles.some((role) =>
    ['STORE_MANAGER', 'STORE_STAFF', 'WAREHOUSE_STAFF', 'SHIPPER'].includes(role),
  );
  const showStoreSelector =
    !isAdminDashboard && ((isAdmin && isStoreManagementRoute) || (!isAdmin && hasStoreSpecificRole));
  const showProductSearch = !isAdminArea;
  const queryClient = useQueryClient();
  const activeBranchId = useBranchContextStore((state) => state.activeBranchId);
  const activeBranchName = useBranchContextStore((state) => state.activeBranchName);
  const setActiveBranch = useBranchContextStore((state) => state.setActiveBranch);

  const storesQuery = useQuery({
    queryKey: ['topbar-stores', isAdmin ? 'admin' : 'member'],
    queryFn: () =>
      api
        .get(isAdmin ? '/admin/stores' : '/store-context/branches')
        .then((response) => response.data.data as StoreOption[]),
    enabled: showStoreSelector,
  });

  const handleStoreChange = (storeId: string) => {
    const store = storesQuery.data?.find((item) => item.id === storeId);
    setActiveBranch(
      store
        ? { id: store.id, name: store.code ? `${store.code} - ${store.name}` : store.name }
        : null,
    );
    // Invalidate store-scoped dashboards without a full-cache thrash.
    void queryClient.invalidateQueries({
      predicate: (query) => {
        const key = String(query.queryKey[0] ?? '');
        return (
          key.startsWith('admin-') ||
          key.startsWith('sm-') ||
          key.startsWith('warehouse-') ||
          key.startsWith('pos-') ||
          key.includes('staff') ||
          key.includes('inventory') ||
          key.includes('orders')
        );
      },
    });
  };

  const activeBranchLabel = activeBranchId
    ? storesQuery.data?.find((item) => item.id === activeBranchId)
    : null;
  const activeBranchTitle = activeBranchLabel
    ? `${activeBranchLabel.code ? activeBranchLabel.code + ' - ' : ''}${activeBranchLabel.name}`
    : activeBranchName || 'Toàn hệ thống';

  const segments = location.pathname.split('/').filter(Boolean);
  const breadcrumbs = segments.map((segment, index) => ({
    path: '/' + segments.slice(0, index + 1).join('/'),
    label: humanize(segment),
  }));

  return (
    <header className="flex justify-between items-center h-16 px-gutter w-full z-40 sticky top-0 bg-surface-container-low dark:bg-surface-container shadow-[0_8px_30px_rgba(21,29,27,0.05)]">
      <div className="flex items-center gap-4 min-w-0">
        <button
          onClick={onToggleSidebar}
          className="p-2 text-on-surface rounded-full hover:bg-surface-variant transition-colors"
          aria-label="Mở hoặc thu gọn menu"
          title="Menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <nav
          className="items-center text-label-bold font-label-bold text-on-surface-variant gap-2 hidden md:flex min-w-0"
          aria-label="Điều hướng phân cấp"
        >
          {breadcrumbs.map((breadcrumb, index) => (
            <span key={breadcrumb.path} className="flex items-center gap-2 min-w-0">
              {index > 0 && <span className="text-on-surface-variant/40">/</span>}
              {index === breadcrumbs.length - 1 ? (
                <span className="text-primary font-bold truncate">{breadcrumb.label}</span>
              ) : (
                <Link to={breadcrumb.path} className="hover:text-primary transition-colors truncate">
                  {breadcrumb.label}
                </Link>
              )}
            </span>
          ))}
        </nav>
      </div>

      <div className="flex items-center gap-3 relative">
        {showProductSearch && (
          <div className="relative hidden lg:block">
            <input
            className="pl-4 pr-10 py-2 bg-surface border border-outline-variant rounded-full text-body-md focus:outline-none focus:ring-2 focus:ring-primary/20 w-56"
            placeholder="Tìm sản phẩm..."
            type="search"
            onKeyDown={(event) => {
              if (event.key !== 'Enter') return;
              const value = (event.target as HTMLInputElement).value.trim();
              if (value) navigate('/products?q=' + encodeURIComponent(value));
            }}
          />
          <Search
            aria-hidden="true"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant w-4 h-4"
            />
          </div>
        )}

        {showStoreSelector && (
          <label
            className="hidden sm:flex items-center gap-2 bg-surface border border-outline-variant px-3 py-1.5 rounded-lg min-w-0 max-w-[min(100%,22rem)]"
            title={`Chi nhánh áp dụng cho dữ liệu đang xem: ${activeBranchTitle}`}
          >
            <Store className="w-4 h-4 text-primary flex-none" />
            <span className="text-xs text-on-surface-variant hidden xl:inline flex-none">Chi nhánh hiện tại</span>
            <select
              value={activeBranchId ?? ''}
              onChange={(event) => handleStoreChange(event.target.value)}
              className="bg-transparent text-on-surface border-none cursor-pointer text-xs min-w-[10rem] max-w-[18rem] w-full"
              style={{ border: 'none', outline: 'none', padding: '2px 22px 2px 2px' }}
              title={activeBranchTitle}
              aria-label="Chọn chi nhánh hiện tại"
            >
              <option value="">Toàn hệ thống</option>
              {storesQuery.data?.map((store) => (
                <option key={store.id} value={store.id} title={`${store.code ? store.code + ' - ' : ''}${store.name}`}>
                  {store.code ? store.code + ' - ' : ''}
                  {store.name}
                </option>
              ))}
            </select>
          </label>
        )}

        <NotificationBell />

        <div className="relative">
          <button
            onClick={() => setMenuOpen((current) => !current)}
            className="flex items-center gap-2 hover:bg-surface-container-highest p-2 rounded-lg transition-colors"
            aria-expanded={menuOpen}
            aria-label="Mở menu tài khoản"
          >
            <div className="w-8 h-8 rounded-full bg-primary text-on-primary flex items-center justify-center font-bold text-label-bold">
              {(user?.fullName ?? user?.email ?? '?')[0].toUpperCase()}
            </div>
            <div className="hidden xl:flex flex-col text-left max-w-40">
              <span className="text-label-bold font-label-bold text-on-surface leading-tight truncate">
                {user?.fullName ?? user?.email}
              </span>
              <span className="text-[10px] text-primary leading-tight truncate">{roleConfig.label}</span>
            </div>
            <ChevronDown className="w-4 h-4 text-on-surface-variant" />
          </button>

          {menuOpen && (
            <div
              className="absolute right-0 top-full mt-2 w-52 bg-white border border-outline-variant/30 rounded-lg shadow-lg py-2 z-50"
              onMouseLeave={() => setMenuOpen(false)}
            >
              <Link
                to="/"
                className="flex items-center gap-2 px-4 py-2 text-sm text-on-surface hover:bg-surface-container-low transition-colors"
              >
                <ShoppingBag size={16} />
                Trang khách hàng
              </Link>
              <Link
                to="/orders"
                className="flex items-center gap-2 px-4 py-2 text-sm text-on-surface hover:bg-surface-container-low transition-colors"
              >
                <UserRound size={16} />
                Đơn hàng của tôi
              </Link>
              <button
                className="flex items-center gap-2 w-full text-left px-4 py-2 text-sm text-error hover:bg-error-container/20 transition-colors"
                onClick={() => {
                  logout();
                  navigate('/login');
                }}
              >
                <LogOut size={16} />
                Đăng xuất
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

function humanize(segment: string): string {
  const labels: Record<string, string> = {
    admin: 'Admin',
    staff: 'Hỗ trợ',
    shipper: 'Giao hàng',
    warehouse: 'Kho',
    'store-manager': 'Quản lý cửa hàng',
    store: 'Cửa hàng',
    pos: 'POS',
    dashboard: 'Tổng quan',
    orders: 'Đơn hàng',
    products: 'Sản phẩm',
    stores: 'Cửa hàng',
    users: 'Tài khoản',
    switch: 'Chọn vai trò',
    settings: 'Cấu hình',
    profile: 'Hồ sơ',
    inventory: 'Tồn kho',
    transactions: 'Lịch sử nhập xuất',
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
  return labels[segment] ?? segment;
}