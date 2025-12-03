FROM python:3.11-slim AS base

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_PREFER_BINARY=1 \
    PIP_NO_COMPILE=1

WORKDIR /opt/pokerkit

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        build-essential \
        libpq-dev \
        libjpeg62-turbo-dev \
        libopenjp2-7-dev \
        libtiff-dev \
        libwebp-dev \
        zlib1g-dev \
    && rm -rf /var/lib/apt/lists/*

# Install PokerKit (local library)
COPY setup.py README.md /opt/pokerkit/
COPY pokerkit/ /opt/pokerkit/pokerkit/
RUN pip install --upgrade pip \
    && pip install --no-cache-dir /opt/pokerkit

WORKDIR /opt/app

# Install Telegram Poker Bot runtime dependencies
# PIP_PREFER_BINARY and PIP_NO_COMPILE (set above) reduce build-time
# resource usage by favoring prebuilt wheels and skipping bytecode.
COPY telegram_poker_bot/requirements.runtime.txt /tmp/runtime-requirements.txt
RUN pip install --no-cache-dir -r /tmp/runtime-requirements.txt

# Copy application code without flattening the package structure
COPY telegram_poker_bot/ /opt/app/telegram_poker_bot/

# Verify runtime environment matches PokerKit requirements
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

# Default command is intentionally left blank; docker compose sets the service command.
