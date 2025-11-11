<template>
  <n-modal 
    v-model:show="showModal" 
    preset="card" 
    :title="isEditing ? 'Edit AI Template' : 'Create AI Template'"
    style="width: 900px; max-height: 90vh; overflow-y: auto"
  >
    <n-form ref="formRef" :model="formData" :rules="rules">
      <!-- Template Name & Description -->
      <n-form-item label="Template Name" path="name">
        <n-input 
          v-model:value="formData.name" 
          placeholder="e.g., Sales Aggressive"
        />
      </n-form-item>

      <n-form-item label="Description" path="description">
        <n-input 
          v-model:value="formData.description" 
          type="textarea"
          :rows="2"
          placeholder="Describe when to use this template..."
        />
      </n-form-item>

      <!-- Configuration Mode Toggle -->
      <n-form-item label="Configuration Mode">
        <n-radio-group v-model:value="configMode">
          <n-radio value="preset">Quick Setup (Use Preset)</n-radio>
          <n-radio value="advanced">Advanced (Custom)</n-radio>
        </n-radio-group>
      </n-form-item>

      <!-- PRESET MODE -->
      <div v-if="configMode === 'preset'">
        <n-form-item label="Select Preset Configuration">
          <n-select 
            v-model:value="selectedPreset"
            :options="presetOptions"
            @update:value="applyPreset"
          />
        </n-form-item>
      </div>

      <!-- ADVANCED MODE -->
      <div v-else>
        <!-- STT Section -->
        <n-divider title-placement="left">
          <n-icon><MicOutline /></n-icon>
          Speech-to-Text (STT)
        </n-divider>

        <n-form-item label="STT Provider" path="stt_provider">
          <n-select 
            v-model:value="formData.stt_provider"
            :options="sttProviderOptions"
            @update:value="onSTTProviderChange"
          />
        </n-form-item>

        <n-form-item label="STT Model" path="stt_model">
          <n-select 
            v-model:value="formData.stt_model"
            :options="sttModelOptions"
            :loading="loadingSTTModels"
          />
        </n-form-item>

        <!-- TTS Section -->
        <n-divider title-placement="left">
          <n-icon><VolumeHighOutline /></n-icon>
          Text-to-Speech (TTS)
        </n-divider>

        <n-form-item label="TTS Provider" path="tts_provider">
          <n-select 
            v-model:value="formData.tts_provider"
            :options="ttsProviderOptions"
            @update:value="onTTSProviderChange"
          />
        </n-form-item>

        <n-form-item label="TTS Model" path="tts_model">
          <n-select 
            v-model:value="formData.tts_model"
            :options="ttsModelOptions"
            :loading="loadingTTSModels"
            @update:value="onTTSModelChange"
          />
        </n-form-item>

        <n-form-item label="TTS Voice" path="tts_voice_id">
          <n-select 
            v-model:value="formData.tts_voice_id"
            :options="ttsVoiceOptions"
            :loading="loadingTTSVoices"
            tag
            filterable
            placeholder="Select or paste custom voice ID"
          >
            <template #label="{ option }">
              <div class="voice-option">
                <span>{{ option.label }}</span>
                <n-button 
                  size="tiny" 
                  circle 
                  @click.stop="playVoicePreview(option.value)"
                  :loading="previewLoading === option.value"
                  style="margin-left: 8px"
                >
                  <template #icon>
                    <n-icon><PlayOutline /></n-icon>
                  </template>
                </n-button>
              </div>
            </template>
          </n-select>
        </n-form-item>

        <n-alert type="info" size="small" style="margin-bottom: 16px">
          💡 You can paste any custom voice ID directly into the Voice dropdown (e.g., from ElevenLabs Voice Lab)
        </n-alert>

        <n-form-item label="Voice Speed">
          <n-slider 
            v-model:value="formData.tts_speed"
            :min="0.5"
            :max="2"
            :step="0.1"
            :marks="{ 0.5: '0.5x', 1.0: 'Normal', 2.0: '2x' }"
          />
        </n-form-item>

        <!-- LLM Section -->
        <n-divider title-placement="left">
          <n-icon><ChatbubbleOutline /></n-icon>
          Language Model (LLM)
        </n-divider>

        <n-form-item label="LLM Provider" path="llm_provider">
          <n-select 
            v-model:value="formData.llm_provider"
            :options="llmProviderOptions"
            @update:value="onLLMProviderChange"
          />
        </n-form-item>

        <n-form-item label="LLM Model" path="llm_model">
          <n-select 
            v-model:value="formData.llm_model"
            :options="llmModelOptions"
            :loading="loadingLLMModels"
          />
        </n-form-item>

        <n-form-item label="Temperature">
          <n-slider 
            v-model:value="formData.llm_temperature"
            :min="0"
            :max="2"
            :step="0.1"
            :marks="{ 0: 'Precise', 0.7: 'Balanced', 2.0: 'Creative' }"
          />
        </n-form-item>

        <!-- VAD Section -->
        <n-divider title-placement="left">
          <n-icon><PulseOutline /></n-icon>
          Voice Activity Detection (VAD)
        </n-divider>

        <n-form-item label="Enable VAD">
          <n-switch v-model:value="formData.vad_enabled" />
        </n-form-item>

        <n-form-item v-if="formData.vad_enabled" label="VAD Threshold">
          <n-slider 
            v-model:value="formData.vad_threshold"
            :min="0"
            :max="1"
            :step="0.05"
            :marks="{ 0: 'Sensitive', 0.5: 'Balanced', 1: 'Strict' }"
          />
        </n-form-item>

        <n-form-item v-if="formData.vad_enabled" label="Prefix Padding (ms)">
          <n-input-number 
            v-model:value="formData.vad_prefix_padding_ms"
            :min="0"
            :max="1000"
            :step="50"
            style="width: 100%"
          />
        </n-form-item>

        <n-form-item v-if="formData.vad_enabled" label="Silence Duration (ms)">
          <n-input-number 
            v-model:value="formData.vad_silence_duration_ms"
            :min="100"
            :max="2000"
            :step="100"
            style="width: 100%"
          />
        </n-form-item>
      </div>

      <!-- Cost Calculator (Always Visible) -->
      <n-card title="Estimated Cost" size="small" style="margin-top: 1rem">
        <div class="cost-breakdown">
          <div class="cost-row">
            <span>STT ({{ formData.stt_model || 'Not selected' }})</span>
            <span class="cost-value">${{ sttCost.toFixed(4) }}/min</span>
          </div>
          <div class="cost-row">
            <span>TTS ({{ formData.tts_model || 'Not selected' }})</span>
            <span class="cost-value">${{ ttsCost.toFixed(4) }}/min</span>
          </div>
          <div class="cost-row">
            <span>LLM ({{ formData.llm_model || 'Not selected' }})</span>
            <span class="cost-value">${{ llmCost.toFixed(4) }}/min</span>
          </div>
          <n-divider style="margin: 8px 0" />
          <div class="cost-row total">
            <span><strong>Total per minute</strong></span>
            <span class="cost-value total-value">${{ totalCost.toFixed(4) }}</span>
          </div>
          <div class="cost-estimates">
            <div class="estimate-item">
              <span>10 min call:</span>
              <span>${{ (totalCost * 10).toFixed(2) }}</span>
            </div>
            <div class="estimate-item">
              <span>100 calls/month:</span>
              <span>${{ (totalCost * 10 * 100).toFixed(2) }}</span>
            </div>
          </div>
        </div>
      </n-card>
    </n-form>

    <!-- Hidden Audio Player for Voice Previews -->
    <audio ref="audioPlayer" style="display: none" @ended="onPreviewEnd"></audio>

    <template #footer>
      <n-space justify="end">
        <n-button @click="handleCancel">Cancel</n-button>
        <n-button type="primary" @click="saveTemplate" :loading="saving">
          {{ isEditing ? 'Update Template' : 'Create Template' }}
        </n-button>
      </n-space>
    </template>
  </n-modal>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import {
  NModal,
  NForm,
  NFormItem,
  NInput,
  NSelect,
  NRadioGroup,
  NRadio,
  NSlider,
  NSwitch,
  NInputNumber,
  NDivider,
  NCard,
  NButton,
  NSpace,
  NIcon,
  NPopconfirm,
  NAlert,
  useMessage
} from 'naive-ui'
import {
  AddOutline,
  MicOutline,
  VolumeHighOutline,
  ChatbubbleOutline,
  PulseOutline,
  PlayOutline
} from '@vicons/ionicons5'

