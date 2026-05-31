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
      { to: '/admin/dashboard', label: 'Tong quan', icon: '', exact: true },
    ],
  },
  {
    title: 'Chuoi cua hang',
    items: [
      { to: '/admin/stores', label: 'Cua hang', icon: '' },
      { to: '/admin/orders', label: 'Don hang', icon: '' },
      { to: '/admin/products', label: 'San pham', icon: '' },
      { to: '/admin/inventory', label: 'Ton kho', icon: '' },
    ],
  },
  {
    title: 'Van hanh',
    items: [
      { to: '/admin/users', label: 'Nguoi dung & vai tro', icon: '' },
      { to: '/admin/reports', label: 'Bao cao', icon: '' },
      { to: '/admin/audit', label: 'Nhat ky he thong', icon: '' },
    ],
  },
];

const STORE_MANAGER_GROUPS: MenuGroup[] = [
  {
    items: [
      { to: '/store-manager/dashboard', label: 'Tong quan', icon: '', exact: true },
    ],
  },
  {
    title: 'Cua hang cua toi',
    items: [
      { to: '/store-manager/orders', label: 'Don hang', icon: '' },
      { to: '/store-manager/inventory', label: 'Ton kho', icon: '' },
      { to: '/store-manager/staff', label: 'Nhan vien', icon: '' },
      { to: '/store-manager/reports', label: 'Bao cao', icon: '' },
    ],
  },
  {
    title: 'Ban hang tai quay (POS)',
    items: [
      { to: '/pos', label: 'Man hinh thu ngan', icon: '' },
      { to: '/pos/returns', label: 'Tra hang / Hoan tien', icon: '' },
      { to: '/store-manager/pos-reports', label: 'Bao cao POS', icon: '' },
    ],
  },
];

const STORE_STAFF_GROUPS: MenuGroup[] = [
  {
    items: [
      { to: '/store/orders', label: 'Don hang cua hang', icon: '', exact: true },
    ],
  },
  {
    title: 'Ban hang tai quay',
    items: [
      { to: '/pos', label: 'Man hinh thu ngan (POS)', icon: '' },
    ],
  },
];

const WAREHOUSE_GROUPS: MenuGroup[] = [
  {
    items: [
      { to: '/warehouse/dashboard', label: 'Tong quan', icon: '', exact: true },
    ],
  },
  {
    title: 'Kho cua hang',
    items: [
      { to: '/warehouse/pick', label: 'Soan hang', icon: '' },
      { to: '/warehouse/inventory', label: 'Ton kho', icon: '' },
      { to: '/warehouse/transactions', label: 'Lich su nhap/xuat', icon: '' },
    ],
  },
];

const SUPPORT_GROUPS: MenuGroup[] = [
  {
    items: [
      { to: '/staff/dashboard', label: 'Tong quan', icon: '', exact: true },
    ],
  },
  {
    title: 'Cham soc khach hang',
    items: [
      { to: '/staff/tickets', label: 'Tickets', icon: '' },
    ],
  },
];

const SHIPPER_GROUPS: MenuGroup[] = [
  {
    items: [
      { to: '/shipper/dashboard', label: 'Tong quan', icon: '', exact: true },
    ],
  },
  {
    title: 'Giao hang',
    items: [
      { to: '/shipper/active', label: 'Dang giao', icon: '' },
      { to: '/shipper/history', label: 'Lich su', icon: '' },
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
    label: 'Quan ly cua hang',
    homePath: '/store-manager/dashboard',
    badgeColor: '#16a34a',
    groups: STORE_MANAGER_GROUPS,
  },
  STORE_STAFF: {
    code: 'STORE_STAFF',
    label: 'Nhan vien ban hang',
    homePath: '/store/orders',
    badgeColor: '#0d9488',
    groups: STORE_STAFF_GROUPS,
  },
  WAREHOUSE_STAFF: {
    code: 'WAREHOUSE_STAFF',
    label: 'Nhan vien kho',
    homePath: '/warehouse/dashboard',
    badgeColor: '#ca8a04',
    groups: WAREHOUSE_GROUPS,
  },
  SUPPORT: {
    code: 'SUPPORT',
    label: 'Support',
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
