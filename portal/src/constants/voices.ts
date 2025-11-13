/**
 * Voice Provider Configuration for SignalWire AI Agents
 * 
 * This file contains all supported TTS voice options across 7 providers:
 * - ElevenLabs (38 voices)
 * - Rime (8+ voices)
 * - OpenAI (6 voices)
 * - Amazon Polly (60+ voices)
 * - Cartesia (200+ voices)
 * - Microsoft Azure (30+ voices)
 * - Google Cloud (40+ voices)
 */

export type VoiceGender = 'female' | 'male' | 'neutral';
export type PricingTier = 'standard' | 'mid' | 'premium';

export interface VoiceOption {
  id: string;
  displayName: string;
  gender: VoiceGender;
  description?: string;
  model?: string;
  languageCode?: string;
}

export interface VoiceProvider {
  id: string;
  name: string;
  prefix: string;
  voices: VoiceOption[];
  supportsManualOverride: boolean;
  formatExample: string;
  hasModels?: boolean;
  searchable?: boolean;
  docsUrl?: string;
  // Pricing information (SignalWire rates as of Nov 2024)
  pricingTier: PricingTier;
  costPer1kChars: number; // in USD
  costPer10MinCall: number; // estimated for typical 1,500 char call
}

// ==================== ELEVENLABS ====================
const elevenlabsVoices: VoiceOption[] = [
  // Female voices
  { id: 'rachel', displayName: 'Rachel', gender: 'female', description: 'Natural, conversational' },
  { id: 'nicole', displayName: 'Nicole', gender: 'female', description: 'Professional, clear' },
  { id: 'serena', displayName: 'Serena', gender: 'female', description: 'Warm, friendly' },
  { id: 'emily', displayName: 'Emily', gender: 'female', description: 'Young, energetic' },
  { id: 'elli', displayName: 'Elli', gender: 'female', description: 'Calm, soothing' },
  { id: 'grace', displayName: 'Grace', gender: 'female', description: 'Elegant, refined' },
  { id: 'charlotte', displayName: 'Charlotte', gender: 'female', description: 'British, sophisticated' },
  { id: 'matilda', displayName: 'Matilda', gender: 'female', description: 'Mature, authoritative' },
  { id: 'dorothy', displayName: 'Dorothy', gender: 'female', description: 'Older, wise' },
  { id: 'freya', displayName: 'Freya', gender: 'female', description: 'Nordic, strong' },
  { id: 'gigi', displayName: 'Gigi', gender: 'female', description: 'Playful, young' },
  { id: 'glinda', displayName: 'Glinda', gender: 'female', description: 'Theatrical, expressive' },
  { id: 'jessie', displayName: 'Jessie', gender: 'female', description: 'Casual, friendly' },
  { id: 'mimi', displayName: 'Mimi', gender: 'female', description: 'Cute, bubbly' },
  
  // Male voices
  { id: 'clyde', displayName: 'Clyde', gender: 'male', description: 'Deep, authoritative' },
  { id: 'adam', displayName: 'Adam', gender: 'male', description: 'Neutral, professional' },
  { id: 'dave', displayName: 'Dave', gender: 'male', description: 'Casual, friendly' },
  { id: 'fin', displayName: 'Fin', gender: 'male', description: 'Young, energetic' },
  { id: 'antoni', displayName: 'Antoni', gender: 'male', description: 'Warm, engaging' },
  { id: 'thomas', displayName: 'Thomas', gender: 'male', description: 'British, refined' },
  { id: 'charlie', displayName: 'Charlie', gender: 'male', description: 'Conversational' },
  { id: 'callum', displayName: 'Callum', gender: 'male', description: 'Scottish accent' },
  { id: 'patrick', displayName: 'Patrick', gender: 'male', description: 'Strong, confident' },
  { id: 'harry', displayName: 'Harry', gender: 'male', description: 'Young British' },
  { id: 'liam', displayName: 'Liam', gender: 'male', description: 'Irish accent' },
  { id: 'josh', displayName: 'Josh', gender: 'male', description: 'American, casual' },
  { id: 'arnold', displayName: 'Arnold', gender: 'male', description: 'Deep, powerful' },
  { id: 'matthew', displayName: 'Matthew', gender: 'male', description: 'Professional' },
  { id: 'james', displayName: 'James', gender: 'male', description: 'Sophisticated' },
  { id: 'joseph', displayName: 'Joseph', gender: 'male', description: 'Warm, trustworthy' },
  { id: 'jeremy', displayName: 'Jeremy', gender: 'male', description: 'British, articulate' },
  { id: 'michael', displayName: 'Michael', gender: 'male', description: 'Authoritative' },
  { id: 'ethan', displayName: 'Ethan', gender: 'male', description: 'Young, modern' },
  { id: 'daniel', displayName: 'Daniel', gender: 'male', description: 'Clear, professional' },
  { id: 'ryan', displayName: 'Ryan', gender: 'male', description: 'Friendly, approachable' },
  { id: 'sam', displayName: 'Sam', gender: 'male', description: 'Neutral, versatile' },
  { id: 'giovanni', displayName: 'Giovanni', gender: 'male', description: 'Italian accent' },
  { id: 'domi', displayName: 'Domi', gender: 'female', description: 'Energetic, upbeat' },
];