const props = defineProps({
  show: Boolean,
  brokerId: String,
  template: Object
})

const emit = defineEmits(['update:show', 'saved'])

const message = useMessage()
const formRef = ref(null)
const audioPlayer = ref(null)
const showModal = computed({
  get: () => props.show,
  set: (val) => emit('update:show', val)
})

const isEditing = computed(() => !!props.template)
const configMode = ref('preset')
const selectedPreset = ref(null)
const saving = ref(false)
const previewLoading = ref(null)

// Form data - LiveKit Inference defaults
const formData = ref({
  name: '',
  description: '',
  stt_provider: 'deepgram',
  stt_model: 'nova-2',
  stt_language: 'en-US',
  tts_provider: 'elevenlabs',
  tts_model: 'eleven_turbo_v2_5',
  tts_voice_id: '6aDn1KB0hjpdcocrUkmq', // Tiffany voice
  tts_speed: 1.0,
  tts_stability: 0.5,
  llm_provider: 'openai',
  llm_model: 'gpt-4o',
  llm_temperature: 0.7,
  llm_max_tokens: 4096,
  llm_top_p: 1.0,
  llm_frequency_penalty: 0.0,
  llm_presence_penalty: 0.0,
  vad_enabled: true,
  vad_threshold: 0.5,
  vad_prefix_padding_ms: 300,
  vad_silence_duration_ms: 500,
  turn_detection_type: 'server_vad',
  audio_input_transcription: true,
  audio_sample_rate: 24000,
  broker_id: props.brokerId
})

