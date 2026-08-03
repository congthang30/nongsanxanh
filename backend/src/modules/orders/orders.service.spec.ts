import { OrdersService } from './orders.service';

describe('OrdersService.createOrder cart ownership', () => {
  it('uses only the authenticated user cart', async () => {
    const prisma = {
      address: {
        findFirst: jest.fn().mockResolvedValue({ id: 'address-1', lat: 10, lng: 106 }),
      },
      cart: { findFirst: jest.fn().mockResolvedValue({ items: [] }) },
    };
    const service = new OrdersService(
      prisma as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    await expect(
      service.createOrder('user-1', {
        addressId: 'address-1',
        paymentMethod: 'COD',
      }),
    ).rejects.toThrow('Gio hang trong');
    expect(prisma.cart.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'user-1', status: 'ACTIVE' } }),
    );
  });
});