// ==================== RIME ====================
const rimeVoices: VoiceOption[] = [
  // Female voices
  { id: 'luna', displayName: 'Luna', gender: 'female', description: 'Chill but excitable, gen-z optimist', model: 'arcana' },
  { id: 'celeste', displayName: 'Celeste', gender: 'female', description: 'Warm, laid-back, fun-loving', model: 'arcana' },
  { id: 'astra', displayName: 'Astra', gender: 'female', description: 'Young, wide-eyed', model: 'arcana' },
  { id: 'esther', displayName: 'Esther', gender: 'female', description: 'Older, Chinese American, loving', model: 'arcana' },
  { id: 'estelle', displayName: 'Estelle', gender: 'female', description: 'Middle-aged, African-American, sweet', model: 'arcana' },
  { id: 'andromeda', displayName: 'Andromeda', gender: 'female', description: 'Young, breathy, yoga vibes', model: 'arcana' },
  
  // Male voices
  { id: 'orion', displayName: 'Orion', gender: 'male', description: 'Older, African American, happy', model: 'arcana' },
  { id: 'ursa', displayName: 'Ursa', gender: 'male', description: '20 years old, 2000s emo knowledge', model: 'arcana' },
  
  // Additional voice (gender unspecified in docs)
  { id: 'colby', displayName: 'Colby', gender: 'neutral', description: 'Versatile, general purpose' },
];

// ==================== OPENAI ====================
const openaiVoices: VoiceOption[] = [
  { id: 'alloy', displayName: 'Alloy', gender: 'neutral', description: 'Balanced, versatile' },
  { id: 'echo', displayName: 'Echo', gender: 'male', description: 'Clear, professional' },
  { id: 'fable', displayName: 'Fable', gender: 'male', description: 'Warm, storytelling' },
  { id: 'onyx', displayName: 'Onyx', gender: 'male', description: 'Deep, authoritative' },
  { id: 'nova', displayName: 'Nova', gender: 'female', description: 'Energetic, modern' },
  { id: 'shimmer', displayName: 'Shimmer', gender: 'female', description: 'Friendly, upbeat' },
];

