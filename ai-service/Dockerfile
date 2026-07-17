FROM python:3.11-slim

WORKDIR /app

ARG INSTALL_LOCAL_MODEL=false
COPY requirements.txt requirements-local.txt ./
RUN if [ "$INSTALL_LOCAL_MODEL" = "true" ]; then \
      pip install --no-cache-dir -r requirements-local.txt; \
    else \
      pip install --no-cache-dir -r requirements.txt; \
    fi

COPY app ./app

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
