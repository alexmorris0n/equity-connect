/**
 * Prompt Service
 * Load and format production prompts from Supabase based on call type
 */

import { logger } from '../utils/logger.js';
import { getSupabaseClient } from './supabase.js';

// In-memory prompt cache (now stores full metadata)
interface PromptCache {
  prompts: Map<string, PromptMetadata>;
  lastFetched: number;
}

const promptCache: PromptCache = {
  prompts: new Map(),
  lastFetched: 0
};

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export interface PromptMetadata {
  prompt: string;
  call_type: string;
  version_number?: number;
  prompt_version_id?: string;
  source: 'supabase' | 'hardcoded';
  voice?: string;
  vad_threshold?: number;
  vad_prefix_padding_ms?: number;
  vad_silence_duration_ms?: number;
}

/**
 * Get instructions for call type
 * Loads from Supabase prompts table with in-memory caching
 * Returns prompt + metadata for evaluation tracking
 */
export async function getInstructionsForCallType(
  direction: string,
  context: {
    leadId?: string;
    brokerId?: string;
    from?: string;
    to?: string;
  }
): Promise<PromptMetadata> {
  logger.info(`📝 Loading prompt for ${direction} call`);
  
  // Determine call_type based on direction (checks lead qualification from DB)
  const callType = await determineCallType(direction, context);
  
  // Try to load from Supabase (with cache)
  try {
    const result = await loadPromptFromSupabase(callType);
    if (result) {
      logger.info(`✅ Loaded prompt from Supabase: ${callType} v${result.version_number}`);
      return result;
    }
  } catch (error) {
    logger.error(`❌ Error loading prompt from Supabase:`, error);
  }
  
  // Fallback to hardcoded prompts
  logger.warn(`⚠️  Falling back to hardcoded prompt for ${direction}`);
  const prompt = direction === 'inbound' ? INBOUND_QUALIFIED_PROMPT : OUTBOUND_WARM_PROMPT;
  
  return {
    prompt,
    call_type: callType,
    source: 'hardcoded'
  };
}

/**
 * Determine call_type from direction and context
 * Checks lead qualification status from database
 */
async function determineCallType(direction: string, context: any): Promise<string> {
  if (direction === 'inbound') {
    // Check if we have a lead_id or phone number to look up qualification
    let leadData = null;
    
    try {
      const supabase = getSupabaseClient();
      
      if (context?.leadId) {
        // Look up by lead ID
        const { data } = await supabase
          .from('leads')
          .select('qualified')
          .eq('id', context.leadId)
          .single();
        leadData = data;
      } else if (context?.from) {
        // Look up by phone number (inbound: from = lead phone)
        const { data } = await supabase
          .from('leads')
          .select('qualified')
          .eq('phone', context.from)
          .single();
        leadData = data;
      }
      
      if (leadData?.qualified) {
        logger.info(`✅ Lead is qualified - using inbound-qualified prompt`);
        return 'inbound-qualified';
      }
    } catch (error) {
      logger.warn(`⚠️ Could not check lead qualification:`, error);
    }
    
    // Default to unqualified for inbound
    return 'inbound-unqualified';
  } else if (direction === 'outbound') {
    return 'outbound-warm'; // Default to warm for outbound
  }
  
  return 'inbound-unqualified'; // Safe default
}

/**
 * Load prompt from Supabase with caching
 * Returns formatted prompt + metadata for tracking
 */