// Provider options
const sttProviderOptions = ref([])
const ttsProviderOptions = ref([])
const llmProviderOptions = ref([])

// Model/voice options
const loadingSTTModels = ref(false)
const loadingTTSModels = ref(false)
const loadingTTSVoices = ref(false)
const loadingLLMModels = ref(false)

const sttModelOptions = ref([])
const ttsModelGroups = ref([])
const ttsModelOptions = ref([])
const ttsVoiceOptions = ref([])
const llmModelOptions = ref([])

// Preset options - LiveKit Inference
const presetOptions = ref([
  { label: 'Premium (ElevenLabs + GPT-4o)', value: 'premium' },
  { label: 'Balanced (ElevenLabs + Claude Haiku)', value: 'balanced' },
  { label: 'Budget (Cartesia + DeepSeek)', value: 'budget' },
  { label: 'Ultra-Fast (ElevenLabs Turbo + Gemini Flash)', value: 'ultrafast' }
])

// Form validation rules
const rules = {
  name: { required: true, message: 'Please enter a template name', trigger: 'blur' },
  stt_provider: { required: true, message: 'Please select an STT provider', trigger: 'change' },
  tts_provider: { required: true, message: 'Please select a TTS provider', trigger: 'change' },
  llm_provider: { required: true, message: 'Please select an LLM provider', trigger: 'change' }
}

