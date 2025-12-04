"""Table fixture generators for testing."""

from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from telegram_poker_bot.shared.models import Table, TableTemplate, User


async def create_test_table(
    db: AsyncSession,
    template: TableTemplate,
    creator: User,
    is_private: bool = False,
    **kwargs
) -> Table:
    """Create a test table from a template.
    
    Args:
        db: Database session
        template: TableTemplate to use
        creator: User who creates the table
        is_private: Whether table is private
        **kwargs: Additional table fields
        
    Returns:
        Created Table instance
    """
    from telegram_poker_bot.shared.services import table_service
    
    table = await table_service.create_table_from_template(
        db,
        template_id=template.id,
        creator_user_id=creator.id,
        is_private=is_private,
        **kwargs
    )
    
    return table


async def create_multiway_table(
    db: AsyncSession,
    template: TableTemplate,
    players: List[User],
    creator: Optional[User] = None,
    is_private: bool = False,
) -> Table:
    """Create a table with multiple players seated.
    
    This is useful for testing multiway pot logic, seat rotation, etc.
    
    Args:
        db: Database session
        template: TableTemplate to use
        players: List of users to seat at table
        creator: Table creator (defaults to first player)
        is_private: Whether table is private
        
    Returns:
        Created Table instance with players seated
    """
    if not players:
        raise ValueError("Must provide at least one player")
    
    if creator is None:
        creator = players[0]
    
    table = await create_test_table(
        db,
        template=template,
        creator=creator,
        is_private=is_private
    )
    
    # Seat all players
    from telegram_poker_bot.shared.services import table_service
    
    for i, player in enumerate(players):
        await table_service.sit_player(
            db,
            table_id=table.id,
            user_id=player.id,
            seat_number=i,
            buy_in_amount=template.config_json.get("starting_stack", 1000)
        )
    
    await db.refresh(table)
    return table


async def create_table_with_state(
    db: AsyncSession,
    template: TableTemplate,
    players: List[User],
    hand_number: int = 1,
    street: str = "preflop",
    pot: int = 0,
    **state_kwargs
) -> Table:
    """Create a table with specific game state.
    
    This is useful for testing specific scenarios without playing through hands.
    
    Args:
        db: Database session
        template: TableTemplate to use
        players: List of users at table
        hand_number: Current hand number
        street: Current street (preflop, flop, turn, river)
        pot: Current pot size
        **state_kwargs: Additional state fields
        
    Returns:
        Table with initialized state
    """
    table = await create_multiway_table(db, template, players)
    
    # Initialize runtime state
    # This would interact with the runtime manager to set specific state
    # For now, just create the table and let tests manipulate state directly
    
    return table
