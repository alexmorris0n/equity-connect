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

// Form data
const formData = ref({
  name: '',
  description: '',
  stt_provider: 'eden_ai',
  stt_model: 'deepgram-nova-2',
  stt_language: 'en-US',
  tts_provider: 'eden_ai',
  tts_model: 'elevenlabs-multilingual-v2',
  tts_voice_id: '21m00Tcm4TlvDq8ikWAM',
  tts_speed: 1.0,
  tts_stability: 0.5,
  llm_provider: 'openrouter',
  llm_model: 'openai/gpt-4o',
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

// Preset options
const presetOptions = ref([
  { label: 'OpenAI Realtime (Best Quality)', value: 'openai_realtime' },
  { label: 'ElevenLabs Best Quality', value: 'elevenlabs_best' },
  { label: 'Budget Friendly', value: 'budget' }
])

// Form validation rules
const rules = {
  name: { required: true, message: 'Please enter a template name', trigger: 'blur' },
  stt_provider: { required: true, message: 'Please select an STT provider', trigger: 'change' },
  tts_provider: { required: true, message: 'Please select a TTS provider', trigger: 'change' },
  llm_provider: { required: true, message: 'Please select an LLM provider', trigger: 'change' }
}

// Cost calculation
const sttCost = computed(() => {
  const costs = {
    'deepgram-nova-2': 0.0043,
    'deepgram-base': 0.0036,
    'assemblyai-best': 0.00037,
    'google-latest': 0.006,
    'whisper-1': 0.006,
    'bundled': 0.0
  }
  return costs[formData.value.stt_model] || 0.005
})

const ttsCost = computed(() => {
  const costs = {
    'elevenlabs-multilingual-v2': 0.180,
    'elevenlabs-turbo-v2.5': 0.090,
    'playht-2.0-turbo': 0.040,
    'google-neural2': 0.024,
    'openai-tts-1': 0.015,
    'openai-tts-1-hd': 0.030,
    'bundled': 0.0
  }
  return costs[formData.value.tts_model] || 0.020
})

const llmCost = computed(() => {
  const costs = {
    'openai/gpt-4o': 0.001,
    'openai/gpt-4o-mini': 0.00003,
    'anthropic/claude-3.5-sonnet': 0.0006,
    'anthropic/claude-3-haiku': 0.00005,
    'meta-llama/llama-3.1-70b-instruct': 0.000176,
    'meta-llama/llama-3.1-8b-instruct': 0.000014,
    'google/gemini-pro-1.5': 0.0007,
    'google/gemini-flash-1.5': 0.000015,
    'gpt-4o-realtime-preview': 0.0025
  }
  return costs[formData.value.llm_model] || 0.0002
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
  if (presetValue === 'openai_realtime') {
    // OpenAI Best Quality - GPT-4o Realtime (bundled STT+LLM+TTS)
    formData.value.stt_provider = 'openai_realtime'
    formData.value.stt_model = 'bundled'
    formData.value.tts_provider = 'openai_realtime'
    formData.value.tts_model = 'bundled'
    formData.value.tts_voice_id = 'shimmer'  // Female, natural
    formData.value.llm_provider = 'openai_realtime'
    formData.value.llm_model = 'gpt-4o-realtime-preview'
  } else if (presetValue === 'elevenlabs_best') {
    // ElevenLabs Best Quality - Turbo v2.5 + Deepgram + GPT-5
    formData.value.stt_provider = 'eden_ai'
    formData.value.stt_model = 'deepgram-nova-2'
    formData.value.stt_edenai_provider = 'deepgram'
    formData.value.tts_provider = 'eden_ai'
    formData.value.tts_model = 'elevenlabs-turbo-v2.5'
    formData.value.tts_edenai_provider = 'elevenlabs'
    formData.value.tts_voice_id = '6aDn1KB0hjpdcocrUkmq'  // Custom ElevenLabs voice
    formData.value.llm_provider = 'openrouter'
    formData.value.llm_model = 'openai/gpt-5'
  } else if (presetValue === 'budget') {
    // Budget Friendly - PlayHT + Deepgram + Llama 3.1
    formData.value.stt_provider = 'eden_ai'
    formData.value.stt_model = 'deepgram-nova-2'
    formData.value.stt_edenai_provider = 'deepgram'
    formData.value.tts_provider = 'eden_ai'
    formData.value.tts_model = 'playht-2.0-turbo'
    formData.value.tts_edenai_provider = 'playht'
    formData.value.tts_voice_id = 's3://voice-cloning-zero-shot/d9ff78ba-d016-47f6-b0ef-dd630f59414e/female-cs/manifest.json'  // Charlotte
    formData.value.llm_provider = 'openrouter'
    formData.value.llm_model = 'meta-llama/llama-3.1-70b-instruct'
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
    stt_provider: 'eden_ai',
    stt_model: 'deepgram-nova-2',
    stt_language: 'en-US',
    tts_provider: 'eden_ai',
    tts_model: 'elevenlabs-multilingual-v2',
    tts_voice_id: '21m00Tcm4TlvDq8ikWAM',
    tts_speed: 1.0,
    tts_stability: 0.5,
    llm_provider: 'openrouter',
    llm_model: 'openai/gpt-4o',
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

