import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { AiVectorSyncService } from './ai-vector-sync.service';
import {
  AI_VECTOR_SYNC_EVENT,
  AiVectorSyncRequest,
} from './ai-vector-sync.types';

@Injectable()
export class AiVectorSyncListener {
  constructor(private readonly sync: AiVectorSyncService) {}

  @OnEvent(AI_VECTOR_SYNC_EVENT, { async: true })
  handle(request: AiVectorSyncRequest) {
    return this.sync.enqueue(
      request.objectType,
      request.objectId,
      request.reason,
    );
  }
}
