/* eslint-disable no-console */
import { PrismaClient, ProductStatus } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

// ---------------- ROLES & PERMISSIONS ----------------
const ROLES = [
  { code: 'SUPER_ADMIN', name: 'Super Admin' },
  { code: 'ADMIN', name: 'Quản trị hệ thống' },
  { code: 'STORE_MANAGER', name: 'Quản lý cửa hàng' },
  { code: 'STORE_STAFF', name: 'Nhân viên bán hàng' },
  { code: 'WAREHOUSE_STAFF', name: 'Nhân viên kho' },
  { code: 'SHIPPER', name: 'Shipper' },
  { code: 'SUPPORT', name: 'Chăm sóc khách hàng' },
  { code: 'CUSTOMER', name: 'Khách hàng' },
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
  { name: 'Rau củ', slug: 'rau-cu' },
  { name: 'Trái cây', slug: 'trai-cay' },
  { name: 'Gạo & Hạt', slug: 'gao-hat' },
  { name: 'Thịt & Trứng', slug: 'thit-trung' },
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
  // Nhân sự
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
    name: 'Nông Sản Xanh - Quận 1',
    slug: 'nsx-quan-1',
    province: 'TP.HCM',
    district: 'Quận 1',
    ward: 'Bến Nghé',
    addressLine: '10 Lê Duẩn',
    formattedAddress: '10 Lê Duẩn, Bến Nghé, Quận 1, TP.HCM',
    lat: 10.7821,
    lng: 106.6998,
    serviceRadiusKm: 8,
    phone: '02838111111',
    managerEmail: 'manager.q1@nsx.local',
    staffEmails: ['staff.q1.a@nsx.local', 'staff.q1.b@nsx.local'],
    warehouseEmails: ['kho.q1.a@nsx.local', 'kho.q1.b@nsx.local'],
    shipperEmail: 'shipper.q1@nsx.local',
    serviceAreas: [
      { province: 'TP.HCM', district: 'Quận 1' },
      { province: 'TP.HCM', district: 'Quận 3' },
      { province: 'TP.HCM', district: 'Bình Thạnh' },
    ],
  },
  {
    code: 'BHX-Q7',
    name: 'Nông Sản Xanh - Quận 7',
    slug: 'nsx-quan-7',
    province: 'TP.HCM',
    district: 'Quận 7',
    ward: 'Tân Phong',
    addressLine: '01 Nguyễn Văn Linh',
    formattedAddress: '01 Nguyễn Văn Linh, Tân Phong, Quận 7, TP.HCM',
    lat: 10.7295,
    lng: 106.7215,
    serviceRadiusKm: 8,
    phone: '02838222222',
    managerEmail: 'manager.q7@nsx.local',
    staffEmails: ['staff.q7.a@nsx.local'],
    warehouseEmails: ['kho.q7.a@nsx.local'],
    shipperEmail: 'shipper.q7@nsx.local',
    serviceAreas: [
      { province: 'TP.HCM', district: 'Quận 7' },
      { province: 'TP.HCM', district: 'Quận 4' },
      { province: 'TP.HCM', district: 'Nhà Bè' },
    ],
  },
  {
    code: 'BHX-TD',
    name: 'Nông Sản Xanh - Thủ Đức',
    slug: 'nsx-thu-duc',
    province: 'TP.HCM',
    district: 'Thủ Đức',
    ward: 'Linh Trung',
    addressLine: '01 Võ Văn Ngân',
    formattedAddress: '01 Võ Văn Ngân, Linh Trung, Thủ Đức, TP.HCM',
    lat: 10.8499,
    lng: 106.7716,
    serviceRadiusKm: 10,
    phone: '02838333333',
    managerEmail: 'manager.td@nsx.local',
    staffEmails: ['staff.td.a@nsx.local'],
    warehouseEmails: ['kho.td.a@nsx.local'],
    shipperEmail: 'shipper.td@nsx.local',
    serviceAreas: [{ province: 'TP.HCM', district: 'Thủ Đức' }],
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
    name: 'Cà chua bi hữu cơ',
    slug: 'ca-chua-bi-huu-co',
    category: 'rau-cu',
    origin: 'Đà Lạt, Lâm Đồng',
    description: 'Cà chua bi trồng hữu cơ, vỏ mỏng, vị ngọt, giàu vitamin.',
    image: 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=800',
    price: 45000,
    unit: 'kg',
    barcode: '8930000000017',
    saleMode: 'WEIGHT',
    allowDecimalQuantity: true,
  },
  {
    name: 'Rau cải ngọt sạch',
    slug: 'rau-cai-ngot-sach',
    category: 'rau-cu',
    origin: 'Lâm Đồng',
    description: 'Rau cải ngọt trồng theo tiêu chuẩn an toàn, giao trong ngày.',
    image: 'https://images.unsplash.com/photo-1576045057995-568f588f82fb?w=800',
    price: 18000,
    unit: 'bó',
    barcode: '8930000000024',
    saleMode: 'UNIT',
  },
  {
    name: 'Xoài cát Hòa Lộc',
    slug: 'xoai-cat-hoa-loc',
    category: 'trai-cay',
    origin: 'Tiền Giang',
    description: 'Xoài cát Hòa Lộc chín cây, ngọt thanh, thơm đặc trưng.',
    image: 'https://images.unsplash.com/photo-1605027990121-cbae9e0642df?w=800',
    price: 85000,
    unit: 'kg',
    barcode: '8930000000031',
    saleMode: 'WEIGHT',
    allowDecimalQuantity: true,
  },
  {
    name: 'Bơ sáp Đắk Lắk',
    slug: 'bo-sap-dak-lak',
    category: 'trai-cay',
    origin: 'Đắk Lắk',
    description: 'Bơ sáp dẻo, béo, cơm dày, hạt nhỏ.',
    image: 'https://images.unsplash.com/photo-1601039641847-7857b994d704?w=800',
    price: 65000,
    unit: 'kg',
    barcode: '8930000000048',
    saleMode: 'WEIGHT',
    allowDecimalQuantity: true,
  },
  {
    name: 'Gạo ST25 thượng hạng',
    slug: 'gao-st25-thuong-hang',
    category: 'gao-hat',
    origin: 'Sóc Trăng',
    description: 'Gạo ST25 - gạo ngon hàng đầu, hạt dài, dẻo thơm tự nhiên.',
    image: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=800',
    price: 38000,
    unit: 'túi 5kg',
    barcode: '8930000000055',
    saleMode: 'UNIT',
  },
  {
    name: 'Trứng gà ta',
    slug: 'trung-ga-ta',
    category: 'thit-trung',
    origin: 'Đồng Nai',
    description: 'Trứng gà ta nuôi thả vườn, lòng đỏ đậm, thơm béo.',
    image: 'https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?w=800',
    price: 35000,
    unit: 'hộp 10',
    barcode: '8930000000062',
    saleMode: 'UNIT',
  },
  {
    name: 'Nước mắm Phú Quốc 500ml',
    slug: 'nuoc-mam-phu-quoc-500ml',
    category: 'gao-hat',
    origin: 'Phú Quốc, Kiên Giang',
    description: 'Nước mắm nhĩ truyền thống 40 độ đạm, chai thủy tinh 500ml.',
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
    fullName: 'Trần Thị Khách (Q1)',
    address: {
      recipientName: 'Trần Thị Khách',
      phone: '0901234567',
      province: 'TP.HCM',
      district: 'Quận 1',
      ward: 'Bến Nghé',
      line1: '1 Lê Duẩn',
      formattedAddress: '1 Lê Duẩn, Bến Nghé, Quận 1, TP.HCM',
      lat: 10.7805,
      lng: 106.6995,
    },
  },
  {
    email: 'customer.q7@nsx.local',
    fullName: 'Nguyễn Văn Q7',
    address: {
      recipientName: 'Nguyễn Văn Q7',
      phone: '0902222222',
      province: 'TP.HCM',
      district: 'Quận 7',
      ward: 'Tân Phong',
      line1: '10 Nguyễn Văn Linh',
      formattedAddress: '10 Nguyễn Văn Linh, Tân Phong, Quận 7, TP.HCM',
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
    } else {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          passwordHash,
          emailVerifiedAt: user.emailVerifiedAt ?? new Date(),
          profile: {
            upsert: {
              create: { fullName },
              update: { fullName },
            },
          },
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
  await ensureUser('admin@nsx.local', 'Quản trị viên', 'ADMIN');
  await ensureUser('support@nsx.local', 'Nhân viên hỗ trợ', 'SUPPORT');

  console.log('Seeding categories...');
  const catMap = new Map<string, string>();
  for (const c of CATEGORIES) {
    const cat = await prisma.category.upsert({
      where: { slug: c.slug },
      create: c,
      update: { name: c.name },
    });
    catMap.set(c.slug, cat.id);
  }

  console.log('Seeding products (global catalog)...');
  const productVariantMap = new Map<string, string>(); // product slug -> variantId
  for (const p of PRODUCTS) {
    let product = await prisma.product.findUnique({
      where: { slug: p.slug },
      include: { images: true, variants: true },
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
        include: { images: true, variants: true },
      });
    } else {
      await prisma.product.update({
        where: { id: product.id },
        data: {
          categoryId: catMap.get(p.category)!,
          name: p.name,
          description: p.description,
          status: ProductStatus.ACTIVE,
          originRegion: p.origin,
        },
      });
      const primaryImage = product.images.find((image) => image.isPrimary) ?? product.images[0];
      if (primaryImage) {
        await prisma.productImage.update({
          where: { id: primaryImage.id },
          data: { url: p.image, isPrimary: true, sortOrder: 0 },
        });
      } else {
        await prisma.productImage.create({
          data: {
            productId: product.id,
            url: p.image,
            isPrimary: true,
            sortOrder: 0,
          },
        });
      }
      // Dam bao saleMode/allowDecimalQuantity dung neu product da ton tai
      await prisma.productVariant.update({
        where: { id: product.variants[0].id },
        data: {
          unit: p.unit,
          price: p.price,
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
      `Quản lý ${s.name}`,
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
        await ensureUser(s.staffEmails[i], `NV bán hàng ${i + 1} ${s.code}`, 'STORE_STAFF'),
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
        data: {
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
          reason: 'Nhập hàng khởi tạo (seed)',
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
    } else {
      await prisma.address.update({
        where: { id: hasAddr.id },
        data: {
          recipientName: c.address.recipientName,
          phone: c.address.phone,
          province: c.address.province,
          district: c.address.district,
          ward: c.address.ward,
          line1: c.address.line1,
          formattedAddress: c.address.formattedAddress,
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
      name: 'Mùa hè Nông Sản Xanh',
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
    update: {
      name: 'Mùa hè Nông Sản Xanh',
      scope: 'PLATFORM',
      type: 'PERCENT',
      value: 10,
      maxDiscount: 50000,
      minOrderValue: 100000,
      usageLimit: 1000,
      status: 'ACTIVE',
    },
  });
  const q1 = await prisma.store.findUnique({ where: { code: 'BHX-Q1' } });
  if (q1) {
    await prisma.coupon.upsert({
      where: { code: 'Q1GIAM10' },
      create: {
        code: 'Q1GIAM10',
        name: 'Giảm 10k cửa hàng Quận 1',
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
      update: {
        name: 'Giảm 10k cửa hàng Quận 1',
        scope: 'STORE',
        storeId: q1.id,
        type: 'FIXED',
        value: 10000,
        minOrderValue: 80000,
        usageLimit: 200,
        status: 'ACTIVE',
      },
    });
  }

  console.log('Seeding knowledge sources...');
  const knowledgeSources = [
    {
      code: 'STORE_CHAIN_MODEL',
      type: 'POLICY',
      title: 'Mô hình chuỗi cửa hàng',
      content:
        'Nông Sản Xanh là chuỗi cửa hàng nông sản theo khu vực. Khi khách đặt hàng, hệ thống chọn cửa hàng phù hợp còn hàng để giao.',
    },
    {
      code: 'DELIVERY_POLICY',
      type: 'POLICY',
      title: 'Chính sách giao hàng',
      content:
        'Phí giao hàng tính từ cửa hàng phục vụ đến địa chỉ khách. Đơn từ 300.000đ và trong 10km được miễn phí ship.',
    },
    {
      code: 'RETURN_REFUND_POLICY',
      type: 'POLICY',
      title: 'Đổi trả và hoàn tiền',
      content:
        'Khách có thể yêu cầu trả hàng sau khi nhận. Cửa hàng xử lý và hoàn tiền trong 3-5 ngày làm việc.',
    },
    {
      code: 'PAYMENT_METHODS',
      type: 'FAQ',
      title: 'Phương thức thanh toán',
      content: 'Hỗ trợ COD và VNPay.',
    },
  ];
  for (const source of knowledgeSources) {
    await prisma.knowledgeSource.upsert({
      where: { code: source.code },
      create: source,
      update: {
        type: source.type,
        title: source.title,
        content: source.content,
        status: 'ACTIVE',
      },
    });
  }

  console.log('\nSeed done. Tất cả mật khẩu: Password123!');
  console.log('  Admin:     admin@nsx.local');
  console.log('  Support:   support@nsx.local');
  console.log('  Customers: customer@nsx.local (Q1), customer.q7@nsx.local (Q7)');
  console.log('  Stores:');
  for (const s of STORES) {
    console.log(`    ${s.code}: manager=${s.managerEmail} | shipper=${s.shipperEmail}`);
    console.log(`        staff=${s.staffEmails.join(', ')}`);
    console.log(`        kho=${s.warehouseEmails.join(', ')}`);
  }
  console.log('  Coupons: NSXMUAHE (platform 10%), Q1GIAM10 (store Quận 1)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
