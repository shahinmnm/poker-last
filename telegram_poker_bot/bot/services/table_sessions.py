"""Service to manage active table sessions for users."""

from typing import Dict, Optional
import asyncio
from telegram_poker_bot.shared.logging import get_logger

logger = get_logger(__name__)


class TableSession:
    """Represents an active table session for a user."""
    
    def __init__(self, user_id: int, chat_id: int, table_id: int):
        self.user_id = user_id
        self.chat_id = chat_id
        self.table_id = table_id
        self.ws_client = None
        self.polling_client = None
        self.listen_task = None
        
    async def cleanup(self):
        """Clean up session resources."""
        if self.listen_task and not self.listen_task.done():
            self.listen_task.cancel()
            try:
                await self.listen_task
            except asyncio.CancelledError:
                pass
        
        if self.ws_client:
            await self.ws_client.close()
            
        if self.polling_client:
            await self.polling_client.stop()


class TableSessionManager:
    """Manages active table sessions for all users."""
    
    def __init__(self):
        # Map of user_id -> TableSession
        self._sessions: Dict[int, TableSession] = {}
        
    def create_session(self, user_id: int, chat_id: int, table_id: int) -> TableSession:
        """Create a new table session for a user."""
        # Clean up existing session if any
        if user_id in self._sessions:
            old_session = self._sessions[user_id]
            asyncio.create_task(old_session.cleanup())
        
        session = TableSession(user_id, chat_id, table_id)
        self._sessions[user_id] = session
        
        logger.info(
            "Created table session",
            user_id=user_id,
            table_id=table_id,
            chat_id=chat_id,
        )
        
        return session
    
    def get_session(self, user_id: int) -> Optional[TableSession]:
        """Get active session for a user."""
        return self._sessions.get(user_id)
    
    async def remove_session(self, user_id: int):
        """Remove and cleanup a user's session."""
        if user_id in self._sessions:
            session = self._sessions.pop(user_id)
            await session.cleanup()
            
            logger.info(
                "Removed table session",
                user_id=user_id,
                table_id=session.table_id,
            )
    
    async def cleanup_all(self):
        """Cleanup all sessions."""
        for session in list(self._sessions.values()):
            await session.cleanup()
        self._sessions.clear()


# Global session manager
table_session_manager = TableSessionManager()
