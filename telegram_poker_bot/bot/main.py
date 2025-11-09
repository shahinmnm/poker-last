"""Telegram bot service - webhook handler and command router."""

import asyncio
import hmac
import hashlib
from typing import Optional

from fastapi import FastAPI, Request, Response, Header, HTTPException, status
from fastapi.responses import JSONResponse
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
    update = Update.de_json(update_data, Bot(settings.telegram_bot_token))
    
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


if __name__ == "__main__":
    import uvicorn
    
    uvicorn.run(
        app,
        host=settings.webhook_bind_host,
        port=settings.webhook_bind_port,
    )
