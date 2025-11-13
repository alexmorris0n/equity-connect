<template>
  <div class="verticals-page">
    <!-- Compact Header Toolbar -->
    <header class="page-header">
      <h1 class="page-title">BarbGraph Vertical Manager</h1>
      <div class="vertical-selector">
        <label for="vertical-select">Vertical:</label>
        <select id="vertical-select" v-model="selectedVertical" @change="onVerticalChange">
          <option value="">-- Select Vertical --</option>
          <option value="reverse_mortgage">Reverse Mortgage</option>
          <option value="solar">Solar</option>
          <option value="hvac">HVAC</option>
        </select>
      </div>
    </header>

    <!-- Global Settings Tabs -->
    <div v-if="selectedVertical" class="settings-tabs">
      <button
        v-for="tab in settingsTabs"
        :key="tab.key"
        class="tab-button"
        :class="{ active: activeTab === tab.key }"
        @click="activeTab = tab.key"
      >
        {{ tab.label }}
      </button>
    </div>

    <!-- Main Content Area -->
    <div v-if="selectedVertical" class="main-content">
      <!-- Versions Bar (responsive) -->
      <aside class="versions-bar" :class="{ 'mobile': isMobile }">
        <div class="versions-header">
          <h3>Versions</h3>
        </div>
        <div class="versions-list" :class="{ 'horizontal': isMobile }">
          <button
            v-for="version in versions"
            :key="version.id"
            class="version-item"
            :class="{ active: currentVersion?.id === version.id }"
            @click="loadVersion(version.id)"
          >
            <span class="version-badge" v-if="version.is_active">Active</span>
            <span class="version-badge draft" v-else-if="version.is_draft">Draft</span>
            <span class="version-number">v{{ version.version_number }}</span>
            <span class="version-date">{{ formatDate(version.created_at) }}</span>
            <button 
              v-if="version.is_draft && !version.is_active" 
              class="btn-delete" 
              @click.stop="deleteVersion(version.id)"
              :disabled="loading"
              title="Delete draft"
            >
              ×
            </button>
          </button>
        </div>
      </aside>

      <!-- Content Area -->
      <div class="content-area">
        <!-- Theme Tab -->
        <div v-if="activeTab === 'theme'" class="tab-content">
          <div class="theme-editor-section">
            <h2>Theme Content</h2>
            <div class="editor-wrapper">
              <textarea
                v-model="themeContent"
                class="theme-editor"
                placeholder="Enter theme content here..."
                @input="themeHasChanges = true"
              ></textarea>
            </div>
            <div class="editor-actions">
              <button class="btn-save" @click="saveTheme" :disabled="loading || !themeHasChanges">
                Save Theme
              </button>
            </div>
          </div>
        </div>

        <!-- Models & Voice Tab -->
        <div v-if="activeTab === 'models'" class="tab-content">
          <div class="settings-form">
            <h2>Models & Voice Configuration</h2>
            
            <div class="form-group">
              <label>LLM Provider</label>
              <select v-model="config.models.llm.provider" @change="onLLMProviderChange">
                <option value="openai">OpenAI</option>
                <!-- SignalWire only supports OpenAI by default. Other providers require custom integration. -->
              </select>
              <small class="form-hint">SignalWire SDK supports OpenAI models by default. Other providers (Anthropic, Groq, etc.) require bringing your own model integration.</small>
            </div>

            <div class="form-group">
              <label>LLM Model</label>
              <select v-model="config.models.llm.model" :disabled="availableLLMModels.length === 0">
                <option v-if="availableLLMModels.length === 0" value="">No models available - check database</option>
                <option v-for="model in availableLLMModels" :key="model.value" :value="model.value">
                  {{ model.label }}
                </option>
              </select>
            </div>

            <div class="form-group">
              <label>STT Provider</label>
              <select v-model="config.models.stt.provider" @change="onSTTProviderChange">
                <option value="deepgram">Deepgram</option>
                <option value="openai">OpenAI</option>
                <option value="assemblyai">AssemblyAI</option>
                <option value="google">Google Cloud</option>
              </select>
            </div>

            <div class="form-group">
              <label>STT Model</label>
              <select v-model="config.models.stt.model" :disabled="availableSTTModels.length === 0">
                <option v-for="model in availableSTTModels" :key="model.value" :value="model.value">
                  {{ model.label }}
                </option>
              </select>
            </div>

            <div class="form-group">
              <label>TTS Provider</label>
              <select v-model="config.models.tts.provider" @change="onTTSProviderChange">
                <option value="elevenlabs">ElevenLabs</option>
                <option value="openai">OpenAI</option>
                <option value="amazon">Amazon Polly</option>
                <option value="rime">Rime</option>
                <option value="google">Google Cloud</option>
                <option value="cartesia">Cartesia</option>
                <option value="azure">Microsoft Azure</option>
                <option value="speechify">Speechify</option>
              </select>
            </div>

            <div class="form-group">
              <label>TTS Voice</label>
              <select v-model="config.models.tts.voice" :disabled="availableTTSVoices.length === 0">
                <option v-for="voice in availableTTSVoices" :key="voice.value" :value="voice.value">
                  {{ voice.label }}
                </option>
              </select>
            </div>

            <div class="form-group">
              <label>VAD Enabled</label>
              <input type="checkbox" v-model="config.vad.enabled" />
            </div>

            <div class="form-group" v-if="config.vad.enabled">
              <label>VAD Silence (ms)</label>
              <input type="number" v-model.number="config.vad.silence_ms" />
            </div>

            <div class="form-group">
              <label>End of Speech Timeout (ms)</label>
              <input type="number" v-model.number="config.eos_timeout_ms" />
            </div>

            <div class="form-group">
              <label>Record Calls</label>
              <input type="checkbox" v-model="config.record_call" />
            </div>

            <div class="form-actions">
              <button class="btn-save" @click="saveConfig" :disabled="loading">
                Save Settings
              </button>
              <button class="btn-test" @click="testSettings" :disabled="loading">
                Test Configuration
              </button>
            </div>
          </div>
        </div>

        <!-- Telephony Tab -->
        <div v-if="activeTab === 'telephony'" class="tab-content">
          <div class="settings-form">
            <h2>Telephony Settings</h2>
            
            <div class="form-group">
              <label>Auto Answer</label>
              <input type="checkbox" v-model="config.telephony.auto_answer" />
            </div>

            <div class="form-group">
              <label>Ring Delay (ms)</label>
              <input type="number" v-model.number="config.telephony.ring_delay_ms" />
            </div>

            <div class="form-actions">
              <button class="btn-save" @click="saveConfig" :disabled="loading">
                Save Settings
              </button>
            </div>
          </div>
        </div>

        <!-- Safety Tab -->
        <div v-if="activeTab === 'safety'" class="tab-content">
          <div class="settings-form">
            <h2>Safety Settings</h2>
            
            <div class="form-group">
              <label>Blocked Phrases (one per line)</label>
              <textarea
                v-model="blockedPhrasesText"
                placeholder="Enter blocked phrases, one per line"
                rows="5"
              ></textarea>
            </div>

            <div class="form-group">
              <label>Max Tool Depth</label>
              <input type="number" v-model.number="config.safety.max_tool_depth" min="1" max="5" />
            </div>

            <div class="form-actions">
              <button class="btn-save" @click="saveConfig" :disabled="loading">
                Save Settings
              </button>
            </div>
          </div>
        </div>

        <!-- Nodes Tab (visible when vertical selected, hidden on Models & Voice, Telephony, Safety tabs) -->
        <div v-if="activeTab === 'theme'" class="nodes-section">
          <div class="nodes-header">
            <h2>Nodes</h2>
          </div>
          
          <div class="nodes-grid">
            <div
              v-for="node in nodeKeys"
              :key="node"
              class="node-card"
              :class="{ expanded: expandedNodes[node], active: selectedNode === node }"
            >
              <div class="node-card-header" @click.stop="toggleNode(node)">
                <span class="node-name">{{ node.charAt(0).toUpperCase() + node.slice(1) }}</span>
                <span class="node-toggle">{{ expandedNodes[node] ? '−' : '+' }}</span>
              </div>
              
              <div v-if="expandedNodes[node]" class="node-card-content">
                <div class="node-editor">
                  <div class="editor-field">
                    <label>Role</label>
                    <textarea
                      :value="nodeContent[node]?.role || ''"
                      @input="(e) => updateRole(node, e.target.value)"
                      placeholder="Who is Barbara in this stage?"
                      rows="3"
                    ></textarea>
                  </div>
                  
                  <div class="editor-field">
                    <label>Instructions</label>
                    <textarea
                      :value="nodeContent[node]?.instructions || ''"
                      @input="(e) => updateInstructions(node, e.target.value)"
                      placeholder="What should Barbara do?"
                      rows="6"
                    ></textarea>
                  </div>
                  
                  <div class="editor-field">
                    <label>Tools</label>
                    <div 
                      class="tools-dropdown-wrapper" 
                      :class="{ 'open': openDropdowns[node], 'drop-up': dropdownPositions[node]?.dropUp }"
                      :data-dropdown-node="node"
                      :ref="el => setDropdownWrapperRef(node, el)"
                    >
                      <button
                        type="button"
                        class="tools-dropdown-trigger"
                        @click="toggleDropdown(node)"
                      >
                        <span v-if="!nodeContent[node]?.tools || nodeContent[node].tools.length === 0">
                          Select tools...
                        </span>
                        <span v-else>
                          {{ getSelectedDisplayCount(node) }} tool{{ getSelectedDisplayCount(node) !== 1 ? 's' : '' }} selected
                        </span>
                        <span class="dropdown-arrow">▼</span>
                      </button>
                      <div 
                        v-if="openDropdowns[node]" 
                        class="tools-dropdown-panel"
                        :style="dropdownPositions[node]?.style"
                      >
                        <div class="dropdown-search">
                          <input
                            type="text"
                            v-model="toolSearch[node]"
                            placeholder="Search tools..."
                            class="search-input"
                            @click.stop
                          />
                        </div>
                        <div class="dropdown-options">
                          <label class="dropdown-option select-all">
                            <input
                              type="checkbox"
                              :checked="isAllToolsSelected(node)"
                              @change="toggleSelectAll(node)"
                              @click.stop
                            />
                            <span>Select all</span>
                          </label>
                          <label
                            v-for="tool in filteredTools(node)"
                            :key="tool"
                            class="dropdown-option"
                            @click.stop
                          >
                            <input
                              type="checkbox"
                            :value="tool"
                            v-model="nodeContent[node].tools"
                            />
                            <span>{{ tool }}</span>
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div class="node-actions">
                    <button
                      class="btn-save"
                      @click="saveNode(node)"
                      :disabled="loading || !nodeHasChanges[node]"
                    >
                      Save Node
                    </button>
                    <button class="btn-preview" @click="showPreview(node)">
                      Preview
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Preview Panel (desktop only, shows when preview is active) -->
      <aside v-if="!isMobile && previewContent" class="preview-panel">
        <div class="preview-header">
          <h3>Preview</h3>
          <button class="btn-close" @click="previewContent = null">×</button>
        </div>
        <div class="preview-content">
          <pre>{{ previewContent }}</pre>
        </div>
      </aside>
    </div>

    <!-- Empty State -->
    <div v-else class="empty-state">
      <p>Please select a vertical to begin managing BarbGraph prompts.</p>
    </div>

    <!-- Test Modal -->
    <div v-if="showTestModal" class="modal-overlay" @click="showTestModal = false">
      <div class="modal-content" @click.stop>
        <h3>Test Configuration</h3>
        <div class="test-results">
          <pre>{{ testResults }}</pre>
        </div>
        <button class="btn-close" @click="showTestModal = false">Close</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { supabase } from '@/lib/supabase'

