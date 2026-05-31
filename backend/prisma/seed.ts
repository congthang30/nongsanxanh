/* eslint-disable no-console */
import { PrismaClient, ProductStatus } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

// ---------------- ROLES & PERMISSIONS ----------------
const ROLES = [
  { code: 'SUPER_ADMIN', name: 'Super Admin' },
  { code: 'ADMIN', name: 'Quan tri he thong' },
  { code: 'STORE_MANAGER', name: 'Quan ly cua hang' },
  { code: 'STORE_STAFF', name: 'Nhan vien ban hang' },
  { code: 'WAREHOUSE_STAFF', name: 'Nhan vien kho' },
  { code: 'SHIPPER', name: 'Shipper' },
  { code: 'SUPPORT', name: 'Cham soc khach hang' },
  { code: 'CUSTOMER', name: 'Khach hang' },
];

const PERMISSIONS = [
  { code: 'orders.read.all', resource: 'orders', action: 'read' },
  { code: 'orders.update.all', resource: 'orders', action: 'update' },
  { code: 'products.manage', resource: 'products', action: 'manage' },
  { code: 'users.manage', resource: 'users', action: 'manage' },
  { code: 'stores.manage', resource: 'stores', action: 'manage' },
  { code: 'inventory.manage', resource: 'inventory', action: 'manage' },
];

const CATEGORIES = [
  { name: 'Rau cu', slug: 'rau-cu' },
  { name: 'Trai cay', slug: 'trai-cay' },
  { name: 'Gao & Hat', slug: 'gao-hat' },
  { name: 'Thit & Trung', slug: 'thit-trung' },
];

// ---------------- STORES ----------------
interface SeedStore {
  code: string;
  name: string;
  slug: string;
  province: string;
  district: string;
  ward: string;
  addressLine: string;
  formattedAddress: string;
  lat: number;
  lng: number;
  serviceRadiusKm: number;
  phone: string;
  // Nhan su
  managerEmail: string;
  staffEmails: string[];
  warehouseEmails: string[];
  shipperEmail: string;
  // Khu vuc phuc vu (province/district)
  serviceAreas: { province: string; district?: string }[];
}

const STORES: SeedStore[] = [
  {
    code: 'BHX-Q1',
    name: 'NongSan Xanh - Quan 1',
    slug: 'nsx-quan-1',
    province: 'TP.HCM',
    district: 'Quan 1',
    ward: 'Ben Nghe',
    addressLine: '10 Le Duan',
    formattedAddress: '10 Le Duan, Ben Nghe, Quan 1, TP.HCM',
    lat: 10.7821,
    lng: 106.6998,
    serviceRadiusKm: 8,
    phone: '02838111111',
    managerEmail: 'manager.q1@nsx.local',
    staffEmails: ['staff.q1.a@nsx.local', 'staff.q1.b@nsx.local'],
    warehouseEmails: ['kho.q1.a@nsx.local', 'kho.q1.b@nsx.local'],
    shipperEmail: 'shipper.q1@nsx.local',
    serviceAreas: [
      { province: 'TP.HCM', district: 'Quan 1' },
      { province: 'TP.HCM', district: 'Quan 3' },
      { province: 'TP.HCM', district: 'Binh Thanh' },
    ],
  },
  {
    code: 'BHX-Q7',
    name: 'NongSan Xanh - Quan 7',
    slug: 'nsx-quan-7',
    province: 'TP.HCM',
    district: 'Quan 7',
    ward: 'Tan Phong',
    addressLine: '01 Nguyen Van Linh',
    formattedAddress: '01 Nguyen Van Linh, Tan Phong, Quan 7, TP.HCM',
    lat: 10.7295,
    lng: 106.7215,
    serviceRadiusKm: 8,
    phone: '02838222222',
    managerEmail: 'manager.q7@nsx.local',
    staffEmails: ['staff.q7.a@nsx.local'],
    warehouseEmails: ['kho.q7.a@nsx.local'],
    shipperEmail: 'shipper.q7@nsx.local',
    serviceAreas: [
      { province: 'TP.HCM', district: 'Quan 7' },
      { province: 'TP.HCM', district: 'Quan 4' },
      { province: 'TP.HCM', district: 'Nha Be' },
    ],
  },
  {
    code: 'BHX-TD',
    name: 'NongSan Xanh - Thu Duc',
    slug: 'nsx-thu-duc',
    province: 'TP.HCM',
    district: 'Thu Duc',
    ward: 'Linh Trung',
    addressLine: '01 Vo Van Ngan',
    formattedAddress: '01 Vo Van Ngan, Linh Trung, Thu Duc, TP.HCM',
    lat: 10.8499,
    lng: 106.7716,
    serviceRadiusKm: 10,
    phone: '02838333333',
    managerEmail: 'manager.td@nsx.local',
    staffEmails: ['staff.td.a@nsx.local'],
    warehouseEmails: ['kho.td.a@nsx.local'],
    shipperEmail: 'shipper.td@nsx.local',
    serviceAreas: [{ province: 'TP.HCM', district: 'Thu Duc' }],
  },
];