// Cost calculation - LiveKit Inference pricing (per minute, converted from hourly rates)
// Source: https://livekit.io/pricing/inference
const sttCost = computed(() => {
  const costs = {
    // Deepgram models (per hour → per min)
    'nova-3': 0.462 / 60,      // $0.462/hour = $0.0077/min (monolingual)
    'nova-3-multi': 0.552 / 60, // $0.552/hour = $0.0092/min (multilingual)
    'nova-3-medical': 0.462 / 60,
    'nova-2': 0.348 / 60,      // $0.348/hour = $0.0058/min
    'nova-2-medical': 0.348 / 60,
    'nova-2-conversational': 0.348 / 60,
    'nova-2-phonecall': 0.348 / 60,
    // AssemblyAI
    'universal-streaming': 0.150 / 60, // $0.150/hour = $0.0025/min
    // Cartesia
    'ink-whisper': 0.180 / 60, // $0.180/hour = $0.003/min
    // Fallback
    'bundled': 0.0
  }
  return costs[formData.value.stt_model] || 0.005
})

const ttsCost = computed(() => {
  // TTS pricing per 1M characters, converted to per minute
  // Assume ~150 words/min speech × 5 chars/word = 750 chars/min = 0.00075M chars/min
  const charsPerMin = 0.00075 // 750 characters per minute of speech
  const costs = {
    // ElevenLabs models (per 1M characters)
    'eleven_flash_v2': 150 * charsPerMin,      // $150/1M chars = $0.1125/min
    'eleven_flash_v2_5': 150 * charsPerMin,
    'eleven_turbo_v2': 150 * charsPerMin,
    'eleven_turbo_v2_5': 150 * charsPerMin,
    'eleven_multilingual_v2': 300 * charsPerMin, // $300/1M chars = $0.225/min
    // Cartesia (all models)
    'sonic-3': 50 * charsPerMin,  // $50/1M chars = $0.0375/min
    'sonic-2': 50 * charsPerMin,
    'sonic-turbo': 50 * charsPerMin,
    'sonic': 50 * charsPerMin,
    // Inworld
    'inworld-tts-max': 10 * charsPerMin, // $10/1M chars = $0.0075/min
    'inworld-tts': 5 * charsPerMin,      // $5/1M chars = $0.00375/min
    // Rime
    'arcana': 50 * charsPerMin,    // $50/1M chars = $0.0375/min
    'mistv2': 50 * charsPerMin,
    'mist': 50 * charsPerMin,
    // Fallback
    'bundled': 0.0
  }
  return costs[formData.value.tts_model] || 0.020
})

const llmCost = computed(() => {
  // Cost per 1M tokens (input + output), converted to per minute
  // Assume ~75 input tokens/min + ~75 output tokens/min = 150 total tokens/min
  const inputTokensPerMin = 75
  const outputTokensPerMin = 75
  const costs = {
    // OpenAI (Azure & OpenAI - same pricing)
    'gpt-4o': (2.50 * inputTokensPerMin + 10.00 * outputTokensPerMin) / 1000, // $0.9375/min
    'gpt-4o-mini': (0.15 * inputTokensPerMin + 0.60 * outputTokensPerMin) / 1000, // $0.05625/min
    'gpt-4.1': (2.00 * inputTokensPerMin + 8.00 * outputTokensPerMin) / 1000,
    'gpt-4.1-mini': (0.40 * inputTokensPerMin + 1.60 * outputTokensPerMin) / 1000,
    'gpt-4.1-nano': (0.10 * inputTokensPerMin + 0.40 * outputTokensPerMin) / 1000,
    'gpt-5': (1.25 * inputTokensPerMin + 10.00 * outputTokensPerMin) / 1000,
    'gpt-5-mini': (0.25 * inputTokensPerMin + 2.00 * outputTokensPerMin) / 1000,
    'gpt-5-nano': (0.05 * inputTokensPerMin + 0.40 * outputTokensPerMin) / 1000,
    // GPT OSS 120B (multiple providers)
    'gpt-oss-120b-baseten': (0.10 * inputTokensPerMin + 0.50 * outputTokensPerMin) / 1000,
    'gpt-oss-120b-groq': (0.15 * inputTokensPerMin + 0.75 * outputTokensPerMin) / 1000,
    'gpt-oss-120b-cerebras': (0.35 * inputTokensPerMin + 0.75 * outputTokensPerMin) / 1000,
    // Google Gemini
    'gemini-2.5-pro': (2.50 * inputTokensPerMin + 15.00 * outputTokensPerMin) / 1000,
    'gemini-2.5-flash': (0.30 * inputTokensPerMin + 2.50 * outputTokensPerMin) / 1000,
    'gemini-2.5-flash-lite': (0.10 * inputTokensPerMin + 0.40 * outputTokensPerMin) / 1000,
    'gemini-2.0-flash': (0.10 * inputTokensPerMin + 0.40 * outputTokensPerMin) / 1000,
    'gemini-2.0-flash-lite': (0.07 * inputTokensPerMin + 0.30 * outputTokensPerMin) / 1000,
    // Qwen
    'qwen3-235b': (0.22 * inputTokensPerMin + 0.80 * outputTokensPerMin) / 1000,
    // Kimi
    'kimi-k2': (0.60 * inputTokensPerMin + 2.50 * outputTokensPerMin) / 1000,
    // DeepSeek
    'deepseek-v3': (0.77 * inputTokensPerMin + 0.77 * outputTokensPerMin) / 1000,
    // Fallback
    'gpt-4o-realtime-preview': 0.0025
  }
  return costs[formData.value.llm_model] || 0.03 // $0.03/min fallback
})

