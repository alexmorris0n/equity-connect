"""Post-call evaluation service"""
from typing import List, Dict, Any, Optional
from supabase import Client
from services.supabase import get_supabase_client
from config import Config
import logging
import json

logger = logging.getLogger(__name__)

EVALUATION_PROMPT = """You are a call quality analyst specializing in reverse mortgage sales calls. Evaluate the following conversation transcript between Barbara (AI assistant) and a potential client.

Score each metric from 0-10 where:
- 0-3: Poor/Needs significant improvement
- 4-6: Acceptable/Needs minor improvement
- 7-8: Good/Effective
- 9-10: Excellent/Best practice

# Evaluation Metrics:

1. **Opening Effectiveness (0-10)**: Did Barbara establish rapport, confirm the caller's name, and set a positive tone?

2. **Property Discussion Quality (0-10)**: How well did Barbara gather property details (location, value, mortgage status)?

3. **Objection Handling (0-10)**: How effectively did Barbara address concerns and reframe objections?

4. **Booking Attempt Quality (0-10)**: Did Barbara make clear, confident appointment booking attempts? Did she use tie-downs?

5. **Tone Consistency (0-10)**: Was Barbara conversational, empathetic, and professional throughout?

6. **Overall Call Flow (0-10)**: Did the conversation follow a logical progression? Was it too rushed or too slow?

# Analysis Categories:

- **Strengths**: What did Barbara do well? (2-4 specific examples)
- **Weaknesses**: What could be improved? (2-4 specific examples)
- **Objections Handled**: List any objections the caller raised and how Barbara addressed them
- **Booking Opportunities Missed**: Did Barbara miss clear chances to book an appointment?
- **Red Flags**: Any concerning patterns (talking over caller, pushy behavior, incorrect information)
- **Summary**: 2-3 sentence overall assessment

Return your evaluation as a JSON object with this exact structure:
{
  "scores": {
    "opening_effectiveness": 0-10,
    "property_discussion_quality": 0-10,
    "objection_handling": 0-10,
    "booking_attempt_quality": 0-10,
    "tone_consistency": 0-10,
    "overall_call_flow": 0-10
  },
  "analysis": {
    "strengths": ["...", "..."],
    "weaknesses": ["...", "..."],
    "objections_handled": ["...", "..."],
    "booking_opportunities_missed": ["...", "..."],
    "red_flags": ["...", "..."],
    "summary": "..."
  }
}"""

async def evaluate_call(
    interaction_id: str,
    transcript: List[Dict[str, Any]],
    prompt_version: Optional[str] = None
) -> None:
    """
    Evaluate a call using GPT-5-mini and save to call_evaluations table
    
    Args:
        interaction_id: Interaction ID
        transcript: Transcript array with role/text/timestamp
        prompt_version: Prompt version string (e.g., 'inbound-qualified-v7')
    """
    if not Config.OPENAI_API_KEY:
        logger.warning("⚠️ OPENAI_API_KEY not set - skipping evaluation")
        return
    
    try:
        from openai import OpenAI
        openai_client = OpenAI(api_key=Config.OPENAI_API_KEY)
        
        logger.info(f"📊 Starting AI evaluation for interaction {interaction_id}")
        
        if not transcript or len(transcript) == 0:
            logger.warning("⚠️ No transcript to evaluate")
            return
        
        # Format transcript
        formatted_transcript = '\n\n'.join([
            f"{'Caller' if msg.get('role') == 'user' else 'Barbara'}: {msg.get('text', msg.get('content', ''))}"
            for msg in transcript
            if msg.get('text') or msg.get('content')
        ])
        
        if not formatted_transcript.strip():
            logger.warning("⚠️ Transcript is empty after formatting")
            return
        
        # Call GPT-5-mini
        import time
        start_time = time.time()
        
        completion = openai_client.chat.completions.create(
            model='gpt-5-mini',
            messages=[
                {'role': 'system', 'content': EVALUATION_PROMPT},
                {'role': 'user', 'content': f"# Conversation Transcript:\n\n{formatted_transcript}"}
            ],
            response_format={'type': 'json_object'},
            max_completion_tokens=2000
        )
        
        result_text = completion.choices[0].message.content
        if not result_text:
            raise Exception("No evaluation result from OpenAI")
        
        parsed = json.loads(result_text)
        evaluation_duration_ms = int((time.time() - start_time) * 1000)
        
        # Validate structure
        if not parsed.get('scores') or not parsed.get('analysis'):
            raise Exception("Invalid evaluation result structure")
        
        # Calculate overall score
        scores = parsed['scores']
        overall_score = sum(scores.values()) / len(scores)
        
        # Save to database
        supabase = get_supabase_client()
        response = supabase.table('call_evaluations')\
            .insert({
                'interaction_id': interaction_id,
                'opening_effectiveness': scores['opening_effectiveness'],
                'property_discussion_quality': scores['property_discussion_quality'],
                'objection_handling': scores['objection_handling'],
                'booking_attempt_quality': scores['booking_attempt_quality'],
                'tone_consistency': scores['tone_consistency'],
                'overall_call_flow': scores['overall_call_flow'],
                'overall_score': round(overall_score, 2),
                'analysis': parsed['analysis'],
                'prompt_version': prompt_version,
                'prompt_registry_id': prompt_version.split('-v')[0] if prompt_version and '-v' in prompt_version else None,
                'evaluation_model': 'gpt-5-mini',
                'evaluation_duration_ms': evaluation_duration_ms,
            })\
            .execute()
        
        logger.info(f"✅ AI evaluation saved (score: {overall_score:.1f}/10, duration: {evaluation_duration_ms}ms)")
        
    except Exception as err:
        logger.error(f"❌ AI evaluation error: {err}")
        # Don't raise - evaluation failure shouldn't break interaction save

