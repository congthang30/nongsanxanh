/**
 * Cau hinh sidebar menu theo role cho mo hinh chuoi cua hang.
 * Render bang DashboardSidebar dua tren role hien tai.
 */

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
    items: [
      { to: '/admin/dashboard', label: 'Tổng quan', icon: '', exact: true },
    ],
  },
  {
    title: 'Chuỗi cửa hàng',
    items: [
      { to: '/admin/stores', label: 'Cửa hàng', icon: '' },
      { to: '/admin/orders', label: 'Đơn hàng', icon: '' },
      { to: '/admin/returns', label: 'Trả hàng', icon: '' },
      { to: '/admin/products', label: 'Sản phẩm', icon: '' },
      { to: '/admin/inventory', label: 'Tồn kho', icon: '' },
    ],
  },
  {
    title: 'Vận hành',
    items: [
      { to: '/admin/users', label: 'Người dùng & vai trò', icon: '' },
      { to: '/admin/reports', label: 'Báo cáo', icon: '' },
      { to: '/admin/audit', label: 'Nhật ký hệ thống', icon: '' },
    ],
  },
];

const STORE_MANAGER_GROUPS: MenuGroup[] = [
  {
    items: [
      { to: '/store-manager/dashboard', label: 'Tổng quan', icon: '', exact: true },
    ],
  },
  {
    title: 'Cửa hàng của tôi',
    items: [
      { to: '/store-manager/orders', label: 'Đơn hàng', icon: '' },
      { to: '/store-manager/inventory', label: 'Tồn kho', icon: '' },
      { to: '/store-manager/staff', label: 'Nhân viên', icon: '' },
      { to: '/store-manager/reports', label: 'Báo cáo', icon: '' },
    ],
  },
  {
    title: 'Bán hàng tại quầy',
    items: [
      { to: '/pos', label: 'Màn hình thu ngân', icon: '' },
      { to: '/pos/returns', label: 'Trả hàng / Hoàn tiền', icon: '' },
      { to: '/store-manager/pos-reports', label: 'Báo cáo POS', icon: '' },
    ],
  },
];

const STORE_STAFF_GROUPS: MenuGroup[] = [
  {
    items: [
      { to: '/store/orders', label: 'Đơn hàng cửa hàng', icon: '', exact: true },
    ],
  },
  {
    title: 'Bán hàng tại quầy',
    items: [
      { to: '/pos', label: 'Màn hình thu ngân (POS)', icon: '' },
    ],
  },
];

const WAREHOUSE_GROUPS: MenuGroup[] = [
  {
    items: [
      { to: '/warehouse/dashboard', label: 'Tổng quan', icon: '', exact: true },
    ],
  },
  {
    title: 'Kho cửa hàng',
    items: [
      { to: '/warehouse/pick', label: 'Soạn hàng', icon: '' },
      { to: '/warehouse/inventory', label: 'Tồn kho', icon: '' },
      { to: '/warehouse/transactions', label: 'Lịch sử nhập/xuất', icon: '' },
    ],
  },
];

const SUPPORT_GROUPS: MenuGroup[] = [
  {
    items: [
      { to: '/staff/dashboard', label: 'Tổng quan', icon: '', exact: true },
    ],
  },
  {
    title: 'Chăm sóc khách hàng',
    items: [
      { to: '/staff/tickets', label: 'Yêu cầu hỗ trợ', icon: '' },
    ],
  },
];

const SHIPPER_GROUPS: MenuGroup[] = [
  {
    items: [
      { to: '/shipper/dashboard', label: 'Tổng quan', icon: '', exact: true },
    ],
  },
  {
    title: 'Giao hàng',
    items: [
      { to: '/shipper/active', label: 'Đang giao', icon: '' },
      { to: '/shipper/history', label: 'Lịch sử', icon: '' },
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
    label: 'Shipper',
    homePath: '/shipper/dashboard',
    badgeColor: '#9333ea',
    groups: SHIPPER_GROUPS,
  },
};

/** Pick role config theo thu tu uu tien tu user.roles. */
export function pickRoleConfig(roles: string[]): RoleConfig | null {
  const order: RoleCode[] = [
    'SUPER_ADMIN',
    'ADMIN',
    'STORE_MANAGER',
    'WAREHOUSE_STAFF',
    'STORE_STAFF',
    'SUPPORT',
    'SHIPPER',
  ];
  for (const r of order) {
    if (roles.includes(r)) return ROLE_CONFIGS[r];
  }
  return null;
}