const totalCost = computed(() => {
  return sttCost.value + ttsCost.value + llmCost.value
})

// Load provider catalogs
async function loadProviders() {
  try {
    const response = await fetch('/api/ai-providers/all')
    const data = await response.json()
    
    sttProviderOptions.value = data.stt_providers.map(p => ({
      label: p.name,
      value: p.id
    }))
    
    ttsProviderOptions.value = data.tts_providers.map(p => ({
      label: p.name,
      value: p.id
    }))
    
    llmProviderOptions.value = data.llm_providers.map(p => ({
      label: p.name,
      value: p.id
    }))
  } catch (error) {
    console.error('Error loading providers:', error)
    message.error('Failed to load provider options')
  }
}

async function onSTTProviderChange(provider) {
  loadingSTTModels.value = true
  try {
    const response = await fetch(`/api/ai-providers/stt-models?provider=${provider}`)
    const data = await response.json()
    
    sttModelOptions.value = data.models.map(m => ({
      label: `${m.name} ($${m.cost_per_min}/min)`,
      value: m.id
    }))
    
    // Auto-select first model
    if (data.models.length > 0) {
      formData.value.stt_model = data.models[0].id
    }
  } catch (error) {
    console.error('Error loading STT models:', error)
  } finally {
    loadingSTTModels.value = false
  }
}

async function onTTSProviderChange(provider) {
  loadingTTSModels.value = true
  try {
    const response = await fetch(`/api/ai-providers/tts-models?provider=${provider}`)
    const data = await response.json()
    
    ttsModelGroups.value = data.grouped_models || []
    
    // Flatten for n-select options
    const allModels = []
    for (const group of ttsModelGroups.value) {
      for (const model of group.models) {
        allModels.push({
          label: `${group.provider_name} - ${model.name} ($${model.cost_per_min}/min)`,
          value: model.id,
          group: group.provider_name
        })
      }
    }
    
    ttsModelOptions.value = allModels
    
    // Auto-select first model
    if (allModels.length > 0) {
      formData.value.tts_model = allModels[0].value
      onTTSModelChange(allModels[0].value)
    }
  } catch (error) {
    console.error('Error loading TTS models:', error)
  } finally {
    loadingTTSModels.value = false
  }
}

async function onTTSModelChange(model) {
  console.log('🎤 Loading voices for:', formData.value.tts_provider, model)
  loadingTTSVoices.value = true
  try {
    const url = `/api/ai-providers/tts-voices?provider=${formData.value.tts_provider}&model=${model}`
    console.log('📞 Fetching voices from:', url)
    
    const response = await fetch(url)
    const data = await response.json()
    
    console.log('✅ Received voices:', data.voices?.length || 0, data.voices)
    
    ttsVoiceOptions.value = data.voices.map(v => ({
      label: `${v.name} (${v.gender}, ${v.accent})`,
      value: v.id,
      voice: v
    }))
    
    console.log('🎯 Voice options:', ttsVoiceOptions.value)
    
    // Auto-select first voice
    if (data.voices.length > 0) {
      formData.value.tts_voice_id = data.voices[0].id
      console.log('✅ Auto-selected voice:', data.voices[0].id)
    }
  } catch (error) {
    console.error('❌ Error loading TTS voices:', error)
  } finally {
    loadingTTSVoices.value = false
  }
}