// ==================== AMAZON POLLY ====================
const amazonPollyVoices: VoiceOption[] = [
  // Standard - Female
  { id: 'Ivy', displayName: 'Ivy (Standard)', gender: 'female', model: 'standard', languageCode: 'en-US' },
  { id: 'Joanna', displayName: 'Joanna (Standard)', gender: 'female', model: 'standard', languageCode: 'en-US' },
  { id: 'Kendra', displayName: 'Kendra (Standard)', gender: 'female', model: 'standard', languageCode: 'en-US' },
  { id: 'Kimberly', displayName: 'Kimberly (Standard)', gender: 'female', model: 'standard', languageCode: 'en-US' },
  { id: 'Salli', displayName: 'Salli (Standard)', gender: 'female', model: 'standard', languageCode: 'en-US' },
  
  // Standard - Male
  { id: 'Joey', displayName: 'Joey (Standard)', gender: 'male', model: 'standard', languageCode: 'en-US' },
  { id: 'Kevin', displayName: 'Kevin (Standard)', gender: 'male', model: 'standard', languageCode: 'en-US' },
  
  // Neural - Female
  { id: 'Ivy:neural', displayName: 'Ivy (Neural)', gender: 'female', model: 'neural', languageCode: 'en-US' },
  { id: 'Joanna:neural', displayName: 'Joanna (Neural)', gender: 'female', model: 'neural', languageCode: 'en-US' },
  { id: 'Kendra:neural', displayName: 'Kendra (Neural)', gender: 'female', model: 'neural', languageCode: 'en-US' },
  { id: 'Kimberly:neural', displayName: 'Kimberly (Neural)', gender: 'female', model: 'neural', languageCode: 'en-US' },
  { id: 'Salli:neural', displayName: 'Salli (Neural)', gender: 'female', model: 'neural', languageCode: 'en-US' },
  { id: 'Ruth:neural', displayName: 'Ruth (Neural)', gender: 'female', model: 'neural', languageCode: 'en-US' },
  
  // Neural - Male
  { id: 'Joey:neural', displayName: 'Joey (Neural)', gender: 'male', model: 'neural', languageCode: 'en-US' },
  { id: 'Kevin:neural', displayName: 'Kevin (Neural)', gender: 'male', model: 'neural', languageCode: 'en-US' },
  { id: 'Matthew:neural', displayName: 'Matthew (Neural)', gender: 'male', model: 'neural', languageCode: 'en-US' },
  { id: 'Stephen:neural', displayName: 'Stephen (Neural)', gender: 'male', model: 'neural', languageCode: 'en-US' },
  { id: 'Gregory:neural', displayName: 'Gregory (Neural)', gender: 'male', model: 'neural', languageCode: 'en-US' },
  { id: 'Justin:neural', displayName: 'Justin (Neural)', gender: 'male', model: 'neural', languageCode: 'en-US' },
  
  // Generative (Most realistic)
  { id: 'Danielle:generative', displayName: 'Danielle (Generative) ⭐', gender: 'female', model: 'generative', languageCode: 'en-US', description: 'Most realistic' },
  { id: 'Matthew:generative', displayName: 'Matthew (Generative) ⭐', gender: 'male', model: 'generative', languageCode: 'en-US', description: 'Most realistic' },
  { id: 'Ruth:generative', displayName: 'Ruth (Generative) ⭐', gender: 'female', model: 'generative', languageCode: 'en-US', description: 'Most realistic' },
];