// Constants
const nodeKeys = ['greet', 'verify', 'qualify', 'quote', 'answer', 'objections', 'book', 'exit']

// All available tools for multi-select
// Dropdown state
const openDropdowns = ref({})
const toolSearch = ref({})
const dropdownPositions = ref({})
const isUpdatingPosition = ref({}) // Guard to prevent infinite loops

// Baseline BarbGraph flow flags - not user-editable, enforced in backend
const BASELINE_FLOW_TOOLS = [
  'mark_ready_to_book',
  'mark_has_objection',
  'mark_objection_handled',
  'mark_questions_answered',
  'mark_qualification_result',
  'mark_quote_presented',
  'mark_wrong_person',
  'clear_conversation_flags'
]

// Non-editable tools hidden from UI (always-allowed or enforced server-side)
const NON_EDITABLE_TOOLS = [
  'get_lead_context',
  ...BASELINE_FLOW_TOOLS
]

const availableTools = [
  // Lead Management
  'get_lead_context',
  'verify_caller_identity',
  'check_consent_dnc',
  'update_lead_info',
  'find_broker_by_territory',
  // Calendar
  'check_broker_availability',
  'book_appointment',
  'cancel_appointment',
  'reschedule_appointment',
  // Knowledge
  'search_knowledge',
  // Interaction & Tracking
  'save_interaction',
  'assign_tracking_number',
  'send_appointment_confirmation',
  'verify_appointment_confirmation',
  // Conversation Flow Flags
  'mark_ready_to_book',
  'mark_has_objection',
  'mark_objection_handled',
  'mark_questions_answered',
  'mark_qualification_result',
  'mark_quote_presented',
  'mark_wrong_person',
  'clear_conversation_flags'
]

// State
const selectedVertical = ref('reverse_mortgage')
const activeTab = ref('theme')
const selectedNode = ref(null)
const loading = ref(false)
const isMobile = ref(window.innerWidth < 768)

// Theme state
const themeContent = ref('')
const themeHasChanges = ref(false)
const themeId = ref(null)

