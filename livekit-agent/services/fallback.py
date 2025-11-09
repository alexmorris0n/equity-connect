"""Provider fallback logic for STT/TTS/LLM providers"""
from typing import Optional, Dict, Any, Callable, TypeVar, List
import logging
from config import Config

logger = logging.getLogger(__name__)

T = TypeVar('T')

class ProviderFallback:
    """Handles provider fallback logic with retry"""
    
    def __init__(self, phone_config: Dict[str, Any]):
        """
        Initialize fallback handler
        
        Args:
            phone_config: Phone configuration dict with provider settings
        """
        self.phone_config = phone_config
        self.actual_providers_used = {
            'stt': None,
            'tts': None,
            'llm': None
        }
    
    def get_fallback_chain(self, provider_type: str) -> List[str]:
        """
        Get fallback chain for a provider type
        
        Args:
            provider_type: 'stt', 'tts', or 'llm'
        
        Returns:
            List of provider names in fallback order
        """
        chain = []
        
        # Primary provider
        primary_key = f"{provider_type}_provider"
        primary = self.phone_config.get(primary_key)
        if primary:
            chain.append(primary)
        
        # Per-number fallback
        fallback_key = f"{provider_type}_fallback_provider"
        fallback = self.phone_config.get(fallback_key)
        if fallback and fallback not in chain:
            chain.append(fallback)
        
        # Global default fallback
        global_key = f"DEFAULT_FALLBACK_{provider_type.upper()}_PROVIDER"
        global_fallback = getattr(Config, global_key, None)
        if global_fallback and global_fallback not in chain:
            chain.append(global_fallback)
        
        # Hardcoded final fallback
        final_fallbacks = {
            'stt': 'openai',  # OpenAI Whisper is reliable
            'tts': 'openai_tts',  # OpenAI TTS is reliable
            'llm': 'openai'  # OpenAI GPT is reliable
        }
        final = final_fallbacks.get(provider_type)
        if final and final not in chain:
            chain.append(final)
        
        return chain
    
    async def create_with_fallback(
        self,
        provider_type: str,
        create_func: Callable[[str, Dict[str, Any]], T],
        config_override: Optional[Dict[str, Any]] = None
    ) -> tuple[T, str]:
        """
        Create provider with fallback logic
        
        Args:
            provider_type: 'stt', 'tts', or 'llm'
            create_func: Function that creates provider instance (provider_name, config) -> Provider
            config_override: Optional config overrides
        
        Returns:
            Tuple of (provider_instance, actual_provider_name_used)
        
        Raises:
            Exception if all providers fail
        """
        chain = self.get_fallback_chain(provider_type)
        config = config_override or self.phone_config.copy()
        
        last_error = None
        
        for provider_name in chain:
            try:
                logger.info(f"🔄 Trying {provider_type.upper()} provider: {provider_name}")
                
                # Update config with current provider
                config[f"{provider_type}_provider"] = provider_name
                
                # Create provider
                provider = await create_func(provider_name, config)
                
                # Success!
                self.actual_providers_used[provider_type] = provider_name
                logger.info(f"✅ {provider_type.upper()} provider active: {provider_name}")
                return provider, provider_name
                
            except Exception as e:
                last_error = e
                logger.warning(f"⚠️ {provider_type.upper()} provider {provider_name} failed: {e}")
                continue
        
        # All providers failed
        error_msg = f"All {provider_type.upper()} providers failed. Last error: {last_error}"
        logger.error(f"❌ {error_msg}")
        raise Exception(error_msg) from last_error
    
    def get_actual_providers(self) -> Dict[str, str]:
        """Get the actual providers that were used (for cost tracking)"""
        return self.actual_providers_used.copy()

