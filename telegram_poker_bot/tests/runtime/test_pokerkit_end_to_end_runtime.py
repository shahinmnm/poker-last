"""End-to-end PokerKit runtime integration tests."""

import random

import pytest
import pytest_asyncio
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from telegram_poker_bot.game_core.pokerkit_runtime import (
    get_pokerkit_runtime_manager,
    reset_pokerkit_runtime_cache,
)
from telegram_poker_bot.shared.models import (
    ActionType,
    Base,
    Hand,
    HandHistory,
    HandStatus,
    Table,
    TableStatus,
    User,
)
from telegram_poker_bot.shared.services import table_service

pytest.importorskip("aiosqlite")


@pytest_asyncio.fixture
async def db_session() -> AsyncSession:
    """In-memory database session for runtime integration tests."""

    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    async with session_factory() as session:
        yield session
        await session.rollback()

    await engine.dispose()
    reset_pokerkit_runtime_cache()


async def _create_table_with_players(
    db: AsyncSession,
    player_count: int,
    starting_stack: int = 2000,
    user_id_start: int = 1000,
):
    users = [
        User(tg_user_id=user_id_start + i, language="en", username=f"Player{i}")
        for i in range(player_count)
    ]
    db.add_all(users)
    await db.flush()

    table = await table_service.create_table_with_config(
        db,
        creator_user_id=users[0].id,
        table_name="Runtime Test Table",
        small_blind=25,
        big_blind=50,
        starting_stack=starting_stack,
        auto_seat_creator=False,
    )

    for user in users:
        await table_service.seat_user_at_table(db, table.id, user.id)

    return table, users


@pytest.mark.asyncio
async def test_simple_hand_2_players_fold_preflop(db_session: AsyncSession) -> None:
    """Folding preflop with two players should immediately end the hand."""

    random.seed(0)
    table, users = await _create_table_with_players(db_session, 2)
    manager = get_pokerkit_runtime_manager()

    state = await manager.start_game(db_session, table.id)
    actor_user_id = state["current_actor"]

    result = await manager.handle_action(
        db_session, table.id, actor_user_id, ActionType.FOLD, None
    )

    runtime = await manager.ensure_table(db_session, table.id)
    assert runtime.engine is not None
    assert runtime.engine.is_hand_complete() is True

    winners = result["hand_result"]["winners"]
    expected_winner = next(user.id for user in users if user.id != actor_user_id)
    assert winners and winners[0]["user_id"] == expected_winner

    hand_row = (
        await db_session.execute(
            select(Hand).where(Hand.table_id == table.id).order_by(Hand.hand_no.desc())
        )
    ).scalar_one()
    assert hand_row.status == HandStatus.INTER_HAND_WAIT

    history_entry = (
        await db_session.execute(
            select(HandHistory).where(HandHistory.table_id == table.id)
        )
    ).scalar_one_or_none()
    assert history_entry is not None


@pytest.mark.asyncio
async def test_all_in_preflop_runs_out_and_produces_hand_result(
    db_session: AsyncSession,
) -> None:
    """All-in preflop should run out all streets and persist results."""

    random.seed(1)
    table, users = await _create_table_with_players(db_session, 2)
    manager = get_pokerkit_runtime_manager()

    state = await manager.start_game(db_session, table.id)

    first_actor = state["current_actor"]
    first_action = await manager.handle_action(
        db_session, table.id, first_actor, ActionType.ALL_IN, None
    )

    second_actor = first_action["current_actor"]
    final_state = await manager.handle_action(
        db_session, table.id, second_actor, ActionType.CALL, None
    )

    runtime = await manager.ensure_table(db_session, table.id)
    assert runtime.engine is not None
    assert runtime.engine.is_hand_complete() is True

    assert final_state.get("hand_result", {}).get("winners")
    assert len(final_state.get("board", [])) == 5

    history_entry = (
        await db_session.execute(
            select(HandHistory).where(HandHistory.table_id == table.id)
        )
    ).scalar_one_or_none()
    assert history_entry is not None


