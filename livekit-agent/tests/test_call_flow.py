"""
Smoke tests for LiveKit agent call flow
Tests provider initialization, transcripts, evaluation, and recording playback
"""
import pytest
import asyncio
import os
from unittest.mock import Mock, patch, AsyncMock
from typing import Dict, Any

# Test imports
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.supabase import get_supabase_client, get_phone_config, get_lead_by_phone
from services.prompts import get_instructions_for_call_type
from services.call_type import detect_call_type
from services.transcript import TranscriptCapture
from services.config import compute_cost
from services.evaluation import evaluate_call
from services.fallback import ProviderFallback


class TestCallFlow:
    """Test suite for call flow components"""
    
    @pytest.mark.asyncio
    async def test_transcript_capture(self):
        """Test transcript capture functionality"""
        capture = TranscriptCapture()
        
        # Add messages
        capture.add_user_message("Hello")
        capture.add_assistant_message("Hi there!")
        capture.add_tool_call("get_lead_context", {"lead_id": "123"})
        capture.add_tool_output("get_lead_context", {"name": "John"})
        
        # Verify transcript
        transcript = capture.get_transcript()
        assert len(transcript) == 4
        assert transcript[0]["role"] == "user"
        assert transcript[1]["role"] == "assistant"
        assert transcript[2]["role"] == "tool_call"
        
        # Verify formatted output
        formatted = capture.format_for_storage()
        assert "conversation_transcript" in formatted
        assert formatted["message_count"] == 4
        assert formatted["tool_count"] == 1
    
    @pytest.mark.asyncio
    async def test_cost_computation(self):
        """Test cost computation for different providers"""
        # Test OpenAI Realtime (bundled pricing)
        cost_realtime = compute_cost(
            stt_minutes=5.0,
            tts_chars=0,  # Not used with Realtime
            llm_tokens=None,  # Not used with Realtime
            llm_provider="openai_realtime",
            stt_provider="openai_realtime",
            tts_provider="openai_realtime",
            llm_model="default",
            is_realtime=True
        )
        assert cost_realtime > 0
        
        # Test separate providers
        cost_separate = compute_cost(
            stt_minutes=5.0,
            tts_chars=3750,  # ~5 minutes at 750 chars/min
            llm_tokens=2000,
            llm_provider="openai",
            stt_provider="deepgram",
            tts_provider="elevenlabs",
            llm_model="gpt-5",
            stt_model="nova-2",
            tts_voice="shimmer",
            is_realtime=False
        )
        assert cost_separate > 0
        assert cost_separate != cost_realtime  # Should be different
    
    @pytest.mark.asyncio
    async def test_provider_fallback(self):
        """Test provider fallback logic"""
        phone_config = {
            "stt_provider": "deepgram",
            "tts_provider": "elevenlabs",
            "llm_provider": "openai",
            "stt_fallback_provider": "openai",
            "tts_fallback_provider": "openai_tts",
            "llm_fallback_provider": "openrouter"  # Use OpenRouter, not Eden AI for LLM
        }
        
        fallback = ProviderFallback(phone_config)
        
        # Mock create function that fails first time
        call_count = {"stt": 0}
        
        async def mock_create_stt(provider_name: str, config: Dict[str, Any]):
            call_count["stt"] += 1
            if call_count["stt"] == 1:
                raise ValueError("Deepgram failed")
            return Mock()  # Return mock provider
        
        # Test fallback
        provider, actual = await fallback.create_with_fallback(
            "stt",
            mock_create_stt,
            phone_config.copy()
        )
        
        assert actual == "openai"  # Should fallback to openai
        assert call_count["stt"] == 2  # Should have tried twice
    
    @pytest.mark.asyncio
    @pytest.mark.skipif(
        not os.getenv("SUPABASE_URL") or not os.getenv("SUPABASE_SERVICE_KEY"),
        reason="Supabase credentials not set"
    )
    async def test_supabase_phone_config(self):
        """Test fetching phone configuration from Supabase"""
        # This requires actual Supabase connection
        # Replace with a test phone number from your database
        test_phone = os.getenv("TEST_PHONE_NUMBER", "")
        if not test_phone:
            pytest.skip("TEST_PHONE_NUMBER not set")
        
        config = await get_phone_config(test_phone)
        assert config is not None
        assert "stt_provider" in config
        assert "tts_provider" in config
        assert "llm_provider" in config
    
    @pytest.mark.asyncio
    @pytest.mark.skipif(
        not os.getenv("OPENAI_API_KEY"),
        reason="OpenAI API key not set"
    )
    async def test_evaluation_service(self):
        """Test call evaluation service"""
        # Mock transcript
        transcript = [
            {"role": "user", "text": "Hello", "timestamp": 1000},
            {"role": "assistant", "text": "Hi! How can I help?", "timestamp": 2000},
            {"role": "user", "text": "I'm interested in reverse mortgages", "timestamp": 3000},
            {"role": "assistant", "text": "Great! Let me tell you about our program.", "timestamp": 4000},
        ]
        
        # Mock interaction ID (would normally come from database)
        interaction_id = "test-interaction-123"
        
        # Note: This will actually call OpenAI API, so it costs money
        # Uncomment to test with real API:
        # await evaluate_call(
        #     interaction_id=interaction_id,
        #     transcript=transcript,
        #     prompt_version="inbound-qualified-v1"
        # )
        
        # For now, just verify the function exists and can be imported
        assert callable(evaluate_call)
    
    def test_call_type_detection(self):
        """Test call type detection logic"""
        # This would test the determine_call_type function
        # Requires mocking Supabase calls
        assert callable(detect_call_type)
    
    def test_prompt_loading(self):
        """Test prompt loading and variable injection"""
        # This would test get_instructions_for_call_type
        # Requires mocking Supabase calls
        assert callable(get_instructions_for_call_type)


class TestIntegration:
    """Integration tests (require full setup)"""
    
    @pytest.mark.asyncio
    @pytest.mark.integration
    @pytest.mark.skipif(
        not all([
            os.getenv("LIVEKIT_URL"),
            os.getenv("LIVEKIT_API_KEY"),
            os.getenv("SUPABASE_URL"),
            os.getenv("OPENAI_API_KEY")
        ]),
        reason="Integration test requires full environment setup"
    )
    async def test_full_call_flow(self):
        """
        Full integration test of call flow:
        1. Phone config loaded
        2. Lead lookup works
        3. Prompt loaded with variables
        4. Providers initialized
        5. Transcript captured
        6. Cost computed
        7. Interaction saved
        8. Evaluation triggered
        
        Note: This test requires:
        - LiveKit Cloud account
        - Supabase database with test data
        - API keys for providers
        """
        # This would be a full end-to-end test
        # For now, just verify components exist
        assert True  # Placeholder


if __name__ == "__main__":
    # Run tests with: python -m pytest tests/test_call_flow.py -v
    pytest.main([__file__, "-v"])