// LLM Provider to Models mapping (SignalWire available models)
const LLM_MODELS = {
  openai: [
    { value: 'gpt-4o', label: 'GPT-4o' },
    { value: 'gpt-4o-mini', label: 'GPT-4o Mini' }
  ],
  anthropic: [
    { value: 'claude-3-5-sonnet', label: 'Claude 3.5 Sonnet' }
  ],
  groq: [
    { value: 'llama-3.1-70b-versatile', label: 'Llama 3.1 70B Versatile' },
    { value: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B Instant' }
  ]
}

// STT Provider to Models mapping (SignalWire available models)
const STT_MODELS = {
  deepgram: [
    { value: 'nova-2', label: 'Nova-2' },
    { value: 'nova-3', label: 'Nova-3' }
  ],
  openai: [
    { value: 'whisper-1', label: 'Whisper-1' },
    { value: 'gpt-4o-transcribe', label: 'GPT-4o Transcribe' }
  ],
  assemblyai: [
    { value: 'universal-streaming', label: 'Universal Streaming' }
  ],
  google: [
    { value: 'latest_long', label: 'Latest Long' },
    { value: 'latest_short', label: 'Latest Short' }
  ]
}

// TTS Provider to Voices mapping (SignalWire available voices)
const TTS_VOICES = {
  elevenlabs: [
    { value: 'rachel', label: 'Rachel' },
    { value: 'tiffany', label: 'Tiffany' },
    { value: 'domi', label: 'Domi' },
    { value: 'bella', label: 'Bella' },
    { value: 'antoni', label: 'Antoni' },
    { value: 'elli', label: 'Elli' },
    { value: 'josh', label: 'Josh' },
    { value: 'arnold', label: 'Arnold' },
    { value: 'adam', label: 'Adam' },
    { value: 'sam', label: 'Sam' }
  ],
  openai: [
    { value: 'alloy', label: 'Alloy' },
    { value: 'echo', label: 'Echo' },
    { value: 'fable', label: 'Fable' },
    { value: 'onyx', label: 'Onyx' },
    { value: 'nova', label: 'Nova' },
    { value: 'shimmer', label: 'Shimmer' }
  ],
  google: [
    { value: 'en-US-Neural2-A', label: 'Neural2-A (Female)' },
    { value: 'en-US-Neural2-B', label: 'Neural2-B (Male)' },
    { value: 'en-US-Neural2-C', label: 'Neural2-C (Female)' },
    { value: 'en-US-Neural2-D', label: 'Neural2-D (Male)' },
    { value: 'en-US-Neural2-E', label: 'Neural2-E (Female)' },
    { value: 'en-US-Neural2-F', label: 'Neural2-F (Female)' }
  ],
  speechify: [
    { value: 'default', label: 'Default' }
  ]
}

// Config state
const config = ref({
  models: {
    llm: { provider: 'openai', model: 'gpt-4o' },
    stt: { provider: 'deepgram', model: 'nova-3' },
    tts: { provider: 'elevenlabs', voice: 'rachel' }
  },
  vad: { enabled: true, silence_ms: 700 },
  eos_timeout_ms: 800,
  record_call: true,
  telephony: { auto_answer: false, ring_delay_ms: 4000 },
  safety: { blocked_phrases: [], max_tool_depth: 2 }
})

// LLM models loaded from database (will be populated on mount)
const llmModelsFromDB = ref({})

// Load LLM models from database
async function loadLLMModelsFromDB() {
  try {
    const { data, error } = await supabase
      .from('signalwire_available_llm_models')
      .select('provider, model_name, display_name, context_window')
      .eq('is_available', true)
      .order('provider', { ascending: true })
      .order('display_name', { ascending: true })
    
    if (error) {
      console.warn('Could not load LLM models from DB, using fallback:', error)
      return // Use fallback LLM_MODELS
    }
    
    if (data && data.length > 0) {
      // Group by provider
      const grouped = {}
      data.forEach(model => {
        if (!grouped[model.provider]) {
          grouped[model.provider] = []
        }
        grouped[model.provider].push({
          value: model.model_name,
          label: model.display_name || model.model_name
        })
      })
      llmModelsFromDB.value = grouped
      console.log('Loaded LLM models from DB:', Object.keys(grouped).length, 'providers')
    }
  } catch (err) {
    console.warn('Error loading LLM models from DB, using fallback:', err)
  }
}

// Computed: Available LLM models for selected provider (from DB or fallback)
const availableLLMModels = computed(() => {
  const provider = config.value.models.llm.provider
  // Use DB models if available, otherwise fallback to hardcoded
  if (llmModelsFromDB.value[provider] && llmModelsFromDB.value[provider].length > 0) {
    return llmModelsFromDB.value[provider]
  }
  return LLM_MODELS[provider] || []
})

// STT models loaded from database (will be populated on mount)
const sttModelsFromDB = ref({})

// Load STT models from database
async function loadSTTModelsFromDB() {
  try {
    const { data, error } = await supabase
      .from('signalwire_available_stt_models')
      .select('provider, model_name, display_name, language_codes')
      .eq('is_available', true)
      .order('provider', { ascending: true })
      .order('display_name', { ascending: true })
    
    if (error) {
      console.warn('Could not load STT models from DB, using fallback:', error)
      return // Use fallback STT_MODELS
    }
    
    if (data && data.length > 0) {
      // Group by provider
      const grouped = {}
      data.forEach(model => {
        if (!grouped[model.provider]) {
          grouped[model.provider] = []
        }
        grouped[model.provider].push({
          value: model.model_name,
          label: model.display_name || model.model_name
        })
      })
      sttModelsFromDB.value = grouped
      console.log('Loaded STT models from DB:', Object.keys(grouped).length, 'providers')
    }
  } catch (err) {
    console.warn('Error loading STT models from DB, using fallback:', err)
  }
}

// Computed: Available STT models for selected provider (from DB or fallback)
const availableSTTModels = computed(() => {
  const provider = config.value.models.stt.provider
  // Use DB models if available, otherwise fallback to hardcoded
  if (sttModelsFromDB.value[provider] && sttModelsFromDB.value[provider].length > 0) {
    return sttModelsFromDB.value[provider]
  }
  return STT_MODELS[provider] || []
})

// TTS voices loaded from database (will be populated on mount)
const ttsVoicesFromDB = ref({})

// Load TTS voices from database
async function loadTTSVoicesFromDB() {
  try {
    const { data, error } = await supabase
      .from('signalwire_available_voices')
      .select('provider, voice_name, display_name, gender, accent')
      .eq('is_available', true)
      .order('provider', { ascending: true })
      .order('display_name', { ascending: true })
    
    if (error) {
      console.warn('Could not load voices from DB, using fallback:', error)
      return // Use fallback TTS_VOICES
    }
    
    if (data && data.length > 0) {
      // Group by provider
      const grouped = {}
      data.forEach(voice => {
        if (!grouped[voice.provider]) {
          grouped[voice.provider] = []
        }
        grouped[voice.provider].push({
          value: voice.voice_name,
          label: voice.display_name || voice.voice_name
        })
      })
      ttsVoicesFromDB.value = grouped
      console.log('Loaded TTS voices from DB:', Object.keys(grouped).length, 'providers')
    }
  } catch (err) {
    console.warn('Error loading voices from DB, using fallback:', err)
  }
}

// Computed: Available TTS voices for selected provider (from DB or fallback)
const availableTTSVoices = computed(() => {
  const provider = config.value.models.tts.provider
  // Use DB voices if available, otherwise fallback to hardcoded
  if (ttsVoicesFromDB.value[provider] && ttsVoicesFromDB.value[provider].length > 0) {
    return ttsVoicesFromDB.value[provider]
  }
  return TTS_VOICES[provider] || []
})

const blockedPhrasesText = computed({
  get: () => config.value.safety.blocked_phrases.join('\n'),
  set: (val) => {
    config.value.safety.blocked_phrases = val.split('\n').filter(p => p.trim())
  }
})

// Node state
const nodeContent = ref({})
const nodeHasChanges = ref({})
const expandedNodes = ref({})
const nodePrompts = ref({})

// Computed function to check if tool is selected (for reactivity)
function getToolCheckedState(node, tool) {
  const tools = nodeContent.value[node]?.tools
  if (!tools || !Array.isArray(tools)) return false
  return tools.includes(tool)
}

// Versions state
const versions = ref([])
const currentVersion = ref(null)

// Preview state
const previewContent = ref(null)

// Test modal
const showTestModal = ref(false)
const testResults = ref('')

// Settings tabs
const settingsTabs = [
  { key: 'theme', label: 'Theme' },
  { key: 'models', label: 'Models & Voice' },
  { key: 'telephony', label: 'Telephony' },
  { key: 'safety', label: 'Safety' }
]

// Initialize node content structure
function initNodeContent() {
  nodeKeys.forEach(node => {
    if (!nodeContent.value[node]) {
      nodeContent.value[node] = {
        role: '',
        instructions: '',
        tools: [] // Initialize as empty array for multi-select
      }
    }
    if (nodeHasChanges.value[node] === undefined) {
      nodeHasChanges.value[node] = false
    }
    if (expandedNodes.value[node] === undefined) {
      expandedNodes.value[node] = false
    }
  })
}

// Load theme and config
async function loadTheme() {
  if (!selectedVertical.value) return
  
  loading.value = true
  try {
    console.log('Loading theme for vertical:', selectedVertical.value)
    // Load theme with version and config columns
    let { data, error } = await supabase
      .from('theme_prompts')
      .select('id, content, config, version')
      .eq('vertical', selectedVertical.value)
      .eq('is_active', true)
      .maybeSingle()
    
    // If config or version column doesn't exist, try without them
    if (error && error.code === '42703') {
      console.log('Config or version column not found, loading without them')
      const result = await supabase
        .from('theme_prompts')
        .select('id, content')
        .eq('vertical', selectedVertical.value)
        .eq('is_active', true)
        .maybeSingle()
      data = result.data
      error = result.error
    }
    
    if (error) {
      console.error('Supabase error loading theme:', error)
      throw error
    }
    
    console.log('Theme data loaded:', data)
    
    if (data) {
      themeId.value = data.id
      themeContent.value = data.content || ''
      console.log('Theme content set:', themeContent.value ? `${themeContent.value.length} chars` : 'empty')
      if (data.config) {
        config.value = { ...config.value, ...data.config }
      }
      
      // Initialize version if missing
      if (!data.version) {
        const { error: initError } = await supabase
          .from('theme_prompts')
          .update({ version: 1 })
          .eq('id', data.id)
        if (initError) console.error('Error initializing version:', initError)
      }
      
      themeHasChanges.value = false
    } else {
      console.log('No theme found for vertical:', selectedVertical.value)
      themeContent.value = ''
      themeId.value = null
    }
  } catch (error) {
    console.error('Error loading theme:', error)
    console.error('Error details:', JSON.stringify(error, null, 2))
    // Don't show error if theme just doesn't exist yet (first time setup)
    if (error.code !== 'PGRST116') {
      window.$message?.error('Failed to load theme: ' + (error.message || 'Unknown error'))
    }
  } finally {
    loading.value = false
  }
}

// Save theme and config
async function saveTheme() {
  if (!selectedVertical.value) return
  
  loading.value = true
  try {
    // 1) Upsert theme content/config
    const updateData = {
      content: themeContent.value,
      config: config.value,
      updated_at: new Date().toISOString()
    }
    
    if (themeId.value) {
      const { error } = await supabase
        .from('theme_prompts')
        .update(updateData)
        .eq('id', themeId.value)
      if (error) throw error
    } else {
      const { data, error } = await supabase
        .from('theme_prompts')
        .insert({
          vertical: selectedVertical.value,
          content: themeContent.value,
          config: config.value,
          is_active: true
        })
        .select()
        .single()
      if (error) throw error
      themeId.value = data.id
    }

    // 2) Read current vertical version and increment
    const { data: themeData, error: themeErr } = await supabase
      .from('theme_prompts')
      .select('version')
      .eq('vertical', selectedVertical.value)
      .eq('is_active', true)
      .maybeSingle()
    if (themeErr) throw themeErr

    const currentVersion = themeData?.version || 1
    const newVerticalVersion = currentVersion + 1

    // 3) Update theme version to the new vertical version
    const { error: updateVerErr } = await supabase
      .from('theme_prompts')
      .update({ version: newVerticalVersion })
      .eq('vertical', selectedVertical.value)
      .eq('is_active', true)
    if (updateVerErr) throw updateVerErr

    // 4) Clone all node prompt versions to the new vertical version (content unchanged)
    const { data: prompts, error: promptsErr } = await supabase
      .from('prompts')
      .select(`
        id,
        node_name,
        prompt_versions!inner (
          id,
          version_number,
          content,
          is_active
        )
      `)
      .eq('vertical', selectedVertical.value)
      .eq('prompt_versions.is_active', true)
      .not('node_name', 'is', null)
    if (promptsErr) throw promptsErr

    for (const p of (prompts || [])) {
      const activeVersion = Array.isArray(p.prompt_versions) ? p.prompt_versions[0] : p.prompt_versions
      const priorContent = activeVersion?.content || { role: '', instructions: '', tools: [] }

      // Deactivate all existing versions for this prompt
      await supabase
        .from('prompt_versions')
        .update({ is_active: false })
        .eq('prompt_id', p.id)

      // Insert the cloned version with the new vertical version
      const { error: insertErr } = await supabase
        .from('prompt_versions')
        .insert({
          prompt_id: p.id,
          version_number: newVerticalVersion,
          content: priorContent,
          is_active: true,
          is_draft: false,
          created_by: 'portal',
          change_summary: `Vertical v${newVerticalVersion} - theme updated; node content carried forward`
        })
      if (insertErr) throw insertErr

      // Update prompt current_version to new vertical version
      await supabase
        .from('prompts')
        .update({ current_version: newVerticalVersion })
        .eq('id', p.id)
    }

    themeHasChanges.value = false
    window.$message?.success(`Theme saved. Vertical version: v${newVerticalVersion}`)
  } catch (error) {
    console.error('Error saving theme:', error)
    window.$message?.error('Failed to save theme: ' + error.message)
  } finally {
    loading.value = false
  }
}

// Save config (called from Models/Telephony/Safety tabs)
async function saveConfig() {
  await saveTheme() // Config is stored with theme
}

// Handle LLM provider change - reset model to first available
function onLLMProviderChange() {
  const models = availableLLMModels.value
  if (models.length > 0) {
    config.value.models.llm.model = models[0].value
  }
}

// Handle STT provider change - reset model to first available
function onSTTProviderChange() {
  const models = availableSTTModels.value
  if (models.length > 0) {
    config.value.models.stt.model = models[0].value
  }
}

// Handle TTS provider change - reset voice to first available
function onTTSProviderChange() {
  const voices = availableTTSVoices.value
  if (voices.length > 0) {
    config.value.models.tts.voice = voices[0].value
  }
}

// Load node prompts
// IMPORTANT: Loads versions matching the SHARED vertical version from theme_prompts
async function loadNodePrompts() {
  if (!selectedVertical.value) return
  
  loading.value = true
  try {
    // Get current vertical version from theme_prompts
    const { data: themeData, error: themeError } = await supabase
      .from('theme_prompts')
      .select('version')
      .eq('vertical', selectedVertical.value)
      .eq('is_active', true)
      .maybeSingle()
    
    if (themeError) throw themeError
    
    const verticalVersion = themeData?.version || 1
    console.log('loadNodePrompts: Loading nodes for vertical version:', verticalVersion)
    
    // Query prompts and their versions matching the vertical version
    const { data, error } = await supabase
      .from('prompts')
      .select(`
        id,
        name,
        vertical,
        node_name,
        current_version,
        prompt_versions!inner (
          id,
          version_number,
          content,
          is_active,
          is_draft
        )
      `)
      .eq('vertical', selectedVertical.value)
      // Always load the active version for each node (regardless of vertical version)
      .eq('prompt_versions.is_active', true)  // Only active versions (includes drafts)
      .not('node_name', 'is', null)
    
    if (error) throw error
    
    console.log('loadNodePrompts: Loaded prompts:', data)
    
    const grouped = {}
    for (const p of (data || [])) {
      // Choose the active version if present, otherwise fall back to latest by version_number
      let matchingVersion
      if (Array.isArray(p.prompt_versions)) {
        matchingVersion = p.prompt_versions.find(v => v.is_active)
        if (!matchingVersion) {
          matchingVersion = [...p.prompt_versions].sort((a, b) => (b.version_number || 0) - (a.version_number || 0))[0]
        }
      } else {
        matchingVersion = p.prompt_versions
      }
      
      if (matchingVersion) {
        grouped[p.node_name] = {
          id: p.id,
          vertical: p.vertical,
          node_name: p.node_name,
          name: p.name,
          version_number: matchingVersion.version_number,
          content: matchingVersion.content
        }
        
        console.log('loadNodePrompts: Grouped node', p.node_name, 'version', matchingVersion.version_number, ':', grouped[p.node_name])
        
        // Initialize node content from matching version
        if (matchingVersion.content) {
          // Handle tools - convert to array for multi-select
          let toolsArray = []
          const toolsData = matchingVersion.content.tools
          
          // Supabase JSONB can come as string or array - handle both
          if (Array.isArray(toolsData)) {
            // Already an array - use directly, just filter out invalid entries
            toolsArray = toolsData
              .flatMap(t => {
                if (typeof t === 'string') {
                  // Check if it's a stringified array like "[\"web_search\"]"
                  const trimmed = t.trim()
                  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
                    try {
                      const parsed = JSON.parse(trimmed)
                      return Array.isArray(parsed) ? parsed.filter(i => typeof i === 'string') : []
                    } catch {
                      return trimmed !== '' && trimmed !== '[]' ? [t] : []
                    }
                  }
                  return trimmed !== '' && trimmed !== '[]' ? [t] : []
                } else if (Array.isArray(t)) {
                  return t.filter(item => typeof item === 'string' && item.trim() !== '')
                }
                return []
              })
              .filter(t => typeof t === 'string' && t.trim() !== '' && t !== '[]')
          } else if (typeof toolsData === 'string') {
            // String case - parse it
            const trimmed = toolsData.trim()
            if (trimmed === '' || trimmed === '[]') {
              toolsArray = []
            } else {
              try {
                const parsed = JSON.parse(trimmed)
                if (Array.isArray(parsed)) {
                  // Flatten any nested stringified arrays
                  toolsArray = parsed
                    .flatMap(t => {
                      if (typeof t === 'string') {
                        if (t.trim().startsWith('[') && t.trim().endsWith(']')) {
                          try {
                            const innerParsed = JSON.parse(t.trim())
                            return Array.isArray(innerParsed) ? innerParsed.filter(i => typeof i === 'string') : [t]
                          } catch {
                            return t.trim() !== '' && t.trim() !== '[]' ? [t] : []
                          }
                        }
                        return t.trim() !== '' && t.trim() !== '[]' ? [t] : []
                      } else if (Array.isArray(t)) {
                        return t.filter(item => typeof item === 'string' && item.trim() !== '')
                      }
                      return []
                    })
                    .filter(t => typeof t === 'string' && t.trim() !== '' && t !== '[]')
                } else {
                  toolsArray = []
                }
              } catch {
                // Not JSON, treat as comma-separated
                toolsArray = trimmed.split(',').map(t => t.trim()).filter(t => t && t !== '[]' && t !== '')
              }
            }
          }
          
          // Final safety check
          if (!Array.isArray(toolsArray)) {
            toolsArray = []
          }
          
          console.log('loadNodePrompts: Tools for', p.node_name, '- Raw:', toolsData, 'type:', typeof toolsData, 'isArray:', Array.isArray(toolsData))
          console.log('loadNodePrompts: Parsed toolsArray:', toolsArray, 'length:', toolsArray.length)
          
          // Use Vue's reactive assignment to ensure reactivity
          if (!nodeContent.value[p.node_name]) {
            nodeContent.value[p.node_name] = {}
          }
          nodeContent.value[p.node_name].role = matchingVersion.content.role || ''
          nodeContent.value[p.node_name].instructions = matchingVersion.content.instructions || ''
          nodeContent.value[p.node_name].tools = [...toolsArray] // Create new array copy for reactivity
          
          console.log('loadNodePrompts: Set nodeContent for', p.node_name, ':', nodeContent.value[p.node_name])
          console.log('loadNodePrompts: Tools in nodeContent:', nodeContent.value[p.node_name].tools)
          console.log('loadNodePrompts: Tools array type:', Array.isArray(nodeContent.value[p.node_name].tools), 'length:', nodeContent.value[p.node_name].tools.length)
          console.log('loadNodePrompts: Tools array contents:', JSON.stringify(nodeContent.value[p.node_name].tools))
        } else {
          // Initialize empty if no content
          nodeContent.value[p.node_name] = {
            role: '',
            instructions: '',
            tools: [] // Initialize as empty array for multi-select
          }
        }
      }
    }
    
    nodePrompts.value[selectedVertical.value] = grouped
    console.log('loadNodePrompts: Final nodePrompts:', nodePrompts.value[selectedVertical.value])
    initNodeContent()
  } catch (error) {
    console.error('Error loading node prompts:', error)
    window.$message?.error('Failed to load node prompts: ' + error.message)
  } finally {
    loading.value = false
  }
}

