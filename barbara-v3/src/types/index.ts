/**
 * Type Definitions
 */

export type AudioFormat = 'pcm16' | 'g711_ulaw';

export interface StreamingOptions {
  agentConfig: any; // Will be RealtimeAgentConfiguration
  openaiApiKey: string;
  model: string;
}

