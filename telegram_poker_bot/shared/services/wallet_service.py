"""Wallet service with atomic operations and row-level locking."""

from __future__ import annotations

from typing import Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from telegram_poker_bot.shared.logging import get_logger
from telegram_poker_bot.shared.models import (
    Wallet,
    Transaction,
    TransactionType,
)

logger = get_logger(__name__)


async def ensure_wallet(db: AsyncSession, user_id: int) -> Wallet:
    """
    Ensure a wallet exists for a user.

    Creates a wallet if it doesn't exist.

    Args:
        db: Database session
        user_id: User ID

    Returns:
        Wallet instance
    """
    result = await db.execute(select(Wallet).where(Wallet.user_id == user_id))
    wallet = result.scalar_one_or_none()

    if not wallet:
        wallet = Wallet(user_id=user_id, balance=0)
        db.add(wallet)
        await db.flush()
        logger.info("Created wallet for user", user_id=user_id)

    return wallet


async def get_wallet_balance(db: AsyncSession, user_id: int) -> int:
    """
    Get user's wallet balance.

    Args:
        db: Database session
        user_id: User ID

    Returns:
        Balance in smallest currency unit (e.g., cents)
    """
    wallet = await ensure_wallet(db, user_id)
    return wallet.balance


async def transfer_to_table(
    db: AsyncSession,
    user_id: int,
    amount: int,
    table_id: int,
    reference_id: Optional[str] = None,
) -> bool:
    """
    Transfer chips from user wallet to table (Buy-in).

    Uses row-level locking to prevent race conditions.
    Creates a transaction record in the ledger.

    Args:
        db: Database session
        user_id: User ID
        amount: Amount to transfer (in smallest units, must be positive)
        table_id: Table ID
        reference_id: Optional reference (e.g., "hand_123")

    Returns:
        True if successful, False if insufficient balance

    Raises:
        ValueError: If amount is not positive
    """
    if amount <= 0:
        raise ValueError(f"Transfer amount must be positive, got {amount}")

    # Lock the wallet row to prevent concurrent modifications
    result = await db.execute(
        select(Wallet)
        .where(Wallet.user_id == user_id)
        .with_for_update()  # Row-level lock
    )
    wallet = result.scalar_one_or_none()

    if not wallet:
        wallet = Wallet(user_id=user_id, balance=0)
        db.add(wallet)
        await db.flush()

    # Check sufficient balance
    if wallet.balance < amount:
        logger.warning(
            "Insufficient balance for transfer to table",
            user_id=user_id,
            wallet_balance=wallet.balance,
            amount=amount,
            table_id=table_id,
        )
        return False

    # Deduct from wallet
    wallet.balance -= amount
    balance_after = wallet.balance

    # Create transaction record
    transaction = Transaction(
        user_id=user_id,
        amount=-amount,  # Negative because money is leaving wallet
        balance_after=balance_after,
        type=TransactionType.BUY_IN,
        reference_id=reference_id or f"table_{table_id}",
        metadata_json={"table_id": table_id},
    )
    db.add(transaction)

    logger.info(
        "Transferred chips to table",
        user_id=user_id,
        amount=amount,
        table_id=table_id,
        balance_after=balance_after,
    )

    return True


async def cash_out_from_table(
    db: AsyncSession,
    user_id: int,
    amount: int,
    table_id: int,
    reference_id: Optional[str] = None,
) -> bool:
    """
    Cash out chips from table to user wallet.

    Uses row-level locking to prevent race conditions.
    Creates a transaction record in the ledger.

    Args:
        db: Database session
        user_id: User ID
        amount: Amount to cash out (in smallest units, must be non-negative)
        table_id: Table ID
        reference_id: Optional reference (e.g., "hand_123")

    Returns:
        True if successful

    Raises:
        ValueError: If amount is negative
    """
    if amount < 0:
        raise ValueError(f"Cash out amount must be non-negative, got {amount}")

    if amount == 0:
        logger.info(
            "Cash out amount is zero, skipping", user_id=user_id, table_id=table_id
        )
        return True

    # Lock the wallet row to prevent concurrent modifications
    result = await db.execute(
        select(Wallet)
        .where(Wallet.user_id == user_id)
        .with_for_update()  # Row-level lock
    )
    wallet = result.scalar_one_or_none()

    if not wallet:
        wallet = Wallet(user_id=user_id, balance=0)
        db.add(wallet)
        await db.flush()

    # Add to wallet
    wallet.balance += amount
    balance_after = wallet.balance

    # Create transaction record
    transaction = Transaction(
        user_id=user_id,
        amount=amount,  # Positive because money is entering wallet
        balance_after=balance_after,
        type=TransactionType.CASH_OUT,
        reference_id=reference_id or f"table_{table_id}",
        metadata_json={"table_id": table_id},
    )
    db.add(transaction)

    logger.info(
        "Cashed out chips from table",
        user_id=user_id,
        amount=amount,
        table_id=table_id,
        balance_after=balance_after,
    )

    return True