// Load versions for a node
async function loadVersions(nodeName) {
  if (!selectedVertical.value || !nodeName) return
  
  loading.value = true
  try {
    const nodePrompt = nodePrompts.value[selectedVertical.value]?.[nodeName]
    if (!nodePrompt) {
      versions.value = []
      currentVersion.value = null
      return
    }
    
    const { data, error } = await supabase
      .from('prompt_versions')
      .select('*')
      .eq('prompt_id', nodePrompt.id)
      .order('version_number', { ascending: false })
    
    if (error) throw error
    
    versions.value = data || []
    if (versions.value.length > 0) {
      const activeVersion = versions.value.find(v => v.is_active) || versions.value[0]
      await loadVersion(activeVersion.id)
    } else {
      currentVersion.value = null
    }
  } catch (error) {
    console.error('Error loading versions:', error)
    window.$message?.error('Failed to load versions: ' + error.message)
  } finally {
    loading.value = false
  }
}

// Load a specific version
async function loadVersion(versionId) {
  loading.value = true
  try {
    const { data, error } = await supabase
      .from('prompt_versions')
      .select('*')
      .eq('id', versionId)
      .single()
    
    if (error) throw error
    
    currentVersion.value = data
    
    if (data.content && selectedNode.value) {
      console.log('loadVersion: Loading content for', selectedNode.value, ':', data.content)
      
      // Handle tools - convert to array for multi-select
      let toolsArray = []
      const toolsData = data.content.tools
      
      // Supabase JSONB can come as string or array - handle both
      if (Array.isArray(toolsData)) {
        // Already an array - use directly, just filter out invalid entries
        toolsArray = toolsData
          .flatMap(t => {
            if (typeof t === 'string') {
              // Check if it's a stringified array like "[\"web_search\"]"
              const trimmed = t.trim()
              if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
                try {
                  const parsed = JSON.parse(trimmed)
                  return Array.isArray(parsed) ? parsed.filter(i => typeof i === 'string') : []
                } catch {
                  return trimmed !== '' && trimmed !== '[]' ? [t] : []
                }
              }
              return trimmed !== '' && trimmed !== '[]' ? [t] : []
            } else if (Array.isArray(t)) {
              return t.filter(item => typeof item === 'string' && item.trim() !== '')
            }
            return []
          })
          .filter(t => typeof t === 'string' && t.trim() !== '' && t !== '[]')
      } else if (typeof toolsData === 'string') {
        // String case - parse it
        const trimmed = toolsData.trim()
        if (trimmed === '' || trimmed === '[]') {
          toolsArray = []
        } else {
          try {
            const parsed = JSON.parse(trimmed)
            if (Array.isArray(parsed)) {
              // Flatten any nested stringified arrays
              toolsArray = parsed
                .flatMap(t => {
                  if (typeof t === 'string') {
                    if (t.trim().startsWith('[') && t.trim().endsWith(']')) {
                      try {
                        const innerParsed = JSON.parse(t.trim())
                        return Array.isArray(innerParsed) ? innerParsed.filter(i => typeof i === 'string') : [t]
                      } catch {
                        return t.trim() !== '' && t.trim() !== '[]' ? [t] : []
                      }
                    }
                    return t.trim() !== '' && t.trim() !== '[]' ? [t] : []
                  } else if (Array.isArray(t)) {
                    return t.filter(item => typeof item === 'string' && item.trim() !== '')
                  }
                  return []
                })
                .filter(t => typeof t === 'string' && t.trim() !== '' && t !== '[]')
            } else {
              toolsArray = []
            }
          } catch {
            // Not JSON, treat as comma-separated
            toolsArray = trimmed.split(',').map(t => t.trim()).filter(t => t && t !== '[]' && t !== '')
          }
        }
      }
      
      // Final safety check
      if (!Array.isArray(toolsArray)) {
        toolsArray = []
      }
      
      console.log('loadVersion: Tools for', selectedNode.value, '- Raw:', toolsData, 'type:', typeof toolsData, 'isArray:', Array.isArray(toolsData))
      console.log('loadVersion: Parsed toolsArray:', toolsArray, 'length:', toolsArray.length)
      
      // Always update with content from database (this is the source of truth)
      // Use Vue's reactive assignment to ensure reactivity
      if (!nodeContent.value[selectedNode.value]) {
        nodeContent.value[selectedNode.value] = {}
      }
      nodeContent.value[selectedNode.value].role = data.content.role || ''
      nodeContent.value[selectedNode.value].instructions = data.content.instructions || ''
      nodeContent.value[selectedNode.value].tools = [...toolsArray] // Create new array copy for reactivity
      
      console.log('loadVersion: Set nodeContent to:', nodeContent.value[selectedNode.value])
      console.log('loadVersion: Tools in nodeContent:', nodeContent.value[selectedNode.value].tools)
      console.log('loadVersion: Tools array type:', Array.isArray(nodeContent.value[selectedNode.value].tools), 'length:', nodeContent.value[selectedNode.value].tools.length)
      console.log('loadVersion: Tools array contents:', JSON.stringify(nodeContent.value[selectedNode.value].tools))
      nodeHasChanges.value[selectedNode.value] = false
    } else {
      console.log('loadVersion: No content in data or no selectedNode')
    }
  } catch (error) {
    console.error('Error loading version:', error)
    window.$message?.error('Failed to load version: ' + error.message)
  } finally {
    loading.value = false
  }
}

