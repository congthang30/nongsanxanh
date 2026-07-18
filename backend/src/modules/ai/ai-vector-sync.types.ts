export const AI_VECTOR_SYNC_QUEUE = 'ai-vector-sync';
export const AI_VECTOR_SYNC_EVENT = 'ai.vector-sync.requested';

export const AI_VECTOR_OBJECT_TYPES = [
  'PRODUCT',
  'COUPON',
  'POLICY',
  'FAQ',
] as const;

export type AiVectorObjectType = (typeof AI_VECTOR_OBJECT_TYPES)[number];

export type AiVectorSyncReason =
  | 'created'
  | 'updated'
  | 'deleted'
  | 'status_changed'
  | 'expired'
  | 'usage_limit_reached'
  | 'manual';

export interface AiVectorSyncRequest {
  objectType: AiVectorObjectType;
  objectId: string;
  reason: AiVectorSyncReason;
}

export interface AiVectorSyncJob extends AiVectorSyncRequest {
  requestedAt: string;
}
