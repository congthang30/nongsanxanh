-- Verify pgvector is available before deleting legacy data.
CREATE EXTENSION IF NOT EXISTS vector;

-- This migration intentionally removes legacy AI chat and document data.
DROP TABLE IF EXISTS "ai_messages";
DROP TABLE IF EXISTS "ai_conversations";
DROP TABLE IF EXISTS "ai_document_chunks";
DROP TABLE IF EXISTS "ai_documents";

CREATE TABLE "knowledge_sources" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "effective_from" TIMESTAMP(3),
    "effective_to" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "knowledge_sources_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "knowledge_sources_code_key" ON "knowledge_sources"("code");
CREATE INDEX "knowledge_sources_type_status_idx" ON "knowledge_sources"("type", "status");

CREATE TABLE "ai_vector_index" (
    "id" TEXT NOT NULL,
    "object_type" TEXT NOT NULL,
    "object_id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "embedding" vector(1024) NOT NULL,
    "metadata" JSONB,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ai_vector_index_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ai_vector_index_object_type_object_id_key"
ON "ai_vector_index"("object_type", "object_id");

CREATE INDEX "ai_vector_index_object_type_status_idx"
ON "ai_vector_index"("object_type", "status");

CREATE INDEX "ai_vector_index_embedding_hnsw_idx"
ON "ai_vector_index" USING hnsw ("embedding" vector_cosine_ops);
