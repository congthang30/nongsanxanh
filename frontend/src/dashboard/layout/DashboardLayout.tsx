import { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../lib/auth.store';
import { DashboardSidebar } from './Sidebar';
import { DashboardTopbar } from './Topbar';
import { pickRoleConfig, RoleCode, RoleConfig } from '../menu';
import './dashboard.css';

interface Props {
  allowed?: RoleCode[];
}

export function DashboardLayout({ allowed }: Props) {
  const { user, hasRole } = useAuthStore();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(() =>
    typeof window === 'undefined' ? true : window.innerWidth > 768,
  );
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  const isAdmin = user.roles.includes('ADMIN') || user.roles.includes('SUPER_ADMIN');
  const isOperationalView = !location.pathname.startsWith('/admin');
  if (isAdmin && isOperationalView && !localStorage.getItem('adminActiveStoreId')) {
    return <Navigate to="/admin/switch" replace />;
  }

  const roleConfig: RoleConfig | null = pickRoleConfig(user.roles, location.pathname);
  if (!roleConfig) {
    return <Navigate to="/" replace />;
  }
  if (allowed && !allowed.some((role) => hasRole(role))) {
    return <Navigate to={roleConfig.homePath} replace />;
  }

  return (
    <div className="min-h-screen bg-background text-on-background font-body-md flex antialiased">
      <DashboardSidebar
        config={roleConfig}
        collapsed={!sidebarOpen}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      <div
        className={
          'flex-1 transition-all duration-300 flex flex-col min-h-screen ' +
          (sidebarOpen ? 'md:ml-64' : 'md:ml-20')
        }
      >
        <DashboardTopbar
          roleConfig={roleConfig}
          onToggleSidebar={() => {
            if (window.innerWidth <= 768) {
              setMobileOpen((current) => !current);
            } else {
              setSidebarOpen((current) => !current);
            }
          }}
        />

        <main className="p-gutter flex-1 flex flex-col gap-xl">
          <Outlet />
        </main>

        <footer className="flex justify-between items-center px-gutter py-md mt-auto w-full bg-transparent border-t border-outline-variant/10">
          <span className="text-label-sm font-label-sm text-on-surface-variant">
            © 2026 Nông Sản Xanh
          </span>
          <div className="flex gap-4">
            <a className="text-label-sm text-on-surface-variant hover:text-primary" href="#">
              Hỗ trợ
            </a>
            <a className="text-label-sm text-on-surface-variant hover:text-primary" href="#">
              Quyền riêng tư
            </a>
            <a className="text-label-sm text-on-surface-variant hover:text-primary" href="#">
              Điều khoản
            </a>
          </div>
        </footer>
      </div>
    </div>
  );
}