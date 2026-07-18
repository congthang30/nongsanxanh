import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, LayoutDashboard, LogOut, Package } from 'lucide-react';
import { useAuthStore } from '../../lib/auth.store';
import { useCartStore } from '../../lib/cart.store';
import { pickRoleConfig } from '../../dashboard/menu';
import { ChatWidget } from '../ChatWidget';
import { NotificationBell } from '../NotificationBell';
import { PageTransition } from '../PageTransition';
import './layout.css';

export function CustomerLayout() {
  const { user, logout } = useAuthStore();
  const { count, fetch } = useCartStore();
  const navigate = useNavigate();
  const [headerSearch, setHeaderSearch] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  const management = useMemo(() => {
    if (!user) return null;
    const config = pickRoleConfig(user.roles);
    if (!config) return null;
    // Only operational/admin roles get a console entry (not pure CUSTOMER)
    const staffRoles = [
      'ADMIN',
      'SUPER_ADMIN',
      'STORE_MANAGER',
      'STORE_STAFF',
      'WAREHOUSE_STAFF',
      'SHIPPER',
      'SUPPORT',
    ];
    if (!user.roles.some((r) => staffRoles.includes(r))) return null;
    return {
      to: config.homePath,
      label: 'Vào trang quản lý',
      roleLabel: config.label,
    };
  }, [user]);

  useEffect(() => {
    fetch().catch(() => {});
  }, [fetch]);

  useEffect(() => {
    if (!profileOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!profileRef.current?.contains(event.target as Node)) {
        setProfileOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setProfileOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [profileOpen]);

  const handleHeaderSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = headerSearch.trim();
    navigate(q ? `/products?q=${encodeURIComponent(q)}` : '/products');
  };

  const displayName = user?.fullName ?? user?.email ?? 'Tài khoản';
  const initials =
    (user?.fullName ?? user?.email ?? 'KH')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('') || 'KH';

  return (
    <div className="flex flex-col min-h-screen bg-background text-on-surface">
      {/* TopNavBar */}
      <header className="sticky top-0 w-full z-50 bg-white/80 backdrop-blur-xl border-b border-outline-variant/50 transition-all duration-300">
        <div className="flex justify-between items-center h-20 px-4 sm:px-6 lg:px-10 max-w-container-max mx-auto gap-4">
          {/* Brand Logo */}
          <Link className="flex items-center gap-2 sm:gap-3 group flex-shrink-0" to="/">
            <span className="material-symbols-outlined text-primary text-3xl group-hover:scale-110 transition-transform duration-300 flex-shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>eco</span>
            <h1 className="font-display-lg text-xl sm:text-2xl font-bold text-on-surface tracking-tight whitespace-nowrap">Nông Sản Xanh</h1>
          </Link>
          
          {/* Navigation Links (Desktop) — storefront only */}
          <nav className="hidden lg:flex gap-4 xl:gap-6 items-center flex-shrink-0 text-sm">
            <NavLink
              className={({ isActive }) =>
                `font-body-md font-medium pb-1 border-b-2 transition-all duration-200 ${isActive ? 'text-primary border-primary' : 'text-on-surface-variant border-transparent hover:text-primary hover:border-primary/30'}`
              }
              to="/"
              end
            >
              Trang chủ
            </NavLink>
            <NavLink
              className={({ isActive }) =>
                `font-body-md font-medium pb-1 border-b-2 transition-all duration-200 ${isActive ? 'text-primary border-primary' : 'text-on-surface-variant border-transparent hover:text-primary hover:border-primary/30'}`
              }
              to="/products"
            >
              Sản phẩm
            </NavLink>
          </nav>

          {/* Action Cluster */}
          <div className="flex items-center gap-2 sm:gap-3 lg:gap-4 xl:gap-6 flex-shrink-0">
            {/* Search Input (Desktop Only) */}
            <form onSubmit={handleHeaderSearch} className="hidden xl:flex items-center bg-surface-container-low px-4 py-2.5 rounded-full border border-transparent focus-within:border-primary/30 focus-within:bg-white transition-all shadow-sm">
              <span className="material-symbols-outlined text-outline">search</span>
              <input 
                className="bg-transparent border-none focus:ring-0 text-sm w-40 xl:w-48 ml-2 text-on-surface placeholder:text-outline focus:outline-none" 
                placeholder="Tìm rau củ, trái cây..." 
                type="text"
                value={headerSearch}
                onChange={(e) => setHeaderSearch(e.target.value)}
              />
            </form>
            
            <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
              <Link className="p-2 hover:bg-surface-container-low rounded-full transition-all relative text-on-surface-variant hover:text-primary flex items-center justify-center" to="/cart" aria-label="Giỏ hàng">
                <span className="material-symbols-outlined">shopping_cart</span>
                {count > 0 && (
                  <span className="absolute top-0.5 right-0.5 bg-primary text-white text-[10px] w-4 h-4 flex items-center justify-center rounded-full font-medium ring-2 ring-white">
                    {count}
                  </span>
                )}
              </Link>
              {user && <NotificationBell />}
            </div>
            
            <div className="h-6 w-[1px] bg-outline-variant hidden lg:block"></div>
            
            {/* Profile dropdown (Desktop) */}
            <div className="hidden lg:flex items-center flex-shrink-0">
              {user ? (
                <div className="relative" ref={profileRef}>
                  <button
                    type="button"
                    onClick={() => setProfileOpen((open) => !open)}
                    className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-full hover:bg-surface-container-low transition-colors max-w-[220px]"
                    aria-expanded={profileOpen}
                    aria-haspopup="menu"
                    aria-label="Mở menu tài khoản"
                  >
                    <span className="w-9 h-9 rounded-full bg-primary text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                      {initials}
                    </span>
                    <span className="text-sm font-medium text-on-surface truncate text-left">
                      {displayName}
                    </span>
                    <ChevronDown
                      size={16}
                      className={`text-on-surface-variant flex-shrink-0 transition-transform ${profileOpen ? 'rotate-180' : ''}`}
                    />
                  </button>

                  {profileOpen && (
                    <div
                      className="absolute right-0 top-full mt-2 w-60 bg-white border border-outline-variant/40 rounded-xl shadow-lg py-2 z-50"
                      role="menu"
                    >
                      <div className="px-4 py-2 border-b border-outline-variant/30 mb-1">
                        <p className="text-sm font-semibold text-on-surface truncate">{displayName}</p>
                        {user.email && (
                          <p className="text-xs text-on-surface-variant truncate">{user.email}</p>
                        )}
                      </div>

                      <Link
                        to="/orders"
                        role="menuitem"
                        className="flex items-center gap-2 px-4 py-2.5 text-sm text-on-surface hover:bg-surface-container-low transition-colors"
                        onClick={() => setProfileOpen(false)}
                      >
                        <Package size={16} className="text-primary flex-shrink-0" />
                        Đơn của tôi
                      </Link>

                      {management && (
                        <Link
                          to={management.to}
                          role="menuitem"
                          className="flex items-center gap-2 px-4 py-2.5 text-sm text-on-surface hover:bg-surface-container-low transition-colors"
                          onClick={() => setProfileOpen(false)}
                          title={management.roleLabel}
                        >
                          <LayoutDashboard size={16} className="text-primary flex-shrink-0" />
                          <span className="min-w-0">
                            <span className="block">{management.label}</span>
                            <span className="block text-[11px] text-on-surface-variant truncate">
                              {management.roleLabel}
                            </span>
                          </span>
                        </Link>
                      )}

                      <button
                        type="button"
                        role="menuitem"
                        className="flex items-center gap-2 w-full text-left px-4 py-2.5 text-sm text-error hover:bg-error-container/20 transition-colors mt-1 border-t border-outline-variant/30"
                        onClick={() => {
                          setProfileOpen(false);
                          logout();
                          navigate('/');
                        }}
                      >
                        <LogOut size={16} className="flex-shrink-0" />
                        Đăng xuất
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <Link
                  to="/login"
                  className="px-4 py-2 bg-primary text-white rounded-full font-label-bold text-xs hover:bg-primary-container shadow-premium hover:shadow-premium-hover transition-all duration-300 flex-shrink-0"
                >
                  Đăng nhập
                </Link>
              )}
            </div>

            {/* Mobile / Tablet Menu Icon */}
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 hover:bg-surface-container-low rounded-full transition-all text-on-surface-variant flex items-center justify-center"
              aria-label="Menu"
            >
              <span className="material-symbols-outlined">menu</span>
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Menu Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-[100] lg:hidden">
          {/* Backdrop */}
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} />
          {/* Drawer Content */}
          <div className="fixed top-0 right-0 bottom-0 w-72 bg-white shadow-2xl p-6 flex flex-col justify-between transform transition-transform duration-300 ease-out z-50">
            <div>
              {/* Header */}
              <div className="flex justify-between items-center pb-4 border-b border-outline-variant">
                <Link className="flex items-center gap-2" to="/" onClick={() => setMobileMenuOpen(false)}>
                  <span className="material-symbols-outlined text-primary text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>eco</span>
                  <span className="font-bold text-lg text-on-surface">Nông Sản Xanh</span>
                </Link>
                <button className="p-2 hover:bg-surface-container-low rounded-full" onClick={() => setMobileMenuOpen(false)}>
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>

              {/* Navigation Links — storefront only */}
              <nav className="flex flex-col gap-2 mt-6">
                <NavLink
                  className={({ isActive }) =>
                    `font-semibold py-2 px-3 rounded-lg text-sm transition-all ${isActive ? 'bg-primary/10 text-primary' : 'text-on-surface-variant hover:bg-surface-container-low hover:text-primary'}`
                  }
                  to="/"
                  end
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Trang chủ
                </NavLink>
                <NavLink
                  className={({ isActive }) =>
                    `font-semibold py-2 px-3 rounded-lg text-sm transition-all ${isActive ? 'bg-primary/10 text-primary' : 'text-on-surface-variant hover:bg-surface-container-low hover:text-primary'}`
                  }
                  to="/products"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Sản phẩm
                </NavLink>
              </nav>
            </div>

            {/* Account Info/Login in Drawer */}
            <div className="pt-4 border-t border-outline-variant mt-auto">
              {user ? (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-3 px-3 mb-1">
                    <div className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center font-bold text-sm">
                      {initials}
                    </div>
                    <div className="truncate min-w-0">
                      <p className="font-semibold text-sm text-on-surface truncate">{displayName}</p>
                      {user.email && (
                        <p className="text-xs text-on-surface-variant truncate">{user.email}</p>
                      )}
                    </div>
                  </div>
                  <Link
                    to="/orders"
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-on-surface hover:bg-surface-container-low"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <Package size={16} className="text-primary" />
                    Đơn của tôi
                  </Link>
                  {management && (
                    <Link
                      to={management.to}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-on-surface hover:bg-surface-container-low"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <LayoutDashboard size={16} className="text-primary" />
                      <span className="min-w-0">
                        <span className="block">{management.label}</span>
                        <span className="block text-[11px] text-on-surface-variant">{management.roleLabel}</span>
                      </span>
                    </Link>
                  )}
                  <button
                    onClick={() => {
                      logout();
                      navigate('/');
                      setMobileMenuOpen(false);
                    }}
                    className="w-full py-2 bg-error-container text-error rounded-xl font-bold text-sm hover:bg-error/15 transition-all mt-2 flex items-center justify-center gap-2"
                  >
                    <LogOut size={16} />
                    Đăng xuất
                  </button>
                </div>
              ) : (
                <Link 
                  to="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full block py-2 bg-primary text-white rounded-xl font-bold text-center text-sm hover:bg-primary/90 transition-all"
                >
                  Đăng nhập
                </Link>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-grow">
        <PageTransition />
      </main>

      {/* Footer */}
      <footer className="bg-surface-container-low w-full pt-20 pb-10 border-t border-outline-variant/50">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 max-w-container-max mx-auto px-6 md:px-10">
          {/* Footer Column 1: Brand */}
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-primary text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>eco</span>
              <h5 className="font-display-lg text-xl font-bold text-on-surface">Nông Sản Xanh</h5>
            </div>
            <p className="text-on-surface-variant font-body-md text-sm leading-relaxed">
              Hệ thống cung cấp nông sản sạch, tươi ngon từ các nông trại uy tín đến tận bàn ăn gia đình bạn.
            </p>
            <div className="flex gap-4">
              <a className="w-10 h-10 rounded-full bg-white border border-outline-variant flex items-center justify-center text-primary hover:bg-primary hover:text-white hover:border-primary shadow-sm transition-all duration-300" href="#">
                <span className="material-symbols-outlined text-[20px]">face_nod</span>
              </a>
              <a className="w-10 h-10 rounded-full bg-white border border-outline-variant flex items-center justify-center text-primary hover:bg-primary hover:text-white hover:border-primary shadow-sm transition-all duration-300" href="#">
                <span className="material-symbols-outlined text-[20px]">public</span>
              </a>
            </div>
          </div>
          {/* Column 2: Links */}
          <div className="space-y-6">
            <h6 className="font-label-bold text-on-surface uppercase tracking-wider text-sm">Về chúng tôi</h6>
            <ul className="space-y-4">
              <li><a className="text-on-surface-variant text-sm hover:text-primary transition-colors" href="#">Câu chuyện thương hiệu</a></li>
              <li><a className="text-on-surface-variant text-sm hover:text-primary transition-colors" href="#">Nguồn gốc sản phẩm</a></li>
              <li><a className="text-on-surface-variant text-sm hover:text-primary transition-colors" href="#">Tuyển dụng</a></li>
            </ul>
          </div>
          {/* Column 3: Policy */}
          <div className="space-y-6">
            <h6 className="font-label-bold text-on-surface uppercase tracking-wider text-sm">Hỗ trợ khách hàng</h6>
            <ul className="space-y-4">
              <li><a className="text-on-surface-variant text-sm hover:text-primary transition-colors" href="#">Chính sách giao hàng</a></li>
              <li><a className="text-on-surface-variant text-sm hover:text-primary transition-colors" href="#">Điều khoản dịch vụ</a></li>
              <li><a className="text-on-surface-variant text-sm hover:text-primary transition-colors" href="#">Chính sách bảo mật</a></li>
            </ul>
          </div>
          {/* Column 4: Contact */}
          <div className="space-y-6">
            <h6 className="font-label-bold text-on-surface uppercase tracking-wider text-sm">Liên hệ</h6>
            <div className="flex items-start gap-4 text-on-surface-variant">
              <span className="material-symbols-outlined text-primary text-[20px]">location_on</span>
              <p className="text-sm">123 Đường Nông Nghiệp, Quận 1, TP. Hồ Chí Minh</p>
            </div>
            <div className="flex items-start gap-4 text-on-surface-variant">
              <span className="material-symbols-outlined text-primary text-[20px]">call</span>
              <p className="text-sm">1900 1234 <span className="block text-xs text-outline mt-1">(08:00 - 21:00)</span></p>
            </div>
            <div className="flex items-start gap-4 text-on-surface-variant">
              <span className="material-symbols-outlined text-primary text-[20px]">mail</span>
              <p className="text-sm">support@nongsanxanh.com</p>
            </div>
          </div>
        </div>
        <div className="max-w-container-max mx-auto px-6 md:px-10 mt-16 pt-8 border-t border-outline-variant/50 text-center text-sm text-on-surface-variant font-medium">
          <p>© 2026 Nông Sản Xanh - Tươi ngon mỗi ngày từ nông trại đến bàn ăn</p>
        </div>
      </footer>

      <ChatWidget />
    </div>
  );
}
