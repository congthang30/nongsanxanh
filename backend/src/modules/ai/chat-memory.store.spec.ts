import { ConfigService } from '@nestjs/config';
import { NotFoundException } from '@nestjs/common';
import { RedisService } from '../../infrastructure/redis/redis.service';
import { ChatMemoryStore } from './chat-memory.store';

class FakePipeline {
  private readonly operations: (() => void)[] = [];

  constructor(private readonly client: FakeRedisClient) {}

  rpush(key: string, value: string) {
    this.operations.push(() => this.client.rpushNow(key, value));
    return this;
  }

  ltrim(key: string, start: number, end: number) {
    this.operations.push(() => this.client.ltrimNow(key, start, end));
    return this;
  }

  expire() {
    return this;
  }

  set(key: string, value: string) {
    this.operations.push(() => this.client.setNow(key, value));
    return this;
  }

  async exec() {
    this.operations.forEach((operation) => operation());
    return [];
  }
}

class FakeRedisClient {
  private readonly strings = new Map<string, string>();
  private readonly lists = new Map<string, string[]>();

  async set(key: string, value: string, ...args: string[]) {
    if (args.includes('NX') && this.strings.has(key)) return null;
    this.strings.set(key, value);
    return 'OK';
  }

  async get(key: string) {
    return this.strings.get(key) ?? null;
  }

  async lrange(key: string, start: number, end: number) {
    const list = this.lists.get(key) ?? [];
    return list.slice(start, end === -1 ? undefined : end + 1);
  }

  pipeline() {
    return new FakePipeline(this);
  }

  setNow(key: string, value: string) {
    this.strings.set(key, value);
  }

  rpushNow(key: string, value: string) {
    this.lists.set(key, [...(this.lists.get(key) ?? []), value]);
  }

  ltrimNow(key: string, start: number, end: number) {
    const list = this.lists.get(key) ?? [];
    const normalizedStart = start < 0 ? Math.max(list.length + start, 0) : start;
    const normalizedEnd = end < 0 ? list.length + end : end;
    this.lists.set(key, list.slice(normalizedStart, normalizedEnd + 1));
  }
}

describe('ChatMemoryStore', () => {
  function createStore() {
    const client = new FakeRedisClient();
    const redis = { client } as unknown as RedisService;
    const config = {
      get: (_key: string, fallback: string) => fallback,
    } as ConfigService;
    return new ChatMemoryStore(redis, config);
  }

  it('stores chat messages outside Postgres and returns them in order', async () => {
    const store = createStore();
    const id = await store.getOrCreate(undefined, 'session:one');

    await store.append(id, 'session:one', 'user', 'Gia xoai?');
    await store.append(id, 'session:one', 'assistant', '50.000d/kg');

    const messages = await store.history(id, 'session:one');
    expect(messages.map(({ role, content }) => ({ role, content }))).toEqual([
      { role: 'user', content: 'Gia xoai?' },
      { role: 'assistant', content: '50.000d/kg' },
    ]);
  });

  it('does not expose a conversation to another owner', async () => {
    const store = createStore();
    const id = await store.getOrCreate(undefined, 'session:owner');

    await expect(store.history(id, 'session:other')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('caps the number of retained messages', async () => {
    const store = createStore();
    const id = await store.getOrCreate(undefined, 'session:one');

    for (let index = 0; index < 105; index++) {
      await store.append(id, 'session:one', 'user', `message-${index}`);
    }

    const messages = await store.history(id, 'session:one');
    expect(messages).toHaveLength(100);
    expect(messages[0].content).toBe('message-5');
  });
});
