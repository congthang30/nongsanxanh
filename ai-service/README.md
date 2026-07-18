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

After seeding domain data, call `POST /api/v1/ai/reindex` with an admin token to
index products, coupons, policies, and FAQs. Reindexing is required whenever the
embedding model changes. Changing `AI_EMBEDDING_DIMENSIONS` also requires a
database migration for the `vector(1024)` column before the full reindex.

The local Jina v3 model is published under CC BY-NC 4.0. Confirm the appropriate
commercial license before using local inference in a commercial deployment.
