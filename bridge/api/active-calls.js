/**
 * Active Calls Intelligence API
 * Returns real-time metrics for live call monitoring dashboard
 */

const { initSupabase } = require('../tools');

/**
 * Analyze sentiment from conversation transcript
 */
function analyzeSentiment(transcript) {
  if (!transcript || transcript.length === 0) return 'neutral';
  
  const userUtterances = transcript
    .filter(t => t.role === 'user')
    .map(t => t.text.toLowerCase())
    .join(' ');
  
  // Positive indicators
  const positiveWords = ['yes', 'sure', 'great', 'perfect', 'sounds good', 'absolutely', 'definitely', 'interested', 'love', 'excited'];
  const positiveCount = positiveWords.filter(word => userUtterances.includes(word)).length;
  
  // Negative indicators
  const negativeWords = ['no', 'not interested', 'too expensive', 'scam', 'spam', 'angry', 'frustrated', 'wrong number', 'stop calling'];
  const negativeCount = negativeWords.filter(word => userUtterances.includes(word)).length;
  
  if (positiveCount > negativeCount * 2) return 'positive';
  if (negativeCount > positiveCount) return 'negative';
  return 'neutral';
}

/**
 * Calculate interest level (0-100)
 */
function calculateInterestLevel(metadata) {
  let score = 50; // Start at neutral
  
  // Positive indicators
  if (metadata?.money_purpose) score += 15;
  if (metadata?.amount_needed) score += 10;
  if (metadata?.timeline === 'urgent') score += 15;
  if (metadata?.questions_asked?.length > 0) score += 10;
  if (metadata?.appointment_scheduled) score += 20;
  
  // Negative indicators
  if (metadata?.objections?.length > 2) score -= 20;
  if (metadata?.objections?.includes('not_interested')) score -= 30;
  
  return Math.max(0, Math.min(100, score));
}

/**
 * Detect buying signals in transcript
 */
function detectBuyingSignals(transcript) {
  const signals = [];
  
  const allText = transcript
    .map(t => t.text.toLowerCase())
    .join(' ');
  
  // Buying signal patterns
  if (allText.includes('when can') || allText.includes('how soon')) {
    signals.push('asked about timing');
  }
  if (allText.includes('schedule') || allText.includes('appointment') || allText.includes('meet')) {
    signals.push('asked to schedule');
  }
  if (allText.includes('how much') || allText.includes('what amount')) {
    signals.push('asked about amount');
  }
  if (allText.includes('next steps') || allText.includes('what happens next')) {
    signals.push('asked about process');
  }
  if (allText.includes('sounds good') || allText.includes('let\'s do it')) {
    signals.push('expressed agreement');
  }
  
  return signals;
}

/**
 * Determine current call phase
 */
function determinePhase(transcript, metadata) {
  const utteranceCount = transcript.length;
  
  // Early in call
  if (utteranceCount < 6) return 'greeting';
  
  // Has metadata indicators
  if (metadata?.appointment_scheduled) return 'closing';
  if (metadata?.money_purpose && metadata?.objections?.length > 0) return 'objection_handling';
  if (metadata?.money_purpose) return 'presenting';
  if (utteranceCount > 6) return 'qualifying';
  
  return 'greeting';
}

/**
 * Calculate talk time ratio
 */
function calculateTalkRatio(transcript) {
  const userWords = transcript
    .filter(t => t.role === 'user')
    .reduce((sum, t) => sum + t.text.split(' ').length, 0);
  
  const barbaraWords = transcript
    .filter(t => t.role === 'assistant')
    .reduce((sum, t) => sum + t.text.split(' ').length, 0);
  
  const total = userWords + barbaraWords;
  if (total === 0) return { user: 0, assistant: 0 };
  
  return {
    user: Math.round((userWords / total) * 100),
    assistant: Math.round((barbaraWords / total) * 100)
  };
}

/**
 * Get active calls with intelligence metrics
 */
async function getActiveCalls() {
  const sb = initSupabase();
  
  try {
    // Get interactions that are in progress (haven't been finalized)
    // We'll use created_at within last 10 minutes as "active"
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    
    const { data: activeInteractions, error } = await sb
      .from('interactions')
      .select(`
        *,
        lead:leads!lead_id(id, first_name, last_name, property_city),
        broker:brokers!broker_id(id, contact_name)
      `)
      .gte('created_at', tenMinutesAgo)
      .is('outcome', null) // outcome is null = call still in progress
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching active calls:', error);
      return [];
    }
    
    if (!activeInteractions || activeInteractions.length === 0) {
      return [];
    }
    
    // Process each active call to extract intelligence
    const callsWithMetrics = activeInteractions.map(interaction => {
      const metadata = interaction.metadata || {};
      const transcript = metadata.conversation_transcript || [];
      const lead = interaction.lead;
      const broker = interaction.broker;
      
      // Calculate metrics
      const sentiment = analyzeSentiment(transcript);
      const interestLevel = calculateInterestLevel(metadata);
      const buyingSignals = detectBuyingSignals(transcript);
      const phase = determinePhase(transcript, metadata);
      const talkRatio = calculateTalkRatio(transcript);
      
      // Calculate duration
      const startTime = new Date(interaction.created_at).getTime();
      const duration = Math.floor((Date.now() - startTime) / 1000);
      
      // Get key topics
      const keyTopics = [];
      if (metadata.money_purpose) keyTopics.push(metadata.money_purpose);
      if (metadata.specific_need) keyTopics.push(metadata.specific_need);
      
      // Get latest buying signal quote
      const latestSignal = buyingSignals.length > 0 
        ? transcript
            .filter(t => t.role === 'user')
            .slice(-3)
            .find(t => 
              t.text.toLowerCase().includes('schedule') ||
              t.text.toLowerCase().includes('when') ||
              t.text.toLowerCase().includes('how much')
            )?.text
        : null;
      
      return {
        call_id: interaction.id,
        lead_name: `${lead?.first_name || ''} ${lead?.last_name || ''}`.trim() || 'Unknown',
        lead_id: lead?.id,
        broker_name: broker?.contact_name || 'Unknown',
        broker_id: broker?.id,
        
        // Time metrics
        duration,
        started_at: interaction.created_at,
        
        // Intelligence metrics
        sentiment: sentiment,
        sentiment_emoji: sentiment === 'positive' ? '😊' : sentiment === 'negative' ? '😠' : '😐',
        interest_level: interestLevel,
        interest_bar: '█'.repeat(Math.floor(interestLevel / 10)) + '░'.repeat(10 - Math.floor(interestLevel / 10)),
        
        // Call progress
        phase: phase,
        phase_display: phase.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
        
        // Topics and signals
        key_topics: keyTopics,
        buying_signals: buyingSignals,
        latest_signal: latestSignal,
        objections: metadata.objections || [],
        
        // Talk time
        talk_ratio: talkRatio,
        utterance_count: transcript.length,
        
        // Status indicators
        appointment_scheduled: metadata.appointment_scheduled || false
      };
    });
    
    return callsWithMetrics;
    
  } catch (err) {
    console.error('Error getting active calls:', err);
    return [];
  }
}

module.exports = {
  getActiveCalls,
  analyzeSentiment,
  calculateInterestLevel,
  detectBuyingSignals
};
