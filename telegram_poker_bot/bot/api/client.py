"""API client for Telegram bot to communicate with backend."""

import httpx
from typing import Optional, Dict, Any, List
from telegram_poker_bot.shared.config import get_settings
from telegram_poker_bot.shared.logging import get_logger

logger = get_logger(__name__)
settings = get_settings()


class APIClient:
    """Client for backend API communication."""
    
    def __init__(self):
        self.base_url = settings.api_url.rstrip("/") if settings.api_url else "http://localhost:8000"
        self.timeout = 10.0
        
    async def _request(
        self,
        method: str,
        endpoint: str,
        headers: Optional[Dict[str, str]] = None,
        json_data: Optional[Dict[str, Any]] = None,
        params: Optional[Dict[str, Any]] = None,
    ) -> Optional[Dict[str, Any]]:
        """Make HTTP request to backend API."""
        url = f"{self.base_url}{endpoint}"
        
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.request(
                    method=method,
                    url=url,
                    headers=headers,
                    json=json_data,
                    params=params,
                )
                
                if response.status_code >= 400:
                    logger.warning(
                        "API request failed",
                        method=method,
                        endpoint=endpoint,
                        status=response.status_code,
                        response=response.text[:200],
                    )
                    return None
                    
                if response.status_code == 204:  # No content
                    return {}
                    
                return response.json()
                
        except Exception as e:
            logger.error(
                "API request error",
                method=method,
                endpoint=endpoint,
                error=str(e),
            )
            return None
    
    async def get_user_profile(self, tg_user_id: int) -> Optional[Dict[str, Any]]:
        """Get user profile."""
        # Note: This would need proper auth header with Telegram init data
        return await self._request("GET", f"/api/users/me")
    
    async def get_user_stats(self, tg_user_id: int) -> Optional[Dict[str, Any]]:
        """Get user statistics."""
        return await self._request("GET", f"/api/users/me/stats")
    
    async def get_user_balance(self, tg_user_id: int) -> Optional[Dict[str, Any]]:
        """Get user balance."""
        return await self._request("GET", f"/api/users/me/balance")
    
    async def get_user_transactions(
        self,
        tg_user_id: int,
        limit: int = 10,
        offset: int = 0
    ) -> Optional[List[Dict[str, Any]]]:
        """Get user transaction history."""
        response = await self._request(
            "GET",
            f"/api/users/me/transactions",
            params={"limit": limit, "offset": offset}
        )
        return response.get("transactions", []) if response else None
    
    async def get_tables_list(
        self,
        status: Optional[str] = None,
        limit: int = 10
    ) -> Optional[List[Dict[str, Any]]]:
        """Get list of available tables."""
        params = {"limit": limit}
        if status:
            params["status"] = status
            
        response = await self._request("GET", "/api/tables", params=params)
        return response.get("tables", []) if response else None
    
    async def get_table_details(self, table_id: int) -> Optional[Dict[str, Any]]:
        """Get table details."""
        return await self._request("GET", f"/api/tables/{table_id}")
    
    async def join_table(self, table_id: int, tg_user_id: int) -> Optional[Dict[str, Any]]:
        """Join a table."""
        # This would need proper implementation with auth
        return await self._request("POST", f"/api/tables/{table_id}/sit")
    
    async def leave_table(self, table_id: int, tg_user_id: int) -> Optional[Dict[str, Any]]:
        """Leave a table."""
        return await self._request("POST", f"/api/tables/{table_id}/leave")
    
    async def get_table_state(self, table_id: int) -> Optional[Dict[str, Any]]:
        """Get current table state."""
        return await self._request("GET", f"/api/tables/{table_id}/state")
    
    async def submit_action(
        self,
        table_id: int,
        action_type: str,
        amount: Optional[int] = None
    ) -> Optional[Dict[str, Any]]:
        """Submit player action."""
        json_data = {"action": action_type}
        if amount is not None:
            json_data["amount"] = amount
            
        return await self._request(
            "POST",
            f"/api/tables/{table_id}/actions",
            json_data=json_data
        )
    
    async def get_user_tables(self, tg_user_id: int) -> Optional[List[Dict[str, Any]]]:
        """Get user's active tables."""
        response = await self._request("GET", f"/api/users/me/tables")
        return response.get("tables", []) if response else None


# Global API client instance
api_client = APIClient()
