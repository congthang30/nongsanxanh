import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { StoreInventoryService } from '../inventory/inventory.service';
import { PromotionService } from '../promotion/promotion.service';
import { ShippingQuoteService } from '../shipping/shipping-quote.service';
import { StoreResolverService } from '../store/store-resolver.service';
import {
  AddCartItemDto,
  CheckoutQuoteDto,
  RevalidateCartDto,
  UpdateCartItemDto,
} from './dto/cart.dto';

export interface CartItemView {
  id: string;
  variantId: string;
  productId: string;
  name: string;
  sku: string;
  unit: string;
  image: string | null;
  unitPrice: number;
  originalPrice: number;
  onSale: boolean;
  quantity: number;
  available: number;
  inStock: boolean;
  lineTotal: number;
}

export interface CartView {
  cartId: string;
  storeId: string | null;
  storeName: string | null;
  items: CartItemView[];
  subtotal: number;
  count: number;
  hasIssues: boolean;
}

/**
 * Cart cho mo hinh chuoi cua hang: moi gio chi thuoc MOT cua hang.
 * Khi them san pham, phai chi dinh storeId. Doi store -> phai validate lai gio.
 */
@Injectable()
export class CartService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: StoreInventoryService,
    private readonly promotion: PromotionService,
    private readonly shippingQuote: ShippingQuoteService,
    private readonly resolver: StoreResolverService,
  ) {}

  private async getOrCreateCart(userId?: string, sessionId?: string) {
    if (userId) {
      const existing = await this.prisma.cart.findFirst({
        where: { userId, status: 'ACTIVE' },
      });
      if (existing) return existing;
      return this.prisma.cart.create({ data: { userId, status: 'ACTIVE' } });
    }
    if (sessionId) {
      const existing = await this.prisma.cart.findFirst({
        where: { sessionId, status: 'ACTIVE' },
      });
      if (existing) return existing;
      return this.prisma.cart.create({
        data: { sessionId, status: 'ACTIVE' },
      });
    }
    throw new BadRequestException({
      code: 'CART_IDENTITY_REQUIRED',
      message: 'Can userId hoac sessionId',
    });
  }

  async getCart(userId?: string, sessionId?: string): Promise<CartView> {
    const cart = await this.getOrCreateCart(userId, sessionId);
    return this.buildCartView(cart.id);
  }

  async addItem(dto: AddCartItemDto, userId?: string, sessionId?: string) {
    const cart = await this.getOrCreateCart(userId, sessionId);
    const variant = await this.prisma.productVariant.findUnique({
      where: { id: dto.variantId },
      include: { product: true },
    });
    if (!variant) {
      throw new NotFoundException({
        code: 'VARIANT_NOT_FOUND',
        message: 'Khong tim thay san pham',
      });
    }

    // Neu cart da thuoc store khac -> bao loi (mot store / gio)
    if (cart.storeId && cart.storeId !== dto.storeId) {
      throw new BadRequestException({
        code: 'CART_OTHER_STORE',
        message:
          'Gio hang dang thuoc cua hang khac. Vui long thanh toan hoac xoa gio truoc khi mua tu cua hang moi.',
      });
    }

    const available = await this.inventory.getAvailableInStore(
      dto.storeId,
      dto.variantId,
    );
    const existing = await this.prisma.cartItem.findUnique({
      where: { cartId_variantId: { cartId: cart.id, variantId: dto.variantId } },
    });
    const newQty = (existing ? Number(existing.quantity) : 0) + dto.quantity;
    if (newQty > available) {
      throw new BadRequestException({
        code: 'INSUFFICIENT_STOCK',
        message: `Cua hang chi con ${available} ${variant.unit}`,
      });
    }

    await this.prisma.$transaction([
      this.prisma.cart.update({
        where: { id: cart.id },
        data: { storeId: dto.storeId },
      }),
      this.prisma.cartItem.upsert({
        where: {
          cartId_variantId: { cartId: cart.id, variantId: dto.variantId },
        },
        create: {
          cartId: cart.id,
          variantId: dto.variantId,
          quantity: dto.quantity,
        },
        update: { quantity: newQty },
      }),
    ]);
    return this.buildCartView(cart.id);
  }

  async updateItem(
    itemId: string,
    dto: UpdateCartItemDto,
    userId?: string,
    sessionId?: string,
  ) {
    const cart = await this.getOrCreateCart(userId, sessionId);
    const item = await this.prisma.cartItem.findFirst({
      where: { id: itemId, cartId: cart.id },
    });
    if (!item) {
      throw new NotFoundException({
        code: 'CART_ITEM_NOT_FOUND',
        message: 'Khong tim thay item',
      });
    }
    if (cart.storeId) {
      const available = await this.inventory.getAvailableInStore(
        cart.storeId,
        item.variantId,
      );
      if (dto.quantity > available) {
        throw new BadRequestException({
          code: 'INSUFFICIENT_STOCK',
          message: `Cua hang chi con ${available}`,
        });
      }
    }
    await this.prisma.cartItem.update({
      where: { id: itemId },
      data: { quantity: dto.quantity },
    });
    return this.buildCartView(cart.id);
  }

  async removeItem(itemId: string, userId?: string, sessionId?: string) {
    const cart = await this.getOrCreateCart(userId, sessionId);
    await this.prisma.cartItem.deleteMany({
      where: { id: itemId, cartId: cart.id },
    });
    // Neu het item -> bo gan store
    const remaining = await this.prisma.cartItem.count({
      where: { cartId: cart.id },
    });
    if (remaining === 0) {
      await this.prisma.cart.update({
        where: { id: cart.id },
        data: { storeId: null },
      });
    }
    return this.buildCartView(cart.id);
  }

  /**
   * Revalidate gio hang khi khach doi dia chi -> co the doi store.
   * Neu store moi khac store hien tai cua gio, kiem tra tung item con ban
   * tai store moi va con ton khong.
   */
  async revalidate(
    dto: RevalidateCartDto,
    userId?: string,
    sessionId?: string,
  ) {
    const cart = await this.getOrCreateCart(userId, sessionId);
    let targetStoreId = dto.storeId ?? cart.storeId;

    // Neu truyen addressId -> resolve store moi
    if (!targetStoreId && dto.addressId) {
      const items = await this.prisma.cartItem.findMany({
        where: { cartId: cart.id },
      });
      const address = await this.prisma.address.findFirst({
        where: { id: dto.addressId, ...(userId ? { userId } : {}) },
      });
      if (address) {
        const result = await this.resolver.resolve({
          lat: address.lat,
          lng: address.lng,
          province: address.province,
          district: address.district,
          ward: address.ward,
          cartItems: items.map((i) => ({
            variantId: i.variantId,
            quantity: Number(i.quantity),
          })),
        });
        targetStoreId = result.selectedStore?.storeId ?? null;
      }
    }

    const view = await this.buildCartView(cart.id, targetStoreId ?? undefined);

    // Cap nhat store cua gio neu thay doi
    if (targetStoreId && targetStoreId !== cart.storeId) {
      await this.prisma.cart.update({
        where: { id: cart.id },
        data: { storeId: targetStoreId },
      });
    }

    const storeChanged = !!targetStoreId && targetStoreId !== cart.storeId;
    return {
      ...view,
      storeChanged,
      message: storeChanged
        ? 'Dia chi moi duoc phuc vu boi cua hang khac. Vui long kiem tra lai gio hang.'
        : undefined,
    };
  }

  /**
   * Tinh quote checkout: resolve store theo dia chi, validate ton kho/gia/shipper,
   * tinh phi ship tu store -> dia chi khach.
   */
  async checkoutQuote(
    dto: CheckoutQuoteDto,
    userId?: string,
    sessionId?: string,
  ) {
    const cart = await this.getOrCreateCart(userId, sessionId);
    const items = await this.prisma.cartItem.findMany({
      where: { cartId: cart.id },
    });
    if (items.length === 0) {
      throw new BadRequestException({
        code: 'CART_EMPTY',
        message: 'Gio hang trong',
      });
    }

    const address = await this.prisma.address.findFirst({
      where: { id: dto.addressId, ...(userId ? { userId } : {}) },
    });
    if (!address) {
      throw new BadRequestException({
        code: 'ADDRESS_INVALID',
        message: 'Dia chi giao khong hop le',
      });
    }
    if (address.lat == null || address.lng == null) {
      throw new BadRequestException({
        code: 'ADDRESS_NOT_VERIFIED',
        message:
          'Dia chi chua co toa do xac thuc. Vui long chon lai tu goi y ban do.',
      });
    }

    // Resolve store
    const resolveResult = await this.resolver.resolve({
      lat: address.lat,
      lng: address.lng,
      province: address.province,
      district: address.district,
      ward: address.ward,
      cartItems: items.map((i) => ({
        variantId: i.variantId,
        quantity: Number(i.quantity),
      })),
    });

    if (!resolveResult.serviceable || !resolveResult.selectedStore) {
      return {
        serviceable: false,
        reason: resolveResult.reason,
        store: null,
        message: 'Khu vuc/gio hang nay chua duoc cua hang nao phuc vu day du.',
      };
    }

    const selected = resolveResult.selectedStore;
    const storeId = selected.storeId;
    const view = await this.buildCartView(cart.id, storeId);

    const subtotal = view.subtotal;
    const shipQuote = await this.shippingQuote.quote({
      origin: await this.getStoreOrigin(storeId),
      dropoff: { lat: address.lat, lng: address.lng },
      method: 'STANDARD',
      subtotal,
    });

    const { discount, coupon } = await this.promotion.applyCoupon(
      dto.couponCode,
      subtotal,
      userId,
      storeId,
    );

    const grandTotal = subtotal - discount + shipQuote.shippingFee;

    return {
      serviceable: true,
      reason: 'OK',
      store: {
        id: storeId,
        name: selected.storeName,
        code: selected.storeCode,
        province: selected.province,
        district: selected.district,
        distanceKm: selected.distanceKm,
      },
      items: view.items,
      inventoryWarnings: view.items
        .filter((i) => !i.inStock)
        .map((i) => ({ variantId: i.variantId, name: i.name, available: i.available })),
      subtotal,
      shippingFee: shipQuote.shippingFee,
      shippingBreakdown: shipQuote.feeBreakdown,
      distanceKm: shipQuote.distanceKm,
      etaText: shipQuote.durationMin
        ? `Du kien ${shipQuote.durationMin}-${shipQuote.durationMin + 30} phut`
        : null,
      discountTotal: discount,
      coupon: coupon?.code ?? null,
      grandTotal,
    };
  }

  // ---------------- helpers ----------------

  private async getStoreOrigin(storeId: string) {
    const store = await this.prisma.store.findUnique({
      where: { id: storeId },
      select: { lat: true, lng: true },
    });
    return { lat: store?.lat ?? 0, lng: store?.lng ?? 0 };
  }

  private async buildCartView(
    cartId: string,
    overrideStoreId?: string,
  ): Promise<CartView> {
    const cart = await this.prisma.cart.findUnique({ where: { id: cartId } });
    const storeId = overrideStoreId ?? cart?.storeId ?? null;

    const items = await this.prisma.cartItem.findMany({
      where: { cartId },
      include: {
        variant: {
          include: {
            product: {
              include: { images: { where: { isPrimary: true }, take: 1 } },
            },
          },
        },
      },
    });

    const variantIds = items.map((it) => it.variantId);
    const availMap = storeId
      ? await this.inventory.getAvailabilityMap(storeId, variantIds)
      : new Map<string, number>();
    const priceMap = storeId
      ? await this.inventory.getStorePrices(storeId, variantIds)
      : new Map<string, number>();

    let store: { id: string; name: string } | null = null;
    if (storeId) {
      const s = await this.prisma.store.findUnique({
        where: { id: storeId },
        select: { id: true, name: true },
      });
      store = s;
    }

    const mapped: CartItemView[] = items.map((it) => {
      const unitPrice = priceMap.get(it.variantId) ?? it.variant.price;
      const quantity = Number(it.quantity);
      const available = availMap.get(it.variantId) ?? 0;
      return {
        id: it.id,
        variantId: it.variantId,
        productId: it.variant.productId,
        name: it.variant.product.name,
        sku: it.variant.sku,
        unit: it.variant.unit,
        image: it.variant.product.images[0]?.url ?? null,
        unitPrice,
        originalPrice: it.variant.price,
        onSale: unitPrice < it.variant.price,
        quantity,
        available,
        inStock: available >= quantity,
        lineTotal: quantity * unitPrice,
      };
    });

    const subtotal = mapped.reduce((s, i) => s + i.lineTotal, 0);
    return {
      cartId,
      storeId,
      storeName: store?.name ?? null,
      items: mapped,
      subtotal,
      count: mapped.reduce((s, i) => s + i.quantity, 0),
      hasIssues: mapped.some((i) => !i.inStock),
    };
  }
}