async function onLLMProviderChange(provider) {
  loadingLLMModels.value = true
  try {
    const response = await fetch(`/api/ai-providers/llm-models?provider=${provider}`)
    const data = await response.json()
    
    llmModelOptions.value = data.models.map(m => ({
      label: `${m.name} (${m.provider}) - $${m.cost_per_1m_tokens}/1M tokens`,
      value: m.id
    }))
    
    // Auto-select first model
    if (data.models.length > 0) {
      formData.value.llm_model = data.models[0].id
    }
  } catch (error) {
    console.error('Error loading LLM models:', error)
  } finally {
    loadingLLMModels.value = false
  }
}

function applyPreset(presetValue) {
  if (presetValue === 'premium') {
    // Premium: Deepgram Nova-2 + ElevenLabs Turbo + GPT-4o (Best quality)
    formData.value.stt_provider = 'deepgram'
    formData.value.stt_model = 'nova-2'
    formData.value.stt_language = 'en-US'
    formData.value.tts_provider = 'elevenlabs'
    formData.value.tts_model = 'eleven_turbo_v2_5'
    formData.value.tts_voice_id = '6aDn1KB0hjpdcocrUkmq' // Tiffany
    formData.value.llm_provider = 'openai'
    formData.value.llm_model = 'gpt-4o'
    formData.value.llm_temperature = 0.8
  } else if (presetValue === 'balanced') {
    // Balanced: Deepgram Nova-2 + ElevenLabs + Claude Haiku (Good quality, lower cost)
    formData.value.stt_provider = 'deepgram'
    formData.value.stt_model = 'nova-2'
    formData.value.stt_language = 'en-US'
    formData.value.tts_provider = 'elevenlabs'
    formData.value.tts_model = 'eleven_turbo_v2_5'
    formData.value.tts_voice_id = '6aDn1KB0hjpdcocrUkmq' // Tiffany
    formData.value.llm_provider = 'anthropic'
    formData.value.llm_model = 'claude-3-5-haiku-20241022'
    formData.value.llm_temperature = 0.7
  } else if (presetValue === 'budget') {
    // Budget: AssemblyAI + Cartesia + DeepSeek (Most cost-effective)
    formData.value.stt_provider = 'assemblyai'
    formData.value.stt_model = 'universal-streaming'
    formData.value.stt_language = 'en-US'
    formData.value.tts_provider = 'cartesia'
    formData.value.tts_model = 'sonic-2024-09'
    formData.value.tts_voice_id = 'default' // Cartesia default voice
    formData.value.llm_provider = 'deepseek'
    formData.value.llm_model = 'deepseek-chat'
    formData.value.llm_temperature = 0.7
  } else if (presetValue === 'ultrafast') {
    // Ultra-Fast: Deepgram Nova-3 + ElevenLabs Turbo + Gemini Flash (Lowest latency)
    formData.value.stt_provider = 'deepgram'
    formData.value.stt_model = 'nova-3'
    formData.value.stt_language = 'en-US'
    formData.value.tts_provider = 'elevenlabs'
    formData.value.tts_model = 'eleven_turbo_v2_5'
    formData.value.tts_voice_id = '6aDn1KB0hjpdcocrUkmq' // Tiffany
    formData.value.llm_provider = 'google'
    formData.value.llm_model = 'gemini-2.0-flash-exp'
    formData.value.llm_temperature = 0.7
  }
}

