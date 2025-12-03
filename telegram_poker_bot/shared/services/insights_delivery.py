"""Delivery channels for distributing insights to administrators."""

from abc import ABC, abstractmethod
from typing import List, Optional, Dict, Any
import json
from datetime import datetime, timezone

from telegram_poker_bot.shared.logging import get_logger
from telegram_poker_bot.shared.services.insights_models import Insight

logger = get_logger(__name__)


class DeliveryChannel(ABC):
    """Abstract base class for insight delivery channels."""
    
    @abstractmethod
    async def deliver(self, insights: List[Insight]) -> bool:
        """Deliver insights through this channel.
        
        Args:
            insights: List of insights to deliver
            
        Returns:
            True if delivery succeeded, False otherwise
        """
        pass
    
    @abstractmethod
    def get_channel_name(self) -> str:
        """Get the name of this delivery channel."""
        pass


class LoggingChannel(DeliveryChannel):
    """Delivery channel that logs insights to the application logger."""
    
    def get_channel_name(self) -> str:
        return "logging"
    
    async def deliver(self, insights: List[Insight]) -> bool:
        """Log insights to the application logger.
        
        Args:
            insights: List of insights to log
            
        Returns:
            Always returns True
        """
        if not insights:
            logger.debug("No insights to log")
            return True
        
        for insight in insights:
            log_data = {
                "insight_type": insight.insight_type.value,
                "severity": insight.severity.value,
                "title": insight.title,
                "message": insight.message,
                "table_id": insight.table_id,
                "metadata": insight.metadata,
                "timestamp": insight.timestamp.isoformat(),
            }
            
            if insight.severity.value == "critical":
                logger.warning("INSIGHT (CRITICAL)", **log_data)
            elif insight.severity.value == "warning":
                logger.warning("INSIGHT", **log_data)
            else:
                logger.info("INSIGHT", **log_data)
        
        logger.info(
            "Delivered insights via logging channel",
            count=len(insights),
        )
        return True


class TelegramAdminChannel(DeliveryChannel):
    """Delivery channel that sends insights to admin via Telegram bot.
    
    This is a placeholder implementation. In production, this would:
    - Send messages to configured admin chat IDs
    - Format insights as readable Telegram messages
    - Support message throttling to avoid spam
    - Handle Telegram API errors gracefully
    """
    
    def __init__(self, admin_chat_ids: Optional[List[int]] = None):
        """Initialize Telegram admin channel.
        
        Args:
            admin_chat_ids: List of Telegram chat IDs to send insights to
        """
        self.admin_chat_ids = admin_chat_ids or []
    
    def get_channel_name(self) -> str:
        return "telegram_admin"
    
    def _format_insight_message(self, insight: Insight) -> str:
        """Format an insight as a Telegram message.
        
        Args:
            insight: Insight to format
            
        Returns:
            Formatted message string
        """
        severity_emoji = {
            "info": "ℹ️",
            "warning": "⚠️",
            "critical": "🚨",
        }
        
        emoji = severity_emoji.get(insight.severity.value, "📊")
        
        msg = f"{emoji} **{insight.title}**\n\n"
        msg += f"{insight.message}\n\n"
        
        if insight.table_id:
            msg += f"Table ID: {insight.table_id}\n"
        
        msg += f"Time: {insight.timestamp.strftime('%Y-%m-%d %H:%M:%S UTC')}\n"
        
        if insight.metadata:
            msg += "\nDetails:\n"
            for key, value in insight.metadata.items():
                msg += f"• {key}: {value}\n"
        
        return msg
    
    async def deliver(self, insights: List[Insight]) -> bool:
        """Send insights to admin Telegram chats.
        
        Args:
            insights: List of insights to deliver
            
        Returns:
            True if delivery succeeded, False otherwise
        """
        if not insights:
            logger.debug("No insights to deliver via Telegram")
            return True
        
        if not self.admin_chat_ids:
            logger.warning(
                "No admin chat IDs configured for Telegram delivery",
                insights_count=len(insights),
            )
            return False
        
        # TODO: Implement actual Telegram message sending
        # For now, just log what would be sent
        logger.info(
            "Would send insights to Telegram admin",
            chat_ids=self.admin_chat_ids,
            insights_count=len(insights),
        )
        
        for insight in insights:
            message = self._format_insight_message(insight)
            logger.debug(
                "Formatted Telegram message",
                message=message,
                insight_type=insight.insight_type.value,
            )
        
        # Return True since this is a placeholder
        # In production, return actual send status
        return True