// Save node (automatically creates new version and deploys it)
// IMPORTANT: Editing any node increments the SHARED vertical version for all nodes
async function saveNode(nodeName) {
  if (!selectedVertical.value || !nodeName) return
  
  loading.value = true
  try {
    // 1) Prepare edited node content
    // Ensure tools is an array
    let toolsArray = []
    if (Array.isArray(nodeContent.value[nodeName].tools)) {
      toolsArray = nodeContent.value[nodeName].tools
    } else if (typeof nodeContent.value[nodeName].tools === 'string') {
      toolsArray = nodeContent.value[nodeName].tools
        .split(',')
        .map(t => t.trim())
        .filter(t => t)
    }
    
    // CRITICAL: Preserve existing content fields (valid_contexts, step_criteria, etc.)
    // Load current active version to get existing fields
    const currentPrompt = nodePrompts.value[selectedVertical.value]?.[nodeName]
    const existingContent = currentPrompt?.content || {}
    
    // Merge: preserve migration fields, update edited fields
    const contentObj = {
      ...existingContent,  // PRESERVE: valid_contexts, step_criteria, valid_steps, etc.
      role: nodeContent.value[nodeName].role || '',
      instructions: nodeContent.value[nodeName].instructions || '',
      tools: toolsArray
    }
    
    // Get current vertical version from theme_prompts
    const { data: themeData, error: themeError } = await supabase
      .from('theme_prompts')
      .select('version')
      .eq('vertical', selectedVertical.value)
      .eq('is_active', true)
      .maybeSingle()
    
    if (themeError) throw themeError
    
    // 2) Compute next vertical version
    let currentVerticalVersion = themeData?.version || 1
    const newVerticalVersion = currentVerticalVersion + 1
    
    // 3) Increment vertical version in theme_prompts (the canonical vertical version)
    const { error: versionUpdateError } = await supabase
      .from('theme_prompts')
      .update({ version: newVerticalVersion })
      .eq('vertical', selectedVertical.value)
      .eq('is_active', true)
    
    if (versionUpdateError) throw versionUpdateError
    
    // 4) Load all prompts for this vertical with their active versions
    const { data: prompts, error: promptsError } = await supabase
      .from('prompts')
      .select(`
        id,
        node_name,
        prompt_versions!inner (
          id,
          version_number,
          content,
          is_active
        )
      `)
      .eq('vertical', selectedVertical.value)
      .eq('prompt_versions.is_active', true)
      .not('node_name', 'is', null)
    
    if (promptsError) throw promptsError

    // 5) For every node in the vertical, create a new prompt_versions row with the new shared version
    for (const p of (prompts || [])) {
      const activeVersion = Array.isArray(p.prompt_versions) ? p.prompt_versions[0] : p.prompt_versions
      const priorContent = activeVersion?.content || { role: '', instructions: '', tools: [] }

      // Use edited content only for the node being saved; otherwise reuse prior content
      const newContent = p.node_name === nodeName ? contentObj : priorContent

      // Deactivate all existing versions for this prompt
      await supabase
        .from('prompt_versions')
        .update({ is_active: false })
        .eq('prompt_id', p.id)
      
      // Insert the new version for this prompt with the shared vertical version
      const { error: insertErr } = await supabase
        .from('prompt_versions')
        .insert({
          prompt_id: p.id,
          version_number: newVerticalVersion,
          content: newContent,
          is_active: true,
          is_draft: false,
          created_by: 'portal',
          change_summary: `Vertical v${newVerticalVersion} - ${p.node_name === nodeName ? 'updated' : 'carried forward'} content`
        })
      if (insertErr) throw insertErr

      // Update prompt current_version to new vertical version
      await supabase
        .from('prompts')
        .update({ current_version: newVerticalVersion })
        .eq('id', p.id)
    }
    
    nodeHasChanges.value[nodeName] = false
    window.$message?.success(`Node "${nodeName}" saved! Vertical version: v${newVerticalVersion}`)
    
    await loadNodePrompts()
    await loadVersions(nodeName)
  } catch (error) {
    console.error('Error saving node:', error)
    window.$message?.error('Failed to save node: ' + error.message)
  } finally {
    loading.value = false
  }
}


// Delete draft version
async function deleteVersion(versionId) {
  if (!selectedVertical.value || !selectedNode.value) return
  
  const version = versions.value.find(v => v.id === versionId)
  if (!version) return
  
  // Only allow deleting drafts that are not active
  if (!version.is_draft || version.is_active) {
    window.$message?.error('Can only delete draft versions that have not been deployed')
    return
  }
  
  if (!confirm(`Are you sure you want to delete draft v${version.version_number}? This cannot be undone.`)) {
    return
  }
  
  loading.value = true
  try {
    const { error } = await supabase
      .from('prompt_versions')
      .delete()
      .eq('id', versionId)
    
    if (error) throw error
    
    window.$message?.success(`Draft v${version.version_number} deleted successfully`)
    await loadVersions(selectedNode.value)
  } catch (error) {
    console.error('Error deleting version:', error)
    window.$message?.error('Failed to delete version: ' + error.message)
  } finally {
    loading.value = false
  }
}

