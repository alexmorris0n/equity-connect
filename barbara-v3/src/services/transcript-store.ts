/**
 * Conversation Transcript Storage
 * In-memory store for active call transcripts
 * Maps session/call IDs to their conversation history
 */

export interface TranscriptEntry {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

// In-memory storage for active call transcripts
// Key: session ID or call identifier
// Value: array of transcript entries
const transcriptStore = new Map<string, TranscriptEntry[]>();

/**
 * Set or update transcript for a call session
 */
export function setTranscript(sessionId: string, transcript: TranscriptEntry[]): void {
  transcriptStore.set(sessionId, transcript);
}

/**
 * Get transcript for a call session
 */
export function getTranscript(sessionId: string): TranscriptEntry[] | null {
  return transcriptStore.get(sessionId) || null;
}

/**
 * Clear transcript for a call session (cleanup after call ends)
 */
export function clearTranscript(sessionId: string): void {
  transcriptStore.delete(sessionId);
}

/**
 * Get current active session ID (simple implementation - just the latest)
 * In production with multiple concurrent calls, you'd use proper session tracking
 */
let currentSessionId: string | null = null;

export function setCurrentSessionId(id: string): void {
  currentSessionId = id;
}

export function getCurrentSessionId(): string | null {
  return currentSessionId;
}

/**
 * Get current active call's transcript
 */
export function getCurrentTranscript(): TranscriptEntry[] | null {
  if (!currentSessionId) return null;
  return getTranscript(currentSessionId);
}

