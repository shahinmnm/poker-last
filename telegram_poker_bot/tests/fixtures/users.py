"""User fixture generators for testing."""

from typing import Dict, List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from telegram_poker_bot.shared.models import User


async def create_test_user(
    db: AsyncSession,
    telegram_id: int = 12345,
    username: str = "testuser",
    first_name: str = "Test",
    last_name: Optional[str] = "User",
    language_code: str = "en",
    **kwargs
) -> User:
    """Create a test user.
    
    Args:
        db: Database session
        telegram_id: Telegram user ID
        username: Username
        first_name: First name
        last_name: Last name
        language_code: Language code
        **kwargs: Additional user fields
        
    Returns:
        Created User instance
    """
    user = User(
        telegram_id=telegram_id,
        username=username,
        first_name=first_name,
        last_name=last_name,
        language_code=language_code,
        **kwargs
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


async def create_test_users(
    db: AsyncSession,
    count: int = 6,
    starting_id: int = 10000
) -> List[User]:
    """Create multiple test users.
    
    Args:
        db: Database session
        count: Number of users to create
        starting_id: Starting telegram_id
        
    Returns:
        List of created User instances
    """
    users = []
    for i in range(count):
        user = await create_test_user(
            db,
            telegram_id=starting_id + i,
            username=f"player{i+1}",
            first_name=f"Player",
            last_name=f"{i+1}"
        )
        users.append(user)
    return users


async def create_admin_user(
    db: AsyncSession,
    telegram_id: int = 99999,
    username: str = "admin"
) -> User:
    """Create an admin test user.
    
    Args:
        db: Database session
        telegram_id: Telegram user ID
        username: Username
        
    Returns:
        Created admin User instance
    """
    from telegram_poker_bot.shared.auth_models import UserRole, UserRoles
    
    user = await create_test_user(
        db,
        telegram_id=telegram_id,
        username=username,
        first_name="Admin",
        last_name="User"
    )
    
    # Add admin role
    role = UserRoles(
        user_id=user.id,
        role=UserRole.SUPER_ADMIN,
        granted_by_user_id=user.id
    )
    db.add(role)
    await db.commit()
    await db.refresh(user)
    
    return user