class WebhookChannel(DeliveryChannel):
    """Delivery channel that posts insights to webhook endpoints.
    
    This is a placeholder implementation. In production, this would:
    - POST insights to configured webhook URLs
    - Include authentication headers
    - Retry on failures
    - Support multiple webhook endpoints
    """
    
    def __init__(self, webhook_urls: Optional[List[str]] = None):
        """Initialize webhook channel.
        
        Args:
            webhook_urls: List of webhook URLs to POST to
        """
        self.webhook_urls = webhook_urls or []
    
    def get_channel_name(self) -> str:
        return "webhook"
    
    def _prepare_payload(self, insights: List[Insight]) -> Dict[str, Any]:
        """Prepare JSON payload for webhook POST.
        
        Args:
            insights: List of insights to include
            
        Returns:
            Dictionary payload ready for JSON serialization
        """
        return {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "insights": [insight.to_dict() for insight in insights],
            "count": len(insights),
        }
    
    async def deliver(self, insights: List[Insight]) -> bool:
        """POST insights to webhook endpoints.
        
        Args:
            insights: List of insights to deliver
            
        Returns:
            True if delivery succeeded, False otherwise
        """
        if not insights:
            logger.debug("No insights to deliver via webhook")
            return True
        
        if not self.webhook_urls:
            logger.warning(
                "No webhook URLs configured",
                insights_count=len(insights),
            )
            return False
        
        payload = self._prepare_payload(insights)
        
        # TODO: Implement actual HTTP POST
        # For now, just log what would be sent
        logger.info(
            "Would POST insights to webhooks",
            urls=self.webhook_urls,
            insights_count=len(insights),
            payload_size=len(json.dumps(payload)),
        )
        
        # Return True since this is a placeholder
        # In production, return actual POST status
        return True


class InsightsDeliveryService:
    """Service for delivering insights through multiple channels."""
    
    def __init__(self, channels: Optional[List[DeliveryChannel]] = None):
        """Initialize delivery service with channels.
        
        Args:
            channels: List of delivery channels to use
        """
        self.channels = channels or [LoggingChannel()]
    
    async def deliver_insights(self, insights: List[Insight]) -> Dict[str, bool]:
        """Deliver insights through all configured channels.
        
        Args:
            insights: List of insights to deliver
            
        Returns:
            Dictionary mapping channel name to delivery status
        """
        if not insights:
            logger.debug("No insights to deliver")
            return {}
        
        results = {}
        
        for channel in self.channels:
            channel_name = channel.get_channel_name()
            try:
                success = await channel.deliver(insights)
                results[channel_name] = success
                
                if success:
                    logger.info(
                        "Insights delivered successfully",
                        channel=channel_name,
                        count=len(insights),
                    )
                else:
                    logger.warning(
                        "Insights delivery failed",
                        channel=channel_name,
                        count=len(insights),
                    )
            except Exception as e:
                logger.error(
                    "Error delivering insights",
                    channel=channel_name,
                    error=str(e),
                    count=len(insights),
                )
                results[channel_name] = False
        
        return results
    
    def add_channel(self, channel: DeliveryChannel) -> None:
        """Add a delivery channel.
        
        Args:
            channel: Channel to add
        """
        self.channels.append(channel)
        logger.info(
            "Added delivery channel",
            channel=channel.get_channel_name(),
            total_channels=len(self.channels),
        )
    
    def remove_channel(self, channel_name: str) -> bool:
        """Remove a delivery channel by name.
        
        Args:
            channel_name: Name of channel to remove
            
        Returns:
            True if channel was removed, False if not found
        """
        initial_count = len(self.channels)
        self.channels = [
            c for c in self.channels
            if c.get_channel_name() != channel_name
        ]
        
        removed = len(self.channels) < initial_count
        if removed:
            logger.info(
                "Removed delivery channel",
                channel=channel_name,
                remaining_channels=len(self.channels),
            )
        
        return removed