// ==================== MICROSOFT AZURE ====================
const azureVoices: VoiceOption[] = [
  // Female
  { id: 'en-US-AvaNeural', displayName: 'Ava (Neural)', gender: 'female', description: 'Professional, clear' },
  { id: 'en-US-EmmaNeural', displayName: 'Emma (Neural)', gender: 'female', description: 'Warm, friendly' },
  { id: 'en-US-JennyNeural', displayName: 'Jenny (Neural)', gender: 'female', description: 'Versatile, natural' },
  { id: 'en-US-AriaNeural', displayName: 'Aria (Neural)', gender: 'female', description: 'Expressive, dynamic' },
  { id: 'en-US-JaneNeural', displayName: 'Jane (Neural)', gender: 'female', description: 'Clear, articulate' },
  { id: 'en-US-SaraNeural', displayName: 'Sara (Neural)', gender: 'female', description: 'Calm, professional' },
  { id: 'en-US-NancyNeural', displayName: 'Nancy (Neural)', gender: 'female', description: 'Mature, authoritative' },
  { id: 'en-US-AmberNeural', displayName: 'Amber (Neural)', gender: 'female', description: 'Young, energetic' },
  { id: 'en-US-AshleyNeural', displayName: 'Ashley (Neural)', gender: 'female', description: 'Friendly, casual' },
  { id: 'en-US-CoraNeural', displayName: 'Cora (Neural)', gender: 'female', description: 'Warm, engaging' },
  { id: 'en-US-ElizabethNeural', displayName: 'Elizabeth (Neural)', gender: 'female', description: 'Sophisticated' },
  { id: 'en-US-MichelleNeural', displayName: 'Michelle (Neural)', gender: 'female', description: 'Professional' },
  { id: 'en-US-MonicaNeural', displayName: 'Monica (Neural)', gender: 'female', description: 'Confident' },
  
  // Male
  { id: 'en-US-AndrewNeural', displayName: 'Andrew (Neural)', gender: 'male', description: 'Professional, clear' },
  { id: 'en-US-BrianNeural', displayName: 'Brian (Neural)', gender: 'male', description: 'Warm, friendly' },
  { id: 'en-US-GuyNeural', displayName: 'Guy (Neural)', gender: 'male', description: 'Deep, authoritative' },
  { id: 'en-US-DavisNeural', displayName: 'Davis (Neural)', gender: 'male', description: 'Energetic, young' },
  { id: 'en-US-JasonNeural', displayName: 'Jason (Neural)', gender: 'male', description: 'Casual, friendly' },
  { id: 'en-US-TonyNeural', displayName: 'Tony (Neural)', gender: 'male', description: 'Strong, confident' },
  { id: 'en-US-RogerNeural', displayName: 'Roger (Neural)', gender: 'male', description: 'Mature, wise' },
];

// ==================== GOOGLE CLOUD ====================
const googleCloudVoices: VoiceOption[] = [
  // Chirp 3 HD (Conversational AI)
  { id: 'en-US-Chirp-HD-A', displayName: 'Chirp HD-A', gender: 'female', model: 'chirp3-hd', description: 'Conversational' },
  { id: 'en-US-Chirp-HD-B', displayName: 'Chirp HD-B', gender: 'male', model: 'chirp3-hd', description: 'Conversational' },
  { id: 'en-US-Chirp-HD-C', displayName: 'Chirp HD-C', gender: 'female', model: 'chirp3-hd', description: 'Conversational' },
  { id: 'en-US-Chirp-HD-D', displayName: 'Chirp HD-D', gender: 'male', model: 'chirp3-hd', description: 'Conversational' },
  { id: 'en-US-Chirp-HD-F', displayName: 'Chirp HD-F', gender: 'female', model: 'chirp3-hd', description: 'Conversational' },
  { id: 'en-US-Chirp-HD-O', displayName: 'Chirp HD-O', gender: 'neutral', model: 'chirp3-hd', description: 'Conversational' },
  
  // Neural2 (Premium quality)
  { id: 'en-US-Neural2-A', displayName: 'Neural2-A', gender: 'male', model: 'neural2', description: 'Premium quality' },
  { id: 'en-US-Neural2-C', displayName: 'Neural2-C', gender: 'female', model: 'neural2', description: 'Premium quality' },
  { id: 'en-US-Neural2-D', displayName: 'Neural2-D', gender: 'male', model: 'neural2', description: 'Premium quality' },
  { id: 'en-US-Neural2-E', displayName: 'Neural2-E', gender: 'female', model: 'neural2', description: 'Premium quality' },
  { id: 'en-US-Neural2-F', displayName: 'Neural2-F', gender: 'female', model: 'neural2', description: 'Premium quality' },
  { id: 'en-US-Neural2-G', displayName: 'Neural2-G', gender: 'female', model: 'neural2', description: 'Premium quality' },
  { id: 'en-US-Neural2-H', displayName: 'Neural2-H', gender: 'female', model: 'neural2', description: 'Premium quality' },
  { id: 'en-US-Neural2-I', displayName: 'Neural2-I', gender: 'male', model: 'neural2', description: 'Premium quality' },
  { id: 'en-US-Neural2-J', displayName: 'Neural2-J', gender: 'male', model: 'neural2', description: 'Premium quality' },
  
  // WaveNet (High quality)
  { id: 'en-US-Wavenet-A', displayName: 'Wavenet-A', gender: 'male', model: 'wavenet', description: 'High quality' },
  { id: 'en-US-Wavenet-B', displayName: 'Wavenet-B', gender: 'male', model: 'wavenet', description: 'High quality' },
  { id: 'en-US-Wavenet-C', displayName: 'Wavenet-C', gender: 'female', model: 'wavenet', description: 'High quality' },
  { id: 'en-US-Wavenet-D', displayName: 'Wavenet-D', gender: 'male', model: 'wavenet', description: 'High quality' },
  { id: 'en-US-Wavenet-E', displayName: 'Wavenet-E', gender: 'female', model: 'wavenet', description: 'High quality' },
  { id: 'en-US-Wavenet-F', displayName: 'Wavenet-F', gender: 'female', model: 'wavenet', description: 'High quality' },
  
  // Standard (Cost-efficient)
  { id: 'en-US-Standard-A', displayName: 'Standard-A', gender: 'male', model: 'standard', description: 'Cost-efficient' },
  { id: 'en-US-Standard-B', displayName: 'Standard-B', gender: 'male', model: 'standard', description: 'Cost-efficient' },
  { id: 'en-US-Standard-C', displayName: 'Standard-C', gender: 'female', model: 'standard', description: 'Cost-efficient' },
  { id: 'en-US-Standard-D', displayName: 'Standard-D', gender: 'male', model: 'standard', description: 'Cost-efficient' },
  { id: 'en-US-Standard-E', displayName: 'Standard-E', gender: 'female', model: 'standard', description: 'Cost-efficient' },
];

