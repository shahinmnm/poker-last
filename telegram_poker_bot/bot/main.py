"""Telegram bot service - webhook handler and command router."""

import asyncio
from typing import Optional

from fastapi import FastAPI, Request, Response, Header, HTTPException, status
from telegram import Update
from telegram.ext import Application, CommandHandler, CallbackQueryHandler

from telegram_poker_bot.shared.config import get_settings
from telegram_poker_bot.shared.logging import configure_logging, get_logger
from telegram_poker_bot.bot.handlers import (
    start_handler,
    start_group_handler,
    language_handler,
    help_handler,
    stats_handler,
    settings_handler,
    callback_query_handler,
    profile_handler,
    tables_handler,
    wallet_handler,
)
from telegram_poker_bot.bot.webhook import verify_webhook_secret

settings = get_settings()
configure_logging()
logger = get_logger(__name__)

# Global Telegram application and bot client reused for all updates
bot_application = Application.builder().token(settings.telegram_bot_token).build()
bot_client = bot_application.bot

# Register command/callback handlers once during module import
bot_application.add_handler(CommandHandler("start", start_handler))
bot_application.add_handler(CommandHandler("startgroup", start_group_handler))
bot_application.add_handler(CommandHandler("profile", profile_handler))
bot_application.add_handler(CommandHandler("tables", tables_handler))
bot_application.add_handler(CommandHandler("wallet", wallet_handler))
bot_application.add_handler(CommandHandler("language", language_handler))
bot_application.add_handler(CommandHandler("help", help_handler))
bot_application.add_handler(CommandHandler("stats", stats_handler))
bot_application.add_handler(CommandHandler("settings", settings_handler))
bot_application.add_handler(CallbackQueryHandler(callback_query_handler))

# Create FastAPI app for webhook
app = FastAPI(title="Telegram Poker Bot Webhook")

bot_ready = asyncio.Event()


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


@app.on_event("startup")
async def on_startup():
    """FastAPI startup hook to configure Telegram webhook."""
    try:
        await bot_application.initialize()
        await bot_application.start()
        bot_ready.set()
    except Exception as exc:
        logger.error("Failed to start Telegram bot application", error=str(exc))
        bot_ready.clear()
        raise

    await configure_telegram_webhook()


@app.on_event("shutdown")
async def on_shutdown():
    """FastAPI shutdown hook to close the Telegram bot session."""
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


if __name__ == "__main__":
    import uvicorn
    
    uvicorn.run(
        app,
        host=settings.webhook_bind_host,
        port=settings.webhook_bind_port,
    )
