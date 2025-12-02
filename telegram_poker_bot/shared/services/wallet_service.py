"""Wallet service with atomic operations and row-level locking."""

from __future__ import annotations

from typing import Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from telegram_poker_bot.shared.config import get_settings
from telegram_poker_bot.shared.logging import get_logger
from telegram_poker_bot.shared.models import (
    CurrencyType,
    Transaction,
    TransactionType,
    User,
)

logger = get_logger(__name__)
settings = get_settings()

# Default play balance (in cents/chips) for new users
DEFAULT_PLAY_BALANCE = 100_000


async def ensure_wallet(db: AsyncSession, user_id: int) -> User:
    """
    Ensure user balances are initialized.

    Uses row-level locking to safely initialize missing balance fields.
    """
    result = await db.execute(
        select(User).where(User.id == user_id).with_for_update()
    )
    user = result.scalar_one_or_none()
    if not user:
        raise ValueError(f"User {user_id} not found")

    updated = False
    if user.balance_real is None:
        user.balance_real = settings.initial_balance_cents
        updated = True
    if user.balance_play is None:
        user.balance_play = DEFAULT_PLAY_BALANCE
        updated = True

    if updated:
        await db.flush()
        logger.info(
            "Initialized user balances",
            user_id=user_id,
            balance_real=user.balance_real,
            balance_play=user.balance_play,
        )

    return user


async def get_balance(
    db: AsyncSession, user_id: int, currency_type: CurrencyType
) -> int:
    """Return the user's balance for the specified currency."""
    user = await ensure_wallet(db, user_id)
    if currency_type == CurrencyType.PLAY:
        return user.balance_play
    return user.balance_real


async def get_balances(db: AsyncSession, user_id: int) -> dict[str, int]:
    """Return both balances for the user."""
    user = await ensure_wallet(db, user_id)
    return {
        "balance_real": user.balance_real,
        "balance_play": user.balance_play,
    }


async def get_wallet_balance(
    db: AsyncSession, user_id: int, currency_type: CurrencyType = CurrencyType.REAL
) -> int:
    """Backward-compatible helper returning a single balance (default REAL)."""
    return await get_balance(db, user_id, currency_type)


def _get_balance_field(currency_type: CurrencyType) -> str:
    return "balance_play" if currency_type == CurrencyType.PLAY else "balance_real"


async def process_buy_in(
    db: AsyncSession,
    user_id: int,
    amount: int,
    currency_type: CurrencyType,
    *,
    table_id: int,
    reference_id: Optional[str] = None,
) -> bool:
    """
    Deduct buy-in from the user's wallet with row-level locking.
    """
    if amount <= 0:
        raise ValueError(f"Buy-in amount must be positive, got {amount}")

    user = await ensure_wallet(db, user_id)
    balance_field = _get_balance_field(currency_type)
    current_balance = getattr(user, balance_field)

    if current_balance < amount:
        logger.warning(
            "Insufficient balance for buy-in",
            user_id=user_id,
            balance=current_balance,
            amount=amount,
            currency_type=currency_type.value,
            table_id=table_id,
        )
        return False

    new_balance = current_balance - amount
    setattr(user, balance_field, new_balance)

    transaction = Transaction(
        user_id=user_id,
        amount=-amount,
        balance_after=new_balance,
        type=TransactionType.BUY_IN,
        table_id=table_id,
        reference_id=reference_id or f"table_{table_id}",
        metadata_json={"table_id": table_id},
        currency_type=currency_type,
    )
    db.add(transaction)

    logger.info(
        "Processed buy-in",
        user_id=user_id,
        amount=amount,
        currency_type=currency_type.value,
        balance_after=new_balance,
        table_id=table_id,
    )
    return True


async def process_cash_out(
    db: AsyncSession,
    user_id: int,
    amount: int,
    currency_type: CurrencyType,
    *,
    table_id: int,
    reference_id: Optional[str] = None,
) -> bool:
    """
    Credit cash-out/winnings back to the appropriate wallet with locking.
    """
    if amount < 0:
        raise ValueError(f"Cash-out amount must be non-negative, got {amount}")
    if amount == 0:
        logger.info("Cash-out amount is zero, skipping", user_id=user_id)
        return True

    user = await ensure_wallet(db, user_id)
    balance_field = _get_balance_field(currency_type)
    current_balance = getattr(user, balance_field)
    new_balance = current_balance + amount
    setattr(user, balance_field, new_balance)

    transaction = Transaction(
        user_id=user_id,
        amount=amount,
        balance_after=new_balance,
        type=TransactionType.CASH_OUT,
        table_id=table_id,
        reference_id=reference_id or f"table_{table_id}",
        metadata_json={"table_id": table_id},
        currency_type=currency_type,
    )
    db.add(transaction)

    logger.info(
        "Processed cash-out",
        user_id=user_id,
        amount=amount,
        currency_type=currency_type.value,
        balance_after=new_balance,
        table_id=table_id,
    )
    return True


async def record_game_win(
    db: AsyncSession,
    user_id: int,
    amount: int,
    hand_id: int,
    table_id: int,
    currency_type: CurrencyType,
    reference_id: Optional[str] = None,
) -> None:
    """Record a game win and update wallet with correct currency."""
    if amount <= 0:
        logger.warning(
            "Game win amount must be positive, skipping", user_id=user_id, amount=amount
        )
        return

    user = await ensure_wallet(db, user_id)
    balance_field = _get_balance_field(currency_type)
    new_balance = getattr(user, balance_field) + amount
    setattr(user, balance_field, new_balance)

    transaction = Transaction(
        user_id=user_id,
        amount=amount,
        balance_after=new_balance,
        type=TransactionType.GAME_WIN,
        hand_id=hand_id,
        table_id=table_id,
        reference_id=reference_id or f"hand_{hand_id}",
        metadata_json={"hand_id": hand_id, "table_id": table_id},
        currency_type=currency_type,
    )
    db.add(transaction)

    logger.info(
        "Recorded game win",
        user_id=user_id,
        amount=amount,
        hand_id=hand_id,
        balance_after=new_balance,
        currency_type=currency_type.value,
    )


async def record_rake(
    db: AsyncSession,
    amount: int,
    hand_id: int,
    table_id: int,
    currency_type: CurrencyType,
    reference_id: Optional[str] = None,
) -> None:
    """Record a rake (system transaction) with currency context."""
    if amount <= 0:
        logger.warning("Rake amount must be positive, skipping", amount=amount)
        return

    transaction = Transaction(
        user_id=None,
        amount=amount,
        balance_after=0,
        type=TransactionType.RAKE,
        hand_id=hand_id,
        table_id=table_id,
        reference_id=reference_id or f"hand_{hand_id}",
        metadata_json={"hand_id": hand_id, "table_id": table_id},
        currency_type=currency_type,
    )
    db.add(transaction)

    logger.info(
        "Recorded rake",
        amount=amount,
        hand_id=hand_id,
        table_id=table_id,
        currency_type=currency_type.value,
    )


async def get_transaction_history(
    db: AsyncSession,
    user_id: int,
    limit: int = 50,
    offset: int = 0,
) -> list[Transaction]:
    """Get user's transaction history ordered by most recent."""
    result = await db.execute(
        select(Transaction)
        .where(Transaction.user_id == user_id)
        .order_by(Transaction.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    transactions = result.scalars().all()
    return list(transactions)