// ==================== CARTESIA ====================
// Note: Cartesia has 200+ voices. This is a curated subset for English (USA)
const cartesiaVoices: VoiceOption[] = [
  // Female
  { id: '156fb8d2-335b-4950-9cb3-a2d33befec77', displayName: 'Helpful Woman', gender: 'female', description: 'Professional, clear' },
  { id: '829ccd10-f8b3-43cd-b8a0-4aeaa81f3b30', displayName: 'Customer Support Lady', gender: 'female', description: 'Friendly, patient' },
  { id: '79a125e8-cd45-4c13-8a67-188112f4dd22', displayName: 'British Lady', gender: 'female', description: 'British accent, sophisticated' },
  { id: 'c8605446-247c-4d39-acd4-8f4c28aa363c', displayName: 'Wise Lady', gender: 'female', description: 'Mature, knowledgeable' },
  { id: 'ff1bb1a9-c582-4570-9670-5f46169d0fc8', displayName: 'Indian Customer Support Lady', gender: 'female', description: 'Indian accent, helpful' },
  { id: 'b7d50908-b17c-442d-ad8d-810c63997ed9', displayName: 'California Girl', gender: 'female', description: 'Young, casual' },
  { id: '4f8651b0-bbbd-46ac-8b37-5168c5923303', displayName: 'Kentucky Woman', gender: 'female', description: 'Southern accent, warm' },
  { id: '694f9389-aac1-45b6-b726-9d9369183238', displayName: 'Sarah', gender: 'female', description: 'Professional, versatile' },
  { id: '21b81c14-f85b-436d-aff5-43f2e788ecf8', displayName: 'Laidback Woman', gender: 'female', description: 'Relaxed, casual' },
  { id: '248be419-c632-4f23-adf1-5324ed7dbf1d', displayName: 'Professional Woman', gender: 'female', description: 'Business-focused' },
  
  // Male
  { id: 'a167e0f3-df7e-4d52-a9c3-f949145efdab', displayName: 'Customer Support Man', gender: 'male', description: 'Professional, helpful' },
  { id: '41f3c367-e0a8-4a85-89e0-c27bae9c9b6d', displayName: 'Australian Customer Support Man', gender: 'male', description: 'Australian accent' },
  { id: '421b3369-f63f-4b03-8980-37a44df1d4e8', displayName: 'Friendly Australian Man', gender: 'male', description: 'Australian, casual' },
  { id: 'b043dea0-a007-4bbe-a708-769dc0d0c569', displayName: 'Wise Man', gender: 'male', description: 'Mature, knowledgeable' },
  { id: '69267136-1bdc-412f-ad78-0caad210fb40', displayName: 'Friendly Reading Man', gender: 'male', description: 'Warm, engaging' },
  { id: '34575e71-908f-4ab6-ab54-b08c95d6597d', displayName: 'New York Man', gender: 'male', description: 'New York accent' },
  { id: 'a0e99841-438c-4a64-b679-ae501e7d6091', displayName: 'Barbershop Man', gender: 'male', description: 'Friendly, conversational' },
  { id: '638efaaa-4d0c-442e-b701-3fae16aad012', displayName: 'Indian Man', gender: 'male', description: 'Indian accent' },
  { id: '820a3788-2b37-4d21-847a-b65d8a68c99a', displayName: 'Salesman', gender: 'male', description: 'Energetic, persuasive' },
  { id: 'bd9120b6-7761-47a6-a446-77ca49132781', displayName: 'Tutorial Man', gender: 'male', description: 'Educational, clear' },
];

