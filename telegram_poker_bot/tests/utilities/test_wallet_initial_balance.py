"""Tests for wallet service initial balance functionality."""

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker

from telegram_poker_bot.shared.models import Base, User, CurrencyType
from telegram_poker_bot.shared.services import wallet_service
from telegram_poker_bot.shared.config import get_settings


@pytest_asyncio.fixture
async def db_session():
    """Create test database session."""
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async_session = async_sessionmaker(engine, expire_on_commit=False)
    async with async_session() as session:
        yield session
        await session.rollback()

    await engine.dispose()


@pytest_asyncio.fixture
async def test_user(db_session: AsyncSession):
    """Create a test user."""
    user = User(tg_user_id=12345, username="testuser")
    db_session.add(user)
    await db_session.flush()
    return user


@pytest.mark.asyncio
async def test_ensure_wallet_creates_with_initial_balance(
    db_session: AsyncSession, test_user: User
):
    """Test that ensure_wallet creates a wallet with initial balance from settings."""
    settings = get_settings()

    # Ensure wallet doesn't exist yet
    wallet = await wallet_service.ensure_wallet(db_session, test_user.id)
    await db_session.commit()

    # Verify wallet was created with correct initial balance
    assert wallet is not None
    assert wallet.id == test_user.id
    assert wallet.balance_real == settings.initial_balance_cents
    assert wallet.balance_play == 100000  # default play balance


@pytest.mark.asyncio
async def test_ensure_wallet_returns_existing_wallet(
    db_session: AsyncSession, test_user: User
):
    """Test that ensure_wallet returns existing wallet without changing balance."""
    # Set custom balances
    test_user.balance_real = 50000
    test_user.balance_play = 75000
    await db_session.flush()

    # Call ensure_wallet
    wallet = await wallet_service.ensure_wallet(db_session, test_user.id)
    await db_session.commit()

    # Verify existing wallet is returned unchanged
    assert wallet.id == test_user.id
    assert wallet.balance_real == 50000  # Should not change
    assert wallet.balance_play == 75000


@pytest.mark.asyncio
async def test_get_wallet_balance_for_new_user(
    db_session: AsyncSession, test_user: User
):
    """Test getting wallet balance for a user without a wallet creates one."""
    settings = get_settings()

    # Get balance (should create wallet)
    balance = await wallet_service.get_wallet_balance(
        db_session, test_user.id, CurrencyType.REAL
    )
    play_balance = await wallet_service.get_wallet_balance(
        db_session, test_user.id, CurrencyType.PLAY
    )
    await db_session.commit()

    # Verify balance matches initial balance from settings
    assert balance == settings.initial_balance_cents
    assert play_balance == 100000  # Default play balance


@pytest.mark.asyncio
async def test_process_buy_in_uses_correct_balance(
    db_session: AsyncSession, test_user: User
):
    """Test that process_buy_in creates balances and deducts buy-in."""
    settings = get_settings()

    # Try to transfer amount less than initial balance
    success = await wallet_service.process_buy_in(
        db_session,
        user_id=test_user.id,
        amount=5000,
        currency_type=CurrencyType.REAL,
        table_id=1,
    )
    await db_session.commit()

    # Should succeed because wallet is created with initial balance
    assert success is True

    # Verify wallet was created and balance deducted
    balance = await wallet_service.get_wallet_balance(
        db_session, test_user.id, CurrencyType.REAL
    )
    assert balance == settings.initial_balance_cents - 5000
    assert balance == 5000  # 10000 - 5000


@pytest.mark.asyncio
async def test_process_cash_out_credits_balance(
    db_session: AsyncSession, test_user: User
):
    """Test that cash_out creates balances and credits amount."""
    settings = get_settings()

    # Cash out to a new wallet
    success = await wallet_service.process_cash_out(
        db_session,
        user_id=test_user.id,
        amount=3000,
        currency_type=CurrencyType.REAL,
        table_id=1,
    )
    await db_session.commit()

    # Should succeed
    assert success is True

    # Verify wallet was created with initial balance plus cashed out amount
    balance = await wallet_service.get_wallet_balance(
        db_session, test_user.id, CurrencyType.REAL
    )
    assert balance == settings.initial_balance_cents + 3000
    assert balance == 13000  # 10000 + 3000


@pytest.mark.asyncio
async def test_record_game_win_creates_wallet_with_initial_balance(
    db_session: AsyncSession, test_user: User
):
    """Test that record_game_win creates wallet with initial balance if it doesn't exist."""
    settings = get_settings()

    # Record a game win
    await wallet_service.record_game_win(
        db_session,
        test_user.id,
        2000,
        hand_id=1,
        table_id=1,
        currency_type=CurrencyType.REAL,
    )
    await db_session.commit()

    # Verify wallet was created with initial balance plus winnings
    balance = await wallet_service.get_wallet_balance(
        db_session, test_user.id, CurrencyType.REAL
    )
    assert balance == settings.initial_balance_cents + 2000
    assert balance == 12000  # 10000 + 2000
