"""Regression tests for API mount prefix handling."""

import importlib

import httpx
import pytest


@pytest.mark.asyncio
async def test_api_available_under_default_prefix(monkeypatch):
    """
    Ensure the API responds under /api even when no explicit prefix is configured.

    This guards against production deployments that rely on the frontend default
    of calling /api/* without an nginx rewrite layer.
    """

    monkeypatch.setenv("PUBLIC_BASE_URL", "https://example.com")
    monkeypatch.setenv("VITE_API_URL", "")

    from telegram_poker_bot.shared import config

    config.get_settings.cache_clear()

    module = importlib.import_module("telegram_poker_bot.api.main")
    importlib.reload(module)

    async with httpx.AsyncClient(app=module.app, base_url="http://testserver") as client:
        api_response = await client.get("/api/health")
        root_response = await client.get("/health")

    assert api_response.status_code == 200
    assert api_response.json()["status"] == "ok"
    assert root_response.status_code == 200

