"""LLM provider factory and adapters"""
from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional
from config import Config
import logging
import httpx
import json

logger = logging.getLogger(__name__)

class LLMProvider(ABC):
    """Abstract base class for LLM providers"""
    
    @abstractmethod
    async def complete(self, messages: List[Dict[str, str]], tools: Optional[List[Dict]] = None) -> Dict[str, Any]:
        """Complete a chat conversation"""
        pass

class OpenAILLM(LLMProvider):
    """OpenAI LLM provider"""
    
    def __init__(self, api_key: str, model: str = 'gpt-5'):
        self.api_key = api_key
        self.model = model
    
    async def complete(self, messages: List[Dict[str, str]], tools: Optional[List[Dict]] = None) -> Dict[str, Any]:
        """Complete using OpenAI API"""
        try:
            from livekit.plugins import openai
            llm = openai.LLM(
                api_key=self.api_key,
                model=self.model
            )
            return await llm.complete(messages, tools=tools)
        except Exception as e:
            logger.error(f"❌ OpenAI LLM error: {e}")
            raise

class OpenAIRealtimeLLM(LLMProvider):
    """OpenAI Realtime API provider (bundled STT+LLM)"""
    
    def __init__(self, api_key: str):
        self.api_key = api_key
    
    async def attach_to_livekit(self, session):
        """Attach Realtime API to LiveKit session"""
        try:
            from livekit.plugins.openai import RealtimeLLM
            llm = RealtimeLLM(api_key=self.api_key)
            # This integrates directly with LiveKit session
            return llm
        except Exception as e:
            logger.error(f"❌ OpenAI Realtime LLM error: {e}")
            raise
    
    async def complete(self, messages: List[Dict[str, str]], tools: Optional[List[Dict]] = None) -> Dict[str, Any]:
        """Realtime API doesn't use standard complete - use attach_to_livekit instead"""
        raise NotImplementedError("OpenAI Realtime uses attach_to_livekit, not complete()")

# Note: Eden AI LLM is not used - we use OpenRouter via official LiveKit plugin instead
# This keeps the codebase clean and ensures full compatibility with LiveKit's agent system

class AnthropicLLM(LLMProvider):
    """Anthropic Claude LLM provider (stub)"""
    
    def __init__(self, api_key: str, model: str = 'claude-3-5-sonnet-20241022'):
        self.api_key = api_key
        self.model = model
        logger.warning("⚠️ Anthropic LLM not yet fully implemented")
    
    async def complete(self, messages: List[Dict[str, str]], tools: Optional[List[Dict]] = None) -> Dict[str, Any]:
        """Stub implementation"""
        raise NotImplementedError("Anthropic LLM not yet fully implemented")

class GeminiLLM(LLMProvider):
    """Google Gemini LLM provider (stub)"""
    
    def __init__(self, credentials_json: str, model: str = 'gemini-pro'):
        self.credentials_json = credentials_json
        self.model = model
        logger.warning("⚠️ Gemini LLM not yet fully implemented")
    
    async def complete(self, messages: List[Dict[str, str]], tools: Optional[List[Dict]] = None) -> Dict[str, Any]:
        """Stub implementation"""
        raise NotImplementedError("Gemini LLM not yet fully implemented")

async def get_llm_provider(config: dict, fallback: Optional[str] = None) -> LLMProvider:
    """
    Factory function to get LLM provider based on config
    
    Args:
        config: Provider config dict with 'llm_provider' and 'llm_model'
        fallback: Optional fallback provider name
    
    Returns:
        LLMProvider instance
    """
    provider_name = config.get('llm_provider', 'openai')
    provider_overrides = config.get('provider_overrides', {})
    
    # Try primary provider
    try:
        if provider_name == 'openai':
            if not Config.OPENAI_API_KEY:
                raise ValueError("OPENAI_API_KEY not set")
            return OpenAILLM(
                api_key=Config.OPENAI_API_KEY,
                model=config.get('llm_model', 'gpt-5')
            )
        elif provider_name == 'openai_realtime':
            if not Config.OPENAI_API_KEY:
                raise ValueError("OPENAI_API_KEY not set")
            return OpenAIRealtimeLLM(api_key=Config.OPENAI_API_KEY)
        # Note: Eden AI LLM not supported - use OpenRouter via official plugin instead
        elif provider_name == 'anthropic':
            if not Config.ANTHROPIC_API_KEY:
                raise ValueError("ANTHROPIC_API_KEY not set")
            return AnthropicLLM(
                api_key=Config.ANTHROPIC_API_KEY,
                model=config.get('llm_model', 'claude-3-5-sonnet-20241022')
            )
        elif provider_name == 'gemini':
            if not Config.GOOGLE_APPLICATION_CREDENTIALS_JSON:
                raise ValueError("GOOGLE_APPLICATION_CREDENTIALS_JSON not set")
            return GeminiLLM(
                credentials_json=Config.GOOGLE_APPLICATION_CREDENTIALS_JSON,
                model=config.get('llm_model', 'gemini-pro')
            )
        else:
            raise ValueError(f"Unknown LLM provider: {provider_name}")
    except Exception as e:
        logger.warning(f"⚠️ Failed to initialize {provider_name} LLM: {e}")
        
        # Try fallback
        fallback_name = fallback or config.get('llm_fallback_provider') or Config.DEFAULT_FALLBACK_LLM_PROVIDER
        if fallback_name and fallback_name != provider_name:
            logger.info(f"🔄 Falling back to {fallback_name} LLM")
            fallback_config = config.copy()
            fallback_config['llm_provider'] = fallback_name
            return await get_llm_provider(fallback_config)
        
        raise

