/**
 * Call Evaluation Service
 * 
 * Automated post-call analysis using GPT-5-mini to score calls on key metrics.
 * This enables data-driven prompt optimization and quality monitoring.
 */

import OpenAI from 'openai';
import { logger } from '../utils/logger.js';
import { getSupabaseClient } from './supabase.js';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export interface CallEvaluationScores {
  opening_effectiveness: number;
  property_discussion_quality: number;
  objection_handling: number;
  booking_attempt_quality: number;
  tone_consistency: number;
  overall_call_flow: number;
}

export interface CallEvaluationAnalysis {
  strengths: string[];
  weaknesses: string[];
  objections_handled: string[];
  booking_opportunities_missed: string[];
  red_flags: string[];
  summary: string;
}

export interface CallEvaluationResult {
  scores: CallEvaluationScores;
  analysis: CallEvaluationAnalysis;
  evaluation_duration_ms: number;
}

const EVALUATION_PROMPT = `You are a call quality analyst specializing in reverse mortgage sales calls. Evaluate the following conversation transcript between Barbara (AI assistant) and a potential client.

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
}`;

/**
 * Evaluate a call transcript using GPT-4o-mini
 */
export async function evaluateCall(
  interactionId: string,
  transcript: Array<{ role: string; content: string; timestamp: string }>,
  promptVersion?: string
): Promise<CallEvaluationResult> {
  const startTime = Date.now();
  
  try {
    logger.info(`📊 Starting call evaluation for interaction ${interactionId}`);
    
    // Format transcript for evaluation
    const formattedTranscript = transcript
      .map(turn => `${turn.role === 'user' ? 'Caller' : 'Barbara'}: ${turn.content}`)
      .join('\n\n');
    
    if (!formattedTranscript.trim()) {
      throw new Error('Transcript is empty - cannot evaluate');
    }
    
    // Call GPT-5-mini for evaluation
    const completion = await openai.chat.completions.create({
      model: 'gpt-5-mini',
      messages: [
        { role: 'system', content: EVALUATION_PROMPT },
        { role: 'user', content: `# Conversation Transcript:\n\n${formattedTranscript}` }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3, // Lower temperature for more consistent scoring
      max_tokens: 2000
    });
    
    const result = completion.choices[0]?.message?.content;
    if (!result) {
      throw new Error('No evaluation result from OpenAI');
    }
    
    const parsed = JSON.parse(result);
    const evaluationDuration = Date.now() - startTime;
    
    // Validate structure
    if (!parsed.scores || !parsed.analysis) {
      throw new Error('Invalid evaluation result structure');
    }
    
    // Save to database
    const supabase = getSupabaseClient();
    const { data: evaluation, error } = await supabase
      .from('call_evaluations')
      .insert({
        interaction_id: interactionId,
        opening_effectiveness: parsed.scores.opening_effectiveness,
        property_discussion_quality: parsed.scores.property_discussion_quality,
        objection_handling: parsed.scores.objection_handling,
        booking_attempt_quality: parsed.scores.booking_attempt_quality,
        tone_consistency: parsed.scores.tone_consistency,
        overall_call_flow: parsed.scores.overall_call_flow,
        analysis: parsed.analysis,
        prompt_version: promptVersion || null,
        evaluation_model: 'gpt-5-mini',
        evaluation_duration_ms: evaluationDuration
      })
      .select()
      .single();
    
    if (error) {
      logger.error('Failed to save call evaluation to database:', error);
      throw error;
    }
    
    logger.info(`✅ Call evaluation saved (overall score: ${evaluation.overall_score}/10, duration: ${evaluationDuration}ms)`);
    
    return {
      scores: parsed.scores,
      analysis: parsed.analysis,
      evaluation_duration_ms: evaluationDuration
    };
    
  } catch (error) {
    const evaluationDuration = Date.now() - startTime;
    logger.error(`❌ Call evaluation failed after ${evaluationDuration}ms:`, error);
    throw error;
  }
}

/**
 * Get evaluation stats for a prompt version
 */
export async function getPromptVersionStats(promptVersion: string) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('call_evaluations')
    .select('*')
    .eq('prompt_version', promptVersion);
  
  if (error) {
    logger.error('Failed to fetch prompt version stats:', error);
    throw error;
  }
  
  if (!data || data.length === 0) {
    return null;
  }
  
  // Calculate averages
  const avgScores = {
    opening_effectiveness: average(data.map((e: any) => e.opening_effectiveness)),
    property_discussion_quality: average(data.map((e: any) => e.property_discussion_quality)),
    objection_handling: average(data.map((e: any) => e.objection_handling)),
    booking_attempt_quality: average(data.map((e: any) => e.booking_attempt_quality)),
    tone_consistency: average(data.map((e: any) => e.tone_consistency)),
    overall_call_flow: average(data.map((e: any) => e.overall_call_flow)),
    overall_score: average(data.map((e: any) => e.overall_score))
  };
  
  return {
    prompt_version: promptVersion,
    total_calls: data.length,
    avg_scores: avgScores,
    evaluations: data
  };
}

function average(numbers: number[]): number {
  const valid = numbers.filter(n => n != null);
  if (valid.length === 0) return 0;
  return Math.round((valid.reduce((sum, n) => sum + n, 0) / valid.length) * 100) / 100;
}

