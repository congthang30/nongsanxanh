import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { RedisService } from '../../infrastructure/redis/redis.service';

export type ChatRole = 'user' | 'assistant';

export interface ChatMemoryMessage {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: string;
}

interface ConversationMeta {
  ownerKey: string;
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class ChatMemoryStore {
  private readonly ttlSeconds: number;
  private readonly maxMessages: number;

  constructor(
    private readonly redis: RedisService,
    config: ConfigService,
  ) {
    this.ttlSeconds = Math.max(
      60,
      Number(config.get<string>('CHAT_MEMORY_TTL_SECONDS', '604800')) || 604800,
    );
    this.maxMessages = Math.max(
      10,
      Number(config.get<string>('CHAT_MEMORY_MAX_MESSAGES', '100')) || 100,
    );
  }

  async getOrCreate(conversationId: string | undefined, ownerKey: string) {
    const id = conversationId ?? randomUUID();
    const metaKey = this.metaKey(id);
    const now = new Date().toISOString();
    const initial: ConversationMeta = { ownerKey, createdAt: now, updatedAt: now };

    await this.redis.client.set(
      metaKey,
      JSON.stringify(initial),
      'EX',
      this.ttlSeconds,
      'NX',
    );

    const meta = await this.readMeta(id);
    this.assertOwner(meta, ownerKey);
    await this.touch(id, { ...meta, updatedAt: now });
    return id;
  }

  async append(
    conversationId: string,
    ownerKey: string,
    role: ChatRole,
    content: string,
  ): Promise<ChatMemoryMessage> {
    const meta = await this.readMeta(conversationId);
    this.assertOwner(meta, ownerKey);
    const message: ChatMemoryMessage = {
      id: randomUUID(),
      role,
      content,
      createdAt: new Date().toISOString(),
    };
    const messagesKey = this.messagesKey(conversationId);
    const pipeline = this.redis.client.pipeline();
    pipeline.rpush(messagesKey, JSON.stringify(message));
    pipeline.ltrim(messagesKey, -this.maxMessages, -1);
    pipeline.expire(messagesKey, this.ttlSeconds);
    pipeline.set(
      this.metaKey(conversationId),
      JSON.stringify({ ...meta, updatedAt: message.createdAt }),
      'EX',
      this.ttlSeconds,
    );
    await pipeline.exec();
    return message;
  }

  async history(conversationId: string, ownerKey: string) {
    const meta = await this.readMeta(conversationId);
    this.assertOwner(meta, ownerKey);
    const values = await this.redis.client.lrange(
      this.messagesKey(conversationId),
      0,
      -1,
    );
    await this.touch(conversationId, meta);
    return values.map((value) => JSON.parse(value) as ChatMemoryMessage);
  }

  private async readMeta(conversationId: string): Promise<ConversationMeta> {
    const raw = await this.redis.client.get(this.metaKey(conversationId));
    if (!raw) {
      throw new NotFoundException({
        code: 'CHAT_NOT_FOUND',
        message: 'Khong tim thay cuoc tro chuyen hoac cuoc tro chuyen da het han',
      });
    }
    return JSON.parse(raw) as ConversationMeta;
  }

  private assertOwner(meta: ConversationMeta, ownerKey: string) {
    if (meta.ownerKey !== ownerKey) {
      throw new NotFoundException({
        code: 'CHAT_NOT_FOUND',
        message: 'Khong tim thay cuoc tro chuyen',
      });
    }
  }

  private async touch(conversationId: string, meta: ConversationMeta) {
    const pipeline = this.redis.client.pipeline();
    pipeline.set(
      this.metaKey(conversationId),
      JSON.stringify(meta),
      'EX',
      this.ttlSeconds,
    );
    pipeline.expire(this.messagesKey(conversationId), this.ttlSeconds);
    await pipeline.exec();
  }

  private metaKey(id: string) {
    return `chat:conversation:${id}:meta`;
  }

  private messagesKey(id: string) {
    return `chat:conversation:${id}:messages`;
  }
}
