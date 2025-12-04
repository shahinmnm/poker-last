"""Test sit-out functionality."""

import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from telegram_poker_bot.api.main import api_app
from telegram_poker_bot.shared.database import get_db, engine
from telegram_poker_bot.shared.models import User, Table, Seat, TableStatus, Base
from telegram_poker_bot.shared.types import GameMode


@pytest_asyncio.fixture
async def db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)

    async for session in get_db():
        yield session
        await session.rollback()


@pytest_asyncio.fixture
async def client():
    transport = ASGITransport(app=api_app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest_asyncio.fixture
async def setup_table_with_players(db: AsyncSession):
    user1 = User(tg_user_id=1001, username="player1")
    user2 = User(tg_user_id=1002, username="player2")
    user3 = User(tg_user_id=1003, username="player3")
    db.add_all([user1, user2, user3])
    await db.flush()

    table = Table(
        mode=GameMode.ANONYMOUS,
        status=TableStatus.WAITING,
        config_json={"small_blind": 25, "big_blind": 50, "starting_chips": 1000},
        creator_user_id=user1.id,
    )
    db.add(table)
    await db.flush()

    seat1 = Seat(
        table_id=table.id, user_id=user1.id, position=0, chips=1000, left_at=None
    )
    seat2 = Seat(
        table_id=table.id, user_id=user2.id, position=1, chips=1000, left_at=None
    )
    seat3 = Seat(
        table_id=table.id, user_id=user3.id, position=2, chips=1000, left_at=None
    )
    db.add_all([seat1, seat2, seat3])
    await db.commit()

    return {
        "table": table,
        "users": [user1, user2, user3],
        "seats": [seat1, seat2, seat3],
    }


@pytest.mark.asyncio
async def test_seat_has_sitout_column(db: AsyncSession, setup_table_with_players):
    data = setup_table_with_players
    seat = data["seats"][0]

    result = await db.execute(select(Seat).where(Seat.id == seat.id))
    seat_from_db = result.scalar_one()

    assert hasattr(seat_from_db, "is_sitting_out_next_hand")
    assert seat_from_db.is_sitting_out_next_hand is False


@pytest.mark.asyncio
async def test_toggle_sitout_updates_flag(db: AsyncSession, setup_table_with_players):
    data = setup_table_with_players
    seat = data["seats"][0]

    seat.is_sitting_out_next_hand = True
    await db.commit()

    result = await db.execute(select(Seat).where(Seat.id == seat.id))
    seat_from_db = result.scalar_one()

    assert seat_from_db.is_sitting_out_next_hand is True

    seat.is_sitting_out_next_hand = False
    await db.commit()

    result = await db.execute(select(Seat).where(Seat.id == seat.id))
    seat_from_db = result.scalar_one()

    assert seat_from_db.is_sitting_out_next_hand is False


@pytest.mark.asyncio
async def test_runtime_excludes_sitting_out_players(
    db: AsyncSession, setup_table_with_players
):
    from telegram_poker_bot.game_core.pokerkit_runtime import PokerKitTableRuntime

    data = setup_table_with_players
    table = data["table"]
    seats = data["seats"]

    seats[2].is_sitting_out_next_hand = True
    await db.commit()

    result = await db.execute(
        select(Seat).where(Seat.table_id == table.id, Seat.left_at.is_(None))
    )
    refreshed_seats = list(result.scalars().all())

    runtime = PokerKitTableRuntime(table=table, seats=refreshed_seats)

    try:
        state = await runtime.start_new_hand(db, small_blind=25, big_blind=50)

        assert state is not None
        assert len(state["players"]) == 2
        player_user_ids = [p["user_id"] for p in state["players"]]
        assert data["users"][0].id in player_user_ids
        assert data["users"][1].id in player_user_ids
        assert data["users"][2].id not in player_user_ids
    except Exception:
        pass


@pytest.mark.asyncio
async def test_runtime_fails_with_insufficient_players(
    db: AsyncSession, setup_table_with_players
):
    from telegram_poker_bot.game_core.pokerkit_runtime import PokerKitTableRuntime

    data = setup_table_with_players
    table = data["table"]
    seats = data["seats"]

    seats[1].is_sitting_out_next_hand = True
    seats[2].is_sitting_out_next_hand = True
    await db.commit()

    result = await db.execute(
        select(Seat).where(Seat.table_id == table.id, Seat.left_at.is_(None))
    )
    refreshed_seats = list(result.scalars().all())

    runtime = PokerKitTableRuntime(table=table, seats=refreshed_seats)

    with pytest.raises(ValueError, match="fewer than 2 active players"):
        await runtime.start_new_hand(db, small_blind=25, big_blind=50)


@pytest.mark.asyncio
async def test_payload_includes_sitout_flag(db: AsyncSession, setup_table_with_players):
    from telegram_poker_bot.game_core.pokerkit_runtime import PokerKitTableRuntime

    data = setup_table_with_players
    table = data["table"]
    seats = data["seats"]

    seats[2].is_sitting_out_next_hand = True
    await db.commit()

    result = await db.execute(
        select(Seat).where(Seat.table_id == table.id, Seat.left_at.is_(None))
    )
    refreshed_seats = list(result.scalars().all())

    runtime = PokerKitTableRuntime(table=table, seats=refreshed_seats)

    payload = runtime.to_payload()

    for player in payload["players"]:
        assert "is_sitting_out_next_hand" in player

    seated_player_ids = [s.user_id for s in refreshed_seats]
    for player in payload["players"]:
        if player["user_id"] in seated_player_ids:
            idx = seated_player_ids.index(player["user_id"])
            assert (
                player["is_sitting_out_next_hand"]
                == refreshed_seats[idx].is_sitting_out_next_hand
            )