// Toggle node expansion
async function toggleNode(node) {
  expandedNodes.value[node] = !expandedNodes.value[node]
  if (expandedNodes.value[node]) {
    selectedNode.value = node
    
    // Ensure nodeContent exists for this node
    if (!nodeContent.value[node]) {
      nodeContent.value[node] = {
        role: '',
        instructions: '',
        tools: []
      }
    }
    
    // First, try to load content from nodePrompts (already loaded from loadNodePrompts)
    const nodePrompt = nodePrompts.value[selectedVertical.value]?.[node]
    console.log('Toggle node:', node, 'NodePrompt:', nodePrompt)
    
      if (nodePrompt && nodePrompt.content) {
        const content = nodePrompt.content
        console.log('Loading content from nodePrompt:', content)
        
        // Handle tools - convert to array for multi-select
        let toolsArray = []
        if (Array.isArray(content.tools)) {
          toolsArray = content.tools
            .flatMap(t => {
              if (Array.isArray(t)) {
                return t
              } else if (typeof t === 'string') {
                try {
                  const parsed = JSON.parse(t)
                  return Array.isArray(parsed) ? parsed : [t]
                } catch {
                  return [t]
                }
              }
              return [t]
            })
            .filter(t => t && t !== '[]' && typeof t === 'string' && t.trim() !== '')
        } else if (typeof content.tools === 'string') {
          if (content.tools === '[]' || content.tools.trim() === '[]') {
            toolsArray = []
          } else {
            try {
              const parsed = JSON.parse(content.tools)
              toolsArray = Array.isArray(parsed) ? parsed : []
            } catch {
              toolsArray = content.tools
                .split(',')
                .map(t => t.trim())
                .filter(t => t && t !== '[]')
            }
          }
        }
        
        // Create new object to ensure Vue reactivity
        const newNodeContent = {
          role: content.role || '',
          instructions: content.instructions || '',
          tools: [...toolsArray] // Create new array copy for reactivity
        }
        nodeContent.value[node] = newNodeContent
      
      console.log('Set nodeContent for', node, ':', nodeContent.value[node])
    } else if (!nodeContent.value[node]) {
      // Initialize empty if no content exists
      console.log('No content found, initializing empty for', node)
      nodeContent.value[node] = {
        role: '',
        instructions: '',
        tools: [] // Initialize as empty array for multi-select
      }
    }
    
    // Then load versions (which will load the active version and may update content)
    await loadVersions(node)
  }
}

// Mark node as changed
function markNodeChanged(node) {
  nodeHasChanges.value[node] = true
}

// Update role
function updateRole(node, value) {
  if (!nodeContent.value[node]) {
    nodeContent.value[node] = { role: '', instructions: '', tools: [] }
  }
  nodeContent.value[node].role = value
  markNodeChanged(node)
}

// Update instructions
function updateInstructions(node, value) {
  if (!nodeContent.value[node]) {
    nodeContent.value[node] = { role: '', instructions: '', tools: [] }
  }
  nodeContent.value[node].instructions = value
  markNodeChanged(node)
}

// Set dropdown wrapper ref (simplified - don't update position here)
function setDropdownWrapperRef(node, el) {
  // Just store the ref, don't update position here to avoid loops
}

// Update dropdown position
function updateDropdownPosition(node, wrapperEl) {
  if (!openDropdowns.value[node] || !wrapperEl) return
  if (isUpdatingPosition.value[node]) return // Prevent infinite loops
  
  isUpdatingPosition.value[node] = true
  
  // Use requestAnimationFrame instead of nextTick for better performance
  requestAnimationFrame(() => {
    try {
      const trigger = wrapperEl.querySelector('.tools-dropdown-trigger')
      if (!trigger) {
        isUpdatingPosition.value[node] = false
        return
      }
      
      const rect = trigger.getBoundingClientRect()
      const viewportHeight = window.innerHeight
      const dropdownMaxHeight = 300
      const spaceBelow = viewportHeight - rect.bottom
      const spaceAbove = rect.top
      
      // Check if we should drop up
      const shouldDropUp = spaceBelow < dropdownMaxHeight && spaceAbove > spaceBelow
      
      dropdownPositions.value[node] = {
        dropUp: shouldDropUp,
        style: {
          position: 'fixed',
          top: shouldDropUp ? 'auto' : `${rect.bottom + 4}px`,
          bottom: shouldDropUp ? `${viewportHeight - rect.top + 4}px` : 'auto',
          left: `${rect.left}px`,
          width: `${rect.width}px`,
          zIndex: 10000
        }
      }
    } finally {
      isUpdatingPosition.value[node] = false
    }
  })
}

// Toggle dropdown
function toggleDropdown(node) {
  openDropdowns.value[node] = !openDropdowns.value[node]
  if (openDropdowns.value[node]) {
    if (!toolSearch.value[node]) {
      toolSearch.value[node] = ''
    }
    // Update position after opening with a small delay
    setTimeout(() => {
      const wrapper = document.querySelector(`[data-dropdown-node="${node}"]`)
      if (wrapper) {
        updateDropdownPosition(node, wrapper)
      }
    }, 10)
  } else {
    // Clear position when closing
    delete dropdownPositions.value[node]
  }
}

// Filter tools based on search
function filteredTools(node) {
  const search = toolSearch.value[node] || ''
  const baseFilter = availableTools.filter(t => !NON_EDITABLE_TOOLS.includes(t))
  if (!search) return baseFilter
  return baseFilter.filter(tool => 
    tool.toLowerCase().includes(search.toLowerCase())
  )
}

// Check if a tool is selected
function isToolSelected(node, tool) {
  if (!nodeContent.value[node]) {
    return false
  }
  const tools = nodeContent.value[node].tools
  if (!tools) {
    return false
  }
  if (!Array.isArray(tools)) {
    return false
  }
  return tools.includes(tool)
}

// Count selected discretionary tools (exclude baseline flow tools)
function getSelectedDisplayCount(node) {
  const tools = nodeContent.value[node]?.tools
  if (!Array.isArray(tools)) return 0
  return tools.filter(t => !NON_EDITABLE_TOOLS.includes(t) && availableTools.includes(t)).length
}

// Check if all tools are selected
function isAllToolsSelected(node) {
  const selected = nodeContent.value[node]?.tools || []
  if (!Array.isArray(selected)) return false
  const filtered = filteredTools(node)
  return filtered.length > 0 && filtered.every(tool => selected.includes(tool))
}

// Toggle select all
function toggleSelectAll(node) {
  if (!nodeContent.value[node]) {
    nodeContent.value[node] = {
      role: '',
      instructions: '',
      tools: []
    }
  }
  
  if (!Array.isArray(nodeContent.value[node].tools)) {
    nodeContent.value[node].tools = []
  }
  
  const filtered = filteredTools(node)
  const allSelected = isAllToolsSelected(node)
  
  if (allSelected) {
    // Deselect all filtered tools
    filtered.forEach(tool => {
      const index = nodeContent.value[node].tools.indexOf(tool)
      if (index > -1) {
        nodeContent.value[node].tools.splice(index, 1)
      }
    })
  } else {
    // Select all filtered tools
    filtered.forEach(tool => {
      if (!nodeContent.value[node].tools.includes(tool)) {
        nodeContent.value[node].tools.push(tool)
      }
    })
  }
  
  markNodeChanged(node)
}

// Toggle tool selection
function toggleTool(node, tool) {
  if (!nodeContent.value[node]) {
    nodeContent.value[node] = {
      role: '',
      instructions: '',
      tools: []
    }
  }
  
  if (!Array.isArray(nodeContent.value[node].tools)) {
    nodeContent.value[node].tools = []
  }
  
  const index = nodeContent.value[node].tools.indexOf(tool)
  if (index > -1) {
    nodeContent.value[node].tools.splice(index, 1)
  } else {
    nodeContent.value[node].tools.push(tool)
  }
  
  markNodeChanged(node)
}

// Show preview
function showPreview(node) {
  const nodeData = nodeContent.value[node]
  const theme = themeContent.value || '[Theme not loaded]'
  
  const preview = `${theme}

---

=== CALL CONTEXT (preview) ===
Call Type: inbound
Direction: Inbound
Phone: +15551234567
Lead Status: Known (ID: preview-123)
Lead Name: John Smith
Qualified: Yes
Property: 123 Main St, Los Angeles, CA
Est. Equity: $450,000
Assigned Broker: Walter White (ABC Mortgage)
===================

---

## Role
${nodeData.role || '[No role defined]'}

## Instructions
${nodeData.instructions || '[No instructions defined]'}

## Tools
${nodeData.tools || '[No tools defined]'}`
  
  previewContent.value = preview
  
  if (isMobile.value) {
    // On mobile, show preview in modal or scroll to it
    window.scrollTo({ top: document.querySelector('.preview-panel')?.offsetTop || 0, behavior: 'smooth' })
  }
}