// ==================== PROVIDER DEFINITIONS ====================
export const voiceProviders: VoiceProvider[] = [
  {
    id: 'elevenlabs',
    name: 'ElevenLabs',
    prefix: 'elevenlabs.',
    voices: elevenlabsVoices,
    supportsManualOverride: true,
    formatExample: 'elevenlabs.rachel',
    docsUrl: 'https://elevenlabs.io/voices',
    pricingTier: 'premium',
    costPer1kChars: 0.297, // $0.000297 per character
    costPer10MinCall: 0.45, // ~1,500 chars typical
  },
  {
    id: 'rime',
    name: 'Rime',
    prefix: 'rime.',
    voices: rimeVoices,
    supportsManualOverride: true,
    formatExample: 'rime.luna',
    hasModels: true,
    docsUrl: 'https://docs.rime.ai/api-reference/voices',
    pricingTier: 'mid',
    costPer1kChars: 0.12, // $0.00012 per character
    costPer10MinCall: 0.18,
  },
  {
    id: 'openai',
    name: 'OpenAI',
    prefix: 'openai.',
    voices: openaiVoices,
    supportsManualOverride: true,
    formatExample: 'openai.alloy',
    docsUrl: 'https://platform.openai.com/docs/guides/text-to-speech',
    pricingTier: 'standard',
    costPer1kChars: 0.008, // $0.00008 per 10 characters
    costPer10MinCall: 0.012,
  },
  {
    id: 'amazon',
    name: 'Amazon Polly',
    prefix: 'amazon.',
    voices: amazonPollyVoices,
    supportsManualOverride: true,
    formatExample: 'amazon.Joanna:neural:en-US',
    hasModels: true,
    docsUrl: 'https://docs.aws.amazon.com/polly/latest/dg/voicelist.html',
    pricingTier: 'standard',
    costPer1kChars: 0.008, // Standard TTS rate
    costPer10MinCall: 0.012,
  },
  {
    id: 'azure',
    name: 'Microsoft Azure',
    prefix: '',
    voices: azureVoices,
    supportsManualOverride: true,
    formatExample: 'en-US-JennyNeural',
    searchable: true,
    docsUrl: 'https://learn.microsoft.com/en-us/azure/ai-services/speech-service/language-support',
    pricingTier: 'standard',
    costPer1kChars: 0.008, // Standard TTS rate
    costPer10MinCall: 0.012,
  },
  {
    id: 'gcloud',
    name: 'Google Cloud',
    prefix: 'gcloud.',
    voices: googleCloudVoices,
    supportsManualOverride: true,
    formatExample: 'gcloud.en-US-Neural2-C',
    hasModels: true,
    searchable: true,
    docsUrl: 'https://cloud.google.com/text-to-speech/docs/voices',
    pricingTier: 'standard',
    costPer1kChars: 0.008, // Standard TTS rate
    costPer10MinCall: 0.012,
  },
  {
    id: 'cartesia',
    name: 'Cartesia',
    prefix: 'cartesia.',
    voices: cartesiaVoices,
    supportsManualOverride: true,
    formatExample: 'cartesia.a167e0f3-df7e-4d52-a9c3-f949145efdab',
    searchable: true,
    docsUrl: 'https://docs.cartesia.ai/',
    pricingTier: 'standard',
    costPer1kChars: 0.008, // Standard TTS rate (assumed)
    costPer10MinCall: 0.012,
  },
];

