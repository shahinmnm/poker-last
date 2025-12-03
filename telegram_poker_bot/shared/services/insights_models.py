"""Data models for insights system."""

from datetime import datetime, timezone
from typing import Dict, Any, Optional
from enum import Enum


class InsightType(str, Enum):
    """Types of insights that can be generated."""
    
    UNUSUAL_ACTIVITY = "unusual_activity"
    HIGH_TRAFFIC = "high_traffic"
    LOW_TRAFFIC = "low_traffic"
    WAITLIST_SURGE = "waitlist_surge"
    INACTIVITY_PATTERN = "inactivity_pattern"
    RAPID_PLAYER_CHANGE = "rapid_player_change"


class InsightSeverity(str, Enum):
    """Severity levels for insights."""
    
    INFO = "info"
    WARNING = "warning"
    CRITICAL = "critical"


class Insight:
    """Represents a generated insight about table or system behavior."""
    
    def __init__(
        self,
        insight_type: InsightType,
        severity: InsightSeverity,
        title: str,
        message: str,
        table_id: Optional[int] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ):
        self.insight_type = insight_type
        self.severity = severity
        self.title = title
        self.message = message
        self.table_id = table_id
        self.metadata = metadata or {}
        self.timestamp = datetime.now(timezone.utc)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert insight to dictionary for serialization."""
        return {
            "type": self.insight_type.value,
            "severity": self.severity.value,
            "title": self.title,
            "message": self.message,
            "table_id": self.table_id,
            "metadata": self.metadata,
            "timestamp": self.timestamp.isoformat(),
        }