// Test settings
function testSettings() {
  const validation = {
    valid: true,
    errors: []
  }
  
  if (!config.value.models.llm.provider || !config.value.models.llm.model) {
    validation.valid = false
    validation.errors.push('LLM provider and model are required')
  }
  
  if (!config.value.models.stt.provider || !config.value.models.stt.model) {
    validation.valid = false
    validation.errors.push('STT provider and model are required')
  }
  
  if (!config.value.models.tts.provider || !config.value.models.tts.voice) {
    validation.valid = false
    validation.errors.push('TTS provider and voice are required')
  }
  
  testResults.value = JSON.stringify({
    valid: validation.valid,
    errors: validation.errors,
    config: config.value
  }, null, 2)
  
  showTestModal.value = true
  
  // Try WebSpeech API for TTS sample (if available)
  if ('speechSynthesis' in window) {
    const utterance = new SpeechSynthesisUtterance(`Testing ${config.value.models.tts.voice} voice`)
    utterance.rate = 0.9
    utterance.pitch = 1
    speechSynthesis.speak(utterance)
  }
}

// Format date
function formatDate(dateString) {
  if (!dateString) return ''
  const date = new Date(dateString)
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

// Handle vertical change
async function onVerticalChange() {
  if (!selectedVertical.value) return
  
  initNodeContent()
  await loadTheme()
  await loadNodePrompts()
  
  // Don't auto-expand any nodes - leave them all closed
  selectedNode.value = null
  
  // Load versions for the first node so the versions bar has content
  // Wait a tick to ensure nodePrompts is populated after loadNodePrompts
  await nextTick()
  if (nodeKeys.length > 0) {
    const firstNode = nodeKeys[0]
    // Check if this node actually has data loaded
    if (nodePrompts.value[selectedVertical.value]?.[firstNode]) {
      selectedNode.value = firstNode
      await loadVersions(firstNode)
      // Keep selectedNode set so versions bar stays populated
    }
  }
}

// Handle window resize
function handleResize() {
  isMobile.value = window.innerWidth < 768
}

// Watchers
watch(selectedNode, (newNode) => {
  if (newNode) {
    loadVersions(newNode)
  }
})

// Lifecycle
// Close dropdowns when clicking outside
function handleClickOutside(event) {
  const target = event.target
  // Don't close if clicking on node card header (it has its own click handler)
  if (target.closest('.node-card-header')) {
    return
  }
  // Don't close if clicking on the dropdown panel itself (it's teleported to body)
  if (target.closest('.tools-dropdown-panel')) {
    return
  }
  if (!target.closest('.tools-dropdown-wrapper')) {
    // Close all dropdowns
    Object.keys(openDropdowns.value).forEach(node => {
      openDropdowns.value[node] = false
    })
  }
}

onMounted(async () => {
  window.addEventListener('resize', handleResize)
  handleResize()
  // Add click outside listener for dropdowns
  document.addEventListener('click', handleClickOutside)
  // Update dropdown positions on scroll/resize
  window.addEventListener('scroll', updateAllDropdownPositions, true)
  window.addEventListener('resize', updateAllDropdownPositions)
  // Load STT models, LLM models, and TTS voices from database
  await loadSTTModelsFromDB()
  await loadLLMModelsFromDB()
  await loadTTSVoicesFromDB()
  // Auto-load Reverse Mortgage on mount
  await onVerticalChange()
})

// Update all open dropdown positions (debounced)
let positionUpdateTimeout = null
function updateAllDropdownPositions() {
  // Debounce to prevent excessive updates
  if (positionUpdateTimeout) {
    clearTimeout(positionUpdateTimeout)
  }
  positionUpdateTimeout = setTimeout(() => {
    Object.keys(openDropdowns.value).forEach(node => {
      if (openDropdowns.value[node] && !isUpdatingPosition.value[node]) {
        const wrapper = document.querySelector(`[data-dropdown-node="${node}"]`)
        if (wrapper) {
          updateDropdownPosition(node, wrapper)
        }
      }
    })
  }, 16) // ~60fps
}

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  document.removeEventListener('click', handleClickOutside)
  window.removeEventListener('scroll', updateAllDropdownPositions, true)
  window.removeEventListener('resize', updateAllDropdownPositions)
})

</script>

<style scoped>
.verticals-page {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  min-height: 100vh;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
  color: #fff !important;
  padding: 2rem;
  overflow-y: auto;
  overflow-x: hidden;
  margin: 0;
  box-sizing: border-box;
  max-width: 100vw;
}

/* Override workspace-content padding for this page */
:deep(.workspace-content) {
  padding: 0 !important;
  overflow: visible;
}

/* Hide workspace header for this route */
:deep(.workspace-header) {
  display: none;
}

.verticals-page * {
  color: inherit;
}

/* Custom scrollbar styling to match dark theme */
.verticals-page::-webkit-scrollbar,
.nodes-grid::-webkit-scrollbar,
.versions-bar::-webkit-scrollbar {
  width: 12px;
  height: 12px;
}

.verticals-page::-webkit-scrollbar-track,
.nodes-grid::-webkit-scrollbar-track,
.versions-bar::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 6px;
}

.verticals-page::-webkit-scrollbar-thumb,
.nodes-grid::-webkit-scrollbar-thumb,
.versions-bar::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.9);
  border-radius: 6px;
  border: 2px solid rgba(255, 255, 255, 0.05);
}

.verticals-page::-webkit-scrollbar-thumb:hover,
.nodes-grid::-webkit-scrollbar-thumb:hover,
.versions-bar::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 1);
}

/* Scrollbar arrows - match the dark track */
.verticals-page::-webkit-scrollbar-button,
.nodes-grid::-webkit-scrollbar-button,
.versions-bar::-webkit-scrollbar-button {
  background: rgba(255, 255, 255, 0.05);
  display: block;
  height: 12px;
  width: 12px;
}

.verticals-page::-webkit-scrollbar-button:hover,
.nodes-grid::-webkit-scrollbar-button:hover,
.versions-bar::-webkit-scrollbar-button:hover {
  background: rgba(255, 255, 255, 0.1);
}

/* Firefox scrollbar styling */
.verticals-page,
.nodes-grid,
.versions-bar {
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.9) rgba(255, 255, 255, 0.05);
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.page-title {
  font-size: 1.75rem;
  font-weight: 600;
  margin: 0;
  color: #fff !important;
}

.vertical-selector {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.vertical-selector label {
  font-weight: 500;
  color: #fff !important;
}

.vertical-selector select {
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: rgba(255, 255, 255, 0.1);
  color: #fff !important;
  font-size: 0.875rem;
}

.vertical-selector select option {
  background: #1a1a2e;
  color: #fff;
}

.settings-tabs {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 2rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.tab-button {
  padding: 0.75rem 1.5rem;
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  border-bottom: 2px solid transparent;
  transition: all 0.2s;
}

.tab-button:hover {
  color: #fff;
}

.tab-button.active {
  color: #fff;
  border-bottom-color: #8a2be2;
}

.main-content {
  display: grid;
  grid-template-columns: 280px 1fr;
  gap: 3rem;
  position: relative;
  max-width: 100%;
  overflow-x: hidden;
  overflow-y: visible; /* Allow dropdown to extend vertically */
}

.main-content:has(.preview-panel) {
  grid-template-columns: 280px 1fr 400px;
}

.versions-bar {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 0.5rem;
  padding: 1rem;
  position: sticky;
  top: 2rem;
  height: fit-content;
  max-height: calc(100vh - 4rem);
  overflow-y: auto;
}

.versions-bar.mobile {
  position: static;
  grid-column: 1 / -1;
  margin-bottom: 1rem;
}

.versions-header {
  margin-bottom: 1rem;
}

.versions-header h3 {
  font-size: 1rem;
  margin: 0;
  color: #fff !important;
}

.versions-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  align-items: flex-start;
}

.versions-list.horizontal {
  flex-direction: row;
  overflow-x: auto;
  padding-bottom: 0.5rem;
}

.version-item {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 0.5rem;
  padding: 0.75rem;
  cursor: pointer;
  transition: all 0.2s;
  text-align: left;
  width: 175px;
  flex-shrink: 0;
}

.versions-list.horizontal .version-item {
  width: 175px;
  min-width: 175px;
}

.version-item:hover {
  background: rgba(255, 255, 255, 0.1);
}

.version-item.active {
  background: rgba(138, 43, 226, 0.2);
  border-color: #8a2be2;
}

.version-badge {
  display: inline-block;
  padding: 0.125rem 0.5rem;
  background: #10b981;
  color: #fff;
  border-radius: 0.25rem;
  font-size: 0.625rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
}

.version-badge.draft {
  background: #f59e0b;
}

.version-number {
  display: block;
  font-weight: 600;
  margin-bottom: 0.25rem;
  color: #fff !important;
}

.version-date {
  display: block;
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.8) !important;
  text-align: left;
}

