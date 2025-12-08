"""Telegram bot service - webhook handler and command router."""

import asyncio
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, Request, Response, Header, HTTPException, status
from telegram import BotCommand, Update
from telegram.ext import Application, CommandHandler
from telegram.error import NetworkError

from telegram_poker_bot.shared.config import get_settings
from telegram_poker_bot.shared.logging import configure_logging, get_logger
from telegram_poker_bot.bot.handlers import start_group_handler
from telegram_poker_bot.bot.handlers.admin import register_admin_handlers
from telegram_poker_bot.bot.handlers.user_menu import register_user_handlers
from telegram_poker_bot.bot.handlers.registry import register_new_handlers
from telegram_poker_bot.bot.middlewares.error import error_handler
from telegram_poker_bot.bot.webhook import verify_webhook_secret

settings = get_settings()
configure_logging()
logger = get_logger(__name__)

# Global Telegram application and bot client reused for all updates
bot_application = Application.builder().token(settings.telegram_bot_token).build()
bot_client = bot_application.bot

# Register command/callback handlers once during module import
register_user_handlers(bot_application)
register_admin_handlers(bot_application)
register_new_handlers(bot_application)  # New Phase 1.4 handlers
bot_application.add_handler(CommandHandler("startgroup", start_group_handler))

# Register error handler
bot_application.add_error_handler(error_handler)

async def retry_with_backoff(coro_func, max_retries=5, initial_delay=1, max_delay=30, operation_name="operation"):
    """Retry an async operation with exponential backoff.
    
    Args:
        coro_func: Async function to retry
        max_retries: Maximum number of retry attempts
        initial_delay: Initial delay in seconds
        max_delay: Maximum delay between retries in seconds
        operation_name: Name of the operation for logging
    
    Returns:
        Result of the coroutine function
    
    Raises:
        The last exception encountered if all retries fail
    """
    delay = initial_delay
    last_exception = None
    
    for attempt in range(max_retries + 1):
        try:
            return await coro_func()
        except Exception as exc:
            last_exception = exc
            if attempt < max_retries:
                logger.warning(
                    f"Failed to {operation_name}, retrying",
                    attempt=attempt + 1,
                    max_retries=max_retries,
                    delay=delay,
                    error=str(exc),
                )
                await asyncio.sleep(delay)
                delay = min(delay * 2, max_delay)
            else:
                logger.error(
                    f"Failed to {operation_name} after all retries",
                    attempts=max_retries + 1,
                    error=str(exc),
                )
                raise
    
    # This should never be reached, but for type safety
    if last_exception:
        raise last_exception


# Create FastAPI app for webhook
@asynccontextmanager
async def lifespan(app: FastAPI):  # pragma: no cover - exercised in integration/runtime
    """Manage startup and shutdown lifecycle for the FastAPI application."""

    try:
        await retry_with_backoff(
            bot_application.initialize,
            max_retries=5,
            initial_delay=2,
            max_delay=30,
            operation_name="initialize Telegram bot",
        )
        await bot_application.start()
        bot_ready.set()
        await configure_bot_commands()
    except Exception as exc:
        logger.error("Failed to start Telegram bot application", error=str(exc))
        bot_ready.clear()
        raise

    await retry_with_backoff(
        configure_telegram_webhook,
        max_retries=3,
        initial_delay=1,
        max_delay=10,
        operation_name="configure Telegram webhook",
    )

    try:
        yield
    finally:
        bot_ready.clear()
        try:
            await bot_application.stop()
        except Exception as exc:  # pragma: no cover - best-effort cleanup
            logger.warning("Failed to stop Telegram application cleanly", error=str(exc))

        try:
            await bot_application.shutdown()
        except Exception as exc:  # pragma: no cover - best-effort cleanup
            logger.warning("Failed to shutdown Telegram application cleanly", error=str(exc))

        close_method = getattr(bot_client, "close", None)
        if callable(close_method):
            try:
                await close_method()  # type: ignore[misc]
            except Exception as exc:  # pragma: no cover - best-effort cleanup
                logger.warning("Failed to close Telegram bot session cleanly", error=str(exc))


app = FastAPI(title="Telegram Poker Bot Webhook", lifespan=lifespan)

bot_ready = asyncio.Event()


async def configure_bot_commands():
    """Register bot command list."""
    commands = [
        BotCommand("start", "Main Menu"),
        BotCommand("menu", "Show Main Menu"),
        BotCommand("lobby", "Browse Active Tables"),
        BotCommand("profile", "View Profile"),
        BotCommand("stats", "View Statistics"),
        BotCommand("language", "Change Language"),
        BotCommand("invite", "Get Invite Link"),
        BotCommand("help", "Help & Commands"),
        BotCommand("wallet", "Open wallet"),
        BotCommand("support", "Contact support"),
    ]
    try:
        await bot_client.set_my_commands(commands)
    except Exception as exc:  # pragma: no cover - best effort
        logger.warning("Failed to set bot commands", error=str(exc))


@app.post("/telegram/webhook")
async def telegram_webhook(
    request: Request,
    x_telegram_bot_api_secret_token: Optional[str] = Header(None),
):
    """Handle incoming Telegram webhook updates."""
    secret_token = x_telegram_bot_api_secret_token
    expected_secret = settings.telegram_webhook_secret_token or settings.webhook_secret_token

    token_valid = False
    if secret_token and expected_secret:
        token_valid = verify_webhook_secret(secret_token, expected_secret)

    if not token_valid:
        logger.warning(
            "Invalid webhook secret token",
            received=bool(secret_token),
        )
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid secret token")
    
    # Parse update
    update_data = await request.json()
    update = Update.de_json(update_data, bot_client)
    
    # Process update asynchronously
    asyncio.create_task(process_update(update))
    
    return Response(status_code=200)


async def process_update(update: Update):
    """Process Telegram update."""
    try:
        await bot_ready.wait()
        await bot_application.process_update(update)
    except Exception as e:
        logger.error("Error processing update", exc_info=e)


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "ok"}


async def configure_telegram_webhook():
    """Ensure Telegram webhook matches the configured PUBLIC_BASE_URL."""
    webhook_url = settings.webhook_url
    secret_token = settings.telegram_webhook_secret_token or settings.webhook_secret_token

    if not secret_token:
        logger.warning(
            "Telegram webhook secret token is not configured; requests cannot be verified via secret token",
            webhook_url=webhook_url,
        )

    kwargs = {"url": webhook_url}
    if secret_token:
        kwargs["secret_token"] = secret_token

    webhook_info = None
    try:
        webhook_info = await bot_client.get_webhook_info()
    except Exception as exc:  # pragma: no cover - network failure path
        logger.warning("Unable to fetch current Telegram webhook info", error=str(exc))

    needs_update = True
    previous_url = None
    if webhook_info:
        previous_url = webhook_info.url or None
        needs_update = webhook_info.url != webhook_url

    if needs_update or secret_token:
        try:
            await bot_client.set_webhook(**kwargs)
            logger.info(
                "Telegram webhook configured",
                webhook_url=webhook_url,
                previous_url=previous_url,
            )
        except Exception as exc:
            logger.error(
                "Failed to configure Telegram webhook",
                webhook_url=webhook_url,
                error=str(exc),
            )
            raise
    else:
        logger.info("Telegram webhook already points to configured domain", webhook_url=webhook_url)


if __name__ == "__main__":
    import uvicorn
    
    uvicorn.run(
        app,
        host=settings.webhook_bind_host,
        port=settings.webhook_bind_port,
    )
