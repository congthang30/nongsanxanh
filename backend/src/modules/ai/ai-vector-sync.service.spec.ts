const mockAdd = jest.fn();
const mockGetJob = jest.fn();
const mockQueueClose = jest.fn();
const mockRedisQuit = jest.fn();

jest.mock('bullmq', () => ({
  Queue: jest.fn().mockImplementation(() => ({
    add: mockAdd,
    getJob: mockGetJob,
    close: mockQueueClose,
  })),
}));

jest.mock('ioredis', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({ quit: mockRedisQuit })),
}));

import { ConfigService } from '@nestjs/config';
import { AiVectorSyncService } from './ai-vector-sync.service';

describe('AiVectorSyncService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetJob.mockResolvedValue(null);
    mockAdd.mockResolvedValue({ id: 'ai-vector-sync-PRODUCT-product-1' });
  });

  it('queues a deterministic delayed job with retry and retention settings', async () => {
    const config = {
      get: (_key: string, fallback: string) => fallback,
    } as ConfigService;
    const service = new AiVectorSyncService(config);

    const result = await service.enqueue('PRODUCT', 'product-1', 'updated');

    expect(mockAdd).toHaveBeenCalledWith(
      'sync-object',
      expect.objectContaining({
        objectType: 'PRODUCT',
        objectId: 'product-1',
        reason: 'updated',
      }),
      expect.objectContaining({
        jobId: 'ai-vector-sync-PRODUCT-product-1',
        delay: 10000,
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
      }),
    );
    expect(result.state).toBe('queued');
    await service.onModuleDestroy();
  });

  it('queues newly created objects without debounce delay', async () => {
    const config = {
      get: (_key: string, fallback: string) => fallback,
    } as ConfigService;
    const service = new AiVectorSyncService(config);

    await service.enqueue('PRODUCT', 'product-1', 'created');

    expect(mockAdd).toHaveBeenCalledWith(
      'sync-object',
      expect.objectContaining({
        objectType: 'PRODUCT',
        objectId: 'product-1',
        reason: 'created',
      }),
      expect.objectContaining({ delay: 0 }),
    );
    await service.onModuleDestroy();
  });

  it('removes an existing delayed job to reset the debounce window', async () => {
    const remove = jest.fn().mockResolvedValue(undefined);
    mockGetJob.mockResolvedValue({
      getState: jest.fn().mockResolvedValue('delayed'),
      remove,
    });
    const config = {
      get: (_key: string, fallback: string) => fallback,
    } as ConfigService;
    const service = new AiVectorSyncService(config);

    await service.enqueue('PRODUCT', 'product-1', 'updated');

    expect(remove).toHaveBeenCalled();
    expect(mockAdd).toHaveBeenCalledTimes(1);
    await service.onModuleDestroy();
  });
});
