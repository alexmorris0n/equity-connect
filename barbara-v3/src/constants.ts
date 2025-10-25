/**
 * Application Constants
 * Shared constants used across the application
 */

// Audio formats
export const AUDIO_FORMAT = {
  PCM16: 'pcm16',
  G711_ULAW: 'g711_ulaw'
} as const;

// SignalWire codec mappings
export const SIGNALWIRE_CODECS = {
  PCM16: 'L16@24000h',   // 24kHz PCM16
  G711_ULAW: undefined   // Default codec (G.711 μ-law)
} as const;

// Event types
export const EVENT_TYPES = {
  RESPONSE_DONE: 'response.done',
  TRANSCRIPTION_COMPLETED: 'conversation.item.input_audio_transcription.completed'
} as const;

// Messages
export const CONNECTION_MESSAGES = {
  CLIENT_CONNECTED: '🔌 SignalWire WebSocket connected',
  CLIENT_DISCONNECTED: '🔌 SignalWire WebSocket disconnected',
  SERVER_STARTED: '🚀 Barbara Voice Assistant Started',
  SERVER_READY: '✅ Ready to receive calls',
  SHUTTING_DOWN: '⏹️  Shutting down gracefully...',
  SERVER_CLOSED: '✅ Server closed'
} as const;

export const WEBHOOK_MESSAGES = {
  CONNECTING: 'Please wait while we connect you to Barbara, your AI assistant.'
} as const;

export const ERROR_MESSAGES = {
  API_KEY_MISSING: 'Missing OPENAI_API_KEY',
  CONNECTION_ERROR: 'WebSocket connection error',
  SESSION_ERROR: 'Session error',
  TRANSPORT_INIT_FAILED: 'Failed to initialize transport layer',
  TIME_UNAVAILABLE: 'Unable to get current time',
  WEATHER_UNAVAILABLE: 'Weather information is currently unavailable',
  CITY_NOT_FOUND: 'City not found'
} as const;

