# Production Dockerfile for Backend (FastAPI API + Telegram Bot)
# Multi-stage build for optimized production image

FROM python:3.11-slim AS base

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_PREFER_BINARY=1 \
    PIP_NO_COMPILE=1

# Install system dependencies
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        build-essential \
        libpq-dev \
        libjpeg62-turbo-dev \
        libopenjp2-7-dev \
        libtiff-dev \
        libwebp-dev \
        zlib1g-dev \
        curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /opt/pokerkit

# Install PokerKit (local library)
COPY setup.py README.md /opt/pokerkit/
COPY pokerkit/ /opt/pokerkit/pokerkit/
RUN pip install --upgrade pip \
    && pip install --no-cache-dir /opt/pokerkit

WORKDIR /opt/app

# Install Telegram Poker Bot runtime dependencies
COPY telegram_poker_bot/requirements.runtime.txt /tmp/runtime-requirements.txt
RUN pip install --no-cache-dir -r /tmp/runtime-requirements.txt

# Copy application code
COPY telegram_poker_bot/ /opt/app/telegram_poker_bot/

# Verify runtime environment
RUN python - <<'PY'
import sys
from importlib import metadata

required = (3, 10)
if sys.version_info < required:
    raise SystemExit(
        f"Python {required[0]}.{required[1]}+ is required for PokerKit; found {sys.version.split()[0]}"
    )

print("Python runtime ok", sys.version.split()[0])
print("PokerKit installed", metadata.version("pokerkit"))
PY

# Create unprivileged user
RUN useradd --create-home --shell /usr/sbin/nologin poker \
    && chown -R poker:poker /opt/app

WORKDIR /opt/app
USER poker

ENV PYTHONPATH=/opt/app \
    ALEMBIC_CONFIG=/opt/app/telegram_poker_bot/alembic.ini

# Healthcheck for backend API service
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Default command (can be overridden by docker-compose)
CMD ["uvicorn", "telegram_poker_bot.api.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