// ---------------- PRODUCTS (global catalog) ----------------
interface SeedProduct {
  name: string;
  slug: string;
  category: string;
  origin: string;
  description: string;
  image: string;
  price: number;
  unit: string;
  barcode: string;
  saleMode?: 'UNIT' | 'WEIGHT';
  allowDecimalQuantity?: boolean;
}

const PRODUCTS: SeedProduct[] = [
  {
    name: 'Ca chua bi huu co',
    slug: 'ca-chua-bi-huu-co',
    category: 'rau-cu',
    origin: 'Da Lat, Lam Dong',
    description: 'Ca chua bi trong huu co, vo mong, vi ngot, giau vitamin.',
    image: 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=800',
    price: 45000,
    unit: 'kg',
    barcode: '8930000000017',
    saleMode: 'WEIGHT',
    allowDecimalQuantity: true,
  },
  {
    name: 'Rau cai ngot sach',
    slug: 'rau-cai-ngot-sach',
    category: 'rau-cu',
    origin: 'Lam Dong',
    description: 'Rau cai ngot trong theo tieu chuan an toan, giao trong ngay.',
    image: 'https://images.unsplash.com/photo-1576045057995-568f588f82fb?w=800',
    price: 18000,
    unit: 'bo',
    barcode: '8930000000024',
    saleMode: 'UNIT',
  },
  {
    name: 'Xoai cat Hoa Loc',
    slug: 'xoai-cat-hoa-loc',
    category: 'trai-cay',
    origin: 'Tien Giang',
    description: 'Xoai cat Hoa Loc chin cay, ngot thanh, thom dac trung.',
    image: 'https://images.unsplash.com/photo-1605027990121-cbae9e0642df?w=800',
    price: 85000,
    unit: 'kg',
    barcode: '8930000000031',
    saleMode: 'WEIGHT',
    allowDecimalQuantity: true,
  },
  {
    name: 'Bo sap Dak Lak',
    slug: 'bo-sap-dak-lak',
    category: 'trai-cay',
    origin: 'Dak Lak',
    description: 'Bo sap deo, beo, com day, hat nho.',
    image: 'https://images.unsplash.com/photo-1601039641847-7857b994d704?w=800',
    price: 65000,
    unit: 'kg',
    barcode: '8930000000048',
    saleMode: 'WEIGHT',
    allowDecimalQuantity: true,
  },
  {
    name: 'Gao ST25 thuong hang',
    slug: 'gao-st25-thuong-hang',
    category: 'gao-hat',
    origin: 'Soc Trang',
    description: 'Gao ST25 - gao ngon nhat the gioi, hat dai, deo thom tu nhien.',
    image: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=800',
    price: 38000,
    unit: 'tui 5kg',
    barcode: '8930000000055',
    saleMode: 'UNIT',
  },
  {
    name: 'Trung ga ta',
    slug: 'trung-ga-ta',
    category: 'thit-trung',
    origin: 'Dong Nai',
    description: 'Trung ga ta nuoi tha vuon, long do dam, thom beo.',
    image: 'https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?w=800',
    price: 35000,
    unit: 'hop 10',
    barcode: '8930000000062',
    saleMode: 'UNIT',
  },
  {
    name: 'Nuoc mam Phu Quoc 500ml',
    slug: 'nuoc-mam-phu-quoc-500ml',
    category: 'gao-hat',
    origin: 'Phu Quoc, Kien Giang',
    description: 'Nuoc mam nhi truyen thong 40 do dam, chai thuy tinh 500ml.',
    image: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=800',
    price: 52000,
    unit: 'chai',
    barcode: '8930000000079',
    saleMode: 'UNIT',
  },
];

