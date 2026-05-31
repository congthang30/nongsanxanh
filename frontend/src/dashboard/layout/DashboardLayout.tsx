import { useEffect, useState } from 'react';
import { Outlet, useLocation, Navigate } from 'react-router-dom';
import { useAuthStore } from '../../lib/auth.store';
import { DashboardSidebar } from './Sidebar';
import { DashboardTopbar } from './Topbar';
import { pickRoleConfig, RoleCode, RoleConfig } from '../menu';
import './dashboard.css';

interface Props {
  /** Chi cho phep cac role nay vao layout (uu tien hon role detection). */
  allowed?: RoleCode[];
}

export function DashboardLayout({ allowed }: Props) {
  const { user, hasRole } = useAuthStore();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    return window.innerWidth > 1024;
  });
  const [mobileOpen, setMobileOpen] = useState(false);

  // Tu dong dong mobile drawer khi chuyen route
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  const roleConfig: RoleConfig | null = pickRoleConfig(user.roles);
  if (!roleConfig) {
    return <Navigate to="/" replace />;
  }
  if (allowed && !allowed.some((r) => hasRole(r))) {
    return <Navigate to={roleConfig.homePath} replace />;
  }

  return (
    <div className={`dash-shell ${sidebarOpen ? '' : 'dash-collapsed'}`}>
      <DashboardSidebar
        config={roleConfig}
        collapsed={!sidebarOpen}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />
      <div className="dash-main">
        <DashboardTopbar
          roleConfig={roleConfig}
          onToggleSidebar={() => {
            if (window.innerWidth <= 1024) {
              setMobileOpen((s) => !s);
            } else {
              setSidebarOpen((s) => !s);
            }
          }}
        />
        <div className="dash-content">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
