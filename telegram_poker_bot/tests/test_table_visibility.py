import pytest
import pytest_asyncio
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from telegram_poker_bot.shared.models import Base, User, Seat
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


@pytest.mark.asyncio
async def test_public_table_visible_to_non_creator(db_session: AsyncSession) -> None:
    creator = User(tg_user_id=111, language="en")
    other = User(tg_user_id=222, language="en")
    db_session.add_all([creator, other])
    await db_session.flush()

    table = await table_service.create_table_with_config(
        db_session,
        creator_user_id=creator.id,
        small_blind=10,
        big_blind=20,
        starting_stack=1000,
        max_players=6,
        is_private=False,
        auto_seat_creator=True,
    )

    tables_for_other = await table_service.list_available_tables(
        db_session, viewer_user_id=other.id
    )
    assert any(t["table_id"] == table.id for t in tables_for_other)

    tables_for_creator = await table_service.list_available_tables(
        db_session, viewer_user_id=creator.id
    )
    assert any(t["table_id"] == table.id for t in tables_for_creator)


@pytest.mark.asyncio
async def test_private_table_visibility_and_permissions(db_session: AsyncSession) -> None:
    creator = User(tg_user_id=333, language="en")
    guest = User(tg_user_id=444, language="en")
    db_session.add_all([creator, guest])
    await db_session.flush()

    private_table = await table_service.create_table_with_config(
        db_session,
        creator_user_id=creator.id,
        small_blind=25,
        big_blind=50,
        starting_stack=1500,
        max_players=6,
        is_private=True,
        auto_seat_creator=False,
    )

    tables_for_guest = await table_service.list_available_tables(
        db_session, viewer_user_id=guest.id
    )
    assert all(t["table_id"] != private_table.id for t in tables_for_guest)

    tables_for_creator = await table_service.list_available_tables(
        db_session, viewer_user_id=creator.id
    )
    assert any(t["table_id"] == private_table.id for t in tables_for_creator)

    info_for_creator = await table_service.get_table_info(
        db_session, private_table.id, viewer_user_id=creator.id
    )
    assert info_for_creator["permissions"]["can_join"] is True
    assert info_for_creator["permissions"]["can_leave"] is False

    await table_service.seat_user_at_table(db_session, private_table.id, creator.id)

    info_after_seat = await table_service.get_table_info(
        db_session, private_table.id, viewer_user_id=creator.id
    )
    assert info_after_seat["permissions"]["can_join"] is False
    assert info_after_seat["permissions"]["can_leave"] is True


@pytest.mark.asyncio
async def test_leave_table_allows_rejoin(db_session: AsyncSession) -> None:
    creator = User(tg_user_id=555, language="en")
    guest = User(tg_user_id=666, language="en")
    db_session.add_all([creator, guest])
    await db_session.flush()

    table = await table_service.create_table_with_config(
        db_session,
        creator_user_id=creator.id,
        is_private=False,
        auto_seat_creator=True,
    )

    await table_service.seat_user_at_table(db_session, table.id, guest.id)
    await table_service.leave_table(db_session, table.id, guest.id)

    seat_row = await db_session.execute(
        select(Seat).where(
            Seat.table_id == table.id,
            Seat.user_id == guest.id,
        )
    )
    seat = seat_row.scalar_one()
    assert seat.left_at is not None

    info_for_guest = await table_service.get_table_info(
        db_session, table.id, viewer_user_id=guest.id
    )
    assert info_for_guest["permissions"]["can_join"] is True
    assert info_for_guest["permissions"]["can_leave"] is False
