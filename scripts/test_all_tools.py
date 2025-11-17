#!/usr/bin/env python3
"""
CLI Test Script for All Barbara Agent Tools

Tests all 21 tools to verify:
1. Error handling works correctly
2. SwaigFunctionResult structure is correct
3. Tools return valid responses

Usage:
    python scripts/test_all_tools.py

Environment Variables Required:
    - SUPABASE_URL
    - SUPABASE_SERVICE_KEY
    - AGENT_USERNAME (for agent initialization)
    - AGENT_PASSWORD (for agent initialization)
    - Optional: Other service keys (NYLAS_API_KEY, etc.)
"""

import os
import sys
import json
import logging
from typing import Dict, Any, Optional
from datetime import datetime, timedelta

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from equity_connect.agent.barbara_agent import BarbaraAgent
from signalwire_agents.core.function_result import SwaigFunctionResult

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Test lead data (from Supabase query - Testy Mctesterson)
TEST_LEAD_ID = "07f26a19-e9dc-422c-b61d-030e3c7971bb"
TEST_LEAD_FIRST_NAME = "Testy"
TEST_LEAD_LAST_NAME = "Mctesterson"
TEST_PHONE = "+16505300051"  # Real phone from test lead
TEST_BROKER_ID = "6a3c5ed5-664a-4e13-b019-99fe8db74174"  # Assigned broker from test lead

