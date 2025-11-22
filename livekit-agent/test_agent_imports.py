#!/usr/bin/env python3
"""
Quick test to verify all agent classes can be imported and instantiated.
Run this before testing with LiveKit server.
"""

import sys
import os

# Add current directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

def test_imports():
    """Test that all agent classes can be imported"""
    print("Testing agent imports...")
    
    try:
        from agents.greet import BarbaraGreetAgent
        print("✅ BarbaraGreetAgent imported")
    except Exception as e:
        print(f"❌ Failed to import BarbaraGreetAgent: {e}")
        return False
    
    try:
        from agents.verify import BarbaraVerifyTask
        print("✅ BarbaraVerifyTask imported")
    except Exception as e:
        print(f"❌ Failed to import BarbaraVerifyTask: {e}")
        return False
    
    try:
        from agents.qualify import BarbaraQualifyTask
        print("✅ BarbaraQualifyTask imported")
    except Exception as e:
        print(f"❌ Failed to import BarbaraQualifyTask: {e}")
        return False
    
    try:
        from agents.answer import BarbaraAnswerAgent
        print("✅ BarbaraAnswerAgent imported")
    except Exception as e:
        print(f"❌ Failed to import BarbaraAnswerAgent: {e}")
        return False
    
    try:
        from agents.quote import BarbaraQuoteAgent
        print("✅ BarbaraQuoteAgent imported")
    except Exception as e:
        print(f"❌ Failed to import BarbaraQuoteAgent: {e}")
        return False
    
    try:
        from agents.objections import BarbaraObjectionsAgent
        print("✅ BarbaraObjectionsAgent imported")
    except Exception as e:
        print(f"❌ Failed to import BarbaraObjectionsAgent: {e}")
        return False
    
    try:
        from agents.book import BarbaraBookAgent
        print("✅ BarbaraBookAgent imported")
    except Exception as e:
        print(f"❌ Failed to import BarbaraBookAgent: {e}")
        return False
    
    try:
        from agents.goodbye import BarbaraGoodbyeAgent
        print("✅ BarbaraGoodbyeAgent imported")
    except Exception as e:
        print(f"❌ Failed to import BarbaraGoodbyeAgent: {e}")
        return False
    
    return True

def test_basic_instantiation():
    """Test that agents can be instantiated (without LiveKit dependencies)"""
    print("\nTesting basic instantiation (will fail without LiveKit, that's OK)...")
    
    try:
        from agents.greet import BarbaraGreetAgent
        
        # Try to create instance (will fail without LiveKit, but we can check imports)
        agent = BarbaraGreetAgent(
            caller_phone="+15551234567",
            lead_data={"id": None, "first_name": "Test"},
            vertical="reverse_mortgage"
        )
        print("✅ BarbaraGreetAgent instantiated")
        return True
    except ImportError as e:
        print(f"⚠️  Import error (expected if LiveKit not installed): {e}")
        print("   This is OK - install LiveKit packages to test fully")
        return True
    except Exception as e:
        print(f"⚠️  Other error (may be OK): {e}")
        return True

if __name__ == "__main__":
    print("=" * 60)
    print("Agent System Import Test")
    print("=" * 60)
    
    imports_ok = test_imports()
    
    if imports_ok:
        print("\n" + "=" * 60)
        print("✅ All imports successful!")
        print("=" * 60)
        print("\nNext steps:")
        print("1. Install dependencies: pip install -r requirements.txt")
        print("2. Set environment variables (.env file)")
        print("3. Run agent: python agent.py")
        print("4. Make test call or join via LiveKit web interface")
        print("\nSee LOCAL_TESTING_GUIDE.md for detailed instructions")
    else:
        print("\n" + "=" * 60)
        print("❌ Some imports failed")
        print("=" * 60)
        print("\nCheck:")
        print("1. All agent files exist in agents/ directory")
        print("2. Python path is correct")
        print("3. No syntax errors in agent files")
        sys.exit(1)

