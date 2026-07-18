import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { StoreScopeService } from './store-scope.service';

describe('StoreScopeService.resolveOperationalStoreId', () => {
  const prisma = {
    store: { findFirst: jest.fn() },
    storeStaff: { findFirst: jest.fn() },
  };
  const service = new StoreScopeService(prisma as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uses the selected active store for an Admin without requiring StoreStaff membership', async () => {
    prisma.store.findFirst.mockResolvedValue({ id: 'store-admin-selected' });

    await expect(
      service.resolveOperationalStoreId(
        { id: 'admin-1', roles: ['ADMIN'], permissions: [], sessionId: 'session-1' },
        'store-admin-selected',
      ),
    ).resolves.toBe('store-admin-selected');

    expect(prisma.storeStaff.findFirst).not.toHaveBeenCalled();
    expect(prisma.store.findFirst).toHaveBeenCalledWith({
      where: { id: 'store-admin-selected', status: 'ACTIVE' },
      select: { id: true },
    });
  });

  it('requires Admin to select a store for operational screens', async () => {
    await expect(
      service.resolveOperationalStoreId({
        id: 'admin-1',
        roles: ['SUPER_ADMIN'],
        permissions: [], sessionId: 'session-1',
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'ADMIN_STORE_CONTEXT_REQUIRED' }),
    });
  });

  it('rejects an inactive or missing selected store', async () => {
    prisma.store.findFirst.mockResolvedValue(null);

    await expect(
      service.resolveOperationalStoreId(
        { id: 'admin-1', roles: ['ADMIN'], permissions: [], sessionId: 'session-1' },
        'missing-store',
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('keeps normal staff scoped to their active membership', async () => {
    prisma.storeStaff.findFirst.mockImplementation(({ where }) =>
      Promise.resolve(
        where.storeId === undefined || where.storeId === 'staff-store'
          ? { storeId: 'staff-store' }
          : null,
      ),
    );

    await expect(
      service.resolveOperationalStoreId(
        { id: 'staff-1', roles: ['STORE_STAFF'], permissions: [], sessionId: 'session-1' },
        'staff-store',
      ),
    ).resolves.toBe('staff-store');

    await expect(
      service.resolveOperationalStoreId(
        { id: 'staff-1', roles: ['STORE_STAFF'], permissions: [], sessionId: 'session-1' },
        'another-store',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});