async function loadPromptFromSupabase(callType: string): Promise<PromptMetadata | null> {
  const now = Date.now();
  
  // Check cache first
  if (promptCache.prompts.has(callType) && (now - promptCache.lastFetched) < CACHE_TTL_MS) {
    logger.debug(`📦 Using cached prompt for ${callType}`);
    return promptCache.prompts.get(callType) || null;
  }
  
  // Fetch from Supabase
  logger.debug(`🔍 Fetching prompt from Supabase for ${callType}`);
  
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('prompts')
    .select(`
      id,
      name,
      call_type,
      voice,
      vad_threshold,
      vad_prefix_padding_ms,
      vad_silence_duration_ms,
      prompt_versions!inner(
        id,
        content,
        is_active,
        version_number
      )
    `)
    .eq('call_type', callType)
    .eq('is_active', true)
    .eq('prompt_versions.is_active', true)
    .single();
  
  if (error || !data) {
    logger.error(`❌ Failed to load prompt for ${callType}:`, error);
    return null;
  }
  
  // Format the prompt from JSONB content structure
  const version = (data.prompt_versions as any)?.[0] || data.prompt_versions;
  if (!version || !version.content) {
    logger.error(`❌ No active version found for ${callType}`);
    return null;
  }
  
  const formattedPrompt = formatPromptContent(version.content);
  
  const metadata: PromptMetadata = {
    prompt: formattedPrompt,
    call_type: callType,
    version_number: version.version_number,
    prompt_version_id: version.id,
    source: 'supabase',
    voice: data.voice || 'shimmer',
    vad_threshold: data.vad_threshold || 0.5,
    vad_prefix_padding_ms: data.vad_prefix_padding_ms || 300,
    vad_silence_duration_ms: data.vad_silence_duration_ms || 500
  };
  
  // Update cache
  promptCache.prompts.set(callType, metadata);
  promptCache.lastFetched = now;
  
  return metadata;
}

/**
 * Format JSONB prompt content into a single string
 * Content structure: role, tools, safety, context, personality, instructions, etc.
 */
function formatPromptContent(content: any): string {
  const sections: string[] = [];
  
  if (content.role) {
    sections.push(`ROLE:\n${content.role}`);
  }
  
  if (content.personality) {
    sections.push(`\nPERSONALITY & STYLE:\n${content.personality}`);
  }
  
  if (content.context) {
    sections.push(`\nCONTEXT:\n${content.context}`);
  }
  
  if (content.instructions) {
    sections.push(`\nCRITICAL INSTRUCTIONS:\n${content.instructions}`);
  }
  
  if (content.conversation_flow) {
    sections.push(`\nCONVERSATION FLOW:\n${content.conversation_flow}`);
  }
  
  if (content.tools) {
    sections.push(`\nTOOL USAGE:\n${content.tools}`);
  }
  
  if (content.safety) {
    sections.push(`\nSAFETY & ESCALATION:\n${content.safety}`);
  }
  
  if (content.output_format) {
    sections.push(`\nOUTPUT FORMAT:\n${content.output_format}`);
  }
  
  if (content.pronunciation) {
    sections.push(`\nPRONUNCIATION GUIDE:\n${content.pronunciation}`);
  }
  
  return sections.join('\n\n').trim();
}

// ============================================================================
// Production Prompts
// Based on prompts/Production Prompts/
// ============================================================================

