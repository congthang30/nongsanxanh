# AI service

FastAPI boundary for embeddings and optional text generation. NestJS owns all
domain queries and tool decisions; this service does not connect to Postgres or
Redis.

## Modes

- Local: `docker compose -f docker-compose.local.yml up --build`
- Production/cloud: `docker compose -f docker-compose.yml up --build`

Local mode downloads `jinaai/jina-embeddings-v3` into the persistent
`huggingface_cache` volume on the first embedding request. Production mode uses
the Jina API and does not install Torch or load a local model.

**Seeding embeds automatically:** `prisma/seed.ts` calls AI `/v1/embeddings` and
writes vectors into Postgres `ai_vector_index` (pgvector). The `db-seed` service
depends on a healthy `ai-service` and sets `AI_SERVICE_URL`.

If vectors are still empty after seed (AI was down), the Nest backend boots with
`AI_AUTO_REINDEX_ON_EMPTY=true` (default) and runs a full reindex once products
exist without ACTIVE product vectors.

You can still call `POST /api/v1/ai/reindex` with an admin token to rebuild the
index after model changes. Changing `AI_EMBEDDING_DIMENSIONS` also requires a
database migration for the `vector(1024)` column before the full reindex.

Skip seed embeddings: `SEED_SKIP_EMBEDDINGS=1`.

The local Jina v3 model is published under CC BY-NC 4.0. Confirm the appropriate
commercial license before using local inference in a commercial deployment.
