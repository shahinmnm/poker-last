"""Gatekeeper for table buy-ins with currency separation."""

from __future__ import annotations

from telegram_poker_bot.shared.logging import get_logger
from telegram_poker_bot.shared.models import CurrencyType, Table
from telegram_poker_bot.shared.services import wallet_service
from sqlalchemy.ext.asyncio import AsyncSession

logger = get_logger(__name__)


class TableBuyInService:
    """Validate and process table buy-ins before seating players."""

    @staticmethod
    async def reserve_buy_in(
        db: AsyncSession,
        *,
        table: Table,
        user_id: int,
        buy_in_amount: int,
        currency_type: CurrencyType | None = None,
    ) -> CurrencyType:
        """
        Check the correct wallet and deduct the buy-in atomically.

        Returns the currency_type used for downstream actions.
        """
        if buy_in_amount <= 0:
            raise ValueError("Buy-in amount must be positive")

        currency_type = currency_type or CurrencyType.REAL
        success = await wallet_service.process_buy_in(
            db,
            user_id=user_id,
            amount=buy_in_amount,
            currency_type=currency_type,
            table_id=table.id,
        )
        if not success:
            raise ValueError("Insufficient balance for buy-in")

        logger.info(
            "Reserved buy-in",
            table_id=table.id,
            user_id=user_id,
            amount=buy_in_amount,
            currency_type=currency_type.value,
        )

        return currency_type
