"""Promo code lifecycle and redemption."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from telegram_poker_bot.shared.models import CurrencyType, PromoCode, TransactionType
from telegram_poker_bot.shared.services import wallet_service


async def create_promo_code(
    db: AsyncSession,
    *,
    code: str,
    amount: int,
    currency_type: CurrencyType = CurrencyType.REAL,
    max_uses: int = 1,
    expiry_date: Optional[datetime] = None,
) -> PromoCode:
    """Create a promo code definition."""
    normalized_code = code.strip()
    promo = PromoCode(
        code=normalized_code,
        amount=amount,
        currency_type=currency_type,
        max_uses=max_uses,
        expiry_date=expiry_date,
    )
    db.add(promo)
    await db.flush()
    return promo


async def redeem_promo_code(
    db: AsyncSession, *, user_id: int, code: str
) -> tuple[bool, str, int]:
    """Redeem a promo code and credit the user's wallet."""
    normalized = code.strip()
    result = await db.execute(
        select(PromoCode).where(PromoCode.code == normalized).with_for_update()
    )
    promo = result.scalar_one_or_none()
    if not promo:
        return False, "Invalid code.", 0

    now = datetime.now(timezone.utc)
    if promo.expiry_date and promo.expiry_date <= now:
        return False, "Code expired.", 0

    if promo.current_uses >= promo.max_uses:
        return False, "Code usage limit reached.", 0

    await wallet_service.ensure_wallet(db, user_id)
    await wallet_service.adjust_balance(
        db,
        user_id=user_id,
        amount=promo.amount,
        currency_type=promo.currency_type,
        transaction_type=TransactionType.DEPOSIT,
        metadata={"promo_code": promo.code},
    )
    promo.current_uses += 1
    await db.flush()
    return True, promo.code, promo.amount