@pytest.mark.asyncio
async def test_inter_hand_ready_flow(db_session: AsyncSession) -> None:
    """READY flow should start a new hand or end the table based on quorum."""

    random.seed(2)
    table, users = await _create_table_with_players(db_session, 2)
    manager = get_pokerkit_runtime_manager()

    state = await manager.start_game(db_session, table.id)
    actor_user_id = state["current_actor"]
    await manager.handle_action(db_session, table.id, actor_user_id, ActionType.FOLD, None)

    for user in users:
        ready_state = await manager.handle_action(
            db_session, table.id, user.id, ActionType.READY, None
        )
        assert user.id in ready_state.get("ready_players", [])

    completion = await manager.complete_inter_hand_phase(db_session, table.id)
    assert "state" in completion
    assert completion["state"].get("hand_id") == 2

    # Now simulate a table with only one ready player to trigger table end
    random.seed(3)
    alt_table, alt_users = await _create_table_with_players(db_session, 2, user_id_start=5000)

    alt_state = await manager.start_game(db_session, alt_table.id)
    alt_actor = alt_state["current_actor"]
    await manager.handle_action(
        db_session, alt_table.id, alt_actor, ActionType.FOLD, None
    )

    await manager.handle_action(
        db_session, alt_table.id, alt_users[0].id, ActionType.READY, None
    )

    alt_completion = await manager.complete_inter_hand_phase(db_session, alt_table.id)
    assert alt_completion.get("table_ended") is True

    updated_table = (
        await db_session.execute(select(Table).where(Table.id == alt_table.id))
    ).scalar_one()
    assert updated_table.status == TableStatus.ENDED


@pytest.mark.asyncio
async def test_to_payload_hides_and_reveals_hole_cards(db_session: AsyncSession) -> None:
    """Payload should hide opponents' cards pre-showdown and reveal at showdown."""

    random.seed(4)
    table, users = await _create_table_with_players(db_session, 3)
    manager = get_pokerkit_runtime_manager()

    state = await manager.start_game(db_session, table.id)
    runtime = await manager.ensure_table(db_session, table.id)

    pre_showdown = runtime.to_payload(viewer_user_id=users[0].id)
    hero_cards = pre_showdown.get("hero", {}).get("cards", [])
    assert len(hero_cards) == 2

    player_hole_cards = {
        player["user_id"]: player.get("hole_cards", [])
        for player in pre_showdown.get("players", [])
    }
    assert len(player_hole_cards.get(users[0].id, [])) == 2
    assert all(len(cards) == 0 for uid, cards in player_hole_cards.items() if uid != users[0].id)

    assert pre_showdown["current_actor"] is not None
    assert pre_showdown["action_deadline"] is not None

    # Push everyone all-in to force showdown visibility
    first_actor = state["current_actor"]
    first_action = await manager.handle_action(
        db_session, table.id, first_actor, ActionType.ALL_IN, None
    )
    second_actor = first_action["current_actor"]
    second_action = await manager.handle_action(
        db_session, table.id, second_actor, ActionType.CALL, None
    )
    third_actor = second_action["current_actor"]
    await manager.handle_action(
        db_session, table.id, third_actor, ActionType.CALL, None
    )

    runtime = await manager.ensure_table(db_session, table.id)
    showdown_payload = runtime.to_payload(viewer_user_id=users[1].id)

    revealed_holes = {
        player["user_id"]: player.get("hole_cards", [])
        for player in showdown_payload.get("players", [])
    }
    winner_ids = {
        winner["user_id"] for winner in showdown_payload.get("hand_result", {}).get("winners", [])
    }

    assert showdown_payload.get("hand_result", {}).get("winners")
    assert all(len(revealed_holes.get(uid, [])) == 2 for uid in winner_ids)
    assert all(
        len(cards) == 0 for uid, cards in revealed_holes.items() if uid not in winner_ids
    )
