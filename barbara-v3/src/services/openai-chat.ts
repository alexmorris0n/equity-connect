import fetch from 'node-fetch';
import { OPENAI_API_KEY, SMS_CONFIG } from '../config.js';
import { logger } from '../utils/logger.js';
import type { ToolDefinition } from './sms-tools.js';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_call_id?: string;
  name?: string;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: {
      name: string;
      arguments: string;
    };
  }>;
}

export interface ChatCompletionResponse {
  message: ChatMessage;
  finishReason: string | null;
}

const OPENAI_CHAT_ENDPOINT = 'https://api.openai.com/v1/chat/completions';

export async function createChatCompletion(
  messages: ChatMessage[],
  tools?: ToolDefinition[]
): Promise<ChatCompletionResponse> {
  const payload: Record<string, any> = {
    model: SMS_CONFIG.model,
    temperature: SMS_CONFIG.temperature,
    messages,
    max_tokens: 512
  };

  if (tools && tools.length > 0) {
    payload.tools = tools;
    payload.tool_choice = 'auto';
  }

  const response = await fetch(OPENAI_CHAT_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error('OpenAI chat completion failed:', response.status, errorText);
    throw new Error(`OpenAI chat completion error: ${response.status}`);
  }

  const json: any = await response.json();
  const choice = json.choices?.[0];

  if (!choice) {
    throw new Error('No completion choices returned from OpenAI');
  }

  const finishReason: string | null = choice.finish_reason ?? null;
  const message: ChatMessage = choice.message;

  return { message, finishReason };
}


