"""WebSocket client for real-time table updates."""

import asyncio
import json
from typing import Optional, Callable, Dict, Any
from websockets import connect, ConnectionClosed
from telegram_poker_bot.shared.config import get_settings
from telegram_poker_bot.shared.logging import get_logger

logger = get_logger(__name__)
settings = get_settings()


class TableWebSocketClient:
    """WebSocket client for table real-time updates."""
    
    def __init__(self, table_id: int, on_message: Callable):
        self.table_id = table_id
        self.on_message = on_message
        self.ws_url = self._build_ws_url()
        self.websocket = None
        self.running = False
        self.reconnect_attempts = 0
        self.max_reconnect_attempts = 5
        
    def _build_ws_url(self) -> str:
        """Build WebSocket URL for table."""
        base_url = settings.api_url or "http://localhost:8000"
        # Convert http to ws
        ws_url = base_url.replace("http://", "ws://").replace("https://", "wss://")
        return f"{ws_url}/api/ws/{self.table_id}"
    
    async def connect(self):
        """Connect to WebSocket."""
        try:
            self.websocket = await connect(self.ws_url)
            self.running = True
            self.reconnect_attempts = 0
            logger.info("WebSocket connected", table_id=self.table_id)
            
        except Exception as e:
            logger.error("WebSocket connection failed", table_id=self.table_id, error=str(e))
            raise
    
    async def listen(self):
        """Listen for WebSocket messages."""
        while self.running:
            try:
                if self.websocket is None:
                    await self.connect()
                
                message = await self.websocket.recv()
                
                try:
                    data = json.loads(message)
                    await self.on_message(data)
                except json.JSONDecodeError:
                    logger.warning("Invalid JSON from WebSocket", message=message[:100])
                    
            except ConnectionClosed:
                logger.warning("WebSocket connection closed", table_id=self.table_id)
                
                if self.running and self.reconnect_attempts < self.max_reconnect_attempts:
                    self.reconnect_attempts += 1
                    wait_time = min(2 ** self.reconnect_attempts, 30)
                    logger.info(
                        "Reconnecting WebSocket",
                        table_id=self.table_id,
                        attempt=self.reconnect_attempts,
                        wait=wait_time,
                    )
                    await asyncio.sleep(wait_time)
                    self.websocket = None
                else:
                    break
                    
            except Exception as e:
                logger.error("WebSocket listen error", table_id=self.table_id, error=str(e))
                if self.running:
                    await asyncio.sleep(2)
                else:
                    break
    
    async def send(self, data: Dict[str, Any]):
        """Send message to WebSocket."""
        if self.websocket:
            try:
                await self.websocket.send(json.dumps(data))
            except Exception as e:
                logger.error("WebSocket send error", table_id=self.table_id, error=str(e))
    
    async def close(self):
        """Close WebSocket connection."""
        self.running = False
        if self.websocket:
            try:
                await self.websocket.close()
                logger.info("WebSocket closed", table_id=self.table_id)
            except Exception as e:
                logger.warning("WebSocket close error", table_id=self.table_id, error=str(e))


class PollingClient:
    """Fallback polling client for when WebSocket is not available."""
    
    def __init__(self, table_id: int, on_update: Callable, api_client):
        self.table_id = table_id
        self.on_update = on_update
        self.api_client = api_client
        self.running = False
        self.poll_interval = 2  # seconds
        
    async def start(self):
        """Start polling for updates."""
        self.running = True
        logger.info("Starting polling for table", table_id=self.table_id)
        
        last_state = None
        
        while self.running:
            try:
                state = await self.api_client.get_table_state(self.table_id)
                
                if state and state != last_state:
                    await self.on_update({"type": "state_update", "data": state})
                    last_state = state
                    
                await asyncio.sleep(self.poll_interval)
                
            except Exception as e:
                logger.error("Polling error", table_id=self.table_id, error=str(e))
                await asyncio.sleep(self.poll_interval)
    
    async def stop(self):
        """Stop polling."""
        self.running = False
        logger.info("Stopped polling for table", table_id=self.table_id)
