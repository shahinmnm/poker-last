import hmac
import hashlib
import json
import importlib
import urllib.parse

import httpx
import pytest
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

from telegram_poker_bot.shared.models import Base


def build_init_data(bot_token: str, user_payload: dict, auth_date: str = "1700000000") -> str:
    """Create a signed Telegram init data string for tests."""
    user_json = json.dumps(user_payload, separators=(",", ":"))
    data_check_string = "\n".join(
        [
            f"auth_date={auth_date}",
            f"user={user_json}",
        ]
    )
    secret_key = hmac.new("WebAppData".encode(), bot_token.encode(), hashlib.sha256).digest()
    hash_value = hmac.new(secret_key, data_check_string.encode(), hashlib.sha256).hexdigest()
    encoded_user = urllib.parse.quote(user_json)
    return f"auth_date={auth_date}&user={encoded_user}&hash={hash_value}"


@pytest.fixture
async def api_client(monkeypatch):
    """Provide an HTTP client with an in-memory database and patched settings."""
    monkeypatch.setenv("TELEGRAM_BOT_TOKEN", "TEST_TOKEN")
    monkeypatch.setenv("PUBLIC_BASE_URL", "https://poker.shahin8n.sbs")
    monkeypatch.setenv("VITE_BOT_USERNAME", "@testgroupbot")

    from telegram_poker_bot.shared import config

    config.get_settings.cache_clear()

    module = importlib.import_module("telegram_poker_bot.api.main")
    importlib.reload(module)

    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    SessionLocal = async_sessionmaker(engine, expire_on_commit=False)

    async def override_get_db():
        async with SessionLocal() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise

    async def fake_send_message(*args, **kwargs):
        return None

    module.app.dependency_overrides[module.get_db] = override_get_db
    monkeypatch.setattr(module, "send_invite_share_message", fake_send_message)

    async with httpx.AsyncClient(app=module.app, base_url="http://test") as client:
        yield client

    module.app.dependency_overrides.clear()
    await engine.dispose()


@pytest.mark.asyncio
async def test_group_invite_creation_and_join(api_client):
    """Users can create and join group invites via the API."""
    init_data = build_init_data(
        "TEST_TOKEN",
        {"id": 999, "first_name": "Ava", "language_code": "en"},
    )

    create_response = await api_client.post(
        "/group-games/invites",
        headers={"X-Telegram-Init-Data": init_data},
    )
    assert create_response.status_code == 201
    payload = create_response.json()
    assert payload["game_id"]
    assert payload["deep_link"] == f"https://t.me/testgroupbot?startgroup={payload['game_id']}"
    assert payload["startapp_link"] == f"https://t.me/testgroupbot?startapp={payload['game_id']}"

    game_id = payload["game_id"]

    status_response = await api_client.get(f"/group-games/invites/{game_id}")
    assert status_response.status_code == 200
    status_payload = status_response.json()
    assert status_payload["status"] == "pending"

    profile_response = await api_client.get(
        "/users/me", headers={"X-Telegram-Init-Data": init_data}
    )
    assert profile_response.status_code == 200
    profile = profile_response.json()
    assert profile["registered"] is True
    assert profile["user_id"] is not None

    join_response = await api_client.post(
        f"/group-games/invites/{game_id}/attend",
        headers={"X-Telegram-Init-Data": init_data},
    )
    assert join_response.status_code == 200
    join_payload = join_response.json()
    assert join_payload["status"] == "pending"
    assert "message" in join_payload and join_payload["message"]
