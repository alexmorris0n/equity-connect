"""
Smart model selection for step_criteria generation.

Implements tiered approach:
1. Try GPT-4o-mini (fast, cheap)
2. If fails, try GPT-4o (better quality)
3. If fails, use manual fallbacks

This ensures cost-effectiveness while maintaining quality.
"""

import os
import sys
import logging

# Add prompts to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'prompts'))

from extraction_prompt import EXTRACTION_PROMPT
from signalwire_prompt import SIGNALWIRE_PROMPT
from livekit_prompt import LIVEKIT_PROMPT
from fallbacks import FALLBACK_SIGNALWIRE, FALLBACK_LIVEKIT

logger = logging.getLogger(__name__)


class ModelSelector:
    """
    Handles tiered model selection for step_criteria generation.
    
    Strategy:
    - Primary: GPT-4o-mini (16x cheaper, fast, good for most cases)
    - Fallback: GPT-4o (better quality, handles complex cases)
    - Manual: Hardcoded fallbacks (guaranteed to work)
    """
    
    def __init__(self, openai_client):
        """
        Initialize model selector.
        
        Args:
            openai_client: Initialized OpenAI client
        """
        self.client = openai_client
        self.stats = {
            'mini_success': 0,
            'mini_failed': 0,
            'full_success': 0,
            'full_failed': 0,
            'manual_used': 0
        }
    
    def extract_criteria(self, node_name: str, source: str, model: str = "gpt-4o-mini") -> str:
        """
        Extract core completion logic from mixed criteria.
        
        Args:
            node_name: Name of the node
            source: Original step_criteria from database
            model: Model to use (gpt-4o-mini or gpt-4o)
            
        Returns:
            Extracted completion logic (clean)
        """
        try:
            response = self.client.chat.completions.create(
                model=model,
                messages=[{
                    "role": "user",
                    "content": EXTRACTION_PROMPT.format(
                        node_name=node_name,
                        step_criteria_source=source
                    )
                }],
                temperature=0.0,
                max_tokens=150
            )
            
            result = response.choices[0].message.content.strip()
            result = result.replace('```', '').strip().strip('"').strip("'")
            
            return result
        
        except Exception as e:
            logger.error(f"Extraction failed with {model} for {node_name}: {e}")
            return ""
    
    def generate_signalwire(self, node_name: str, extracted: str, model: str = "gpt-4o-mini") -> str:
        """
        Generate SignalWire-optimized natural language.
        
        Args:
            node_name: Name of the node
            extracted: Extracted completion logic
            model: Model to use (gpt-4o-mini or gpt-4o)
            
        Returns:
            SignalWire-optimized string
        """
        try:
            response = self.client.chat.completions.create(
                model=model,
                messages=[{
                    "role": "user",
                    "content": SIGNALWIRE_PROMPT.format(
                        node_name=node_name,
                        extracted_criteria=extracted
                    )
                }],
                temperature=0.0,
                max_tokens=200
            )
            
            result = response.choices[0].message.content.strip()
            result = result.replace('```', '').strip().strip('"').strip("'")
            
            return result
        
        except Exception as e:
            logger.error(f"SignalWire generation failed with {model} for {node_name}: {e}")
            return ""
    
    def generate_livekit(self, node_name: str, extracted: str, model: str = "gpt-4o-mini") -> str:
        """
        Generate LiveKit boolean expression.
        
        Args:
            node_name: Name of the node
            extracted: Extracted completion logic
            model: Model to use (gpt-4o-mini or gpt-4o)
            
        Returns:
            Boolean expression string
        """
        try:
            response = self.client.chat.completions.create(
                model=model,
                messages=[{
                    "role": "user",
                    "content": LIVEKIT_PROMPT.format(
                        node_name=node_name,
                        extracted_criteria=extracted
                    )
                }],
                temperature=0.0,
                max_tokens=150
            )
            
            result = response.choices[0].message.content.strip()
            result = result.replace('```', '').strip().strip('"').strip("'")
            
            return result
        
        except Exception as e:
            logger.error(f"LiveKit generation failed with {model} for {node_name}: {e}")
            return ""
    
    def validate_livekit(self, expression: str) -> tuple[bool, str]:
        """
        Validate LiveKit expression syntax.
        
        Args:
            expression: Boolean expression to validate
            
        Returns:
            Tuple of (is_valid, error_message)
        """
        if not expression or expression.strip() == "":
            return (False, "Empty expression")
        
        try:
            # Add livekit-agent to path
            sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../livekit-agent'))
            from workflows.step_criteria_evaluator import evaluate_step_criteria
            
            # Try to evaluate with empty state (syntax check only)
            _ = evaluate_step_criteria(expression, {})
            return (True, "")
        
        except Exception as e:
            return (False, str(e))
    
    def generate_with_fallback(self, node_name: str, source: str) -> dict:
        """
        Generate criteria with tiered fallback strategy.
        
        Strategy:
        1. Extract core logic (mini → full → manual)
        2. Generate SignalWire (mini → full → manual)
        3. Generate LiveKit (mini → full → manual + validate)
        
        Args:
            node_name: Name of the node
            source: Original step_criteria from database
            
        Returns:
            Dict with 'sw', 'lk', and 'method' keys
        """
        method_used = "unknown"
        
        # Step 1: Extract core logic
        extracted = self.extract_criteria(node_name, source, "gpt-4o-mini")
        
        if not extracted:
            logger.warning(f"{node_name}: Mini failed extraction, trying full model...")
            extracted = self.extract_criteria(node_name, source, "gpt-4o")
        
        if not extracted:
            logger.warning(f"{node_name}: Full model failed extraction, using original as-is")
            extracted = source  # Use original if extraction fails
        
        # Step 2: Generate SignalWire (try mini first)
        sw_result = self.generate_signalwire(node_name, extracted, "gpt-4o-mini")
        sw_method = "mini"
        
        if not sw_result:
            logger.warning(f"{node_name}: Mini failed SW generation, trying full model...")
            sw_result = self.generate_signalwire(node_name, extracted, "gpt-4o")
            sw_method = "full"
        
        if not sw_result:
            logger.warning(f"{node_name}: Full model failed SW generation, using fallback")
            sw_result = FALLBACK_SIGNALWIRE.get(node_name, f"The {node_name} step is complete.")
            sw_method = "manual"
            self.stats['manual_used'] += 1
        
        # Step 3: Generate LiveKit (try mini first)
        lk_result = self.generate_livekit(node_name, extracted, "gpt-4o-mini")
        lk_method = "mini"
        
        # Validate mini result
        if lk_result:
            is_valid, error = self.validate_livekit(lk_result)
            if is_valid:
                self.stats['mini_success'] += 1
            else:
                logger.warning(f"{node_name}: Mini LK invalid ({error}), trying full model...")
                self.stats['mini_failed'] += 1
                lk_result = ""  # Clear invalid result
        
        # Try full model if mini failed
        if not lk_result:
            lk_result = self.generate_livekit(node_name, extracted, "gpt-4o")
            lk_method = "full"
            
            if lk_result:
                is_valid, error = self.validate_livekit(lk_result)
                if is_valid:
                    self.stats['full_success'] += 1
                else:
                    logger.warning(f"{node_name}: Full LK invalid ({error}), using fallback")
                    self.stats['full_failed'] += 1
                    lk_result = ""  # Clear invalid result
        
        # Use manual fallback if both models failed
        if not lk_result:
            logger.warning(f"{node_name}: All models failed LK generation, using fallback")
            lk_result = FALLBACK_LIVEKIT.get(node_name, "True")
            lk_method = "manual"
            self.stats['manual_used'] += 1
        
        # Determine overall method
        if sw_method == "manual" or lk_method == "manual":
            method_used = "manual_fallback"
        elif sw_method == "full" or lk_method == "full":
            method_used = "gpt-4o"
        else:
            method_used = "gpt-4o-mini"
        
        return {
            'sw': sw_result,
            'lk': lk_result,
            'method': method_used,
            'sw_method': sw_method,
            'lk_method': lk_method
        }
    
    def print_stats(self):
        """Print generation statistics."""
        print("\n" + "=" * 80)
        print("GENERATION STATISTICS")
        print("=" * 80)
        print()
        print(f"GPT-4o-mini:")
        print(f"  Success: {self.stats['mini_success']}")
        print(f"  Failed: {self.stats['mini_failed']}")
        print()
        print(f"GPT-4o (full):")
        print(f"  Success: {self.stats['full_success']}")
        print(f"  Failed: {self.stats['full_failed']}")
        print()
        print(f"Manual fallbacks used: {self.stats['manual_used']}")
        print()
        
        total = self.stats['mini_success'] + self.stats['full_success']
        if total > 0:
            mini_pct = (self.stats['mini_success'] / total) * 100
            print(f"Mini success rate: {mini_pct:.1f}%")
        print()


# Example usage
if __name__ == "__main__":
    """Test model selector with sample data."""
    from openai import OpenAI
    
    # Check API key
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        print("Error: OPENAI_API_KEY not set")
        print("Set it with: export OPENAI_API_KEY='sk-...'")
        sys.exit(1)
    
    client = OpenAI(api_key=api_key)
    selector = ModelSelector(client)
    
    # Test with one node
    test_node = "greet"
    test_source = "Complete after greeting and initial rapport. Route based on their response..."
    
    print("=" * 80)
    print("MODEL SELECTOR TEST")
    print("=" * 80)
    print()
    print(f"Testing node: {test_node}")
    print(f"Source: {test_source[:80]}...")
    print()
    
    result = selector.generate_with_fallback(test_node, test_source)
    
    print("Results:")
    print(f"  Method: {result['method']}")
    print(f"  SW ({result['sw_method']}): {result['sw']}")
    print(f"  LK ({result['lk_method']}): {result['lk']}")
    print()
    
    selector.print_stats()