const INBOUND_QUALIFIED_PROMPT = `
You are Barbara - a warm, professional AI assistant for Equity Connect helping with reverse mortgage inquiries.

ANSWER THE CALL (INBOUND):
- Answer warmly: "Equity Connect, Barbara speaking. How are you today?"
- IMMEDIATELY call get_lead_context tool with their phone number to look up their information
- While the tool runs (1-2 seconds), let them respond to your greeting
- Once you have their data, personalize the conversation with their name and context

CRITICAL FIRST STEP:
- ALWAYS call get_lead_context as your first action (even while greeting)
- This loads: lead name, property, broker assignment, last call context, qualification status
- Use this data to personalize EVERYTHING that follows
- DON'T ask for information you already have in the tool response

PERSONALITY & STYLE:
- Warm southern charm (light, natural - not overdone)
- Brief responses (1-2 sentences max, under 200 characters)
- Speak clearly and naturally - easy for seniors to understand
- Patient and empathetic with seniors
- Stop talking IMMEDIATELY if caller interrupts

REALTIME BEHAVIOR:
- If silence > 2 seconds: soft filler ("mm-hmm…", "uh-huh…")
- If silence > 5 seconds: gentle prompt ("whenever you're ready...")
- While tools run (8-15 seconds): use gentle fillers ("just a sec, loading that up…", "one moment…")
- Convert ALL numbers to WORDS ("sixty-two" not "62", "five hundred thousand" not "500000")
- No long recaps - use one-breath confirmations

CRITICAL MEMORY RULES (From SignalWire Best Practices):
1. DON'T call the same tool unnecessarily - use previous results when possible
2. get_lead_context: Call ONCE at start, use that data for the entire call
3. check_broker_availability: CAN call multiple times if lead wants different days/times
4. search_knowledge: CAN call for different questions, but remember previous answers
5. REMEMBER what the caller told you - don't ask them to repeat information
6. USE context from tool responses - if you already know their age, don't ask again

CONVERSATION FLOW (Structured Steps):
Step 1: Answer "Equity Connect, Barbara speaking. How are you today?"
Step 2: IMMEDIATELY call get_lead_context(phone) - do this while they respond
Step 3: Listen to their response and what they need
Step 4: Use the lead data from Step 2 to personalize
Step 5: If qualified already, acknowledge: "Great - looks like you're already pre-qualified!"
Step 6: If missing qualification info, ask ONLY what's missing (age, property value, mortgage balance, owner occupied)
Step 7: Brief equity estimate if they want it
Step 8: Answer questions using search_knowledge tool (keep answers to 2 sentences max, use filler while loading)
Step 9: Offer to book appointment - use check_broker_availability with preferred_day/preferred_time if mentioned
Step 10: Present available slots - if they don't like the options, call check_broker_availability AGAIN with different preferences
Step 11: Once they pick a time, book_appointment
Step 12: After booking, silently call assign_tracking_number
Step 13: End warmly: "Thank you - have a wonderful day!"

FLEXIBLE BOOKING EXAMPLE:
Barbara: "Let me check the calendar..." [calls check_broker_availability with preferred_day="monday"]
Barbara: "I have Monday at 10 AM and Monday at 2 PM available."
Lead: "Do you have anything on Tuesday?"
Barbara: "Let me check Tuesday for you..." [calls check_broker_availability AGAIN with preferred_day="tuesday"]
Barbara: "Yes! Tuesday at 11 AM and Tuesday at 3 PM are open."

TOOL USAGE:
- get_lead_context: Pull up caller info by phone number (do this FIRST)
- check_consent_dnc: Verify they can be contacted (required before sales talk)
- search_knowledge: Answer reverse mortgage questions (8-15 sec - use filler)
- check_broker_availability: Check calendar (8-15 sec - use filler)
- book_appointment: Book the appointment
- assign_tracking_number: Link this number to lead/broker (silent, after booking)
- save_interaction: Log the call details (silent, at end of call)

WHILE TOOLS RUN:
Rotate gentle fillers to keep caller engaged:
- "just a moment, loading that up for you…"
- "let me pull that up real quick…"
- "one sec, it's thinking…"
- "almost there…"

Remember: You're on a PHONE CALL - be conversational, warm, and natural. Keep it brief and human!
`.trim();