/**
 * Get a voice provider by ID
 */
export function getVoiceProvider(providerId: string): VoiceProvider | undefined {
  return voiceProviders.find(p => p.id === providerId);
}

/**
 * Get all voices for a provider, optionally filtered by gender
 */
export function getVoicesByProvider(providerId: string, gender?: VoiceGender): VoiceOption[] {
  const provider = getVoiceProvider(providerId);
  if (!provider) return [];
  
  if (gender) {
    return provider.voices.filter(v => v.gender === gender);
  }
  
  return provider.voices;
}

/**
 * Format a voice string for SignalWire
 */
export function formatVoiceString(providerId: string, voiceId: string): string {
  const provider = getVoiceProvider(providerId);
  if (!provider) return voiceId;
  
  return `${provider.prefix}${voiceId}`;
}

/**
 * Parse a voice string to extract provider and voice ID
 */
export function parseVoiceString(voiceString: string): { providerId: string; voiceId: string } | null {
  for (const provider of voiceProviders) {
    if (voiceString.startsWith(provider.prefix)) {
      return {
        providerId: provider.id,
        voiceId: voiceString.substring(provider.prefix.length),
      };
    }
  }
  
  // Check Azure (no prefix)
  if (voiceString.match(/^[a-z]{2}-[A-Z]{2}-/)) {
    return {
      providerId: 'azure',
      voiceId: voiceString,
    };
  }
  
  return null;
}

/**
 * Get pricing tier badge color
 */
export function getPricingTierColor(tier: PricingTier): string {
  switch (tier) {
    case 'standard':
      return 'green';
    case 'mid':
      return 'yellow';
    case 'premium':
      return 'red';
    default:
      return 'gray';
  }
}

/**
 * Get pricing tier display label
 */
export function getPricingTierLabel(tier: PricingTier): string {
  switch (tier) {
    case 'standard':
      return 'Standard';
    case 'mid':
      return 'Mid-Tier';
    case 'premium':
      return 'Premium';
    default:
      return 'Unknown';
  }
}

/**
 * Calculate estimated monthly cost for a voice provider
 * @param providerId Provider ID
 * @param callsPerDay Average calls per day
 * @param avgCallMinutes Average call length in minutes
 * @param avgCharsPerMinute Average characters spoken per minute (default: 150)
 */
export function calculateMonthlyCost(
  providerId: string,
  callsPerDay: number,
  avgCallMinutes: number = 10,
  avgCharsPerMinute: number = 150
): number {
  const provider = getVoiceProvider(providerId);
  if (!provider) return 0;
  
  const charsPerCall = avgCallMinutes * avgCharsPerMinute;
  const costPerCall = (charsPerCall / 1000) * provider.costPer1kChars;
  const monthlyCallVolume = callsPerDay * 30;
  
  return costPerCall * monthlyCallVolume;
}

/**
 * Compare costs across all providers for a given usage profile
 */
export function compareCosts(
  callsPerDay: number,
  avgCallMinutes: number = 10
): Array<{ provider: VoiceProvider; monthlyCost: number }> {
  return voiceProviders
    .map(provider => ({
      provider,
      monthlyCost: calculateMonthlyCost(provider.id, callsPerDay, avgCallMinutes),
    }))
    .sort((a, b) => a.monthlyCost - b.monthlyCost);
}


