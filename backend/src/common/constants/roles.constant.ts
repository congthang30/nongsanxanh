export const ROLE = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  ADMIN: 'ADMIN',
  STORE_MANAGER: 'STORE_MANAGER',
  STORE_STAFF: 'STORE_STAFF',
  WAREHOUSE_STAFF: 'WAREHOUSE_STAFF',
  SHIPPER: 'SHIPPER',
  SUPPORT: 'SUPPORT',
  CUSTOMER: 'CUSTOMER',
} as const;

export type RoleCode = (typeof ROLE)[keyof typeof ROLE];

/** Roles co quyen toan he thong (xem moi store). */
export const SYSTEM_ADMIN_ROLES: string[] = [ROLE.ADMIN, ROLE.SUPER_ADMIN];
