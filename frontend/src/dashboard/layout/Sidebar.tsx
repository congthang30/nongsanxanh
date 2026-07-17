import { Link, NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Store,
  ShoppingCart,
  Undo2,
  Sprout,
  Package,
  Users,
  BarChart3,
  Terminal,
  Calculator,
  ClipboardCheck,
  History,
  LifeBuoy,
  Truck,
  HelpCircle,
  LogOut
} from 'lucide-react';
import { RoleConfig } from '../menu';

const iconMap: Record<string, React.ComponentType<any>> = {
  LayoutDashboard,
  Store,
  ShoppingCart,
  Undo2,
  Sprout,
  Package,
  Users,
  BarChart3,
  Terminal,
  Calculator,
  ClipboardCheck,
  History,
  LifeBuoy,
  Truck,
  HelpCircle
};

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
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div 
          className="fixed inset-0 bg-black/40 z-40 md:hidden" 
          onClick={onCloseMobile} 
        />
      )}
      
      <aside
        className={`fixed left-0 top-0 h-full bg-surface-container-low dark:bg-surface-container-lowest py-lg px-md gap-2 border-r border-outline-variant/30 shadow-sm z-50 transition-all duration-300 flex flex-col ${
          collapsed ? 'w-20' : 'w-64'
        } ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* Brand Section */}
        <div className="flex flex-col mb-8 px-2 overflow-hidden whitespace-nowrap">
          <Link to="/" className="flex flex-col">
            <span className="text-headline-md font-headline-md font-bold text-primary dark:text-primary-fixed">
              {collapsed ? 'NX' : 'Nông Sản Xanh'}
            </span>
            {!collapsed && (
              <span className="text-label-sm font-label-sm text-on-surface-variant">
                {config.label} Console
              </span>
            )}
          </Link>
        </div>

        {/* Navigation Items */}
        <nav className="flex-grow flex flex-col gap-2 overflow-y-auto">
          {config.groups.map((group, gi) => (
            <div key={gi} className="flex flex-col gap-1">
              {group.title && !collapsed && (
                <div className="mt-4 mb-2 px-4 text-label-sm font-label-sm text-on-surface-variant uppercase tracking-wider">
                  {group.title}
                </div>
              )}
              {group.items.map((item) => {
                const IconComponent = iconMap[item.icon] || HelpCircle;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.exact}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                        isActive
                          ? 'bg-secondary-container dark:bg-secondary text-on-secondary-container dark:text-on-secondary scale-95'
                          : 'text-on-surface-variant dark:text-on-surface hover:bg-surface-container-highest dark:hover:bg-surface-variant'
                      } ${collapsed ? 'justify-center' : ''}`
                    }
                    title={item.label}
                  >
                    <IconComponent className="w-5 h-5 flex-shrink-0" />
                    {!collapsed && (
                      <span className="text-label-bold font-label-bold">{item.label}</span>
                    )}
                  </NavLink>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Sidebar Footer */}
        <div className="mt-auto pt-4 border-t border-outline-variant/30">
          <Link 
            to="/" 
            className={`flex items-center gap-3 text-on-surface-variant dark:text-on-surface px-4 py-3 hover:bg-surface-container-highest rounded-xl transition-all ${
              collapsed ? 'justify-center' : ''
            }`}
            title="Về trang khách"
          >
            <LogOut className="w-5 h-5 flex-shrink-0" />
            {!collapsed && (
              <span className="text-label-bold font-label-bold">Về trang khách</span>
            )}
          </Link>
        </div>
      </aside>
    </>
  );
}
