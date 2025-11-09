"""Telegram bot service - webhook handler and command router."""

import asyncio
from typing import Optional

from fastapi import FastAPI, Request, Response, Header, HTTPException, status
from telegram import Update, Bot
from telegram.ext import Application, CommandHandler, CallbackQueryHandler, MessageHandler, filters

from telegram_poker_bot.shared.config import get_settings
from telegram_poker_bot.shared.logging import configure_logging, get_logger
from telegram_poker_bot.bot.handlers import (
    start_handler,
    language_handler,
    help_handler,
    stats_handler,
    settings_handler,
    callback_query_handler,
)
from telegram_poker_bot.bot.webhook import verify_webhook_secret

settings = get_settings()
configure_logging()
logger = get_logger(__name__)

# Reusable Telegram Bot client
bot_client = Bot(settings.telegram_bot_token)

# Create FastAPI app for webhook
app = FastAPI(title="Telegram Poker Bot Webhook")


@app.post("/telegram/webhook")
async def telegram_webhook(
    request: Request,
    x_telegram_bot_api_secret_token: Optional[str] = Header(None),
):
    """
    Telegram webhook endpoint.
    
    Design Note:
    - Verifies webhook secret token from Nginx
    - Processes updates asynchronously
    - Returns 200 immediately to Telegram
    """
    # Verify webhook secret
    if settings.webhook_secret_token:
        if not verify_webhook_secret(x_telegram_bot_api_secret_token, settings.webhook_secret_token):
            logger.warning("Invalid webhook secret token")
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
        # Initialize bot application
        application = Application.builder().token(settings.telegram_bot_token).build()
        
        # Register handlers
        application.add_handler(CommandHandler("start", start_handler))
        application.add_handler(CommandHandler("language", language_handler))
        application.add_handler(CommandHandler("help", help_handler))
        application.add_handler(CommandHandler("stats", stats_handler))
        application.add_handler(CommandHandler("settings", settings_handler))
        application.add_handler(CallbackQueryHandler(callback_query_handler))
        
        # Process update
        await application.process_update(update)
        
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
    await configure_telegram_webhook()


@app.on_event("shutdown")
async def on_shutdown():
    """FastAPI shutdown hook to close the Telegram bot session."""
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
