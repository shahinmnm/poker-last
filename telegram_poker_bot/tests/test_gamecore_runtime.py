import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from telegram_poker_bot.game_core import runtime
from telegram_poker_bot.shared.models import Base, User
from telegram_poker_bot.shared.services import table_service

pytest.importorskip("aiosqlite")


@pytest_asyncio.fixture
async def db_session() -> AsyncSession:
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    async with session_factory() as session:
        yield session
        await session.rollback()

    await engine.dispose()
    runtime.reset_runtime_cache()


@pytest.mark.asyncio
async def test_public_table_runtime_bootstrap(db_session: AsyncSession) -> None:
    creator = User(tg_user_id=1001, language="en")
    guest = User(tg_user_id=1002, language="en")
    db_session.add_all([creator, guest])
    await db_session.flush()

    table = await table_service.create_table_with_config(
        db_session,
        creator_user_id=creator.id,
        is_private=False,
        auto_seat_creator=False,
    )

    snapshot = await runtime.get_table_runtime(db_session, table.id)
    assert snapshot.table_id == table.id
    assert snapshot.visibility == "public"
    assert snapshot.engine is None
    assert snapshot.seats == []

    await table_service.seat_user_at_table(db_session, table.id, creator.id)
    snapshot_after_host = await runtime.get_table_runtime(db_session, table.id)
    assert len(snapshot_after_host.seats) == 1
    assert snapshot_after_host.engine is None

    await table_service.seat_user_at_table(db_session, table.id, guest.id)
    snapshot_after_guest = await runtime.get_table_runtime(db_session, table.id)
    assert len(snapshot_after_guest.seats) == 2
    assert snapshot_after_guest.engine is not None
    assert snapshot_after_guest.engine.player_count == 2


@pytest.mark.asyncio
async def test_private_table_runtime_visibility(db_session: AsyncSession) -> None:
    creator = User(tg_user_id=2001, language="en")
    db_session.add(creator)
    await db_session.flush()

    table = await table_service.create_table_with_config(
        db_session,
        creator_user_id=creator.id,
        is_private=True,
        auto_seat_creator=False,
    )

    snapshot = await runtime.get_table_runtime(db_session, table.id)
    assert snapshot.visibility == "private"
    assert snapshot.engine is None
    assert snapshot.max_players == table.config_json.get("max_players", 8)
