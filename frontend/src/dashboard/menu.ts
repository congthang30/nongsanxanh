export type RoleCode =
  | 'ADMIN'
  | 'SUPER_ADMIN'
  | 'STORE_MANAGER'
  | 'STORE_STAFF'
  | 'WAREHOUSE_STAFF'
  | 'SUPPORT'
  | 'SHIPPER';

export interface MenuItem {
  to: string;
  label: string;
  icon: string;
  exact?: boolean;
  roles?: RoleCode[];
}

export interface MenuGroup {
  title?: string;
  items: MenuItem[];
}

export interface RoleConfig {
  code: RoleCode;
  label: string;
  homePath: string;
  badgeColor: string;
  groups: MenuGroup[];
}

const ADMIN_GROUPS: MenuGroup[] = [
  {
    items: [{ to: '/admin/dashboard', label: 'Tổng quan', icon: 'LayoutDashboard', exact: true }],
  },
  {
    title: 'Chuỗi cửa hàng',
    items: [
      { to: '/admin/stores', label: 'Cửa hàng', icon: 'Store' },
      { to: '/admin/orders', label: 'Đơn hàng', icon: 'ShoppingCart' },
      { to: '/admin/returns', label: 'Trả hàng', icon: 'Undo2' },
      { to: '/admin/products', label: 'Sản phẩm', icon: 'Sprout' },
      { to: '/admin/inventory', label: 'Tồn kho', icon: 'Package' },
    ],
  },
  {
    title: 'Quản trị',
    items: [
      { to: '/admin/users', label: 'Tài khoản và nhân viên', icon: 'Users' },
      { to: '/admin/reports', label: 'Báo cáo', icon: 'BarChart3' },
      { to: '/admin/audit', label: 'Nhật ký hệ thống', icon: 'Terminal' },
    ],
  },
];

const STORE_MANAGER_GROUPS: MenuGroup[] = [
  {
    items: [
      { to: '/store-manager/dashboard', label: 'Tổng quan', icon: 'LayoutDashboard', exact: true },
    ],
  },
  {
    title: 'Chi nhánh',
    items: [
      { to: '/store-manager/orders', label: 'Đơn hàng', icon: 'ShoppingCart' },
      { to: '/store-manager/inventory', label: 'Tồn kho', icon: 'Package' },
      { to: '/store-manager/staff', label: 'Nhân viên', icon: 'Users' },
      { to: '/store-manager/reports', label: 'Báo cáo', icon: 'BarChart3' },
    ],
  },
  {
    title: 'Bán hàng tại quầy',
    items: [
      { to: '/pos', label: 'Màn hình thu ngân', icon: 'Calculator' },
      { to: '/pos/returns', label: 'Trả hàng và hoàn tiền', icon: 'Undo2' },
      { to: '/store-manager/pos-reports', label: 'Báo cáo POS', icon: 'BarChart3' },
    ],
  },
];

const STORE_STAFF_GROUPS: MenuGroup[] = [
  {
    items: [
      { to: '/store/orders', label: 'Đơn hàng cửa hàng', icon: 'ShoppingCart', exact: true },
    ],
  },
  {
    title: 'Bán hàng tại quầy',
    items: [{ to: '/pos', label: 'Màn hình thu ngân', icon: 'Calculator' }],
  },
];

const WAREHOUSE_GROUPS: MenuGroup[] = [
  {
    items: [
      { to: '/warehouse/dashboard', label: 'Tổng quan', icon: 'LayoutDashboard', exact: true },
    ],
  },
  {
    title: 'Kho chi nhánh',
    items: [
      { to: '/warehouse/pick', label: 'Soạn hàng', icon: 'ClipboardCheck' },
      { to: '/warehouse/inventory', label: 'Tồn kho', icon: 'Package' },
      { to: '/warehouse/transactions', label: 'Lịch sử nhập xuất', icon: 'History' },
    ],
  },
];

const SUPPORT_GROUPS: MenuGroup[] = [
  {
    items: [{ to: '/staff/dashboard', label: 'Tổng quan', icon: 'LayoutDashboard', exact: true }],
  },
  {
    title: 'Chăm sóc khách hàng',
    items: [{ to: '/staff/tickets', label: 'Yêu cầu hỗ trợ', icon: 'LifeBuoy' }],
  },
];

const SHIPPER_GROUPS: MenuGroup[] = [
  {
    items: [
      { to: '/shipper/dashboard', label: 'Tổng quan', icon: 'LayoutDashboard', exact: true },
    ],
  },
  {
    title: 'Giao hàng',
    items: [
      { to: '/shipper/active', label: 'Đang giao', icon: 'Truck' },
      { to: '/shipper/history', label: 'Lịch sử', icon: 'History' },
    ],
  },
];

export const ROLE_CONFIGS: Record<RoleCode, RoleConfig> = {
  ADMIN: {
    code: 'ADMIN',
    label: 'Admin',
    homePath: '/admin/dashboard',
    badgeColor: '#dc2626',
    groups: ADMIN_GROUPS,
  },
  SUPER_ADMIN: {
    code: 'SUPER_ADMIN',
    label: 'Super Admin',
    homePath: '/admin/dashboard',
    badgeColor: '#dc2626',
    groups: ADMIN_GROUPS,
  },
  STORE_MANAGER: {
    code: 'STORE_MANAGER',
    label: 'Quản lý cửa hàng',
    homePath: '/store-manager/dashboard',
    badgeColor: '#16a34a',
    groups: STORE_MANAGER_GROUPS,
  },
  STORE_STAFF: {
    code: 'STORE_STAFF',
    label: 'Nhân viên bán hàng',
    homePath: '/store/orders',
    badgeColor: '#0d9488',
    groups: STORE_STAFF_GROUPS,
  },
  WAREHOUSE_STAFF: {
    code: 'WAREHOUSE_STAFF',
    label: 'Nhân viên kho',
    homePath: '/warehouse/dashboard',
    badgeColor: '#ca8a04',
    groups: WAREHOUSE_GROUPS,
  },
  SUPPORT: {
    code: 'SUPPORT',
    label: 'Hỗ trợ',
    homePath: '/staff/dashboard',
    badgeColor: '#0891b2',
    groups: SUPPORT_GROUPS,
  },
  SHIPPER: {
    code: 'SHIPPER',
    label: 'Nhân viên giao hàng',
    homePath: '/shipper/dashboard',
    badgeColor: '#9333ea',
    groups: SHIPPER_GROUPS,
  },
};

export function pickRoleConfig(roles: string[], pathname?: string): RoleConfig | null {
  const isAdmin = roles.includes('ADMIN') || roles.includes('SUPER_ADMIN');
  if (isAdmin && pathname) {
    if (pathname.startsWith('/store-manager')) return ROLE_CONFIGS.STORE_MANAGER;
    if (pathname.startsWith('/store/')) return ROLE_CONFIGS.STORE_STAFF;
    if (pathname.startsWith('/warehouse')) return ROLE_CONFIGS.WAREHOUSE_STAFF;
    if (pathname.startsWith('/shipper')) return ROLE_CONFIGS.SHIPPER;
    if (pathname.startsWith('/staff')) return ROLE_CONFIGS.SUPPORT;
  }

  const priority: RoleCode[] = [
    'SUPER_ADMIN',
    'ADMIN',
    'STORE_MANAGER',
    'WAREHOUSE_STAFF',
    'STORE_STAFF',
    'SUPPORT',
    'SHIPPER',
  ];
  for (const role of priority) {
    if (roles.includes(role)) return ROLE_CONFIGS[role];
  }
  return null;
}