from __future__ import annotations

from functools import lru_cache
from typing import Literal

import httpx
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, ConfigDict, Field
from pydantic_settings import BaseSettings, SettingsConfigDict
from starlette.concurrency import run_in_threadpool


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    ai_embedding_provider: Literal["local", "cloud"] = "local"
    ai_local_embedding_model: str = "jinaai/jina-embeddings-v3"
    ai_cloud_embedding_model: str = "jina-embeddings-v3"
    ai_embedding_dimensions: int = 1024
    jina_api_key: str = ""
    jina_api_url: str = "https://api.jina.ai/v1/embeddings"
    ai_generation_provider: Literal["none", "gemini"] = "none"
    ai_cloud_generation_model: str = "gemini-2.5-flash"
    gemini_api_key: str = ""


settings = Settings()
app = FastAPI(title="NongSan Xanh AI Service", version="1.0.0")


class EmbeddingRequest(BaseModel):
    texts: list[str] = Field(min_length=1, max_length=128)
    task: Literal["retrieval.query", "retrieval.passage"]


class EmbeddingResponse(BaseModel):
    model: str
    dimensions: int
    embeddings: list[list[float]]


class GenerateRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    system_prompt: str = Field(alias="systemPrompt", min_length=1)
    prompt: str = Field(min_length=1)


class GenerateResponse(BaseModel):
    provider: str
    answer: str | None


@lru_cache(maxsize=1)
def get_local_model():
    if settings.ai_embedding_provider != "local":
        raise RuntimeError("Local model is disabled in cloud mode")
    try:
        from sentence_transformers import SentenceTransformer
    except ImportError as exc:
        raise RuntimeError(
            "Local embedding dependencies are not installed in this image"
        ) from exc
    return SentenceTransformer(
        settings.ai_local_embedding_model,
        trust_remote_code=True,
    )


def encode_local(request: EmbeddingRequest) -> list[list[float]]:
    model = get_local_model()
    kwargs = {
        "normalize_embeddings": True,
        "truncate_dim": settings.ai_embedding_dimensions,
    }
    try:
        vectors = model.encode(
            request.texts,
            task=request.task,
            prompt_name=request.task,
            **kwargs,
        )
    except TypeError:
        try:
            vectors = model.encode(request.texts, prompt_name=request.task, **kwargs)
        except (KeyError, TypeError):
            vectors = model.encode(request.texts, **kwargs)
    return [vector.tolist() for vector in vectors]


async def encode_cloud(request: EmbeddingRequest) -> tuple[str, list[list[float]]]:
    if not settings.jina_api_key:
        raise HTTPException(status_code=503, detail="JINA_API_KEY is not configured")
    payload = {
        "model": settings.ai_cloud_embedding_model,
        "task": request.task,
        "dimensions": settings.ai_embedding_dimensions,
        "normalized": True,
        "input": request.texts,
    }
    async with httpx.AsyncClient(timeout=45) as client:
        response = await client.post(
            settings.jina_api_url,
            headers={
                "Authorization": f"Bearer {settings.jina_api_key}",
                "Content-Type": "application/json",
            },
            json=payload,
        )
    if response.is_error:
        raise HTTPException(
            status_code=502,
            detail=f"Jina embedding failed with HTTP {response.status_code}",
        )
    body = response.json()
    rows = sorted(body.get("data", []), key=lambda row: row.get("index", 0))
    return body.get("model", settings.ai_cloud_embedding_model), [
        row["embedding"] for row in rows
    ]


def validate_vectors(vectors: list[list[float]], expected_count: int) -> None:
    if len(vectors) != expected_count:
        raise HTTPException(status_code=502, detail="Embedding result count mismatch")
    invalid = next(
        (
            len(vector)
            for vector in vectors
            if len(vector) != settings.ai_embedding_dimensions
        ),
        None,
    )
    if invalid is not None:
        raise HTTPException(
            status_code=502,
            detail=(
                "Embedding dimension mismatch: "
                f"expected {settings.ai_embedding_dimensions}, got {invalid}"
            ),
        )


@app.get("/health")
def health():
    return {
        "status": "ok",
        "embeddingProvider": settings.ai_embedding_provider,
        "embeddingDimensions": settings.ai_embedding_dimensions,
        "generationProvider": settings.ai_generation_provider,
    }


@app.post("/v1/embeddings", response_model=EmbeddingResponse)
async def embeddings(request: EmbeddingRequest):
    try:
        if settings.ai_embedding_provider == "local":
            model_name = settings.ai_local_embedding_model
            vectors = await run_in_threadpool(encode_local, request)
        else:
            model_name, vectors = await encode_cloud(request)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    validate_vectors(vectors, len(request.texts))
    return EmbeddingResponse(
        model=model_name,
        dimensions=settings.ai_embedding_dimensions,
        embeddings=vectors,
    )


@app.post("/v1/generate", response_model=GenerateResponse)
async def generate(request: GenerateRequest):
    if settings.ai_generation_provider == "none":
        return GenerateResponse(provider="none", answer=None)
    if not settings.gemini_api_key:
        return GenerateResponse(provider="gemini", answer=None)

    url = (
        "https://generativelanguage.googleapis.com/v1beta/models/"
        f"{settings.ai_cloud_generation_model}:generateContent"
    )
    payload = {
        "systemInstruction": {"parts": [{"text": request.system_prompt}]},
        "contents": [{"role": "user", "parts": [{"text": request.prompt}]}],
        "generationConfig": {"temperature": 0.3, "maxOutputTokens": 800},
    }
    async with httpx.AsyncClient(timeout=60) as client:
        response = await client.post(
            url,
            params={"key": settings.gemini_api_key},
            json=payload,
        )
    if response.is_error:
        return GenerateResponse(provider="gemini", answer=None)
    body = response.json()
    try:
        answer = body["candidates"][0]["content"]["parts"][0]["text"]
    except (KeyError, IndexError, TypeError):
        answer = None
    return GenerateResponse(provider="gemini", answer=answer)
