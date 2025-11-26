"""Simulate a full PokerKit hand for debugging purposes."""

import asyncio
import random
import sys
from pathlib import Path

from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.append(str(ROOT))

from telegram_poker_bot.game_core.pokerkit_runtime import (  # noqa: E402
    get_pokerkit_runtime_manager,
)
from telegram_poker_bot.shared.models import ActionType, Base, User  # noqa: E402
from telegram_poker_bot.shared.services import table_service  # noqa: E402


async def simulate_hand() -> None:
    """Run a scripted PokerKit hand and print progress to stdout."""

    random.seed(42)

    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    session_factory = async_sessionmaker(engine, expire_on_commit=False)

    async with session_factory() as session:
        users = [
            User(tg_user_id=2000 + i, language="en", username=f"SimPlayer{i}")
            for i in range(3)
        ]
        session.add_all(users)
        await session.flush()

        table = await table_service.create_table_with_config(
            session,
            creator_user_id=users[0].id,
            table_name="PokerKit Simulation",
            small_blind=25,
            big_blind=50,
            starting_stack=1500,
            auto_seat_creator=False,
        )

        for user in users:
            await table_service.seat_user_at_table(session, table.id, user.id)

        manager = get_pokerkit_runtime_manager()
        runtime = await manager.ensure_table(session, table.id)

        state = await runtime.start_new_hand(session, 25, 50)
        print(f"New hand started on table {table.id} (hand #{runtime.hand_no})")
        print(f"Initial street: {state['street']}, actor: {state['current_actor']}")

        action_plan = [
            ActionType.ALL_IN,
            ActionType.CALL,
            ActionType.CALL,
        ]

        step = 0
        while runtime.engine and not runtime.engine.is_hand_complete():
            actor_user_id = state.get("current_actor")
            if actor_user_id is None:
                break

            action = action_plan[step] if step < len(action_plan) else ActionType.CHECK
            print(f"Action {step + 1}: user {actor_user_id} -> {action.value}")

            response = await manager.handle_action(
                session, table.id, actor_user_id, action, None
            )

            if response.get("street") != state.get("street"):
                print(
                    f"Street advanced: {state.get('street')} -> {response.get('street')}"
                )

            state = response
            board = " ".join(state.get("board", []))
            print(f"Current street: {state.get('street')}, board: {board}")

            step += 1
            runtime = await manager.ensure_table(session, table.id)

        runtime = await manager.ensure_table(session, table.id)
        user_by_index = {idx: uid for uid, idx in runtime.user_id_to_player_index.items()}

        print("\nHand complete!")
        print(f"Board: {' '.join(state.get('board', []))}")
        print(f"Winners: {state.get('hand_result', {}).get('winners', [])}")

        if runtime.engine:
            for idx, stack in enumerate(runtime.engine.state.stacks):
                user_id = user_by_index.get(idx, f"Player{idx}")
                print(f"Player {user_id} final stack: {stack}")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(simulate_hand())