async function playVoicePreview(voiceId) {
  previewLoading.value = voiceId
  
  try {
    // TODO: Implement TTS preview endpoint
    // For now, show placeholder message
    message.info('Voice preview coming soon!')
  } catch (error) {
    console.error('Preview failed:', error)
    message.error('Failed to load voice preview')
  } finally {
    previewLoading.value = null
  }
}

function onPreviewEnd() {
  if (audioPlayer.value && audioPlayer.value.src) {
    URL.revokeObjectURL(audioPlayer.value.src)
  }
}

async function saveTemplate() {
  try {
    await formRef.value?.validate()
  } catch {
    return
  }
  
  saving.value = true
  try {
    const url = isEditing.value 
      ? `/api/ai-templates/${props.template.id}`
      : '/api/ai-templates'
    
    const method = isEditing.value ? 'PUT' : 'POST'
    
    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...formData.value,
        broker_id: props.brokerId
      })
    })
    
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail?.errors?.join(', ') || 'Failed to save template')
    }
    
    message.success(isEditing.value ? 'Template updated!' : 'Template created!')
    emit('saved')
  } catch (error) {
    console.error('Error saving template:', error)
    message.error(error.message)
  } finally {
    saving.value = false
  }
}

function handleCancel() {
  showModal.value = false
  resetForm()
}

function resetForm() {
  formData.value = {
    name: '',
    description: '',
    stt_provider: 'deepgram',
    stt_model: 'nova-2',
    stt_language: 'en-US',
    tts_provider: 'elevenlabs',
    tts_model: 'eleven_turbo_v2_5',
    tts_voice_id: '6aDn1KB0hjpdcocrUkmq', // Tiffany voice
    tts_speed: 1.0,
    tts_stability: 0.5,
    llm_provider: 'openai',
    llm_model: 'gpt-4o',
    llm_temperature: 0.7,
    llm_max_tokens: 4096,
    llm_top_p: 1.0,
    llm_frequency_penalty: 0.0,
    llm_presence_penalty: 0.0,
    vad_enabled: true,
    vad_threshold: 0.5,
    vad_prefix_padding_ms: 300,
    vad_silence_duration_ms: 500,
    turn_detection_type: 'server_vad',
    audio_input_transcription: true,
    audio_sample_rate: 24000,
    broker_id: props.brokerId
  }
  configMode.value = 'preset'
}

// Watch for template prop changes (editing mode)
watch(() => props.template, (newTemplate) => {
  if (newTemplate) {
    formData.value = { ...newTemplate }
    configMode.value = 'advanced'
  } else {
    resetForm()
  }
}, { immediate: true })

// Watch for modal show changes
watch(showModal, (show) => {
  if (show) {
    loadProviders()
    if (formData.value.stt_provider) onSTTProviderChange(formData.value.stt_provider)
    if (formData.value.tts_provider) onTTSProviderChange(formData.value.tts_provider)
    if (formData.value.llm_provider) onLLMProviderChange(formData.value.llm_provider)
  }
})

onMounted(() => {
  loadProviders()
})
</script>

<style scoped>
.select-group-header {
  font-weight: 600;
  color: #6b7280;
  padding: 8px 12px;
  background: #f9fafb;
  border-bottom: 1px solid #e5e7eb;
}

.voice-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}

.cost-breakdown {
  font-size: 0.9rem;
}

.cost-row {
  display: flex;
  justify-content: space-between;
  padding: 4px 0;
}

.cost-value {
  font-family: monospace;
  color: #10b981;
  font-weight: 600;
}

.cost-row.total {
  margin-top: 4px;
  padding-top: 8px;
}

.total-value {
  font-size: 1.2rem;
  font-weight: 700;
  color: #059669;
}

.cost-estimates {
  margin-top: 12px;
  padding: 12px;
  background: #f0fdf4;
  border-radius: 8px;
  font-size: 0.85rem;
}

.estimate-item {
  display: flex;
  justify-content: space-between;
  padding: 4px 0;
  color: #065f46;
}

.estimate-item span:last-child {
  font-weight: 600;
}
</style>

