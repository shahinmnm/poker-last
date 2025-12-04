import asyncio
import importlib
import sys
from types import SimpleNamespace
from unittest.mock import AsyncMock

import httpx
import pytest

from telegram_poker_bot.shared import config


@pytest.fixture
def bot_main(monkeypatch):
    env = {
        "TELEGRAM_BOT_TOKEN": "TEST_TOKEN",
        "PUBLIC_BASE_URL": "https://example.com",
        "WEBAPP_SECRET": "super-secret",
        "TELEGRAM_WEBHOOK_SECRET_TOKEN": "hook-secret",
    }
    for key, value in env.items():
        monkeypatch.setenv(key, value)

    config.get_settings.cache_clear()

    sys.modules.pop("telegram_poker_bot.bot.main", None)
    module = importlib.import_module("telegram_poker_bot.bot.main")

    yield module

    module.bot_ready.clear()
    config.get_settings.cache_clear()


def _patch_lifecycle(monkeypatch, module):
    monkeypatch.setattr(module.bot_application, "initialize", AsyncMock())
    monkeypatch.setattr(module.bot_application, "start", AsyncMock())
    monkeypatch.setattr(module.bot_application, "stop", AsyncMock())
    monkeypatch.setattr(module.bot_application, "shutdown", AsyncMock())
    monkeypatch.setattr(module.bot_application, "process_update", AsyncMock())

    mock_get_webhook_info = AsyncMock(return_value=SimpleNamespace(url=None))
    mock_set_webhook = AsyncMock(return_value=True)
    mock_close = AsyncMock()

    monkeypatch.setattr(
        module.bot_client.__class__,
        "get_webhook_info",
        mock_get_webhook_info,
        raising=True,
    )
    monkeypatch.setattr(
        module.bot_client.__class__,
        "set_webhook",
        mock_set_webhook,
        raising=True,
    )
    monkeypatch.setattr(
        module.bot_client.__class__,
        "close",
        mock_close,
        raising=True,
    )


def _build_transport(module):
    return httpx.ASGITransport(app=module.app)


@pytest.mark.asyncio
async def test_webhook_rejects_invalid_secret(bot_main, monkeypatch):
    module = bot_main
    _patch_lifecycle(monkeypatch, module)

    async with module.app.router.lifespan_context(module.app):
        async with httpx.AsyncClient(
            transport=_build_transport(module),
            base_url="http://test",
        ) as client:
            response = await client.post("/telegram/webhook", json={"update_id": 1})

    assert response.status_code == 403
    module.bot_application.process_update.assert_not_called()


@pytest.mark.asyncio
async def test_webhook_processes_update(bot_main, monkeypatch):
    module = bot_main
    _patch_lifecycle(monkeypatch, module)

    update_payload = {
        "update_id": 42,
        "message": {
            "message_id": 99,
            "date": 0,
            "chat": {"id": 1, "type": "private"},
            "from": {
                "id": 1,
                "is_bot": False,
                "first_name": "Test",
            },
            "text": "/start",
        },
    }

    async with module.app.router.lifespan_context(module.app):
        async with httpx.AsyncClient(
            transport=_build_transport(module),
            base_url="http://test",
        ) as client:
            response = await client.post(
                "/telegram/webhook",
                json=update_payload,
                headers={"X-Telegram-Bot-Api-Secret-Token": "hook-secret"},
            )

            assert response.status_code == 200

            # Allow background tasks scheduled by the webhook to run.
            await asyncio.sleep(0)

    module.bot_application.process_update.assert_awaited_once()
