"""FastAPI service for Mini App - REST + WebSocket API."""

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import json
import hmac
import hashlib
from base64 import b64decode

from telegram_poker_bot.shared.config import get_settings
from telegram_poker_bot.shared.logging import configure_logging, get_logger
from telegram_poker_bot.shared.database import get_db
from telegram_poker_bot.shared.models import Table, Hand, Action, ActionType
from telegram_poker_bot.game_core import TableManager, get_matchmaking_pool
from sqlalchemy.ext.asyncio import AsyncSession

settings = get_settings()
configure_logging()
logger = get_logger(__name__)

app = FastAPI(
    title="Telegram Poker Bot API",
    description="REST and WebSocket API for Telegram Poker Bot Mini App",
    version="1.0.0",
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins.split(",") if "," in settings.cors_origins else [settings.cors_origins],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Pydantic models
class ActionRequest(BaseModel):
    """Action request model."""
    action_type: str
    amount: Optional[int] = None


class UserAuth(BaseModel):
    """User authentication model."""
    user_id: int
    username: Optional[str] = None


# WebSocket connection manager
class ConnectionManager:
    """Manages WebSocket connections."""
    
    def __init__(self):
        self.active_connections: Dict[int, List[WebSocket]] = {}  # table_id -> [websockets]
    
    async def connect(self, websocket: WebSocket, table_id: int):
        """Connect a WebSocket to a table."""
        await websocket.accept()
        if table_id not in self.active_connections:
            self.active_connections[table_id] = []
        self.active_connections[table_id].append(websocket)
        logger.info("WebSocket connected", table_id=table_id)
    
    def disconnect(self, websocket: WebSocket, table_id: int):
        """Disconnect a WebSocket from a table."""
        if table_id in self.active_connections:
            self.active_connections[table_id].remove(websocket)
            if not self.active_connections[table_id]:
                del self.active_connections[table_id]
        logger.info("WebSocket disconnected", table_id=table_id)
    
    async def broadcast(self, table_id: int, message: Dict[str, Any]):
        """Broadcast message to all connections for a table."""
        if table_id in self.active_connections:
            disconnected = []
            for connection in self.active_connections[table_id]:
                try:
                    await connection.send_json(message)
                except Exception as e:
                    logger.error("Error broadcasting", table_id=table_id, error=str(e))
                    disconnected.append(connection)
            
            # Remove disconnected connections
            for conn in disconnected:
                self.disconnect(conn, table_id)


manager = ConnectionManager()


def verify_telegram_init_data(init_data: str) -> Optional[UserAuth]:
    """
    Verify Telegram Mini App init data.
    
    Design Note:
    - Validates Telegram WebApp initData signature
    - Extracts user information securely
    - Returns UserAuth if valid, None otherwise
    """
    try:
        # Parse init_data
        params = {}
        for param in init_data.split("&"):
            key, value = param.split("=", 1)
            params[key] = value
        
        # Verify hash
        hash_value = params.pop("hash", None)
        if not hash_value:
            return None
        
        # Create data check string
        data_check_string = "\n".join(f"{k}={v}" for k, v in sorted(params.items()))
        
        # Calculate secret key
        secret_key = hmac.new(
            "WebAppData".encode(),
            settings.telegram_bot_token.encode(),
            hashlib.sha256
        ).digest()
        
        # Verify signature
        calculated_hash = hmac.new(
            secret_key,
            data_check_string.encode(),
            hashlib.sha256
        ).hexdigest()
        
        if calculated_hash != hash_value:
            logger.warning("Invalid Telegram init data hash")
            return None
        
        # Parse user data
        user_data = json.loads(params.get("user", "{}"))
        return UserAuth(
            user_id=user_data.get("id"),
            username=user_data.get("username"),
        )
    except Exception as e:
        logger.error("Error verifying Telegram init data", error=str(e))
        return None


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "ok", "service": "api"}


@app.get("/tables/{table_id}")
async def get_table(table_id: int, db: AsyncSession = Depends(get_db)):
    """Get table information."""
    from sqlalchemy import select
    result = await db.execute(select(Table).where(Table.id == table_id))
    table = result.scalar_one_or_none()
    
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")
    
    return {
        "id": table.id,
        "mode": table.mode.value,
        "status": table.status.value,
        "created_at": table.created_at.isoformat(),
    }


@app.post("/tables/{table_id}/actions")
async def submit_action(
    table_id: int,
    action: ActionRequest,
    x_telegram_init_data: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db),
):
    """Submit a poker action."""
    # Verify user
    if not x_telegram_init_data:
        raise HTTPException(status_code=401, detail="Missing Telegram init data")
    
    user_auth = verify_telegram_init_data(x_telegram_init_data)
    if not user_auth:
        raise HTTPException(status_code=401, detail="Invalid Telegram init data")
    
    # Process action
    table_manager = TableManager(db, await get_matchmaking_pool().redis)
    action_type = ActionType(action.action_type)
    
    try:
        action_obj = await table_manager.process_action(
            table_id=table_id,
            user_id=user_auth.user_id,
            action_type=action_type,
            amount=action.amount,
        )
        
        # Broadcast update to all connected clients
        await manager.broadcast(table_id, {
            "type": "action",
            "action": {
                "id": action_obj.id,
                "user_id": action_obj.user_id,
                "type": action_obj.type.value,
                "amount": action_obj.amount,
            },
        })
        
        return {"success": True, "action_id": action_obj.id}
    except Exception as e:
        logger.error("Error processing action", error=str(e))
        raise HTTPException(status_code=400, detail=str(e))


@app.websocket("/ws/{table_id}")
async def websocket_endpoint(websocket: WebSocket, table_id: int):
    """
    WebSocket endpoint for real-time table updates.
    
    Design Note:
    - Maintains persistent connection for live updates
    - Broadcasts state changes to all connected clients
    - Handles disconnections gracefully
    """
    await manager.connect(websocket, table_id)
    
    try:
        while True:
            # Keep connection alive and handle incoming messages
            data = await websocket.receive_text()
            # Echo back or process message
            await websocket.send_json({"type": "pong", "data": data})
    except WebSocketDisconnect:
        manager.disconnect(websocket, table_id)
    except Exception as e:
        logger.error("WebSocket error", error=str(e))
        manager.disconnect(websocket, table_id)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
