"""Admin WebSocket feed for real-time analytics.

Provides live updates for:
- Table metrics
- Player indicators
- Anomaly alerts
- System events
"""

from typing import Dict, Set, Optional, Any
from datetime import datetime, timezone
from fastapi import WebSocket, WebSocketDisconnect
import asyncio
import json

from telegram_poker_bot.shared.logging import get_logger
from telegram_poker_bot.shared.models import AnomalyAlert

logger = get_logger(__name__)


class AdminAnalyticsWebSocketManager:
    """Manages WebSocket connections for admin analytics feed.
    
    Features:
    - Real-time table metrics updates
    - Anomaly alert broadcasts
    - Player activity indicators
    - Auto-subscribe/unsubscribe based on admin view
    """
    
    def __init__(self):
        # Active WebSocket connections
        self.active_connections: Set[WebSocket] = set()
        
        # Table subscriptions: {table_id: Set[WebSocket]}
        self.table_subscriptions: Dict[int, Set[WebSocket]] = {}
        
        # User subscriptions: {user_id: Set[WebSocket]}
        self.user_subscriptions: Dict[int, Set[WebSocket]] = {}
        
        # Broadcast task
        self._broadcast_task: Optional[asyncio.Task] = None
    
    # ==================== Connection Management ====================
    
    async def connect(self, websocket: WebSocket):
        """Accept new WebSocket connection."""
        await websocket.accept()
        self.active_connections.add(websocket)
        logger.info("Admin analytics WebSocket connected", total=len(self.active_connections))
        
        # Send welcome message
        await self.send_message(websocket, {
            "type": "connected",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "message": "Connected to admin analytics feed",
        })
    
    def disconnect(self, websocket: WebSocket):
        """Handle WebSocket disconnection."""
        self.active_connections.discard(websocket)
        
        # Remove from all subscriptions
        for table_id in list(self.table_subscriptions.keys()):
            self.table_subscriptions[table_id].discard(websocket)
            if not self.table_subscriptions[table_id]:
                del self.table_subscriptions[table_id]
        
        for user_id in list(self.user_subscriptions.keys()):
            self.user_subscriptions[user_id].discard(websocket)
            if not self.user_subscriptions[user_id]:
                del self.user_subscriptions[user_id]
        
        logger.info("Admin analytics WebSocket disconnected", total=len(self.active_connections))
    
    # ==================== Subscriptions ====================
    
    async def subscribe_table(self, websocket: WebSocket, table_id: int):
        """Subscribe WebSocket to table updates."""
        if table_id not in self.table_subscriptions:
            self.table_subscriptions[table_id] = set()
        
        self.table_subscriptions[table_id].add(websocket)
        
        await self.send_message(websocket, {
            "type": "subscribed",
            "resource": "table",
            "table_id": table_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })
        
        logger.debug("Subscribed to table", table_id=table_id, ws=id(websocket))
    
    async def unsubscribe_table(self, websocket: WebSocket, table_id: int):
        """Unsubscribe WebSocket from table updates."""
        if table_id in self.table_subscriptions:
            self.table_subscriptions[table_id].discard(websocket)
            if not self.table_subscriptions[table_id]:
                del self.table_subscriptions[table_id]
        
        await self.send_message(websocket, {
            "type": "unsubscribed",
            "resource": "table",
            "table_id": table_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })
        
        logger.debug("Unsubscribed from table", table_id=table_id, ws=id(websocket))
    
    async def subscribe_user(self, websocket: WebSocket, user_id: int):
        """Subscribe WebSocket to user updates."""
        if user_id not in self.user_subscriptions:
            self.user_subscriptions[user_id] = set()
        
        self.user_subscriptions[user_id].add(websocket)
        
        await self.send_message(websocket, {
            "type": "subscribed",
            "resource": "user",
            "user_id": user_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })
        
        logger.debug("Subscribed to user", user_id=user_id, ws=id(websocket))
    
    async def unsubscribe_user(self, websocket: WebSocket, user_id: int):
        """Unsubscribe WebSocket from user updates."""
        if user_id in self.user_subscriptions:
            self.user_subscriptions[user_id].discard(websocket)
            if not self.user_subscriptions[user_id]:
                del self.user_subscriptions[user_id]
        
        await self.send_message(websocket, {
            "type": "unsubscribed",
            "resource": "user",
            "user_id": user_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })
        
        logger.debug("Unsubscribed from user", user_id=user_id, ws=id(websocket))
    
    # ==================== Message Sending ====================
    
    async def send_message(self, websocket: WebSocket, message: Dict[str, Any]):
        """Send message to specific WebSocket."""
        try:
            await websocket.send_json(message)
        except Exception as e:
            logger.error("Failed to send WebSocket message", error=str(e), ws=id(websocket))
            self.disconnect(websocket)
    
    async def broadcast(self, message: Dict[str, Any]):
        """Broadcast message to all connected WebSockets."""
        if not self.active_connections:
            return
        
        logger.debug("Broadcasting message", type=message.get("type"), count=len(self.active_connections))
        
        disconnected = set()
        for websocket in self.active_connections:
            try:
                await websocket.send_json(message)
            except Exception as e:
                logger.error("Failed to broadcast", error=str(e), ws=id(websocket))
                disconnected.add(websocket)
        
        # Clean up disconnected
        for websocket in disconnected:
            self.disconnect(websocket)
    
    async def broadcast_to_table_subscribers(self, table_id: int, message: Dict[str, Any]):
        """Broadcast message to WebSockets subscribed to a table."""
        if table_id not in self.table_subscriptions:
            return
        
        subscribers = self.table_subscriptions[table_id].copy()
        logger.debug("Broadcasting to table subscribers", table_id=table_id, count=len(subscribers))
        
        disconnected = set()
        for websocket in subscribers:
            try:
                await websocket.send_json(message)
            except Exception as e:
                logger.error("Failed to send to subscriber", error=str(e), ws=id(websocket))
                disconnected.add(websocket)
        
        # Clean up disconnected
        for websocket in disconnected:
            self.disconnect(websocket)
    
    async def broadcast_to_user_subscribers(self, user_id: int, message: Dict[str, Any]):
        """Broadcast message to WebSockets subscribed to a user."""
        if user_id not in self.user_subscriptions:
            return
        
        subscribers = self.user_subscriptions[user_id].copy()
        logger.debug("Broadcasting to user subscribers", user_id=user_id, count=len(subscribers))
        
        disconnected = set()
        for websocket in subscribers:
            try:
                await websocket.send_json(message)
            except Exception as e:
                logger.error("Failed to send to subscriber", error=str(e), ws=id(websocket))
                disconnected.add(websocket)
        
        # Clean up disconnected
        for websocket in disconnected:
            self.disconnect(websocket)
    
    # ==================== Event Broadcasting ====================
    
    async def broadcast_table_metrics(self, table_id: int, metrics: Dict[str, Any]):
        """Broadcast table metrics update."""
        message = {
            "type": "table_metrics_update",
            "table_id": table_id,
            "metrics": metrics,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        
        await self.broadcast_to_table_subscribers(table_id, message)
    
    async def broadcast_anomaly_alert(self, alert: AnomalyAlert):
        """Broadcast anomaly alert."""
        message = {
            "type": "anomaly_alert",
            "alert": {
                "id": alert.id,
                "alert_type": alert.alert_type,
                "severity": alert.severity,
                "table_id": alert.table_id,
                "user_id": alert.user_id,
                "hand_id": alert.hand_id,
                "message": alert.message,
                "metadata": alert.metadata or {},
                "created_at": alert.created_at.isoformat() if alert.created_at else None,
            },
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        
        # Broadcast to all admins
        await self.broadcast(message)
        
        # Also broadcast to table/user subscribers
        if alert.table_id:
            await self.broadcast_to_table_subscribers(alert.table_id, message)
        if alert.user_id:
            await self.broadcast_to_user_subscribers(alert.user_id, message)
    
    async def broadcast_pot_spike(self, table_id: int, hand_id: int, pot_size: int):
        """Broadcast pot spike alert."""
        message = {
            "type": "pot_spike_alert",
            "table_id": table_id,
            "hand_id": hand_id,
            "pot_size": pot_size,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        
        await self.broadcast(message)
        await self.broadcast_to_table_subscribers(table_id, message)
    
    async def broadcast_timeout_surge(self, table_id: int, user_id: int, timeout_count: int):
        """Broadcast timeout surge alert."""
        message = {
            "type": "timeout_surge_alert",
            "table_id": table_id,
            "user_id": user_id,
            "timeout_count": timeout_count,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        
        await self.broadcast(message)
        await self.broadcast_to_table_subscribers(table_id, message)
        await self.broadcast_to_user_subscribers(user_id, message)
    
    async def broadcast_player_activity(self, user_id: int, activity_type: str, metadata: Dict[str, Any]):
        """Broadcast player activity indicator."""
        message = {
            "type": "player_activity",
            "user_id": user_id,
            "activity_type": activity_type,
            "metadata": metadata,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        
        await self.broadcast_to_user_subscribers(user_id, message)
    
    # ==================== Message Handler ====================
    
    async def handle_message(self, websocket: WebSocket, data: Dict[str, Any]):
        """Handle incoming WebSocket message."""
        message_type = data.get("type")
        
        if message_type == "subscribe_table":
            table_id = data.get("table_id")
            if table_id:
                await self.subscribe_table(websocket, table_id)
        
        elif message_type == "unsubscribe_table":
            table_id = data.get("table_id")
            if table_id:
                await self.unsubscribe_table(websocket, table_id)
        
        elif message_type == "subscribe_user":
            user_id = data.get("user_id")
            if user_id:
                await self.subscribe_user(websocket, user_id)
        
        elif message_type == "unsubscribe_user":
            user_id = data.get("user_id")
            if user_id:
                await self.unsubscribe_user(websocket, user_id)
        
        elif message_type == "ping":
            await self.send_message(websocket, {
                "type": "pong",
                "timestamp": datetime.now(timezone.utc).isoformat(),
            })
        
        else:
            logger.warning("Unknown message type", type=message_type)
            await self.send_message(websocket, {
                "type": "error",
                "message": f"Unknown message type: {message_type}",
                "timestamp": datetime.now(timezone.utc).isoformat(),
            })


# Global instance
_admin_analytics_ws_manager: Optional[AdminAnalyticsWebSocketManager] = None


def get_admin_analytics_ws_manager() -> AdminAnalyticsWebSocketManager:
    """Get or create admin analytics WebSocket manager."""
    global _admin_analytics_ws_manager
    if _admin_analytics_ws_manager is None:
        _admin_analytics_ws_manager = AdminAnalyticsWebSocketManager()
    return _admin_analytics_ws_manager