// Customers o cac khu vuc khac nhau de test resolver
const CUSTOMERS = [
  {
    email: 'customer@nsx.local',
    fullName: 'Tran Thi Khach (Q1)',
    address: {
      recipientName: 'Tran Thi Khach',
      phone: '0901234567',
      province: 'TP.HCM',
      district: 'Quan 1',
      ward: 'Ben Nghe',
      line1: '1 Le Duan',
      formattedAddress: '1 Le Duan, Ben Nghe, Quan 1, TP.HCM',
      lat: 10.7805,
      lng: 106.6995,
    },
  },
  {
    email: 'customer.q7@nsx.local',
    fullName: 'Nguyen Van Q7',
    address: {
      recipientName: 'Nguyen Van Q7',
      phone: '0902222222',
      province: 'TP.HCM',
      district: 'Quan 7',
      ward: 'Tan Phong',
      line1: '10 Nguyen Van Linh',
      formattedAddress: '10 Nguyen Van Linh, Tan Phong, Quan 7, TP.HCM',
      lat: 10.7298,
      lng: 106.722,
    },
  },
];

async function main() {
  console.log('Seeding roles & permissions...');
  for (const r of ROLES) {
    await prisma.role.upsert({
      where: { code: r.code },
      create: r,
      update: { name: r.name },
    });
  }
  for (const p of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { code: p.code },
      create: p,
      update: {},
    });
  }
  const allPerms = await prisma.permission.findMany();
  for (const code of ['ADMIN', 'SUPER_ADMIN']) {
    const role = await prisma.role.findUnique({ where: { code } });
    if (role) {
      for (const perm of allPerms) {
        await prisma.rolePermission.upsert({
          where: {
            roleId_permissionId: { roleId: role.id, permissionId: perm.id },
          },
          create: { roleId: role.id, permissionId: perm.id },
          update: {},
        });
      }
    }
  }

  const passwordHash = await argon2.hash('Password123!');
  const roleMap = new Map(
    (await prisma.role.findMany()).map((r) => [r.code, r.id]),
  );

  async function ensureUser(email: string, fullName: string, roleCode: string) {
    let user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          passwordHash,
          emailVerifiedAt: new Date(),
          profile: { create: { fullName } },
        },
      });
    }
    const roleId = roleMap.get(roleCode);
    if (roleId) {
      await prisma.userRole.upsert({
        where: { userId_roleId: { userId: user.id, roleId } },
        create: { userId: user.id, roleId },
        update: {},
      });
    }
    return user;
  }

  console.log('Seeding admin/support...');
  await ensureUser('admin@nsx.local', 'Quan Tri Vien', 'ADMIN');
  await ensureUser('support@nsx.local', 'Nhan Vien Ho Tro', 'SUPPORT');

  console.log('Seeding categories...');
  const catMap = new Map<string, string>();
  for (const c of CATEGORIES) {
    const cat = await prisma.category.upsert({
      where: { slug: c.slug },
      create: c,
      update: {},
    });
    catMap.set(c.slug, cat.id);
  }

  console.log('Seeding products (global catalog)...');
  const productVariantMap = new Map<string, string>(); // product slug -> variantId
  for (const p of PRODUCTS) {
    let product = await prisma.product.findUnique({
      where: { slug: p.slug },
      include: { variants: true },
    });
    if (!product) {
      product = await prisma.product.create({
        data: {
          categoryId: catMap.get(p.category)!,
          name: p.name,
          slug: p.slug,
          description: p.description,
          status: ProductStatus.ACTIVE,
          originRegion: p.origin,
          images: { create: { url: p.image, isPrimary: true, sortOrder: 0 } },
          variants: {
            create: {
              sku: `${p.slug}-default`.toUpperCase(),
              unit: p.unit,
              unitValue: 1,
              price: p.price,
              saleMode: p.saleMode ?? 'UNIT',
              allowDecimalQuantity: p.allowDecimalQuantity ?? false,
              status: 'ACTIVE',
            },
          },
        },
        include: { variants: true },
      });
    } else {
      // Dam bao saleMode/allowDecimalQuantity dung neu product da ton tai
      await prisma.productVariant.update({
        where: { id: product.variants[0].id },
        data: {
          saleMode: p.saleMode ?? 'UNIT',
          allowDecimalQuantity: p.allowDecimalQuantity ?? false,
        },
      });
    }
    const variantId = product.variants[0].id;
    productVariantMap.set(p.slug, variantId);

    // Barcode chinh cua variant (unique toan he thong)
    await prisma.productBarcode.upsert({
      where: { barcode: p.barcode },
      create: {
        variantId,
        barcode: p.barcode,
        type: 'EAN13',
        isPrimary: true,
        status: 'ACTIVE',
      },
      update: { variantId, isPrimary: true, status: 'ACTIVE' },
    });
  }

  console.log('Seeding stores + staff + inventory + service areas...');
  for (const s of STORES) {
    const manager = await ensureUser(
      s.managerEmail,
      `Quan ly ${s.name}`,
      'STORE_MANAGER',
    );
    const shipper = await ensureUser(
      s.shipperEmail,
      `Shipper ${s.name}`,
      'SHIPPER',
    );
    const staffUsers: { id: string }[] = [];
    for (let i = 0; i < s.staffEmails.length; i++) {
      staffUsers.push(
        await ensureUser(s.staffEmails[i], `NV ban hang ${i + 1} ${s.code}`, 'STORE_STAFF'),
      );
    }
    const warehouseUsers: { id: string }[] = [];
    for (let i = 0; i < s.warehouseEmails.length; i++) {
      warehouseUsers.push(
        await ensureUser(s.warehouseEmails[i], `NV kho ${i + 1} ${s.code}`, 'WAREHOUSE_STAFF'),
      );
    }

    let store = await prisma.store.findUnique({ where: { code: s.code } });
    if (!store) {
      store = await prisma.store.create({
        data: {
          code: s.code,
          name: s.name,
          slug: s.slug,
          status: 'ACTIVE',
          phone: s.phone,
          addressLine: s.addressLine,
          formattedAddress: s.formattedAddress,
          province: s.province,
          district: s.district,
          ward: s.ward,
          lat: s.lat,
          lng: s.lng,
          serviceRadiusKm: s.serviceRadiusKm,
          openTime: '06:00',
          closeTime: '22:00',
          managerId: manager.id,
          primaryShipperId: shipper.id,
        },
      });
    } else {
      await prisma.store.update({
        where: { id: store.id },
        data: { managerId: manager.id, primaryShipperId: shipper.id },
      });
    }

    // StoreStaff memberships
    const memberships: { userId: string; role: 'STORE_MANAGER' | 'STORE_STAFF' | 'WAREHOUSE_STAFF' | 'SHIPPER' }[] = [
      { userId: manager.id, role: 'STORE_MANAGER' },
      { userId: shipper.id, role: 'SHIPPER' },
      ...staffUsers.map((u) => ({ userId: u.id, role: 'STORE_STAFF' as const })),
      ...warehouseUsers.map((u) => ({ userId: u.id, role: 'WAREHOUSE_STAFF' as const })),
    ];
    for (const m of memberships) {
      await prisma.storeStaff.upsert({
        where: { storeId_userId: { storeId: store.id, userId: m.userId } },
        create: { storeId: store.id, userId: m.userId, role: m.role, status: 'ACTIVE' },
        update: { role: m.role, status: 'ACTIVE' },
      });
    }

    // Service areas
    await prisma.storeServiceArea.deleteMany({ where: { storeId: store.id } });
    for (const area of s.serviceAreas) {
      await prisma.storeServiceArea.create({
        data: {
          storeId: store.id,
          province: area.province,
          district: area.district,
          radiusKm: s.serviceRadiusKm,
          status: 'ACTIVE',
        },
      });
    }

    // Inventory: moi store co tat ca san pham (so luong khac nhau)
    for (const [slug, variantId] of productVariantMap.entries()) {
      const base = 50 + Math.floor(Math.random() * 150);
      await prisma.storeInventory.upsert({
        where: { storeId_variantId: { storeId: store.id, variantId } },
        create: {
          storeId: store.id,
          variantId,
          quantityOnHand: base,
          reservedQuantity: 0,
          lowStockThreshold: 10,
          status: 'ACTIVE',
        },
        update: { quantityOnHand: base },
      });
      // Log IMPORT transaction
      await prisma.inventoryTransaction.create({
        data: {
          storeId: store.id,
          variantId,
          type: 'IMPORT',
          quantity: base,
          beforeQty: 0,
          afterQty: base,
          reason: 'Nhap hang khoi tao (seed)',
        },
      });
    }
    console.log(`  Store ${s.code}: manager=${s.managerEmail}, shipper=${s.shipperEmail}, staff=${s.staffEmails.length}, kho=${s.warehouseEmails.length}`);
  }

  console.log('Seeding customers + addresses...');
  for (const c of CUSTOMERS) {
    const user = await ensureUser(c.email, c.fullName, 'CUSTOMER');
    const hasAddr = await prisma.address.findFirst({
      where: { userId: user.id },
    });
    if (!hasAddr) {
      await prisma.address.create({
        data: {
          userId: user.id,
          recipientName: c.address.recipientName,
          phone: c.address.phone,
          province: c.address.province,
          district: c.address.district,
          ward: c.address.ward,
          line1: c.address.line1,
          formattedAddress: c.address.formattedAddress,
          placeId: `seed:${user.id}`,
          lat: c.address.lat,
          lng: c.address.lng,
          geocodeProvider: 'seed',
          geocodeConfidence: 0.9,
          isDefault: true,
        },
      });
    }
  }

  console.log('Seeding coupons (platform + store)...');
  await prisma.coupon.upsert({
    where: { code: 'NSXMUAHE' },
    create: {
      code: 'NSXMUAHE',
      name: 'Mua he NongSan Xanh',
      scope: 'PLATFORM',
      type: 'PERCENT',
      value: 10,
      maxDiscount: 50000,
      minOrderValue: 100000,
      startsAt: new Date(),
      endsAt: new Date(Date.now() + 90 * 24 * 3600 * 1000),
      usageLimit: 1000,
      status: 'ACTIVE',
    },
    update: {},
  });
  const q1 = await prisma.store.findUnique({ where: { code: 'BHX-Q1' } });
  if (q1) {
    await prisma.coupon.upsert({
      where: { code: 'Q1GIAM10' },
      create: {
        code: 'Q1GIAM10',
        name: 'Giam 10k cua hang Quan 1',
        scope: 'STORE',
        storeId: q1.id,
        type: 'FIXED',
        value: 10000,
        minOrderValue: 80000,
        startsAt: new Date(),
        endsAt: new Date(Date.now() + 60 * 24 * 3600 * 1000),
        usageLimit: 200,
        status: 'ACTIVE',
      },
      update: {},
    });
  }

  console.log('Seeding AI knowledge...');
  const AI_DOCS = [
    {
      title: 'Mo hinh chuoi cua hang',
      content:
        'NongSan Xanh la chuoi cua hang nong san theo khu vuc (giong Bach Hoa Xanh). Khi khach dat hang, he thong tu dong chon cua hang gan nhat con hang va co shipper de giao. Moi cua hang co quan ly, nhan vien ban hang, nhan vien kho va shipper rieng.',
    },
    {
      title: 'Chinh sach giao hang',
      content:
        'Phi giao tinh tu cua hang phuc vu den dia chi khach. Don tu 300.000d va trong 10km duoc mien phi ship. Shipper chinh cua cua hang giao truc tiep.',
    },
    {
      title: 'Doi tra va hoan tien',
      content:
        'Khach co the yeu cau tra hang sau khi nhan. Cua hang/quan ly xu ly va hoan tien trong 3-5 ngay lam viec.',
    },
    {
      title: 'Phuong thuc thanh toan',
      content:
        'Ho tro COD (thanh toan khi nhan hang) va VNPay (thanh toan online).',
    },
  ];
  for (const doc of AI_DOCS) {
    const exists = await prisma.aiDocument.findFirst({
      where: { title: doc.title },
    });
    if (!exists) {
      await prisma.aiDocument.create({
        data: {
          title: doc.title,
          sourceType: 'POLICY',
          content: doc.content,
          chunks: { create: { chunkIndex: 0, content: doc.content } },
        },
      });
    }
  }

  console.log('\nSeed done. Tat ca mat khau: Password123!');
  console.log('  Admin:     admin@nsx.local');
  console.log('  Support:   support@nsx.local');
  console.log('  Customers: customer@nsx.local (Q1), customer.q7@nsx.local (Q7)');
  console.log('  Stores:');
  for (const s of STORES) {
    console.log(`    ${s.code}: manager=${s.managerEmail} | shipper=${s.shipperEmail}`);
    console.log(`        staff=${s.staffEmails.join(', ')}`);
    console.log(`        kho=${s.warehouseEmails.join(', ')}`);
  }
  console.log('  Coupons: NSXMUAHE (platform 10%), Q1GIAM10 (store Quan 1)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