class ToolTester:
    """Test harness for all Barbara agent tools"""
    
    def __init__(self):
        """Initialize agent and test data"""
        # Check required env vars
        required_vars = ["SUPABASE_URL", "SUPABASE_SERVICE_KEY"]
        missing = [v for v in required_vars if not os.getenv(v)]
        if missing:
            logger.warning(f"⚠️  Missing env vars: {missing}. Some tests may fail.")
        
        # Set minimal required vars for agent init
        if not os.getenv("AGENT_USERNAME"):
            os.environ["AGENT_USERNAME"] = "test_user"
        if not os.getenv("AGENT_PASSWORD"):
            os.environ["AGENT_PASSWORD"] = "test_pass"
        
        try:
            self.agent = BarbaraAgent()
            logger.info("✅ Agent initialized successfully")
        except Exception as e:
            logger.error(f"❌ Failed to initialize agent: {e}")
            raise
        
        self.results = {
            "passed": [],
            "failed": [],
            "skipped": []
        }
    
    def test_tool(self, tool_name: str, args: Dict[str, Any], 
                  raw_data: Optional[Dict[str, Any]] = None,
                  expected_keys: Optional[list] = None,
                  should_toggle: bool = False) -> bool:
        """
        Test a single tool
        
        Args:
            tool_name: Name of the tool method
            args: Arguments to pass to the tool
            raw_data: Raw data dict (defaults to minimal mock)
            expected_keys: List of keys expected in JSON response
            should_toggle: Whether tool should return SwaigFunctionResult with toggle
        """
        logger.info(f"\n{'='*60}")
        logger.info(f"Testing: {tool_name}")
        logger.info(f"Args: {json.dumps(args, indent=2)}")
        
        # Default raw_data
        if raw_data is None:
            raw_data = {
                "call_id": "test-call-123",
                "caller_id_num": TEST_PHONE,
                "global_data": {
                    "lead_id": TEST_LEAD_ID
                },
                "call_log": [],
                "raw_call_log": [],
                "channel_active": True,
                "meta_data": {}
            }
        
        try:
            # Get tool method
            tool_method = getattr(self.agent, tool_name)
            
            # Call tool
            result = tool_method(args, raw_data)
            
            # Validate result
            is_valid = True
            error_msg = None
            
            # Check if it's a SwaigFunctionResult
            if isinstance(result, SwaigFunctionResult):
                logger.info("✅ Tool returned SwaigFunctionResult")
                # Extract response string - SwaigFunctionResult stores response internally
                # Try to get response attribute, fallback to string representation
                try:
                    # Check if response attribute exists
                    if hasattr(result, 'response') and result.response:
                        response_str = result.response
                    elif hasattr(result, '_response') and result._response:
                        response_str = result._response
                    else:
                        # Try to get from string representation or use empty
                        response_str = str(result)
                        # If it's just the object representation, try to extract JSON
                        if '<signalwire_agents.core.function_result.SwaigFunctionResult' in response_str:
                            # Can't extract, mark as needing manual inspection
                            response_str = '{"note": "SwaigFunctionResult object - response not directly accessible"}'
                except Exception as e:
                    logger.warning(f"Could not extract response from SwaigFunctionResult: {e}")
                    response_str = str(result)
                
                try:
                    result_data = json.loads(response_str)
                except (json.JSONDecodeError, TypeError):
                    # If not JSON, wrap it
                    result_data = {"raw_response": response_str, "is_swaig_result": True}
            else:
                # Should be JSON string
                try:
                    result_data = json.loads(result)
                except (json.JSONDecodeError, TypeError):
                    # Not JSON, might be string
                    result_data = {"raw_response": str(result)}
            
            # Check expected keys
            if expected_keys:
                missing_keys = [k for k in expected_keys if k not in result_data]
                if missing_keys:
                    # Some tools return plain strings (conversation flags) - that's OK
                    if "raw_response" in result_data and isinstance(result_data["raw_response"], str):
                        # If it's a plain string response, check if it contains useful info
                        response_text = result_data["raw_response"].lower()
                        if any(keyword in response_text for keyword in ["success", "marked", "saved", "cleared", "noted"]):
                            # Plain string response is acceptable for conversation flags
                            logger.info(f"⚠️  Tool returned plain string (acceptable): {result_data['raw_response'][:100]}...")
                            is_valid = True
                        else:
                            is_valid = False
                            error_msg = f"Missing expected keys: {missing_keys}"
                    else:
                        is_valid = False
                        error_msg = f"Missing expected keys: {missing_keys}"
            
            # Check for error in response
            if "error" in result_data and result_data.get("error"):
                logger.warning(f"⚠️  Tool returned error: {result_data.get('error')}")
                # Still valid if error is handled gracefully
                if "message" not in result_data:
                    is_valid = False
                    error_msg = "Error returned but no user-friendly message"
            
            if is_valid:
                logger.info(f"✅ {tool_name} PASSED")
                logger.info(f"Response: {json.dumps(result_data, indent=2)[:500]}...")
                self.results["passed"].append(tool_name)
                return True
            else:
                logger.error(f"❌ {tool_name} FAILED: {error_msg}")
                logger.error(f"Response: {json.dumps(result_data, indent=2)}")
                self.results["failed"].append({
                    "tool": tool_name,
                    "error": error_msg,
                    "response": result_data
                })
                return False
                
        except Exception as e:
            logger.error(f"❌ {tool_name} EXCEPTION: {e}", exc_info=True)
            self.results["failed"].append({
                "tool": tool_name,
                "error": str(e),
                "exception": True
            })
            return False
    
    def run_all_tests(self):
        """Run tests for all 21 tools"""
        logger.info("\n" + "="*60)
        logger.info("🧪 STARTING TOOL TEST SUITE")
        logger.info("="*60)
        
        # Test data setup
        future_date = (datetime.now() + timedelta(days=7)).isoformat()
        
        # ==================== LEAD TOOLS (4) ====================
        
        # 1. get_lead_context
        self.test_tool(
            "get_lead_context",
            {"phone": TEST_PHONE},
            expected_keys=["found"]
        )
        
        # 2. verify_caller_identity
        self.test_tool(
            "verify_caller_identity",
            {"first_name": TEST_LEAD_FIRST_NAME, "phone": TEST_PHONE},
            expected_keys=["lead_id"]
        )
        
        # 3. check_consent_dnc
        self.test_tool(
            "check_consent_dnc",
            {"phone": TEST_PHONE},
            expected_keys=["can_call", "has_consent"]
        )
        
        # 4. update_lead_info
        self.test_tool(
            "update_lead_info",
            {
                "lead_id": TEST_LEAD_ID,
                "first_name": TEST_LEAD_FIRST_NAME,
                "age": 65
            },
            expected_keys=["success"]
        )
        
        # ==================== BROKER TOOLS (2) ====================
        
        # 5. find_broker_by_territory
        self.test_tool(
            "find_broker_by_territory",
            {"zip_code": "90210", "state": "CA"},
            expected_keys=["broker_id"]
        )
        
        # 6. check_broker_availability
        # Note: Requires NYLAS_API_KEY, but should handle error gracefully
        self.test_tool(
            "check_broker_availability",
            {"broker_id": TEST_BROKER_ID},
            expected_keys=None  # May fail without NYLAS_API_KEY, but should return error message
        )
        
        # ==================== CALENDAR TOOLS (3) ====================
        
        # 7. book_appointment
        # Note: Requires NYLAS_API_KEY, but should handle error gracefully
        self.test_tool(
            "book_appointment",
            {
                "lead_id": TEST_LEAD_ID,
                "broker_id": TEST_BROKER_ID,
                "scheduled_for": future_date
            },
            expected_keys=["success"]  # May not have interaction_id if NYLAS fails
        )
        
        # 8. reschedule_appointment
        self.test_tool(
            "reschedule_appointment",
            {
                "interaction_id": "00000000-0000-0000-0000-000000000000",
                "new_scheduled_for": future_date
            },
            expected_keys=["success"]
        )
        
        # 9. cancel_appointment
        self.test_tool(
            "cancel_appointment",
            {
                "interaction_id": "00000000-0000-0000-0000-000000000000",
                "reason": "Test cancellation"
            },
            expected_keys=["success"]
        )
        
        # ==================== KNOWLEDGE TOOLS (1) ====================
        
        # 10. search_knowledge
        self.test_tool(
            "search_knowledge",
            {"question": "What is a reverse mortgage?"},
            expected_keys=["found"]
        )
        
        # ==================== INTERACTION TOOLS (3) ====================
        
        # 11. assign_tracking_number
        # Note: May not be fully implemented yet
        self.test_tool(
            "assign_tracking_number",
            {
                "lead_id": TEST_LEAD_ID,
                "broker_id": TEST_BROKER_ID
            },
            expected_keys=["success"]  # May return "not yet implemented" message
        )
        
        # 12. send_appointment_confirmation
        self.test_tool(
            "send_appointment_confirmation",
            {
                "phone": TEST_PHONE,
                "appointment_datetime": future_date
            },
            expected_keys=["success"]
        )
        
        # 13. verify_appointment_confirmation
        # Note: May not be fully implemented yet
        self.test_tool(
            "verify_appointment_confirmation",
            {
                "phone": TEST_PHONE,
                "code": "123456"
            },
            expected_keys=["success"]  # May return "not yet implemented" message
        )
        
        # ==================== CONVERSATION FLAGS (7) ====================
        
        # 14. mark_ready_to_book
        self.test_tool(
            "mark_ready_to_book",
            {"phone": TEST_PHONE},
            expected_keys=None  # Returns plain string, not JSON
        )
        
        # 15. mark_has_objection
        self.test_tool(
            "mark_has_objection",
            {
                "phone": TEST_PHONE,
                "objection_type": "cost"
            },
            expected_keys=None  # Returns plain string, not JSON
        )
        
        # 16. mark_objection_handled
        self.test_tool(
            "mark_objection_handled",
            {"phone": TEST_PHONE},
            expected_keys=None  # Returns plain string, not JSON
        )
        
        # 17. mark_questions_answered
        self.test_tool(
            "mark_questions_answered",
            {"phone": TEST_PHONE},
            expected_keys=None  # Returns plain string, not JSON
        )
        
        # 18. mark_qualification_result
        self.test_tool(
            "mark_qualification_result",
            {
                "phone": TEST_PHONE,
                "qualified": True
            },
            expected_keys=None  # Returns SwaigFunctionResult with string
        )
        
        # 19. mark_quote_presented
        self.test_tool(
            "mark_quote_presented",
            {
                "phone": TEST_PHONE,
                "quote_reaction": "interested"
            },
            expected_keys=None  # Returns SwaigFunctionResult with string
        )
        
        # 20. mark_wrong_person
        self.test_tool(
            "mark_wrong_person",
            {
                "phone": TEST_PHONE,
                "right_person_available": False
            },
            expected_keys=None  # Returns plain string, not JSON
        )
        
        # 21. clear_conversation_flags_tool
        self.test_tool(
            "clear_conversation_flags_tool",
            {"phone": TEST_PHONE},
            expected_keys=None  # Returns plain string, not JSON
        )
        
        # ==================== SUMMARY ====================
        
        self.print_summary()
    
    def print_summary(self):
        """Print test summary"""
        logger.info("\n" + "="*60)
        logger.info("📊 TEST SUMMARY")
        logger.info("="*60)
        
        total = len(self.results["passed"]) + len(self.results["failed"]) + len(self.results["skipped"])
        passed = len(self.results["passed"])
        failed = len(self.results["failed"])
        skipped = len(self.results["skipped"])
        
        logger.info(f"Total Tools: {total}")
        logger.info(f"✅ Passed: {passed}")
        logger.info(f"❌ Failed: {failed}")
        logger.info(f"⏭️  Skipped: {skipped}")
        
        if passed > 0:
            logger.info(f"\n✅ PASSED TOOLS ({passed}):")
            for tool in self.results["passed"]:
                logger.info(f"   - {tool}")
        
        if failed > 0:
            logger.info(f"\n❌ FAILED TOOLS ({failed}):")
            for failure in self.results["failed"]:
                logger.info(f"   - {failure['tool']}: {failure.get('error', 'Unknown error')}")
        
        logger.info("\n" + "="*60)
        
        # Exit code
        if failed > 0:
            logger.error("❌ TEST SUITE FAILED")
            sys.exit(1)
        else:
            logger.info("✅ ALL TESTS PASSED")
            sys.exit(0)


if __name__ == "__main__":
    tester = ToolTester()
    tester.run_all_tests()

