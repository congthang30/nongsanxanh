import { Link, NavLink } from 'react-router-dom';
import { RoleConfig } from '../menu';

interface Props {
  config: RoleConfig;
  collapsed: boolean;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export function DashboardSidebar({
  config,
  collapsed,
  mobileOpen,
  onCloseMobile,
}: Props) {
  return (
    <>
      {mobileOpen && (
        <div className="dash-sidebar-backdrop" onClick={onCloseMobile} />
      )}
      <aside
        className={`dash-sidebar ${collapsed ? 'dash-sidebar-collapsed' : ''} ${
          mobileOpen ? 'dash-sidebar-mobile-open' : ''
        }`}
      >
        <div className="dash-sidebar-brand">
          <Link to="/" className="dash-brand-link">
            <span className="dash-brand-logo">NX</span>
            {!collapsed && (
              <span className="dash-brand-name">
                NongSan<span>Xanh</span>
              </span>
            )}
          </Link>
        </div>

        <nav className="dash-nav">
          {config.groups.map((group, gi) => (
            <div key={gi} className="dash-nav-group">
              {group.title && !collapsed && (
                <div className="dash-nav-title">{group.title}</div>
              )}
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.exact}
                  className={({ isActive }) =>
                    `dash-nav-item ${isActive ? 'active' : ''}`
                  }
                  title={item.label}
                >
                  <span className="dash-nav-icon">○</span>
                  {!collapsed && (
                    <span className="dash-nav-label">{item.label}</span>
                  )}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="dash-sidebar-foot">
          <Link to="/" className="dash-nav-item">
            <span className="dash-nav-icon">←</span>
            {!collapsed && (
              <span className="dash-nav-label">Về trang khách</span>
            )}
          </Link>
        </div>
      </aside>
    </>
  );
}