async def record_game_win(
    db: AsyncSession,
    user_id: int,
    amount: int,
    hand_id: int,
    table_id: int,
    reference_id: Optional[str] = None,
) -> None:
    """
    Record a game win transaction.

    This function records a win in the transaction ledger and updates the wallet balance.

    Args:
        db: Database session
        user_id: User ID
        amount: Amount won (in smallest units, must be positive)
        hand_id: Hand ID
        table_id: Table ID
        reference_id: Optional reference
    """
    if amount <= 0:
        logger.warning(
            "Game win amount must be positive, skipping", user_id=user_id, amount=amount
        )
        return

    # Lock the wallet row
    result = await db.execute(
        select(Wallet).where(Wallet.user_id == user_id).with_for_update()
    )
    wallet = result.scalar_one_or_none()

    if not wallet:
        wallet = Wallet(user_id=user_id, balance=0)
        db.add(wallet)
        await db.flush()

    # Add winnings
    wallet.balance += amount
    balance_after = wallet.balance

    # Create transaction record
    transaction = Transaction(
        user_id=user_id,
        amount=amount,
        balance_after=balance_after,
        type=TransactionType.GAME_WIN,
        reference_id=reference_id or f"hand_{hand_id}",
        metadata_json={"hand_id": hand_id, "table_id": table_id},
    )
    db.add(transaction)

    logger.info(
        "Recorded game win",
        user_id=user_id,
        amount=amount,
        hand_id=hand_id,
        balance_after=balance_after,
    )


async def record_rake(
    db: AsyncSession,
    amount: int,
    hand_id: int,
    table_id: int,
    reference_id: Optional[str] = None,
) -> None:
    """
    Record a rake (commission) transaction.

    Rake transactions have no user_id (system transaction).
    The balance_after is set to 0 since rake is a system-level transaction
    and does not affect any user's wallet balance.

    Args:
        db: Database session
        amount: Rake amount (in smallest units, must be positive)
        hand_id: Hand ID
        table_id: Table ID
        reference_id: Optional reference
    """
    if amount <= 0:
        logger.warning("Rake amount must be positive, skipping", amount=amount)
        return

    # Create transaction record (no user_id for system rake)
    # balance_after=0 since this is a system transaction, not tied to user wallets
    transaction = Transaction(
        user_id=None,  # System transaction
        amount=amount,
        balance_after=0,  # Not applicable for system transactions
        type=TransactionType.RAKE,
        reference_id=reference_id or f"hand_{hand_id}",
        metadata_json={"hand_id": hand_id, "table_id": table_id},
    )
    db.add(transaction)

    logger.info(
        "Recorded rake",
        amount=amount,
        hand_id=hand_id,
        table_id=table_id,
    )


async def get_transaction_history(
    db: AsyncSession,
    user_id: int,
    limit: int = 50,
    offset: int = 0,
) -> list[Transaction]:
    """
    Get user's transaction history.

    Args:
        db: Database session
        user_id: User ID
        limit: Maximum number of transactions to return
        offset: Number of transactions to skip

    Returns:
        List of Transaction objects ordered by created_at desc
    """
    result = await db.execute(
        select(Transaction)
        .where(Transaction.user_id == user_id)
        .order_by(Transaction.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    transactions = result.scalars().all()

    return list(transactions)