.btn-delete {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  width: 1.5rem;
  height: 1.5rem;
  padding: 0;
  background: rgba(239, 68, 68, 0.2);
  color: #ef4444;
  border: 1px solid rgba(239, 68, 68, 0.4);
  border-radius: 0.25rem;
  cursor: pointer;
  font-size: 1.25rem;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.btn-delete:hover {
  background: rgba(239, 68, 68, 0.3);
  border-color: #ef4444;
}

.btn-delete:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.version-item {
  position: relative;
}

.content-area {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 0.5rem;
  padding: 2rem;
  max-width: 100%;
  overflow-x: hidden;
  overflow-y: visible; /* Allow dropdown to extend vertically */
}

.tab-content {
  margin-bottom: 2rem;
}

.theme-editor-section h2,
.settings-form h2 {
  font-size: 1.5rem;
  margin-bottom: 1.5rem;
  color: #fff !important;
}

.editor-wrapper {
  margin-bottom: 1rem;
}

.theme-editor {
  width: 100%;
  min-height: 200px;
  padding: 1rem;
  border-radius: 0.5rem;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: rgba(0, 0, 0, 0.2);
  color: #fff !important;
  font-family: 'Courier New', monospace;
  font-size: 0.875rem;
  resize: vertical;
}

.theme-editor::placeholder {
  color: rgba(255, 255, 255, 0.5) !important;
}

.form-group {
  margin-bottom: 1.5rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
  color: #fff !important;
}

.form-group .form-hint {
  display: block;
  margin-top: 0.25rem;
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.6) !important;
  font-style: italic;
}

.form-group input[type="text"],
.form-group input[type="number"],
.form-group select,
.form-group textarea {
  width: 100%;
  padding: 0.75rem;
  border-radius: 0.5rem;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: rgba(0, 0, 0, 0.2);
  color: #fff !important;
  font-size: 0.875rem;
}

.form-group select option {
  background: #1a1a2e;
  color: #fff;
}

.form-group input[type="checkbox"] {
  width: auto;
  margin-right: 0.5rem;
}

.editor-actions,
.form-actions {
  display: flex;
  gap: 1rem;
  margin-top: 1.5rem;
}

.btn-save,
.btn-test {
  padding: 0.75rem 1.5rem;
  background: #8a2be2;
  color: #fff;
  border: none;
  border-radius: 0.5rem;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s;
}

.btn-save:hover,
.btn-test:hover {
  background: #7c1ed9;
}

.btn-save:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-test {
  background: #10b981;
}

.btn-test:hover {
  background: #059669;
}

.nodes-section {
  margin-top: 2rem;
  width: 100%;
  overflow-x: auto;
  overflow-y: visible; /* Allow dropdown to extend vertically */
  padding-bottom: 1rem;
}

.nodes-header h2 {
  font-size: 1.5rem;
  margin-bottom: 1.5rem;
  color: #fff !important;
}

.nodes-grid {
  display: flex;
  gap: 1rem;
  overflow-x: auto;
  overflow-y: visible; /* Allow dropdown to extend vertically */
  padding-bottom: 0.5rem;
}

/* Desktop/Tablet: versions bar on left, nodes align left-to-right horizontally */
@media (min-width: 768px) {
  .nodes-grid {
    flex-direction: row;
    flex-wrap: nowrap;
    align-items: flex-start;
  }
  
  .node-card {
    min-width: 280px;
  }
}

/* Mobile: versions bar on top, nodes align top-to-bottom vertically */
@media (max-width: 767px) {
  .nodes-grid {
    flex-direction: column;
    overflow-x: visible;
  }
}

.node-card {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 0.5rem;
  overflow: visible; /* Allow dropdown to extend beyond card */
  transition: all 0.2s;
  flex-shrink: 0;
  width: auto;
  min-height: 400px;
  position: relative; /* Ensure z-index works */
}

.node-card:hover {
  background: rgba(255, 255, 255, 0.08);
}

.node-card.active {
  border-color: #8a2be2;
}

/* Expanded state: wider horizontally */
.node-card.expanded {
  width: 550px;
}

.node-card-header {
  padding: 1rem;
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.node-name {
  font-weight: 600;
  text-transform: capitalize;
  color: #fff !important;
}

.node-toggle {
  font-size: 1.5rem;
  color: rgba(255, 255, 255, 0.6);
}

.node-card-content {
  padding: 1rem;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  overflow: visible; /* Allow dropdown to extend beyond content */
  position: relative; /* Ensure z-index works */
}

.node-editor {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.editor-field {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.editor-field label {
  font-weight: 500;
  font-size: 0.875rem;
  color: #fff !important;
}

.editor-field textarea,
.editor-field input {
  width: 100%;
  padding: 0.75rem;
  border-radius: 0.5rem;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: rgba(0, 0, 0, 0.2);
  color: #fff !important;
  font-size: 0.875rem;
  font-family: inherit;
}

.editor-field textarea::placeholder,
.editor-field input::placeholder {
  color: rgba(255, 255, 255, 0.5) !important;
}

.tools-dropdown-wrapper {
  position: relative;
  width: 100%;
}

.tools-dropdown-trigger {
  width: 100%;
  padding: 0.75rem;
  border-radius: 0.5rem;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: rgba(0, 0, 0, 0.2);
  color: #fff !important;
  font-size: 0.875rem;
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;
  transition: border-color 0.2s, background 0.2s;
}

.tools-dropdown-trigger:hover {
  border-color: rgba(255, 255, 255, 0.3);
  background: rgba(0, 0, 0, 0.3);
}

.tools-dropdown-wrapper.open .tools-dropdown-trigger {
  border-color: #8a2be2;
}

.dropdown-arrow {
  font-size: 0.75rem;
  transition: transform 0.2s;
  color: rgba(255, 255, 255, 0.7);
}

.tools-dropdown-wrapper.open .dropdown-arrow {
  transform: rotate(180deg);
}

.tools-dropdown-panel {
  /* Position will be set via inline style from JavaScript */
  z-index: 10000; /* Very high z-index to appear above everything */
  background: rgba(20, 20, 30, 0.98);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 0.5rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
  max-height: 300px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.dropdown-search {
  padding: 0.5rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.search-input {
  width: 100%;
  padding: 0.5rem;
  border-radius: 0.25rem;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: rgba(0, 0, 0, 0.3);
  color: #fff !important;
  font-size: 0.875rem;
}

.search-input::placeholder {
  color: rgba(255, 255, 255, 0.5) !important;
}

.dropdown-options {
  overflow-y: auto;
  max-height: 250px;
  padding: 0.25rem 0;
}

.dropdown-option {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  cursor: pointer;
  transition: background 0.2s;
  color: #fff !important;
}

.dropdown-option:hover {
  background: rgba(255, 255, 255, 0.05);
}

.dropdown-option.select-all {
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  margin-bottom: 0.25rem;
  font-weight: 500;
}

.dropdown-option input[type="checkbox"] {
  width: 18px;
  height: 18px;
  cursor: pointer;
  accent-color: #8a2be2;
  flex-shrink: 0;
}

.dropdown-option span {
  font-family: 'Courier New', monospace;
  font-size: 0.875rem;
  color: #fff !important;
  user-select: none;
}

.node-actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.btn-preview {
  padding: 0.5rem 1rem;
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 0.5rem;
  cursor: pointer;
  font-size: 0.875rem;
}

.preview-panel {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 0.5rem;
  padding: 1rem;
  position: sticky;
  top: 2rem;
  height: fit-content;
  max-height: calc(100vh - 4rem);
  overflow-y: auto;
}

.preview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.preview-header h3 {
  font-size: 1rem;
  margin: 0;
  color: #fff !important;
}

.btn-close {
  background: transparent;
  border: none;
  color: #fff;
  font-size: 1.5rem;
  cursor: pointer;
  padding: 0;
  width: 2rem;
  height: 2rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.preview-content {
  background: rgba(0, 0, 0, 0.3);
  border-radius: 0.5rem;
  padding: 1rem;
}

.preview-content pre {
  margin: 0;
  font-size: 0.75rem;
  line-height: 1.5;
  white-space: pre-wrap;
  word-wrap: break-word;
  color: #fff;
}

.empty-state {
  text-align: center;
  padding: 4rem 2rem;
  color: rgba(255, 255, 255, 0.9) !important;
}

.empty-state p {
  color: rgba(255, 255, 255, 0.9) !important;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: #1a1a2e;
  border-radius: 0.5rem;
  padding: 2rem;
  max-width: 600px;
  width: 90%;
  max-height: 80vh;
  overflow-y: auto;
}

.modal-content h3 {
  margin-top: 0;
  margin-bottom: 1rem;
  color: #fff !important;
}

.test-results {
  background: rgba(0, 0, 0, 0.3);
  border-radius: 0.5rem;
  padding: 1rem;
  margin-bottom: 1rem;
}

.test-results pre {
  margin: 0;
  font-size: 0.875rem;
  color: #fff;
}

@media (max-width: 1023px) {
  .main-content {
    grid-template-columns: 1fr !important;
  }
  
  .preview-panel {
    position: static;
    margin-top: 2rem;
    grid-column: 1 / -1;
  }
}

@media (max-width: 767px) {
  .verticals-page {
    padding: 1rem;
  }
  
  .page-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 1rem;
  }
  
  .nodes-grid {
    grid-template-columns: 1fr;
  }
  
  .settings-tabs {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }
  
  .tab-button {
    white-space: nowrap;
  }
}
</style>

