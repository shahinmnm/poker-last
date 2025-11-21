"""Database connection and session management."""

from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool
from sqlalchemy.orm import declarative_base

from telegram_poker_bot.shared.config import get_settings

settings = get_settings()

# Create async engine
engine_kwargs = {
    "echo": settings.trace_sql,
}

if settings.database_url.startswith("sqlite"):
    engine_kwargs["poolclass"] = NullPool
else:
    engine_kwargs["pool_size"] = settings.database_pool_min_size
    engine_kwargs["max_overflow"] = (
        settings.database_pool_max_size - settings.database_pool_min_size
    )

engine = create_async_engine(settings.database_url, **engine_kwargs)

# Create async session factory
AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Dependency for getting database session."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


def get_db_session():
    """Context manager for getting a database session in background tasks."""
    return AsyncSessionLocal()