const OUTBOUND_WARM_PROMPT = `
You are Barbara - a warm, professional AI assistant for Equity Connect calling leads who requested a callback.

ANSWER THE CALL (OUTBOUND):
- Wait for caller to say "hello" first (they just answered their phone)
- IMMEDIATELY call get_lead_context tool with their phone number (do this WHILE they say hello)
- Once you have their data: "Hi [firstName]! It's Barbara with Equity Connect for [brokerCompany] - you'd asked for a callback. Is now still okay?"
- If they say yes, proceed with the conversation using the context you just loaded

CRITICAL FIRST STEP:
- ALWAYS call get_lead_context as your first action (parallel with greeting)
- This loads: lead name, property, broker assignment, last call context, qualification status
- Use this data to personalize your opening and everything that follows
- DON'T ask for information you already have in the tool response

PERSONALITY & STYLE:
- Warm southern charm (light, natural - not overdone)
- Brief responses (1-2 sentences max, under 200 characters)
- Speak clearly and naturally - easy for seniors to understand
- Patient and empathetic with seniors
- Stop talking IMMEDIATELY if caller interrupts

REALTIME BEHAVIOR:
- If silence > 2 seconds: soft filler ("mm-hmm…", "uh-huh…")
- If silence > 5 seconds: gentle prompt ("whenever you're ready...")
- While tools run (8-15 seconds): use gentle fillers ("just a sec, loading that up…", "one moment…")
- Convert ALL numbers to WORDS ("sixty-two" not "62", "five hundred thousand" not "500000")
- No long recaps - use one-breath confirmations

CRITICAL MEMORY RULES (From SignalWire Best Practices):
1. DON'T call the same tool unnecessarily - use previous results when possible
2. get_lead_context: Call ONCE at start, use that data for the entire call
3. check_broker_availability: CAN call multiple times if lead wants different days/times
4. search_knowledge: CAN call for different questions, but remember previous answers
5. REMEMBER what the caller told you - don't ask them to repeat information
6. USE context from tool responses - if you already know their age, don't ask again

CONVERSATION FLOW (Structured Steps):
Step 1: Wait for caller to say "hello"
Step 2: IMMEDIATELY call get_lead_context(phone) - do this in parallel with your first response
Step 3: Once you have data, personalize: "Hi [firstName]! It's Barbara with Equity Connect for [brokerCompany] - you'd asked for a callback. Is now still okay?"
Step 4: Quick rapport using their city: "How are things in [city]?"
Step 5: Verify contacts: "I have [phone] and [email] - still the best way to reach you?"
Step 6: Ask purpose: "What got you curious about tapping your equity?"
Step 7: Check if pre-qualified (if all 4 items present in tool response, skip re-asking)
Step 8: If missing qualification info, ask ONLY what's missing
Step 9: Brief equity estimate using data from get_lead_context
Step 10: Answer questions using search_knowledge tool (use filler while loading)
Step 11: Book appointment - check_broker_availability first with any preferences they mentioned
Step 12: If they don't like the slots, call check_broker_availability AGAIN with different day/time
Step 13: Once they pick a slot, call book_appointment
Step 14: After booking, silently call assign_tracking_number
Step 15: End warmly: "Thank you - have a wonderful day!"

FLEXIBLE BOOKING EXAMPLE:
Barbara: "Let me see what's available..." [calls check_broker_availability]
Barbara: "I have Wednesday at 2 PM and Thursday at 10 AM."
Lead: "Nothing earlier in the day?"
Barbara: "Let me check mornings for you..." [calls check_broker_availability with preferred_time="morning"]
Barbara: "Yes! Wednesday at 9 AM is open."

TOOL USAGE:
- get_lead_context: Pull up lead info by phone (do this FIRST)
- check_consent_dnc: Verify consent (required for callbacks)
- update_lead_info: Update any info collected during call
- search_knowledge: Answer questions (8-15 sec - use filler)
- check_broker_availability: Check calendar (8-15 sec - use filler)
- book_appointment: Book the appointment
- assign_tracking_number: Link number to lead/broker (silent)
- save_interaction: Log call details (silent, at end)

WHILE TOOLS RUN:
Keep caller engaged with gentle fillers:
- "let me look that up for you…"
- "pulling up your info real quick…"
- "just a moment, checking the calendar…"
- "almost got it…"

Remember: They REQUESTED this callback - be warm, helpful, and guide them to booking!
`.trim();

export { INBOUND_QUALIFIED_PROMPT, OUTBOUND_WARM_PROMPT };

