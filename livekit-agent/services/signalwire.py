"""SignalWire client for outbound calls"""
import logging
import base64
import httpx
from typing import Dict, Any, Optional
from config import Config

logger = logging.getLogger(__name__)


class SignalWireClient:
    """Client for SignalWire REST API"""
    
    def __init__(self):
        self.project_id = Config.SIGNALWIRE_PROJECT_ID
        self.token = Config.SIGNALWIRE_TOKEN
        self.space = Config.SIGNALWIRE_SPACE
        
        if not all([self.project_id, self.token, self.space]):
            logger.warning("⚠️ SignalWire credentials not fully configured")
        
        self.base_url = f"https://{self.space}/api/laml/2010-04-01/Accounts/{self.project_id}"
    
    def _get_auth_header(self) -> str:
        """Generate Basic Auth header"""
        auth_string = f"{self.project_id}:{self.token}"
        auth_bytes = auth_string.encode('utf-8')
        auth_b64 = base64.b64encode(auth_bytes).decode('utf-8')
        return f"Basic {auth_b64}"
    
    async def create_call(
        self,
        to: str,
        from_number: str,
        url: str,
        status_callback: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Create an outbound call via SignalWire REST API
        
        Args:
            to: Destination phone number (E.164 format)
            from_number: Source phone number (E.164 format)
            url: SWML URL to execute when call answers
            status_callback: Optional webhook for call status updates
        
        Returns:
            Dict with call details including 'sid'
        """
        if not all([self.project_id, self.token, self.space]):
            raise ValueError("SignalWire credentials not configured")
        
        api_url = f"{self.base_url}/Calls.json"
        
        # Build form data
        form_data = {
            "To": to,
            "From": from_number,
            "Url": url
        }
        
        if status_callback:
            form_data["StatusCallback"] = status_callback
        
        headers = {
            "Content-Type": "application/x-www-form-urlencoded",
            "Accept": "application/json",
            "Authorization": self._get_auth_header()
        }
        
        logger.info(f"📞 Creating SignalWire call: {from_number} → {to}")
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                api_url,
                headers=headers,
                data=form_data,
                timeout=30.0
            )
            
            if not response.is_success:
                error_text = response.text
                logger.error(f"❌ SignalWire call failed: {response.status_code} {error_text}")
                raise Exception(f"SignalWire API error: {response.status_code}")
            
            data = response.json()
            call_sid = data.get("sid")
            
            logger.info(f"✅ SignalWire call created: {call_sid}")
            
            return {
                "sid": call_sid,
                "status": data.get("status", "queued"),
                "to": to,
                "from": from_number
            }

