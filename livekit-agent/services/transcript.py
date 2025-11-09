"""Transcript capture service for LiveKit agent sessions"""
from typing import List, Dict, Any, Optional
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

class TranscriptCapture:
    """Captures conversation transcripts during LiveKit agent sessions"""
    
    def __init__(self):
        self.transcript: List[Dict[str, Any]] = []
        self.tool_calls: List[Dict[str, Any]] = []
    
    def add_user_message(self, text: str, timestamp: Optional[float] = None) -> None:
        """Add a user message to the transcript
        
        Args:
            text: User's transcribed text
            timestamp: Optional timestamp (Unix seconds)
        """
        if not text or not text.strip():
            return
        
        self.transcript.append({
            "role": "user",
            "text": text.strip(),
            "content": text.strip(),  # Support both 'text' and 'content' keys
            "timestamp": timestamp or datetime.utcnow().timestamp()
        })
        logger.debug(f"💬 User: {text[:50]}...")
    
    def add_assistant_message(self, text: str, timestamp: Optional[float] = None) -> None:
        """Add an assistant message to the transcript
        
        Args:
            text: Assistant's response text
            timestamp: Optional timestamp (Unix seconds)
        """
        if not text or not text.strip():
            return
        
        self.transcript.append({
            "role": "assistant",
            "text": text.strip(),
            "content": text.strip(),
            "timestamp": timestamp or datetime.utcnow().timestamp()
        })
        logger.debug(f"🤖 Assistant: {text[:50]}...")
    
    def add_tool_call(self, tool_name: str, tool_input: Optional[Dict[str, Any]] = None, tool_output: Optional[str] = None) -> None:
        """Record a tool call
        
        Args:
            tool_name: Name of the tool called
            tool_input: Tool input parameters
            tool_output: Tool output/result
        """
        self.tool_calls.append({
            "tool_name": tool_name,
            "tool_input": tool_input or {},
            "tool_output": tool_output
        })
        logger.debug(f"🔧 Tool: {tool_name}")
    
    def get_transcript(self) -> List[Dict[str, Any]]:
        """Get the current transcript"""
        return self.transcript.copy()
    
    def get_tool_calls(self) -> List[Dict[str, Any]]:
        """Get all tool calls made during the session"""
        return self.tool_calls.copy()
    
    def format_for_storage(self) -> Dict[str, Any]:
        """Format transcript for storage in Supabase
        
        Returns:
            Dict with conversation_transcript, message_count, tool_calls_made, etc.
        """
        # Extract tool call names
        tool_calls_made = [tc.get("tool_name") for tc in self.tool_calls if tc.get("tool_name")]
        
        return {
            "conversation_transcript": self.transcript,
            "message_count": len(self.transcript),
            "tool_calls_made": tool_calls_made,
            "tool_count": len(tool_calls_made)
        }
    
    def get_transcript_text(self) -> str:
        """Get transcript as plain text (for transcript_text column)
        
        Returns:
            Formatted text with role: message format
        """
        lines = []
        for msg in self.transcript:
            role = msg.get("role", "unknown")
            text = msg.get("text") or msg.get("content", "")
            lines.append(f"{role}: {text}")
        return "\n".join(lines)
    
    def from_session_history(self, history: List[Any]) -> None:
        """Populate transcript from LiveKit session history (fallback)
        
        Args:
            history: List of chat messages from session.history
        """
        self.transcript = []
        
        for msg in history:
            role = "unknown"
            text = ""
            
            # Extract role and content from LiveKit message format
            if hasattr(msg, "role"):
                role = msg.role
            elif isinstance(msg, dict):
                role = msg.get("role", "unknown")
            
            if hasattr(msg, "content"):
                content = msg.content
                if isinstance(content, str):
                    text = content
                elif isinstance(content, list):
                    # Handle content blocks
                    text_parts = []
                    for block in content:
                        if isinstance(block, dict) and block.get("type") == "text":
                            text_parts.append(block.get("text", ""))
                        elif isinstance(block, str):
                            text_parts.append(block)
                    text = " ".join(text_parts)
            elif isinstance(msg, dict):
                text = msg.get("content") or msg.get("text", "")
            
            if text:
                self.transcript.append({
                    "role": role,
                    "text": text,
                    "content": text,
                    "timestamp": datetime.utcnow().timestamp()
                })
        
        logger.info(f"📝 Loaded {len(self.transcript)} messages from session history")

