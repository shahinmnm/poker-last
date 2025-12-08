"""Test bot initialization retry logic."""

import asyncio
from unittest.mock import AsyncMock, patch
import pytest
from telegram.error import NetworkError


@pytest.mark.asyncio
async def test_retry_with_backoff_succeeds_on_first_try():
    """Test that retry_with_backoff succeeds immediately when operation works."""
    from telegram_poker_bot.bot.main import retry_with_backoff
    
    mock_func = AsyncMock(return_value="success")
    
    result = await retry_with_backoff(
        mock_func,
        max_retries=3,
        initial_delay=0.01,
        operation_name="test operation"
    )
    
    assert result == "success"
    assert mock_func.call_count == 1


@pytest.mark.asyncio
async def test_retry_with_backoff_retries_on_network_error():
    """Test that retry_with_backoff retries on NetworkError."""
    from telegram_poker_bot.bot.main import retry_with_backoff
    
    mock_func = AsyncMock()
    # Fail twice, then succeed
    mock_func.side_effect = [
        NetworkError("Connection failed"),
        NetworkError("Connection failed again"),
        "success"
    ]
    
    result = await retry_with_backoff(
        mock_func,
        max_retries=3,
        initial_delay=0.01,
        max_delay=0.05,
        operation_name="test operation"
    )
    
    assert result == "success"
    assert mock_func.call_count == 3


@pytest.mark.asyncio
async def test_retry_with_backoff_retries_on_os_error():
    """Test that retry_with_backoff retries on OSError."""
    from telegram_poker_bot.bot.main import retry_with_backoff
    
    mock_func = AsyncMock()
    # Fail once with OSError, then succeed
    mock_func.side_effect = [
        OSError("Network unreachable"),
        "success"
    ]
    
    result = await retry_with_backoff(
        mock_func,
        max_retries=3,
        initial_delay=0.01,
        operation_name="test operation"
    )
    
    assert result == "success"
    assert mock_func.call_count == 2


@pytest.mark.asyncio
async def test_retry_with_backoff_fails_after_max_retries():
    """Test that retry_with_backoff raises exception after max retries."""
    from telegram_poker_bot.bot.main import retry_with_backoff
    
    mock_func = AsyncMock()
    mock_func.side_effect = NetworkError("Persistent connection error")
    
    with pytest.raises(NetworkError, match="Persistent connection error"):
        await retry_with_backoff(
            mock_func,
            max_retries=2,
            initial_delay=0.01,
            operation_name="test operation"
        )
    
    # Should try 3 times total (initial + 2 retries)
    assert mock_func.call_count == 3


@pytest.mark.asyncio
async def test_retry_with_backoff_exponential_delay():
    """Test that retry_with_backoff uses exponential backoff."""
    from telegram_poker_bot.bot.main import retry_with_backoff
    
    mock_func = AsyncMock()
    mock_func.side_effect = [
        NetworkError("Fail 1"),
        NetworkError("Fail 2"),
        "success"
    ]
    
    start_time = asyncio.get_event_loop().time()
    
    await retry_with_backoff(
        mock_func,
        max_retries=3,
        initial_delay=0.1,
        max_delay=1.0,
        operation_name="test operation"
    )
    
    elapsed = asyncio.get_event_loop().time() - start_time
    
    # Should wait at least 0.1 + 0.2 = 0.3 seconds
    # (first retry at 0.1s, second retry at 0.2s)
    assert elapsed >= 0.3
    assert mock_func.call_count == 3


@pytest.mark.asyncio
async def test_bot_initialization_with_retry(monkeypatch):
    """Test that bot initialization uses retry logic."""
    import importlib
    import sys
    from types import SimpleNamespace
    from telegram_poker_bot.shared import config
    
    # Set up test environment
    env = {
        "TELEGRAM_BOT_TOKEN": "TEST_TOKEN",
        "PUBLIC_BASE_URL": "https://example.com",
        "TELEGRAM_WEBHOOK_SECRET_TOKEN": "hook-secret",
    }
    for key, value in env.items():
        monkeypatch.setenv(key, value)
    
    config.get_settings.cache_clear()
    
    # Reload the module to get fresh instance
    sys.modules.pop("telegram_poker_bot.bot.main", None)
    module = importlib.import_module("telegram_poker_bot.bot.main")
    
    # Mock the bot application methods
    mock_initialize = AsyncMock()
    mock_initialize.side_effect = [
        NetworkError("Connection failed"),
        None  # Success on second try
    ]
    
    monkeypatch.setattr(module.bot_application, "initialize", mock_initialize)
    monkeypatch.setattr(module.bot_application, "start", AsyncMock())
    monkeypatch.setattr(module.bot_application, "stop", AsyncMock())
    monkeypatch.setattr(module.bot_application, "shutdown", AsyncMock())
    
    # Mock webhook configuration using class attribute patching
    mock_get_webhook_info = AsyncMock(return_value=SimpleNamespace(url=None))
    mock_set_webhook = AsyncMock(return_value=True)
    mock_set_my_commands = AsyncMock(return_value=True)
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
        "set_my_commands",
        mock_set_my_commands,
        raising=True,
    )
    monkeypatch.setattr(
        module.bot_client.__class__,
        "close",
        mock_close,
        raising=True,
    )
    
    # Test the lifespan context
    async with module.app.router.lifespan_context(module.app):
        # Bot should have initialized successfully after retry
        assert module.bot_ready.is_set()
    
    # Verify initialize was called twice (failed once, then succeeded)
    assert mock_initialize.call_count == 2
    
    # Cleanup
    module.bot_ready.clear()
    config.get_settings.cache_clear()
